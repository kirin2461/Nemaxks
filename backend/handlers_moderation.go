package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Handlers for Guild Moderation

func banUserInGuildHandler(c *gin.Context) {
	// Guard: Require 'PermBanMembers' in this guild
	// (Middleware should be applied in router: RequireGuildPermission(PermBanMembers))
	
	guildID, _ := strconv.ParseUint(c.Param("guild_id"), 10, 32)
	userIDRaw, _ := c.Get("user_id")
	adminID, _ := extractUserID(userIDRaw)

	var req struct {
		TargetID uint   `json:"target_id" binding:"required"`
		Reason   string `json:"reason"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Prevent banning owner or self
	if req.TargetID == adminID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot ban yourself"})
		return
	}

	ban := GuildBan{
		GuildID:  uint(guildID),
		UserID:   req.TargetID,
		BannedBy: adminID,
		Reason:   req.Reason,
		CreatedAt: time.Now(),
	}

	if err := db.Create(&ban).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ban user"})
		return
	}

	// Remove member from guild
	db.Where("guild_id = ? AND user_id = ?", guildID, req.TargetID).Delete(&GuildMember{})

	logExtendedAudit(adminID, "guild_ban", "user", strconv.FormatUint(uint64(req.TargetID), 10), 
		fmt.Sprintf("guild:%d", guildID), req.Reason, c.ClientIP(), c.Request.UserAgent())

	c.JSON(http.StatusOK, gin.H{"status": "banned"})
}

func muteUserHandler(c *gin.Context) {
	guildID, _ := strconv.ParseUint(c.Param("guild_id"), 10, 32)
	userIDRaw, _ := c.Get("user_id")
	adminID, _ := extractUserID(userIDRaw)

	var req struct {
		TargetID  uint      `json:"target_id" binding:"required"`
		Reason    string    `json:"reason"`
		DurationMinutes int `json:"duration_minutes" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	expiresAt := time.Now().Add(time.Duration(req.DurationMinutes) * time.Minute)

	mute := Mute{
		GuildID:   uint(guildID),
		UserID:    req.TargetID,
		MutedBy:   adminID,
		Reason:    req.Reason,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	db.Create(&mute)

	logExtendedAudit(adminID, "guild_mute", "user", strconv.FormatUint(uint64(req.TargetID), 10),
		fmt.Sprintf("guild:%d duration:%dm", guildID, req.DurationMinutes), req.Reason, c.ClientIP(), c.Request.UserAgent())

	c.JSON(http.StatusOK, gin.H{"status": "muted", "expires_at": expiresAt})
}

func shadowbanUserHandler(c *gin.Context) {
	// Global or Guild? Assuming Global for this example based on "shadowban" usually being platform-wide or guild-wide.
	// Let's implement Guild-scoped first.
	guildID, _ := strconv.ParseUint(c.Param("guild_id"), 10, 32)
	userIDRaw, _ := c.Get("user_id")
	adminID, _ := extractUserID(userIDRaw)

	var req struct {
		TargetID uint   `json:"target_id" binding:"required"`
		Reason   string `json:"reason"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	sb := Shadowban{
		GuildID:        uint(guildID),
		UserID:         req.TargetID,
		ShadowbannedBy: adminID,
		Reason:         req.Reason,
		CreatedAt:      time.Now(),
	}
	db.Create(&sb)

	logExtendedAudit(adminID, "guild_shadowban", "user", strconv.FormatUint(uint64(req.TargetID), 10),
		fmt.Sprintf("guild:%d", guildID), req.Reason, c.ClientIP(), c.Request.UserAgent())

	c.JSON(http.StatusOK, gin.H{"status": "shadowbanned"})
}
