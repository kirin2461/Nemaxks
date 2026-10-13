package main

import (
        "context"
        "encoding/json"
        "fmt"
        "log"
        "os"
        "strings"
        "sync"
        "time"

        "github.com/redis/go-redis/v9"
)

var (
        redisClient *redis.Client
        ctx         = context.Background()
        memCache    = &inMemoryCache{items: make(map[string]cacheItem)}
)

// inMemoryCache is a simple fallback when Redis is unavailable
type cacheItem struct {
        data      []byte
        expiresAt time.Time
}

type inMemoryCache struct {
        mu    sync.RWMutex
        items map[string]cacheItem
}

func (c *inMemoryCache) Set(key string, data []byte, expiration time.Duration) {
        c.mu.Lock()
        defer c.mu.Unlock()
        c.items[key] = cacheItem{data: data, expiresAt: time.Now().Add(expiration)}
}

func (c *inMemoryCache) Get(key string) ([]byte, bool) {
        c.mu.RLock()
        defer c.mu.RUnlock()
        item, ok := c.items[key]
        if !ok || time.Now().After(item.expiresAt) {
                return nil, false
        }
        return item.data, true
}

func (c *inMemoryCache) Delete(key string) {
        c.mu.Lock()
        defer c.mu.Unlock()
        delete(c.items, key)
}

func (c *inMemoryCache) cleanup() {
        c.mu.Lock()
        defer c.mu.Unlock()
        now := time.Now()
        for k, v := range c.items {
                if now.After(v.expiresAt) {
                        delete(c.items, k)
                }
        }
}

func init() {
        go func() {
                ticker := time.NewTicker(5 * time.Minute)
                for range ticker.C {
                        memCache.cleanup()
                }
        }()
}

// InitRedis initializes the Redis client
func InitRedis() error {
        redisURL := os.Getenv("REDIS_URL")
        redisPassword := os.Getenv("REDIS_PASSWORD")

        var opts *redis.Options
        if strings.Contains(redisURL, "://") {
                // Полный URL вида redis://:password@host:6379/0
                parsed, err := redis.ParseURL(redisURL)
                if err != nil {
                        return fmt.Errorf("invalid REDIS_URL: %w", err)
                }
                opts = parsed
                if opts.Password == "" {
                        opts.Password = redisPassword
                }
        } else {
                // Простой host:port
                if redisURL == "" {
                        redisURL = "localhost:6379"
                }
                opts = &redis.Options{
                        Addr:     redisURL,
                        Password: redisPassword,
                        DB:       0,
                }
        }

        redisClient = redis.NewClient(opts)

        // Test connection
        _, err := redisClient.Ping(ctx).Result()
        if err != nil {
                return fmt.Errorf("failed to connect to Redis: %w", err)
        }

        log.Println("✓ Connected to Redis")
        return nil
}

// PresenceCacheEntry represents user online status cached in Redis.
//
// Note: the DB model is named UserPresence (see models_extended.go). This type is
// intentionally named differently to avoid a redeclaration in the same package.
type PresenceCacheEntry struct {
        UserID       string    `json:"user_id"`
        Username     string    `json:"username"`
        Status       string    `json:"status"` // online, away, offline
        LastSeen     time.Time `json:"last_seen"`
        VoiceChannel string    `json:"voice_channel,omitempty"`
}

// SetUserPresence sets user online status in Redis
func SetUserPresence(userID, username, status string) error {
        if redisClient == nil {
                return fmt.Errorf("Redis client not initialized")
        }

        presence := PresenceCacheEntry{
                UserID:   userID,
                Username: username,
                Status:   status,
                LastSeen: time.Now(),
        }

        data, err := json.Marshal(presence)
        if err != nil {
                return err
        }

        // Set with 5 minute expiry (will be refreshed by heartbeat)
        key := fmt.Sprintf("presence:%s", userID)
        return redisClient.Set(ctx, key, data, 5*time.Minute).Err()
}

