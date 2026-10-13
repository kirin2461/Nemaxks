package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ApiKey — API-ключ для доступа к закрытым роутам без JWT
// (заголовок X-API-Key). Полный ключ показывается владельцу
// один раз при создании; дальше в списках отдаём только Prefix.
type ApiKey struct {
	ID         uint       `json:"id" gorm:"primaryKey"`
	Name       string     `json:"name" gorm:"size:100"`
	Key        string     `json:"-" gorm:"size:36;uniqueIndex"` // nbl_ + 32 hex, никогда не отдаём наружу
	Prefix     string     `json:"prefix" gorm:"size:12"`        // первые 12 символов для отображения
	UserID     uint       `json:"user_id" gorm:"index"`         // владелец-админ, создавший ключ
	Scopes     string     `json:"scopes" gorm:"type:text"`      // JSON-массив строк, напр. ["read","write"]
	IsActive   bool       `json:"is_active" gorm:"default:true"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

const apiKeyPrefix = "nbl_"

// generateAPIKey создаёт криптографически стойкий ключ формата
// "nbl_" + 32 hex-символа из crypto/rand.
func generateAPIKey() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return apiKeyPrefix + hex.EncodeToString(buf), nil
}

// parseScopes разбирает Scopes (JSON-массив строк) для ответа API.
func parseScopes(raw string) []string {
	if raw == "" {
		return []string{}
	}
	var scopes []string
	if err := json.Unmarshal([]byte(raw), &scopes); err != nil {
		return []string{}
	}
	return scopes
}

// normalizeScopes валидирует список scope из запроса и упаковывает в JSON-строку.
func normalizeScopes(scopes []string) string {
	if len(scopes) == 0 {
		scopes = []string{"read"}
	}
	cleaned := make([]string, 0, len(scopes))
	for _, s := range scopes {
		s = strings.TrimSpace(s)
		if s != "" {
			cleaned = append(cleaned, s)
		}
	}
	if len(cleaned) == 0 {
		cleaned = []string{"read"}
	}
	b, _ := json.Marshal(cleaned)
	return string(b)
}

func registerAPIKeyRoutes(r *gin.Engine, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	apiKeys := r.Group("/api/admin/api-keys")
	apiKeys.Use(auth, admin)
	{
		apiKeys.GET("", getAdminAPIKeysHandler)
		apiKeys.POST("", createAPIKeyHandler)
		apiKeys.PUT("/:id", updateAPIKeyHandler)
		apiKeys.DELETE("/:id", revokeAPIKeyHandler)
		apiKeys.GET("/stats", getAPIKeyStatsHandler)
	}
}

// getAdminAPIKeysHandler — список ключей. Полный Key в ответе
// не отдаём (поле Key имеет json:"-"), только Prefix.
func getAdminAPIKeysHandler(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset := (page - 1) * limit

	var total int64
	db.Model(&ApiKey{}).Count(&total)

	var keys []ApiKey
	if err := db.Order("created_at DESC").Offset(offset).Limit(limit).Find(&keys).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch API keys"})
		return
	}

	// Scopes хранятся как JSON-строка; отдаём массивом.
	type apiKeyView struct {
		ApiKey
		Scopes []string `json:"scopes"`
	}
	views := make([]apiKeyView, 0, len(keys))
	for _, k := range keys {
		views = append(views, apiKeyView{ApiKey: k, Scopes: parseScopes(k.Scopes)})
	}

	c.JSON(http.StatusOK, gin.H{
		"api_keys": views,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

// createAPIKeyHandler — создание ключа. Полный key возвращается
// ровно один раз в этом ответе; дальше доступен только Prefix.
func createAPIKeyHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var req struct {
		Name          string   `json:"name" binding:"required"`
		Scopes        []string `json:"scopes"`
		ExpiresInDays int      `json:"expires_in_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name is required"})
		return
	}

	fullKey, err := generateAPIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate API key"})
		return
	}

	apiKey := ApiKey{
		Name:     strings.TrimSpace(req.Name),
		Key:      fullKey,
		Prefix:   fullKey[:12],
		UserID:   uid,
		Scopes:   normalizeScopes(req.Scopes),
		IsActive: true,
	}
	if req.ExpiresInDays > 0 {
		expiresAt := time.Now().Add(time.Duration(req.ExpiresInDays) * 24 * time.Hour)
		apiKey.ExpiresAt = &expiresAt
	}

	if err := db.Create(&apiKey).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create API key"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"key":     fullKey, // полный ключ — только здесь и только один раз
		"api_key": gin.H{
			"id":         apiKey.ID,
			"name":       apiKey.Name,
			"prefix":     apiKey.Prefix,
			"user_id":    apiKey.UserID,
			"scopes":     parseScopes(apiKey.Scopes),
			"is_active":  apiKey.IsActive,
			"expires_at": apiKey.ExpiresAt,
			"created_at": apiKey.CreatedAt,
		},
	})
}

