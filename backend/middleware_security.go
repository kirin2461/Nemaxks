package main

import (
        "crypto/rand"
        "encoding/base64"
        "net/http"
        "os"
        "regexp"
        "strings"
        "sync"
        "time"

        "github.com/gin-gonic/gin"
)

var (
        csrfTokenStore = make(map[string]csrfToken)
        csrfMu         sync.RWMutex

        failedLoginAttempts = make(map[string]*loginAttemptInfo)
        loginAttemptMu      sync.RWMutex

        htmlSanitizeRegex = regexp.MustCompile(`<[^>]*>`)
        jsEventRegex      = regexp.MustCompile(`(?i)on\w+\s*=`)
        jsProtocolRegex   = regexp.MustCompile(`(?i)javascript:`)
        dataProtocolRegex = regexp.MustCompile(`(?i)data:`)
)

type csrfToken struct {
        Token     string
        ExpiresAt time.Time
}

type loginAttemptInfo struct {
        FailedCount int
        LockedUntil time.Time
        LastAttempt time.Time
}

const (
        csrfTokenExpiry    = 2 * time.Hour
        maxLoginAttempts   = 5
        lockoutDuration    = 15 * time.Minute
        csrfTokenHeader    = "X-CSRF-Token"
        csrfTokenCookie    = "csrf_token"
)

// Note: For JWT-based SPAs, CSRF protection is typically provided by:
// 1. CORS restrictions (cross-origin requests cannot include Authorization header)
// 2. JWT in Authorization header (not cookies, so not vulnerable to CSRF)
// The CSRFMiddleware is available but optional for this architecture.

func init() {
        go cleanupCSRFTokens()
        go cleanupLoginAttempts()
}

func cleanupCSRFTokens() {
        ticker := time.NewTicker(10 * time.Minute)
        defer ticker.Stop()

        for range ticker.C {
                csrfMu.Lock()
                now := time.Now()
                for id, token := range csrfTokenStore {
                        if now.After(token.ExpiresAt) {
                                delete(csrfTokenStore, id)
                        }
                }
                csrfMu.Unlock()
        }
}

func cleanupLoginAttempts() {
        ticker := time.NewTicker(5 * time.Minute)
        defer ticker.Stop()

        for range ticker.C {
                loginAttemptMu.Lock()
                now := time.Now()
                for ip, info := range failedLoginAttempts {
                        if now.Sub(info.LastAttempt) > lockoutDuration*2 {
                                delete(failedLoginAttempts, ip)
                        }
                }
                loginAttemptMu.Unlock()
        }
}

func generateCSRFToken() (string, error) {
        bytes := make([]byte, 32)
        if _, err := rand.Read(bytes); err != nil {
                return "", err
        }
        return base64.URLEncoding.EncodeToString(bytes), nil
}

func CSRFMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
                        tokenFromCookie, err := c.Cookie(csrfTokenCookie)
                        if err != nil || tokenFromCookie == "" {
                                token, genErr := generateCSRFToken()
                                if genErr == nil {
                                        sessionID := c.GetHeader("Authorization")
                                        if sessionID == "" {
                                                sessionID = c.ClientIP()
                                        }

                                        csrfMu.Lock()
                                        csrfTokenStore[sessionID] = csrfToken{
                                                Token:     token,
                                                ExpiresAt: time.Now().Add(csrfTokenExpiry),
                                        }
                                        csrfMu.Unlock()

                                        c.SetCookie(csrfTokenCookie, token, int(csrfTokenExpiry.Seconds()), "/", "", isSecureContext(c), true)
                                        c.Header(csrfTokenHeader, token)
                                }
                        }
                        c.Next()
                        return
                }

                tokenFromHeader := c.GetHeader(csrfTokenHeader)
                tokenFromCookie, _ := c.Cookie(csrfTokenCookie)

                if tokenFromHeader == "" || tokenFromCookie == "" {
                        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
                                "error": "CSRF token missing",
                        })
                        return
                }

                if tokenFromHeader != tokenFromCookie {
                        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
                                "error": "CSRF token mismatch",
                        })
                        return
                }

                sessionID := c.GetHeader("Authorization")
                if sessionID == "" {
                        sessionID = c.ClientIP()
                }

                csrfMu.RLock()
                storedToken, exists := csrfTokenStore[sessionID]
                csrfMu.RUnlock()

                if !exists || storedToken.Token != tokenFromHeader || time.Now().After(storedToken.ExpiresAt) {
                        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
                                "error": "CSRF token invalid or expired",
                        })
                        return
                }

                c.Next()
        }
}

func SecurityHeadersMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                c.Header("X-Content-Type-Options", "nosniff")
                c.Header("X-Frame-Options", "DENY")
                c.Header("X-XSS-Protection", "1; mode=block")
                c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
                c.Header("Permissions-Policy", "geolocation=(), microphone=(self), camera=(self)")

                // CSP: script-src максимально строгий — без 'unsafe-inline' и
                // 'unsafe-eval'. Проверено по frontend/index.html и сборке Vite:
                // инлайн-<script> нет, eval/new Function во frontend/src нет,
                // cdn.jsdelivr.net не используется. 'unsafe-inline' оставлен
                // только для style-src: React-библиотеки часто инлайнят стили,
                // ужесточение style-src может сломать UI (риск принят осознанно).
                cspDirectives := []string{
                        "default-src 'self'",
                        "script-src 'self'",
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src 'self' https://fonts.gstatic.com",
                        "img-src 'self' data: https: blob:",
                        "media-src 'self' blob: https:",
                        "connect-src 'self' wss: https:",
                        "frame-ancestors 'none'",
                        "base-uri 'self'",
                        "form-action 'self'",
                }
                c.Header("Content-Security-Policy", strings.Join(cspDirectives, "; "))

                if isSecureContext(c) {
                        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
                }

                c.Next()
        }
}

func HTTPSEnforcementMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                if os.Getenv("ENFORCE_HTTPS") != "true" {
                        c.Next()
                        return
                }

                proto := c.GetHeader("X-Forwarded-Proto")
                if proto == "" {
                        proto = c.Request.URL.Scheme
                }

                if proto != "https" && !strings.HasPrefix(c.Request.Host, "localhost") && !strings.HasPrefix(c.Request.Host, "127.0.0.1") {
                        httpsURL := "https://" + c.Request.Host + c.Request.RequestURI
                        c.Redirect(http.StatusMovedPermanently, httpsURL)
                        c.Abort()
                        return
                }

                c.Next()
        }
}

func isSecureContext(c *gin.Context) bool {
        proto := c.GetHeader("X-Forwarded-Proto")
        if proto == "https" {
                return true
        }
        return strings.HasPrefix(c.Request.URL.String(), "https")
}

func AccountLockoutMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                ip := c.ClientIP()

                loginAttemptMu.RLock()
                info, exists := failedLoginAttempts[ip]
                loginAttemptMu.RUnlock()

                if exists && time.Now().Before(info.LockedUntil) {
                        remaining := info.LockedUntil.Sub(time.Now())
                        c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
                                "error":       "Account temporarily locked due to too many failed attempts",
                                "retry_after": remaining.Seconds(),
                                "locked":      true,
                        })
                        return
                }

                c.Next()
        }
}

func RecordFailedLogin(ip string) {
        loginAttemptMu.Lock()
        defer loginAttemptMu.Unlock()

        info, exists := failedLoginAttempts[ip]
        if !exists {
                info = &loginAttemptInfo{}
                failedLoginAttempts[ip] = info
        }

        if time.Now().Sub(info.LastAttempt) > lockoutDuration {
                info.FailedCount = 0
        }

        info.FailedCount++
        info.LastAttempt = time.Now()

        if info.FailedCount >= maxLoginAttempts {
                info.LockedUntil = time.Now().Add(lockoutDuration)
        }
}

func ClearFailedLogins(ip string) {
        loginAttemptMu.Lock()
        defer loginAttemptMu.Unlock()
        delete(failedLoginAttempts, ip)
}

func IsAccountLocked(ip string) bool {
        loginAttemptMu.RLock()
        defer loginAttemptMu.RUnlock()

        info, exists := failedLoginAttempts[ip]
        if !exists {
                return false
        }
        return time.Now().Before(info.LockedUntil)
}

func SanitizeHTML(input string) string {
        result := htmlSanitizeRegex.ReplaceAllString(input, "")
        result = jsEventRegex.ReplaceAllString(result, "")
        result = jsProtocolRegex.ReplaceAllString(result, "")
        result = dataProtocolRegex.ReplaceAllString(result, "")
        result = strings.ReplaceAll(result, "<", "&lt;")
        result = strings.ReplaceAll(result, ">", "&gt;")
        result = strings.ReplaceAll(result, "\"", "&quot;")
        result = strings.ReplaceAll(result, "'", "&#x27;")
        return result
}

func SanitizeForDisplay(input string) string {
        result := strings.ReplaceAll(input, "<script", "&lt;script")
        result = strings.ReplaceAll(result, "</script", "&lt;/script")
        result = jsEventRegex.ReplaceAllString(result, "")
        result = jsProtocolRegex.ReplaceAllString(result, "")
        return result
}

func SanitizeUsername(input string) string {
        input = SanitizeHTML(input)
        validChars := regexp.MustCompile(`[^a-zA-Z0-9_\-\p{L}\p{N}]`)
        return validChars.ReplaceAllString(input, "")
}

func SanitizeBio(input string) string {
        input = SanitizeForDisplay(input)
        if len(input) > 500 {
                input = input[:500]
        }
        return input
}

func SanitizeMessageContent(input string) string {
        input = SanitizeForDisplay(input)
        if len(input) > 4000 {
                input = input[:4000]
        }
        return input
}
