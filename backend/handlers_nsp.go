package main

// NSP v2.1 «RU-Lite» HTTP-эндпоинты (спека §2):
//
//	POST /api/nsp/v2/up    — chunked приём фреймов C→S (full-duplex: S→C в ответе)
//	GET  /api/nsp/v2/down  — chunked отдача фреймов S→C
//	POST /api/nsp/v2/send  — батч-аплинк (тело = пачка фреймов, ответ {received:N})
//
// authMiddleware НЕ используется: JWT внутри AUTH-фрейма (спека §5).
// Невалидный bootstrap/мусор → мгновенный 404, соединение не удерживается.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kirin2461/Nemaxks/backend/nsp"
)

// nspHelloPayload — HELLO C→S (спека §3.5).
type nspHelloPayload struct {
	Protocol      int    `json:"protocol"`
	Profile       string `json:"profile"`
	Client        string `json:"client"`
	ResumeSession string `json:"resume_session"`
	LastRecvSeq   int64  `json:"last_recv_seq"`
}

// Ошибки handshake. errNotFound — невалидный bootstrap → мгновенный 404.
// Остальные — после валидного HELLO, отвечаем ERROR-фреймом с кодом.
var (
	errNotFound       = errors.New("invalid bootstrap")
	errBadAuth        = errors.New("bad_auth")
	errSessionExpired = errors.New("session_expired")
)

// nspReadFrame читает из r до полного фрейма (обрывы дочитываются по length).
// Перед каждым blocking-read продлевает read deadline соединения.
func nspReadFrame(r io.Reader, dec *nsp.Decoder, rc *http.ResponseController) (*nsp.Frame, error) {
	chunk := make([]byte, 32*1024)
	for {
		f, err := dec.Next()
		if err != nil {
			return nil, err
		}
		if f != nil {
			return f, nil
		}
		if rc != nil {
			_ = rc.SetReadDeadline(time.Now().Add(nspPongTimeout))
		}
		n, err := r.Read(chunk)
		if n > 0 {
			dec.Feed(chunk[:n])
		}
		if err != nil {
			return nil, err
		}
	}
}

// nspWriteFrame пишет фрейм в chunked-ответ и сбрасывает flusher
// (write deadline продлевается на каждой записи, как в sseWriteFrame).
func nspWriteFrame(c *gin.Context, rc *http.ResponseController, frame []byte) bool {
	if err := rc.SetWriteDeadline(time.Now().Add(60 * time.Second)); err != nil {
		return false
	}
	if _, err := c.Writer.Write(frame); err != nil {
		return false
	}
	c.Writer.Flush()
	return true
}

func nspStreamHeaders(c *gin.Context) {
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)
	// Заголовки уходят немедленно: иначе Go отложит их до первого Write,
	// а на /down первого фрейма может долго не быть (PING только через 30s).
	c.Writer.Flush()
}

// nspReadHelloAuth читает HELLO + AUTH (до AUTH_OK обрабатываются только
// они, спека §5). JWT валидируется тем же кодом, что authenticateCollabWS
// (blacklist включён). Мусор/невалидный bootstrap → errNotFound.
func nspReadHelloAuth(r io.Reader, dec *nsp.Decoder, rc *http.ResponseController) (nspHelloPayload, uint, string, error) {
	var hello nspHelloPayload

	f, err := nspReadFrame(r, dec, rc)
	if err != nil || f.Type != nsp.TypeHELLO {
		return hello, 0, "", errNotFound
	}
	if err := json.Unmarshal(f.Payload, &hello); err != nil || hello.Protocol != 2 {
		return hello, 0, "", errNotFound
	}

	f, err = nspReadFrame(r, dec, rc)
	if err != nil || f.Type != nsp.TypeAUTH {
		return hello, 0, "", errNotFound
	}
	var authReq struct {
		JWT string `json:"jwt"`
	}
	if err := json.Unmarshal(f.Payload, &authReq); err != nil || authReq.JWT == "" {
		return hello, 0, "", errBadAuth
	}
	userID, username, err := parseCollabToken(authReq.JWT)
	if err != nil {
		log.Printf("[NSP] auth failed: %v", err)
		return hello, 0, "", errBadAuth
	}
	return hello, userID, username, nil
}

