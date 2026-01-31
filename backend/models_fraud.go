package main

import (
	"time"

	"gorm.io/gorm"
)

type FraudAlert struct {
	ID              uint           `json:"id" gorm:"primaryKey"`
	UserID          uint           `json:"user_id" gorm:"index"`
	AlertType       string         `json:"alert_type" gorm:"size:50;index"` // spam, flood, phishing, impersonation, scam, suspicious
	Severity        string         `json:"severity" gorm:"size:20"`          // low, medium, high, critical
	Description     string         `json:"description" gorm:"size:1000"`
	Evidence        string         `json:"evidence" gorm:"type:text"`        // JSON with evidence details
	MessageID       *uint          `json:"message_id,omitempty"`
	ChannelID       *uint          `json:"channel_id,omitempty"`
	SourceIP        string         `json:"source_ip" gorm:"size:50"`
	DeviceFingerprint string       `json:"device_fingerprint" gorm:"size:100"`
	Status          string         `json:"status" gorm:"size:20;default:pending"` // pending, reviewed, dismissed, actioned
	ActionTaken     string         `json:"action_taken" gorm:"size:50"`           // none, warn, mute, ban, permaban
	ReviewedBy      *uint          `json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time     `json:"reviewed_at,omitempty"`
	ReviewNotes     string         `json:"review_notes" gorm:"size:500"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	User            User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type FraudRule struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"size:100;uniqueIndex"`
	Description string    `json:"description" gorm:"size:500"`
	RuleType    string    `json:"rule_type" gorm:"size:50"` // keyword, pattern, rate_limit, behavior
	Condition   string    `json:"condition" gorm:"type:text"` // JSON rule condition
	Action      string    `json:"action" gorm:"size:50"`     // alert, warn, mute, ban, permaban
	Severity    string    `json:"severity" gorm:"size:20"`   // low, medium, high, critical
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	Priority    int       `json:"priority" gorm:"default:0"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type UserRiskScore struct {
	ID               uint      `json:"id" gorm:"primaryKey"`
	UserID           uint      `json:"user_id" gorm:"uniqueIndex"`
	Score            float64   `json:"score" gorm:"default:0"`           // 0-100, higher = more risky
	SpamScore        float64   `json:"spam_score" gorm:"default:0"`
	PhishingScore    float64   `json:"phishing_score" gorm:"default:0"`
	ImpersonationScore float64 `json:"impersonation_score" gorm:"default:0"`
	ScamScore        float64   `json:"scam_score" gorm:"default:0"`
	BehaviorScore    float64   `json:"behavior_score" gorm:"default:0"`
	TotalAlerts      int       `json:"total_alerts" gorm:"default:0"`
	TotalWarnings    int       `json:"total_warnings" gorm:"default:0"`
	TotalMutes       int       `json:"total_mutes" gorm:"default:0"`
	TotalBans        int       `json:"total_bans" gorm:"default:0"`
	LastAlertAt      *time.Time `json:"last_alert_at,omitempty"`
	LastUpdated      time.Time `json:"last_updated"`
	User             User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type SuspiciousActivity struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	UserID        uint      `json:"user_id" gorm:"index"`
	ActivityType  string    `json:"activity_type" gorm:"size:50;index"` // message, dm, invite, login, registration
	Details       string    `json:"details" gorm:"type:text"`           // JSON with activity details
	RiskLevel     string    `json:"risk_level" gorm:"size:20"`          // low, medium, high
	SourceIP      string    `json:"source_ip" gorm:"size:50;index"`
	DeviceFingerprint string `json:"device_fingerprint" gorm:"size:100"`
	UserAgent     string    `json:"user_agent" gorm:"size:500"`
	GeoLocation   string    `json:"geo_location" gorm:"size:100"`
	CreatedAt     time.Time `json:"created_at"`
	User          User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type IPBlacklist struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	IPAddress string     `json:"ip_address" gorm:"size:50;uniqueIndex"`
	Reason    string     `json:"reason" gorm:"size:500"`
	Source    string     `json:"source" gorm:"size:50"` // manual, auto, external
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedBy uint       `json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
}

type DeviceFingerprint struct {
	ID             uint       `json:"id" gorm:"primaryKey"`
	Fingerprint    string     `json:"fingerprint" gorm:"size:100;uniqueIndex"`
	UserID         uint       `json:"user_id" gorm:"index"`
	IsBanned       bool       `json:"is_banned" gorm:"default:false"`
	BanReason      string     `json:"ban_reason" gorm:"size:500"`
	FirstSeenAt    time.Time  `json:"first_seen_at"`
	LastSeenAt     time.Time  `json:"last_seen_at"`
	LoginCount     int        `json:"login_count" gorm:"default:0"`
	User           User       `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type MessageRateLimit struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	UserID         uint      `json:"user_id" gorm:"index"`
	ChannelID      *uint     `json:"channel_id,omitempty"`
	MessageCount   int       `json:"message_count" gorm:"default:0"`
	WindowStart    time.Time `json:"window_start"`
	LastMessageAt  time.Time `json:"last_message_at"`
	IsMuted        bool      `json:"is_muted" gorm:"default:false"`
	MuteExpiresAt  *time.Time `json:"mute_expires_at,omitempty"`
}

type ImpersonationBan struct {
	ID                uint      `json:"id" gorm:"primaryKey"`
	UserID            uint      `json:"user_id" gorm:"index"`
	Username          string    `json:"username" gorm:"size:100"`
	DetectedKeywords  string    `json:"detected_keywords" gorm:"type:text"` // JSON array
	OriginalMessage   string    `json:"original_message" gorm:"type:text"`
	NormalizedMessage string    `json:"normalized_message" gorm:"type:text"`
	SourceIP          string    `json:"source_ip" gorm:"size:50"`
	DeviceFingerprint string    `json:"device_fingerprint" gorm:"size:100"`
	BannedAt          time.Time `json:"banned_at"`
	BannedBy          string    `json:"banned_by" gorm:"size:50"` // system or admin username
	User              User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type FraudStats struct {
	TotalAlerts         int64   `json:"total_alerts"`
	PendingAlerts       int64   `json:"pending_alerts"`
	AlertsToday         int64   `json:"alerts_today"`
	ImpersonationBans   int64   `json:"impersonation_bans"`
	BlockedIPs          int64   `json:"blocked_ips"`
	BannedDevices       int64   `json:"banned_devices"`
	HighRiskUsers       int64   `json:"high_risk_users"`
	AverageRiskScore    float64 `json:"average_risk_score"`
}

func initFraudModels() {
	db.AutoMigrate(
		&FraudAlert{},
		&FraudRule{},
		&UserRiskScore{},
		&SuspiciousActivity{},
		&IPBlacklist{},
		&DeviceFingerprint{},
		&MessageRateLimit{},
		&ImpersonationBan{},
	)
	
	seedDefaultFraudRules()
}

func seedDefaultFraudRules() {
	var count int64
	db.Model(&FraudRule{}).Count(&count)
	if count > 0 {
		return
	}
	
	rules := []FraudRule{
		{
			Name:        "spam_detection",
			Description: "Detect repeated messages in short time",
			RuleType:    "rate_limit",
			Condition:   `{"max_identical_messages": 10, "window_seconds": 60}`,
			Action:      "mute",
			Severity:    "medium",
			Priority:    10,
		},
		{
			Name:        "flood_detection",
			Description: "Detect message flooding",
			RuleType:    "rate_limit",
			Condition:   `{"max_messages": 50, "window_seconds": 300}`,
			Action:      "mute",
			Severity:    "medium",
			Priority:    10,
		},
		{
			Name:        "mass_dm_detection",
			Description: "Detect mass DM sending",
			RuleType:    "rate_limit",
			Condition:   `{"max_unique_recipients": 20, "window_seconds": 3600}`,
			Action:      "ban",
			Severity:    "high",
			Priority:    20,
		},
		{
			Name:        "impersonation_permaban",
			Description: "Permanent ban for impersonating law enforcement",
			RuleType:    "keyword",
			Condition:   `{"type": "impersonation", "action": "permaban"}`,
			Action:      "permaban",
			Severity:    "critical",
			Priority:    100,
		},
		{
			Name:        "phishing_detection",
			Description: "Detect phishing links",
			RuleType:    "pattern",
			Condition:   `{"check_domains": true, "check_patterns": true}`,
			Action:      "ban",
			Severity:    "high",
			Priority:    30,
		},
		{
			Name:        "scam_detection",
			Description: "Detect common scam patterns",
			RuleType:    "keyword",
			Condition:   `{"keywords": "scam", "fuzzy_match": true}`,
			Action:      "warn",
			Severity:    "medium",
			Priority:    15,
		},
	}
	
	for _, rule := range rules {
		db.Create(&rule)
	}
}

func (u *UserRiskScore) BeforeSave(tx *gorm.DB) error {
	u.Score = (u.SpamScore + u.PhishingScore + u.ImpersonationScore + u.ScamScore + u.BehaviorScore) / 5
	u.LastUpdated = time.Now()
	return nil
}
