#!/usr/bin/env python3
# NSP v2.1 RU-Lite — интеграционный тест против localhost:8000.
# Покрывает: handshake, SUBSCRIBE (R1), OPS_BCAST из WS, OPS+ACK, STATE_REQ,
# RESUME с реплеем без дублей, R1-негатив 4003, /down, /send, 404 на мусор,
# kill switch 503 + force-close.
import json, socket, struct, sys, time, zlib, base64

HOST, PORT = "127.0.0.1", 8000
BOOT = b"\xfa\x5a\x00\x02"
T_HELLO, T_AUTH, T_AUTHOK, T_OPS, T_OPSB, T_ACK, T_CURSOR, T_SREQ, T_STATE, T_EVENT, T_PING, T_PONG, T_ERR, T_CLOSE, T_SUB = range(1, 16)

results = []
def check(name, ok, info=""):
    results.append((name, bool(ok)))
    print(("PASS" if ok else "FAIL"), "-", name, ("| " + str(info) if info else ""))

def varint(n):
    out = b""
    while True:
        b = n & 0x7F; n >>= 7
        if n: out += bytes([b | 0x80])
        else: return out + bytes([b])

def enc(prefix, typ, payload: bytes):
    return prefix + bytes([typ, 0]) + varint(len(payload)) + payload + struct.pack("<I", zlib.crc32(payload))

def jenc(prefix, typ, obj):
    return enc(prefix, typ, json.dumps(obj).encode())

def parse_frames(prefix, fbuf):
    """Разобрать все полные фреймы из буфера. Возвращает (frames, rest).
    prefix=None — принимать любой FA 5A xx xx (до получения AUTH_OK,
    в котором сервер выдаёт prefix_tail)."""
    frames = []
    while len(fbuf) >= 7:
        if fbuf[:2] != b"\xfa\x5a" or (prefix is not None and fbuf[:4] != prefix):
            i = fbuf.find(b"\xfa\x5a", 1)
            fbuf = fbuf[i:] if i > 0 else b""
            continue
        i = 6; length = 0; shift = 0
        while True:
            if i >= len(fbuf): return frames, fbuf
            b = fbuf[i]; i += 1
            length |= (b & 0x7F) << shift; shift += 7
            if not (b & 0x80): break
        end = i + length + 4
        if len(fbuf) < end: return frames, fbuf
        payload = fbuf[i:i+length]
        crc = struct.unpack("<I", fbuf[i+length:end])[0]
        if zlib.crc32(payload) == crc:
            frames.append((fbuf[4], payload))
        fbuf = fbuf[end:]
    return frames, fbuf

class Conn:
    """HTTP/1.1 chunked full-duplex."""
    def __init__(self, method, path, chunked=True, timeout=10):
        self.sock = socket.create_connection((HOST, PORT), timeout=timeout)
        self.buf = b""
        hdr = f"{method} {path} HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nContent-Type: application/octet-stream\r\n"
        if chunked and method == "POST":
            hdr += "Transfer-Encoding: chunked\r\n"
        hdr += "Connection: close\r\n\r\n"
        self.sock.sendall(hdr.encode())
        self.headers_read = False
        self.status = None
        self.fbuf = b""
        self.eof = False

    def send_chunk(self, data):
        self.sock.sendall(b"%x\r\n%s\r\n" % (len(data), data))

    def close_body(self):
        try: self.sock.sendall(b"0\r\n\r\n")
        except OSError: pass

    def _recv(self, timeout):
        self.sock.settimeout(timeout)
        try:
            d = self.sock.recv(65536)
        except socket.timeout:
            return "timeout"
        except OSError:
            return "closed"
        if not d: return "closed"
        self.buf += d
        return "ok"

    def read_headers(self, timeout=10):
        t0 = time.time()
        while b"\r\n\r\n" not in self.buf:
            r = self._recv(max(0.1, timeout - (time.time() - t0)))
            if r != "ok":
                return None
        head, self.buf = self.buf.split(b"\r\n\r\n", 1)
        self.status = int(head.split(b" ")[1])
        self.headers_read = True
        return self.status

    def read_chunk(self, timeout):
        t0 = time.time()
        while True:
            if self.eof: return None
            # пропускаем пустые строки (keep-alive CRLF между чанками)
            while self.buf.startswith(b"\r\n"):
                self.buf = self.buf[2:]
            idx = self.buf.find(b"\r\n")
            if idx < 0:
                if self._recv(max(0.1, timeout - (time.time() - t0))) != "ok": return None
                continue
            try:
                size = int(self.buf[:idx], 16)
            except ValueError:
                raise ValueError(f"bad chunk header: {self.buf[:idx]!r} buf={self.buf[:64]!r}")
            if len(self.buf) < idx + 2 + size + 2:
                if self._recv(max(0.1, timeout - (time.time() - t0))) != "ok": return None
                continue
            data = self.buf[idx+2: idx+2+size]
            self.buf = self.buf[idx+2+size:]
            if size == 0:
                self.eof = True
                return None
            return data

