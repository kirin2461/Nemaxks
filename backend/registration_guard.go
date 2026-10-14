package main

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
)

// Пороги антифрода при регистрации — вынесены в константы, чтобы легко менять.
const (
	// registrationIPVelocityLimit — сколько регистраций с одного IP за час
	// допустимо, прежде чем начать отклонять новые (429 + алерт).
	registrationIPVelocityLimit = 3
	// registrationIPBlacklistThreshold — при таком количестве регистраций
	// с IP за час IP дополнительно попадает в IPBlacklist.
	registrationIPBlacklistThreshold = 10
	// registrationIPVelocityWindow — окно подсчёта velocity по IP.
	registrationIPVelocityWindow = time.Hour
	// registrationIPBlacklistDuration — срок автоматической блокировки IP.
	registrationIPBlacklistDuration = 24 * time.Hour
	// registrationFingerprintLimit — регистраций с одного device fingerprint
	// за сутки, при которых создаётся алерт (без блокировки).
	registrationFingerprintLimit = 2
	// registrationFingerprintWindow — окно подсчёта по fingerprint.
	registrationFingerprintWindow = 24 * time.Hour
	// registrationUsernamePrefixMinCount — сколько username с тем же буквенным
	// префиксом за сутки считается bot-паттерном.
	registrationUsernamePrefixMinCount = 3
	// registrationUsernamePrefixWindow — окно подсчёта похожих username.
	registrationUsernamePrefixWindow = 24 * time.Hour
	// botUsernameRiskIncrease — прибавка к риск-скору за bot-like username.
	botUsernameRiskIncrease = 30
)

// botUsernameRegex — классический паттерн бот-никнеймов: буквы, опциональное
// подчёркивание и 4+ цифры в конце (user_1234, bot98765).
var botUsernameRegex = regexp.MustCompile(`^[a-zA-Z]+_?\d{4,}$`)

// Ключи gin-контекста для флагов, выставленных checkRegistrationAbuse
// и применяемых после создания пользователя (finalizeRegistrationGuards).
const (
	ctxFlagBotUsername        = "registration_flag_bot_username"
	ctxFlagFingerprintSuspect = "registration_flag_fingerprint"
)

// isBotPatternUsername — чистая функция: username совпадает с regex бот-никнейма.
func isBotPatternUsername(username string) bool {
	return botUsernameRegex.MatchString(username)
}

// usernameLetterPrefix — чистая функция: ведущие буквы username
// (латиница и кириллица), приведённые к нижнему регистру.
func usernameLetterPrefix(username string) string {
	prefix := []rune{}
	for _, r := range username {
		if !unicode.IsLetter(r) {
			break
		}
		prefix = append(prefix, unicode.ToLower(r))
	}
	return string(prefix)
}

// countRecentRegistrationsByIP — регистраций с IP с момента since.
func countRecentRegistrationsByIP(ip string, since time.Time) int64 {
	var count int64
	db.Model(&RegistrationEvent{}).
		Where("ip_address = ? AND created_at > ?", ip, since).
		Count(&count)
	return count
}

// countRecentRegistrationsByFingerprint — регистраций с fingerprint с момента since.
func countRecentRegistrationsByFingerprint(fingerprint string, since time.Time) int64 {
	var count int64
	db.Model(&RegistrationEvent{}).
		Where("device_fingerprint = ? AND created_at > ?", fingerprint, since).
		Count(&count)
	return count
}

// countRecentUsernamesWithPrefix — регистраций с тем же буквенным префиксом
// username с момента since (SQL LIKE case-insensitive для ASCII).
func countRecentUsernamesWithPrefix(prefix string, since time.Time) int64 {
	if prefix == "" {
		return 0
	}
	var count int64
	db.Model(&RegistrationEvent{}).
		Where("username LIKE ? AND created_at > ?", prefix+"%", since).
		Count(&count)
	return count
}

