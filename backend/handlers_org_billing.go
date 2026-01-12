package main

import (
        "encoding/json"
        "fmt"
        "math"
        "net/http"
        "time"

        "github.com/gin-gonic/gin"
)

func setupOrgBillingRoutes(r *gin.Engine, auth gin.HandlerFunc) {
        org := r.Group("/api/org")
        org.Use(auth)
        {
                org.POST("", createOrgHandler)
                org.GET("", listUserOrgsHandler)
                org.GET("/:id", getOrgHandler)
                org.PUT("/:id", updateOrgHandler)
                org.DELETE("/:id", deleteOrgHandler)

                org.GET("/:id/members", getOrgMembersHandler)
                org.POST("/:id/members", addOrgMemberHandler)
                org.PUT("/:id/members/:userId", updateOrgMemberHandler)
                org.DELETE("/:id/members/:userId", removeOrgMemberHandler)

                org.GET("/:id/subscription", getOrgSubscriptionHandler)
                org.POST("/:id/subscribe", subscribeOrgHandler)
                org.PUT("/:id/subscription", updateOrgSubscriptionHandler)
                org.POST("/:id/subscription/cancel", cancelOrgSubscriptionHandler)

                org.GET("/:id/billing", getOrgBillingHandler)
                org.GET("/:id/entitlements", getOrgEntitlementsHandler)
        }

        plans := r.Group("/api/subscription-plans")
        {
                plans.GET("", getSubscriptionPlansHandler)
                plans.GET("/:slug", getSubscriptionPlanHandler)
        }

        templates := r.Group("/api/templates")
        {
                templates.GET("/guilds", getGuildTemplatesHandler)
                templates.GET("/channels", getChannelTemplatesHandler)
                templates.POST("/guilds/:slug/apply", auth, applyGuildTemplateHandler)
                templates.POST("/channels/:slug/apply", auth, applyChannelTemplateHandler)
        }

        donations := r.Group("/api/donations")
        {
                donations.GET("/settings", getDonationSettingsHandler)
                donations.POST("/create", createAuthorDonationHandler)
                donations.GET("/my", auth, getMyDonationsHandler)
        }

        manual := r.Group("/api/manual-payments")
        manual.Use(auth)
        {
                manual.POST("/create", createManualPaymentHandler)
                manual.GET("/my", getMyManualPaymentsHandler)
        }

        jarvis := r.Group("/api/jarvis-usage")
        jarvis.Use(auth)
        {
                jarvis.GET("", getJarvisUsageHandler)
                jarvis.POST("/check", checkJarvisLimitHandler)
        }
}

func createOrgHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var req struct {
                Name string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        org := Org{
                Name:      req.Name,
                Status:    "active",
                CreatedAt: time.Now(),
                UpdatedAt: time.Now(),
        }
        if err := db.Create(&org).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
                return
        }

        member := OrgMember{
                OrgID:     org.ID,
                UserID:    int(userID),
                OrgRole:   "admin",
                SeatType:  "staff",
                State:     "active",
                CreatedAt: time.Now(),
                UpdatedAt: time.Now(),
        }
        db.Create(&member)

        c.JSON(http.StatusCreated, org)
}

func listUserOrgsHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var orgs []Org
        db.Joins("JOIN org_members ON org_members.org_id = orgs.id").
                Where("org_members.user_id = ? AND org_members.state = 'active'", userID).
                Find(&orgs)

        c.JSON(http.StatusOK, orgs)
}

func getOrgHandler(c *gin.Context) {
        var org Org
        if err := db.First(&org, c.Param("id")).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
                return
        }
        c.JSON(http.StatusOK, org)
}

