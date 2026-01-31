package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func licenseCheckMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		
		publicPaths := []string{
			"/api/license/pricing",
			"/api/license/validate",
			"/api/auth/login",
			"/api/auth/register",
			"/api/ads/system",
			"/ws",
			"/uploads",
		}
		
		for _, p := range publicPaths {
			if strings.HasPrefix(path, p) {
				c.Next()
				return
			}
		}
		
		c.Next()
	}
}

func requireLicenseMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		
		if userID == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		
		if !HasValidLicense(userID) {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Valid license required",
				"code":    "LICENSE_REQUIRED",
				"message": "Please activate a valid license to access this feature",
			})
			c.Abort()
			return
		}
		
		c.Next()
	}
}

func licenseStatusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		
		if userID > 0 {
			license, err := GetUserLicense(userID)
			if err == nil && !license.IsExpired() {
				c.Set("has_license", true)
				c.Set("license_expires", license.ExpiresAt)
				c.Set("show_ads", false)
			} else {
				c.Set("has_license", false)
				c.Set("show_ads", true)
			}
		} else {
			c.Set("has_license", false)
			c.Set("show_ads", true)
		}
		
		c.Next()
	}
}

func cleanupExpiredLicenses() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	
	for range ticker.C {
		db.Model(&UserLicense{}).
			Where("expires_at < ? AND is_active = ?", time.Now(), true).
			Update("is_active", false)
	}
}
