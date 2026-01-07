package main

import "time"

// DMAccessSanction represents a temporary approval for an Admin to read a User's DMs
type DMAccessSanction struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	RequestedBy uint      `json:"requested_by" gorm:"index;not null"` // Admin
	ApprovedBy  *uint     `json:"approved_by"`                        // SuperAdmin
	TargetUserID uint     `json:"target_user_id" gorm:"index;not null"`
	Reason      string    `json:"reason" gorm:"not null"`
	Status      string    `json:"status" gorm:"default:'pending'"` // pending, approved, rejected, revoked, expired
	ExpiresAt   *time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