// nspFinishHandshake — после успешного AUTH: RESUME существующей сессии
// или создание новой; AUTH_OK (+ реплей ring buffer при RESUME, спека §4).
func nspFinishHandshake(userID uint, username string, hello nspHelloPayload) (*nspSession, error) {
	if hello.ResumeSession != "" {
		sess := nspGetSession(hello.ResumeSession)
		if sess == nil || sess.userID != userID {
			return nil, errSessionExpired
		}
		// AUTH_OK не буферизуем при RESUME: клиент сессию уже знает,
		// а реплей [last_recv_seq+1..] не должен захватить сам AUTH_OK.
		sess.deliverJSON(nsp.TypeAUTHOK, nspAuthOKPayload(sess), true, false)
		nspResumeReplay(sess, hello.LastRecvSeq)
		log.Printf("[NSP] session %s resumed by user %d (last_recv_seq=%d)", sess.id, userID, hello.LastRecvSeq)
		return sess, nil
	}
	sess := nspNewSession(userID, username)
	sess.deliverJSON(nsp.TypeAUTHOK, nspAuthOKPayload(sess), true, true)
	return sess, nil
}

// nspAuthOKPayload собирает AUTH_OK (спека §3.5).
func nspAuthOKPayload(s *nspSession) map[string]interface{} {
	return map[string]interface{}{
		"session_id":     s.id,
		"prefix_tail":    fmt.Sprintf("%02x%02x", s.prefixTail[0], s.prefixTail[1]),
		"server_time_ms": time.Now().UnixMilli(),
		"heartbeat_ms":   nspHeartbeatPeriod.Milliseconds(),
		"max_frame":      nsp.MaxFrameSize,
	}
}

// nspResumeReplay — реплей ring buffer при RESUME (спека §4):
// фреймы [last_recv_seq+1..]; буфер вытеснен → ERROR 4006 buffer_overflow
// + STATE full по всем подпискам.
func nspResumeReplay(s *nspSession, lastRecvSeq int64) {
	frames, ok := s.replayAfter(lastRecvSeq)
	if !ok {
		s.deliverError(nsp.ErrCodeBufferOverflow, "buffer_overflow")
		s.mu.Lock()
		tools := make([]uint, 0, len(s.subs))
		for toolID := range s.subs {
			tools = append(tools, toolID)
		}
		s.mu.Unlock()
		for _, toolID := range tools {
			s.deliverState(toolID)
		}
		return
	}
	for _, data := range frames {
		s.enqueue(data)
	}
}

// nspStreamWriter — общий writer-цикл S→C: очередь сессии + PING каждые 30s +
// watchdog PONG-timeout 75s + force-close kick (рубильник).
func nspStreamWriter(c *gin.Context, rc *http.ResponseController, s *nspSession, kind string) {
	kick := s.currentKick()
	pingTicker := time.NewTicker(nspHeartbeatPeriod)
	defer pingTicker.Stop()
	watchdog := time.NewTicker(5 * time.Second)
	defer watchdog.Stop()
	notify := c.Request.Context().Done()

	for {
		select {
		case <-notify:
			return
		case <-kick: // force-close рубильником (NSP spec §6)
			return
		case <-watchdog.C:
			if s.lastActivityAgo() > nspPongTimeout {
				log.Printf("[NSP] session %s: PONG-timeout, closing %s stream", s.id, kind)
				return
			}
		case <-pingTicker.C:
			ping := nsp.MustEncode(s.prefix, nsp.TypePING, 0,
				[]byte(fmt.Sprintf(`{"ts":%d}`, time.Now().UnixMilli())))
			if !nspWriteFrame(c, rc, ping) {
				return
			}
		case frame := <-s.out:
			if !nspWriteFrame(c, rc, frame) {
				return
			}
		}
	}
}