class NSPClient:
    def __init__(self, token, hello_extra=None, path="/api/nsp/v2/up"):
        self.token = token
        self.conn = Conn("POST", path)
        self.prefix = BOOT
        self.session_id = None
        self.last_recv_seq = 0
        self.fbuf = b""
        self.dec_prefix = None  # до AUTH_OK принимаем любой FA 5A xx xx
        hello = {"protocol": 2, "profile": "ru-lite", "client": "python-it"}
        if hello_extra: hello.update(hello_extra)
        self.conn.send_chunk(jenc(BOOT, T_HELLO, hello))
        self.conn.send_chunk(jenc(BOOT, T_AUTH, {"jwt": token}))

    def read_frames(self, timeout=5):
        """Возвращает список (type, payload_obj), собранных за timeout секунд."""
        t0 = time.time()
        while time.time() - t0 < timeout:
            frames, self.fbuf = parse_frames(self.dec_prefix, self.fbuf)
            if frames:
                return self._wrap(frames)
            chunk = self.conn.read_chunk(max(0.05, t0 + timeout - time.time()))
            if chunk is None:
                break
            self.fbuf += chunk
        frames, self.fbuf = parse_frames(self.dec_prefix, self.fbuf)
        return self._wrap(frames)

    def _wrap(self, frames):
        res = []
        for typ, payload in frames:
            try:
                obj = json.loads(payload)
            except Exception:
                obj = {}
            if isinstance(obj, dict) and "seq" in obj:
                self.last_recv_seq = max(self.last_recv_seq, obj["seq"])
            res.append((typ, obj))
        return res

    def wait_for(self, types, timeout=5):
        """Ждёт фрейм одного из типов; возвращает (type, obj) или None."""
        t0 = time.time()
        while time.time() - t0 < timeout:
            for typ, obj in self.read_frames(timeout=0.3):
                if typ == T_PING:
                    self.send(T_PONG, {"ts": obj.get("ts", 0)})
                    continue
                if typ in types:
                    return typ, obj
        return None

    def send(self, typ, obj):
        self.conn.send_chunk(jenc(self.prefix, typ, obj))

    def finish_handshake(self, timeout=5):
        st = self.conn.read_headers(timeout)
        if st != 200:
            return st, None
        r = self.wait_for({T_AUTHOK, T_ERR}, timeout)
        if not r: return 200, None
        typ, obj = r
        if typ == T_ERR: return 200, obj
        self.session_id = obj["session_id"]
        tail = bytes.fromhex(obj["prefix_tail"])
        self.prefix = b"\xfa\x5a" + tail
        self.dec_prefix = self.prefix
        return 200, obj

def jwt_uid(tok):
    p = tok.split(".")[1]
    p += "=" * (-len(p) % 4)
    c = json.loads(base64.urlsafe_b64decode(p))
    return c.get("user_id") or c.get("uid")

def make_op(op_id, elem, lamport, uid, text):
    return {"op_id": op_id, "element_id": elem, "action": "set",
            "value": {"text": text}, "lamport": lamport, "user_id": uid}

# ---------- тесты ----------

tok_alice = open("/tmp/tok_qa_tester_1.txt").read().strip()
tok_bob = open("/tmp/tok_bob_test.txt").read().strip()
tok_ontario = open("/tmp/tok_ontario.txt").read().strip()
tok_kirin = open("/tmp/ktok_kirin.txt").read().strip()
alice_uid = jwt_uid(tok_alice)
bob_uid = jwt_uid(tok_bob)
print("alice uid", alice_uid, "bob uid", bob_uid)

# 0. Мусор → мгновенный 404
c = Conn("POST", "/api/nsp/v2/up")
c.send_chunk(b"garbage-garbage-garbage")
st = c.read_headers(5)
check("garbage bootstrap -> instant 404", st == 404, f"status={st}")
c.sock.close()

# 1. Handshake HELLO->AUTH->AUTH_OK
alice = NSPClient(tok_alice)
st, authok = alice.finish_handshake(5)
check("handshake HELLO/AUTH -> AUTH_OK", st == 200 and authok and authok.get("session_id"),
      f"status={st} authok={authok}")
