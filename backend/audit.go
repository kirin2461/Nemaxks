package main

import (
        "fmt"
        "time"
)

type ExtendedAuditLog struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        UserID    uint      `json:"user_id" gorm:"index"`
        Action    string    `json:"action" gorm:"index"`
        TargetType string   `json:"target_type"` // user, message, guild, sanction
        TargetID   string   `json:"target_id"`
        Scope      string   `json:"scope"`       // guild:123, global, dm
        Details    string   `json:"details"`
        IPAddress  string   `json:"ip_address"`
        UserAgent  string   `json:"user_agent"`
        CreatedAt  time.Time `json:"created_at"`
}

// logExtendedAudit writes to the audit log table
func logExtendedAudit(userID uint, action, targetType, targetID, scope, details, ip, ua string) {
        entry := ExtendedAuditLog{
                UserID:     userID,
                Action:     action,
                TargetType: targetType,
                TargetID:   targetID,
                Scope:      scope,
                Details:    details,
                IPAddress:  ip,
                UserAgent:  ua,
                CreatedAt:  time.Now(),
        }
        go func() {
                if err := db.Create(&entry).Error; err != nil {
                        fmt.Printf("[Audit] Failed to write audit log: %v (action=%s target=%s:%s)\n", err, action, targetType, targetID)
                }
        }()
}

// CleanupOldAuditLogs removes logs older than 45 days
func CleanupOldAuditLogs() {
        cutoff := time.Now().AddDate(0, 0, -45)
        db.Where("created_at < ?", cutoff).Delete(&ExtendedAuditLog{})
}

// CaptureSiteSnapshot records metrics (can be called by cron)
func CaptureSiteSnapshot() {
        var users, guilds, messages int64
        db.Model(&User{}).Count(&users)
        db.Model(&Guild{}).Count(&guilds)
        db.Model(&Message{}).Count(&messages)

        // Log as a special system action
        logExtendedAudit(0, "system_snapshot", "site", "global", "global", 
                fmt.Sprintf("users:%d guilds:%d messages:%d", users, guilds, messages), "system", "internal_cron")
}
