package main

import (
        "time"
)

// Permissions Bitmask
const (
        PermViewChannels = 1 << 0
        PermSendMessages = 1 << 1
        PermManageMessages = 1 << 2 // Delete/Pin
        PermManageRoles    = 1 << 3
        PermKickMembers    = 1 << 4
        PermBanMembers     = 1 << 5
        PermManageChannels = 1 << 6
        PermManageGuild    = 1 << 7
        PermAdministrator  = 1 << 8 // Bypasses all channel overwrites
)

// Global Roles (Instance level)
// Admin: Global judge, can moderate any guild, see reports
// SuperAdmin: Can manage admins, sensitive data access
type GlobalRoleAssignment struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        UserID    uint      `json:"user_id" gorm:"uniqueIndex;not null"`
        Role      string    `json:"role" gorm:"not null"` // "admin" or "super_admin"
        AssignedBy uint     `json:"assigned_by"`
        CreatedAt time.Time `json:"created_at"`
}
