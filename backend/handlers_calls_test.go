package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupDMCallTestDB поднимает in-memory SQLite и подменяет глобальный db
// (паттерн registration_guard_test.go).
func setupDMCallTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := db
	t.Cleanup(func() { db = oldDB })

	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open sqlite: %v", err)
	}
	// sqlite ":memory:" живёт per-connection: без лимита пул открывает второе
	// соединение с пустой БД и таблицы "исчезают" посреди теста
	if sqlDB, err := gdb.DB(); err == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	if err := gdb.AutoMigrate(&User{}, &Call{}, &CallParticipant{}, &DirectMessage{},
		&UserSettings{}, &TelegramNotification{}, &TelegramLink{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	db = gdb
	// hub не трогаем: глобальный WSHub с буферизованным direct-каналом
	// инициализируется в websocket.go, sendToUser безопасен без подключений.
	return gdb
}

// newDMCallEndContext строит gin-контекст для POST /api/calls/dm/:id/end
func newDMCallEndContext(userID uint, callID uint, query string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/calls/dm/"+strconv.FormatUint(uint64(callID), 10)+"/end"+query, nil)
	c.Request = req
	c.Set("user_id", float64(userID))
	c.Params = gin.Params{{Key: "call_id", Value: strconv.FormatUint(uint64(callID), 10)}}
	return c, w
}

func createDMCallFixture(t *testing.T, db *gorm.DB, callerID, peerID uint, startedAt time.Time) Call {
	t.Helper()
	call := Call{ChannelID: 0, Type: "dm", Status: "ongoing", StartedAt: startedAt}
	if err := db.Create(&call).Error; err != nil {
		t.Fatalf("create call: %v", err)
	}
	parts := []CallParticipant{
		{CallID: call.ID, UserID: callerID, JoinedAt: startedAt},
		{CallID: call.ID, UserID: peerID, JoinedAt: startedAt},
	}
	if err := db.Create(&parts).Error; err != nil {
		t.Fatalf("create participants: %v", err)
	}
	return call
}

func TestEndDMCallCreatesSystemMessage(t *testing.T) {
	gdb := setupDMCallTestDB(t)
	for _, u := range []User{{ID: 1, Username: "caller"}, {ID: 2, Username: "peer"}} {
		if err := gdb.Create(&u).Error; err != nil {
			t.Fatalf("create user: %v", err)
		}
	}
	call := createDMCallFixture(t, gdb, 1, 2, time.Now().Add(-3*time.Minute))

	c, w := newDMCallEndContext(1, call.ID, "?kind=audio&answered=1")
	endDMCallHandler(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var updated Call
	gdb.First(&updated, call.ID)
	if updated.Status != "ended" || updated.EndedAt == nil {
		t.Fatalf("call not ended: status=%s ended_at=%v", updated.Status, updated.EndedAt)
	}

	var msgs []DirectMessage
	if err := gdb.Where("type = ?", "call").Find(&msgs).Error; err != nil {
		t.Fatalf("load messages: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("expected 1 call system message, got %d", len(msgs))
	}
	msg := msgs[0]
	if msg.SenderID != 1 || msg.ReceiverID != 2 {
		t.Fatalf("wrong participants: sender=%d receiver=%d", msg.SenderID, msg.ReceiverID)
	}
	var meta map[string]interface{}
	if err := json.Unmarshal([]byte(msg.Content), &meta); err != nil {
		t.Fatalf("content is not JSON: %v", err)
	}
	if meta["kind"] != "audio" || meta["status"] != "completed" {
		t.Fatalf("unexpected meta: %v", meta)
	}
	if d, ok := meta["duration_sec"].(float64); !ok || d < 170 {
		t.Fatalf("unexpected duration_sec: %v", meta["duration_sec"])
	}
}

func TestEndDMCallMissedAndIdempotent(t *testing.T) {
	gdb := setupDMCallTestDB(t)
	for _, u := range []User{{ID: 1, Username: "caller"}, {ID: 2, Username: "peer"}} {
		if err := gdb.Create(&u).Error; err != nil {
			t.Fatalf("create user: %v", err)
		}
	}
	call := createDMCallFixture(t, gdb, 1, 2, time.Now().Add(-40*time.Second))

	// Собеседник не ответил — answered=0 → missed
	c, w := newDMCallEndContext(1, call.ID, "?kind=video&answered=0")
	endDMCallHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var msg DirectMessage
	if err := gdb.Where("type = ?", "call").First(&msg).Error; err != nil {
		t.Fatalf("system message not created: %v", err)
	}
	var meta map[string]interface{}
	if err := json.Unmarshal([]byte(msg.Content), &meta); err != nil {
		t.Fatalf("content is not JSON: %v", err)
	}
	if meta["status"] != "missed" {
		t.Fatalf("expected missed, got %v", meta["status"])
	}

	// Повторный end (вторая сторона тоже репортит) — карточка не дублируется
	c2, w2 := newDMCallEndContext(2, call.ID, "?kind=video&answered=0")
	endDMCallHandler(c2)
	if w2.Code != http.StatusOK {
		t.Fatalf("second end expected 200, got %d", w2.Code)
	}
	var cnt int64
	gdb.Model(&DirectMessage{}).Where("type = ?", "call").Count(&cnt)
	if cnt != 1 {
		t.Fatalf("expected exactly 1 system message after double end, got %d", cnt)
	}
}

func TestEndDMCallForbiddenForStranger(t *testing.T) {
	gdb := setupDMCallTestDB(t)
	call := createDMCallFixture(t, gdb, 1, 2, time.Now())

	c, w := newDMCallEndContext(999, call.ID, "")
	endDMCallHandler(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestCreateMessageVoiceType(t *testing.T) {
	gdb := setupDMCallTestDB(t)
	for _, u := range []User{{ID: 1, Username: "sender"}, {ID: 2, Username: "receiver"}} {
		if err := gdb.Create(&u).Error; err != nil {
			t.Fatalf("create user: %v", err)
		}
	}

	body := `{"to_user_id":"2","content":"","voice_url":"/uploads/voice.webm","voice_duration":7}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/messages", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("user_id", float64(1))
	createMessageHandler(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var msg DirectMessage
	if err := gdb.First(&msg).Error; err != nil {
		t.Fatalf("message not stored: %v", err)
	}
	if msg.Type != "voice" {
		t.Fatalf("expected type=voice, got %q", msg.Type)
	}

	// Обычное текстовое сообщение — type=text
	body2 := `{"to_user_id":"2","content":"привет"}`
	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodPost, "/api/messages", strings.NewReader(body2))
	c2.Request.Header.Set("Content-Type", "application/json")
	c2.Set("user_id", float64(1))
	createMessageHandler(c2)
	if w2.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w2.Code, w2.Body.String())
	}
	var textMsg DirectMessage
	if err := gdb.Where("content = ?", "привет").First(&textMsg).Error; err != nil {
		t.Fatalf("text message not stored: %v", err)
	}
	if textMsg.Type != "text" {
		t.Fatalf("expected type=text, got %q", textMsg.Type)
	}

	// createMessageHandler спавнит goroutine с createNotificationHandler —
	// даём ей завершиться до отката глобального db в cleanup
	time.Sleep(100 * time.Millisecond)
}
