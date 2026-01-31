package main

import (
        "crypto/rand"
        "encoding/hex"
        "fmt"
        "net/http"
        "os"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
        "golang.org/x/crypto/bcrypt"
)

func superAdminMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                userID, exists := c.Get("user_id")
                if !exists {
                        c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                        c.Abort()
                        return
                }

                var user User
                if err := db.First(&user, userID).Error; err != nil {
                        c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
                        c.Abort()
                        return
                }

                if user.Role != "super_admin" {
                        c.JSON(http.StatusForbidden, gin.H{"error": "Super admin access required"})
                        c.Abort()
                        return
                }

                c.Set("super_admin_id", user.ID)
                c.Next()
        }
}

func getSuperAdminStatsHandler(c *gin.Context) {
        var userCount, postCount, messageCount, guildCount, channelCount, storyCount int64
        db.Model(&User{}).Count(&userCount)
        db.Model(&Post{}).Count(&postCount)
        db.Model(&DirectMessage{}).Count(&messageCount)
        db.Model(&Guild{}).Count(&guildCount)
        db.Model(&Channel{}).Count(&channelCount)
        db.Model(&Story{}).Count(&storyCount)

        var onlineCount int64
        db.Model(&UserPresence{}).Where("status = ? AND updated_at > ?", "online", time.Now().Add(-5*time.Minute)).Count(&onlineCount)

        var banCount int64
        db.Model(&Ban{}).Count(&banCount)

        var pendingReports int64
        db.Model(&AbuseReport{}).Where("status = ?", "pending").Count(&pendingReports)

        var todayMessages int64
        today := time.Now().Truncate(24 * time.Hour)
        db.Model(&DirectMessage{}).Where("created_at >= ?", today).Count(&todayMessages)

        var todayNewUsers int64
        db.Model(&User{}).Where("created_at >= ?", today).Count(&todayNewUsers)

        var activeSessionCount int64
        db.Model(&UserSession{}).Where("is_active = ? AND expires_at > ?", true, time.Now()).Count(&activeSessionCount)

        c.JSON(http.StatusOK, gin.H{
                "users":             userCount,
                "posts":             postCount,
                "messages":          messageCount,
                "guilds":            guildCount,
                "channels":          channelCount,
                "stories":           storyCount,
                "online_users":      onlineCount,
                "active_bans":       banCount,
                "pending_reports":   pendingReports,
                "today_messages":    todayMessages,
                "today_new_users":   todayNewUsers,
                "active_sessions":   activeSessionCount,
        })
}

func getSuperAdminUsersHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset := (page - 1) * limit

        search := c.Query("search")
        role := c.Query("role")
        status := c.Query("status")

        query := db.Model(&User{})

        if search != "" {
                query = query.Where("username ILIKE ? OR email ILIKE ?", "%"+search+"%", "%"+search+"%")
        }
        if role != "" {
                query = query.Where("role = ?", role)
        }
        if status == "banned" {
                query = query.Joins("JOIN bans ON bans.user_id = users.id")
        } else if status == "active" {
                query = query.Where("id NOT IN (SELECT user_id FROM bans)")
        }

        var total int64
        query.Count(&total)

        var users []User
        query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users)

        type UserWithStatus struct {
                User
                IsBanned bool `json:"is_banned"`
                Has2FA   bool `json:"has_2fa"`
        }

        var usersWithStatus []UserWithStatus
        for _, u := range users {
                var banCount int64
                db.Model(&Ban{}).Where("user_id = ?", u.ID).Count(&banCount)

                var twoFACount int64
                db.Model(&TwoFactorAuth{}).Where("user_id = ? AND is_enabled = ?", u.ID, true).Count(&twoFACount)

                usersWithStatus = append(usersWithStatus, UserWithStatus{
                        User:     u,
                        IsBanned: banCount > 0,
                        Has2FA:   twoFACount > 0,
                })
        }

        c.JSON(http.StatusOK, gin.H{
                "users": usersWithStatus,
                "total": total,
                "page":  page,
                "limit": limit,
        })
}