// nspHandleClientFrame разбирает C→S фрейм после AUTH_OK.
// false → клиент прислал CLOSE, закрыть стрим.
func nspHandleClientFrame(s *nspSession, f *nsp.Frame) bool {
	s.touch()
	switch f.Type {
	case nsp.TypePING:
		var p struct {
			TS int64 `json:"ts"`
		}
		_ = json.Unmarshal(f.Payload, &p)
		s.deliverJSON(nsp.TypePONG, map[string]interface{}{"ts": p.TS}, false, false)

	case nsp.TypePONG:
		// touch() выше — heartbeat watchdog обновлён

	case nsp.TypeSUBSCRIBE:
		var req struct {
			Channels []struct {
				ChannelID uint `json:"channel_id"`
				ToolID    uint `json:"tool_id"`
			} `json:"channels"`
		}
		if err := json.Unmarshal(f.Payload, &req); err != nil {
			s.deliverError(nsp.ErrCodeNotFound, "bad subscribe payload")
			return true
		}
		for _, ch := range req.Channels {
			nspSubscribe(s, ch.ChannelID, ch.ToolID)
		}

	case nsp.TypeOPS:
		var req struct {
			ToolID uint     `json:"tool_id"`
			Ops    []CRDTOp `json:"ops"`
		}
		if err := json.Unmarshal(f.Payload, &req); err != nil || req.ToolID == 0 {
			s.deliverError(nsp.ErrCodeNotFound, "bad ops payload")
			return true
		}
		if !s.isSubscribed(req.ToolID) {
			s.deliverError(nsp.ErrCodeAccessDenied, "not subscribed to tool")
			return true
		}
		// Идемпотентность op_id через CRDT LWW (спека §4).
		applied, err := MergeOpsToTool(req.ToolID, req.Ops, s.userID)
		if err != nil {
			log.Printf("[NSP] merge ops tool %d: %v", req.ToolID, err)
			s.deliverError(nsp.ErrCodeNotFound, "merge failed")
			return true
		}
		// Broadcast остальным (WS + SSE + NSP) тем же кодом рассылки.
		GetOrCreateSession(req.ToolID).BroadcastOps(req.Ops)
		acked := make([]string, 0, len(req.Ops))
		for _, op := range req.Ops {
			if op.OpID != "" {
				acked = append(acked, op.OpID)
			}
		}
		s.deliverJSON(nsp.TypeACK, map[string]interface{}{
			"tool_id": req.ToolID,
			"acked":   acked,
			"applied": applied,
		}, true, false)

	case nsp.TypeCURSOR:
		var req struct {
			ToolID uint    `json:"tool_id"`
			X      float64 `json:"x"`
			Y      float64 `json:"y"`
			Color  string  `json:"color"`
		}
		if err := json.Unmarshal(f.Payload, &req); err != nil || req.ToolID == 0 {
			return true
		}
		if !s.isSubscribed(req.ToolID) {
			s.deliverError(nsp.ErrCodeAccessDenied, "not subscribed to tool")
			return true
		}
		// Не автору — внутри BroadcastCursor (и nspPublish excludeUserID).
		GetOrCreateSession(req.ToolID).BroadcastCursor(&CursorPos{
			UserID:   s.userID,
			Username: s.username,
			X:        req.X,
			Y:        req.Y,
			Color:    req.Color,
		})

	case nsp.TypeSTATEREQ:
		var req struct {
			ToolID uint `json:"tool_id"`
		}
		if err := json.Unmarshal(f.Payload, &req); err != nil || req.ToolID == 0 {
			s.deliverError(nsp.ErrCodeNotFound, "bad state_req payload")
			return true
		}
		if !s.isSubscribed(req.ToolID) {
			s.deliverError(nsp.ErrCodeAccessDenied, "not subscribed to tool")
			return true
		}
		s.deliverState(req.ToolID)

	case nsp.TypeCLOSE:
		return false
	}
	return true
}

