package main

import (
	"testing"
	"time"
)

// TestHasPremiumInactive проверяет, что без подписки HasPremium
// возвращает false и корректно деградирует при недоступной БД/Redis.
func TestHasPremiumInactive(t *testing.T) {
	oldDB, oldRedis := db, redisClient
	defer func() { db, redisClient = oldDB, oldRedis }()
	db = nil
	redisClient = nil

	if HasPremium(424242) {
		t.Fatal("expected HasPremium=false for user without subscription")
	}
}

// TestGetUserPremiumInfoInactive проверяет формат ответа
// GetUserPremiumInfo для пользователя без premium.
func TestGetUserPremiumInfoInactive(t *testing.T) {
	oldDB, oldRedis := db, redisClient
	defer func() { db, redisClient = oldDB, oldRedis }()
	db = nil
	redisClient = nil

	info := GetUserPremiumInfo(424242)
	if active, ok := info["active"].(bool); !ok || active {
		t.Fatalf("expected active=false, got %v", info["active"])
	}
	if planName, ok := info["plan_name"].(string); !ok || planName != "" {
		t.Fatalf("expected empty plan_name, got %v", info["plan_name"])
	}
	expiresAt, ok := info["expires_at"].(*time.Time)
	if !ok || expiresAt != nil {
		t.Fatalf("expected expires_at=(*time.Time)(nil), got %#v", info["expires_at"])
	}
}

// TestJarvisDailyLimit проверяет значения дневного лимита по умолчанию
// и переопределение через env.
func TestJarvisDailyLimit(t *testing.T) {
	// Дефолты: 3 для бесплатных, 100 для premium.
	t.Setenv("JARVIS_DAILY_FREE", "")
	t.Setenv("JARVIS_DAILY_PREMIUM", "")
	if got := jarvisDailyLimit(false); got != 3 {
		t.Fatalf("expected free limit=3, got %d", got)
	}
	if got := jarvisDailyLimit(true); got != 100 {
		t.Fatalf("expected premium limit=100, got %d", got)
	}

	// Переопределение через env.
	t.Setenv("JARVIS_DAILY_FREE", "5")
	t.Setenv("JARVIS_DAILY_PREMIUM", "250")
	if got := jarvisDailyLimit(false); got != 5 {
		t.Fatalf("expected free limit=5, got %d", got)
	}
	if got := jarvisDailyLimit(true); got != 250 {
		t.Fatalf("expected premium limit=250, got %d", got)
	}

	// Невалидное значение env игнорируется, используется дефолт.
	t.Setenv("JARVIS_DAILY_FREE", "-10")
	if got := jarvisDailyLimit(false); got != 3 {
		t.Fatalf("expected free limit=3 for invalid env, got %d", got)
	}
}

// TestJarvisQuotaLogic проверяет in-memory счётчик дневной квоты:
// инкремент, сброс по дате и расчет остатка/превышения лимита.
func TestJarvisQuotaLogic(t *testing.T) {
	oldRedis := redisClient
	defer func() { redisClient = oldRedis }()
	redisClient = nil // принудительно используем in-memory fallback

	uid := uint(987654321)
	jarvisQuotaMutex.Lock()
	delete(jarvisQuotaMem, uid)
	jarvisQuotaMutex.Unlock()

	if got := getJarvisQuotaUsed(uid); got != 0 {
		t.Fatalf("expected used=0 initially, got %d", got)
	}
	if got := incrJarvisQuota(uid); got != 1 {
		t.Fatalf("expected used=1 after first incr, got %d", got)
	}
	if got := incrJarvisQuota(uid); got != 2 {
		t.Fatalf("expected used=2 after second incr, got %d", got)
	}

	// Превышение лимита: лимит 2, третий запрос должен считаться превышением.
	t.Setenv("JARVIS_DAILY_FREE", "2")
	used := incrJarvisQuota(uid)
	quota := buildJarvisQuotaInfo(uid, used)
	if used <= quota.Limit {
		t.Fatalf("expected used=%d to exceed limit=%d", used, quota.Limit)
	}
	if quota.Remaining != 0 {
		t.Fatalf("expected remaining=0, got %d", quota.Remaining)
	}

	// Сброс по дате: запись за другой день начинается с нуля.
	jarvisQuotaMutex.Lock()
	entry := jarvisQuotaMem[uid]
	entry.day = "2000-01-01"
	jarvisQuotaMem[uid] = entry
	jarvisQuotaMutex.Unlock()

	if got := getJarvisQuotaUsed(uid); got != 0 {
		t.Fatalf("expected used=0 after day change, got %d", got)
	}
	if got := incrJarvisQuota(uid); got != 1 {
		t.Fatalf("expected used=1 after day change, got %d", got)
	}
}
