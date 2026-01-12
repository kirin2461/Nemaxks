package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func setupAdminOrgRoutes(r *gin.Engine, auth, adminAuth gin.HandlerFunc) {
	admin := r.Group("/api/admin")
	admin.Use(auth, adminAuth)
	{
		admin.GET("/orgs", getAdminOrgsHandler)
		admin.GET("/orgs/:id", getAdminOrgDetailsHandler)
		admin.PUT("/orgs/:id", updateAdminOrgHandler)
		admin.DELETE("/orgs/:id", deleteAdminOrgHandler)

		admin.GET("/org-subscriptions", getAdminOrgSubscriptionsHandler)
		admin.PUT("/org-subscriptions/:id", updateAdminOrgSubscriptionHandler)

		admin.GET("/manual-payments", getAdminManualPaymentsHandler)
		admin.PUT("/manual-payments/:id/verify", verifyManualPaymentHandler)
		admin.PUT("/manual-payments/:id/reject", rejectManualPaymentHandler)

		admin.GET("/donations", getAdminDonationsHandler)
		admin.PUT("/donation-settings", updateDonationSettingsHandler)

		admin.GET("/subscription-plans", getAdminSubscriptionPlansHandler)
		admin.POST("/subscription-plans", createSubscriptionPlanHandler)
		admin.PUT("/subscription-plans/:id", updateSubscriptionPlanHandler)
		admin.DELETE("/subscription-plans/:id", deleteSubscriptionPlanHandler)

		admin.GET("/templates/guilds", getAdminGuildTemplatesHandler)
		admin.POST("/templates/guilds", createGuildTemplateHandler)
		admin.PUT("/templates/guilds/:id", updateGuildTemplateHandler)
		admin.DELETE("/templates/guilds/:id", deleteGuildTemplateHandler)

		admin.GET("/templates/channels", getAdminChannelTemplatesHandler)
		admin.POST("/templates/channels", createChannelTemplateHandler)
		admin.PUT("/templates/channels/:id", updateChannelTemplateHandler)
		admin.DELETE("/templates/channels/:id", deleteChannelTemplateHandler)
	}
}

func getAdminOrgsHandler(c *gin.Context) {
	var orgs []Org
	db.Order("created_at DESC").Find(&orgs)

	type OrgWithStats struct {
		Org
		MemberCount int64  `json:"member_count"`
		PlanName    string `json:"plan_name"`
		Status      string `json:"subscription_status"`
	}

	var result []OrgWithStats
	for _, org := range orgs {
		var memberCount int64
		db.Model(&OrgMember{}).Where("org_id = ? AND state = 'active'", org.ID).Count(&memberCount)

		var sub OrgSubscription
		planName := "Free"
		subStatus := "none"
		if err := db.Where("org_id = ? AND status = 'active'", org.ID).First(&sub).Error; err == nil {
			var plan SubscriptionPlan
			if db.First(&plan, sub.PlanID).Error == nil {
				planName = plan.Name
			}
			subStatus = sub.Status
		}

		result = append(result, OrgWithStats{
			Org:         org,
			MemberCount: memberCount,
			PlanName:    planName,
			Status:      subStatus,
		})
	}

	c.JSON(http.StatusOK, result)
}