func getUserDetailHandler(c *gin.Context) {
        userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        var banCount, postCount, messageCount, guildCount int64
        db.Model(&Ban{}).Where("user_id = ?", userID).Count(&banCount)
        db.Model(&Post{}).Where("author_id = ?", userID).Count(&postCount)
        db.Model(&DirectMessage{}).Where("sender_id = ?", userID).Count(&messageCount)
        db.Model(&GuildMember{}).Where("user_id = ?", userID).Count(&guildCount)

        var has2FA bool
        var twoFACount int64
        db.Model(&TwoFactorAuth{}).Where("user_id = ? AND is_enabled = ?", userID, true).Count(&twoFACount)
        has2FA = twoFACount > 0

        var sessions []UserSession
        db.Where("user_id = ? AND is_active = ?", userID, true).Order("last_activity DESC").Limit(10).Find(&sessions)

        var recentBans []BanHistory
        db.Where("user_id = ?", userID).Order("created_at DESC").Limit(5).Find(&recentBans)

        c.JSON(http.StatusOK, gin.H{
                "user":       user,
                "is_banned":  banCount > 0,
                "has_2fa":    has2FA,
                "stats": gin.H{
                        "posts":    postCount,
                        "messages": messageCount,
                        "guilds":   guildCount,
                },
                "sessions":    sessions,
                "ban_history": recentBans,
        })
}

func getUserSessionsHandler(c *gin.Context) {
        userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var sessions []UserSession
        db.Where("user_id = ?", userID).Order("last_activity DESC").Find(&sessions)

        c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func revokeUserSessionHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        sessionID := c.Param("session_id")

        result := db.Model(&UserSession{}).
                Where("user_id = ? AND id = ?", userID, sessionID).
                Update("is_active", false)

        if result.RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
                return
        }

        logAudit(adminID.(uint), "revoke_session", "user_session", sessionID, c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"message": "Session revoked"})
}

func revokeAllUserSessionsHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        db.Model(&UserSession{}).Where("user_id = ?", userID).Update("is_active", false)
        db.Where("user_id = ?", userID).Delete(&RefreshToken{})

        logAudit(adminID.(uint), "revoke_all_sessions", "user", strconv.FormatUint(userID, 10), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"message": "All sessions revoked"})
}

func resetUserPasswordHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        bytes := make([]byte, 8)
        rand.Read(bytes)
        tempPassword := hex.EncodeToString(bytes)

        hashedPassword, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
                return
        }

        user.Password = string(hashedPassword)
        db.Save(&user)

        db.Model(&UserSession{}).Where("user_id = ?", userID).Update("is_active", false)
        db.Where("user_id = ?", userID).Delete(&RefreshToken{})

        logAudit(adminID.(uint), "reset_password", "user", strconv.FormatUint(userID, 10), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{
                "message":        "Password reset successfully",
                "temp_password":  tempPassword,
                "sessions_reset": true,
        })
}

func changeUserRoleHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var req struct {
                Role string `json:"role" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        validRoles := map[string]bool{"user": true, "moderator": true, "admin": true, "super_admin": true}
        if !validRoles[req.Role] {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
                return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        oldRole := user.Role
        user.Role = req.Role
        db.Save(&user)

        logAudit(adminID.(uint), "change_role", "user", fmt.Sprintf("%d: %s -> %s", userID, oldRole, req.Role), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{
                "message":  "Role changed successfully",
                "old_role": oldRole,
                "new_role": req.Role,
        })
}

func getSuperAdminGuildsHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset := (page - 1) * limit
        search := c.Query("search")

        query := db.Model(&Guild{})
        if search != "" {
                query = query.Where("name ILIKE ?", "%"+search+"%")
        }

        var total int64
        query.Count(&total)

        var guilds []Guild
        query.Preload("Owner").Offset(offset).Limit(limit).Order("created_at DESC").Find(&guilds)

        type GuildWithStats struct {
                Guild
                MemberCount  int64 `json:"member_count"`
                ChannelCount int64 `json:"channel_count"`
                MessageCount int64 `json:"message_count"`
        }

        var guildsWithStats []GuildWithStats
        for _, g := range guilds {
                var memberCount, channelCount, messageCount int64
                db.Model(&GuildMember{}).Where("guild_id = ?", g.ID).Count(&memberCount)
                db.Model(&Channel{}).Where("guild_id = ?", g.ID).Count(&channelCount)
                db.Model(&Message{}).Joins("JOIN channels ON channels.id = messages.channel_id").Where("channels.guild_id = ?", g.ID).Count(&messageCount)

                guildsWithStats = append(guildsWithStats, GuildWithStats{
                        Guild:        g,
                        MemberCount:  memberCount,
                        ChannelCount: channelCount,
                        MessageCount: messageCount,
                })
        }

        c.JSON(http.StatusOK, gin.H{
                "guilds": guildsWithStats,
                "total":  total,
                "page":   page,
                "limit":  limit,
        })
}

func getGuildDetailHandler(c *gin.Context) {
        guildID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var guild Guild
        if err := db.Preload("Owner").First(&guild, guildID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        var memberCount, channelCount, messageCount int64
        db.Model(&GuildMember{}).Where("guild_id = ?", guildID).Count(&memberCount)
        db.Model(&Channel{}).Where("guild_id = ?", guildID).Count(&channelCount)
        db.Model(&Message{}).Joins("JOIN channels ON channels.id = channel_messages.channel_id").Where("channels.guild_id = ?", guildID).Count(&messageCount)

        var channels []Channel
        db.Where("guild_id = ?", guildID).Find(&channels)

        var recentMembers []GuildMember
        db.Where("guild_id = ?", guildID).Preload("User").Order("joined_at DESC").Limit(10).Find(&recentMembers)

        c.JSON(http.StatusOK, gin.H{
                "guild": guild,
                "stats": gin.H{
                        "members":  memberCount,
                        "channels": channelCount,
                        "messages": messageCount,
                },
                "channels":       channels,
                "recent_members": recentMembers,
        })
}

func transferGuildOwnershipHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        guildID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var req struct {
                NewOwnerID uint `json:"new_owner_id" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var guild Guild
        if err := db.First(&guild, guildID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        var newOwner User
        if err := db.First(&newOwner, req.NewOwnerID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "New owner not found"})
                return
        }

        oldOwnerID := guild.OwnerID
        guild.OwnerID = req.NewOwnerID
        db.Save(&guild)

        var existingMembership GuildMember
        if err := db.Where("guild_id = ? AND user_id = ?", guildID, req.NewOwnerID).First(&existingMembership).Error; err != nil {
                db.Create(&GuildMember{
                        GuildID:  uint(guildID),
                        UserID:   req.NewOwnerID,
                        JoinedAt: time.Now(),
                })
        }

        logAudit(adminID.(uint), "transfer_guild", "guild", fmt.Sprintf("%d: owner %d -> %d", guildID, oldOwnerID, req.NewOwnerID), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{
                "message":       "Guild ownership transferred",
                "old_owner_id":  oldOwnerID,
                "new_owner_id":  req.NewOwnerID,
        })
}

func deleteGuildHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        guildID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var guild Guild
        if err := db.First(&guild, guildID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        guildName := guild.Name

        db.Where("channel_id IN (SELECT id FROM channels WHERE guild_id = ?)", guildID).Delete(&Message{})
        db.Where("guild_id = ?", guildID).Delete(&Channel{})
        db.Where("guild_id = ?", guildID).Delete(&GuildMember{})
        db.Delete(&guild)

        logAudit(adminID.(uint), "delete_guild", "guild", fmt.Sprintf("%d: %s", guildID, guildName), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"message": "Guild deleted successfully"})
}

func getSecurityLogsHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
        offset := (page - 1) * limit
        eventType := c.Query("event_type")

        query := db.Model(&AuditLog{})

        if eventType != "" {
                query = query.Where("action = ?", eventType)
        }

        var total int64
        query.Count(&total)

        var logs []AuditLog
        query.Preload("User").Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs)

        c.JSON(http.StatusOK, gin.H{
                "logs":  logs,
                "total": total,
                "page":  page,
                "limit": limit,
        })
}

