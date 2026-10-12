package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"
)

type LicenseType string

const (
	LicenseMonthly   LicenseType = "MONTHLY"
	LicenseQuarterly LicenseType = "QUARTERLY"
	LicenseYearly    LicenseType = "YEARLY"
)

type LicenseKey struct {
	ID           uint        `json:"id" gorm:"primaryKey"`
	Key          string      `json:"key" gorm:"size:25;uniqueIndex"`
	Type         LicenseType `json:"type" gorm:"size:20"`
	DurationDays int         `json:"duration_days"`
	PriceRUB     int         `json:"price_rub"`
	PriceUSD     float64     `json:"price_usd"`
	IsUsed       bool        `json:"is_used" gorm:"default:false"`
	UsedBy       *uint       `json:"used_by,omitempty"`
	UsedAt       *time.Time  `json:"used_at,omitempty"`
	ExpiresAt    *time.Time  `json:"expires_at,omitempty"`
	CreatedBy    uint        `json:"created_by"`
	CreatedAt    time.Time   `json:"created_at"`
	User         *User       `json:"user,omitempty" gorm:"foreignKey:UsedBy"`
}

type UserLicense struct {
	ID           uint        `json:"id" gorm:"primaryKey"`
	UserID       uint        `json:"user_id" gorm:"uniqueIndex"`
	LicenseKeyID uint        `json:"license_key_id"`
	Type         LicenseType `json:"type" gorm:"size:20"`
	ActivatedAt  time.Time   `json:"activated_at"`
	ExpiresAt    time.Time   `json:"expires_at"`
	IsActive     bool        `json:"is_active" gorm:"default:true"`
	KeyUsed      string      `json:"key_used" gorm:"size:50"`
	User         User        `json:"user,omitempty" gorm:"foreignKey:UserID"`
	LicenseKey   LicenseKey  `json:"license_key,omitempty" gorm:"foreignKey:LicenseKeyID"`
}

type AdRequestType string

const (
	AdTypePost   AdRequestType = "POST"
	AdTypeGuild  AdRequestType = "GUILD"
	AdTypeBanner AdRequestType = "BANNER"
)

type AdRequestStatus string

const (
	AdStatusPending  AdRequestStatus = "PENDING"
	AdStatusApproved AdRequestStatus = "APPROVED"
	AdStatusRejected AdRequestStatus = "REJECTED"
	AdStatusActive   AdRequestStatus = "ACTIVE"
	AdStatusExpired  AdRequestStatus = "EXPIRED"
)

type AdRequest struct {
	ID        uint            `json:"id" gorm:"primaryKey"`
	UserID    uint            `json:"user_id" gorm:"index"`
	Type      AdRequestType   `json:"type" gorm:"size:20"`
	Title     string          `json:"title" gorm:"size:100"`
	Content   string          `json:"content" gorm:"type:text"`
	TargetURL string          `json:"target_url" gorm:"size:500"`
	ImageURL  string          `json:"image_url" gorm:"size:500"`
	Status    AdRequestStatus `json:"status" gorm:"size:20;default:PENDING"`

	ReviewedBy *uint      `json:"reviewed_by,omitempty"`
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`
	ReviewNote string     `json:"review_note" gorm:"size:500"`

	PriceCoins   *int       `json:"price_coins,omitempty"`
	PriceRUB     *int       `json:"price_rub,omitempty"`
	DurationDays *int       `json:"duration_days,omitempty"`
	StartsAt     *time.Time `json:"starts_at,omitempty"`
	EndsAt       *time.Time `json:"ends_at,omitempty"`

	Impressions int `json:"impressions" gorm:"default:0"`
	Clicks      int `json:"clicks" gorm:"default:0"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User     User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Reviewer *User `json:"reviewer,omitempty" gorm:"foreignKey:ReviewedBy"`
}

