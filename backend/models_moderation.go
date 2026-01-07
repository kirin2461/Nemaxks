package main

import "time"

// Moderation Models

type GuildBan struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	GuildID   uint      `json:"guild_id" gorm:"index;not null"`
	UserID    uint      `json:"user_id" gorm:"index;not null"`
	BannedBy  uint      `json:"banned_by" gorm:"not null"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

type GlobalBan struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"uniqueIndex;not null"`
	BannedBy  uint      `json:"banned_by" gorm:"not null"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

type Mute struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	GuildID   uint      `json:"guild_id" gorm:"index;not null"` // 0 for global mute (if needed, though mostly guild)
	UserID    uint      `json:"user_id" gorm:"index;not null"`
	MutedBy   uint      `json:"muted_by" gorm:"not null"`
	Reason    string    `json:"reason"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type Shadowban struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	GuildID      uint      `json:"guild_id" gorm:"index;not null"` // 0 for global
	UserID       uint      `json:"user_id" gorm:"index;not null"`
	ShadowbannedBy uint    `json:"shadowbanned_by" gorm:"not null"`
	Reason       string    `json:"reason"`
	CreatedAt    time.Time `json:"created_at"`
}
