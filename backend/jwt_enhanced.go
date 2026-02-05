package main

import (
        "crypto/rand"
        "crypto/sha256"
        "encoding/hex"
        "net/http"
        "sync"
        "time"

        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
        "github.com/google/uuid"
)

type RefreshToken struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        UserID      uint       `json:"user_id" gorm:"index:idx_refresh_tokens_user_revoked;not null"`
        SessionID   string     `json:"session_id" gorm:"index"`
        TokenHash   string     `json:"-" gorm:"uniqueIndex;not null"`
        DeviceInfo  string     `json:"device_info"`
        IPAddress   string     `json:"ip_address"`
        ExpiresAt   time.Time  `json:"expires_at" gorm:"index"`
        Revoked     bool       `json:"revoked" gorm:"index:idx_refresh_tokens_user_revoked;default:false"`
        RevokedAt   *time.Time `json:"revoked_at,omitempty"`
        CreatedAt   time.Time  `json:"created_at"`
        LastUsedAt  time.Time  `json:"last_used_at"`
}

type UserSession struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        UserID      uint      `json:"user_id" gorm:"index;not null"`
        SessionID   string    `json:"session_id" gorm:"uniqueIndex;not null"`
        DeviceInfo  string    `json:"device_info"`
        IPAddress   string    `json:"ip_address"`
        UserAgent   string    `json:"user_agent"`
        IsActive    bool      `json:"is_active" gorm:"default:true"`
        CreatedAt   time.Time `json:"created_at"`
        LastSeenAt  time.Time `json:"last_seen_at"`
        ExpiresAt   time.Time `json:"expires_at"`
}

type EnhancedClaims struct {
        UserID    uint   `json:"uid"`
        Username  string `json:"username"`
        SessionID string `json:"sid"`
        TokenType string `json:"type"`
        TokenID   string `json:"jti"`
        jwt.RegisteredClaims
}

var (
        tokenBlacklist   = make(map[string]time.Time)
        tokenBlacklistMu sync.RWMutex
)

const (
        accessTokenExpiry  = 15 * time.Minute
        refreshTokenExpiry = 7 * 24 * time.Hour
)

func init() {
        go cleanupBlacklist()
}

func cleanupBlacklist() {
        ticker := time.NewTicker(10 * time.Minute)
        defer ticker.Stop()

        for range ticker.C {
                tokenBlacklistMu.Lock()
                now := time.Now()
                for tokenID, expiry := range tokenBlacklist {
                        if now.After(expiry) {
                                delete(tokenBlacklist, tokenID)
                        }
                }
                tokenBlacklistMu.Unlock()
        }
}

func generateSessionID() string {
        b := make([]byte, 16)
        rand.Read(b)
        return hex.EncodeToString(b)
}

func generateRefreshTokenString() string {
        b := make([]byte, 32)
        rand.Read(b)
        return hex.EncodeToString(b)
}

func hashToken(token string) string {
        hash := sha256.Sum256([]byte(token))
        return hex.EncodeToString(hash[:])
}

func generateTokenPair(user *User, sessionID, deviceInfo, ipAddress string) (accessToken, refreshToken string, err error) {
        if sessionID == "" {
                sessionID = generateSessionID()
        }

        tokenID := uuid.New().String()

        accessClaims := EnhancedClaims{
                UserID:    user.ID,
                Username:  user.Username,
                SessionID: sessionID,
                TokenType: "access",
                TokenID:   tokenID,
                RegisteredClaims: jwt.RegisteredClaims{
                        ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessTokenExpiry)),
                        IssuedAt:  jwt.NewNumericDate(time.Now()),
                        Subject:   user.Username,
                        ID:        tokenID,
                },
        }
        accessJWT := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
        accessToken, err = accessJWT.SignedString(getJWTSecret())
        if err != nil {
                return "", "", err
        }

        refreshTokenStr := generateRefreshTokenString()

        rt := RefreshToken{
                UserID:     user.ID,
                SessionID:  sessionID,
                TokenHash:  hashToken(refreshTokenStr),
                DeviceInfo: deviceInfo,
                IPAddress:  ipAddress,
                ExpiresAt:  time.Now().Add(refreshTokenExpiry),
                LastUsedAt: time.Now(),
        }
        if err := db.Create(&rt).Error; err != nil {
                return "", "", err
        }

        session := UserSession{
                UserID:     user.ID,
                SessionID:  sessionID,
                DeviceInfo: deviceInfo,
                IPAddress:  ipAddress,
                IsActive:   true,
                LastSeenAt: time.Now(),
                ExpiresAt:  time.Now().Add(refreshTokenExpiry),
        }
        db.Where("session_id = ?", sessionID).Delete(&UserSession{})
        db.Create(&session)

        return accessToken, refreshTokenStr, nil
}

func blacklistToken(tokenID string, expiry time.Duration) {
        if redisClient != nil {
                redisClient.Set(ctx, "blacklist:jti:"+tokenID, "1", expiry)
                return
        }

        tokenBlacklistMu.Lock()
        tokenBlacklist[tokenID] = time.Now().Add(expiry)
        tokenBlacklistMu.Unlock()
}

func blacklistSession(sessionID string, expiry time.Duration) {
        if redisClient != nil {
                redisClient.Set(ctx, "blacklist:session:"+sessionID, "1", expiry)
                return
        }

        tokenBlacklistMu.Lock()
        tokenBlacklist["session:"+sessionID] = time.Now().Add(expiry)
        tokenBlacklistMu.Unlock()
}