func updateOrgHandler(c *gin.Context) {
        var org Org
        if err := db.First(&org, c.Param("id")).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
                return
        }

        var req struct {
                Name   string `json:"name"`
                Status string `json:"status"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.Name != "" {
                org.Name = req.Name
        }
        if req.Status != "" {
                org.Status = req.Status
        }
        org.UpdatedAt = time.Now()

        db.Save(&org)
        c.JSON(http.StatusOK, org)
}

func deleteOrgHandler(c *gin.Context) {
        var org Org
        if err := db.First(&org, c.Param("id")).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
                return
        }

        org.Status = "deleted"
        org.UpdatedAt = time.Now()
        db.Save(&org)

        c.JSON(http.StatusOK, gin.H{"message": "Organization deleted"})
}

func getOrgMembersHandler(c *gin.Context) {
        var members []OrgMember
        db.Where("org_id = ? AND state = 'active'", c.Param("id")).Find(&members)
        c.JSON(http.StatusOK, members)
}

func addOrgMemberHandler(c *gin.Context) {
        userID, _ := getUserIDFromContext(c)
        orgID := c.Param("id")

        var req struct {
                UserID   int    `json:"user_id" binding:"required"`
                OrgRole  string `json:"org_role" binding:"required"`
                SeatType string `json:"seat_type" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        member := OrgMember{
                OrgID:     parseInt(orgID),
                UserID:    req.UserID,
                OrgRole:   req.OrgRole,
                SeatType:  req.SeatType,
                State:     "active",
                InvitedBy: ptrInt(int(userID)),
                CreatedAt: time.Now(),
                UpdatedAt: time.Now(),
        }

        if err := db.Create(&member).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member"})
                return
        }

        c.JSON(http.StatusCreated, member)
}

func updateOrgMemberHandler(c *gin.Context) {
        var member OrgMember
        if err := db.Where("org_id = ? AND user_id = ?", c.Param("id"), c.Param("userId")).First(&member).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
                return
        }

        var req struct {
                OrgRole  string `json:"org_role"`
                SeatType string `json:"seat_type"`
                State    string `json:"state"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.OrgRole != "" {
                member.OrgRole = req.OrgRole
        }
        if req.SeatType != "" {
                member.SeatType = req.SeatType
        }
        if req.State != "" {
                member.State = req.State
        }
        member.UpdatedAt = time.Now()

        db.Save(&member)
        c.JSON(http.StatusOK, member)
}

func removeOrgMemberHandler(c *gin.Context) {
        var member OrgMember
        if err := db.Where("org_id = ? AND user_id = ?", c.Param("id"), c.Param("userId")).First(&member).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
                return
        }

        member.State = "removed"
        member.UpdatedAt = time.Now()
        db.Save(&member)

        c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

func getOrgSubscriptionHandler(c *gin.Context) {
        var sub OrgSubscription
        if err := db.Where("org_id = ? AND status = 'active'", c.Param("id")).First(&sub).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No active subscription"})
                return
        }
        c.JSON(http.StatusOK, sub)
}

func subscribeOrgHandler(c *gin.Context) {
        orgID := parseInt(c.Param("id"))

        var req struct {
                PlanSlug      string `json:"plan_slug" binding:"required"`
                BillingPeriod string `json:"billing_period"`
                PaymentMethod string `json:"payment_method"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var plan SubscriptionPlan
        if err := db.Where("slug = ? AND is_active = true", req.PlanSlug).First(&plan).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
                return
        }

        billingPeriod := req.BillingPeriod
        if billingPeriod == "" {
                billingPeriod = "monthly"
        }

        var endsAt time.Time
        switch billingPeriod {
        case "annual":
                endsAt = time.Now().AddDate(1, 0, 0)
        case "quarterly":
                endsAt = time.Now().AddDate(0, 3, 0)
        default:
                endsAt = time.Now().AddDate(0, 1, 0)
        }

        db.Model(&OrgSubscription{}).Where("org_id = ? AND status = 'active'", orgID).
                Update("status", "cancelled")

        sub := OrgSubscription{
                OrgID:         orgID,
                PlanID:        plan.ID,
                StartsAt:      time.Now(),
                EndsAt:        endsAt,
                AutoRenew:     true,
                PaymentProvider: req.PaymentMethod,
                BillingPeriod: billingPeriod,
                Status:        "active",
                CreatedAt:     time.Now(),
                UpdatedAt:     time.Now(),
        }

        if err := db.Create(&sub).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription"})
                return
        }

        grantOrgEntitlements(orgID, &plan)

        c.JSON(http.StatusCreated, sub)
}

