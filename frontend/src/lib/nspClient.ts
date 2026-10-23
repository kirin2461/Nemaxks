/**
 * NSP — Nebula Sync Protocol v2.1 «RU-Lite» web-клиент.
 * Спека: NSP_Protocol_Spec_v2.1_RU-Lite.md §2–§4.
 *
 * Транспорт:
 *  - uplink full-duplex: POST /api/nsp/v2/up (fetch streaming body, duplex:'half');
 *    если браузер не поддерживает потоковый upload (Safari → TypeError) —
 *    прозрачный батч-режим: фреймы копятся 50мс → POST /api/nsp/v2/send.
 *  - downlink: ответ /up (full-duplex) + всегда GET /api/nsp/v2/down?session_id=
 *    после AUTH_OK (сервер делит очередь S→C между открытыми стримами).
 *
 * Фрейм: prefix(4B) + type(1B) + flags(1B) + varint length + payload(JSON) + crc32 IEEE LE.
 * prefix bootstrap: FA 5A 00 02 (HELLO/AUTH). Session prefix: FA 5A + prefix_tail
 * (tail приходит в AUTH_OK payload — до AUTH_OK матчим любой FA 5A ?? ??).
 *
 * Надёжность: RESUME по session_id + last_recv_seq (sessionStorage),
 * backoff 1s × 2^n cap 30s, PONG на PING, watchdog отсутствия фреймов,
 * идемпотентность: pending-set op_id, ACK удаляет, STATE переписывает.
 */

// --- Типы фреймов (спека §3.5) ---
export const NSP = {
  HELLO: 0x01,
  AUTH: 0x02,
  AUTH_OK: 0x03,
  OPS: 0x04,
  OPS_BCAST: 0x05,
  ACK: 0x06,
  CURSOR: 0x07,
  STATE_REQ: 0x08,
  STATE: 0x09,
  EVENT: 0x0a,
  PING: 0x0b,
  PONG: 0x0c,
  ERROR: 0x0d,
  CLOSE: 0x0e,
  SUBSCRIBE: 0x0f,
} as const

/** ERROR-коды (спека §3.5). */
export const NSP_ERR = {
  BAD_AUTH: 4001,
  ACCESS_DENIED: 4003,
  NOT_FOUND: 4004,
  SESSION_EXPIRED: 4005,
  BUFFER_OVERFLOW: 4006,
  TRANSPORT_DISABLED: 4503,
  KILL_SWITCH: 4600,
} as const

const MAX_FRAME = 65536
const BATCH_FLUSH_MS = 50
const HANDSHAKE_TIMEOUT_MS = 10000
const WATCHDOG_MS = 90000 // PING сервера каждые 30s; 90s тишины = стрим мёртв
const BOOTSTRAP_PREFIX = new Uint8Array([0xfa, 0x5a, 0x00, 0x02])

