package main

import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "strconv"
        "sync"

        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
        "github.com/gorilla/websocket"
)

// CollaborativeSession определяет сессию совместного редактирования
type CollaborativeSession struct {
        ToolID       uint
        Connections  map[uint]*UserConnection // UserID -> Connection
        Mutex        sync.RWMutex
        CurrentState interface{} // Текущее состояние доски
}

// UserConnection представляет пользователя в сессии
type UserConnection struct {
        UserID     uint
        Username   string
        Chan       chan interface{} // чанал для рассылки исправлений
        LastSeenAt int64
}

// ToolUpdate определяет исправление
type ToolUpdate struct {
        Type      string      `json:"type"`       // "element_added", "element_updated", "element_removed"
        UserID    uint        `json:"user_id"`    // Кто сделал
        Username  string      `json:"username"`
        ElementID string      `json:"element_id"` // ID элемента
        Data      interface{} `json:"data"`       // данные элемента
        Timestamp int64       `json:"timestamp"`
}

// ToolSyncMessage мессаж синхронизации
type ToolSyncMessage struct {
        Type   string      `json:"type"` // "sync_state", "update", "cursor"
        ToolID uint        `json:"tool_id"`
        Update *ToolUpdate `json:"update,omitempty"`
        Ops    []CRDTOp    `json:"ops,omitempty"`    // CRDT-операции (новый формат)
        State  interface{} `json:"state,omitempty"`  // Полное состояние
        Cursor *CursorPos  `json:"cursor,omitempty"` // Позиция курсора
}

// CursorPos позиция курсора пользователя
type CursorPos struct {
        UserID   uint    `json:"user_id"`
        Username string  `json:"username"`
        X        float64 `json:"x"` // Координаты
        Y        float64 `json:"y"`
        Color    string  `json:"color"` // Цвет курсора
}

// SessionManager определяет менеджер сессий
var (
        Sessions  = make(map[uint]*CollaborativeSession) // ToolID -> Session
        SessionMu sync.RWMutex
)

// GetOrCreateSession - гет или создание сессии
func GetOrCreateSession(toolID uint) *CollaborativeSession {
        SessionMu.Lock()
        defer SessionMu.Unlock()

        if session, ok := Sessions[toolID]; ok {
                return session
        }

        session := &CollaborativeSession{
                ToolID:      toolID,
                Connections: make(map[uint]*UserConnection),
        }
        Sessions[toolID] = session
        return session
}

// AddUser - добавить пользователя в сессию
func (s *CollaborativeSession) AddUser(userID uint, username string) *UserConnection {
        s.Mutex.Lock()
        defer s.Mutex.Unlock()

        conn := &UserConnection{
                UserID:     userID,
                Username:   username,
                Chan:       make(chan interface{}, 100),
                LastSeenAt: GetCurrentTimestamp(),
        }

        s.Connections[userID] = conn
        return conn
}

// RemoveUser - удалить пользователя
func (s *CollaborativeSession) RemoveUser(userID uint) {
        s.Mutex.Lock()
        defer s.Mutex.Unlock()

        if conn, ok := s.Connections[userID]; ok {
                close(conn.Chan)
                delete(s.Connections, userID)
        }
}

// BroadcastUpdate - рассылают исправление всем
func (s *CollaborativeSession) BroadcastUpdate(update *ToolUpdate) {
        s.Mutex.RLock()
        connections := s.Connections
        s.Mutex.RUnlock()

        msg := ToolSyncMessage{
                Type:   "update",
                ToolID: s.ToolID,
                Update: update,
        }

        for _, conn := range connections {
                select {
                case conn.Chan <- msg:
                default:
                        // чанал полон, принимаю решение
                }
        }
}

// BroadcastOps - рассылает CRDT-операции всем в сессии (top-level ops, контракт с фронтом)
func (s *CollaborativeSession) BroadcastOps(ops []CRDTOp) {
        s.Mutex.RLock()
        connections := s.Connections
        s.Mutex.RUnlock()

        msg := ToolSyncMessage{
                Type:   "update",
                ToolID: s.ToolID,
                Ops:    ops,
        }

        for _, conn := range connections {
                select {
                case conn.Chan <- msg:
                default:
                }
        }
}

// MergeOpsToTool - применить CRDT-операции к содержимому инструмента и сохранить
func MergeOpsToTool(toolID uint, ops []CRDTOp, userID uint) error {
        var tool ChannelTool
        if err := db.First(&tool, toolID).Error; err != nil {
                return err
        }
        newContent, _ := ApplyCRDTOps(tool.Content, ops)
        tool.Content = newContent
        tool.UpdatedAt = GetCurrentTimestamp()
        if err := db.Save(&tool).Error; err != nil {
                return err
        }
        if err := SaveToolSnapshot(toolID, "", "", userID, "sync"); err != nil {
                log.Printf("Failed to save sync snapshot for tool %d: %v", toolID, err)
        }
        return nil
}