// createRegistrationAlert — алерт до создания пользователя (userID ещё нет):
// пишет FraudAlert напрямую, не трогая UserRiskScore (для userID=0 он бессмыслен).
// После создания пользователя используется FraudDetector.CreateAlert,
// который сам обновляет риск-скор.
func createRegistrationAlert(alertType, severity, description string, evidence map[string]interface{}, sourceIP, deviceFP string) {
	evidenceJSON, _ := json.Marshal(evidence)
	alert := FraudAlert{
		UserID:            nil,
		AlertType:         alertType,
		Severity:          severity,
		Description:       description,
		Evidence:          string(evidenceJSON),
		SourceIP:          sourceIP,
		DeviceFingerprint: deviceFP,
		Status:            "pending",
		ActionTaken:       "none",
		CreatedAt:         time.Now(),
	}
	if err := db.Create(&alert).Error; err != nil {
		log.Printf("registration guard: failed to create alert %s: %v", alertType, err)
	}
}

// blacklistIP заносит IP в IPBlacklist на registrationIPBlacklistDuration (идемпотентно).
func blacklistIP(ip, reason string) {
	expiresAt := time.Now().Add(registrationIPBlacklistDuration)
	var existing IPBlacklist
	if err := db.Where("ip_address = ?", ip).First(&existing).Error; err == nil {
		existing.Reason = reason
		existing.Source = "auto"
		existing.ExpiresAt = &expiresAt
		if err := db.Save(&existing).Error; err != nil {
			log.Printf("registration guard: failed to update IP blacklist %s: %v", ip, err)
		}
		return
	}
	entry := IPBlacklist{
		IPAddress: ip,
		Reason:    reason,
		Source:    "auto",
		ExpiresAt: &expiresAt,
	}
	if err := db.Create(&entry).Error; err != nil {
		log.Printf("registration guard: failed to blacklist IP %s: %v", ip, err)
	}
}

// checkRegistrationAbuse вызывается из registerHandler после bind и до создания
// пользователя. Возвращает true, если регистрация заблокирована (ответ уже записан).
// Неблокирующие флаги складывает в gin context для finalizeRegistrationGuards.
func checkRegistrationAbuse(c *gin.Context, username string) (blocked bool) {
	clientIP := c.GetString("client_ip") // выставляет fraudCheckMiddleware
	if clientIP == "" {
		clientIP = c.ClientIP()
	}
	deviceFP := c.GetString("device_fingerprint")
	if deviceFP == "" {
		deviceFP = c.GetHeader("X-Device-Fingerprint")
	}
	now := time.Now()

	// 1. IP velocity: много регистраций с одного IP за час.
	ipCount := countRecentRegistrationsByIP(clientIP, now.Add(-registrationIPVelocityWindow))
	if ipCount >= registrationIPBlacklistThreshold {
		// Совсем наглая накрутка — блокируем сам IP на сутки.
		blacklistIP(clientIP, "auto: mass registration")
	}
	if ipCount >= registrationIPVelocityLimit {
		createRegistrationAlert(
			"mass_registration", "high",
			"Mass registrations from a single IP",
			map[string]interface{}{
				"ip":               clientIP,
				"registrations_1h": ipCount,
			},
			clientIP, deviceFP,
		)
		if err := db.Create(&SuspiciousActivity{
			ActivityType:      "registration",
			Details:           `{"reason": "ip_velocity", "registrations_1h": ` + strconv.FormatInt(ipCount, 10) + `}`,
			RiskLevel:         "high",
			SourceIP:          clientIP,
			DeviceFingerprint: deviceFP,
			UserAgent:         c.GetHeader("User-Agent"),
			CreatedAt:         now,
		}).Error; err != nil {
			log.Printf("registration guard: failed to log suspicious activity: %v", err)
		}
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "Слишком много регистраций с вашего IP. Попробуйте позже.",
		})
		return true
	}

	// 2. Device fingerprint: повторные регистрации с того же устройства — алерт, но не блок.
	if deviceFP != "" {
		fpCount := countRecentRegistrationsByFingerprint(deviceFP, now.Add(-registrationFingerprintWindow))
		if fpCount >= registrationFingerprintLimit {
			createRegistrationAlert(
				"mass_registration", "medium",
				"Repeated registrations from the same device fingerprint",
				map[string]interface{}{
					"device_fingerprint": deviceFP,
					"registrations_24h":  fpCount,
				},
				clientIP, deviceFP,
			)
			c.Set(ctxFlagFingerprintSuspect, true)
		}
	}

	// 3. Username bot-pattern: regex или серия username с тем же буквенным префиксом.
	// Не блокируем (возможны ложные срабатывания) — только флаг для риск-скора.
	botLike := isBotPatternUsername(username)
	if !botLike {
		prefix := usernameLetterPrefix(username)
		if countRecentUsernamesWithPrefix(prefix, now.Add(-registrationUsernamePrefixWindow)) >= registrationUsernamePrefixMinCount {
			botLike = true
		}
	}
	if botLike {
		c.Set(ctxFlagBotUsername, true)
	}

	return false
}

