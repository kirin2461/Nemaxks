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

// setupApiKeyTestDB поднимает in-memory SQLite и подменяет глобальный db,
// восстанавливая исходное значение после теста (как в premium_test.go).
func setupApiKeyTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := db
	t.Cleanup(func() { db = oldDB })

	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open sqlite: %v", err)
	}
	if err := gdb.AutoMigrate(&ApiKey{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	db = gdb
	return gdb
}

// TestGenerateAPIKeyFormat проверяет формат генерируемого ключа:
// префикс "nbl_" + 32 hex-символа, префикс для отображения — первые 12 символов.
func TestGenerateApiKeyFormat(t *testing.T) {
	key, err := generateAPIKey()
	if err != nil {
		t.Fatalf("generateAPIKey: %v", err)
	}
	if !strings.HasPrefix(key, "nbl_") {
		t.Fatalf("expected nbl_ prefix, got %q", key)
	}
	if len(key) != 36 {
		t.Fatalf("expected 36 chars (nbl_ + 32 hex), got %d (%q)", len(key), key)
	}
	for _, r := range key[4:] {
		isHex := (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')
		if !isHex {
			t.Fatalf("non-hex char %q in key %q", r, key)
		}
	}
	// Два ключа подряд не должны совпадать.
	other, _ := generateAPIKey()
	if key == other {
		t.Fatal("two generated keys are identical")
	}
}

// TestCreateAPIKeyHandler проверяет создание ключа через хендлер:
// в ответе полный ключ (один раз), в БД сохранён prefix и scopes.
func TestCreateApiKeyHandler(t *testing.T) {
	setupApiKeyTestDB(t)

	r := gin.New()
	r.POST("/api/admin/api-keys", func(c *gin.Context) {
		c.Set("user_id", float64(7)) // эмулируем authMiddleware
		createAPIKeyHandler(c)
	})

	w := httptest.NewRecorder()
	body := `{"name":"CI deploy key","scopes":["read","write"],"expires_in_days":30}`
	req := httptest.NewRequest(http.MethodPost, "/api/admin/api-keys", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Success bool   `json:"success"`
		Key     string `json:"key"`
		APIKey  struct {
			ID       uint     `json:"id"`
			Name     string   `json:"name"`
			Prefix   string   `json:"prefix"`
			UserID   uint     `json:"user_id"`
			Scopes   []string `json:"scopes"`
			IsActive bool     `json:"is_active"`
		} `json:"api_key"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if !resp.Success || !strings.HasPrefix(resp.Key, "nbl_") || len(resp.Key) != 36 {
		t.Fatalf("unexpected key in response: %q", resp.Key)
	}
	if resp.APIKey.Prefix != resp.Key[:12] {
		t.Fatalf("prefix %q != first 12 chars of %q", resp.APIKey.Prefix, resp.Key)
	}
	if resp.APIKey.UserID != 7 || !resp.APIKey.IsActive {
		t.Fatalf("unexpected api_key payload: %+v", resp.APIKey)
	}

	// В списке полный ключ не отдаётся (json:"-" на поле Key).
	var stored ApiKey
	if err := db.First(&stored, resp.APIKey.ID).Error; err != nil {
		t.Fatalf("key not persisted: %v", err)
	}
	if stored.Key != resp.Key || stored.ExpiresAt == nil {
		t.Fatalf("unexpected stored key: %+v", stored)
	}
}

// TestRevokeAPIKeyHandler проверяет мягкий отзыв: запись остаётся,
// is_active=false, аутентификация по ключу перестаёт работать.
func TestRevokeApiKeyHandler(t *testing.T) {
	setupApiKeyTestDB(t)

	key, _ := generateAPIKey()
	apiKey := ApiKey{Name: "revocable", Key: key, Prefix: key[:12], UserID: 1, IsActive: true, Scopes: `["read"]`}
	if err := db.Create(&apiKey).Error; err != nil {
		t.Fatalf("seed: %v", err)
	}

	r := gin.New()
	r.DELETE("/api/admin/api-keys/:id", revokeAPIKeyHandler)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/api/admin/api-keys/"+strconv.FormatUint(uint64(apiKey.ID), 10), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var stored ApiKey
	if err := db.First(&stored, apiKey.ID).Error; err != nil {
		t.Fatalf("key should be kept (soft revoke): %v", err)
	}
	if stored.IsActive {
		t.Fatal("expected is_active=false after revoke")
	}
	if validateAPIKey(key) != nil {
		t.Fatal("revoked key must not authenticate")
	}
}

// TestAuthenticateAPIKeyMiddleware проверяет, что middleware пропускает
// валидный ключ, ставит user_id/auth_via и обновляет LastUsedAt.
func TestAuthenticateApiKeyMiddleware(t *testing.T) {
	setupApiKeyTestDB(t)

	key, _ := generateAPIKey()
	apiKey := ApiKey{Name: "mw", Key: key, Prefix: key[:12], UserID: 42, IsActive: true, Scopes: `["read"]`}
	if err := db.Create(&apiKey).Error; err != nil {
		t.Fatalf("seed: %v", err)
	}

	r := gin.New()
	r.Use(AuthenticateAPIKey())
	r.GET("/protected", func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		c.JSON(http.StatusOK, gin.H{
			"user_id":  userID,
			"auth_via": c.GetString("auth_via"),
		})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("X-API-Key", key)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["user_id"].(float64) != 42 {
		t.Fatalf("expected user_id=42, got %v", resp["user_id"])
	}
	if resp["auth_via"] != "api_key" {
		t.Fatalf("expected auth_via=api_key, got %v", resp["auth_via"])
	}

	var stored ApiKey
	db.First(&stored, apiKey.ID)
	if stored.LastUsedAt == nil {
		t.Fatal("expected last_used_at to be updated")
	}
}

// TestAuthenticateAPIKeyRejectsInvalid проверяет отклонение невалидного,
// истёкшего и отсутствующего ключа (401, хендлер не вызывается).
func TestAuthenticateApiKeyRejectsInvalid(t *testing.T) {
	gdb := setupApiKeyTestDB(t)

	expired, _ := generateAPIKey()
	past := time.Now().Add(-time.Hour) // уже истёк
	gdb.Create(&ApiKey{Name: "expired", Key: expired, Prefix: expired[:12], UserID: 1, IsActive: true, ExpiresAt: &past})

	r := gin.New()
	r.Use(AuthenticateAPIKey())
	called := false
	r.GET("/protected", func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	for _, tc := range []struct {
		name string
		key  string
	}{
		{"unknown key", "nbl_00000000000000000000000000000000"},
		{"expired key", expired},
		{"empty key", ""},
	} {
		called = false
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/protected", nil)
		if tc.key != "" {
			req.Header.Set("X-API-Key", tc.key)
		}
		r.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("%s: expected 401, got %d", tc.name, w.Code)
		}
		if called {
			t.Fatalf("%s: handler must not be called", tc.name)
		}
	}
}