// nspSubscribe — SUBSCRIBE с R1-матрицей (спека §5):
// tool exists → иначе ERROR 4004; channel_id == tool.ChannelID → иначе 4003;
// hasChannelAccess → иначе 4003.
func nspSubscribe(s *nspSession, channelID, toolID uint) {
	var tool ChannelTool
	if err := db.First(&tool, toolID).Error; err != nil {
		s.deliverError(nsp.ErrCodeNotFound, "tool not found")
		return
	}
	if channelID != tool.ChannelID {
		s.deliverError(nsp.ErrCodeAccessDenied, "channel_id does not match tool channel")
		return
	}
	var channel Channel
	if err := db.First(&channel, tool.ChannelID).Error; err != nil || !hasChannelAccess(s.userID, channel) {
		s.deliverError(nsp.ErrCodeAccessDenied, "access denied")
		return
	}
	s.mu.Lock()
	s.subs[toolID] = true
	s.mu.Unlock()
	nspHub.mu.Lock()
	if nspHub.byTool[toolID] == nil {
		nspHub.byTool[toolID] = make(map[*nspSession]bool)
	}
	nspHub.byTool[toolID][s] = true
	nspHub.mu.Unlock()
	log.Printf("[NSP] session %s subscribed tool=%d channel=%d", s.id, toolID, channelID)
}

// --- Handlers ---

// POST /api/nsp/v2/up — chunked приём фреймов C→S; ответ full-duplex:
// AUTH_OK/ACK/ERROR/STATE/PONG/broadcast-фреймы пишутся в chunked response.
func nspUpHandler(c *gin.Context) {
	// Enforcement рубильника (NSP spec §6): kill_all → 503, nsp off → 503.
	if !enforceSyncTransportHTTP(c, "nsp") {
		return
	}
	if _, ok := c.Writer.(http.Flusher); !ok {
		c.Status(http.StatusInternalServerError)
		return
	}

	rc := http.NewResponseController(c.Writer)
	dec := nsp.NewDecoder(nsp.BootstrapPrefix)

	hello, userID, username, err := nspReadHelloAuth(c.Request.Body, dec, rc)
	if err == errNotFound {
		// Невалидный bootstrap/мусор → мгновенный 404, сокет не удерживаем.
		c.Status(http.StatusNotFound)
		return
	}
	if err == errBadAuth {
		nspStreamHeaders(c)
		errFrame := nsp.MustEncode(nsp.BootstrapPrefix, nsp.TypeERROR, 0,
			[]byte(`{"code":4001,"message":"bad_auth"}`))
		nspWriteFrame(c, rc, errFrame)
		return
	}
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	sess, herr := nspFinishHandshake(userID, username, hello)
	if herr == errSessionExpired {
		nspStreamHeaders(c)
		errFrame := nsp.MustEncode(nsp.BootstrapPrefix, nsp.TypeERROR, 0,
			[]byte(`{"code":4005,"message":"session_expired"}`))
		nspWriteFrame(c, rc, errFrame)
		return
	}

	nspStreamHeaders(c)
	sess.attach("up")
	defer sess.detach("up")

	// Дальше все C→S фреймы — с session-префиксом (спека §3).
	// Фреймы, пришедшие одним чанком с AUTH, переносим в session-декодер.
	sessDec := nsp.NewDecoder(sess.prefix)
	if rest := dec.TakeBuffered(); len(rest) > 0 {
		sessDec.Feed(rest)
	}

	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		nspStreamWriter(c, rc, sess, "up")
	}()

	// Reader-цикл: до конца тела / ошибки / force-close.
	readErr := make(chan error, 1)
	go func() {
		for {
			f, err := nspReadFrame(c.Request.Body, sessDec, rc)
			if err != nil {
				readErr <- err
				return
			}
			if !nspHandleClientFrame(sess, f) {
				readErr <- nil
				return
			}
		}
	}()

	select {
	case <-readErr:
	case <-writerDone:
		_ = c.Request.Body.Close() // разблокировать reader
	case <-sess.currentKick():
		_ = c.Request.Body.Close()
	}
}

