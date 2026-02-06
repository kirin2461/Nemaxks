package main

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

func registerFraudRoutes(r *gin.Engine, auth gin.HandlerFunc, admin gin.HandlerFunc) {
        fraud := r.Group("/api/fraud")
        fraud.Use(auth, admin)
        {
                fraud.GET("/stats", getFraudStatsHandler)
                fraud.GET("/alerts", getFraudAlertsHandler)
                fraud.GET("/alerts/:id", getFraudAlertHandler)
                fraud.PUT("/alerts/:id/review", reviewFraudAlertHandler)
                
                fraud.GET("/rules", getFraudRulesHandler)
                fraud.POST("/rules", createFraudRuleHandler)
                fraud.PUT("/rules/:id", updateFraudRuleHandler)
                fraud.DELETE("/rules/:id", deleteFraudRuleHandler)
                
                fraud.GET("/risk-scores", getRiskScoresHandler)
                fraud.GET("/risk-scores/:user_id", getUserRiskScoreHandler)
                
                fraud.GET("/impersonation-bans", getImpersonationBansHandler)
                
                fraud.GET("/ip-blacklist", getIPBlacklistHandler)
                fraud.POST("/ip-blacklist", addIPBlacklistHandler)
                fraud.DELETE("/ip-blacklist/:id", removeIPBlacklistHandler)
                
                fraud.GET("/suspicious-activity", getSuspiciousActivityHandler)
                
                fraud.POST("/analyze", analyzeContentHandler)
        }
}

func getFraudStatsHandler(c *gin.Context) {
        var stats FraudStats
        
        db.Model(&FraudAlert{}).Count(&stats.TotalAlerts)
        db.Model(&FraudAlert{}).Where("status = ?", "pending").Count(&stats.PendingAlerts)
        
        today := time.Now().Truncate(24 * time.Hour)
        db.Model(&FraudAlert{}).Where("created_at >= ?", today).Count(&stats.AlertsToday)
        
        db.Model(&ImpersonationBan{}).Count(&stats.ImpersonationBans)
        db.Model(&IPBlacklist{}).Count(&stats.BlockedIPs)
        db.Model(&DeviceFingerprint{}).Where("is_banned = ?", true).Count(&stats.BannedDevices)
        db.Model(&UserRiskScore{}).Where("score >= ?", 70).Count(&stats.HighRiskUsers)
        
        var avgScore float64
        db.Model(&UserRiskScore{}).Select("COALESCE(AVG(score), 0)").Scan(&avgScore)
        stats.AverageRiskScore = avgScore
        
        c.JSON(http.StatusOK, stats)
}

func getFraudAlertsHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
        status := c.Query("status")
        alertType := c.Query("type")
        severity := c.Query("severity")
        
        offset := (page - 1) * limit
        
        query := db.Model(&FraudAlert{}).Preload("User")
        
        if status != "" {
                query = query.Where("status = ?", status)
        }
        if alertType != "" {
                query = query.Where("alert_type = ?", alertType)
        }
        if severity != "" {
                query = query.Where("severity = ?", severity)
        }
        
        var total int64
        query.Count(&total)
        
        var alerts []FraudAlert
        query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&alerts)
        
        c.JSON(http.StatusOK, gin.H{
                "alerts": alerts,
                "total":  total,
                "page":   page,
                "limit":  limit,
        })
}

func getFraudAlertHandler(c *gin.Context) {
        alertID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
                return
        }
        
        var alert FraudAlert
        if err := db.Preload("User").First(&alert, alertID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
                return
        }
        
        c.JSON(http.StatusOK, alert)
}

func reviewFraudAlertHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        alertID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
                return
        }
        
        var req struct {
                Status      string `json:"status" binding:"required"`
                ActionTaken string `json:"action_taken"`
                Notes       string `json:"notes"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var alert FraudAlert
        if err := db.First(&alert, alertID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
                return
        }
        
        now := time.Now()
        alert.Status = req.Status
        alert.ActionTaken = req.ActionTaken
        alert.ReviewNotes = req.Notes
        alert.ReviewedBy = &userID
        alert.ReviewedAt = &now
        
        db.Save(&alert)
        
        if req.ActionTaken != "" && req.ActionTaken != "none" {
                fraudDetector.ExecuteAction(alert.UserID, req.ActionTaken, req.Notes)
        }
        
        c.JSON(http.StatusOK, alert)
}

func getFraudRulesHandler(c *gin.Context) {
        var rules []FraudRule
        db.Order("priority DESC").Find(&rules)
        c.JSON(http.StatusOK, rules)
}

func createFraudRuleHandler(c *gin.Context) {
        var rule FraudRule
        if err := c.ShouldBindJSON(&rule); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        if err := db.Create(&rule).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule"})
                return
        }
        
        c.JSON(http.StatusCreated, rule)
}

func updateFraudRuleHandler(c *gin.Context) {
        ruleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
                return
        }
        
        var rule FraudRule
        if err := db.First(&rule, ruleID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
                return
        }
        
        var updates FraudRule
        if err := c.ShouldBindJSON(&updates); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        db.Model(&rule).Updates(updates)
        c.JSON(http.StatusOK, rule)
}

func deleteFraudRuleHandler(c *gin.Context) {
        ruleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
                return
        }
        
        if err := db.Delete(&FraudRule{}, ruleID).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete rule"})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{"success": true})
}

func getRiskScoresHandler(c *gin.Context) {
        minScore, _ := strconv.ParseFloat(c.DefaultQuery("min_score", "0"), 64)
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        
        var scores []UserRiskScore
        db.Preload("User").Where("score >= ?", minScore).Order("score DESC").Limit(limit).Find(&scores)
        
        c.JSON(http.StatusOK, scores)
}

func getUserRiskScoreHandler(c *gin.Context) {
        userID, err := strconv.ParseUint(c.Param("user_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }
        
        var score UserRiskScore
        if err := db.Preload("User").Where("user_id = ?", userID).First(&score).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Risk score not found"})
                return
        }
        
        c.JSON(http.StatusOK, score)
}

func getImpersonationBansHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
        offset := (page - 1) * limit
        
        var total int64
        db.Model(&ImpersonationBan{}).Count(&total)
        
        var bans []ImpersonationBan
        db.Preload("User").Order("banned_at DESC").Offset(offset).Limit(limit).Find(&bans)
        
        c.JSON(http.StatusOK, gin.H{
                "bans":  bans,
                "total": total,
                "page":  page,
                "limit": limit,
        })
}

func getIPBlacklistHandler(c *gin.Context) {
        var ips []IPBlacklist
        db.Order("created_at DESC").Find(&ips)
        c.JSON(http.StatusOK, ips)
}

func addIPBlacklistHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                IPAddress string     `json:"ip_address" binding:"required"`
                Reason    string     `json:"reason"`
                ExpiresAt *time.Time `json:"expires_at,omitempty"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        blacklist := IPBlacklist{
                IPAddress: req.IPAddress,
                Reason:    req.Reason,
                Source:    "manual",
                ExpiresAt: req.ExpiresAt,
                CreatedBy: userID,
                CreatedAt: time.Now(),
        }
        
        if err := db.Create(&blacklist).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add IP to blacklist"})
                return
        }
        
        c.JSON(http.StatusCreated, blacklist)
}

func removeIPBlacklistHandler(c *gin.Context) {
        id, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid blacklist entry ID"})
                return
        }
        
        if err := db.Delete(&IPBlacklist{}, id).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove IP from blacklist"})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{"success": true})
}

func getSuspiciousActivityHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        activityType := c.Query("type")
        riskLevel := c.Query("risk_level")
        
        offset := (page - 1) * limit
        
        query := db.Model(&SuspiciousActivity{}).Preload("User")
        
        if activityType != "" {
                query = query.Where("activity_type = ?", activityType)
        }
        if riskLevel != "" {
                query = query.Where("risk_level = ?", riskLevel)
        }
        
        var total int64
        query.Count(&total)
        
        var activities []SuspiciousActivity
        query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&activities)
        
        c.JSON(http.StatusOK, gin.H{
                "activities": activities,
                "total":      total,
                "page":       page,
                "limit":      limit,
        })
}

func analyzeContentHandler(c *gin.Context) {
        var req struct {
                Content string `json:"content" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        results := fraudDetector.AnalyzeMessage(req.Content, 0)
        normalized := NormalizeText(req.Content)
        
        c.JSON(http.StatusOK, gin.H{
                "original":   req.Content,
                "normalized": normalized,
                "results":    results,
                "is_fraud":   len(results) > 0,
        })
}

func checkMessageForFraud(userID uint, channelID uint, content, sourceIP, deviceFP string) []DetectionResult {
        results := fraudDetector.AnalyzeMessage(content, userID)
        
        spamResult := fraudDetector.CheckSpam(userID, channelID, content)
        if spamResult.IsFraud {
                results = append(results, spamResult)
        }
        
        for _, result := range results {
                if result.IsFraud {
                        evidence := map[string]interface{}{
                                "content":     content,
                                "normalized":  NormalizeText(content),
                                "keywords":    result.MatchedKeywords,
                                "patterns":    result.MatchedPatterns,
                                "channel_id":  channelID,
                        }
                        
                        fraudDetector.CreateAlert(userID, result, evidence, sourceIP, deviceFP)
                        
                        if result.Action == "permaban" && result.AlertType == "impersonation" {
                                var user User
                                db.First(&user, userID)
                                fraudDetector.RecordImpersonationBan(userID, user.Username, content, NormalizeText(content), result.MatchedKeywords, sourceIP, deviceFP)
                        }
                        
                        fraudDetector.ExecuteAction(userID, result.Action, result.Description)
                }
        }
        
        return results
}
