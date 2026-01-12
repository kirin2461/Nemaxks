package main

import (
        "net/http"
        "os"
        "strconv"
        "strings"
        "time"

        "github.com/gin-gonic/gin"
)

func adminMiddleware() gin.HandlerFunc {
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

                if user.Role != "admin" && user.Role != "moderator" {
                        c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
                        c.Abort()
                        return
                }

                c.Set("admin_role", user.Role)
                c.Next()
        }
}

func getAdminStatsHandler(c *gin.Context) {
        var userCount, postCount, messageCount, guildCount int64
        db.Model(&User{}).Count(&userCount)
        db.Model(&Post{}).Count(&postCount)
        db.Model(&DirectMessage{}).Count(&messageCount)
        db.Model(&Guild{}).Count(&guildCount)

        var onlineCount int64
        db.Model(&UserPresence{}).Where("status = ? AND updated_at > ?", "online", time.Now().Add(-5*time.Minute)).Count(&onlineCount)

        var banCount int64
        db.Model(&Ban{}).Count(&banCount)

        var reportCount int64
        db.Model(&AbuseReport{}).Where("status = ?", "pending").Count(&reportCount)

        c.JSON(http.StatusOK, gin.H{
                "users":           userCount,
                "posts":           postCount,
                "messages":        messageCount,
                "guilds":          guildCount,
                "online_users":    onlineCount,
                "active_bans":     banCount,
                "pending_reports": reportCount,
        })
}

func getAdminUsersHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset := (page - 1) * limit

        var users []User
        var total int64
        db.Model(&User{}).Count(&total)
        db.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users)

        c.JSON(http.StatusOK, gin.H{
                "users": users,
                "total": total,
                "page":  page,
                "limit": limit,
        })
}

func banUserHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var req struct {
                Reason    string     `json:"reason"`
                ExpiresAt *time.Time `json:"expires_at"`
        }
        c.BindJSON(&req)

        adminID := uint(userID.(float64))
        ban := Ban{
                UserID:    uint(targetID),
                Reason:    req.Reason,
                CreatedAt: time.Now(),
        }

        if err := db.Create(&ban).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "User already banned"})
                return
        }

        history := BanHistory{
                UserID:    uint(targetID),
                Reason:    req.Reason,
                BannedBy:  adminID,
                ExpiresAt: req.ExpiresAt,
                CreatedAt: time.Now(),
        }
        db.Create(&history)

        logAudit(adminID, "ban_user", "user", strconv.FormatUint(targetID, 10), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"status": "banned"})
}

func unbanUserHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        db.Where("user_id = ?", targetID).Delete(&Ban{})

        adminID := uint(userID.(float64))
        logAudit(adminID, "unban_user", "user", strconv.FormatUint(targetID, 10), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"status": "unbanned"})
}

func createIPBanHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                IPAddress string     `json:"ip_address" binding:"required"`
                Reason    string     `json:"reason"`
                ExpiresAt *time.Time `json:"expires_at"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        adminID := uint(userID.(float64))
        ban := IPBan{
                IPAddress: req.IPAddress,
                Reason:    req.Reason,
                BannedBy:  adminID,
                ExpiresAt: req.ExpiresAt,
                CreatedAt: time.Now(),
        }

        if err := db.Create(&ban).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create IP ban"})
                return
        }

        logAudit(adminID, "ip_ban_create", "ip", req.IPAddress, c.ClientIP())

        c.JSON(http.StatusCreated, ban)
}

func getIPBansHandler(c *gin.Context) {
        var bans []IPBan
        db.Order("created_at DESC").Find(&bans)
        c.JSON(http.StatusOK, bans)
}

func deleteIPBanHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        banID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ban ID"})
                return
        }

        var ban IPBan
        if db.First(&ban, banID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Ban not found"})
                return
        }

        db.Delete(&ban)

        adminID := uint(userID.(float64))
        logAudit(adminID, "ip_ban_delete", "ip", ban.IPAddress, c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func getReportsHandler(c *gin.Context) {
        status := c.DefaultQuery("status", "pending")
        var reports []AbuseReport
        db.Where("status = ?", status).Order("created_at DESC").Find(&reports)
        c.JSON(http.StatusOK, reports)
}

func createReportHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        reporterID := uint(userID.(float64))

        var req struct {
                ReportedUserID uint   `json:"reported_user_id" binding:"required"`
                Reason         string `json:"reason" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        report := AbuseReport{
                ReporterID: reporterID,
                TargetType: "user",
                TargetID:   req.ReportedUserID,
                Reason:     req.Reason,
                Status:     "pending",
        }
        db.Create(&report)

        c.JSON(http.StatusCreated, gin.H{"status": "report_submitted", "id": report.ID})
}

func updateReportHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        reportID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
                return
        }

        var req struct {
                Status string `json:"status" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        adminID := uint(userID.(float64))
        now := time.Now()
        db.Model(&AbuseReport{}).Where("id = ?", reportID).Updates(map[string]interface{}{
                "status":      req.Status,
                "reviewed_by": adminID,
                "reviewed_at": now,
        })

        logAudit(adminID, "report_review", "report", strconv.FormatUint(reportID, 10), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func getAuditLogsHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset := (page - 1) * limit

        var logs []AuditLog
        var total int64
        db.Model(&AuditLog{}).Count(&total)
        db.Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs)

        c.JSON(http.StatusOK, gin.H{
                "logs":  logs,
                "total": total,
                "page":  page,
                "limit": limit,
        })
}

func logAudit(userID uint, action, target, details, ip string) {
        log := AuditLog{
                UserID:    userID,
                Action:    action,
                Target:    target,
                Details:   details,
                IPAddress: ip,
                CreatedAt: time.Now(),
        }
        db.Create(&log)
}

func getGuildRolesHandler(c *gin.Context) {
        guildID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var roles []GuildRole
        db.Where("guild_id = ?", guildID).Order("position ASC").Find(&roles)
        c.JSON(http.StatusOK, roles)
}

func createGuildRoleHandler(c *gin.Context) {
        guildID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        var req struct {
                Name        string `json:"name" binding:"required"`
                Color       string `json:"color"`
                Permissions int64  `json:"permissions"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var maxPos int
        db.Model(&GuildRole{}).Where("guild_id = ?", guildID).Select("COALESCE(MAX(position), 0)").Scan(&maxPos)

        role := GuildRole{
                GuildID:     uint(guildID),
                Name:        req.Name,
                Color:       req.Color,
                Position:    maxPos + 1,
                Permissions: req.Permissions,
        }

        if err := db.Create(&role).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
                return
        }

        c.JSON(http.StatusCreated, role)
}