// finalizeRegistrationGuards вызывается из registerHandler после успешного
// db.Create(&user): пишет RegistrationEvent, применяет флаги (риск-скор, алерты)
// и фиксирует SuspiciousActivity, если регистрация была помечена.
func finalizeRegistrationGuards(c *gin.Context, userID uint, username string) {
	clientIP := c.GetString("client_ip")
	if clientIP == "" {
		clientIP = c.ClientIP()
	}
	deviceFP := c.GetString("device_fingerprint")
	if deviceFP == "" {
		deviceFP = c.GetHeader("X-Device-Fingerprint")
	}
	now := time.Now()

	// Аудит регистрации — основа для velocity-подсчётов.
	event := RegistrationEvent{
		UserID:            userID,
		Username:          username,
		IPAddress:         clientIP,
		DeviceFingerprint: deviceFP,
		CreatedAt:         now,
	}
	if err := db.Create(&event).Error; err != nil {
		log.Printf("registration guard: failed to record registration event: %v", err)
	}

	// Запоминаем/обновляем устройство пользователя.
	recordDeviceFingerprint(userID, deviceFP)

	flagged := false

	// Bot-like username: +30 к риск-скору и алерт низкой важности (без блокировки).
	if c.GetBool(ctxFlagBotUsername) {
		flagged = true
		detector := NewFraudDetector()
		result := DetectionResult{
			AlertType:    "suspicious",
			Severity:     "low",
			Description:  "bot-like username",
			Action:       "none",
			RiskIncrease: botUsernameRiskIncrease,
		}
		evidence := map[string]interface{}{
			"username": username,
			"pattern":  botUsernameRegex.String(),
		}
		if err := detector.CreateAlert(userID, result, evidence, clientIP, deviceFP); err != nil {
			log.Printf("registration guard: failed to create bot-username alert: %v", err)
		}
	}

	if c.GetBool(ctxFlagFingerprintSuspect) {
		flagged = true
	}

	if flagged {
		if err := db.Create(&SuspiciousActivity{
			UserID:            &userID,
			ActivityType:      "registration",
			Details:           `{"bot_username": ` + strconv.FormatBool(c.GetBool(ctxFlagBotUsername)) + `, "fingerprint_suspect": ` + strconv.FormatBool(c.GetBool(ctxFlagFingerprintSuspect)) + `}`,
			RiskLevel:         "medium",
			SourceIP:          clientIP,
			DeviceFingerprint: deviceFP,
			UserAgent:         c.GetHeader("User-Agent"),
			CreatedAt:         now,
		}).Error; err != nil {
			log.Printf("registration guard: failed to log suspicious activity: %v", err)
		}
	}
}