if not (authok and authok.get("session_id")):
    print("FATAL: no session, aborting"); sys.exit(1)
check("AUTH_OK heartbeat_ms=30000, max_frame=65536",
      authok.get("heartbeat_ms") == 30000 and authok.get("max_frame") == 65536,
      f"hb={authok.get('heartbeat_ms')} mf={authok.get('max_frame')}")
sid = alice.session_id
print("session:", sid)

# 2. SUBSCRIBE channel_id=1 tool_id=3 (R1 allow)
alice.send(T_SUB, {"channels": [{"channel_id": 1, "tool_id": 3}]})
time.sleep(0.5)

# 3. bob шлёт op через WS -> NSP down получает OPS_BCAST <= 3s
import websocket
ws = websocket.create_connection(f"ws://{HOST}:{PORT}/ws/collab/1/3?token={tok_bob}", timeout=5)
op1 = make_op("op-ws-1", "elem-ws-1", 100, bob_uid, "from-ws")
ws.send(json.dumps({"type": "update", "tool_id": 3, "ops": [op1]}))
t0 = time.time()
got = alice.wait_for({T_OPSB, T_ERR}, 3)
dt = time.time() - t0
ok = got and got[0] == T_OPSB and any(o.get("op_id") == "op-ws-1" for o in got[1].get("ops", []))
check("WS op -> NSP OPS_BCAST <= 3s", ok, f"dt={dt:.2f}s got={got[0] if got else None}")

# 4. NSP клиент шлёт OPS через /up -> ACK с acked
op2 = make_op("op-nsp-1", "elem-nsp-1", 200, alice_uid, "from-nsp")
alice.send(T_OPS, {"tool_id": 3, "ops": [op2]})
got = alice.wait_for({T_ACK, T_ERR}, 5)
# может прийти эхо OPS_BCAST раньше — wait_for вернёт ACK или ERR только
ok = got and got[0] == T_ACK and "op-nsp-1" in got[1].get("acked", [])
check("NSP OPS -> ACK {acked, applied}", ok, f"got={got}")

# 5. STATE_REQ -> STATE
alice.send(T_SREQ, {"tool_id": 3})
t0 = time.time()
state = None
while time.time() - t0 < 5:
    got = alice.wait_for({T_STATE, T_ERR}, 2)
    if got and got[0] == T_STATE:
        state = got[1]; break
elems = (state or {}).get("state", {}).get("elements", {})
check("STATE_REQ -> STATE с elements (вкл. elem-nsp-1)",
      state is not None and "elem-nsp-1" in elems, f"elems={list(elems.keys())}")

# 6. RESUME: фиксируем last_recv_seq, обрыв, bob шлёт 2 ops, reconnect
last_seq = alice.last_recv_seq
alice.conn.sock.close()
time.sleep(0.5)
op_r1 = make_op("op-ws-r1", "elem-r1", 300, bob_uid, "resume1")
op_r2 = make_op("op-ws-r2", "elem-r2", 301, bob_uid, "resume2")
ws.send(json.dumps({"type": "update", "tool_id": 3, "ops": [op_r1]}))
time.sleep(0.3)
ws.send(json.dumps({"type": "update", "tool_id": 3, "ops": [op_r2]}))
time.sleep(0.5)

alice2 = NSPClient(tok_alice, hello_extra={"resume_session": sid, "last_recv_seq": last_seq})
st, authok2 = alice2.finish_handshake(5)
check("RESUME -> AUTH_OK той же сессии", st == 200 and authok2 and authok2.get("session_id") == sid,
      f"sid={authok2 and authok2.get('session_id')}")
seen = {}
t0 = time.time()
while time.time() - t0 < 5 and not all(k in seen for k in ("op-ws-r1", "op-ws-r2")):
    got = alice2.wait_for({T_OPSB}, 2)
    if got:
        for o in got[1].get("ops", []):
            seen[o.get("op_id")] = seen.get(o.get("op_id"), 0) + 1
check("RESUME реплей: обе пропущенные ops получены",
      seen.get("op-ws-r1", 0) >= 1 and seen.get("op-ws-r2", 0) >= 1, f"seen={seen}")
check("RESUME реплей: без дублей (каждая ровно 1 раз)",
      seen.get("op-ws-r1") == 1 and seen.get("op-ws-r2") == 1, f"seen={seen}")

