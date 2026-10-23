package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// bearerTokenFromHeader извлекает JWT из заголовка Authorization
// (с префиксом "Bearer " или без). Пустая строка, если заголовка нет.
// BE-3: предпочтительный способ передачи токена для /ws, /wstunnel,
// /api/sse/events — в отличие от ?token= не попадает в access-логи.
func bearerTokenFromHeader(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		return ""
	}
	if len(authHeader) > 7 && strings.EqualFold(authHeader[:7], "Bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return authHeader
}

type SSEClient struct {
	UserID    string
	Channel   chan []byte
	Done      chan struct{}
	closeOnce sync.Once // защита Done от двойного close при force-close рубильником
}

// terminate закрывает Done ровно один раз (идемпотентный force-close)
func (c *SSEClient) terminate() {
	c.closeOnce.Do(func() { close(c.Done) })
}

type SSEHub struct {
	clients    map[*SSEClient]bool
	byUser     map[string][]*SSEClient
	register   chan *SSEClient
	unregister chan *SSEClient
	broadcast  chan []byte
	direct     chan SSEDirectMessage
	mu         sync.RWMutex
}

type SSEDirectMessage struct {
	TargetUserID string
	Payload      []byte
}

type PollMessage struct {
	ID        int64       `json:"id"`
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

type PollQueue struct {
	messages        map[string][]PollMessage
	broadcastQueue  []PollMessage
	registeredUsers map[string]int64
	lastID          int64
	mu              sync.RWMutex
}

var sseHub = &SSEHub{
	clients:    make(map[*SSEClient]bool),
	byUser:     make(map[string][]*SSEClient),
	register:   make(chan *SSEClient),
	unregister: make(chan *SSEClient),
	broadcast:  make(chan []byte, 256),
	direct:     make(chan SSEDirectMessage, 256),
}

var pollQueue = &PollQueue{
	messages:        make(map[string][]PollMessage),
	broadcastQueue:  make([]PollMessage, 0),
	registeredUsers: make(map[string]int64),
	lastID:          0,
}

// --- Collab SSE hub: scoped рассылка ToolSyncMessage по tool_id ---
// Отдельный от sseHub (/api/sse/events): здесь подписчики группируются
// по toolID, а не по userID. Используется как резервный транспорт для
// входящих collab-сообщений, когда WebSocket недоступен.

type collabSSESubscriber struct {
	ID        string
	ToolID    uint
	UserID    uint
	Ch        chan ToolSyncMessage
	Done      chan struct{} // force-close рубильником (NSP spec §8)
	closeOnce sync.Once
}

// terminate закрывает Done ровно один раз (идемпотентный force-close)
func (s *collabSSESubscriber) terminate() {
	s.closeOnce.Do(func() { close(s.Done) })
}

type collabSSEHubType struct {
	subs       map[uint]map[string]*collabSSESubscriber // toolID -> subscriberID -> subscriber
	register   chan *collabSSESubscriber
	unregister chan *collabSSESubscriber
	mu         sync.RWMutex
}

var collabSSEHub = &collabSSEHubType{
	subs:       make(map[uint]map[string]*collabSSESubscriber),
	register:   make(chan *collabSSESubscriber),
	unregister: make(chan *collabSSESubscriber),
}

func (h *collabSSEHubType) run() {
	for {
		select {
		case sub := <-h.register:
			h.mu.Lock()
			if h.subs[sub.ToolID] == nil {
				h.subs[sub.ToolID] = make(map[string]*collabSSESubscriber)
			}
			h.subs[sub.ToolID][sub.ID] = sub
			h.mu.Unlock()
			log.Printf("[CollabSSE] Subscriber user=%d tool=%d connected (tool subs: %d)", sub.UserID, sub.ToolID, len(h.subs[sub.ToolID]))

		case sub := <-h.unregister:
			h.mu.Lock()
			if subs, ok := h.subs[sub.ToolID]; ok {
				if _, ok := subs[sub.ID]; ok {
					delete(subs, sub.ID)
					close(sub.Ch)
				}
				if len(subs) == 0 {
					delete(h.subs, sub.ToolID)
				}
			}
			h.mu.Unlock()
			log.Printf("[CollabSSE] Subscriber user=%d tool=%d disconnected", sub.UserID, sub.ToolID)
		}
	}
}

// publish дублирует ToolSyncMessage всем SSE-подписчикам tool_id.
// excludeUserID != 0 — не отправлять этому пользователю (эхо собственного курсора).
// Non-blocking send с drop при переполнении буфера (как в SSEHub.broadcast).
func (h *collabSSEHubType) publish(toolID uint, msg ToolSyncMessage, excludeUserID uint) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, sub := range h.subs[toolID] {
		if excludeUserID != 0 && sub.UserID == excludeUserID {
			continue
		}
		select {
		case sub.Ch <- msg:
		default:
			// буфер подписчика полон — дропаем, не блокируя рассылку
		}
	}
}

