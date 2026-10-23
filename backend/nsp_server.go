package main

// NSP — Nebula Sync Protocol v2.1 «RU-Lite»: сессии, ring buffer,
// heartbeat, GC, интеграция с collab-broadcast и SSE-hub мессенджера.
// Спека: NSP_Protocol_Spec_v2.1_RU-Lite.md §3–§6.

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kirin2461/Nemaxks/backend/nsp"
)

const (
	nspHeartbeatPeriod = 30 * time.Second // PING S→C (спека §4)
	nspPongTimeout     = 75 * time.Second // PONG-timeout → закрытие стрима
	nspSessionTTL      = 5 * time.Minute  // жёсткий TTL после дисконнекта (правка №2)
	nspGCSweepPeriod   = 30 * time.Second // GC sweep (правка №2)
	nspRingMaxFrames   = 1000             // ring buffer: max фреймов (правка №1)
	nspRingMaxBytes    = 5 * 1024 * 1024  // ring buffer: max суммарный payload (правка №1)
	nspOutQueueSize    = 100              // backpressure: буфер отправки на подписчика (спека §4)
)

// nspBufferedFrame — S→C фрейм в ring buffer сессии (для RESUME).
type nspBufferedFrame struct {
	seq  int64
	data []byte
}

// nspSession — серверное состояние NSP-сессии (спека §4).
type nspSession struct {
	id         string
	userID     uint
	username   string
	prefix     [4]byte // FA 5A + prefix_tail
	prefixTail [2]byte
	createdAt  time.Time

	mu             sync.Mutex
	seq            int64 // монотонный S→C seq
	ring           []nspBufferedFrame
	ringBytes      int
	evictedUpTo    int64            // max seq, вытесненный из ring buffer
	subs           map[uint]bool    // подписанные tool_id
	out            chan []byte      // очередь S→C фреймов на активный стрим
	upAttached     bool             // активен /up full-duplex writer
	downAttached   bool             // активен /down writer
	lastActivity   time.Time        // любой входящий фрейм (heartbeat watchdog)
	disconnectedAt time.Time        // когда отвалился последний стрим (TTL)
	kick           chan struct{}    // закрывается force-close рубильником
	sseClient      *SSEClient       // EVENT-подписка мессенджера (sseHub)
	destroyed      bool
}

// --- Реестр сессий ---

var nspRegistry = struct {
	mu       sync.RWMutex
	sessions map[string]*nspSession
}{sessions: make(map[string]*nspSession)}

// --- NSP hub: подписки toolID -> sessions (по аналогии с collabSSEHub) ---

var nspHub = struct {
	mu     sync.RWMutex
	byTool map[uint]map[*nspSession]bool
}{byTool: make(map[uint]map[*nspSession]bool)}

func init() {
	go nspGC()
}

func nspGetSession(id string) *nspSession {
	nspRegistry.mu.RLock()
	defer nspRegistry.mu.RUnlock()
	return nspRegistry.sessions[id]
}

// nspNewSession создаёт сессию после успешного AUTH (спека §4).
func nspNewSession(userID uint, username string) *nspSession {
	uid := uuid.New()
	raw, _ := uid.MarshalBinary() // 16 байт uuid
	s := &nspSession{
		id:           uid.String(),
		userID:       userID,
		username:     username,
		prefixTail:   [2]byte{raw[0], raw[1]},
		createdAt:    time.Now(),
		subs:         make(map[uint]bool),
		out:          make(chan []byte, nspOutQueueSize),
		lastActivity: time.Now(),
		kick:         make(chan struct{}),
	}
	s.prefix = nsp.SessionPrefix(raw[0], raw[1])

	// EVENT: подписка на события мессенджера через sseHub-паттерн
	// (payload как в SSE: {"type":..., "data":...}).
	s.sseClient = &SSEClient{
		UserID:  fmt.Sprintf("%d", userID),
		Channel: make(chan []byte, 64),
		Done:    make(chan struct{}),
	}
	sseHub.register <- s.sseClient
	go s.forwardEvents()

	nspRegistry.mu.Lock()
	nspRegistry.sessions[s.id] = s
	nspRegistry.mu.Unlock()
	log.Printf("[NSP] session %s created for user %d", s.id, userID)
	return s
}

// forwardEvents перекладывает события мессенджера из sseHub в EVENT-фреймы.
func (s *nspSession) forwardEvents() {
	for msg := range s.sseClient.Channel {
		var m map[string]interface{}
		if err := json.Unmarshal(msg, &m); err != nil {
			continue
		}
		s.deliverJSON(nsp.TypeEVENT, m, true, true)
	}
}

