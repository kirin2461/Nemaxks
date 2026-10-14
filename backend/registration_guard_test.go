package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupRegistrationGuardTestDB поднимает in-memory SQLite и подменяет
// глобальный db, восстанавливая исходное значение после теста
// (тот же паттерн, что в api_keys_test.go / premium_test.go).
func setupRegistrationGuardTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := db
	t.Cleanup(func() { db = oldDB })

	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open sqlite: %v", err)
	}
	if err := gdb.AutoMigrate(
		&User{},
		&RegistrationEvent{},
		&FraudAlert{},
		&SuspiciousActivity{},
		&IPBlacklist{},
		&DeviceFingerprint{},
		&UserRiskScore{},
	); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	db = gdb
	return gdb
}

// newGuardTestContext строит gin-контекст с заданным client IP,
// как это делает fraudCheckMiddleware (кладёт client_ip в context).
func newGuardTestContext(clientIP string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader("{}"))
	req.RemoteAddr = clientIP + ":12345"
	c.Request = req
	c.Set("client_ip", clientIP)
	return c, w
}

func seedRegistrationEvents(t *testing.T, ip, fingerprint string, count int, age time.Duration) {
	t.Helper()
	for i := 0; i < count; i++ {
		ev := RegistrationEvent{
			UserID:            uint(100 + i),
			Username:          "seeduser" + strings.Repeat("x", i),
			IPAddress:         ip,
			DeviceFingerprint: fingerprint,
			CreatedAt:         time.Now().Add(-age),
		}
		if err := db.Create(&ev).Error; err != nil {
			t.Fatalf("seed event: %v", err)
		}
	}
}

// TestIsBotPatternUsername проверяет regex бот-никнеймов: буквы + 4+ цифры.
func TestIsBotPatternUsername(t *testing.T) {
	cases := []struct {
		username string
		want     bool
	}{
		{"user1234", true},
		{"bot_98765", true},
		{"Bot0000", true},
		{"user123", false},   // только 3 цифры
		{"ivanpetrov", false}, // без цифр
		{"ivan_petrov99", false},
		{"1234user", false},  // цифры в начале
		{"", false},
	}
	for _, tc := range cases {
		if got := isBotPatternUsername(tc.username); got != tc.want {
			t.Errorf("isBotPatternUsername(%q) = %v, want %v", tc.username, got, tc.want)
		}
	}
}

// TestUsernameLetterPrefix проверяет извлечение буквенного префикса.
func TestUsernameLetterPrefix(t *testing.T) {
	cases := []struct {
		username string
		want     string
	}{
		{"user1234", "user"},
		{"IvanPetrov", "ivanpetrov"},
		{"bot_9999", "bot"},
		{"иван123", "иван"},
		{"9lives", ""},
		{"", ""},
	}
	for _, tc := range cases {
		if got := usernameLetterPrefix(tc.username); got != tc.want {
			t.Errorf("usernameLetterPrefix(%q) = %q, want %q", tc.username, got, tc.want)
		}
	}
}

// TestCountRecentRegistrationsByIP проверяет подсчёт velocity с учётом окна.
func TestCountRecentRegistrationsByIP(t *testing.T) {
	setupRegistrationGuardTestDB(t)

	// 2 свежих события (10 минут назад) и 1 старое (2 часа назад).
	seedRegistrationEvents(t, "1.2.3.4", "", 2, 10*time.Minute)
	seedRegistrationEvents(t, "1.2.3.4", "", 1, 2*time.Hour)
	// Чужой IP не должен учитываться.
	seedRegistrationEvents(t, "9.9.9.9", "", 5, 5*time.Minute)

	since := time.Now().Add(-registrationIPVelocityWindow)
	if got := countRecentRegistrationsByIP("1.2.3.4", since); got != 2 {
		t.Fatalf("expected 2 recent events for 1.2.3.4, got %d", got)
	}
	if got := countRecentRegistrationsByIP("8.8.8.8", since); got != 0 {
		t.Fatalf("expected 0 events for unknown IP, got %d", got)
	}
}