// GET /api/nsp/v2/down?session_id=... — chunked отдача фреймов S→C.
// session_id — bearer, выданный в AUTH_OK; неизвестный → мгновенный 404.
func nspDownHandler(c *gin.Context) {
	if !enforceSyncTransportHTTP(c, "nsp") {
		return
	}
	sess := nspGetSession(c.Query("session_id"))
	if sess == nil {
		c.Status(http.StatusNotFound)
		return
	}

	nspStreamHeaders(c)
	rc := http.NewResponseController(c.Writer)
	sess.attach("down")
	defer sess.detach("down")
	nspStreamWriter(c, rc, sess, "down")
}

// POST /api/nsp/v2/send — батч-режим аплинка (спека §2, правка №3):
// тело = пачка фреймов, ответ 200 {"received":N} (+session_id при handshake).
func nspSendHandler(c *gin.Context) {
	if !enforceSyncTransportHTTP(c, "nsp") {
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 8*1024*1024))
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	if len(body) < 7 {
		c.Status(http.StatusNotFound)
		return
	}

	// Батч с bootstrap-префиксом — handshake без открытого стрима.
	if body[0] == nsp.BootstrapPrefix[0] && body[1] == nsp.BootstrapPrefix[1] &&
		body[2] == nsp.BootstrapPrefix[2] && body[3] == nsp.BootstrapPrefix[3] {
		dec := nsp.NewDecoder(nsp.BootstrapPrefix)
		dec.Feed(body)
		hello, userID, username, err := nspReadHelloAuthFromDecoder(dec)
		if err == errNotFound {
			c.Status(http.StatusNotFound)
			return
		}
		if err == errBadAuth {
			c.JSON(http.StatusOK, gin.H{"received": 2, "error": "bad_auth"})
			return
		}
		sess, herr := nspFinishHandshake(userID, username, hello)
		if herr == errSessionExpired {
			c.JSON(http.StatusOK, gin.H{"received": 2, "session_id": hello.ResumeSession, "error": "session_expired"})
			return
		}
		// Остаток батча — session-фреймы (переносим в session-декодер).
		sessDec := nsp.NewDecoder(sess.prefix)
		sessDec.Feed(dec.TakeBuffered())
		received := 2 + nspProcessBuffer(sess, sessDec)
		c.JSON(http.StatusOK, gin.H{"received": received, "session_id": sess.id})
		return
	}

	// Session-фреймы: session_id — обязательный query-параметр (bearer).
	sess := nspGetSession(c.Query("session_id"))
	if sess == nil {
		c.Status(http.StatusNotFound)
		return
	}
	dec := nsp.NewDecoder(sess.prefix)
	dec.Feed(body)
	received := nspProcessBuffer(sess, dec)
	c.JSON(http.StatusOK, gin.H{"received": received})
}

// nspReadHelloAuthFromDecoder — handshake из уже заполненного буфера (батч-режим).
func nspReadHelloAuthFromDecoder(dec *nsp.Decoder) (nspHelloPayload, uint, string, error) {
	var hello nspHelloPayload

	f, err := dec.Next()
	if err != nil || f == nil || f.Type != nsp.TypeHELLO {
		return hello, 0, "", errNotFound
	}
	if err := json.Unmarshal(f.Payload, &hello); err != nil || hello.Protocol != 2 {
		return hello, 0, "", errNotFound
	}
	f, err = dec.Next()
	if err != nil || f == nil || f.Type != nsp.TypeAUTH {
		return hello, 0, "", errNotFound
	}
	var authReq struct {
		JWT string `json:"jwt"`
	}
	if err := json.Unmarshal(f.Payload, &authReq); err != nil || authReq.JWT == "" {
		return hello, 0, "", errBadAuth
	}
	userID, username, err := parseCollabToken(authReq.JWT)
	if err != nil {
		return hello, 0, "", errBadAuth
	}
	return hello, userID, username, nil
}

// nspProcessBuffer разбирает все доступные фреймы батча (session-префикс).
func nspProcessBuffer(sess *nspSession, sessDec *nsp.Decoder) int {
	received := 0
	for {
		f, err := sessDec.Next()
		if err != nil {
			break // мусор в батче — стоп, принятое засчитано
		}
		if f == nil {
			break
		}
		received++
		if !nspHandleClientFrame(sess, f) {
			break
		}
	}
	return received
}
