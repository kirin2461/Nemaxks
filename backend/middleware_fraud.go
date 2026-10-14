package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func fraudCheckMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		
		var blacklisted IPBlacklist
		if err := db.Where("ip_address = ? AND (expires_at IS NULL OR expires_at > ?)", clientIP, time.Now()).First(&blacklisted).Error; err == nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "IP address is blocked"})
			c.Abort()
			return
		}
		
		deviceFP := c.GetHeader("X-Device-Fingerprint")
		if deviceFP != "" {
			var bannedDevice DeviceFingerprint
			if err := db.Where("fingerprint = ? AND is_banned = ?", deviceFP, true).First(&bannedDevice).Error; err == nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Device is banned"})
				c.Abort()
				return
			}
		}
		
		c.Set("client_ip", clientIP)
		c.Set("device_fingerprint", deviceFP)
		
		c.Next()
	}
}

func rateLimitMiddleware(maxRequests int, windowSeconds int) gin.HandlerFunc {
	type rateLimitEntry struct {
		count     int
		expiresAt time.Time
	}
	
	rateLimits := make(map[string]*rateLimitEntry)
	
	return func(c *gin.Context) {
		key := c.ClientIP()
		if userID, exists := c.Get("user_id"); exists {
			key = key + "_" + string(rune(userID.(uint)))
		}
		
		now := time.Now()
		
		if entry, exists := rateLimits[key]; exists {
			if now.After(entry.expiresAt) {
				entry.count = 1
				entry.expiresAt = now.Add(time.Duration(windowSeconds) * time.Second)
			} else {
				entry.count++
				if entry.count > maxRequests {
					c.JSON(http.StatusTooManyRequests, gin.H{
						"error":       "Rate limit exceeded",
						"retry_after": entry.expiresAt.Sub(now).Seconds(),
					})
					c.Abort()
					return
				}
			}
		} else {
			rateLimits[key] = &rateLimitEntry{
				count:     1,
				expiresAt: now.Add(time.Duration(windowSeconds) * time.Second),
			}
		}
		
		c.Next()
	}
}

func messageContentCheckMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != "POST" {
			c.Next()
			return
		}
		
		path := c.Request.URL.Path
		if !strings.Contains(path, "/messages") && !strings.Contains(path, "/dm") {
			c.Next()
			return
		}
		
		c.Next()
	}
}

func loginAttemptMiddleware() gin.HandlerFunc {
	type loginAttempt struct {
		attempts  int
		lockedAt  *time.Time
		expiresAt time.Time
	}
	
	attempts := make(map[string]*loginAttempt)
	
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		
		now := time.Now()
		
		if attempt, exists := attempts[clientIP]; exists {
			if attempt.lockedAt != nil && now.Before(*attempt.lockedAt) {
				c.JSON(http.StatusTooManyRequests, gin.H{
					"error":       "Too many failed login attempts",
					"retry_after": attempt.lockedAt.Sub(now).Seconds(),
				})
				c.Abort()
				return
			}
			
			if now.After(attempt.expiresAt) {
				attempt.attempts = 0
				attempt.lockedAt = nil
			}
		}
		
		c.Set("login_attempts", attempts)
		c.Set("client_ip_for_login", clientIP)
		
		c.Next()
	}
}

func recordFailedLogin(c *gin.Context) {
	type loginAttempt struct {
		attempts  int
		lockedAt  *time.Time
		expiresAt time.Time
	}
	
	attemptsMap, exists := c.Get("login_attempts")
	if !exists {
		return
	}
	
	attempts := attemptsMap.(map[string]*loginAttempt)
	clientIP := c.GetString("client_ip_for_login")
	
	now := time.Now()
	
	if attempt, exists := attempts[clientIP]; exists {
		attempt.attempts++
		if attempt.attempts >= 5 {
			lockTime := now.Add(15 * time.Minute)
			attempt.lockedAt = &lockTime
			
			activity := SuspiciousActivity{
				ActivityType: "failed_login",
				Details:      `{"attempts": ` + string(rune(attempt.attempts)) + `}`,
				RiskLevel:    "high",
				SourceIP:     clientIP,
				CreatedAt:    now,
			}
			db.Create(&activity)
		}
	} else {
		attempts[clientIP] = &loginAttempt{
			attempts:  1,
			expiresAt: now.Add(15 * time.Minute),
		}
	}
}

func geoCheckMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func vpnCheckMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func recordDeviceFingerprint(userID uint, fingerprint string) {
	if fingerprint == "" {
		return
	}
	
	var device DeviceFingerprint
	now := time.Now()
	
	if err := db.Where("fingerprint = ?", fingerprint).First(&device).Error; err != nil {
		device = DeviceFingerprint{
			Fingerprint: fingerprint,
			UserID:      userID,
			FirstSeenAt: now,
			LastSeenAt:  now,
			LoginCount:  1,
		}
		db.Create(&device)
	} else {
		device.LastSeenAt = now
		device.LoginCount++
		if device.UserID != userID {
			activity := SuspiciousActivity{
				UserID:            &userID,
				ActivityType:      "device_sharing",
				Details:           `{"original_user": ` + string(rune(device.UserID)) + `}`,
				RiskLevel:         "medium",
				DeviceFingerprint: fingerprint,
				CreatedAt:         now,
			}
			db.Create(&activity)
		}
		db.Save(&device)
	}
}
