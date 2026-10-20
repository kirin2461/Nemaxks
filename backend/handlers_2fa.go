package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base32"
	"encoding/base64"
	"image/png"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

// Per-user счётчик неудачных TOTP-попыток (защита от брутфорса 2FA-кода,
// независимо от IP). После max2FAFailedAttempts подряд двухфакторная
// сессия инвалидируется: дальнейшие попытки отклоняются на
// lockout2FADuration, пользователь обязан пройти логин заново.
const (
	max2FAFailedAttempts = 5
	lockout2FADuration   = 15 * time.Minute
)

type twoFAAttemptInfo struct {
	FailedCount int
	LockedUntil time.Time
}

var (
	twoFAFailedAttempts = make(map[uint]*twoFAAttemptInfo)
	twoFAAttemptsMu     sync.Mutex
)

// is2FAVerifyLocked проверяет, заблокирована ли 2FA-проверка для пользователя.
func is2FAVerifyLocked(userID uint) (bool, time.Duration) {
	twoFAAttemptsMu.Lock()
	defer twoFAAttemptsMu.Unlock()

	info, exists := twoFAFailedAttempts[userID]
	if !exists {
		return false, 0
	}
	if time.Now().Before(info.LockedUntil) {
		return true, time.Until(info.LockedUntil)
	}
	// Окно блокировки истекло — сбрасываем счётчик
	delete(twoFAFailedAttempts, userID)
	return false, 0
}

// recordFailed2FA фиксирует неудачную попытку; возвращает true, если
// пользователь только что заблокирован (достигнут лимит подряд).
func recordFailed2FA(userID uint) bool {
	twoFAAttemptsMu.Lock()
	defer twoFAAttemptsMu.Unlock()

	info, exists := twoFAFailedAttempts[userID]
	if !exists {
		info = &twoFAAttemptInfo{}
		twoFAFailedAttempts[userID] = info
	}
	info.FailedCount++
	if info.FailedCount >= max2FAFailedAttempts {
		info.LockedUntil = time.Now().Add(lockout2FADuration)
		info.FailedCount = 0
		return true
	}
	return false
}

func clearFailed2FA(userID uint) {
	twoFAAttemptsMu.Lock()
	defer twoFAAttemptsMu.Unlock()
	delete(twoFAFailedAttempts, userID)
}

type TwoFactorAuth struct {
	ID         uint       `json:"id" gorm:"primaryKey"`
	UserID     uint       `json:"user_id" gorm:"uniqueIndex;not null"`
	Secret     string     `json:"-" gorm:"not null"`
	Enabled    bool       `json:"enabled" gorm:"default:false"`
	VerifiedAt *time.Time `json:"verified_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type TwoFactorRecoveryCode struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	UserID    uint       `json:"user_id" gorm:"index;not null"`
	CodeHash  string     `json:"-" gorm:"not null"`
	Used      bool       `json:"used" gorm:"default:false"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type TwoFactorSetupResponse struct {
	Secret        string   `json:"secret"`
	QRCode        string   `json:"qr_code"`
	RecoveryCodes []string `json:"recovery_codes"`
}

func generateSecret() (string, error) {
	secret := make([]byte, 20)
	if _, err := rand.Read(secret); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secret), nil
}

func generateRecoveryCodes(count int) ([]string, error) {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		b := make([]byte, 5)
		if _, err := rand.Read(b); err != nil {
			return nil, err
		}
		codes[i] = strings.ToUpper(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:8]
	}
	return codes, nil
}

func setup2FAHandler(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var existing TwoFactorAuth
	if db.Where("user_id = ? AND enabled = ?", userID, true).First(&existing).RowsAffected > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA is already enabled"})
		return
	}

	secret, err := generateSecret()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate secret"})
		return
	}

	accountName := user.Username
	if user.Email != nil && *user.Email != "" {
		accountName = *user.Email
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Nemaks",
		AccountName: accountName,
		Secret:      []byte(secret),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate TOTP key"})
		return
	}

	img, err := key.Image(200, 200)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code"})
		return
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encode QR code"})
		return
	}
	qrBase64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())

	recoveryCodes, err := generateRecoveryCodes(8)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate recovery codes"})
		return
	}

	db.Where("user_id = ?", userID).Delete(&TwoFactorAuth{})
	db.Where("user_id = ?", userID).Delete(&TwoFactorRecoveryCode{})

	tfa := TwoFactorAuth{
		UserID:  userID,
		Secret:  secret,
		Enabled: false,
	}
	if err := db.Create(&tfa).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save 2FA setup"})
		return
	}

	for _, code := range recoveryCodes {
		hash, _ := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
		recoveryCode := TwoFactorRecoveryCode{
			UserID:   userID,
			CodeHash: string(hash),
		}
		db.Create(&recoveryCode)
	}

	c.JSON(http.StatusOK, TwoFactorSetupResponse{
		Secret:        key.Secret(),
		QRCode:        qrBase64,
		RecoveryCodes: recoveryCodes,
	})
}

func verify2FASetupHandler(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tfa TwoFactorAuth
	if err := db.Where("user_id = ? AND enabled = ?", userID, false).First(&tfa).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No pending 2FA setup found"})
		return
	}

	if !totp.Validate(req.Code, tfa.Secret) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code"})
		return
	}

	now := time.Now()
	tfa.Enabled = true
	tfa.VerifiedAt = &now
	db.Save(&tfa)

	c.JSON(http.StatusOK, gin.H{"message": "2FA enabled successfully"})
}