# 7. /down endpoint: отдача фреймов клиенту
down = Conn("GET", f"/api/nsp/v2/down?session_id={sid}", chunked=False)
st = down.read_headers(5)
check("GET /down -> 200 chunked", st == 200, f"status={st}")
# bob шлёт op; /up alice2 и /down делят одну очередь — читаем оба
op_d = make_op("op-ws-d1", "elem-d1", 400, bob_uid, "down1")
ws.send(json.dumps({"type": "update", "tool_id": 3, "ops": [op_d]}))
found = False
down_fbuf = down.buf  # остаток после заголовков
t0 = time.time()
while time.time() - t0 < 5 and not found:
    frames, down_fbuf = parse_frames(alice2.dec_prefix, down_fbuf)
    for typ, payload in frames:
        try: obj = json.loads(payload)
        except Exception: obj = {}
        if typ == T_OPSB and any(o.get("op_id") == "op-ws-d1" for o in obj.get("ops", [])):
            found = True
    if found: break
    got = alice2.wait_for({T_OPSB}, 0.5)
    if got and any(o.get("op_id") == "op-ws-d1" for o in got[1].get("ops", [])):
        found = True
        break
    chunk = down.read_chunk(0.5)
    if chunk is None:
        break
    down_fbuf += chunk
check("OPS_BCAST дошёл (up или down стрим)", found, f"found={found}")
down.sock.close()

# 8. /send батч-режим
op_b = make_op("op-nsp-b1", "elem-b1", 500, alice_uid, "batch1")
batch = jenc(alice2.prefix, T_OPS, {"tool_id": 3, "ops": [op_b]})
import http.client
hc = http.client.HTTPConnection(HOST, PORT, timeout=5)
hc.request("POST", f"/api/nsp/v2/send?session_id={sid}", body=batch,
           headers={"Content-Type": "application/octet-stream"})
resp = hc.getresponse()
body = json.loads(resp.read())
check("POST /send батч -> 200 {received>=1}", resp.status == 200 and body.get("received", 0) >= 1,
      f"status={resp.status} body={body}")
hc.close()

# 9. R1-негатив: ontario SUBSCRIBE ch12/tool6 -> ERROR 4003
ont = NSPClient(tok_ontario)
st, oa = ont.finish_handshake(5)
check("ontario handshake ok", st == 200 and oa and oa.get("session_id"), f"status={st}")
ont.send(T_SUB, {"channels": [{"channel_id": 12, "tool_id": 6}]})
got = ont.wait_for({T_ERR}, 5)
check("R1-негатив: ontario SUBSCRIBE ch12/tool6 -> ERROR 4003",
      got and got[1].get("code") == 4003, f"got={got}")
ont.conn.sock.close()

# 10. kill switch: kill_all=true -> новые NSP 503, активные оборваны; вернуть
import urllib.request
def put_switch(key, enabled):
    req = urllib.request.Request(
        f"http://{HOST}:{PORT}/api/super-admin/sync-transports",
        data=json.dumps({"key": key, "enabled": enabled}).encode(),
        method="PUT",
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + tok_kirin})
    with urllib.request.urlopen(req, timeout=5) as r:
        return r.status, json.loads(r.read())

st, _ = put_switch("kill_all", True)
check("kill_all=true PUT 200", st == 200, f"status={st}")

# новый NSP /up -> 503
c2 = Conn("POST", "/api/nsp/v2/up")
c2.send_chunk(jenc(BOOT, T_HELLO, {"protocol": 2}))
st = c2.read_headers(5)
body503 = c2.buf
check("kill_all: новый /up -> 503 kill switch active", st == 503 and b"kill switch active" in body503,
      f"status={st} body={body503[:80]}")
c2.sock.close()

# активный стрим alice2 оборван
dead = False
t0 = time.time()
while time.time() - t0 < 5:
    r = alice2.conn.read_chunk(1)
    if r is None:
        dead = True; break
check("kill_all: активный NSP-стрим оборван", dead, "")
alice2.conn.sock.close()

# вернуть kill_all=false
st, _ = put_switch("kill_all", False)
check("kill_all=false restored", st == 200, f"status={st}")

# NSP снова работает
c3 = Conn("POST", "/api/nsp/v2/up")
c3.send_chunk(jenc(BOOT, T_HELLO, {"protocol": 2}))
c3.send_chunk(jenc(BOOT, T_AUTH, {"jwt": tok_alice}))
st = c3.read_headers(5)
check("после restore /up снова 200", st == 200, f"status={st}")
c3.sock.close()
ws.close()

print()
npass = sum(1 for _, ok in results if ok)
print(f"== {npass}/{len(results)} PASS ==")
sys.exit(0 if npass == len(results) else 1)