const (
	pollMessageTTL     = 5 * time.Minute
	pollMaxMessages    = 100
	pollTimeout        = 30 * time.Second
	sseHeartbeatPeriod = 15 * time.Second
)

func init() {
	go sseHub.run()
	go collabSSEHub.run()
	go pollQueue.cleanup()
}

func (h *SSEHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.byUser[client.UserID] = append(h.byUser[client.UserID], client)
			h.mu.Unlock()
			log.Printf("[SSE] Client %s connected (total: %d)", client.UserID, len(h.byUser[client.UserID]))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				clients := h.byUser[client.UserID]
				for i, c := range clients {
					if c == client {
						h.byUser[client.UserID] = append(clients[:i], clients[i+1:]...)
						break
					}
				}
				if len(h.byUser[client.UserID]) == 0 {
					delete(h.byUser, client.UserID)
				}
				close(client.Channel)
			}
			h.mu.Unlock()
			log.Printf("[SSE] Client %s disconnected", client.UserID)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Channel <- message:
				default:
				}
			}
			h.mu.RUnlock()

		case dm := <-h.direct:
			h.mu.RLock()
			if clients, ok := h.byUser[dm.TargetUserID]; ok {
				for _, client := range clients {
					select {
					case client.Channel <- dm.Payload:
					default:
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (pq *PollQueue) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		pq.mu.Lock()
		now := time.Now().UnixMilli()
		cutoff := now - int64(pollMessageTTL.Milliseconds())

		var filteredBroadcast []PollMessage
		for _, msg := range pq.broadcastQueue {
			if msg.Timestamp > cutoff {
				filteredBroadcast = append(filteredBroadcast, msg)
			}
		}
		pq.broadcastQueue = filteredBroadcast

		for userID, messages := range pq.messages {
			var filtered []PollMessage
			for _, msg := range messages {
				if msg.Timestamp > cutoff {
					filtered = append(filtered, msg)
				}
			}
			if len(filtered) > 0 {
				pq.messages[userID] = filtered
			} else {
				delete(pq.messages, userID)
				delete(pq.registeredUsers, userID)
			}
		}
		pq.mu.Unlock()
	}
}

func (pq *PollQueue) Add(userID string, msgType string, data interface{}) {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	pq.lastID++
	msg := PollMessage{
		ID:        pq.lastID,
		Type:      msgType,
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
	}

	if pq.messages[userID] == nil {
		pq.messages[userID] = make([]PollMessage, 0)
	}
	pq.messages[userID] = append(pq.messages[userID], msg)

	if len(pq.messages[userID]) > pollMaxMessages {
		pq.messages[userID] = pq.messages[userID][len(pq.messages[userID])-pollMaxMessages:]
	}
}

func (pq *PollQueue) RegisterUser(userID string) {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	if _, exists := pq.registeredUsers[userID]; !exists {
		pq.registeredUsers[userID] = pq.lastID
		if pq.messages[userID] == nil {
			pq.messages[userID] = make([]PollMessage, 0)
		}
	}
}

func (pq *PollQueue) Get(userID string, sinceID int64) []PollMessage {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	if _, exists := pq.registeredUsers[userID]; !exists {
		pq.registeredUsers[userID] = sinceID
		if pq.messages[userID] == nil {
			pq.messages[userID] = make([]PollMessage, 0)
		}
	}

	var result []PollMessage

	for _, msg := range pq.broadcastQueue {
		if msg.ID > sinceID {
			result = append(result, msg)
		}
	}

	for _, msg := range pq.messages[userID] {
		if msg.ID > sinceID {
			result = append(result, msg)
		}
	}

	return result
}

func (pq *PollQueue) AddBroadcast(msgType string, data interface{}) {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	pq.lastID++
	msg := PollMessage{
		ID:        pq.lastID,
		Type:      msgType,
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
	}

	pq.broadcastQueue = append(pq.broadcastQueue, msg)
	if len(pq.broadcastQueue) > pollMaxMessages {
		pq.broadcastQueue = pq.broadcastQueue[len(pq.broadcastQueue)-pollMaxMessages:]
	}
}

// sseWriteFrame пишет SSE-фрейм, предварительно продлевая write deadline.
// Глобальный srv.WriteTimeout (15s) выставляет дедлайн на весь ответ при
// старте запроса и убивает долгоживущий SSE-поток ровно на 15-й секунде —
// поэтому дедлайн продлевается на каждой записи.
func sseWriteFrame(c *gin.Context, rc *http.ResponseController, frame string) bool {
	if err := rc.SetWriteDeadline(time.Now().Add(60 * time.Second)); err != nil {
		return false
	}
	if _, err := c.Writer.WriteString(frame); err != nil {
		return false
	}
	c.Writer.Flush()
	return true
}

func sseEventsHandler(c *gin.Context) {
	userID := c.GetString("userID")
	if uid, ok := getUserIDFromContext(c); ok && userID == "" {
		userID = fmt.Sprintf("%d", uid)
	}
	if userID == "" {
		// BE-3: сначала Authorization: Bearer (не попадает в access-логи),
		// затем ?token= — для обратной совместимости (EventSource не умеет заголовки).
		token := bearerTokenFromHeader(c)
		if token == "" {
			token = c.Query("token")
		}
		if token != "" {
			claims := jwt.MapClaims{}
			parsedToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
				// Security: принимаем только HMAC-подпись (защита от alg=none/alg confusion)
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return getJWTSecret(), nil
			})
			if err == nil && parsedToken.Valid {
				// Отозванные токены/сессии не принимаем
				revoked := false
				if jti, ok := claims["jti"].(string); ok && jti != "" && isTokenBlacklisted(jti) {
					revoked = true
				}
				if sid, ok := claims["sid"].(string); ok && sid != "" && isSessionBlacklisted(sid) {
					revoked = true
				}
				if !revoked {
					// Поддерживаем оба claim: "user_id" (legacy) и "uid" (enhanced)
					if uid, ok := claims["user_id"].(float64); ok {
						userID = fmt.Sprintf("%d", int(uid))
					} else if uid, ok := claims["uid"].(float64); ok {
						userID = fmt.Sprintf("%d", int(uid))
					}
				}
			}
		}
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Рубильник (NSP spec §8): kill switch / SSE выключен → 503
	if !enforceSyncTransportHTTP(c, "sse") {
		return
	}

	// CORS: только origins из allowlist (см. isOriginAllowed в main.go),
	// никакого отражения произвольного Origin.
	origin := c.GetHeader("Origin")
	if origin != "" && isOriginAllowed(origin) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Vary", "Origin")
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	client := &SSEClient{
		UserID:  userID,
		Channel: make(chan []byte, 64),
		Done:    make(chan struct{}),
	}

	sseHub.register <- client
	defer func() {
		sseHub.unregister <- client
	}()

	rc := http.NewResponseController(c.Writer)
	if !sseWriteFrame(c, rc, fmt.Sprintf("event: connected\ndata: {\"user_id\":\"%s\",\"connection_type\":\"sse\"}\n\n", userID)) {
		return
	}

	heartbeatTicker := time.NewTicker(sseHeartbeatPeriod)
	defer heartbeatTicker.Stop()

	notify := c.Request.Context().Done()

	for {
		select {
		case <-notify:
			return
		case <-client.Done: // force-close рубильником
			return
		case <-heartbeatTicker.C:
			if !sseWriteFrame(c, rc, ": heartbeat\n\n") {
				return
			}
		case msg, ok := <-client.Channel:
			if !ok {
				return
			}
			if !sseWriteFrame(c, rc, fmt.Sprintf("event: message\ndata: %s\n\n", string(msg))) {
				return
			}
		}
	}
}

