package main

import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "sync"
        "time"

        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
)

type SSEClient struct {
        UserID   string
        Channel  chan []byte
        Done     chan struct{}
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

const (
        pollMessageTTL      = 5 * time.Minute
        pollMaxMessages     = 100
        pollTimeout         = 30 * time.Second
        sseHeartbeatPeriod  = 15 * time.Second
)

func init() {
        go sseHub.run()
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

func sseEventsHandler(c *gin.Context) {
        userID := c.GetString("userID")
        if userID == "" {
                token := c.Query("token")
                if token != "" {
                        claims := jwt.MapClaims{}
                        parsedToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
                                return getJWTSecret(), nil
                        })
                        if err == nil && parsedToken.Valid {
                                if uid, ok := claims["user_id"].(float64); ok {
                                        userID = fmt.Sprintf("%d", int(uid))
                                }
                        }
                }
        }
        if userID == "" {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        origin := c.GetHeader("Origin")
        if origin != "" {
                c.Header("Access-Control-Allow-Origin", origin)
                c.Header("Access-Control-Allow-Credentials", "true")
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

        c.Writer.WriteString("event: connected\n")
        c.Writer.WriteString(fmt.Sprintf("data: {\"user_id\":\"%s\",\"connection_type\":\"sse\"}\n\n", userID))
        c.Writer.Flush()

        heartbeatTicker := time.NewTicker(sseHeartbeatPeriod)
        defer heartbeatTicker.Stop()

        notify := c.Request.Context().Done()

        for {
                select {
                case <-notify:
                        return
                case <-heartbeatTicker.C:
                        c.Writer.WriteString(": heartbeat\n\n")
                        c.Writer.Flush()
                case msg, ok := <-client.Channel:
                        if !ok {
                                return
                        }
                        c.Writer.WriteString("event: message\n")
                        c.Writer.WriteString(fmt.Sprintf("data: %s\n\n", string(msg)))
                        c.Writer.Flush()
                }
        }
}

func longPollHandler(c *gin.Context) {
        userID := c.GetString("userID")
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
        userID := c.GetString("userID")
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
        userID := c.GetString("userID")
        
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