func updateGuildRoleHandler(c *gin.Context) {
        roleID, err := strconv.ParseUint(c.Param("role_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
                return
        }

        var req struct {
                Name        *string `json:"name"`
                Color       *string `json:"color"`
                Permissions *int64  `json:"permissions"`
                Position    *int    `json:"position"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        updates := make(map[string]interface{})
        if req.Name != nil {
                updates["name"] = *req.Name
        }
        if req.Color != nil {
                updates["color"] = *req.Color
        }
        if req.Permissions != nil {
                updates["permissions"] = *req.Permissions
        }
        if req.Position != nil {
                updates["position"] = *req.Position
        }

        db.Model(&GuildRole{}).Where("id = ?", roleID).Updates(updates)
        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func deleteGuildRoleHandler(c *gin.Context) {
        roleID, err := strconv.ParseUint(c.Param("role_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
                return
        }

        db.Where("id = ?", roleID).Delete(&GuildRole{})
        db.Where("role_id = ?", roleID).Delete(&GuildMemberRole{})

        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func getPinnedMessagesHandler(c *gin.Context) {
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }

        var pins []PinnedMessage
        db.Where("channel_id = ?", channelID).Order("created_at DESC").Find(&pins)

        var messageIDs []uint
        for _, pin := range pins {
                messageIDs = append(messageIDs, pin.MessageID)
        }

        var messages []Message
        if len(messageIDs) > 0 {
                db.Where("id IN ?", messageIDs).Preload("Author").Find(&messages)
        }

        c.JSON(http.StatusOK, messages)
}

func pinMessageHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }
        messageID, err := strconv.ParseUint(c.Param("message_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
                return
        }

        uid := uint(userID.(float64))
        pin := PinnedMessage{
                ChannelID: uint(channelID),
                MessageID: uint(messageID),
                PinnedBy:  uid,
                CreatedAt: time.Now(),
        }

        if err := db.Create(&pin).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Message already pinned"})
                return
        }

        c.JSON(http.StatusCreated, pin)
}

func unpinMessageHandler(c *gin.Context) {
        channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
                return
        }
        messageID, err := strconv.ParseUint(c.Param("message_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
                return
        }

        db.Where("channel_id = ? AND message_id = ?", channelID, messageID).Delete(&PinnedMessage{})
        c.JSON(http.StatusOK, gin.H{"status": "unpinned"})
}

func getUserSettingsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var settings UserSettings
        if db.Where("user_id = ?", uid).First(&settings).RowsAffected == 0 {
                settings = UserSettings{
                        UserID:          uid,
                        Language:        "ru",
                        Theme:           "dark",
                        Notifications:   true,
                        SoundEnabled:    true,
                        NoiseReduction:  true,
                        VoiceActivation: false,
                }
                db.Create(&settings)
        }

        c.JSON(http.StatusOK, settings)
}

func updateUserSettingsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var req UserSettings
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var settings UserSettings
        if db.Where("user_id = ?", uid).First(&settings).RowsAffected == 0 {
                req.UserID = uid
                db.Create(&req)
        } else {
                db.Model(&settings).Updates(req)
        }

        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func uploadFileHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        file, err := c.FormFile("file")
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
                return
        }

        src, err := file.Open()
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
                return
        }
        defer src.Close()

        header := make([]byte, 512)
        n, err := src.Read(header)
        if err != nil || n < 8 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Could not read file header"})
                return
        }

        detectedType := detectFileType(header[:n])
        if detectedType == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "File type not allowed. Only JPEG, PNG, GIF, WebP, MP4, WebM, MOV, and audio files (WebM, OGG, MP3, WAV) are supported."})
                return
        }

        isVideo := strings.HasPrefix(detectedType, "video/")
        var maxSize int64
        if isVideo {
                maxSize = 500 * 1024 * 1024
                if file.Size > maxSize {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Видео файл слишком большой (максимум 500 МБ)"})
                        return
                }
        } else {
                maxSize = 50 * 1024 * 1024
                if file.Size > maxSize {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 50MB)"})
                        return
                }
        }

        // Check if client specified audio type for WebM container
        requestedType := c.PostForm("type")
        if requestedType == "audio" && detectedType == "video/webm" {
                detectedType = "audio/webm"
        }

        fileType := "file"
        ext := ".bin"
        switch detectedType {
        case "image/jpeg":
                fileType = "image"
                ext = ".jpg"
        case "image/png":
                fileType = "image"
                ext = ".png"
        case "image/gif":
                fileType = "image"
                ext = ".gif"
        case "image/webp":
                fileType = "image"
                ext = ".webp"
        case "video/mp4":
                fileType = "video"
                ext = ".mp4"
        case "video/webm":
                fileType = "video"
                ext = ".webm"
        case "video/quicktime":
                fileType = "video"
                ext = ".mov"
        case "audio/webm":
                fileType = "audio"
                ext = ".webm"
        case "audio/ogg":
                fileType = "audio"
                ext = ".ogg"
        case "audio/mpeg":
                fileType = "audio"
                ext = ".mp3"
        case "audio/wav":
                fileType = "audio"
                ext = ".wav"
        }

        os.MkdirAll("./uploads", os.ModePerm)

        filename := strconv.FormatUint(uint64(uid), 10) + "_" + strconv.FormatInt(time.Now().UnixNano(), 10) + ext
        filepath := "./uploads/" + filename

        if err := c.SaveUploadedFile(file, filepath); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
                return
        }

        url := "/uploads/" + filename
        c.JSON(http.StatusOK, gin.H{"url": url, "type": fileType})
}

func detectFileType(header []byte) string {
        if len(header) < 4 {
                return ""
        }

        if header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF {
                return "image/jpeg"
        }

        if header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 {
                return "image/png"
        }

        if header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46 {
                return "image/gif"
        }

        if len(header) >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 &&
                header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50 {
                return "image/webp"
        }

        // WAV audio: RIFF....WAVE
        if len(header) >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 &&
                header[8] == 0x57 && header[9] == 0x41 && header[10] == 0x56 && header[11] == 0x45 {
                return "audio/wav"
        }

        if len(header) >= 12 {
                if header[4] == 0x66 && header[5] == 0x74 && header[6] == 0x79 && header[7] == 0x70 {
                        ftypBrand := string(header[8:12])
                        switch ftypBrand {
                        case "isom", "iso2", "avc1", "mp41", "mp42", "M4V ", "M4A ":
                                return "video/mp4"
                        case "qt  ":
                                return "video/quicktime"
                        }
                }
        }

        // WebM/Matroska container - used for both video and audio
        // Default to video/webm for WebM uploads since video is more common
        if len(header) >= 4 && header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3 {
                return "video/webm"
        }

        // OGG audio
        if len(header) >= 4 && header[0] == 0x4F && header[1] == 0x67 && header[2] == 0x67 && header[3] == 0x53 {
                return "audio/ogg"
        }

        // MP3 audio - ID3 tag or sync word
        if (header[0] == 0x49 && header[1] == 0x44 && header[2] == 0x33) || // ID3 tag
                (header[0] == 0xFF && (header[1]&0xE0) == 0xE0) { // MP3 sync
                return "audio/mpeg"
        }

        return ""
}

// User Requests Handlers

func createUserRequestHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var req struct {
                Category    string `json:"category" binding:"required"`
                Subject     string `json:"subject" binding:"required"`
                Description string `json:"description"`
                Priority    string `json:"priority"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        // Validate category
        validCategories := map[string]bool{"abuse": true, "technical": true, "feature_request": true, "billing": true, "other": true}
        if !validCategories[req.Category] {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
                return
        }

        // Default priority
        if req.Priority == "" {
                req.Priority = "normal"
        }

        request := UserRequest{
                UserID:      uid,
                Category:    req.Category,
                Subject:     req.Subject,
                Description: req.Description,
                Priority:    req.Priority,
                Status:      "pending",
        }
        if err := db.Create(&request).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
                return
        }

        c.JSON(http.StatusCreated, gin.H{"status": "request_submitted", "id": request.ID})
}

func getUserRequestsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var requests []UserRequest
        db.Where("user_id = ?", uid).Order("created_at DESC").Find(&requests)
        c.JSON(http.StatusOK, requests)
}

func cancelUserRequestHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        requestID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
                return
        }

        var request UserRequest
        if err := db.Where("id = ? AND user_id = ?", requestID, uid).First(&request).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
                return
        }

        if request.Status != "pending" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Can only cancel pending requests"})
                return
        }

        db.Model(&request).Update("status", "cancelled")
        c.JSON(http.StatusOK, gin.H{"status": "cancelled"})
}

func getAdminUserRequestsHandler(c *gin.Context) {
        status := c.DefaultQuery("status", "")
        category := c.DefaultQuery("category", "")
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
        offset := (page - 1) * limit

        query := db.Model(&UserRequest{}).Preload("User")
        if status != "" {
                query = query.Where("status = ?", status)
        }
        if category != "" {
                query = query.Where("category = ?", category)
        }

        var total int64
        query.Count(&total)

        var requests []UserRequest
        query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&requests)

        c.JSON(http.StatusOK, gin.H{
                "requests": requests,
                "total":    total,
                "page":     page,
                "limit":    limit,
        })
}

func updateUserRequestHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        adminID := uint(userID.(float64))
        requestID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
                return
        }

        var req struct {
                Status     string `json:"status"`
                AdminNotes string `json:"admin_notes"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        updates := map[string]interface{}{}
        if req.Status != "" {
                updates["status"] = req.Status
                updates["reviewed_by"] = adminID
                now := time.Now()
                updates["reviewed_at"] = now
        }
        if req.AdminNotes != "" {
                updates["admin_notes"] = req.AdminNotes
        }

        db.Model(&UserRequest{}).Where("id = ?", requestID).Updates(updates)
        logAudit(adminID, "user_request_update", "user_request", strconv.FormatUint(requestID, 10), c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}
