package main

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512 * 1024 // 512KB
)

type WSClient struct {
	ID     int
	Conn   *websocket.Conn
	Send   chan interface{}
	UserID string
}

type WSDirectMessage struct {
	TargetUserID string
	Payload      interface{}
}

type WSHub struct {
	clients       map[*WSClient]bool
	clientsByUser map[string]*WSClient
	broadcast     chan interface{}
	direct        chan WSDirectMessage
	register      chan *WSClient
	unregister    chan *WSClient
	mu            sync.RWMutex
}

type VoiceParticipant struct {
	UserID     string `json:"user_id"`
	Username   string `json:"username"`
	Avatar     string `json:"avatar,omitempty"`
	IsMuted    bool   `json:"is_muted"`
	IsDeafened bool   `json:"is_deafened"`
}

type VoiceRoster struct {
	channels map[string]map[string]*VoiceParticipant
	mu       sync.RWMutex
}

var voiceRoster = &VoiceRoster{
	channels: make(map[string]map[string]*VoiceParticipant),
}

func (vr *VoiceRoster) Join(channelID, userID, username, avatar string, isMuted, isDeafened bool) {
	vr.mu.Lock()
	defer vr.mu.Unlock()

	if vr.channels[channelID] == nil {
		vr.channels[channelID] = make(map[string]*VoiceParticipant)
	}
	vr.channels[channelID][userID] = &VoiceParticipant{
		UserID:     userID,
		Username:   username,
		Avatar:     avatar,
		IsMuted:    isMuted,
		IsDeafened: isDeafened,
	}
}

func (vr *VoiceRoster) Leave(channelID, userID string) {
	vr.mu.Lock()
	defer vr.mu.Unlock()

	if vr.channels[channelID] != nil {
		delete(vr.channels[channelID], userID)
		if len(vr.channels[channelID]) == 0 {
			delete(vr.channels, channelID)
		}
	}
}

func (vr *VoiceRoster) UpdateState(channelID, userID string, isMuted, isDeafened bool) {
	vr.mu.Lock()
	defer vr.mu.Unlock()

	if vr.channels[channelID] != nil && vr.channels[channelID][userID] != nil {
		vr.channels[channelID][userID].IsMuted = isMuted
		vr.channels[channelID][userID].IsDeafened = isDeafened
	}
}

func (vr *VoiceRoster) GetParticipants(channelID string) []*VoiceParticipant {
	vr.mu.RLock()
	defer vr.mu.RUnlock()

	participants := make([]*VoiceParticipant, 0)
	if vr.channels[channelID] != nil {
		for _, p := range vr.channels[channelID] {
			participants = append(participants, p)
		}
	}
	return participants
}

func (vr *VoiceRoster) RemoveUser(userID string) {
	vr.mu.Lock()
	defer vr.mu.Unlock()

	// Collect channels to delete to avoid modifying map during iteration
	channelsToDelete := make([]string, 0)

	for channelID, participants := range vr.channels {
		delete(participants, userID)
		if len(participants) == 0 {
			channelsToDelete = append(channelsToDelete, channelID)
		}
	}

	// Delete empty channels after iteration
	for _, channelID := range channelsToDelete {
		delete(vr.channels, channelID)
	}
}

func getStringFromMap(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case string:
			return val
		case float64:
			return strconv.FormatInt(int64(val), 10)
		case int:
			return strconv.Itoa(val)
		default:
			return fmt.Sprintf("%v", val)
		}
	}
	return ""
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			// In production, you might want to reject requests without Origin
			// For now, allow for non-browser clients
			return true
		}

		parsedURL, err := url.Parse(origin)
		if err != nil {
			return false
		}
		host := parsedURL.Hostname()

		// Check explicit allowed origins first
		allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
		if allowedOrigins != "" {
			for _, allowed := range strings.Split(allowedOrigins, ",") {
				if strings.TrimSpace(allowed) == origin {
					return true
				}
			}
			return false
		}

		// Check Replit domain
		replitDomain := os.Getenv("REPLIT_DEV_DOMAIN")
		if replitDomain != "" && host == replitDomain {
			return true
		}

		// Development/Replit domains
		if strings.HasSuffix(host, ".replit.dev") ||
			strings.HasSuffix(host, ".repl.co") ||
			strings.HasSuffix(host, ".replit.app") ||
			host == "localhost" ||
			host == "127.0.0.1" {
			return true
		}

		return false
	},
}

var hub = &WSHub{
	clients:       make(map[*WSClient]bool),
	clientsByUser: make(map[string]*WSClient),
	broadcast:     make(chan interface{}, 256),
	direct:        make(chan WSDirectMessage, 256),
	register:      make(chan *WSClient),
	unregister:    make(chan *WSClient),
}

func init() {
	go hub.run()
}