// destroy полностью уничтожает сессию и её буфер (TTL/close, спека §4).
func (s *nspSession) destroy() {
	s.mu.Lock()
	if s.destroyed {
		s.mu.Unlock()
		return
	}
	s.destroyed = true
	s.mu.Unlock()

	nspRegistry.mu.Lock()
	delete(nspRegistry.sessions, s.id)
	nspRegistry.mu.Unlock()

	nspHub.mu.Lock()
	for toolID := range s.subs {
		if set := nspHub.byTool[toolID]; set != nil {
			delete(set, s)
			if len(set) == 0 {
				delete(nspHub.byTool, toolID)
			}
		}
	}
	nspHub.mu.Unlock()

	s.terminateStreams()
	sseHub.unregister <- s.sseClient // закрывает Channel → forwardEvents выходит
	log.Printf("[NSP] session %s destroyed (user %d)", s.id, s.userID)
}

// terminateStreams обрывает активные /up / /down стримы (force-close
// рубильником), но оставляет сессию и ring buffer для RESUME.
func (s *nspSession) terminateStreams() {
	s.mu.Lock()
	defer s.mu.Unlock()
	select {
	case <-s.kick:
	default:
		close(s.kick)
	}
	s.kick = make(chan struct{})
	s.upAttached = false
	s.downAttached = false
	s.disconnectedAt = time.Now()
}

// currentKick возвращает актуальный kick-канал (пересоздаётся при force-close).
func (s *nspSession) currentKick() chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.kick
}

// touch обновляет метку активности (любой входящий фрейм, включая PONG).
func (s *nspSession) touch() {
	s.mu.Lock()
	s.lastActivity = time.Now()
	s.mu.Unlock()
}

func (s *nspSession) lastActivityAgo() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Since(s.lastActivity)
}

// attach помечает стрим активным; detach — снимает. kind: "up" | "down".
func (s *nspSession) attach(kind string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if kind == "up" {
		s.upAttached = true
	} else {
		s.downAttached = true
	}
	s.disconnectedAt = time.Time{}
}

func (s *nspSession) detach(kind string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if kind == "up" {
		s.upAttached = false
	} else {
		s.downAttached = false
	}
	if !s.upAttached && !s.downAttached {
		s.disconnectedAt = time.Now()
	}
}

func (s *nspSession) hasStream() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.upAttached || s.downAttached
}

// isSubscribed — подписана ли сессия на tool_id.
func (s *nspSession) isSubscribed(toolID uint) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.subs[toolID]
}

// --- Доставка S→C: seq + ring buffer + очередь ---

// deliverJSON кодирует payload в фрейм и ставит в очередь на отправку.
// seqIt: присвоить монотонный seq (вкладывается в JSON payload).
// bufferIt: положить в ring buffer для RESUME (спека §4).
func (s *nspSession) deliverJSON(typ byte, payload map[string]interface{}, seqIt, bufferIt bool) {
	s.mu.Lock()
	if seqIt {
		s.seq++
		payload["seq"] = s.seq
	}
	data, err := json.Marshal(payload)
	if err != nil {
		s.mu.Unlock()
		log.Printf("[NSP] marshal frame type %#x: %v", typ, err)
		return
	}
	frame := nsp.MustEncode(s.prefix, typ, 0, data)
	if bufferIt {
		s.ringAppendLocked(nspBufferedFrame{seq: s.seq, data: frame})
	}
	s.mu.Unlock()
	s.enqueue(frame)
}

// ringAppendLocked добавляет фрейм в ring buffer с двойным лимитом
// (1000 фреймов И 5 МБ — срабатывает что раньше), вытесняя старые.
func (s *nspSession) ringAppendLocked(f nspBufferedFrame) {
	s.ring = append(s.ring, f)
	s.ringBytes += len(f.data)
	for len(s.ring) > nspRingMaxFrames || s.ringBytes > nspRingMaxBytes {
		evicted := s.ring[0]
		s.ring = s.ring[1:]
		s.ringBytes -= len(evicted.data)
		if evicted.seq > s.evictedUpTo {
			s.evictedUpTo = evicted.seq
		}
	}
}

// enqueue — non-blocking запись в очередь активного стрима.
// Переполнение (backpressure, спека §4) → принудительный STATE, не silent drop.
func (s *nspSession) enqueue(frame []byte) {
	select {
	case s.out <- frame:
	default:
		log.Printf("[NSP] session %s out queue full — forced STATE", s.id)
		go s.forceState()
	}
}

// forceState дренирует переполненную очередь и шлёт свежий STATE
// по каждой подписке (спека §4: не silent drop).
func (s *nspSession) forceState() {
	for {
		select {
		case <-s.out:
		default:
			goto drained
		}
	}
drained:
	s.mu.Lock()
	tools := make([]uint, 0, len(s.subs))
	for toolID := range s.subs {
		tools = append(tools, toolID)
	}
	s.mu.Unlock()
	for _, toolID := range tools {
		s.deliverState(toolID)
	}
}

// deliverState шлёт STATE-фрейм с текущим content инструмента (спека §3.5).
func (s *nspSession) deliverState(toolID uint) {
	var tool ChannelTool
	if err := db.First(&tool, toolID).Error; err != nil {
		s.deliverJSON(nsp.TypeERROR, map[string]interface{}{
			"code":    nsp.ErrCodeNotFound,
			"message": "tool not found",
		}, true, true)
		return
	}
	var doc CRDTDocument
	if err := json.Unmarshal([]byte(tool.Content), &doc); err != nil || doc.Elements == nil {
		doc = CRDTDocument{Elements: make(map[string]CRDTElement)}
	}
	s.deliverJSON(nsp.TypeSTATE, map[string]interface{}{
		"tool_id": toolID,
		"state":   map[string]interface{}{"elements": doc.Elements},
	}, true, true)
}