// sseCollabEventsHandler — scoped SSE-поток ToolSyncMessage для collab-сессии
// инструмента. Резервный транспорт для входящих ops/presence, когда collab-WS
// недоступен. Access-проверки повторяют семантику handleRealtimeCollaboration
// (R1): там WS close 4404/4403, здесь HTTP 404/403 JSON.
func sseCollabEventsHandler(c *gin.Context) {
	// JWT: сначала Authorization: Bearer (не попадает в access-логи),
	// затем ?token= — EventSource не умеет кастомные заголовки.
	token := bearerTokenFromHeader(c)
	if token == "" {
		token = c.Query("token")
	}
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _, authErr := parseCollabToken(token)
	if authErr != nil {
		log.Printf("[CollabSSE] rejected: %v", authErr)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Рубильник (NSP spec §8): kill switch / SSE выключен → 503
	if !enforceSyncTransportHTTP(c, "sse") {
		return
	}

	toolIDStr := c.Param("tool_id")
	toolID, errParse := strconv.ParseUint(toolIDStr, 10, 32)
	if errParse != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tool ID"})
		return
	}

	// R1: те же access-проверки, что и у WS-эндпоинта
	var tool ChannelTool
	if err := db.First(&tool, uint(toolID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tool not found"})
		return
	}
	channelIDStr := c.Param("channel_id")
	channelID, errChannel := strconv.ParseUint(channelIDStr, 10, 32)
	if errChannel != nil || uint(channelID) != tool.ChannelID {
		log.Printf("[CollabSSE] rejected: channel_id %s does not match tool %d channel %d", channelIDStr, toolID, tool.ChannelID)
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	var channel Channel
	if err := db.First(&channel, tool.ChannelID).Error; err != nil || !hasChannelAccess(userID, channel) {
		log.Printf("[CollabSSE] rejected: user %d has no access to channel %d", userID, tool.ChannelID)
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	origin := c.GetHeader("Origin")
	if origin != "" && isOriginAllowed(origin) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Vary", "Origin")
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	sub := &collabSSESubscriber{
		ID:     uuid.NewString(),
		ToolID: uint(toolID),
		UserID: userID,
		Ch:     make(chan ToolSyncMessage, 100),
		Done:   make(chan struct{}),
	}

	collabSSEHub.register <- sub
	defer func() {
		collabSSEHub.unregister <- sub
	}()

	rc := http.NewResponseController(c.Writer)
	if !sseWriteFrame(c, rc, ": connected\n\n") {
		return
	}

	heartbeatTicker := time.NewTicker(sseHeartbeatPeriod)
	defer heartbeatTicker.Stop()

	notify := c.Request.Context().Done()

	for {
		select {
		case <-notify:
			return
		case <-sub.Done: // force-close рубильником
			return
		case <-heartbeatTicker.C:
			if !sseWriteFrame(c, rc, ": ping\n\n") {
				return
			}
		case msg, ok := <-sub.Ch:
			if !ok {
				return
			}
			data, err := json.Marshal(msg)
			if err != nil {
				continue
			}
			if !sseWriteFrame(c, rc, fmt.Sprintf("data: %s\n\n", string(data))) {
				return
			}
		}
	}
}

func longPollHandler(c *gin.Context) {
	// user_id в контекст кладёт authMiddleware (enhancedAuthMiddleware);
	// раньше здесь читался несуществующий ключ "userID" — long polling
	// всегда отвечал 401 даже с валидным токеном.
	userID := ""
	if uid, ok := getUserIDFromContext(c); ok {
		userID = fmt.Sprintf("%d", uid)
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	sinceIDStr := c.DefaultQuery("since_id", "0")
	var sinceID int64
	fmt.Sscanf(sinceIDStr, "%d", &sinceID)

	messages := pollQueue.Get(userID, sinceID)
	if len(messages) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"messages":        messages,
			"connection_type": "long_polling",
		})
		return
	}

	timeout := time.After(pollTimeout)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			c.JSON(http.StatusOK, gin.H{
				"messages":        []PollMessage{},
				"connection_type": "long_polling",
			})
			return
		case <-timeout:
			c.JSON(http.StatusOK, gin.H{
				"messages":        []PollMessage{},
				"connection_type": "long_polling",
			})
			return
		case <-ticker.C:
			messages := pollQueue.Get(userID, sinceID)
			if len(messages) > 0 {
				c.JSON(http.StatusOK, gin.H{
					"messages":        messages,
					"connection_type": "long_polling",
				})
				return
			}
		}
	}
}