type SystemAd struct {
	ID          uint       `json:"id" gorm:"primaryKey"`
	Title       string     `json:"title" gorm:"size:100"`
	Content     string     `json:"content" gorm:"type:text"`
	ImageURL    string     `json:"image_url" gorm:"size:500"`
	TargetURL   string     `json:"target_url" gorm:"size:500"`
	Type        string     `json:"type" gorm:"size:20"` // BANNER, NOTIFICATION, POPUP
	IsActive    bool       `json:"is_active" gorm:"default:true"`
	Priority    int        `json:"priority" gorm:"default:0"`
	StartsAt    *time.Time `json:"starts_at,omitempty"`
	EndsAt      *time.Time `json:"ends_at,omitempty"`
	Impressions int        `json:"impressions" gorm:"default:0"`
	Clicks      int        `json:"clicks" gorm:"default:0"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type LicensePricing struct {
	Type          LicenseType `json:"type"`
	DurationDays  int         `json:"duration_days"`
	PriceRUB      int         `json:"price_rub"`
	PriceUSD      float64     `json:"price_usd"`
	Label         string      `json:"label"`
	LabelRU       string      `json:"label_ru"`
	Description   string      `json:"description"`
	DescriptionRU string      `json:"description_ru"`
	Popular       bool        `json:"popular"`
}

var LicensePricingOptions = []LicensePricing{
	{
		Type:          LicenseMonthly,
		DurationDays:  30,
		PriceRUB:      50,
		PriceUSD:      1.00,
		Label:         "Monthly",
		LabelRU:       "Месячная",
		Description:   "30 days of full access",
		DescriptionRU: "30 дней полного доступа",
		Popular:       false,
	},
	{
		Type:          LicenseQuarterly,
		DurationDays:  90,
		PriceRUB:      125,
		PriceUSD:      1.50,
		Label:         "Quarterly",
		LabelRU:       "Квартальная",
		Description:   "90 days of full access",
		DescriptionRU: "90 дней полного доступа",
		Popular:       true,
	},
	{
		Type:          LicenseYearly,
		DurationDays:  365,
		PriceRUB:      500,
		PriceUSD:      7.00,
		Label:         "Yearly",
		LabelRU:       "Годовая",
		Description:   "365 days of full access",
		DescriptionRU: "365 дней полного доступа",
		Popular:       false,
	},
}

func GenerateLicenseKey() string {
	bytes := make([]byte, 15)
	rand.Read(bytes)
	hex := strings.ToUpper(hex.EncodeToString(bytes))

	parts := []string{
		"NEMKS",
		hex[0:5],
		hex[5:10],
		hex[10:15],
	}
	return strings.Join(parts, "-")
}

func GetLicensePricing(licenseType LicenseType) *LicensePricing {
	for _, p := range LicensePricingOptions {
		if p.Type == licenseType {
			return &p
		}
	}
	return nil
}

func (ul *UserLicense) IsExpired() bool {
	return time.Now().After(ul.ExpiresAt)
}

func (ul *UserLicense) DaysRemaining() int {
	if ul.IsExpired() {
		return 0
	}
	return int(time.Until(ul.ExpiresAt).Hours() / 24)
}

func initLicenseModels() {
	db.AutoMigrate(
		&LicenseKey{},
		&UserLicense{},
		&AdRequest{},
		&SystemAd{},
	)
}

func (lk *LicenseKey) BeforeCreate(tx *gorm.DB) error {
	if lk.Key == "" {
		lk.Key = GenerateLicenseKey()
	}

	pricing := GetLicensePricing(lk.Type)
	if pricing != nil {
		lk.DurationDays = pricing.DurationDays
		lk.PriceRUB = pricing.PriceRUB
		lk.PriceUSD = pricing.PriceUSD
	}

	return nil
}

func CreateLicenseKey(licenseType LicenseType, createdBy uint) (*LicenseKey, error) {
	key := &LicenseKey{
		Key:       GenerateLicenseKey(),
		Type:      licenseType,
		CreatedBy: createdBy,
	}

	if err := db.Create(key).Error; err != nil {
		return nil, err
	}

	return key, nil
}

// TestLicenseKey - пробный ключ (однократная активация, 25 дней Premium).
// SECURITY: публично известный ключ — в проде отключён. Активация/валидация
// возможны только при env ALLOW_TEST_LICENSE_KEY=true (дефолт: false).
const TestLicenseKey = "NEMKS-TEST0-TEST0-TEST0"

// IsTestLicenseKeyAllowed сообщает, разрешён ли тестовый ключ в этом окружении.
func IsTestLicenseKeyAllowed() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("ALLOW_TEST_LICENSE_KEY")), "true")
}

// Хранение использованных тестовых ключей
var testKeyUsed = make(map[string]bool)

func ActivateLicense(userID uint, key string) (*UserLicense, error) {
	// Пробный ключ - однократная активация для каждого пользователя
	if key == TestLicenseKey {
		if !IsTestLicenseKeyAllowed() {
			return nil, fmt.Errorf("invalid or already used license key")
		}
		now := time.Now()

		// Проверяем, использовал ли пользователь тестовый ключ ранее
		var checkLicense UserLicense
		if db.Where("user_id = ? AND key_used = ?", userID, TestLicenseKey).First(&checkLicense).Error == nil {
			// Лицензия от тестового ключа найдена
			if checkLicense.ExpiresAt.After(now) && checkLicense.IsActive {
				// Лицензия ещё активна - возвращаем её
				return &checkLicense, nil
			}
			// Лицензия истекла - ключ уже использован
			return nil, fmt.Errorf("Пробный ключ уже был использован вами")
		}

		expiresAt := now.AddDate(0, 0, 25) // 25 дней Premium

		// Проверяем существующую лицензию пользователя
		var existingLicense UserLicense
		if db.Where("user_id = ?", userID).First(&existingLicense).Error == nil {
			// Обновляем существующую лицензию
			existingLicense.Type = LicenseYearly
			existingLicense.ActivatedAt = now
			existingLicense.ExpiresAt = expiresAt
			existingLicense.IsActive = true
			existingLicense.KeyUsed = TestLicenseKey
			if err := db.Save(&existingLicense).Error; err != nil {
				return nil, err
			}
			return &existingLicense, nil
		}

		// Создаём новую лицензию
		userLicense := &UserLicense{
			UserID:      userID,
			Type:        LicenseYearly, // Premium тип
			ActivatedAt: now,
			ExpiresAt:   expiresAt,
			IsActive:    true,
			KeyUsed:     TestLicenseKey,
		}
		if err := db.Create(userLicense).Error; err != nil {
			return nil, err
		}

		return userLicense, nil
	}

	var licenseKey LicenseKey
	if err := db.Where("key = ? AND is_used = ?", key, false).First(&licenseKey).Error; err != nil {
		return nil, fmt.Errorf("invalid or already used license key")
	}

	var existingLicense UserLicense
	hasExisting := db.Where("user_id = ? AND expires_at > ?", userID, time.Now()).First(&existingLicense).Error == nil

	now := time.Now()
	expiresAt := now.AddDate(0, 0, licenseKey.DurationDays)

	if hasExisting && existingLicense.ExpiresAt.After(now) {
		expiresAt = existingLicense.ExpiresAt.AddDate(0, 0, licenseKey.DurationDays)
	}

	licenseKey.IsUsed = true
	licenseKey.UsedBy = &userID
	licenseKey.UsedAt = &now
	licenseKey.ExpiresAt = &expiresAt
	db.Save(&licenseKey)

	if hasExisting {
		existingLicense.ExpiresAt = expiresAt
		existingLicense.IsActive = true
		db.Save(&existingLicense)
		return &existingLicense, nil
	}

	userLicense := &UserLicense{
		UserID:       userID,
		LicenseKeyID: licenseKey.ID,
		Type:         licenseKey.Type,
		ActivatedAt:  now,
		ExpiresAt:    expiresAt,
		IsActive:     true,
	}

	if err := db.Create(userLicense).Error; err != nil {
		return nil, err
	}

	return userLicense, nil
}

func GetUserLicense(userID uint) (*UserLicense, error) {
	var license UserLicense
	err := db.Where("user_id = ?", userID).First(&license).Error
	if err != nil {
		return nil, err
	}
	return &license, nil
}

func HasValidLicense(userID uint) bool {
	var license UserLicense
	err := db.Where("user_id = ? AND is_active = ? AND expires_at > ?", userID, true, time.Now()).First(&license).Error
	return err == nil
}