func getAdminOrgDetailsHandler(c *gin.Context) {
	var org Org
	if err := db.First(&org, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	var members []OrgMember
	db.Where("org_id = ?", org.ID).Find(&members)

	var sub OrgSubscription
	db.Where("org_id = ?", org.ID).Order("created_at DESC").First(&sub)

	var entitlements []OrgEntitlement
	db.Where("org_id = ?", org.ID).Find(&entitlements)

	c.JSON(http.StatusOK, gin.H{
		"org":          org,
		"members":      members,
		"subscription": sub,
		"entitlements": entitlements,
	})
}

func updateAdminOrgHandler(c *gin.Context) {
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

func deleteAdminOrgHandler(c *gin.Context) {
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

func getAdminOrgSubscriptionsHandler(c *gin.Context) {
	var subs []OrgSubscription
	db.Order("created_at DESC").Find(&subs)
	c.JSON(http.StatusOK, subs)
}

func updateAdminOrgSubscriptionHandler(c *gin.Context) {
	var sub OrgSubscription
	if err := db.First(&sub, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
		return
	}

	var req struct {
		Status    string     `json:"status"`
		EndsAt    *time.Time `json:"ends_at"`
		AutoRenew *bool      `json:"auto_renew"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status != "" {
		sub.Status = req.Status
	}
	if req.EndsAt != nil {
		sub.EndsAt = *req.EndsAt
	}
	if req.AutoRenew != nil {
		sub.AutoRenew = *req.AutoRenew
	}
	sub.UpdatedAt = time.Now()

	db.Save(&sub)
	c.JSON(http.StatusOK, sub)
}

func getAdminManualPaymentsHandler(c *gin.Context) {
	status := c.Query("status")

	query := db.Model(&ManualPayment{}).Order("created_at DESC")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var payments []ManualPayment
	query.Find(&payments)
	c.JSON(http.StatusOK, payments)
}

func verifyManualPaymentHandler(c *gin.Context) {
	userID, _ := getUserIDFromContext(c)

	var payment ManualPayment
	if err := db.First(&payment, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	var req struct {
		AdminNotes string `json:"admin_notes"`
	}
	c.ShouldBindJSON(&req)

	now := time.Now()
	payment.Status = "verified"
	payment.VerifiedBy = ptrInt(int(userID))
	payment.VerifiedAt = &now
	payment.AdminNotes = req.AdminNotes
	payment.UpdatedAt = now
	db.Save(&payment)

	if payment.OrgID != nil {
		var sub OrgSubscription
		if err := db.Where("org_id = ? AND status = 'pending_payment'", *payment.OrgID).First(&sub).Error; err == nil {
			sub.Status = "active"
			sub.StartsAt = now
			sub.EndsAt = now.AddDate(0, 1, 0)
			sub.UpdatedAt = now
			db.Save(&sub)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment verified",
		"payment": payment,
	})
}

func rejectManualPaymentHandler(c *gin.Context) {
	userID, _ := getUserIDFromContext(c)

	var payment ManualPayment
	if err := db.First(&payment, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	var req struct {
		AdminNotes string `json:"admin_notes"`
	}
	c.ShouldBindJSON(&req)

	now := time.Now()
	payment.Status = "rejected"
	payment.VerifiedBy = ptrInt(int(userID))
	payment.VerifiedAt = &now
	payment.AdminNotes = req.AdminNotes
	payment.UpdatedAt = now
	db.Save(&payment)

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment rejected",
		"payment": payment,
	})
}

func getAdminDonationsHandler(c *gin.Context) {
	var donations []Donation
	db.Order("created_at DESC").Find(&donations)

	var total float64
	db.Model(&Donation{}).Where("status = 'paid'").Select("COALESCE(SUM(amount_rub), 0)").Scan(&total)

	c.JSON(http.StatusOK, gin.H{
		"donations":     donations,
		"total_donated": total,
	})
}

func updateDonationSettingsHandler(c *gin.Context) {
	var settings DonationSettings
	db.First(&settings)

	var req struct {
		MinAmountRub       *float64 `json:"min_amount_rub"`
		DefaultAmountsJSON string   `json:"default_amounts_json"`
		ThankYouMessage    string   `json:"thank_you_message"`
		IsEnabled          *bool    `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MinAmountRub != nil {
		settings.MinAmountRub = *req.MinAmountRub
	}
	if req.DefaultAmountsJSON != "" {
		settings.DefaultAmountsJSON = req.DefaultAmountsJSON
	}
	if req.ThankYouMessage != "" {
		settings.ThankYouMessage = req.ThankYouMessage
	}
	if req.IsEnabled != nil {
		settings.IsEnabled = *req.IsEnabled
	}
	settings.UpdatedAt = time.Now()

	db.Save(&settings)
	c.JSON(http.StatusOK, settings)
}

func getAdminSubscriptionPlansHandler(c *gin.Context) {
	var plans []SubscriptionPlan
	db.Order("base_price_rub ASC").Find(&plans)

	type PlanWithPricing struct {
		SubscriptionPlan
		SeatPricing    []SeatPricing    `json:"seat_pricing"`
		OveragePricing []OveragePricing `json:"overage_pricing"`
	}

	var result []PlanWithPricing
	for _, plan := range plans {
		var seats []SeatPricing
		var overage []OveragePricing
		db.Where("plan_id = ?", plan.ID).Find(&seats)
		db.Where("plan_id = ?", plan.ID).Find(&overage)

		result = append(result, PlanWithPricing{
			SubscriptionPlan: plan,
			SeatPricing:      seats,
			OveragePricing:   overage,
		})
	}

	c.JSON(http.StatusOK, result)
}

func createSubscriptionPlanHandler(c *gin.Context) {
	var plan SubscriptionPlan
	if err := c.ShouldBindJSON(&plan); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plan.CreatedAt = time.Now()
	plan.UpdatedAt = time.Now()
	plan.IsActive = true

	if err := db.Create(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create plan"})
		return
	}

	c.JSON(http.StatusCreated, plan)
}

func updateSubscriptionPlanHandler(c *gin.Context) {
	var plan SubscriptionPlan
	if err := db.First(&plan, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates["updated_at"] = time.Now()
	db.Model(&plan).Updates(updates)
	db.First(&plan, c.Param("id"))

	c.JSON(http.StatusOK, plan)
}

func deleteSubscriptionPlanHandler(c *gin.Context) {
	var plan SubscriptionPlan
	if err := db.First(&plan, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
		return
	}

	plan.IsActive = false
	plan.UpdatedAt = time.Now()
	db.Save(&plan)

	c.JSON(http.StatusOK, gin.H{"message": "Plan deactivated"})
}

func getAdminGuildTemplatesHandler(c *gin.Context) {
	var templates []GuildTemplate
	db.Order("usage_count DESC").Find(&templates)
	c.JSON(http.StatusOK, templates)
}

func createGuildTemplateHandler(c *gin.Context) {
	var template GuildTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	template.CreatedAt = time.Now()
	template.UpdatedAt = time.Now()
	template.IsActive = true

	if err := db.Create(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template"})
		return
	}

	c.JSON(http.StatusCreated, template)
}

func updateGuildTemplateHandler(c *gin.Context) {
	var template GuildTemplate
	if err := db.First(&template, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates["updated_at"] = time.Now()
	db.Model(&template).Updates(updates)
	db.First(&template, c.Param("id"))

	c.JSON(http.StatusOK, template)
}

func deleteGuildTemplateHandler(c *gin.Context) {
	var template GuildTemplate
	if err := db.First(&template, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	template.IsActive = false
	template.UpdatedAt = time.Now()
	db.Save(&template)

	c.JSON(http.StatusOK, gin.H{"message": "Template deactivated"})
}

func getAdminChannelTemplatesHandler(c *gin.Context) {
	var templates []ChannelTemplate
	db.Order("usage_count DESC").Find(&templates)
	c.JSON(http.StatusOK, templates)
}

func createChannelTemplateHandler(c *gin.Context) {
	var template ChannelTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	template.CreatedAt = time.Now()
	template.UpdatedAt = time.Now()
	template.IsActive = true

	if err := db.Create(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template"})
		return
	}

	c.JSON(http.StatusCreated, template)
}

func updateChannelTemplateHandler(c *gin.Context) {
	var template ChannelTemplate
	if err := db.First(&template, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates["updated_at"] = time.Now()
	db.Model(&template).Updates(updates)
	db.First(&template, c.Param("id"))

	c.JSON(http.StatusOK, template)
}

func deleteChannelTemplateHandler(c *gin.Context) {
	var template ChannelTemplate
	if err := db.First(&template, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	template.IsActive = false
	template.UpdatedAt = time.Now()
	db.Save(&template)

	c.JSON(http.StatusOK, gin.H{"message": "Template deactivated"})
}
