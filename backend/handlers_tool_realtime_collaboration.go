package main

import (
        "log"
        "net/http"
        "strconv"
        "sync"

        "github.com/gin-gonic/gin"
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

// handleRealtimeCollaboration upgrades connection to WebSocket for real-time editing
func handleRealtimeCollaboration(c *gin.Context) {
        var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
        ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                log.Printf("WebSocket upgrade failed: %v", err)
                return
        }
        defer ws.Close()

        toolIDStr := c.Param("tool_id")
        toolID, _ := strconv.ParseUint(toolIDStr, 10, 32)
        userID := c.GetUint("user_id")
        username := c.GetString("username")

        session := GetOrCreateSession(uint(toolID))
        _ = session.AddUser(userID, username)

        for {
                var msg ToolSyncMessage
                err := ws.ReadJSON(&msg)
                if err != nil {
                        break
                }
                if msg.Update != nil {
                        session.BroadcastUpdate(msg.Update)
                }
                if msg.Cursor != nil {
                        session.BroadcastCursor(msg.Cursor)
                }
        }
        session.RemoveUser(userID)
}

// handleCollaborationSync handles synchronization updates
func handleCollaborationSync(c *gin.Context) {
        var req struct {
                ToolID uint        `json:"tool_id"`
                Update *ToolUpdate `json:"update"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
        toolID, _ := strconv.ParseUint(toolIDStr, 10, 32)
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
                toolID, _ := strconv.ParseUint(toolIDStr, 10, 32)
                session := GetOrCreateSession(uint(toolID))
                session.BroadcastCursor(&cursor)
        }
        c.JSON(http.StatusOK, gin.H{"message": "cursor updated"})
}
