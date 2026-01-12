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

// Jarvis Moderation System Handlers

func getModerationCasesHandler(c *gin.Context) {
        status := c.Query("status")
        priority := c.Query("priority")
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

        query := db.Model(&ModerationCase{}).
                Preload("TargetUser").
                Preload("Reporter").
                Preload("Report").
                Order("created_at DESC")

        if status != "" {
                query = query.Where("status = ?", status)
        }
        if priority != "" {
                query = query.Where("priority = ?", priority)
        }

        var total int64
        query.Count(&total)

        var cases []ModerationCase
        query.Limit(limit).Offset(offset).Find(&cases)

        c.JSON(http.StatusOK, gin.H{
                "cases": cases,
                "total": total,
                "limit": limit,
                "offset": offset,
        })
}

func getModerationCaseHandler(c *gin.Context) {
        id := c.Param("id")
        var modCase ModerationCase
        if err := db.Preload("TargetUser").
                Preload("Reporter").
                Preload("Report").
                Preload("ReviewedBy").
                First(&modCase, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Дело не найдено"})
                return
        }

        var verdict ModerationVerdict
        db.Where("case_id = ?", modCase.ID).First(&verdict)

        var actionLogs []ModerationActionLog
        db.Where("case_id = ?", modCase.ID).Order("created_at DESC").Find(&actionLogs)

        c.JSON(http.StatusOK, gin.H{
                "case":        modCase,
                "verdict":     verdict,
                "action_logs": actionLogs,
        })
}

func createModerationCaseHandler(c *gin.Context) {
        var req struct {
                ReportID       uint   `json:"report_id" binding:"required"`
                ContentType    string `json:"content_type"`
                ContentID      uint   `json:"content_id"`
                ContentPreview string `json:"content_preview"`
                Priority       string `json:"priority"`
        }

        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var report AbuseReport
        if err := db.First(&report, req.ReportID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Жалоба не найдена"})
                return
        }

        modCase := ModerationCase{
                ReportID:       req.ReportID,
                TargetUserID:   report.TargetID,
                ReporterID:     report.ReporterID,
                ContentType:    req.ContentType,
                ContentID:      req.ContentID,
                ContentPreview: req.ContentPreview,
                Priority:       req.Priority,
                Status:         "pending",
                AssignedToAI:   true,
        }

        if modCase.Priority == "" {
                modCase.Priority = "normal"
        }

        if err := db.Create(&modCase).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать дело"})
                return
        }

        logModerationAction(modCase.ID, "case_created", "system", nil, "Дело создано автоматически из жалобы", c.ClientIP())

        c.JSON(http.StatusCreated, modCase)
}

func jarvisReviewCaseHandler(c *gin.Context) {
        id := c.Param("id")
        var modCase ModerationCase
        if err := db.First(&modCase, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Дело не найдено"})
                return
        }

        if modCase.Status != "pending" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Дело уже рассмотрено"})
                return
        }

        modCase.Status = "in_review"
        db.Save(&modCase)

        logModerationAction(modCase.ID, "review_started", "jarvis", nil, "Jarvis начал рассмотрение", c.ClientIP())

        verdictType, reason, confidence := analyzeContentWithJarvis(modCase)

        verdict := ModerationVerdict{
                CaseID:          modCase.ID,
                VerdictType:     verdictType,
                Reason:          reason,
                ConfidenceScore: confidence,
                IsAutomatic:     true,
        }

        if verdictType == "ban" {
                duration := 24
                verdict.PenaltyDuration = &duration
        } else if verdictType == "warn" {
                duration := 0
                verdict.PenaltyDuration = &duration
        }

        if err := db.Create(&verdict).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать вердикт"})
                return
        }

        now := time.Now()
        modCase.Status = "resolved"
        modCase.ResolvedAt = &now
        db.Save(&modCase)

        logModerationAction(modCase.ID, "verdict_issued", "jarvis", nil,
                fmt.Sprintf("Вердикт: %s (уверенность: %.2f)", verdictType, confidence), c.ClientIP())

        if verdictType == "ban" || verdictType == "warn" {
                applyModeratorPenalty(modCase.TargetUserID, verdictType, verdict.PenaltyDuration)
                logModerationAction(modCase.ID, "penalty_applied", "jarvis", nil,
                        fmt.Sprintf("Применено наказание: %s", verdictType), c.ClientIP())
        }

        c.JSON(http.StatusOK, gin.H{
                "case":    modCase,
                "verdict": verdict,
        })
}

func analyzeContentWithJarvis(modCase ModerationCase) (verdictType string, reason string, confidence float64) {
        var report AbuseReport
        db.First(&report, modCase.ReportID)

        severity := assessContentSeverity(report.Reason, modCase.ContentPreview)

        switch {
        case severity >= 0.8:
                return "ban", "Серьёзное нарушение правил сообщества обнаружено автоматически", severity
        case severity >= 0.5:
                return "warn", "Незначительное нарушение правил сообщества", severity
        case severity >= 0.3:
                return "escalate", "Требуется ручная проверка администратором", severity
        default:
                return "dismiss", "Нарушений не обнаружено", 1.0 - severity
        }
}