// TestCheckRegistrationAbuseBlocksOnIPVelocity: ≥3 регистраций с IP за час
// → 429 + FraudAlert(high) + SuspiciousActivity(registration).
func TestCheckRegistrationAbuseBlocksOnIPVelocity(t *testing.T) {
	setupRegistrationGuardTestDB(t)
	seedRegistrationEvents(t, "1.2.3.4", "", registrationIPVelocityLimit, 10*time.Minute)

	c, w := newGuardTestContext("1.2.3.4")
	if blocked := checkRegistrationAbuse(c, "newuser"); !blocked {
		t.Fatal("expected registration to be blocked")
	}
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Слишком много регистраций") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}

	var alerts []FraudAlert
	db.Where("alert_type = ? AND severity = ?", "mass_registration", "high").Find(&alerts)
	if len(alerts) != 1 {
		t.Fatalf("expected 1 high mass_registration alert, got %d", len(alerts))
	}

	var activities []SuspiciousActivity
	db.Where("activity_type = ?", "registration").Find(&activities)
	if len(activities) != 1 {
		t.Fatalf("expected 1 registration suspicious activity, got %d", len(activities))
	}
}

// TestCheckRegistrationAbuseBlacklistsIP: ≥10 регистраций за час → IPBlacklist на 24ч.
func TestCheckRegistrationAbuseBlacklistsIP(t *testing.T) {
	setupRegistrationGuardTestDB(t)
	seedRegistrationEvents(t, "6.6.6.6", "", registrationIPBlacklistThreshold, 20*time.Minute)

	c, _ := newGuardTestContext("6.6.6.6")
	if blocked := checkRegistrationAbuse(c, "newuser"); !blocked {
		t.Fatal("expected registration to be blocked")
	}

	var entry IPBlacklist
	if err := db.Where("ip_address = ?", "6.6.6.6").First(&entry).Error; err != nil {
		t.Fatalf("expected IP in blacklist: %v", err)
	}
	if entry.ExpiresAt == nil {
		t.Fatal("expected expiration on blacklist entry")
	}
	ttl := time.Until(*entry.ExpiresAt)
	if ttl < 23*time.Hour || ttl > 24*time.Hour+time.Minute {
		t.Fatalf("expected ~24h blacklist TTL, got %v", ttl)
	}
	if entry.Reason != "auto: mass registration" {
		t.Fatalf("unexpected blacklist reason: %q", entry.Reason)
	}

	// Повторный вызов не должен дублировать запись (идемпотентность).
	c2, _ := newGuardTestContext("6.6.6.6")
	checkRegistrationAbuse(c2, "anotheruser")
	var count int64
	db.Model(&IPBlacklist{}).Where("ip_address = ?", "6.6.6.6").Count(&count)
	if count != 1 {
		t.Fatalf("expected 1 blacklist entry, got %d", count)
	}
}

// TestCheckRegistrationAbuseFingerprintAlert: ≥2 регистраций с одного fingerprint
// за сутки → алерт medium, но регистрация НЕ блокируется.
func TestCheckRegistrationAbuseFingerprintAlert(t *testing.T) {
	setupRegistrationGuardTestDB(t)
	seedRegistrationEvents(t, "5.5.5.5", "fp-device-1", registrationFingerprintLimit, 3*time.Hour)

	c, w := newGuardTestContext("5.5.5.5")
	c.Request.Header.Set("X-Device-Fingerprint", "fp-device-1")
	c.Set("device_fingerprint", "fp-device-1")

	if blocked := checkRegistrationAbuse(c, "normaluser"); blocked {
		t.Fatalf("fingerprint suspicion must not block, got 429 body: %s", w.Body.String())
	}
	if !c.GetBool(ctxFlagFingerprintSuspect) {
		t.Fatal("expected fingerprint flag in context")
	}

	var alerts []FraudAlert
	db.Where("alert_type = ? AND severity = ? AND device_fingerprint = ?",
		"mass_registration", "medium", "fp-device-1").Find(&alerts)
	if len(alerts) != 1 {
		t.Fatalf("expected 1 medium fingerprint alert, got %d", len(alerts))
	}
}

