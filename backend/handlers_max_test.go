package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupMaxTestDB поднимает in-memory SQLite и подменяет глобальный db
// (паттерн из api_keys_test.go).
func setupMaxTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := db
	t.Cleanup(func() { db = oldDB })

	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open sqlite: %v", err)
	}
	if err := gdb.AutoMigrate(&User{}, &Guild{}, &Channel{}, &ChannelMember{}, &MaxLink{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	db = gdb
	return gdb
}

// maxMockServer — мок Bot API MAX: /me, /subscriptions, /messages.
type maxMockServer struct {
	mu            sync.Mutex
	sentMessages  []string
	subscriptions []string
	deletedSubs   []string
}

func startMaxMock(t *testing.T, goodToken string, rejectSubscriptions bool) (*maxMockServer, func()) {
	t.Helper()
	mock := &maxMockServer{}

	mux := http.NewServeMux()
	mux.HandleFunc("/me", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != goodToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"name":"Тестовый бот","username":"test_bot"}`)
	})
	mux.HandleFunc("/subscriptions", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != goodToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		mock.mu.Lock()
		defer mock.mu.Unlock()
		switch r.Method {
		case http.MethodPost:
			var body struct {
				URL string `json:"url"`
			}
			json.NewDecoder(r.Body).Decode(&body)
			mock.subscriptions = append(mock.subscriptions, body.URL)
			if rejectSubscriptions {
				w.WriteHeader(http.StatusBadRequest)
				fmt.Fprint(w, `{"error":"url must be https"}`)
				return
			}
			fmt.Fprint(w, `{"success":true}`)
		case http.MethodDelete:
			mock.deletedSubs = append(mock.deletedSubs, r.URL.Query().Get("url"))
			fmt.Fprint(w, `{"success":true}`)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/messages", func(w http.ResponseWriter, r *http.Request) {
		mock.mu.Lock()
		defer mock.mu.Unlock()
		mock.sentMessages = append(mock.sentMessages, r.Header.Get("Authorization")+" chat="+r.URL.Query().Get("chat_id"))
		fmt.Fprint(w, `{"success":true}`)
	})

	srv := httptest.NewServer(mux)
	t.Setenv("MAX_API_BASE", srv.URL)
	t.Setenv("PUBLIC_URL", "http://public.test")
	return mock, srv.Close
}

func newMaxTestContext(method, target, body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	return c, w
}

// TestMaxConnectFlow проверяет POST /api/max/connect: валидацию токена,
// upsert MaxLink, секретность токена в JSON, авто-установку webhook
// и идемпотентность повторного вызова.
func TestMaxConnectFlow(t *testing.T) {
	gdb := setupMaxTestDB(t)
	mock, closeSrv := startMaxMock(t, "good-token", false)
	defer closeSrv()

	connect := func(token string) (*httptest.ResponseRecorder, map[string]interface{}) {
		c, w := newMaxTestContext(http.MethodPost, "/api/max/connect", `{"bot_token":"`+token+`"}`)
		c.Set("user_id", float64(42))
		connectMaxHandler(c)
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		return w, resp
	}

	// 1. Успешное подключение.
	w, resp := connect("good-token")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if resp["connected"] != true || resp["webhook_set"] != true {
		t.Fatalf("unexpected response: %v", resp)
	}
	if resp["bot_name"] != "Тестовый бот" || resp["bot_username"] != "test_bot" {
		t.Fatalf("bot info not propagated: %v", resp)
	}
	webhookURL, _ := resp["webhook_url"].(string)
	if !strings.HasPrefix(webhookURL, "http://public.test/api/max/webhook/") || !strings.Contains(webhookURL, "?secret=") {
		t.Fatalf("unexpected webhook_url: %q", webhookURL)
	}
	// Токен НЕ должен светиться в ответе.
	if strings.Contains(w.Body.String(), "good-token") {
		t.Fatal("bot token leaked in connect response")
	}

	// MaxLink сохранён: токен в БД, секрет 24 hex.
	var link MaxLink
	if err := gdb.Where("user_id = ?", 42).First(&link).Error; err != nil {
		t.Fatalf("MaxLink not created: %v", err)
	}
	if link.BotToken != "good-token" {
		t.Fatalf("BotToken not saved, got %q", link.BotToken)
	}
	if len(link.WebhookSecret) != 24 {
		t.Fatalf("expected 24-char webhook secret, got %q", link.WebhookSecret)
	}
	if !strings.Contains(webhookURL, "?secret="+link.WebhookSecret) {
		t.Fatalf("webhook_url secret mismatch: %q vs %q", webhookURL, link.WebhookSecret)
	}
	// Подписка установлена в MAX с тем же URL.
	if len(mock.subscriptions) != 1 || mock.subscriptions[0] != webhookURL {
		t.Fatalf("expected 1 subscription with %q, got %v", webhookURL, mock.subscriptions)
	}

	// 2. Идемпотентность: повторный connect обновляет запись, не плодит строки,
	// секрет сохраняется.
	w, resp = connect("good-token")
	if w.Code != http.StatusOK {
		t.Fatalf("reconnect: expected 200, got %d", w.Code)
	}
	var count int64
	gdb.Model(&MaxLink{}).Where("user_id = ?", 42).Count(&count)
	if count != 1 {
		t.Fatalf("expected 1 MaxLink row after reconnect, got %d", count)
	}
	var link2 MaxLink
	gdb.Where("user_id = ?", 42).First(&link2)
	if link2.ID != link.ID || link2.WebhookSecret != link.WebhookSecret {
		t.Fatal("reconnect changed link ID or webhook secret")
	}

	// 3. Невалидный токен → 400 с русским сообщением.
	w, resp = connect("bad-token")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad token, got %d", w.Code)
	}
	if !strings.Contains(resp["error"].(string), "Токен не принят MAX") {
		t.Fatalf("unexpected error message: %v", resp["error"])
	}

	// 4. MAX недоступен → 502.
	t.Setenv("MAX_API_BASE", "http://127.0.0.1:1")
	w, resp = connect("good-token")
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 when MAX is down, got %d", w.Code)
	}
	if !strings.Contains(resp["error"].(string), "Не удалось связаться с MAX") {
		t.Fatalf("unexpected error message: %v", resp["error"])
	}
}

// TestMaxConnectWebhookRejected проверяет graceful degradation: MAX отверг
// webhook URL → webhook_set:false + warning с URL для ручной настройки.
func TestMaxConnectWebhookRejected(t *testing.T) {
	setupMaxTestDB(t)
	_, closeSrv := startMaxMock(t, "good-token", true)
	defer closeSrv()

	c, w := newMaxTestContext(http.MethodPost, "/api/max/connect", `{"bot_token":"good-token"}`)
	c.Set("user_id", float64(7))
	connectMaxHandler(c)

	if w.Code != http.StatusOK {
		t.Fatalf("connect must not fail when webhook rejected, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["connected"] != true || resp["webhook_set"] != false {
		t.Fatalf("unexpected response: %v", resp)
	}
	warning, _ := resp["warning"].(string)
	if warning == "" || !strings.Contains(warning, resp["webhook_url"].(string)) {
		t.Fatalf("warning must contain webhook URL, got %q", warning)
	}
}

// TestMaxWebhookSecret проверяет проверку секрета webhook и доставку
// bot_started-приветствия от имени бота пользователя.
func TestMaxWebhookSecret(t *testing.T) {
	gdb := setupMaxTestDB(t)
	mock, closeSrv := startMaxMock(t, "user-token", false)
	defer closeSrv()

	link := MaxLink{UserID: 7, BotToken: "user-token", BotName: "Бот", WebhookSecret: "0123456789abcdef01234567"}
	if err := gdb.Create(&link).Error; err != nil {
		t.Fatalf("create link: %v", err)
	}
	linkID := strconv.FormatUint(uint64(link.ID), 10)

	call := func(target string) *httptest.ResponseRecorder {
		c, w := newMaxTestContext(http.MethodPost, target, `{"update_type":"bot_started","chat_id":555}`)
		c.Params = gin.Params{{Key: "link_id", Value: linkID}}
		maxWebhookHandler(c)
		return w
	}

	// Неверный секрет → 403, приветствие не отправлено.
	if w := call("/api/max/webhook/" + linkID + "?secret=wrong"); w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for wrong secret, got %d", w.Code)
	}
	if len(mock.sentMessages) != 0 {
		t.Fatal("message sent despite invalid secret")
	}

	// Несуществующий link_id → 403.
	c, w := newMaxTestContext(http.MethodPost, "/api/max/webhook/999999?secret=0123456789abcdef01234567", `{}`)
	c.Params = gin.Params{{Key: "link_id", Value: "999999"}}
	maxWebhookHandler(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for unknown link, got %d", w.Code)
	}

	// Верный секрет (query) → 200, приветствие отправлено токеном пользователя.
	if w := call("/api/max/webhook/" + linkID + "?secret=" + link.WebhookSecret); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if len(mock.sentMessages) != 1 || !strings.Contains(mock.sentMessages[0], "user-token") || !strings.Contains(mock.sentMessages[0], "chat=555") {
		t.Fatalf("expected greeting via user token to chat 555, got %v", mock.sentMessages)
	}

	// Верный секрет через заголовок X-Max-Bot-Api-Secret.
	c, w = newMaxTestContext(http.MethodPost, "/api/max/webhook/"+linkID, `{"update_type":"bot_started","chat_id":555}`)
	c.Params = gin.Params{{Key: "link_id", Value: linkID}}
	c.Request.Header.Set("X-Max-Bot-Api-Secret", link.WebhookSecret)
	maxWebhookHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with header secret, got %d", w.Code)
	}
	if len(mock.sentMessages) != 2 {
		t.Fatalf("expected 2 greetings total, got %d", len(mock.sentMessages))
	}
}

// TestMaxGetAndDeleteLink проверяет GET /api/max/link (владельцу виден
// webhook_secret, токен — нет) и DELETE /api/max/link (best-effort удаление
// подписки + удаление записи).
func TestMaxGetAndDeleteLink(t *testing.T) {
	gdb := setupMaxTestDB(t)
	mock, closeSrv := startMaxMock(t, "user-token", false)
	defer closeSrv()

	link := MaxLink{UserID: 9, BotToken: "user-token", BotName: "Бот", BotUsername: "bot", WebhookSecret: "0123456789abcdef01234567"}
	gdb.Create(&link)

	// Нет привязки → connected:false.
	c, w := newMaxTestContext(http.MethodGet, "/api/max/link", "")
	c.Set("user_id", float64(123))
	getMaxLinkHandler(c)
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["connected"] != false {
		t.Fatalf("expected connected=false, got %v", resp)
	}

	// Владелец: полный статус, секрет виден, токен — нет.
	c, w = newMaxTestContext(http.MethodGet, "/api/max/link", "")
	c.Set("user_id", float64(9))
	getMaxLinkHandler(c)
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["connected"] != true || resp["webhook_secret"] != link.WebhookSecret {
		t.Fatalf("unexpected link response: %v", resp)
	}
	if !strings.Contains(resp["webhook_url"].(string), "?secret="+link.WebhookSecret) {
		t.Fatalf("webhook_url mismatch: %v", resp["webhook_url"])
	}
	if strings.Contains(w.Body.String(), "user-token") {
		t.Fatal("bot token leaked in GET /api/max/link")
	}

	// DELETE: подписка удалена в MAX, запись удалена из БД.
	c, w = newMaxTestContext(http.MethodDelete, "/api/max/link", "")
	c.Set("user_id", float64(9))
	unlinkMaxHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if len(mock.deletedSubs) != 1 || !strings.Contains(mock.deletedSubs[0], "?secret="+link.WebhookSecret) {
		t.Fatalf("subscription not deleted in MAX: %v", mock.deletedSubs)
	}
	var count int64
	gdb.Model(&MaxLink{}).Where("user_id = ?", 9).Count(&count)
	if count != 0 {
		t.Fatal("MaxLink row not deleted")
	}
}