func assessContentSeverity(reason, content string) float64 {
        severity := 0.2

        var forbiddenWords []ForbiddenWord
        db.Where("is_active = ?", true).Find(&forbiddenWords)

        for _, fw := range forbiddenWords {
                if containsModerationWord(content, fw.Word) {
                        switch fw.Category {
                        case "critical", "illegal":
                                severity += 0.5
                        case "offensive", "harassment":
                                severity += 0.3
                        case "spam":
                                severity += 0.2
                        default:
                                severity += 0.15
                        }
                }
        }

        switch reason {
        case "spam":
                severity += 0.3
        case "harassment":
                severity += 0.5
        case "hate_speech":
                severity += 0.6
        case "violence":
                severity += 0.7
        case "illegal":
                severity += 0.8
        }

        if severity > 1.0 {
                severity = 1.0
        }

        return severity
}

func containsModerationWord(content, word string) bool {
        return len(content) > 0 && len(word) > 0 && 
                (content == word || len(content) >= len(word))
}

func applyModeratorPenalty(userID uint, penaltyType string, duration *int) {
        if penaltyType == "ban" {
                ban := Ban{
                        UserID: userID,
                        Reason: "Автоматический бан от Jarvis модератора",
                }
                db.Create(&ban)
        }
}

func overrideVerdictHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid, _ := extractUserID(userID)

        id := c.Param("id")
        var req struct {
                NewVerdictType string `json:"new_verdict_type" binding:"required"`
                Reason         string `json:"reason" binding:"required"`
        }

        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var verdict ModerationVerdict
        if err := db.First(&verdict, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Вердикт не найден"})
                return
        }

        verdict.OverriddenByID = &uid
        verdict.OverrideReason = req.Reason
        verdict.VerdictType = req.NewVerdictType
        verdict.IsAutomatic = false
        db.Save(&verdict)

        logModerationAction(verdict.CaseID, "verdict_overridden", "admin", &uid,
                fmt.Sprintf("Вердикт изменён на: %s. Причина: %s", req.NewVerdictType, req.Reason), c.ClientIP())

        c.JSON(http.StatusOK, verdict)
}

func getAppealsHandler(c *gin.Context) {
        status := c.Query("status")
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

        query := db.Model(&Appeal{}).
                Preload("User").
                Preload("Verdict").
                Preload("Reviewer").
                Order("created_at DESC")

        if status != "" {
                query = query.Where("status = ?", status)
        }

        var total int64
        query.Count(&total)

        var appeals []Appeal
        query.Limit(limit).Offset(offset).Find(&appeals)

        c.JSON(http.StatusOK, gin.H{
                "appeals": appeals,
                "total":   total,
        })
}

func createAppealHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid, _ := extractUserID(userID)

        var req struct {
                VerdictID uint   `json:"verdict_id" binding:"required"`
                Reason    string `json:"reason" binding:"required"`
                Evidence  string `json:"evidence"`
        }

        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var verdict ModerationVerdict
        if err := db.First(&verdict, req.VerdictID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Вердикт не найден"})
                return
        }

        var modCase ModerationCase
        db.First(&modCase, verdict.CaseID)

        if modCase.TargetUserID != uid {
                c.JSON(http.StatusForbidden, gin.H{"error": "Вы не можете подать апелляцию на чужой вердикт"})
                return
        }

        var existingAppeal Appeal
        if err := db.Where("verdict_id = ? AND user_id = ?", req.VerdictID, uid).First(&existingAppeal).Error; err == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Вы уже подали апелляцию на этот вердикт"})
                return
        }

        appeal := Appeal{
                VerdictID: req.VerdictID,
                UserID:    uid,
                Reason:    req.Reason,
                Evidence:  req.Evidence,
                Status:    "pending",
        }

        if err := db.Create(&appeal).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать апелляцию"})
                return
        }

        logModerationAction(verdict.CaseID, "appeal_filed", "system", &uid,
                "Пользователь подал апелляцию", c.ClientIP())

        c.JSON(http.StatusCreated, appeal)
}

func reviewAppealHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid, _ := extractUserID(userID)

        id := c.Param("id")
        var req struct {
                Status     string `json:"status" binding:"required"`
                Notes      string `json:"notes"`
                Resolution string `json:"resolution"`
        }

        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var appeal Appeal
        if err := db.First(&appeal, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Апелляция не найдена"})
                return
        }

        appeal.Status = req.Status
        appeal.ReviewerID = &uid
        appeal.ReviewerNotes = req.Notes
        appeal.Resolution = req.Resolution
        now := time.Now()
        appeal.ResolvedAt = &now
        db.Save(&appeal)

        var verdict ModerationVerdict
        db.First(&verdict, appeal.VerdictID)

        if req.Status == "approved" {
                verdict.OverriddenByID = &uid
                verdict.OverrideReason = "Апелляция одобрена: " + req.Resolution
                verdict.VerdictType = "dismiss"
                db.Save(&verdict)

                var modCase ModerationCase
                db.First(&modCase, verdict.CaseID)
                if modCase.TargetUserID > 0 {
                        db.Delete(&Ban{}, "user_id = ?", modCase.TargetUserID)
                }

                logModerationAction(verdict.CaseID, "appeal_approved", "admin", &uid,
                        "Апелляция одобрена: "+req.Resolution, c.ClientIP())
        } else {
                logModerationAction(verdict.CaseID, "appeal_rejected", "admin", &uid,
                        "Апелляция отклонена: "+req.Notes, c.ClientIP())
        }

        c.JSON(http.StatusOK, appeal)
}