func getFailedLoginsHandler(c *gin.Context) {
        var logs []AuditLog
        db.Where("action = ?", "login_failed").
                Order("created_at DESC").
                Limit(100).
                Find(&logs)

        c.JSON(http.StatusOK, gin.H{"logs": logs})
}

func getServiceStatusHandler(c *gin.Context) {
        redisStatus := "disconnected"
        if redisClient != nil {
                if err := redisClient.Ping(ctx).Err(); err == nil {
                        redisStatus = "connected"
                }
        }

        dbStatus := "disconnected"
        sqlDB, err := db.DB()
        if err == nil {
                if err := sqlDB.Ping(); err == nil {
                        dbStatus = "connected"
                }
        }

        livekitStatus := "not_configured"
        if os.Getenv("LIVEKIT_API_KEY") != "" {
                livekitStatus = "configured"
        }

        c.JSON(http.StatusOK, gin.H{
                "services": gin.H{
                        "database":  dbStatus,
                        "redis":     redisStatus,
                        "livekit":   livekitStatus,
                },
                "timestamp": time.Now(),
        })
}

func getJarvisStatsHandler(c *gin.Context) {
        var totalRequests int64
        db.Model(&JarvisSession{}).Count(&totalRequests)

        var todayRequests int64
        today := time.Now().Truncate(24 * time.Hour)
        db.Model(&JarvisSession{}).Where("created_at >= ?", today).Count(&todayRequests)

        type UserUsage struct {
                UserID   uint   `json:"user_id"`
                Username string `json:"username"`
                Requests int64  `json:"requests"`
        }

        var topUsers []UserUsage
        db.Raw(`
                SELECT u.id as user_id, u.username, COUNT(js.id) as requests
                FROM jarvis_sessions js
                JOIN users u ON u.id = js.user_id
                GROUP BY u.id, u.username
                ORDER BY requests DESC
                LIMIT 10
        `).Scan(&topUsers)

        c.JSON(http.StatusOK, gin.H{
                "total_requests": totalRequests,
                "today_requests": todayRequests,
                "top_users":      topUsers,
        })
}

func getJarvisUserUsageHandler(c *gin.Context) {
        userID, err := strconv.ParseUint(c.Param("user_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        var totalRequests int64
        db.Model(&JarvisSession{}).Where("user_id = ?", userID).Count(&totalRequests)

        var todayRequests int64
        today := time.Now().Truncate(24 * time.Hour)
        db.Model(&JarvisSession{}).Where("user_id = ? AND created_at >= ?", userID, today).Count(&todayRequests)

        var recentSessions []JarvisSession
        db.Where("user_id = ?", userID).Order("created_at DESC").Limit(20).Find(&recentSessions)

        c.JSON(http.StatusOK, gin.H{
                "user":           user.Username,
                "total_requests": totalRequests,
                "today_requests": todayRequests,
                "recent_sessions": recentSessions,
        })
}

func deleteMessageAdminHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        messageID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
                return
        }

        messageType := c.Query("type")

        if messageType == "dm" {
                var msg DirectMessage
                if err := db.First(&msg, messageID).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
                        return
                }
                db.Delete(&msg)
        } else {
                var msg Message
                if err := db.First(&msg, messageID).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
                        return
                }
                db.Delete(&msg)
        }

        logAudit(adminID.(uint), "delete_message", "message", fmt.Sprintf("%d (%s)", messageID, messageType), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"message": "Message deleted"})
}

func deletePostAdminHandler(c *gin.Context) {
        adminID, _ := c.Get("super_admin_id")
        postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
                return
        }

        var post Post
        if err := db.First(&post, postID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
                return
        }

        db.Where("post_id = ?", postID).Delete(&PostComment{})
        db.Where("post_id = ?", postID).Delete(&PostLike{})
        db.Where("post_id = ?", postID).Delete(&PostRating{})
        db.Delete(&post)

        logAudit(adminID.(uint), "delete_post", "post", strconv.FormatUint(postID, 10), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"message": "Post deleted"})
}