// BroadcastCursor - рассылают курсоры
func (s *CollaborativeSession) BroadcastCursor(cursor *CursorPos) {
        s.Mutex.RLock()
        connections := s.Connections
        s.Mutex.RUnlock()

        msg := ToolSyncMessage{
                Type:   "cursor",
                ToolID: s.ToolID,
                Cursor: cursor,
        }

        for _, conn := range connections {
                if conn.UserID != cursor.UserID { // Не навидям свой курсор
                        select {
                        case conn.Chan <- msg:
                        default:
                        }
                }
        }
}

// BroadcastState - рассылает полное состояние (sync_state) всем в сессии
func (s *CollaborativeSession) BroadcastState(state interface{}) {
        s.Mutex.RLock()
        connections := s.Connections
        s.Mutex.RUnlock()

        msg := ToolSyncMessage{
                Type:   "sync_state",
                ToolID: s.ToolID,
                State:  state,
        }

        for _, conn := range connections {
                select {
                case conn.Chan <- msg:
                default:
                }
        }
}

// GetConnectedUsers - получить подключенных пользователей
func (s *CollaborativeSession) GetConnectedUsers() []map[string]interface{} {
        s.Mutex.RLock()
        defer s.Mutex.RUnlock()

        var users []map[string]interface{}
        for userID, conn := range s.Connections {
                users = append(users, map[string]interface{}{
                        "user_id":   userID,
                        "username":  conn.Username,
                        "last_seen": conn.LastSeenAt,
                })
        }
        return users
}

// HandleToolUpdate - хандлер для исправления
func HandleToolUpdate(update *ToolUpdate, toolID uint) error {
        session := GetOrCreateSession(toolID)

        // Обновить версию
        if err := SaveToolSnapshot(toolID, "", "", update.UserID, update.Type); err != nil {
                return err
        }

        // Рассылание
        session.BroadcastUpdate(update)
        return nil
}

// authenticateCollabWS парсит JWT из query-параметра ?token= (тот же подход, что в handleWSConnection).
// Возвращает userID и username из токена (username — fallback из БД, если нет в claims).
func authenticateCollabWS(c *gin.Context) (uint, string, error) {
        tokenParam := c.Query("token")
        if tokenParam == "" {
                return 0, "", fmt.Errorf("no token provided")
        }

        token, err := jwt.ParseWithClaims(tokenParam, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
                if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                        return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
                }
                return getJWTSecret(), nil
        })
        if err != nil {
                return 0, "", fmt.Errorf("invalid token: %w", err)
        }
        if !token.Valid {
                return 0, "", fmt.Errorf("token not valid")
        }

        claims, ok := token.Claims.(*jwt.MapClaims)
        if !ok {
                return 0, "", fmt.Errorf("invalid claims")
        }

        // Отозванные токены/сессии (logout/revoke) не принимаем
        if jti, ok := (*claims)["jti"].(string); ok && jti != "" && isTokenBlacklisted(jti) {
                return 0, "", fmt.Errorf("token revoked")
        }
        if sid, ok := (*claims)["sid"].(string); ok && sid != "" && isSessionBlacklisted(sid) {
                return 0, "", fmt.Errorf("session revoked")
        }

        uid, ok := (*claims)["user_id"].(float64)
        if !ok {
                // Fallback to "uid" claim (used by enhanced JWT)
                uid, ok = (*claims)["uid"].(float64)
                if !ok {
                        return 0, "", fmt.Errorf("user_id not in claims")
                }
        }

        username, _ := (*claims)["username"].(string)
        if username == "" {
                var user User
                if err := db.First(&user, uint(uid)).Error; err == nil {
                        username = user.Username
                }
        }

        return uint(uid), username, nil
}