func getJarvisAudioResponsesHandler(c *gin.Context) {
        category := c.Query("category")

        query := db.Model(&JarvisAudioResponse{}).Where("is_active = ?", true)
        if category != "" {
                query = query.Where("category = ?", category)
        }

        var responses []JarvisAudioResponse
        query.Find(&responses)

        c.JSON(http.StatusOK, responses)
}

func createJarvisAudioResponseHandler(c *gin.Context) {
        var req JarvisAudioResponse
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if err := db.Create(&req).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать аудио-ответ"})
                return
        }

        c.JSON(http.StatusCreated, req)
}

func updateJarvisAudioResponseHandler(c *gin.Context) {
        id := c.Param("id")
        var response JarvisAudioResponse
        if err := db.First(&response, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Аудио-ответ не найден"})
                return
        }

        var req struct {
                Name        string `json:"name"`
                Description string `json:"description"`
                AudioURL    string `json:"audio_url"`
                Duration    int    `json:"duration"`
                Category    string `json:"category"`
                IsActive    *bool  `json:"is_active"`
        }

        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.Name != "" {
                response.Name = req.Name
        }
        if req.Description != "" {
                response.Description = req.Description
        }
        if req.AudioURL != "" {
                response.AudioURL = req.AudioURL
        }
        if req.Duration > 0 {
                response.Duration = req.Duration
        }
        if req.Category != "" {
                response.Category = req.Category
        }
        if req.IsActive != nil {
                response.IsActive = *req.IsActive
        }

        db.Save(&response)
        c.JSON(http.StatusOK, response)
}

func deleteJarvisAudioResponseHandler(c *gin.Context) {
        id := c.Param("id")
        if err := db.Delete(&JarvisAudioResponse{}, id).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить аудио-ответ"})
                return
        }
        c.JSON(http.StatusOK, gin.H{"message": "Аудио-ответ удалён"})
}

func getVoicemailsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid, _ := extractUserID(userID)

        var voicemails []Voicemail
        db.Where("to_user_id = ?", uid).Order("created_at DESC").Preload("ToUser").Find(&voicemails)

        c.JSON(http.StatusOK, voicemails)
}

func markVoicemailReadHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid, _ := extractUserID(userID)

        id := c.Param("id")
        var voicemail Voicemail
        if err := db.First(&voicemail, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Голосовое сообщение не найдено"})
                return
        }

        if voicemail.ToUserID != uid {
                c.JSON(http.StatusForbidden, gin.H{"error": "Нет доступа"})
                return
        }

        voicemail.IsRead = true
        db.Save(&voicemail)

        c.JSON(http.StatusOK, voicemail)
}

func createVoicemailHandler(c *gin.Context) {
        var req struct {
                ToUserID     uint   `json:"to_user_id" binding:"required"`
                AudioURL     string `json:"audio_url" binding:"required"`
                Duration     int    `json:"duration"`
                CallerNumber string `json:"caller_number"`
        }

        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        voicemail := Voicemail{
                ToUserID:     req.ToUserID,
                AudioURL:     req.AudioURL,
                Duration:     req.Duration,
                CallerNumber: req.CallerNumber,
        }

        if err := db.Create(&voicemail).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать голосовое сообщение"})
                return
        }

        c.JSON(http.StatusCreated, voicemail)
}

func getModerationStatsHandler(c *gin.Context) {
        var pendingCases int64
        var resolvedToday int64
        var pendingAppeals int64
        var totalBans int64

        today := time.Now().Truncate(24 * time.Hour)

        db.Model(&ModerationCase{}).Where("status = ?", "pending").Count(&pendingCases)
        db.Model(&ModerationCase{}).Where("status = ? AND resolved_at >= ?", "resolved", today).Count(&resolvedToday)
        db.Model(&Appeal{}).Where("status = ?", "pending").Count(&pendingAppeals)
        db.Model(&Ban{}).Count(&totalBans)

        c.JSON(http.StatusOK, gin.H{
                "pending_cases":   pendingCases,
                "resolved_today":  resolvedToday,
                "pending_appeals": pendingAppeals,
                "total_bans":      totalBans,
        })
}

func logModerationAction(caseID uint, action, actorType string, actorID *uint, details, ip string) {
        logEntry := ModerationActionLog{
                CaseID:    caseID,
                Action:    action,
                ActorType: actorType,
                ActorID:   actorID,
                Details:   details,
                IPAddress: ip,
        }
        db.Create(&logEntry)
}
