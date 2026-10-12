package main

import (
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/gin-gonic/gin"
)

func registerLicenseRoutes(r *gin.Engine, auth gin.HandlerFunc, admin gin.HandlerFunc) {
        license := r.Group("/api/license")
        {
                license.GET("/pricing", getLicensePricingHandler)
                license.POST("/validate", validateLicenseKeyHandler)
                
                licensed := license.Group("")
                licensed.Use(auth)
                {
                        licensed.POST("/activate", activateLicenseHandler)
                        licensed.GET("/status", getLicenseStatusHandler)
                }
        }
        
        adminLicense := r.Group("/api/admin/licenses")
        adminLicense.Use(auth, admin)
        {
                adminLicense.GET("", getAdminLicensesHandler)
                adminLicense.POST("/generate", generateLicenseHandler)
                adminLicense.POST("/generate-batch", generateBatchLicensesHandler)
                adminLicense.GET("/stats", getLicenseStatsHandler)
        }
        
        ads := r.Group("/api/ads")
        {
                ads.GET("/system", getSystemAdsHandler)
                ads.POST("/:id/click", recordAdClickHandler)
                
                adsAuth := ads.Group("")
                adsAuth.Use(auth)
                {
                        adsAuth.POST("/request", createAdRequestHandler)
                        adsAuth.GET("/my-requests", getMyAdRequestsHandler)
                }
        }
        
        adminAds := r.Group("/api/admin/ads")
        adminAds.Use(auth, admin)
        {
                adminAds.GET("/requests", getAdRequestsHandler)
                adminAds.GET("/requests/:id", getAdRequestHandler)
                adminAds.PUT("/requests/:id/review", reviewAdRequestHandler)
                
                adminAds.GET("/system", getAdminSystemAdsHandler)
                adminAds.POST("/system", createSystemAdHandler)
                adminAds.PUT("/system/:id", updateSystemAdHandler)
                adminAds.DELETE("/system/:id", deleteSystemAdHandler)
        }
}

func getLicensePricingHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
                "pricing": LicensePricingOptions,
                "benefits": []string{
                        "Full access to registration and login",
                        "No platform/system ads from Nemaks",
                        "User-generated advertising requires Super Admin approval",
                },
                "benefits_ru": []string{
                        "Полный доступ к регистрации и авторизации",
                        "Без системной рекламы от платформы Nemaks",
                        "Пользовательская реклама требует одобрения Super Admin",
                },
        })
}

func validateLicenseKeyHandler(c *gin.Context) {
        var req struct {
                Key string `json:"key" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "License key is required"})
                return
        }
        
        if !isValidKeyFormat(req.Key) {
                c.JSON(http.StatusBadRequest, gin.H{"valid": false, "error": "Invalid key format. Expected: NEMKS-XXXXX-XXXXX-XXXXX"})
                return
        }
        
        // Пробный ключ - 25 дней Premium (только если явно разрешён env
        // ALLOW_TEST_LICENSE_KEY=true; в проде отклоняется как обычный невалидный ключ)
        if req.Key == TestLicenseKey {
                if !IsTestLicenseKeyAllowed() {
                        c.JSON(http.StatusNotFound, gin.H{"valid": false, "error": "License key not found"})
                        return
                }
                c.JSON(http.StatusOK, gin.H{
                        "valid":         true,
                        "type":          "PREMIUM",
                        "duration_days": 25,
                        "test_key":      true,
                })
                return
        }
        
        var licenseKey LicenseKey
        if err := db.Where("key = ?", req.Key).First(&licenseKey).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"valid": false, "error": "License key not found"})
                return
        }
        
        if licenseKey.IsUsed {
                c.JSON(http.StatusOK, gin.H{"valid": false, "error": "License key already used"})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "valid":         true,
                "type":          licenseKey.Type,
                "duration_days": licenseKey.DurationDays,
        })
}

func isValidKeyFormat(key string) bool {
        if len(key) != 23 {
                return false
        }
        parts := strings.Split(key, "-")
        if len(parts) != 4 {
                return false
        }
        if parts[0] != "NEMKS" {
                return false
        }
        for i := 1; i < 4; i++ {
                if len(parts[i]) != 5 {
                        return false
                }
        }
        return true
}

func activateLicenseHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                Key string `json:"key" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "License key is required"})
                return
        }
        
        license, err := ActivateLicense(userID, req.Key)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "success": true,
                "license": license,
                "message": "License activated successfully",
        })
}

func getLicenseStatusHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        license, err := GetUserLicense(userID)
        if err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "has_license":    false,
                        "is_active":      false,
                        "days_remaining": 0,
                })
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "has_license":    true,
                "is_active":      !license.IsExpired(),
                "type":           license.Type,
                "activated_at":   license.ActivatedAt,
                "expires_at":     license.ExpiresAt,
                "days_remaining": license.DaysRemaining(),
        })
}

func getAdminLicensesHandler(c *gin.Context) {
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset := (page - 1) * limit
        
        var total int64
        db.Model(&LicenseKey{}).Count(&total)
        
        var licenses []LicenseKey
        db.Preload("User").Order("created_at DESC").Offset(offset).Limit(limit).Find(&licenses)
        
        c.JSON(http.StatusOK, gin.H{
                "licenses": licenses,
                "total":    total,
                "page":     page,
                "limit":    limit,
        })
}

func generateLicenseHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                Type LicenseType `json:"type" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        license, err := CreateLicenseKey(req.Type, userID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate license"})
                return
        }
        
        c.JSON(http.StatusCreated, license)
}

func generateBatchLicensesHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                Type  LicenseType `json:"type" binding:"required"`
                Count int         `json:"count" binding:"required,min=1,max=100"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var licenses []LicenseKey
        for i := 0; i < req.Count; i++ {
                license, err := CreateLicenseKey(req.Type, userID)
                if err != nil {
                        continue
                }
                licenses = append(licenses, *license)
        }
        
        c.JSON(http.StatusCreated, gin.H{
                "licenses": licenses,
                "count":    len(licenses),
        })
}

func getLicenseStatsHandler(c *gin.Context) {
        var totalKeys int64
        var usedKeys int64
        var activeUsers int64
        
        db.Model(&LicenseKey{}).Count(&totalKeys)
        db.Model(&LicenseKey{}).Where("is_used = ?", true).Count(&usedKeys)
        db.Model(&UserLicense{}).Where("is_active = ? AND expires_at > ?", true, time.Now()).Count(&activeUsers)
        
        var revenueRUB int64
        db.Model(&LicenseKey{}).Where("is_used = ?", true).Select("COALESCE(SUM(price_rub), 0)").Scan(&revenueRUB)
        
        c.JSON(http.StatusOK, gin.H{
                "total_keys":       totalKeys,
                "used_keys":        usedKeys,
                "unused_keys":      totalKeys - usedKeys,
                "active_users":     activeUsers,
                "revenue_rub":      revenueRUB,
        })
}

func getSystemAdsHandler(c *gin.Context) {
        var ads []SystemAd
        now := time.Now()
        
        db.Where("is_active = ? AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)", 
                true, now, now).
                Order("priority DESC").
                Limit(5).
                Find(&ads)
        
        for i := range ads {
                db.Model(&ads[i]).UpdateColumn("impressions", ads[i].Impressions+1)
        }
        
        c.JSON(http.StatusOK, ads)
}

func recordAdClickHandler(c *gin.Context) {
        adID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ad ID"})
                return
        }
        
        db.Model(&SystemAd{}).Where("id = ?", adID).UpdateColumn("clicks", db.Raw("clicks + 1"))
        
        c.JSON(http.StatusOK, gin.H{"success": true})
}

func createAdRequestHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                Type      AdRequestType `json:"type" binding:"required"`
                Title     string        `json:"title" binding:"required"`
                Content   string        `json:"content" binding:"required"`
                TargetURL string        `json:"target_url"`
                ImageURL  string        `json:"image_url"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        adRequest := AdRequest{
                UserID:    userID,
                Type:      req.Type,
                Title:     req.Title,
                Content:   req.Content,
                TargetURL: req.TargetURL,
                ImageURL:  req.ImageURL,
                Status:    AdStatusPending,
        }
        
        if err := db.Create(&adRequest).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ad request"})
                return
        }
        
        c.JSON(http.StatusCreated, adRequest)
}

func getMyAdRequestsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var requests []AdRequest
        db.Where("user_id = ?", userID).Order("created_at DESC").Find(&requests)
        
        c.JSON(http.StatusOK, requests)
}

func getAdRequestsHandler(c *gin.Context) {
        status := c.Query("status")
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
        offset := (page - 1) * limit
        
        query := db.Model(&AdRequest{}).Preload("User")
        if status != "" {
                query = query.Where("status = ?", status)
        }
        
        var total int64
        query.Count(&total)
        
        var requests []AdRequest
        query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&requests)
        
        c.JSON(http.StatusOK, gin.H{
                "requests": requests,
                "total":    total,
                "page":     page,
                "limit":    limit,
        })
}

func getAdRequestHandler(c *gin.Context) {
        id, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
                return
        }
        
        var request AdRequest
        if err := db.Preload("User").First(&request, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Ad request not found"})
                return
        }
        
        c.JSON(http.StatusOK, request)
}

func reviewAdRequestHandler(c *gin.Context) {
        adminID := c.GetUint("user_id")
        id, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
                return
        }
        
        var req struct {
                Status       AdRequestStatus `json:"status" binding:"required"`
                ReviewNote   string          `json:"review_note"`
                PriceCoins   *int            `json:"price_coins,omitempty"`
                PriceRUB     *int            `json:"price_rub,omitempty"`
                DurationDays *int            `json:"duration_days,omitempty"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var adRequest AdRequest
        if err := db.First(&adRequest, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Ad request not found"})
                return
        }
        
        now := time.Now()
        adRequest.Status = req.Status
        adRequest.ReviewNote = req.ReviewNote
        adRequest.ReviewedBy = &adminID
        adRequest.ReviewedAt = &now
        adRequest.PriceCoins = req.PriceCoins
        adRequest.PriceRUB = req.PriceRUB
        adRequest.DurationDays = req.DurationDays
        
        if req.Status == AdStatusApproved && req.DurationDays != nil {
                startsAt := now
                endsAt := now.AddDate(0, 0, *req.DurationDays)
                adRequest.StartsAt = &startsAt
                adRequest.EndsAt = &endsAt
        }
        
        db.Save(&adRequest)
        
        c.JSON(http.StatusOK, adRequest)
}

func getAdminSystemAdsHandler(c *gin.Context) {
        var ads []SystemAd
        db.Order("created_at DESC").Find(&ads)
        c.JSON(http.StatusOK, ads)
}

func createSystemAdHandler(c *gin.Context) {
        var ad SystemAd
        if err := c.ShouldBindJSON(&ad); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        if err := db.Create(&ad).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ad"})
                return
        }
        
        c.JSON(http.StatusCreated, ad)
}

func updateSystemAdHandler(c *gin.Context) {
        id, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ad ID"})
                return
        }
        
        var ad SystemAd
        if err := db.First(&ad, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Ad not found"})
                return
        }
        
        var updates SystemAd
        if err := c.ShouldBindJSON(&updates); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        db.Model(&ad).Updates(updates)
        c.JSON(http.StatusOK, ad)
}

func deleteSystemAdHandler(c *gin.Context) {
        id, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ad ID"})
                return
        }
        
        if err := db.Delete(&SystemAd{}, id).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ad"})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{"success": true})
}

func shouldShowAds(userID uint) bool {
        if userID == 0 {
                return true
        }
        return !HasValidLicense(userID)
}