func updateOrgSubscriptionHandler(c *gin.Context) {
        var sub OrgSubscription
        if err := db.Where("org_id = ? AND status = 'active'", c.Param("id")).First(&sub).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No active subscription"})
                return
        }

        var req struct {
                AutoRenew     *bool `json:"auto_renew"`
                SeatsStudent  *int  `json:"seats_student_editor"`
                SeatsStaff    *int  `json:"seats_staff"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.AutoRenew != nil {
                sub.AutoRenew = *req.AutoRenew
        }
        if req.SeatsStudent != nil {
                sub.SeatsStudentEditor = *req.SeatsStudent
        }
        if req.SeatsStaff != nil {
                sub.SeatsStaff = *req.SeatsStaff
        }
        sub.UpdatedAt = time.Now()

        db.Save(&sub)
        c.JSON(http.StatusOK, sub)
}

func cancelOrgSubscriptionHandler(c *gin.Context) {
        var sub OrgSubscription
        if err := db.Where("org_id = ? AND status = 'active'", c.Param("id")).First(&sub).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No active subscription"})
                return
        }

        sub.Status = "cancelled"
        sub.AutoRenew = false
        sub.UpdatedAt = time.Now()
        db.Save(&sub)

        c.JSON(http.StatusOK, gin.H{"message": "Subscription cancelled"})
}

func getOrgBillingHandler(c *gin.Context) {
        orgID := parseInt(c.Param("id"))

        var sub OrgSubscription
        if err := db.Where("org_id = ? AND status = 'active'", orgID).First(&sub).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No active subscription"})
                return
        }

        var plan SubscriptionPlan
        db.First(&plan, sub.PlanID)

        var studentCount, staffCount int64
        db.Model(&OrgMember{}).Where("org_id = ? AND seat_type = 'student_editor' AND state = 'active'", orgID).Count(&studentCount)
        db.Model(&OrgMember{}).Where("org_id = ? AND seat_type = 'staff' AND state = 'active'", orgID).Count(&staffCount)

        var seatPrices []SeatPricing
        db.Where("plan_id = ? AND is_active = true", plan.ID).Find(&seatPrices)

        var studentPrice, staffPrice float64
        for _, sp := range seatPrices {
                if sp.SeatType == "student_editor" {
                        studentPrice = sp.PricePerMonthRub
                }
                if sp.SeatType == "staff" {
                        staffPrice = sp.PricePerMonthRub
                }
        }

        var overageTotal float64
        startOfMonth := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
        var overageRecords []StorageOverageDaily
        db.Where("org_id = ? AND date >= ?", orgID, startOfMonth).Find(&overageRecords)

        if len(overageRecords) > 0 {
                var totalBytes int64
                for _, r := range overageRecords {
                        totalBytes += r.BytesOverRetention
                }
                gbMonth := float64(totalBytes) / (1024 * 1024 * 1024) / float64(len(overageRecords)) * 30.0
                overageTotal = gbMonth * 50.0
        }

        baseCost := plan.BasePriceRub
        seatsCost := float64(studentCount)*studentPrice + float64(staffCount)*staffPrice
        totalCost := baseCost + seatsCost + overageTotal

        c.JSON(http.StatusOK, gin.H{
                "plan":           plan,
                "student_count":  studentCount,
                "staff_count":    staffCount,
                "student_price":  studentPrice,
                "staff_price":    staffPrice,
                "base_cost":      baseCost,
                "seats_cost":     seatsCost,
                "overage_cost":   overageTotal,
                "total_monthly":  totalCost,
                "billing_period": sub.BillingPeriod,
                "ends_at":        sub.EndsAt,
        })
}

func getOrgEntitlementsHandler(c *gin.Context) {
        var entitlements []OrgEntitlement
        db.Where("org_id = ? AND enabled = true", c.Param("id")).Find(&entitlements)
        c.JSON(http.StatusOK, entitlements)
}

func grantOrgEntitlements(orgID int, plan *SubscriptionPlan) {
        db.Where("org_id = ?", orgID).Delete(&OrgEntitlement{})

        entitlements := []OrgEntitlement{
                {
                        OrgID:      orgID,
                        FeatureKey: "video_retention",
                        Enabled:    true,
                        LimitsJSON: fmt.Sprintf(`{"days": %d}`, plan.VideoRetentionDays),
                        CreatedAt:  time.Now(),
                        UpdatedAt:  time.Now(),
                },
                {
                        OrgID:      orgID,
                        FeatureKey: "messages_retention",
                        Enabled:    true,
                        LimitsJSON: fmt.Sprintf(`{"days": %d}`, plan.MessagesRetentionDays),
                        CreatedAt:  time.Now(),
                        UpdatedAt:  time.Now(),
                },
                {
                        OrgID:      orgID,
                        FeatureKey: "jarvis_daily_limit",
                        Enabled:    true,
                        LimitsJSON: fmt.Sprintf(`{"limit": %d}`, plan.JarvisDailyLimit),
                        CreatedAt:  time.Now(),
                        UpdatedAt:  time.Now(),
                },
                {
                        OrgID:      orgID,
                        FeatureKey: "boards_persist",
                        Enabled:    plan.BoardsPersistFlag,
                        LimitsJSON: "{}",
                        CreatedAt:  time.Now(),
                        UpdatedAt:  time.Now(),
                },
                {
                        OrgID:      orgID,
                        FeatureKey: "overage_storage",
                        Enabled:    plan.OverageStorageEnabled,
                        LimitsJSON: `{"price_per_gb": 50}`,
                        CreatedAt:  time.Now(),
                        UpdatedAt:  time.Now(),
                },
                {
                        OrgID:      orgID,
                        FeatureKey: "traffic_reports",
                        Enabled:    plan.TrafficReportsEnabled,
                        LimitsJSON: "{}",
                        CreatedAt:  time.Now(),
                        UpdatedAt:  time.Now(),
                },
        }

        for _, e := range entitlements {
                db.Create(&e)
        }
}

func getSubscriptionPlansHandler(c *gin.Context) {
        var plans []SubscriptionPlan
        db.Where("is_active = true").Find(&plans)
        c.JSON(http.StatusOK, plans)
}

func getSubscriptionPlanHandler(c *gin.Context) {
        var plan SubscriptionPlan
        if err := db.Where("slug = ?", c.Param("slug")).First(&plan).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
                return
        }

        var seatPrices []SeatPricing
        db.Where("plan_id = ? AND is_active = true", plan.ID).Find(&seatPrices)

        var overagePrices []OveragePricing
        db.Where("(plan_id = ? OR plan_id IS NULL) AND is_active = true", plan.ID).Find(&overagePrices)

        c.JSON(http.StatusOK, gin.H{
                "plan":           plan,
                "seat_pricing":   seatPrices,
                "overage_pricing": overagePrices,
        })
}

func getGuildTemplatesHandler(c *gin.Context) {
        requiredPlan := c.Query("plan")
        category := c.Query("category")

        query := db.Model(&GuildTemplate{}).Where("is_active = true")

        if requiredPlan != "" {
                query = query.Where("required_plan = ? OR required_plan = 'free'", requiredPlan)
        }
        if category != "" {
                query = query.Where("category = ?", category)
        }

        var templates []GuildTemplate
        query.Order("usage_count DESC").Find(&templates)

        c.JSON(http.StatusOK, templates)
}

func getChannelTemplatesHandler(c *gin.Context) {
        requiredPlan := c.Query("plan")
        category := c.Query("category")
        channelType := c.Query("type")

        query := db.Model(&ChannelTemplate{}).Where("is_active = true")

        if requiredPlan != "" {
                query = query.Where("required_plan = ? OR required_plan = 'free'", requiredPlan)
        }
        if category != "" {
                query = query.Where("category = ?", category)
        }
        if channelType != "" {
                query = query.Where("type = ?", channelType)
        }

        var templates []ChannelTemplate
        query.Order("usage_count DESC").Find(&templates)

        c.JSON(http.StatusOK, templates)
}

func applyGuildTemplateHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var template GuildTemplate
        if err := db.Where("slug = ? AND is_active = true", c.Param("slug")).First(&template).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
                return
        }

        var req struct {
                GuildName string `json:"guild_name" binding:"required"`
                OrgID     *int   `json:"org_id"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if template.RequiredPlan != "free" && req.OrgID != nil {
                var sub OrgSubscription
                if err := db.Where("org_id = ? AND status = 'active'", *req.OrgID).First(&sub).Error; err != nil {
                        c.JSON(http.StatusForbidden, gin.H{"error": "Active subscription required for this template"})
                        return
                }

                var plan SubscriptionPlan
                db.First(&plan, sub.PlanID)
                if !canUsePlan(plan.Slug, template.RequiredPlan) {
                        c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("This template requires %s plan or higher", template.RequiredPlan)})
                        return
                }
        }

        guild := Guild{
                Name:      req.GuildName,
                OwnerID:   userID,
                CreatedAt: time.Now(),
                UpdatedAt: time.Now(),
        }
        if err := db.Create(&guild).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create guild"})
                return
        }

        var channels []map[string]interface{}
        if err := json.Unmarshal([]byte(template.ChannelsJSON), &channels); err == nil {
                for _, ch := range channels {
                        channel := Channel{
                                GuildID:   guild.ID,
                                Name:      ch["name"].(string),
                                Type:      ch["type"].(string),
                                CreatedAt: time.Now(),
                                UpdatedAt: time.Now(),
                        }
                        db.Create(&channel)
                }
        }

        template.UsageCount++
        db.Save(&template)

        c.JSON(http.StatusCreated, gin.H{
                "guild":    guild,
                "template": template.Name,
                "message":  "Guild created from template",
        })
}

func applyChannelTemplateHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var template ChannelTemplate
        if err := db.Where("slug = ? AND is_active = true", c.Param("slug")).First(&template).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
                return
        }

        var req struct {
                GuildID     uint   `json:"guild_id" binding:"required"`
                ChannelName string `json:"channel_name" binding:"required"`
                OrgID       *int   `json:"org_id"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var guild Guild
        if err := db.First(&guild, req.GuildID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if guild.OwnerID != userID {
                c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to modify this guild"})
                return
        }

        if template.RequiredPlan != "free" && req.OrgID != nil {
                var sub OrgSubscription
                if err := db.Where("org_id = ? AND status = 'active'", *req.OrgID).First(&sub).Error; err != nil {
                        c.JSON(http.StatusForbidden, gin.H{"error": "Active subscription required for this template"})
                        return
                }

                var plan SubscriptionPlan
                db.First(&plan, sub.PlanID)
                if !canUsePlan(plan.Slug, template.RequiredPlan) {
                        c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("This template requires %s plan or higher", template.RequiredPlan)})
                        return
                }
        }

        channel := Channel{
                GuildID:   req.GuildID,
                Name:      req.ChannelName,
                Type:      template.Type,
                CreatedAt: time.Now(),
                UpdatedAt: time.Now(),
        }
        if err := db.Create(&channel).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
                return
        }

        template.UsageCount++
        db.Save(&template)

        c.JSON(http.StatusCreated, gin.H{
                "channel":  channel,
                "template": template.Name,
                "message":  "Channel created from template",
        })
}

func canUsePlan(currentPlan, requiredPlan string) bool {
        planRank := map[string]int{
                "free":      0,
                "edu_basic": 1,
                "edu_pro":   2,
        }
        return planRank[currentPlan] >= planRank[requiredPlan]
}

func getDonationSettingsHandler(c *gin.Context) {
        var settings DonationSettings
        if err := db.First(&settings).Error; err != nil {
                settings = DonationSettings{
                        MinAmountRub:       20,
                        DefaultAmountsJSON: "[20, 50, 100, 500]",
                        ThankYouMessage:    "Спасибо за поддержку!",
                        IsEnabled:          true,
                }
                db.Create(&settings)
        }

        var amounts []int
        json.Unmarshal([]byte(settings.DefaultAmountsJSON), &amounts)

        c.JSON(http.StatusOK, gin.H{
                "min_amount":      settings.MinAmountRub,
                "default_amounts": amounts,
                "thank_you":       settings.ThankYouMessage,
                "is_enabled":      settings.IsEnabled,
        })
}

func createAuthorDonationHandler(c *gin.Context) {
        var req struct {
                Amount float64 `json:"amount" binding:"required"`
                UserID *int    `json:"user_id"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var settings DonationSettings
        db.First(&settings)
        if req.Amount < settings.MinAmountRub {
                c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Minimum donation is %.0f₽", settings.MinAmountRub)})
                return
        }

        donation := Donation{
                UserID:          req.UserID,
                AmountRub:       req.Amount,
                PaymentProvider: "yookassa",
                Status:          "pending",
                CreatedAt:       time.Now(),
        }
        db.Create(&donation)

        c.JSON(http.StatusCreated, gin.H{
                "donation_id": donation.ID,
                "amount":      donation.AmountRub,
                "status":      donation.Status,
                "message":     "Donation created, proceed to payment",
        })
}

func getMyDonationsHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var donations []Donation
        db.Where("user_id = ?", userID).Order("created_at DESC").Find(&donations)
        c.JSON(http.StatusOK, donations)
}

func createManualPaymentHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var req struct {
                OrgID       *int    `json:"org_id"`
                Amount      float64 `json:"amount" binding:"required"`
                Last4Digits string  `json:"last_4_digits" binding:"required,len=4"`
                PayerName   string  `json:"payer_name"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        payment := ManualPayment{
                OrgID:       req.OrgID,
                UserID:      ptrInt(int(userID)),
                Amount:      req.Amount,
                Last4Digits: req.Last4Digits,
                CardNumber:  "4276 **** **** ****",
                PayerName:   req.PayerName,
                Status:      "pending_verification",
                CreatedAt:   time.Now(),
                UpdatedAt:   time.Now(),
        }
        db.Create(&payment)

        c.JSON(http.StatusCreated, gin.H{
                "payment_id":  payment.ID,
                "amount":      payment.Amount,
                "status":      payment.Status,
                "card_number": payment.CardNumber,
                "message":     "Payment registered. Please wait for admin verification.",
        })
}

func getMyManualPaymentsHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var payments []ManualPayment
        db.Where("user_id = ?", userID).Order("created_at DESC").Find(&payments)
        c.JSON(http.StatusOK, payments)
}

func getJarvisUsageHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        today := time.Date(time.Now().Year(), time.Now().Month(), time.Now().Day(), 0, 0, 0, 0, time.UTC)

        var usage JarvisUsage
        if err := db.Where("user_id = ? AND date = ?", userID, today).First(&usage).Error; err != nil {
                usage = JarvisUsage{
                        UserID:       int(userID),
                        Date:         today,
                        RequestCount: 0,
                }
        }

        limit := getJarvisLimitForUser(userID)

        c.JSON(http.StatusOK, gin.H{
                "used":      usage.RequestCount,
                "limit":     limit,
                "remaining": int(math.Max(0, float64(limit-usage.RequestCount))),
                "date":      today,
        })
}

func checkJarvisLimitHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        today := time.Date(time.Now().Year(), time.Now().Month(), time.Now().Day(), 0, 0, 0, 0, time.UTC)
        limit := getJarvisLimitForUser(userID)

        var usage JarvisUsage
        if err := db.Where("user_id = ? AND date = ?", userID, today).First(&usage).Error; err != nil {
                usage = JarvisUsage{
                        UserID:       int(userID),
                        Date:         today,
                        RequestCount: 0,
                        CreatedAt:    time.Now(),
                        UpdatedAt:    time.Now(),
                }
                db.Create(&usage)
        }

        canUse := usage.RequestCount < limit
        if canUse {
                usage.RequestCount++
                usage.UpdatedAt = time.Now()
                db.Save(&usage)
        }

        c.JSON(http.StatusOK, gin.H{
                "can_use":   canUse,
                "used":      usage.RequestCount,
                "limit":     limit,
                "remaining": int(math.Max(0, float64(limit-usage.RequestCount))),
        })
}

func getJarvisLimitForUser(userID uint) int {
        var member OrgMember
        if err := db.Where("user_id = ? AND state = 'active'", userID).First(&member).Error; err == nil {
                var sub OrgSubscription
                if err := db.Where("org_id = ? AND status = 'active'", member.OrgID).First(&sub).Error; err == nil {
                        var plan SubscriptionPlan
                        if err := db.First(&plan, sub.PlanID).Error; err == nil {
                                return plan.JarvisDailyLimit
                        }
                }
        }

        var premium UserPremium
        if err := db.Where("user_id = ? AND is_active = true", userID).First(&premium).Error; err == nil {
                return 50
        }

        return 3
}

func ptrInt(i int) *int {
        return &i
}

func parseInt(s string) int {
        var result int
        fmt.Sscanf(s, "%d", &result)
        return result
}