func longPollSendHandler(c *gin.Context) {
	userID := ""
	if uid, ok := getUserIDFromContext(c); ok {
		userID = fmt.Sprintf("%d", uid)
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	payload["from_user_id"] = userID

	msgType, _ := payload["type"].(string)
	if msgType == "" {
		msgType = "message"
	}

	if targetUserID, ok := payload["target_user_id"].(string); ok && targetUserID != "" {
		pollQueue.Add(targetUserID, msgType, payload)

		data, _ := json.Marshal(payload)
		sseHub.direct <- SSEDirectMessage{
			TargetUserID: targetUserID,
			Payload:      data,
		}
	} else {
		pollQueue.AddBroadcast(msgType, payload)

		data, _ := json.Marshal(payload)
		sseHub.broadcast <- data
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func BroadcastToFallbacks(msgType string, data interface{}) {
	payload := map[string]interface{}{
		"type": msgType,
		"data": data,
	}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Fallback] Error marshaling broadcast: %v", err)
		return
	}

	sseHub.broadcast <- jsonData
	pollQueue.AddBroadcast(msgType, data)
}

func SendToUserFallbacks(userID string, msgType string, data interface{}) {
	payload := map[string]interface{}{
		"type": msgType,
		"data": data,
	}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Fallback] Error marshaling direct message: %v", err)
		return
	}

	sseHub.direct <- SSEDirectMessage{
		TargetUserID: userID,
		Payload:      jsonData,
	}
	pollQueue.Add(userID, msgType, data)
}

func connectionStatusHandler(c *gin.Context) {
	userID := ""
	if uid, ok := getUserIDFromContext(c); ok {
		userID = fmt.Sprintf("%d", uid)
	}

	hub.mu.RLock()
	wsConnected := hub.clientsByUser[userID] != nil
	hub.mu.RUnlock()

	sseHub.mu.RLock()
	sseConnected := len(sseHub.byUser[userID]) > 0
	sseHub.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"websocket": wsConnected,
		"sse":       sseConnected,
		"available": gin.H{
			"websocket":    true,
			"sse":          true,
			"long_polling": true,
		},
	})
}