// handleRealtimeCollaboration upgrades connection to WebSocket for real-time editing
func handleRealtimeCollaboration(c *gin.Context) {
        // JWT из ?token= — до upgrade, чтобы при невалидном токене закрыть сокет кодом 4401
        userID, username, authErr := authenticateCollabWS(c)

        var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
        ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                log.Printf("WebSocket upgrade failed: %v", err)
                return
        }
        defer ws.Close()

        if authErr != nil {
                log.Printf("Collab WebSocket rejected: %v", authErr)
                ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(4401, "unauthorized"))
                return
        }

        toolIDStr := c.Param("tool_id")
        toolID, errParse := strconv.ParseUint(toolIDStr, 10, 32)
        if errParse != nil {
                log.Printf("Invalid tool ID for WebSocket: %s", toolIDStr)
                ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInvalidFramePayloadData, "Invalid tool ID"))
                return
        }

        session := GetOrCreateSession(uint(toolID))
        conn := session.AddUser(userID, username)
        defer session.RemoveUser(userID)

        // Write pump: доставка broadcast-сообщений из сессии клиенту
        go func() {
                for msg := range conn.Chan {
                        if err := ws.WriteJSON(msg); err != nil {
                                return
                        }
                }
        }()

        for {
                var msg ToolSyncMessage
                err := ws.ReadJSON(&msg)
                if err != nil {
                        break
                }
                if len(msg.Ops) > 0 {
                        // CRDT-операции от клиента: merge в БД + broadcast остальным
                        if err := MergeOpsToTool(uint(toolID), msg.Ops, userID); err != nil {
                                log.Printf("WS collab: failed to merge ops for tool %d: %v", toolID, err)
                                continue
                        }
                        session.BroadcastOps(msg.Ops)
                }
                if msg.Update != nil {
                        session.BroadcastUpdate(msg.Update)
                }
                if msg.Cursor != nil {
                        session.BroadcastCursor(msg.Cursor)
                }
        }
}

// handleCollaborationSync handles synchronization updates.
// Новый формат (offline sync batch): {tool_id, ops: []CRDTOp} → merge в ChannelTool.Content,
// сохранение, SaveToolSnapshot(changeType="sync"), broadcast, ответ {state, acked, applied}.
// Старый формат {tool_id, update} оставлен рабочим.
func handleCollaborationSync(c *gin.Context) {
        var req struct {
                ToolID uint        `json:"tool_id"`
                Update *ToolUpdate `json:"update"`
                Ops    []CRDTOp    `json:"ops"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        // Новый CRDT-формат: пачка операций
        if len(req.Ops) > 0 {
                if req.ToolID == 0 {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "tool_id is required"})
                        return
                }

                userID, _ := getUserIDFromContext(c)

                var tool ChannelTool
                if err := db.First(&tool, req.ToolID).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Tool not found"})
                        return
                }

                newContent, applied := ApplyCRDTOps(tool.Content, req.Ops)

                tool.Content = newContent
                tool.UpdatedAt = GetCurrentTimestamp()
                if err := db.Save(&tool).Error; err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save tool"})
                        return
                }

                if err := SaveToolSnapshot(req.ToolID, "", "", userID, "sync"); err != nil {
                        log.Printf("Failed to save sync snapshot for tool %d: %v", req.ToolID, err)
                }

                // Рассылаем применённые операции остальным участникам сессии
                // (top-level ops — контракт с фронтендом)
                session := GetOrCreateSession(req.ToolID)
                session.BroadcastOps(req.Ops)

                // Текущее состояние elements для ответа
                var doc CRDTDocument
                if err := json.Unmarshal([]byte(newContent), &doc); err != nil || doc.Elements == nil {
                        doc = CRDTDocument{Elements: make(map[string]CRDTElement)}
                }

                acked := make([]string, 0, len(req.Ops))
                for _, op := range req.Ops {
                        if op.OpID != "" {
                                acked = append(acked, op.OpID)
                        }
                }

                c.JSON(http.StatusOK, gin.H{
                        "state":   doc.Elements,
                        "acked":   acked,
                        "applied": applied,
                })
                return
        }

        // Старый формат: одиночный update
        if req.Update == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "either ops or update is required"})
                return
        }
        if err := HandleToolUpdate(req.Update, req.ToolID); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{"message": "sync ok"})
}

// handleGetCollaborationUsers returns list of connected users
func handleGetCollaborationUsers(c *gin.Context) {
        toolIDStr := c.Param("tool_id")
        toolID, err := strconv.ParseUint(toolIDStr, 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tool ID"})
                return
        }
        session := GetOrCreateSession(uint(toolID))
        users := session.GetConnectedUsers()
        c.JSON(http.StatusOK, users)
}

// handleUpdateCursorPosition broadcasts cursor position to other users
func handleUpdateCursorPosition(c *gin.Context) {
        var cursor CursorPos
        if err := c.ShouldBindJSON(&cursor); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        toolIDStr := c.Param("tool_id")
        if toolIDStr != "" {
                toolID, errParse := strconv.ParseUint(toolIDStr, 10, 32)
                if errParse != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tool ID"})
                        return
                }
                session := GetOrCreateSession(uint(toolID))
                session.BroadcastCursor(&cursor)
        }
        c.JSON(http.StatusOK, gin.H{"message": "cursor updated"})
}