// updateAPIKeyHandler — обновление имени/scope/активности ключа.
func updateAPIKeyHandler(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid API key ID"})
		return
	}

	var apiKey ApiKey
	if err := db.First(&apiKey, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found"})
		return
	}

	var req struct {
		Name     *string   `json:"name"`
		Scopes   *[]string `json:"scopes"`
		IsActive *bool     `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		apiKey.Name = strings.TrimSpace(*req.Name)
	}
	if req.Scopes != nil {
		apiKey.Scopes = normalizeScopes(*req.Scopes)
	}
	if req.IsActive != nil {
		apiKey.IsActive = *req.IsActive
	}

	if err := db.Save(&apiKey).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update API key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"api_key": gin.H{
			"id":         apiKey.ID,
			"name":       apiKey.Name,
			"prefix":     apiKey.Prefix,
			"user_id":    apiKey.UserID,
			"scopes":     parseScopes(apiKey.Scopes),
			"is_active":  apiKey.IsActive,
			"expires_at": apiKey.ExpiresAt,
			"updated_at": apiKey.UpdatedAt,
		},
	})
}

// revokeAPIKeyHandler — мягкий отзыв ключа: ключ остаётся в БД
// для аудита, но is_active=false и аутентификация по нему невозможна.
func revokeAPIKeyHandler(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid API key ID"})
		return
	}

	var apiKey ApiKey
	if err := db.First(&apiKey, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found"})
		return
	}

	if err := db.Model(&apiKey).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke API key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "API key revoked",
	})
}

// getAPIKeyStatsHandler — сводная статистика по ключам.
func getAPIKeyStatsHandler(c *gin.Context) {
	var total, active, revoked, usedLast24h int64
	db.Model(&ApiKey{}).Count(&total)
	db.Model(&ApiKey{}).Where("is_active = ?", true).Count(&active)
	db.Model(&ApiKey{}).Where("is_active = ?", false).Count(&revoked)
	db.Model(&ApiKey{}).Where("last_used_at > ?", time.Now().Add(-24*time.Hour)).Count(&usedLast24h)

	c.JSON(http.StatusOK, gin.H{
		"total":         total,
		"active":        active,
		"revoked":       revoked,
		"used_last_24h": usedLast24h,
	})
}

// validateAPIKey ищет активный и неистёкший ключ и обновляет LastUsedAt.
// Возвращает nil, если ключ не найден, отозван или истёк.
func validateAPIKey(key string) *ApiKey {
	if db == nil || key == "" {
		return nil
	}

	var apiKey ApiKey
	if err := db.Where("key = ? AND is_active = ?", key, true).First(&apiKey).Error; err != nil {
		return nil
	}
	if apiKey.ExpiresAt != nil && time.Now().After(*apiKey.ExpiresAt) {
		return nil
	}

	now := time.Now()
	apiKey.LastUsedAt = &now
	db.Model(&apiKey).Update("last_used_at", now)

	return &apiKey
}

// AuthenticateAPIKey — middleware аутентификации по заголовку X-API-Key.
// При успехе ставит user_id владельца ключа и auth_via=api_key.
func AuthenticateAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-API-Key")
		if key == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "API key is required"})
			c.Abort()
			return
		}

		apiKey := validateAPIKey(key)
		if apiKey == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired API key"})
			c.Abort()
			return
		}

		// Тот же тип (float64), что ставит JWT-путь, чтобы downstream-хендлеры
		// не различали способ аутентификации.
		c.Set("user_id", float64(apiKey.UserID))
		c.Set("auth_via", "api_key")
		c.Next()
	}
}
