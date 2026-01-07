package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	redisClient *redis.Client
	ctx         = context.Background()
)

// InitRedis initializes the Redis client
func InitRedis() error {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")

	redisClient = redis.NewClient(&redis.Options{
		Addr:     redisURL,
		Password: redisPassword,
		DB:       0,
	})

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
	if redisClient == nil {
		return fmt.Errorf("Redis client not initialized")
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return redisClient.Set(ctx, key, data, expiration).Err()
}

// CacheGet gets a value from Redis cache
func CacheGet(key string, dest interface{}) error {
	if redisClient == nil {
		return fmt.Errorf("Redis client not initialized")
	}

	data, err := redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		return fmt.Errorf("key not found")
	}
	if err != nil {
		return err
	}

	return json.Unmarshal([]byte(data), dest)
}

// CloseRedis closes the Redis connection
func CloseRedis() error {
	if redisClient != nil {
		return redisClient.Close()
	}
	return nil
}