// deliverError — ERROR-фрейм (спека §3.5, коды 4001/4003/4004/4005/4006/4503/4600).
func (s *nspSession) deliverError(code int, message string) {
	s.deliverJSON(nsp.TypeERROR, map[string]interface{}{
		"code":    code,
		"message": message,
	}, true, true)
}

// replayAfter возвращает буферизованные фреймы с seq > lastRecvSeq.
// ok=false — нужные фреймы вытеснены (RESUME невозможен, спека §4).
func (s *nspSession) replayAfter(lastRecvSeq int64) ([][]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if lastRecvSeq < s.evictedUpTo {
		return nil, false
	}
	var out [][]byte
	for _, f := range s.ring {
		if f.seq > lastRecvSeq {
			out = append(out, f.data)
		}
	}
	return out, true
}

// --- Интеграция с collab broadcast (спека §4, аналог collabSSEHub.publish) ---

// nspPublish дублирует ToolSyncMessage всем NSP-подписчикам tool_id.
// Вызывается из CollaborativeSession.BroadcastOps/BroadcastCursor/BroadcastState
// рядом с collabSSEHub.publish — тот же код рассылки достаёт NSP.
func nspPublish(toolID uint, msg ToolSyncMessage, excludeUserID uint) {
	nspHub.mu.RLock()
	sessions := make([]*nspSession, 0, len(nspHub.byTool[toolID]))
	for s := range nspHub.byTool[toolID] {
		if excludeUserID != 0 && s.userID == excludeUserID {
			continue
		}
		sessions = append(sessions, s)
	}
	nspHub.mu.RUnlock()

	for _, s := range sessions {
		switch {
		case msg.Type == "update" && len(msg.Ops) > 0:
			var fromUser uint
			if len(msg.Ops) > 0 {
				fromUser = msg.Ops[0].UserID
			}
			s.deliverJSON(nsp.TypeOPSBCAST, map[string]interface{}{
				"tool_id":      toolID,
				"ops":          msg.Ops,
				"from_user_id": fromUser,
			}, true, true)
		case msg.Type == "cursor" && msg.Cursor != nil:
			s.deliverJSON(nsp.TypeCURSOR, map[string]interface{}{
				"tool_id": toolID,
				"user_id": msg.Cursor.UserID,
				"x":       msg.Cursor.X,
				"y":       msg.Cursor.Y,
				"color":   msg.Cursor.Color,
			}, true, true)
		case msg.Type == "sync_state":
			s.deliverJSON(nsp.TypeSTATE, map[string]interface{}{
				"tool_id": toolID,
				"state":   msg.State,
			}, true, true)
		}
	}
}

// --- Force-close рубильником (NSP spec §6, паттерн forceCloseSSE) ---

// forceCloseNSP обрывает все активные NSP-стримы (сессии живут для RESUME).
func forceCloseNSP() int {
	nspRegistry.mu.RLock()
	sessions := make([]*nspSession, 0, len(nspRegistry.sessions))
	for _, s := range nspRegistry.sessions {
		sessions = append(sessions, s)
	}
	nspRegistry.mu.RUnlock()

	n := 0
	for _, s := range sessions {
		if s.hasStream() {
			s.terminateStreams()
			n++
		}
	}
	return n
}

// countNSPConnections — активные NSP-стримы для админки рубильника.
func countNSPConnections() int {
	nspRegistry.mu.RLock()
	sessions := make([]*nspSession, 0, len(nspRegistry.sessions))
	for _, s := range nspRegistry.sessions {
		sessions = append(sessions, s)
	}
	nspRegistry.mu.RUnlock()
	n := 0
	for _, s := range sessions {
		if s.hasStream() {
			n++
		}
	}
	return n
}

// --- GC: Session TTL 5 минут после дисконнекта, sweep каждые 30s (спека §4) ---

func nspGC() {
	ticker := time.NewTicker(nspGCSweepPeriod)
	defer ticker.Stop()
	for range ticker.C {
		nspRegistry.mu.RLock()
		sessions := make([]*nspSession, 0, len(nspRegistry.sessions))
		for _, s := range nspRegistry.sessions {
			sessions = append(sessions, s)
		}
		nspRegistry.mu.RUnlock()

		for _, s := range sessions {
			s.mu.Lock()
			idle := !s.upAttached && !s.downAttached
			since := s.disconnectedAt
			if since.IsZero() {
				since = s.createdAt // сессия создана (батч-handshake), но стрим ни разу не пришёл
			}
			expired := idle && time.Since(since) > nspSessionTTL
			s.mu.Unlock()
			if expired {
				log.Printf("[NSP] session %s expired (TTL %v)", s.id, nspSessionTTL)
				s.destroy()
			}
		}
	}
}