// GetUserPresence gets user presence from Redis
func GetUserPresence(userID string) (*PresenceCacheEntry, error) {
        if redisClient == nil {
                return nil, fmt.Errorf("Redis client not initialized")
        }

        key := fmt.Sprintf("presence:%s", userID)
        data, err := redisClient.Get(ctx, key).Result()
        if err == redis.Nil {
                return nil, nil // User not found
        }
        if err != nil {
                return nil, err
        }

        var presence PresenceCacheEntry
        if err := json.Unmarshal([]byte(data), &presence); err != nil {
                return nil, err
        }

        return &presence, nil
}

// SetUserVoiceChannel sets user's current voice channel
func SetUserVoiceChannel(userID, channelID string) error {
        if redisClient == nil {
                return fmt.Errorf("Redis client not initialized")
        }

        key := fmt.Sprintf("voice:user:%s", userID)
        return redisClient.Set(ctx, key, channelID, 30*time.Minute).Err()
}

// GetVoiceChannelUsers gets all users in a voice channel
func GetVoiceChannelUsers(channelID string) ([]string, error) {
        if redisClient == nil {
                return nil, fmt.Errorf("Redis client not initialized")
        }

        key := fmt.Sprintf("voice:channel:%s", channelID)
        return redisClient.SMembers(ctx, key).Result()
}

// AddUserToVoiceChannel adds user to voice channel set
func AddUserToVoiceChannel(userID, channelID string) error {
        if redisClient == nil {
                return fmt.Errorf("Redis client not initialized")
        }

        // Add to channel members set
        channelKey := fmt.Sprintf("voice:channel:%s", channelID)
        if err := redisClient.SAdd(ctx, channelKey, userID).Err(); err != nil {
                return err
        }

        // Set expiry on channel
        redisClient.Expire(ctx, channelKey, 24*time.Hour)

        // Set user's current channel
        return SetUserVoiceChannel(userID, channelID)
}

// RemoveUserFromVoiceChannel removes user from voice channel
func RemoveUserFromVoiceChannel(userID, channelID string) error {
        if redisClient == nil {
                return fmt.Errorf("Redis client not initialized")
        }

        channelKey := fmt.Sprintf("voice:channel:%s", channelID)
        userKey := fmt.Sprintf("voice:user:%s", userID)

        // Remove from channel set
        if err := redisClient.SRem(ctx, channelKey, userID).Err(); err != nil {
                return err
        }

        // Delete user's channel key
        return redisClient.Del(ctx, userKey).Err()
}

// PublishVoiceEvent publishes voice event to Redis pub/sub
func PublishVoiceEvent(event string, data interface{}) error {
        if redisClient == nil {
                return fmt.Errorf("Redis client not initialized")
        }

        payload, err := json.Marshal(data)
        if err != nil {
                return err
        }

        channel := fmt.Sprintf("voice:events:%s", event)
        return redisClient.Publish(ctx, channel, payload).Err()
}

// CacheSet sets a value in Redis cache
func CacheSet(key string, value interface{}, expiration time.Duration) error {
        data, err := json.Marshal(value)
        if err != nil {
                return err
        }

        if redisClient != nil {
                if err := redisClient.Set(ctx, key, data, expiration).Err(); err == nil {
                        return nil
                }
        }
        // Fallback to in-memory cache
        memCache.Set(key, data, expiration)
        return nil
}

// CacheGet gets a value from Redis cache with in-memory fallback
func CacheGet(key string, dest interface{}) error {
        if redisClient != nil {
                data, err := redisClient.Get(ctx, key).Result()
                if err == nil {
                        return json.Unmarshal([]byte(data), dest)
                }
                if err != redis.Nil {
                        log.Printf("[Cache] Redis error, falling back to memory: %v", err)
                }
        }
        // Fallback to in-memory cache
        data, ok := memCache.Get(key)
        if !ok {
                return fmt.Errorf("key not found")
        }
        return json.Unmarshal(data, dest)
}

// CloseRedis closes the Redis connection
func CloseRedis() error {
        if redisClient != nil {
                return redisClient.Close()
        }
        return nil
}
