package main

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// PremiumInfo — компактное описание premium-статуса пользователя.
// Используется в ответе /api/auth/me (поле premium).
type PremiumInfo struct {
	Active    bool       `json:"active"`
	PlanName  string     `json:"plan_name"`
	Tier      string     `json:"tier"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// premiumStatusCacheTTL — время жизни кэша HasPremium в Redis.
const premiumStatusCacheTTL = 60 * time.Second

func premiumStatusCacheKey(userID uint) string {
	return fmt.Sprintf("premium:status:%d", userID)
}

// hasPremiumFromDB — прямая проверка premium в БД без кэша.
// Premium считается активным, если есть PremiumSubscription со status="active"
// и неистёкшим current_period_end, либо активный UserPremium
// (та же логика, что в getUserPremiumHandler).
func hasPremiumFromDB(userID uint) bool {
	if db == nil {
		return false
	}
	now := time.Now()

	var sub PremiumSubscription
	if db.Where("user_id = ? AND status = ? AND current_period_end > ?", userID, "active", now).
		First(&sub).Error == nil {
		return true
	}

	var userPremium UserPremium
	if db.Where("user_id = ? AND status = ? AND current_period_end > ?", userID, "active", now).
		First(&userPremium).Error == nil {
		return true
	}

	return false
}

// HasPremium — true, если у пользователя активная premium-подписка.
// Результат кэшируется в Redis на 60 секунд; при недоступном Redis
// работает напрямую через БД.
func HasPremium(userID uint) bool {
	if redisClient != nil {
		if cached, err := redisClient.Get(ctx, premiumStatusCacheKey(userID)).Result(); err == nil {
			return cached == "1"
		}
	}

	active := hasPremiumFromDB(userID)

	if redisClient != nil {
		value := "0"
		if active {
			value = "1"
		}
		if err := redisClient.Set(ctx, premiumStatusCacheKey(userID), value, premiumStatusCacheTTL).Err(); err != nil {
			// Кэш не критичен — просто логируем и работаем дальше.
			fmt.Printf("[Premium] failed to cache premium status for user %d: %v\n", userID, err)
		}
	}

	return active
}

// InvalidatePremiumCache сбрасывает кэш premium-статуса пользователя.
// Вызывать после активации/отмены подписки.
func InvalidatePremiumCache(userID uint) {
	if redisClient == nil {
		return
	}
	redisClient.Del(ctx, premiumStatusCacheKey(userID))
}

// getPremiumInfoStruct — детали premium-подписки из БД.
// Для неактивного premium возвращает структуру с Active=false.
func getPremiumInfoStruct(userID uint) *PremiumInfo {
	info := &PremiumInfo{Active: false}
	if db == nil {
		return info
	}

	info.Active = HasPremium(userID)
	if !info.Active {
		return info
	}

	now := time.Now()

	var sub PremiumSubscription
	if db.Preload("Plan").Where("user_id = ? AND status = ? AND current_period_end > ?", userID, "active", now).
		Order("current_period_end DESC").First(&sub).Error == nil {
		info.PlanName = sub.Plan.Name
		info.Tier = sub.Plan.Tier
		expiresAt := sub.CurrentPeriodEnd
		info.ExpiresAt = &expiresAt
		return info
	}

	var userPremium UserPremium
	if db.Preload("Plan").Where("user_id = ? AND status = ? AND current_period_end > ?", userID, "active", now).
		First(&userPremium).Error == nil {
		info.PlanName = userPremium.Plan.Name
		info.Tier = userPremium.Plan.Tier
		expiresAt := userPremium.CurrentPeriodEnd
		info.ExpiresAt = &expiresAt
	}

	return info
}

// GetUserPremiumInfo — premium-статус пользователя для API-ответов:
// {active bool, plan_name string, tier string, expires_at *time.Time}.
func GetUserPremiumInfo(userID uint) gin.H {
	info := getPremiumInfoStruct(userID)
	return gin.H{
		"active":     info.Active,
		"plan_name":  info.PlanName,
		"tier":       info.Tier,
		"expires_at": info.ExpiresAt,
	}
}