func disable2FAHandler(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Password string `json:"password" binding:"required"`
		Code     string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
		return
	}

	var tfa TwoFactorAuth
	if err := db.Where("user_id = ? AND enabled = ?", userID, true).First(&tfa).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA is not enabled"})
		return
	}

	if req.Code != "" && !totp.Validate(req.Code, tfa.Secret) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid 2FA code"})
		return
	}

	db.Where("user_id = ?", userID).Delete(&TwoFactorAuth{})
	db.Where("user_id = ?", userID).Delete(&TwoFactorRecoveryCode{})

	c.JSON(http.StatusOK, gin.H{"message": "2FA disabled successfully"})
}

func get2FAStatusHandler(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var tfa TwoFactorAuth
	if err := db.Where("user_id = ? AND enabled = ?", userID, true).First(&tfa).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"enabled": false})
		return
	}

	var unusedCount int64
	db.Model(&TwoFactorRecoveryCode{}).Where("user_id = ? AND used = ?", userID, false).Count(&unusedCount)

	c.JSON(http.StatusOK, gin.H{
		"enabled":                  true,
		"verified_at":              tfa.VerifiedAt,
		"recovery_codes_remaining": unusedCount,
	})
}

func regenerateRecoveryCodesHandler(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tfa TwoFactorAuth
	if err := db.Where("user_id = ? AND enabled = ?", userID, true).First(&tfa).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA is not enabled"})
		return
	}

	if !totp.Validate(req.Code, tfa.Secret) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid 2FA code"})
		return
	}

	db.Where("user_id = ?", userID).Delete(&TwoFactorRecoveryCode{})

	recoveryCodes, err := generateRecoveryCodes(8)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate recovery codes"})
		return
	}

	for _, code := range recoveryCodes {
		hash, _ := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
		recoveryCode := TwoFactorRecoveryCode{
			UserID:   userID,
			CodeHash: string(hash),
		}
		db.Create(&recoveryCode)
	}

	c.JSON(http.StatusOK, gin.H{"recovery_codes": recoveryCodes})
}

func validate2FACode(userID uint, code string) bool {
	var tfa TwoFactorAuth
	if err := db.Where("user_id = ? AND enabled = ?", userID, true).First(&tfa).Error; err != nil {
		return true
	}

	if totp.Validate(code, tfa.Secret) {
		return true
	}

	var recoveryCodes []TwoFactorRecoveryCode
	db.Where("user_id = ? AND used = ?", userID, false).Find(&recoveryCodes)
	for _, rc := range recoveryCodes {
		if bcrypt.CompareHashAndPassword([]byte(rc.CodeHash), []byte(code)) == nil {
			now := time.Now()
			rc.Used = true
			rc.UsedAt = &now
			db.Save(&rc)
			return true
		}
	}

	return false
}

func is2FAEnabled(userID uint) bool {
	var tfa TwoFactorAuth
	return db.Where("user_id = ? AND enabled = ?", userID, true).First(&tfa).RowsAffected > 0
}

func verify2FALoginHandler(c *gin.Context) {
	var req struct {
		UserID uint   `json:"user_id" binding:"required"`
		Code   string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Security: endpoint предназначен только для завершения логина при
	// включённой 2FA. Без этого условия validate2FACode возвращал true для
	// пользователей без 2FA — зная user_id, можно было получить токены
	// без пароля (обход аутентификации).
	if !is2FAEnabled(req.UserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA is not enabled for this user"})
		return
	}

	// Per-user lockout после 5 неудачных попыток подряд
	if locked, retryAfter := is2FAVerifyLocked(req.UserID); locked {
		c.Header("Retry-After", strconv.Itoa(int(retryAfter.Seconds())))
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":   "Too many failed 2FA attempts. Please log in again later.",
			"locked":  true,
			"relogin": true,
		})
		return
	}

	if !validate2FACode(req.UserID, req.Code) {
		RecordFailedLogin(c.ClientIP())
		if justLocked := recordFailed2FA(req.UserID); justLocked {
			// Инвалидируем двухфакторную сессию: требуем полный
			// повторный логин (пароль + новый TOTP)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Too many failed 2FA attempts. Please log in again.",
				"locked":  true,
				"relogin": true,
			})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid 2FA code"})
		return
	}

	ClearFailedLogins(c.ClientIP())
	clearFailed2FA(req.UserID)

	var user User
	if err := db.First(&user, req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Enforce account block before issuing tokens
	if user.IsBlocked {
		log.Printf("2FA login blocked: user %s is blocked (reason: %s)", user.Username, user.BlockReason)
		c.JSON(http.StatusForbidden, gin.H{"error": "Account is blocked", "blocked": true, "reason": user.BlockReason})
		return
	}

	deviceInfo := c.GetHeader("X-Device-Info")
	if deviceInfo == "" {
		deviceInfo = c.GetHeader("User-Agent")
	}

	accessToken, refreshToken, err := generateTokenPair(&user, "", deviceInfo, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"expires_in":    int(accessTokenExpiry.Seconds()),
		"user":          user.ToPublic(),
	})
}
