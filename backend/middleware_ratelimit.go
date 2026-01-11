package main

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter stores request counts per IP
type RateLimiter struct {
	requests map[string]*requestInfo
	mu       sync.RWMutex
	limit    int
	window   time.Duration
}

type requestInfo struct {
	count     int
	firstSeen time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string]*requestInfo),
		limit:    limit,
		window:   window,
	}

	// Start cleanup goroutine
	go rl.cleanup()

	return rl
}

// cleanup removes expired entries periodically
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, info := range rl.requests {
			if now.Sub(info.firstSeen) > rl.window {
				delete(rl.requests, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if a request from the given IP is allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	info, exists := rl.requests[ip]

	if !exists || now.Sub(info.firstSeen) > rl.window {
		// New window
		rl.requests[ip] = &requestInfo{
			count:     1,
			firstSeen: now,
		}
		return true
	}

	if info.count >= rl.limit {
		return false
	}

	info.count++
	return true
}

// GetRemainingTime returns the time until the rate limit resets
func (rl *RateLimiter) GetRemainingTime(ip string) time.Duration {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	info, exists := rl.requests[ip]
	if !exists {
		return 0
	}

	elapsed := time.Since(info.firstSeen)
	if elapsed > rl.window {
		return 0
	}

	return rl.window - elapsed
}

// Global rate limiters
var (
	// Auth rate limiter: 10 requests per minute per IP
	authRateLimiter = NewRateLimiter(10, time.Minute)

	// General API rate limiter: 100 requests per minute per IP
	apiRateLimiter = NewRateLimiter(100, time.Minute)
)

// RateLimitMiddleware creates a rate limiting middleware
func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		if !limiter.Allow(ip) {
			remaining := limiter.GetRemainingTime(ip)
			c.Header("Retry-After", remaining.String())
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many requests",
				"retry_after": remaining.Seconds(),
			})
			return
		}

		c.Next()
	}
}

// AuthRateLimitMiddleware is a convenience function for auth endpoints
func AuthRateLimitMiddleware() gin.HandlerFunc {
	return RateLimitMiddleware(authRateLimiter)
}

// APIRateLimitMiddleware is a convenience function for general API endpoints
func APIRateLimitMiddleware() gin.HandlerFunc {
	return RateLimitMiddleware(apiRateLimiter)
}