func (h *WSHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.clientsByUser[client.UserID] = client
			h.mu.Unlock()
			log.Printf("Client %s registered", client.UserID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				delete(h.clientsByUser, client.UserID)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("Client %s unregistered", client.UserID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- msg:
				default:
					// Client buffer is full, skip this message
				}
			}
			h.mu.RUnlock()

		case dm := <-h.direct:
			h.mu.RLock()
			if targetClient, ok := h.clientsByUser[dm.TargetUserID]; ok {
				select {
				case targetClient.Send <- dm.Payload:
				default:
					log.Printf("Failed to send direct message to user %s", dm.TargetUserID)
				}
			} else {
				log.Printf("Target user %s not connected", dm.TargetUserID)
			}
			h.mu.RUnlock()
		}
	}
}

func (h *WSHub) sendToUser(targetUserID string, message interface{}) {
	h.direct <- WSDirectMessage{
		TargetUserID: targetUserID,
		Payload:      message,
	}
}

func (c *WSClient) readPump() {
	defer func() {
		voiceRoster.RemoveUser(c.UserID)
		hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		var msg map[string]interface{}
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for user %s: %v", c.UserID, err)
			}
			return
		}

		msg["fromUserId"] = c.UserID

		msgType, hasType := msg["type"].(string)

		var targetUserID string
		if target := msg["targetUserId"]; target != nil {
			switch v := target.(type) {
			case string:
				targetUserID = v
			case float64:
				targetUserID = strconv.FormatInt(int64(v), 10)
			case int:
				targetUserID = strconv.Itoa(v)
			case int64:
				targetUserID = strconv.FormatInt(v, 10)
			default:
				targetUserID = fmt.Sprintf("%v", v)
			}
		}

		if hasType && targetUserID != "" && targetUserID != "undefined" {
			switch msgType {
			case "call-offer", "call-answer", "ice-candidate", "call-end", "call-rejected",
				"call-accepted", "call-cancelled", "voice-offer", "voice-answer", "voice-ice-candidate":
				log.Printf("Routing %s from %s to %s", msgType, c.UserID, targetUserID)
				hub.sendToUser(targetUserID, msg)
				continue
			}
		}

		if hasType {
			switch msgType {
			case "voice-join":
				channelID := getStringFromMap(msg, "channel_id")
				username := getStringFromMap(msg, "username")
				avatar := getStringFromMap(msg, "avatar")
				isMuted, _ := msg["is_muted"].(bool)
				isDeafened, _ := msg["is_deafened"].(bool)

				voiceRoster.Join(channelID, c.UserID, username, avatar, isMuted, isDeafened)
				log.Printf("Voice join: user %s joined channel %s", c.UserID, channelID)
				hub.broadcast <- msg
				continue
			case "voice-leave":
				channelID := getStringFromMap(msg, "channel_id")
				voiceRoster.Leave(channelID, c.UserID)
				log.Printf("Voice leave: user %s left channel %s", c.UserID, channelID)
				hub.broadcast <- msg
				continue
			case "voice-state-update":
				channelID := getStringFromMap(msg, "channel_id")
				isMuted, _ := msg["is_muted"].(bool)
				isDeafened, _ := msg["is_deafened"].(bool)
				voiceRoster.UpdateState(channelID, c.UserID, isMuted, isDeafened)
				log.Printf("Voice state update: user %s in channel %s", c.UserID, channelID)
				hub.broadcast <- msg
				continue
			case "ping":
				// Handle client-side ping
				c.Send <- map[string]string{"type": "pong"}
				continue
			}
		}

		hub.broadcast <- msg
	}
}

func (c *WSClient) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(msg); err != nil {
				log.Printf("Write error for user %s: %v", c.UserID, err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Ping error for user %s: %v", c.UserID, err)
				return
			}
		}
	}
}

func handleWSConnection(c *gin.Context) {
	var userID string

	tokenParam := c.Query("token")
	if tokenParam == "" {
		log.Println("WebSocket connection rejected: no token provided")
		c.AbortWithStatus(401)
		return
	}

	// CRITICAL FIX: Use the same JWT secret as REST API
	token, err := jwt.ParseWithClaims(tokenParam, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return getJWTSecret(), nil // Fixed: was hardcoded "your-secret-key"
	})

	if err != nil {
		log.Printf("WebSocket connection rejected: invalid token - %v", err)
		c.AbortWithStatus(401)
		return
	}

	if !token.Valid {
		log.Println("WebSocket connection rejected: token not valid")
		c.AbortWithStatus(401)
		return
	}

	claims, ok := token.Claims.(*jwt.MapClaims)
	if !ok {
		log.Println("WebSocket connection rejected: invalid claims")
		c.AbortWithStatus(401)
		return
	}

	uid, ok := (*claims)["user_id"].(float64)
	if !ok {
		log.Println("WebSocket connection rejected: user_id not in claims")
		c.AbortWithStatus(401)
		return
	}

	userID = strconv.Itoa(int(uid))

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	log.Printf("WebSocket connected: user %s", userID)

	client := &WSClient{
		ID:     len(hub.clients),
		Conn:   conn,
		Send:   make(chan interface{}, 256),
		UserID: userID,
	}

	hub.register <- client
	go client.readPump()
	go client.writePump()
}
