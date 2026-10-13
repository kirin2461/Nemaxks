package main

import (
        "fmt"
        "net/http"
        "os"
        "strconv"

        "github.com/gin-gonic/gin"
)

// LiveKit Token Request
type LiveKitTokenRequest struct {
        RoomName  string `json:"room_name" binding:"required"`
        ChannelID string `json:"channel_id" binding:"required"`
}

// LiveKit Token Response
type LiveKitTokenResponse struct {
        Token string `json:"token"`
        URL   string `json:"url"`
}

// getLiveKitTokenHandler generates a LiveKit access token for a voice channel
func getLiveKitTokenHandler(c *gin.Context) {
        userIDRaw, exists := c.Get("user_id")
        if !exists {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        // Safely convert user_id from context (may be float64 from JWT)
        userID, err := extractUserID(userIDRaw)
        if err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID format"})
                return
        }

        var req LiveKitTokenRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
                return
        }

        // Get user info from database
        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        // Verify channel exists and get guild ID
        channelIDUint, err := strconv.ParseUint(req.ChannelID, 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelIDUint).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        // Verify channel type is voice
        if channel.Type != "voice" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Channel is not a voice channel"})
                return
        }

        // Check if user is member of the guild (mandatory access control)
        var guildMember GuildMember
        if err := db.Where("guild_id = ? AND user_id = ?", channel.GuildID, userID).First(&guildMember).Error; err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": "Not a member of this guild"})
                return
        }

        // Channel-level permission check (allow/deny per role or user)
        if !checkChannelVoicePermission(uint(channelIDUint), userID, channel.GuildID) {
                c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to join this voice channel"})
                return
        }

        roomName := fmt.Sprintf("voice-channel-%s", req.ChannelID)
        userIDStr := fmt.Sprintf("%d", userID)

        token, err := GenerateLiveKitToken(roomName, userIDStr, user.Username)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to generate token: %v", err)})
                return
        }

        // Add user to voice channel in Redis
        if err := AddUserToVoiceChannel(userIDStr, req.ChannelID); err != nil {
                // Log but don't fail
                fmt.Printf("Failed to add user to Redis voice channel: %v\n", err)
        }

        // Publish join event
        PublishVoiceEvent("join", map[string]interface{}{
                "user_id":    userIDStr,
                "channel_id": req.ChannelID,
                "username":   user.Username,
        })

        c.JSON(http.StatusOK, LiveKitTokenResponse{
                Token: token,
                // Клиентский URL может отличаться от внутреннего (docker-сеть):
                // LIVEKIT_PUBLIC_URL — то, что видит браузер.
                URL:   getEnv("LIVEKIT_PUBLIC_URL", getEnv("LIVEKIT_URL", "ws://localhost:7880")),
        })
}

// leaveLiveKitRoomHandler handles leaving a LiveKit room
func leaveLiveKitRoomHandler(c *gin.Context) {
        userIDRaw, exists := c.Get("user_id")
        if !exists {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        // Safely convert user_id from context
        userID, err := extractUserID(userIDRaw)
        if err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID format"})
                return
        }

        channelID := c.Param("channel_id")
        userIDStr := fmt.Sprintf("%d", userID)

        // Remove from Redis
        if err := RemoveUserFromVoiceChannel(userIDStr, channelID); err != nil {
                fmt.Printf("Failed to remove user from Redis voice channel: %v\n", err)
        }

        // Publish leave event
        PublishVoiceEvent("leave", map[string]interface{}{
                "user_id":    userIDStr,
                "channel_id": channelID,
        })

        c.JSON(http.StatusOK, gin.H{"success": true})
}

// getVoiceChannelParticipantsHandler gets participants from the voice roster
func getVoiceChannelParticipantsHandler(c *gin.Context) {
        channelID := c.Param("channel_id")

        participants := voiceRoster.GetParticipants(channelID)
        c.JSON(http.StatusOK, participants)
}

// extractUserID safely converts user_id from Gin context (may be float64 from JWT claims)
func extractUserID(raw interface{}) (uint, error) {
        switch v := raw.(type) {
        case float64:
                return uint(v), nil
        case uint:
                return v, nil
        case uint64:
                return uint(v), nil
        case int:
                return uint(v), nil
        case int64:
                return uint(v), nil
        case string:
                id, err := strconv.ParseUint(v, 10, 32)
                if err != nil {
                        return 0, err
                }
                return uint(id), nil
        default:
                return 0, fmt.Errorf("unexpected user_id type: %T", v)
        }
}

// getLiveKitStatusHandler returns LiveKit availability status
func getLiveKitStatusHandler(c *gin.Context) {
        if livekitClient == nil {
                c.JSON(http.StatusServiceUnavailable, gin.H{
                        "available": false,
                        "message":   "LiveKit not configured",
                })
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "available": true,
                "url":       getEnv("LIVEKIT_PUBLIC_URL", os.Getenv("LIVEKIT_URL")),
        })
}


// Helper function to get environment variable with default
func getEnv(key, defaultValue string) string {
        value := os.Getenv(key)
        if value == "" {
                return defaultValue
        }
        return value
}

// Permission bit flags for voice channels
const (
        PermissionVoiceConnect int64 = 1 << 20
)

// checkChannelVoicePermission checks if user has permission to join a voice channel
func checkChannelVoicePermission(channelID, userID, guildID uint) bool {
        // Check user-specific permission override first
        var userPerm ChannelPermission
        if err := db.Where("channel_id = ? AND user_id = ?", channelID, userID).First(&userPerm).Error; err == nil {
                // User has explicit deny
                if userPerm.Deny&PermissionVoiceConnect != 0 {
                        return false
                }
                // User has explicit allow
                if userPerm.Allow&PermissionVoiceConnect != 0 {
                        return true
                }
        }

        // Get user's roles in the guild
        var memberRoles []GuildMemberRole
        if err := db.Where("guild_id = ? AND user_id = ?", guildID, userID).Find(&memberRoles).Error; err != nil {
                return true // Default allow if no roles found
        }

        // Collect role IDs
        roleIDs := make([]uint, len(memberRoles))
        for i, mr := range memberRoles {
                roleIDs[i] = mr.RoleID
        }

        if len(roleIDs) == 0 {
                return true // Default allow if user has no roles
        }

        // Check role-based permissions (ordered by role position)
        var rolePerms []ChannelPermission
        if err := db.Where("channel_id = ? AND role_id IN ?", channelID, roleIDs).Find(&rolePerms).Error; err != nil {
                return true // Default allow if no role permissions set
        }

        // Calculate final permission from all roles
        var finalAllow, finalDeny int64
        for _, rp := range rolePerms {
                finalAllow |= rp.Allow
                finalDeny |= rp.Deny
        }

        // Deny takes precedence over allow
        if finalDeny&PermissionVoiceConnect != 0 && finalAllow&PermissionVoiceConnect == 0 {
                return false
        }

        return true // Default allow
}