// --- CRC32 IEEE (табличный, poly 0xEDB88320) ---
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c = CRC32_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// --- varint (LEB128 unsigned, как binary.Uvarint в Go) ---
export function encodeVarint(n: number): Uint8Array {
  const out: number[] = []
  do {
    let b = n % 128
    n = Math.floor(n / 128)
    if (n > 0) b |= 0x80
    out.push(b)
  } while (n > 0)
  return new Uint8Array(out)
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/** Кодирование фрейма (спека §3). payload > 65536 отклоняется. */
export function encodeFrame(prefix: Uint8Array, type: number, payload: Uint8Array): Uint8Array {
  if (payload.length > MAX_FRAME) throw new Error('nsp: frame too large')
  const len = encodeVarint(payload.length)
  const out = new Uint8Array(4 + 2 + len.length + payload.length + 4)
  out.set(prefix, 0)
  out[4] = type
  out[5] = 0 // flags: zstd/ack не используем в lite
  out.set(len, 6)
  out.set(payload, 6 + len.length)
  const crc = crc32(payload)
  const co = 6 + len.length + payload.length
  out[co] = crc & 0xff
  out[co + 1] = (crc >>> 8) & 0xff
  out[co + 2] = (crc >>> 16) & 0xff
  out[co + 3] = (crc >>> 24) & 0xff
  return out
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export function encodeJSONFrame(prefix: Uint8Array, type: number, obj: unknown): Uint8Array {
  return encodeFrame(prefix, type, textEncoder.encode(JSON.stringify(obj)))
}

export interface NspFrame {
  type: number
  flags: number
  payload: Uint8Array
}

/**
 * Потоковый декодер фреймов: склейка из произвольных чанков ReadableStream.
 * expectedPrefix === null → матчим любой FA 5A ?? ?? (до AUTH_OK, где
 * клиент узнаёт prefix_tail; сам AUTH_OK уже приходит с session-префиксом).
 * Мусор/битый CRC → resync на следующее FA 5A, поток не убиваем.
 */
export class NspFrameDecoder {
  private buf: Uint8Array = new Uint8Array(0)

  constructor(private expectedPrefix: Uint8Array | null) {}

  feed(chunk: Uint8Array): void {
    this.buf = concatBytes([this.buf, chunk])
  }

  next(): NspFrame | null {
    for (;;) {
      // Минимум: prefix(4) + type(1) + flags(1) + varint(>=1)
      if (this.buf.length < 7) return null
      const b = this.buf
      const prefixOk =
        b[0] === 0xfa &&
        b[1] === 0x5a &&
        (this.expectedPrefix === null || (b[2] === this.expectedPrefix[2] && b[3] === this.expectedPrefix[3]))
      if (!prefixOk) {
        this.resync()
        if (this.buf.length < 7) return null
        continue
      }
      // varint length
      let length = 0
      let shift = 0
      let i = 6
      for (;;) {
        if (i >= b.length) return null // varint оборван — ждём дочитки
        const byte = b[i]
        i++
        length += (byte & 0x7f) * Math.pow(2, shift)
        shift += 7
        if ((byte & 0x80) === 0) break
        if (shift > 35) {
          this.resync()
          return null
        }
      }
      if (length > MAX_FRAME) {
        this.resync()
        continue
      }
      const frameLen = i + length + 4
      if (b.length < frameLen) return null // фрейм оборван — ждём дочитки
      const payload = b.slice(i, i + length)
      const crcWant =
        (b[i + length] | (b[i + length + 1] << 8) | (b[i + length + 2] << 16) | (b[i + length + 3] << 24)) >>> 0
      if (crc32(payload) !== crcWant) {
        // Битый фрейм — граница известна по length, отбрасываем целиком
        this.buf = b.slice(frameLen)
        continue
      }
      const frame: NspFrame = { type: b[4], flags: b[5], payload }
      this.buf = b.slice(frameLen)
      return frame
    }
  }

  /** Отбросить мусор до следующего возможного начала фрейма (FA 5A). */
  private resync(): void {
    const b = this.buf
    for (let i = 1; i < b.length - 1; i++) {
      if (b[i] === 0xfa && b[i + 1] === 0x5a) {
        this.buf = b.slice(i)
        return
      }
    }
    // Хвост из одного 0xFA может быть началом префикса, оборванного чтением
    this.buf = b.length > 0 && b[b.length - 1] === 0xfa ? b.slice(b.length - 1) : new Uint8Array(0)
  }
}

/** Детекция поддержки потокового upload (fetch + ReadableStream body). */
let streamingUploadSupported: boolean | null = null
export function supportsStreamingUpload(): boolean {
  if (streamingUploadSupported !== null) return streamingUploadSupported
  try {
    let duplexAccessed = false
    const url = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const req = new Request(url, {
      method: 'POST',
      body: new ReadableStream(),
      // @ts-expect-error duplex отсутствует в lib.dom RequestInit
      get duplex() {
        duplexAccessed = true
        return 'half'
      },
    })
    streamingUploadSupported = duplexAccessed && !req.headers.has('Content-Type')
  } catch {
    streamingUploadSupported = false
  }
  return streamingUploadSupported
}

export interface NspCursor {
  tool_id: number
  user_id: number
  x: number
  y: number
  color?: string
}

export interface NspClientOptions {
  /** Токен для AUTH-фрейма; вызывается на каждом (ре)коннекте. */
  getToken: () => string | null | Promise<string | null>
  /** Базовый URL API (по умолчанию same-origin). */
  baseUrl?: string
  /** Namespace для sessionStorage (у нескольких клиентов — разные). */
  storageNS?: string
  /** Внутренний авто-reconnect с backoff + RESUME (default true). */
  autoReconnect?: boolean
  /** Принудительный батч-режим аплинка (POST /send вместо streaming /up). */
  forceBatch?: boolean
  onOpen?: (sessionId: string) => void
  onOps?: (toolId: number, ops: unknown[], fromUserId: number) => void
  onAck?: (toolId: number, acked: string[], applied: number) => void
  onCursor?: (cursor: NspCursor) => void
  onState?: (toolId: number, state: unknown) => void
  onEvent?: (data: unknown) => void
  onError?: (code: number, message: string) => void
  /** Стрим умер (соединение разорвано). При autoReconnect последует реконнект. */
  onClose?: () => void
}

interface StoredSession {
  sessionId: string
  prefixTail: string // hex, 2 байта
  lastRecvSeq: number
}

class NspHttpError extends Error {
  constructor(public status: number) {
    super(`nsp: http ${status}`)
  }
}

export class NspClient {
  private opts: NspClientOptions
  private baseUrl: string
  private storageNS: string
  private autoReconnect: boolean

  private closed = true
  private dead = true // защита от повторного handleStreamDeath на одном соединении
  private opened = false // AUTH_OK получен
  private batchMode: boolean | null = null // null = ещё не определён
  private sessionId: string | null = null
  private sessionPrefix: Uint8Array | null = null
  private lastRecvSeq = 0

  private upWriter: WritableStreamDefaultWriter<Uint8Array> | null = null
  private upAbort: AbortController | null = null
  private downAbort: AbortController | null = null
  private batchQueue: Uint8Array[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private batchInFlight = false

  private subs = new Map<number, number>() // toolId -> channelId
  private pendingOps = new Set<string>() // op_id до ACK (идемпотентность)
  private seenSeqs = new Set<number>() // seq-дедуп: реплей может пересекаться с pending-очередью сервера

  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: NspClientOptions) {
    this.opts = opts
    this.baseUrl = opts.baseUrl ?? ''
    this.storageNS = opts.storageNS ?? 'nsp'
    this.autoReconnect = opts.autoReconnect !== false
    this.loadStoredSession()
  }

  isOpen(): boolean {
    return this.opened && !this.closed
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  pendingCount(): number {
    return this.pendingOps.size
  }

  // --- sessionStorage (RESUME по session_id + last_recv_seq, спека §4) ---

  private storageGet(key: string): string | null {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`${this.storageNS}.${key}`) : null
    } catch {
      return null
    }
  }

  private storageSet(key: string, value: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(`${this.storageNS}.${key}`, value)
    } catch {
      // sessionStorage недоступен (приватный режим) — RESUME не будет, не fatal
    }
  }

  private loadStoredSession(): void {
    const sessionId = this.storageGet('session_id')
    const prefixTail = this.storageGet('prefix_tail')
    const seq = Number(this.storageGet('last_recv_seq'))
    if (sessionId && prefixTail && /^[0-9a-f]{4}$/i.test(prefixTail)) {
      this.sessionId = sessionId
      this.sessionPrefix = new Uint8Array([0xfa, 0x5a, parseInt(prefixTail.slice(0, 2), 16), parseInt(prefixTail.slice(2, 4), 16)])
      this.lastRecvSeq = Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : 0
    }
  }

  private persistSession(): void {
    if (!this.sessionId || !this.sessionPrefix) return
    const tail = `${this.sessionPrefix[2].toString(16).padStart(2, '0')}${this.sessionPrefix[3].toString(16).padStart(2, '0')}`
    this.storageSet('session_id', this.sessionId)
    this.storageSet('prefix_tail', tail)
    this.storageSet('last_recv_seq', String(this.lastRecvSeq))
  }

  private clearStoredSession(): void {
    this.sessionId = null
    this.sessionPrefix = null
    this.lastRecvSeq = 0
    // Батч-очередь закодирована старым session-префиксом — на fresh-сессии
    // это мусор; state сойдётся через STATE (спека §4: STATE переписывает)
    this.batchQueue = []
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(`${this.storageNS}.session_id`)
        sessionStorage.removeItem(`${this.storageNS}.prefix_tail`)
        sessionStorage.removeItem(`${this.storageNS}.last_recv_seq`)
      }
    } catch {
      // ignore
    }
  }

  // --- Публичное API ---

  connect(): void {
    if (!this.closed) return
    this.closed = false
    this.reconnectAttempt = 0
    void this.doConnect()
  }

  /** Полное закрытие (без реконнекта). */
  close(): void {
    if (this.closed) return
    this.closed = true
    // CLOSE-фрейм best-effort (спека §3.5)
    try {
      if (this.opened && this.sessionId) {
        const frame = encodeJSONFrame(this.sessionPrefix ?? BOOTSTRAP_PREFIX, NSP.CLOSE, { reason: 'client_close' })
        if (this.upWriter) {
          void this.upWriter.write(frame).catch(() => {})
        } else if (this.batchMode) {
          void fetch(`${this.baseUrl}/api/nsp/v2/send?session_id=${encodeURIComponent(this.sessionId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: frame as unknown as BodyInit,
            keepalive: true,
          }).catch(() => {})
        }
      }
    } catch {
      // ignore
    }
    this.teardown()
  }

  subscribe(channelId: number, toolId: number): void {
    this.subs.set(toolId, channelId)
    if (this.isOpen()) {
      this.sendFrame(NSP.SUBSCRIBE, { channels: [{ channel_id: channelId, tool_id: toolId }] })
    }
  }

  unsubscribe(toolId: number): void {
    this.subs.delete(toolId)
  }

  sendOps(toolId: number, ops: ReadonlyArray<{ op_id?: string }>): void {
    for (const op of ops) {
      if (op && typeof op.op_id === 'string') this.pendingOps.add(op.op_id)
    }
    this.sendFrame(NSP.OPS, { tool_id: toolId, ops })
  }

  sendCursor(toolId: number, x: number, y: number, color?: string): void {
    this.sendFrame(NSP.CURSOR, { tool_id: toolId, x, y, color })
  }

  requestState(toolId: number): void {
    this.sendFrame(NSP.STATE_REQ, { tool_id: toolId })
  }

  // --- Handshake / соединение ---

  private buildHello(): Record<string, unknown> {
    const hello: Record<string, unknown> = { protocol: 2, profile: 'ru-lite', client: 'web' }
    if (this.sessionId) {
      hello.resume_session = this.sessionId
      hello.last_recv_seq = this.lastRecvSeq
    }
    return hello
  }

  private handshakeFrames(token: string): Uint8Array {
    return concatBytes([
      encodeJSONFrame(BOOTSTRAP_PREFIX, NSP.HELLO, this.buildHello()),
      encodeJSONFrame(BOOTSTRAP_PREFIX, NSP.AUTH, { jwt: token }),
    ])
  }

  private async doConnect(): Promise<void> {
    if (this.closed) return
    this.dead = false
    const token = await this.opts.getToken()
    if (this.closed) return
    if (!token) {
      console.warn('[NSP] no token, reconnect scheduled')
      this.scheduleReconnect()
      return
    }
    const wantBatch = this.batchMode === true || this.opts.forceBatch === true || !supportsStreamingUpload()
    if (!wantBatch) {
      try {
        await this.connectStreaming(token)
        return
      } catch (e) {
        if (this.closed) return
        const name = (e as { name?: string } | null)?.name
        if (e instanceof TypeError || name === 'AbortError') {
          // TypeError: Safari/старые браузеры — нет потокового upload.
          // AbortError: наш handshake-таймаут — транспорт не вернул ответ
          // (h1-буферизация прокси/клиента). Оба случая → батч-режим
          // (детектируется один раз на сессию, спека §2 правка №3)
          console.warn('[NSP] streaming uplink unavailable, switching to batch mode')
          this.batchMode = true
          this.teardown() // сбросить частично открытый streaming-стейт
        } else {
          console.warn('[NSP] streaming connect failed:', e)
          this.scheduleReconnect()
          return
        }
      }
    }
    try {
      await this.connectBatch(token)
    } catch (e) {
      if (this.closed) return
      console.warn('[NSP] batch connect failed:', e)
      this.scheduleReconnect()
    }
  }

  /** Full-duplex: POST /up с потоковым телом; ответ — поток S→C фреймов. */
  private async connectStreaming(token: string): Promise<void> {
    const stream = new TransformStream<Uint8Array, Uint8Array>()
    const writer = stream.writable.getWriter()
    this.upWriter = writer
    const abort = new AbortController()
    this.upAbort = abort

    const fetchPromise = fetch(`${this.baseUrl}/api/nsp/v2/up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: stream.readable,
      // @ts-expect-error duplex отсутствует в lib.dom RequestInit
      duplex: 'half',
      signal: abort.signal,
    })
    // HELLO + AUTH (bootstrap-префикс) пишем СРАЗУ, не дожидаясь ответа:
    // сервер шлёт заголовки 200 только после handshake — `await fetch` до
    // записи был бы дедлоком (спека §2: HELLO→AUTH→AUTH_OK в том же стриме).
    void writer.write(this.handshakeFrames(token)).catch(() => {
      if (!this.closed) this.handleStreamDeath('up handshake write error')
    })
    // Таймаут handshake: если транспорт не поддерживает настоящий duplex
    // (h1-буферизация), ответ 200 никогда не придёт — abort → батч-режим.
    const fetchTimeout = setTimeout(() => {
      try {
        abort.abort()
      } catch {
        // ignore
      }
    }, HANDSHAKE_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetchPromise
    } finally {
      clearTimeout(fetchTimeout)
    }
    if (!res.ok || !res.body) {
      this.teardown()
      throw new NspHttpError(res.status)
    }
    this.armHandshakeTimeout()
    this.readLoop(res.body, 'up')
  }

  /** Батч-режим: handshake через POST /send, даунлинк — GET /down. */
  private async connectBatch(token: string): Promise<void> {
    this.batchMode = true
    const res = await fetch(`${this.baseUrl}/api/nsp/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: this.handshakeFrames(token) as unknown as BodyInit,
    })
    if (!res.ok) throw new NspHttpError(res.status)
    const data = (await res.json()) as { received?: number; session_id?: string; error?: string }
    if (data.error === 'session_expired') {
      // 4005: сессия протухла — полный re-handshake без resume (спека §4)
      this.clearStoredSession()
      throw new Error('nsp: session_expired')
    }
    if (data.error || !data.session_id) throw new Error(`nsp: handshake failed: ${data.error ?? 'no session_id'}`)
    this.sessionId = data.session_id
    this.persistSession()
    this.armHandshakeTimeout()
    // AUTH_OK (с prefix_tail) придёт в /down — до него матчим любой FA 5A ?? ??
    this.openDown()
  }

  /** GET /down?session_id=... — открывается всегда после AUTH_OK/выдачи session_id. */
  private openDown(): void {
    if (this.closed || !this.sessionId || this.downAbort) return
    const abort = new AbortController()
    this.downAbort = abort
    fetch(`${this.baseUrl}/api/nsp/v2/down?session_id=${encodeURIComponent(this.sessionId)}`, { signal: abort.signal })
      .then((res) => {
        if (!res.ok || !res.body) {
          if (res.status === 404) this.clearStoredSession() // сессия умерла на сервере
          if (!this.closed) this.handleStreamDeath(`down http ${res.status}`)
          return
        }
        this.readLoop(res.body, 'down')
      })
      .catch(() => {
        if (!this.closed) this.handleStreamDeath('down error')
      })
  }

  private readLoop(body: ReadableStream<Uint8Array>, kind: string): void {
    const reader = body.getReader()
    // До AUTH_OK префикс неизвестен (AUTH_OK уже session-фрейм) — матчим любой FA 5A
    const dec = new NspFrameDecoder(this.opened ? this.sessionPrefix : null)
    const pump = (): void => {
      reader
        .read()
        .then(({ done, value }) => {
          if (this.closed) {
            void reader.cancel().catch(() => {})
            return
          }
          if (done) {
            this.handleStreamDeath(`${kind} eof`)
            return
          }
          if (value && value.length > 0) {
            dec.feed(value)
            let frame: NspFrame | null
            while ((frame = dec.next()) !== null) {
              this.handleFrame(frame)
              if (this.closed) return
            }
          }
          pump()
        })
        .catch(() => {
          if (!this.closed) this.handleStreamDeath(`${kind} error`)
        })
    }
    pump()
  }

  // --- Разбор фреймов S→C ---

  private handleFrame(frame: NspFrame): void {
    this.armWatchdog()
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(textDecoder.decode(frame.payload)) as Record<string, unknown>
    } catch {
      return
    }
    if (typeof obj.seq === 'number') {
      // Дедуп по seq: при RESUME реплей ring buffer может пересечься с
      // фреймами, ещё висящими в out-очереди сервера (двойная доставка).
      // Max (lastRecvSeq) двигаем только вперёд — он уходит в resume HELLO.
      if (this.seenSeqs.has(obj.seq)) return
      this.seenSeqs.add(obj.seq)
      if (this.seenSeqs.size > 4096) {
        const oldest = this.seenSeqs.values().next().value
        if (oldest !== undefined) this.seenSeqs.delete(oldest)
      }
      if (obj.seq > this.lastRecvSeq) {
        this.lastRecvSeq = obj.seq
        if (this.sessionId) this.storageSet('last_recv_seq', String(this.lastRecvSeq))
      }
    }

    switch (frame.type) {
      case NSP.AUTH_OK: {
        const sessionId = obj.session_id as string | undefined
        const tail = obj.prefix_tail as string | undefined
        if (!sessionId || !tail || !/^[0-9a-f]{4}$/i.test(tail)) return
        this.sessionId = sessionId
        this.sessionPrefix = new Uint8Array([0xfa, 0x5a, parseInt(tail.slice(0, 2), 16), parseInt(tail.slice(2, 4), 16)])
        this.persistSession()
        const wasOpen = this.opened
        this.opened = true
        this.reconnectAttempt = 0
        if (this.handshakeTimer) {
          clearTimeout(this.handshakeTimer)
          this.handshakeTimer = null
        }
        // Даунлинк: после AUTH_OK всегда открываем /down (в full-duplex
        // сервер делит очередь S→C между /up-ответом и /down — читаем оба)
        this.openDown()
        // Подписки восстанавливаем (при fresh-сессии их нет на сервере)
        for (const [toolId, channelId] of this.subs) {
          this.sendFrame(NSP.SUBSCRIBE, { channels: [{ channel_id: channelId, tool_id: toolId }] })
        }
        console.log(`[NSP] connected, session=${sessionId}${wasOpen ? ' (resumed)' : ''}`)
        this.opts.onOpen?.(sessionId)
        break
      }
      case NSP.OPS_BCAST:
        this.opts.onOps?.(Number(obj.tool_id) || 0, Array.isArray(obj.ops) ? (obj.ops as unknown[]) : [], Number(obj.from_user_id) || 0)
        break
      case NSP.ACK: {
        const acked = Array.isArray(obj.acked) ? (obj.acked as string[]) : []
        for (const id of acked) this.pendingOps.delete(id)
        this.opts.onAck?.(Number(obj.tool_id) || 0, acked, Number(obj.applied) || 0)
        break
      }
      case NSP.CURSOR:
        this.opts.onCursor?.({
          tool_id: Number(obj.tool_id) || 0,
          user_id: Number(obj.user_id) || 0,
          x: Number(obj.x) || 0,
          y: Number(obj.y) || 0,
          color: typeof obj.color === 'string' ? obj.color : undefined,
        })
        break
      case NSP.STATE:
        this.opts.onState?.(Number(obj.tool_id) || 0, obj.state)
        break
      case NSP.EVENT:
        this.opts.onEvent?.(obj)
        break
      case NSP.PING:
        this.sendFrame(NSP.PONG, { ts: typeof obj.ts === 'number' ? obj.ts : Date.now() })
        break
      case NSP.ERROR: {
        const code = Number(obj.code) || 0
        const message = typeof obj.message === 'string' ? obj.message : String(obj.message ?? '')
        console.warn(`[NSP] ERROR ${code}: ${message}`)
        if (code === NSP_ERR.SESSION_EXPIRED) {
          // 4005 → полный re-handshake без resume (спека §4)
          this.clearStoredSession()
          this.handleStreamDeath('session_expired')
        } else if (code === NSP_ERR.BUFFER_OVERFLOW) {
          // 4006 → STATE full-sync по всем подпискам (спека §4)
          for (const toolId of this.subs.keys()) this.requestState(toolId)
        }
        this.opts.onError?.(code, message)
        break
      }
      case NSP.CLOSE:
        this.handleStreamDeath('server close')
        break
      default:
        break
    }
  }

  // --- Uplink ---

  private sendFrame(type: number, obj: unknown): void {
    if (this.closed) return
    let frame: Uint8Array
    try {
      frame = encodeJSONFrame(this.sessionPrefix ?? BOOTSTRAP_PREFIX, type, obj)
    } catch {
      return
    }
    if (this.upWriter) {
      this.upWriter.write(frame).catch(() => {
        if (!this.closed) this.handleStreamDeath('up write error')
      })
    } else {
      this.queueBatch(frame)
    }
  }

  private queueBatch(frame: Uint8Array): void {
    this.batchQueue.push(frame)
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => void this.flushBatch(), BATCH_FLUSH_MS)
    }
  }

  private async flushBatch(): Promise<void> {
    this.batchTimer = null
    if (this.batchInFlight || this.batchQueue.length === 0 || !this.sessionId || this.closed) return
    this.batchInFlight = true
    const frames = this.batchQueue.splice(0)
    try {
      const res = await fetch(`${this.baseUrl}/api/nsp/v2/send?session_id=${encodeURIComponent(this.sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: concatBytes(frames) as unknown as BodyInit,
      })
      if (res.status === 404) {
        // Сессия умерла на сервере → полный re-handshake
        this.clearStoredSession()
        this.handleStreamDeath('send 404')
        return
      }
      if (!res.ok) throw new NspHttpError(res.status)
    } catch {
      // Сеть мигнула — фреймы возвращаем в голову очереди, уходим на реконнект
      this.batchQueue.unshift(...frames)
      if (!this.closed) this.handleStreamDeath('send error')
      return
    } finally {
      this.batchInFlight = false
    }
    if (this.batchQueue.length > 0 && !this.batchTimer) {
      this.batchTimer = setTimeout(() => void this.flushBatch(), BATCH_FLUSH_MS)
    }
  }

  // --- Жизненный цикл ---

  private handleStreamDeath(reason: string): void {
    if (this.closed || this.dead) return
    this.dead = true
    console.warn(`[NSP] stream dead: ${reason}`)
    this.teardown()
    this.opts.onClose?.()
    this.scheduleReconnect()
  }

  private teardown(): void {
    this.opened = false
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer)
      this.handshakeTimer = null
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    if (this.upAbort) {
      try {
        this.upAbort.abort()
      } catch {
        // ignore
      }
      this.upAbort = null
    }
    if (this.downAbort) {
      try {
        this.downAbort.abort()
      } catch {
        // ignore
      }
      this.downAbort = null
    }
    if (this.upWriter) {
      const w = this.upWriter
      this.upWriter = null
      void w.close().catch(() => {})
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || !this.autoReconnect) return
    if (this.reconnectTimer) return
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000) // 1s × 2^n, cap 30s (спека §4)
    this.reconnectAttempt++
    console.log(`[NSP] reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.doConnect()
    }, delay)
  }

  private armHandshakeTimeout(): void {
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer)
    this.handshakeTimer = setTimeout(() => {
      if (!this.opened && !this.closed) this.handleStreamDeath('handshake timeout')
    }, HANDSHAKE_TIMEOUT_MS)
  }

  private armWatchdog(): void {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer)
    this.watchdogTimer = setTimeout(() => {
      if (!this.closed) this.handleStreamDeath('watchdog: no frames 90s')
    }, WATCHDOG_MS)
  }
}