// TestCheckRegistrationAbuseBotUsernameFlag: bot-pattern в username ставит флаг,
// но не блокирует — ни по regex, ни по серии похожих username.
func TestCheckRegistrationAbuseBotUsernameFlag(t *testing.T) {
	setupRegistrationGuardTestDB(t)

	// По regex (без каких-либо событий в БД).
	c, _ := newGuardTestContext("2.2.2.2")
	if blocked := checkRegistrationAbuse(c, "user1234"); blocked {
		t.Fatal("bot-like username must not block registration")
	}
	if !c.GetBool(ctxFlagBotUsername) {
		t.Fatal("expected bot-username flag for regex match")
	}

	// По префиксу: 3 регистрации "ivanx*" за сутки → "ivanx" тоже подозрителен.
	for _, name := range []string{"ivanx1", "ivanx2", "ivanx3"} {
		if err := db.Create(&RegistrationEvent{
			UserID: 1, Username: name, IPAddress: "3.3.3.3", CreatedAt: time.Now(),
		}).Error; err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	c2, _ := newGuardTestContext("4.4.4.4")
	if blocked := checkRegistrationAbuse(c2, "ivanx"); blocked {
		t.Fatal("prefix match must not block registration")
	}
	if !c2.GetBool(ctxFlagBotUsername) {
		t.Fatal("expected bot-username flag for prefix series")
	}

	// Обычный username без флагов.
	c3, _ := newGuardTestContext("4.4.4.4")
	if blocked := checkRegistrationAbuse(c3, "maria"); blocked {
		t.Fatal("normal username must pass")
	}
	if c3.GetBool(ctxFlagBotUsername) {
		t.Fatal("unexpected bot-username flag for normal username")
	}
}

// TestFinalizeRegistrationGuards: после успешной регистрации пишется
// RegistrationEvent, bot-флаг даёт +30 к риск-скору и алерт low,
// при любых флагах фиксируется SuspiciousActivity.
func TestFinalizeRegistrationGuards(t *testing.T) {
	setupRegistrationGuardTestDB(t)

	user := User{Username: "bot5555", Password: "hash"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	c, _ := newGuardTestContext("7.7.7.7")
	c.Request.Header.Set("X-Device-Fingerprint", "fp-bot")
	c.Set("device_fingerprint", "fp-bot")
	c.Set(ctxFlagBotUsername, true)

	finalizeRegistrationGuards(c, user.ID, user.Username)

	var event RegistrationEvent
	if err := db.Where("user_id = ? AND username = ?", user.ID, "bot5555").First(&event).Error; err != nil {
		t.Fatalf("expected registration event: %v", err)
	}
	if event.IPAddress != "7.7.7.7" || event.DeviceFingerprint != "fp-bot" {
		t.Fatalf("unexpected event payload: %+v", event)
	}

	var score UserRiskScore
	if err := db.Where("user_id = ?", user.ID).First(&score).Error; err != nil {
		t.Fatalf("expected risk score row: %v", err)
	}
	if score.BehaviorScore != botUsernameRiskIncrease {
		t.Fatalf("expected behavior score %d, got %v", botUsernameRiskIncrease, score.BehaviorScore)
	}

	var alerts []FraudAlert
	db.Where("user_id = ? AND severity = ?", user.ID, "low").Find(&alerts)
	if len(alerts) != 1 {
		t.Fatalf("expected 1 low alert for bot username, got %d", len(alerts))
	}

	var activities []SuspiciousActivity
	db.Where("user_id = ? AND activity_type = ?", user.ID, "registration").Find(&activities)
	if len(activities) != 1 {
		t.Fatalf("expected 1 suspicious activity, got %d", len(activities))
	}

	// Устройство должно быть записано.
	var device DeviceFingerprint
	if err := db.Where("fingerprint = ?", "fp-bot").First(&device).Error; err != nil {
		t.Fatalf("expected device fingerprint row: %v", err)
	}
}

// TestFinalizeRegistrationGuardsClean: без флагов — только аудит,
// никаких алертов и подозрительной активности.
func TestFinalizeRegistrationGuardsClean(t *testing.T) {
	setupRegistrationGuardTestDB(t)

	user := User{Username: "cleanuser", Password: "hash"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	c, _ := newGuardTestContext("8.8.8.8")
	finalizeRegistrationGuards(c, user.ID, user.Username)

	var events int64
	db.Model(&RegistrationEvent{}).Where("user_id = ?", user.ID).Count(&events)
	if events != 1 {
		t.Fatalf("expected 1 registration event, got %d", events)
	}
	var alerts int64
	db.Model(&FraudAlert{}).Where("user_id = ?", user.ID).Count(&alerts)
	if alerts != 0 {
		t.Fatalf("expected no alerts, got %d", alerts)
	}
	var activities int64
	db.Model(&SuspiciousActivity{}).Where("user_id = ?", user.ID).Count(&activities)
	if activities != 0 {
		t.Fatalf("expected no suspicious activities, got %d", activities)
	}
}