func isTokenBlacklisted(tokenID string) bool {
        if redisClient != nil {
                result, err := redisClient.Get(ctx, "blacklist:jti:"+tokenID).Result()
                return err == nil && result == "1"
        }

        tokenBlacklistMu.RLock()
        expiry, exists := tokenBlacklist[tokenID]
        tokenBlacklistMu.RUnlock()

        if !exists {
                return false
        }
        return time.Now().Before(expiry)
}

func isSessionBlacklisted(sessionID string) bool {
        if redisClient != nil {
                result, err := redisClient.Get(ctx, "blacklist:session:"+sessionID).Result()
                return err == nil && result == "1"
        }

        tokenBlacklistMu.RLock()
        expiry, exists := tokenBlacklist["session:"+sessionID]
        tokenBlacklistMu.RUnlock()

        if !exists {
                return false
        }
        return time.Now().Before(expiry)
}

func refreshTokenHandler(c *gin.Context) {
        var req struct {
                RefreshToken string `json:"refresh_token" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        tokenHash := hashToken(req.RefreshToken)

        var rt RefreshToken
        if err := db.Where("token_hash = ? AND revoked = ? AND expires_at > ?", tokenHash, false, time.Now()).First(&rt).Error; err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
                return
        }

        var user User
        if err := db.First(&user, rt.UserID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        now := time.Now()
        rt.Revoked = true
        rt.RevokedAt = &now
        db.Save(&rt)

        deviceInfo := c.GetHeader("X-Device-Info")
        if deviceInfo == "" {
                deviceInfo = c.GetHeader("User-Agent")
        }

        if rt.SessionID == "" {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token: no session"})
                return
        }

        var session UserSession
        if err := db.Where("session_id = ? AND user_id = ? AND is_active = ?", rt.SessionID, rt.UserID, true).First(&session).Error; err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Session expired or revoked"})
                return
        }

        accessToken, refreshToken, err := generateTokenPair(&user, rt.SessionID, deviceInfo, c.ClientIP())
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "access_token":  accessToken,
                "refresh_token": refreshToken,
                "expires_in":    int(accessTokenExpiry.Seconds()),
        })
}

func revokeTokenHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        currentTokenID, _ := c.Get("token_id")
        if tokenID, ok := currentTokenID.(string); ok && tokenID != "" {
                blacklistToken(tokenID, accessTokenExpiry)
        }

        var req struct {
                SessionID string `json:"session_id"`
                All       bool   `json:"all"`
        }
        c.ShouldBindJSON(&req)

        if req.All {
                now := time.Now()
                db.Model(&RefreshToken{}).Where("user_id = ? AND revoked = ?", userID, false).Updates(map[string]interface{}{
                        "revoked":    true,
                        "revoked_at": now,
                })
                db.Model(&UserSession{}).Where("user_id = ?", userID).Update("is_active", false)

                var sessions []UserSession
                db.Where("user_id = ?", userID).Find(&sessions)
                for _, s := range sessions {
                        blacklistSession(s.SessionID, accessTokenExpiry)
                }

                c.JSON(http.StatusOK, gin.H{"message": "All sessions revoked"})
                return
        }

        if req.SessionID != "" {
                now := time.Now()
                db.Model(&RefreshToken{}).Where("user_id = ? AND session_id = ?", userID, req.SessionID).Updates(map[string]interface{}{
                        "revoked":    true,
                        "revoked_at": now,
                })
                db.Model(&UserSession{}).Where("user_id = ? AND session_id = ?", userID, req.SessionID).Update("is_active", false)
                blacklistSession(req.SessionID, accessTokenExpiry)

                c.JSON(http.StatusOK, gin.H{"message": "Session revoked"})
                return
        }

        c.JSON(http.StatusBadRequest, gin.H{"error": "Specify session_id or set all=true"})
}

func getSessionsHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var sessions []UserSession
        db.Where("user_id = ? AND is_active = ? AND expires_at > ?", userID, true, time.Now()).Order("last_seen_at desc").Find(&sessions)

        c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func enhancedAuthMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                authHeader := c.GetHeader("Authorization")
                if authHeader == "" {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
                        return
                }

                tokenString := authHeader
                if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
                        tokenString = authHeader[7:]
                }

                token, err := jwt.ParseWithClaims(tokenString, &EnhancedClaims{}, func(token *jwt.Token) (interface{}, error) {
                        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                                return nil, jwt.ErrSignatureInvalid
                        }
                        return getJWTSecret(), nil
                })

                if err != nil {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                        return
                }

                if claims, ok := token.Claims.(*EnhancedClaims); ok && token.Valid {
                        if claims.TokenType != "access" {
                                c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token type"})
                                return
                        }

                        if claims.TokenID != "" && isTokenBlacklisted(claims.TokenID) {
                                c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token has been revoked"})
                                return
                        }

                        if claims.SessionID != "" && isSessionBlacklisted(claims.SessionID) {
                                c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Session has been revoked"})
                                return
                        }

                        c.Set("user_id", float64(claims.UserID))
                        c.Set("session_id", claims.SessionID)
                        c.Set("token_id", claims.TokenID)
                        c.Set("username", claims.Username)

                        if claims.SessionID != "" {
                                db.Model(&UserSession{}).Where("session_id = ?", claims.SessionID).Update("last_seen_at", time.Now())
                        }
                } else {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
                        return
                }

                c.Next()
        }
}
