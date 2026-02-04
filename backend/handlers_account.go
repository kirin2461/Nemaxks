package main

import (
        "net/http"
        "time"

        "github.com/gin-gonic/gin"
        "golang.org/x/crypto/bcrypt"
)

func registerAccountRoutes(r *gin.Engine, auth gin.HandlerFunc) {
        account := r.Group("/api/account")
        account.Use(auth)
        {
                account.POST("/delete", requestAccountDeletionHandler)
                account.POST("/cancel-deletion", cancelAccountDeletionHandler)
                account.POST("/withdraw-consent", withdrawConsentHandler)
                account.GET("/status", getAccountStatusHandler)
        }
}

type DeleteAccountRequest struct {
        Password string `json:"password" binding:"required"`
        Reason   string `json:"reason"`
}

func requestAccountDeletionHandler(c *gin.Context) {
        userID := c.GetUint("userID")
        
        var req DeleteAccountRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Password is required"})
                return
        }
        
        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }
        
        if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
                return
        }
        
        if user.DeletionScheduledAt != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Account deletion already scheduled"})
                return
        }
        
        deletionDate := time.Now().AddDate(0, 0, 90)
        reason := req.Reason
        if reason == "" {
                reason = "User requested account deletion"
        }
        
        user.DeletionScheduledAt = &deletionDate
        user.DeletionReason = reason
        user.Status = "deletion_pending"
        
        if err := db.Save(&user).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to schedule deletion"})
                return
        }
        
        logExtendedAudit(userID, "account_deletion_scheduled", "user", string(rune(userID)), "global", reason, c.ClientIP(), c.GetHeader("User-Agent"))
        
        c.JSON(http.StatusOK, gin.H{
                "message":       "Account deletion scheduled",
                "deletion_date": deletionDate.Format("2006-01-02"),
                "days_remaining": 90,
        })
}

func cancelAccountDeletionHandler(c *gin.Context) {
        userID := c.GetUint("userID")
        
        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }
        
        if user.DeletionScheduledAt == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "No deletion scheduled"})
                return
        }
        
        if user.IsBlocked && user.BlockReason == "consent_withdrawn" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Cannot cancel deletion after consent withdrawal. Please contact support."})
                return
        }
        
        user.DeletionScheduledAt = nil
        user.DeletionReason = ""
        user.Status = "online"
        
        if err := db.Save(&user).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel deletion"})
                return
        }
        
        logExtendedAudit(userID, "account_deletion_cancelled", "user", string(rune(userID)), "global", "", c.ClientIP(), c.GetHeader("User-Agent"))
        
        c.JSON(http.StatusOK, gin.H{"message": "Account deletion cancelled"})
}

type WithdrawConsentRequest struct {
        Password string `json:"password" binding:"required"`
        Confirm  bool   `json:"confirm" binding:"required"`
}

func withdrawConsentHandler(c *gin.Context) {
        userID := c.GetUint("userID")
        
        var req WithdrawConsentRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Password and confirmation required"})
                return
        }
        
        if !req.Confirm {
                c.JSON(http.StatusBadRequest, gin.H{"error": "You must confirm consent withdrawal"})
                return
        }
        
        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }
        
        if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
                return
        }
        
        deletionDate := time.Now().AddDate(0, 0, 90)
        
        user.IsBlocked = true
        user.BlockReason = "consent_withdrawn"
        user.DeletionScheduledAt = &deletionDate
        user.DeletionReason = "Consent to personal data processing withdrawn"
        user.Status = "blocked"
        
        if err := db.Save(&user).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process consent withdrawal"})
                return
        }
        
        logExtendedAudit(userID, "consent_withdrawn", "user", string(rune(userID)), "global", "User withdrew consent to data processing", c.ClientIP(), c.GetHeader("User-Agent"))
        
        c.JSON(http.StatusOK, gin.H{
                "message":       "Consent withdrawn. Your account has been blocked and will be deleted after 90 days.",
                "deletion_date": deletionDate.Format("2006-01-02"),
        })
}

func getAccountStatusHandler(c *gin.Context) {
        userID := c.GetUint("userID")
        
        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }
        
        response := gin.H{
                "is_blocked":   user.IsBlocked,
                "block_reason": user.BlockReason,
        }
        
        if user.DeletionScheduledAt != nil {
                daysRemaining := int(time.Until(*user.DeletionScheduledAt).Hours() / 24)
                if daysRemaining < 0 {
                        daysRemaining = 0
                }
                response["deletion_scheduled"] = true
                response["deletion_date"] = user.DeletionScheduledAt.Format("2006-01-02")
                response["deletion_reason"] = user.DeletionReason
                response["days_remaining"] = daysRemaining
        } else {
                response["deletion_scheduled"] = false
        }
        
        c.JSON(http.StatusOK, response)
}

func ProcessScheduledDeletions() {
        var users []User
        db.Where("deletion_scheduled_at < ? AND deletion_scheduled_at IS NOT NULL", time.Now()).Find(&users)
        
        for _, user := range users {
                deleteUserData(user.ID)
        }
}

func deleteUserData(userID uint) {
        db.Where("user_id = ?", userID).Delete(&DirectMessage{})
        db.Where("user_id = ?", userID).Delete(&Friend{})
        db.Where("requester_id = ? OR receiver_id = ?", userID, userID).Delete(&FriendRequest{})
        db.Where("sender_id = ?", userID).Delete(&Message{})
        db.Where("user_id = ?", userID).Delete(&GuildMember{})
        db.Where("user_id = ?", userID).Delete(&UserLicense{})
        db.Where("user_id = ?", userID).Delete(&UserKeyPair{})
        db.Where("user_id = ?", userID).Delete(&UserRiskScore{})
        db.Where("user_id = ?", userID).Delete(&FraudAlert{})
        
        db.Delete(&User{}, userID)
        
        logExtendedAudit(0, "user_data_deleted", "user", string(rune(userID)), "global", "Scheduled deletion completed", "", "")
}
