package main

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

func getChannelHandler(c *gin.Context) {
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var channel Channel
        if err := db.Preload("Guild").First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        c.JSON(http.StatusOK, channel)
}

func updateChannelHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        var guild Guild
        if err := db.First(&guild, channel.GuildID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if !hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_channels") {
                c.JSON(http.StatusForbidden, gin.H{"error": "No permission to manage channels"})
                return
        }

        var req struct {
                Name        *string `json:"name"`
                Description *string `json:"description"`
                Type        *string `json:"type"`
                Position    *int    `json:"position"`
                CategoryID  *uint   `json:"category_id"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        updates := make(map[string]interface{})
        if req.Name != nil {
                updates["name"] = *req.Name
        }
        if req.Description != nil {
                updates["description"] = *req.Description
        }
        if req.Type != nil {
                updates["type"] = *req.Type
        }
        if req.Position != nil {
                updates["position"] = *req.Position
        }

        updates["updated_at"] = time.Now()
        db.Model(&channel).Updates(updates)

        db.First(&channel, channelID)
        c.JSON(http.StatusOK, channel)
}

func deleteChannelHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        if !hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_channels") {
                c.JSON(http.StatusForbidden, gin.H{"error": "No permission to delete channels"})
                return
        }

        db.Where("channel_id = ?", channelID).Delete(&Message{})
        db.Where("channel_id = ?", channelID).Delete(&ChannelMember{})
        db.Where("channel_id = ?", channelID).Delete(&ChannelPermission{})
        db.Where("channel_id = ?", channelID).Delete(&PinnedMessage{})
        db.Delete(&channel)

        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func getChannelMembersHandler(c *gin.Context) {
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var members []ChannelMember
        db.Where("channel_id = ?", channelID).Find(&members)

        type MemberInfo struct {
                ID       uint    `json:"id"`
                UserID   uint    `json:"user_id"`
                Username string  `json:"username"`
                Avatar   *string `json:"avatar"`
                Role     string  `json:"role"`
                JoinedAt string  `json:"joined_at"`
        }

        var result []MemberInfo
        for _, m := range members {
                var user User
                if db.First(&user, m.UserID).RowsAffected > 0 {
                        result = append(result, MemberInfo{
                                ID:       m.ID,
                                UserID:   m.UserID,
                                Username: user.Username,
                                Avatar:   user.Avatar,
                                Role:     m.Role,
                                JoinedAt: m.JoinedAt.Format(time.RFC3339),
                        })
                }
        }

        c.JSON(http.StatusOK, result)
}

func addChannelMemberHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        if !hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_members") {
                c.JSON(http.StatusForbidden, gin.H{"error": "No permission to manage members"})
                return
        }

        var req struct {
                UserID uint   `json:"user_id" binding:"required"`
                Role   string `json:"role"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var existing ChannelMember
        if db.Where("channel_id = ? AND user_id = ?", channelID, req.UserID).First(&existing).RowsAffected > 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "User already a member"})
                return
        }

        role := "member"
        if req.Role != "" {
                role = req.Role
        }

        member := ChannelMember{
                ChannelID: uint(channelID),
                UserID:    req.UserID,
                Role:      role,
                JoinedAt:  time.Now(),
        }
        db.Create(&member)

        c.JSON(http.StatusCreated, member)
}

func updateChannelMemberHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }
        memberID, err := strconv.ParseUint(c.Param("member_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        if !hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_members") {
                c.JSON(http.StatusForbidden, gin.H{"error": "No permission to manage members"})
                return
        }

        var req struct {
                Role string `json:"role" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        db.Model(&ChannelMember{}).Where("id = ?", memberID).Update("role", req.Role)

        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func removeChannelMemberHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }
        memberID, err := strconv.ParseUint(c.Param("member_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        if !hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_members") {
                c.JSON(http.StatusForbidden, gin.H{"error": "No permission to manage members"})
                return
        }

        db.Where("id = ?", memberID).Delete(&ChannelMember{})

        c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func getChannelPermissionsHandler(c *gin.Context) {
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var permissions []ChannelPermission
        db.Where("channel_id = ?", channelID).Find(&permissions)

        c.JSON(http.StatusOK, permissions)
}

func setChannelPermissionHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        if !hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_permissions") {
                c.JSON(http.StatusForbidden, gin.H{"error": "No permission to manage permissions"})
                return
        }

        var req struct {
                RoleID *uint `json:"role_id"`
                UserID *uint `json:"user_id"`
                Allow  int64 `json:"allow"`
                Deny   int64 `json:"deny"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.RoleID == nil && req.UserID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Either role_id or user_id must be provided"})
                return
        }

        var existing ChannelPermission
        query := db.Where("channel_id = ?", channelID)
        if req.RoleID != nil {
                query = query.Where("role_id = ?", *req.RoleID)
        }
        if req.UserID != nil {
                query = query.Where("user_id = ?", *req.UserID)
        }

        if query.First(&existing).RowsAffected > 0 {
                existing.Allow = req.Allow
                existing.Deny = req.Deny
                db.Save(&existing)
                c.JSON(http.StatusOK, existing)
                return
        }

        perm := ChannelPermission{
                ChannelID: uint(channelID),
                RoleID:    req.RoleID,
                UserID:    req.UserID,
                Allow:     req.Allow,
                Deny:      req.Deny,
        }
        db.Create(&perm)

        c.JSON(http.StatusCreated, perm)
}

func deleteChannelPermissionHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }
        permID, err := strconv.ParseUint(c.Param("perm_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        if !hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_permissions") {
                c.JSON(http.StatusForbidden, gin.H{"error": "No permission to manage permissions"})
                return
        }

        db.Where("id = ?", permID).Delete(&ChannelPermission{})

        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func hasChannelPermission(userID uint, channelID uint, guildID uint, permission string) bool {
        var guild Guild
        if db.First(&guild, guildID).RowsAffected > 0 {
                if guild.OwnerID == userID {
                        return true
                }
        }

        var user User
        if db.First(&user, userID).RowsAffected > 0 {
                if user.Role == "admin" || user.Role == "moderator" {
                        return true
                }
        }

        permBits := map[string]int64{
                "view_channel":       1 << 0,
                "send_messages":      1 << 1,
                "manage_messages":    1 << 2,
                "manage_channels":    1 << 3,
                "manage_members":     1 << 4,
                "manage_permissions": 1 << 5,
                "create_invite":      1 << 6,
                "mention_everyone":   1 << 7,
                "attach_files":       1 << 8,
                "embed_links":        1 << 9,
                "add_reactions":      1 << 10,
                "voice_connect":      1 << 11,
                "voice_speak":        1 << 12,
                "voice_mute_members": 1 << 13,
                "voice_deafen":       1 << 14,
                "voice_move_members": 1 << 15,
                "administrator":      1 << 31,
        }

        bit, exists := permBits[permission]
        if !exists {
                return false
        }

        var userPerm ChannelPermission
        if db.Where("channel_id = ? AND user_id = ?", channelID, userID).First(&userPerm).RowsAffected > 0 {
                if userPerm.Allow&(1<<31) != 0 {
                        return true
                }
                if userPerm.Deny&bit != 0 {
                        return false
                }
                if userPerm.Allow&bit != 0 {
                        return true
                }
        }

        var memberRoles []GuildMemberRole
        db.Where("user_id = ? AND guild_id = ?", userID, guildID).Find(&memberRoles)

        for _, mr := range memberRoles {
                var role GuildRole
                if db.First(&role, mr.RoleID).RowsAffected > 0 {
                        if role.Permissions&(1<<31) != 0 {
                                return true
                        }

                        var rolePerm ChannelPermission
                        if db.Where("channel_id = ? AND role_id = ?", channelID, role.ID).First(&rolePerm).RowsAffected > 0 {
                                if rolePerm.Deny&bit != 0 {
                                        continue
                                }
                                if rolePerm.Allow&bit != 0 {
                                        return true
                                }
                        }

                        if role.Permissions&bit != 0 {
                                return true
                        }
                }
        }

        var guildMember ChannelMember
        if db.Where("channel_id = ? AND user_id = ?", channelID, userID).First(&guildMember).RowsAffected > 0 {
                if guildMember.Role == "admin" || guildMember.Role == "moderator" {
                        return true
                }
        }

        return false
}

func getChannelRolesHandler(c *gin.Context) {
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        var roles []GuildRole
        db.Where("guild_id = ?", channel.GuildID).Order("position ASC").Find(&roles)

        type RoleWithOverwrite struct {
                ID          uint   `json:"id"`
                Name        string `json:"name"`
                Color       string `json:"color"`
                Position    int    `json:"position"`
                Permissions int64  `json:"permissions"`
                Allow       int64  `json:"allow"`
                Deny        int64  `json:"deny"`
        }

        var result []RoleWithOverwrite
        for _, role := range roles {
                rwo := RoleWithOverwrite{
                        ID:          role.ID,
                        Name:        role.Name,
                        Color:       role.Color,
                        Position:    role.Position,
                        Permissions: role.Permissions,
                }

                var perm ChannelPermission
                if db.Where("channel_id = ? AND role_id = ?", channelID, role.ID).First(&perm).RowsAffected > 0 {
                        rwo.Allow = perm.Allow
                        rwo.Deny = perm.Deny
                }

                result = append(result, rwo)
        }

        c.JSON(http.StatusOK, result)
}

func createChannelCategoryHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        guildID, err := strconv.ParseUint(c.Param("guild_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var guild Guild
        if db.First(&guild, guildID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if guild.OwnerID != uid {
                var user User
                db.First(&user, uid)
                if user.Role != "admin" && user.Role != "moderator" {
                        c.JSON(http.StatusForbidden, gin.H{"error": "No permission"})
                        return
                }
        }

        var req struct {
                Name     string `json:"name" binding:"required"`
                Position int    `json:"position"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        category := ChannelCategory{
                GuildID:   uint(guildID),
                Name:      req.Name,
                Position:  req.Position,
                CreatedAt: time.Now(),
        }
        db.Create(&category)

        c.JSON(http.StatusCreated, category)
}

func getChannelCategoriesHandler(c *gin.Context) {
        guildID, err := strconv.ParseUint(c.Param("guild_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var categories []ChannelCategory
        db.Where("guild_id = ?", guildID).Order("position ASC").Find(&categories)

        c.JSON(http.StatusOK, categories)
}

func updateChannelCategoryHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        categoryID, err := strconv.ParseUint(c.Param("category_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
                return
        }

        var category ChannelCategory
        if err := db.First(&category, categoryID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
                return
        }

        var guild Guild
        if db.First(&guild, category.GuildID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if guild.OwnerID != uid {
                var user User
                db.First(&user, uid)
                if user.Role != "admin" && user.Role != "moderator" {
                        c.JSON(http.StatusForbidden, gin.H{"error": "No permission"})
                        return
                }
        }

        var req struct {
                Name     *string `json:"name"`
                Position *int    `json:"position"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        updates := make(map[string]interface{})
        if req.Name != nil {
                updates["name"] = *req.Name
        }
        if req.Position != nil {
                updates["position"] = *req.Position
        }

        db.Model(&category).Updates(updates)
        db.First(&category, categoryID)

        c.JSON(http.StatusOK, category)
}

func deleteChannelCategoryHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        categoryID, err := strconv.ParseUint(c.Param("category_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
                return
        }

        var category ChannelCategory
        if err := db.First(&category, categoryID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
                return
        }

        var guild Guild
        if db.First(&guild, category.GuildID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if guild.OwnerID != uid {
                var user User
                db.First(&user, uid)
                if user.Role != "admin" && user.Role != "moderator" {
                        c.JSON(http.StatusForbidden, gin.H{"error": "No permission"})
                        return
                }
        }

        db.Delete(&category)

        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func reorderChannelsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        guildID, err := strconv.ParseUint(c.Param("guild_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var guild Guild
        if db.First(&guild, guildID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if guild.OwnerID != uid {
                var user User
                db.First(&user, uid)
                if user.Role != "admin" && user.Role != "moderator" {
                        c.JSON(http.StatusForbidden, gin.H{"error": "No permission"})
                        return
                }
        }

        var req struct {
                Channels []struct {
                        ID       uint `json:"id"`
                        Position int  `json:"position"`
                } `json:"channels"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        for _, ch := range req.Channels {
                db.Model(&Channel{}).Where("id = ? AND guild_id = ?", ch.ID, guildID).Update("position", ch.Position)
        }

        c.JSON(http.StatusOK, gin.H{"status": "reordered"})
}

// GetVoiceChannelParticipants returns the list of users currently in a voice channel
func GetVoiceChannelParticipants(c *gin.Context) {
        channelID := c.Param("channel_id")

        // Use voiceRoster which is synchronized via WebSockets
        participants := voiceRoster.GetParticipants(channelID)
        c.JSON(http.StatusOK, participants)
}

func HandleCreateChannelTool(c *gin.Context) {
        c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func HandleGetChannelTools(c *gin.Context) {
        c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func HandleUpdateChannelTool(c *gin.Context) {
        c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func HandleDeleteChannelTool(c *gin.Context) {
        c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}
