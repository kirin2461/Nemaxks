package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Permission Check Helpers

// hasGlobalRole checks if user is global admin or super_admin
func hasGlobalRole(userID uint, requiredRole string) bool {
	var assignment GlobalRoleAssignment
	if err := db.Where("user_id = ?", userID).First(&assignment).Error; err != nil {
		return false
	}
	
	if requiredRole == "admin" {
		return assignment.Role == "admin" || assignment.Role == "super_admin"
	}
	if requiredRole == "super_admin" {
		return assignment.Role == "super_admin"
	}
	return false
}

// calculateGuildPermissions computes total permissions for a user in a guild
func calculateGuildPermissions(userID, guildID uint) (int64, error) {
	// 1. Check if owner
	var guild Guild
	if err := db.First(&guild, guildID).Error; err != nil {
		return 0, err
	}
	if guild.OwnerID == userID {
		return PermAdministrator, nil // Owner has all permissions implicitly
	}

	// 2. Get user's roles in this guild
	var memberRoles []GuildMemberRole
	if err := db.Where("user_id = ? AND guild_id = ?", userID, guildID).Find(&memberRoles).Error; err != nil {
		return 0, err
	}

	var totalPerms int64 = 0
	
	// Always include @everyone role permissions (assumed RoleID=0 or special handling, simplified here to just assigned roles)
	for _, mr := range memberRoles {
		var role GuildRole
		if err := db.First(&role, mr.RoleID).Error; err == nil {
			totalPerms |= role.Permissions
		}
	}

	// 3. Admin override
	if (totalPerms & PermAdministrator) == PermAdministrator {
		return PermAdministrator, nil
	}

	return totalPerms, nil
}

// Middleware

// RequireGlobalAdmin ensures the user is an instance-level Admin or SuperAdmin
func RequireGlobalAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDRaw, exists := c.Get("user_id")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		userID, _ := extractUserID(userIDRaw)

		if !hasGlobalRole(userID, "admin") {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Global Admin access required"})
			return
		}
		c.Next()
	}
}

// RequireGlobalSuperAdmin ensures the user is an instance-level SuperAdmin
func RequireGlobalSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDRaw, exists := c.Get("user_id")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		userID, _ := extractUserID(userIDRaw)

		if !hasGlobalRole(userID, "super_admin") {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Global Super Admin access required"})
			return
		}
		c.Next()
	}
}

// RequireGuildPermission ensures user has specific permission in a guild
func RequireGuildPermission(perm int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDRaw, _ := c.Get("user_id")
		userID, _ := extractUserID(userIDRaw)
		
		guildIDStr := c.Param("guild_id")
		if guildIDStr == "" {
			// Try to get from channel if route uses channel_id
			channelIDStr := c.Param("channel_id")
			if channelIDStr != "" {
				cid, _ := strconv.ParseUint(channelIDStr, 10, 32)
				var channel Channel
				if db.First(&channel, cid).Error == nil {
					guildIDStr = strconv.FormatUint(uint64(channel.GuildID), 10)
				}
			}
		}

		if guildIDStr == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Context missing guild_id"})
			return
		}

		guildID, _ := strconv.ParseUint(guildIDStr, 10, 32)

		// Check global admin first (they have access everywhere)
		if hasGlobalRole(userID, "admin") {
			c.Next()
			return
		}

		userPerms, err := calculateGuildPermissions(userID, uint(guildID))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		if (userPerms & PermAdministrator) == PermAdministrator || (userPerms & perm) == perm {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
	}
}
