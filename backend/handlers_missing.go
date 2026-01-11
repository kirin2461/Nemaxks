package main

import (
        "log"
        "net/http"
        "os"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

// Messages
func getMessagesByChannelHandler(c *gin.Context) {
        channelID := c.Param("channel_id")
        var messages []Message
        db.Where("channel_id = ?", channelID).Order("created_at asc").Find(&messages)
        c.JSON(http.StatusOK, messages)
}

func createChannelMessageHandler(c *gin.Context) {
        channelID, _ := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        userID, _ := c.Get("user_id")

        var req struct {
                Content string `json:"content" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        msg := Message{
                ChannelID: uint(channelID),
                AuthorID:  uint(userID.(float64)),
                Content:   req.Content,
        }
        db.Create(&msg)
        c.JSON(http.StatusCreated, msg)
}

// RTC
func getICEServersHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
                "iceServers": []gin.H{
                        {"urls": "stun:stun.l.google.com:19302"},
                },
        })
}

// Posts
func getPostsHandler(c *gin.Context) {
        filter := c.Query("filter")
        tag := c.Query("tag")
        limitStr := c.DefaultQuery("limit", "20")
        offsetStr := c.DefaultQuery("offset", "0")
        
        limit, _ := strconv.Atoi(limitStr)
        offset, _ := strconv.Atoi(offsetStr)
        if limit <= 0 || limit > 50 {
                limit = 20
        }
        if offset < 0 {
                offset = 0
        }
        
        var posts []Post
        
        // Get current user ID if authenticated
        var currentUserID uint
        if userID, exists := c.Get("user_id"); exists {
                currentUserID = uint(userID.(float64))
        }
        
        // Build base conditions that apply to both count and fetch queries
        var followingIDs []uint
        
        switch filter {
        case "following":
                // Get posts from users the current user follows
                if currentUserID > 0 {
                        db.Model(&Subscription{}).Where("follower_id = ?", currentUserID).Pluck("following_id", &followingIDs)
                        if len(followingIDs) == 0 {
                                c.JSON(http.StatusOK, gin.H{"posts": []map[string]interface{}{}, "has_more": false})
                                return
                        }
                } else {
                        c.JSON(http.StatusOK, gin.H{"posts": []map[string]interface{}{}, "has_more": false})
                        return
                }
        }
        
        // Build query with conditions
        query := db.Model(&Post{}).Preload("Author")
        
        // Apply tag filter
        if tag != "" {
                query = query.Where("tags LIKE ?", "%"+tag+"%")
        }
        
        // Apply following filter
        if filter == "following" && len(followingIDs) > 0 {
                query = query.Where("author_id IN ?", followingIDs)
        }
        
        // Apply ordering
        switch filter {
        case "trending":
                query = query.Order("likes DESC, created_at DESC")
        default:
                query = query.Order("created_at DESC")
        }
        
        // Fetch one extra to determine has_more
        query.Limit(limit + 1).Offset(offset).Find(&posts)
        
        hasMore := len(posts) > limit
        if hasMore {
                posts = posts[:limit]
        }
        
        // Enrich posts with rating info and user-specific data
        type PostResponse struct {
                Post
                AverageRating float64 `json:"average_rating"`
                RatingCount   int     `json:"rating_count"`
                UserRating    int     `json:"user_rating"`
                IsLiked       bool    `json:"is_liked"`
                IsBookmarked  bool    `json:"is_bookmarked"`
        }
        
        var response []PostResponse
        for _, post := range posts {
                pr := PostResponse{Post: post}
                
                // Get average rating
                var avgResult struct {
                        Average float64
                        Count   int64
                }
                db.Model(&PostRating{}).Where("post_id = ?", post.ID).
                        Select("COALESCE(AVG(rating), 0) as average, COUNT(*) as count").
                        Scan(&avgResult)
                pr.AverageRating = avgResult.Average
                pr.RatingCount = int(avgResult.Count)
                
                // Get user's rating and like/bookmark status if authenticated
                if currentUserID > 0 {
                        var userRating PostRating
                        if db.Where("post_id = ? AND user_id = ?", post.ID, currentUserID).First(&userRating).RowsAffected > 0 {
                                pr.UserRating = userRating.Rating
                        }
                        
                        var like PostLike
                        pr.IsLiked = db.Where("post_id = ? AND user_id = ?", post.ID, currentUserID).First(&like).RowsAffected > 0
                        
                        var bookmark PostBookmark
                        pr.IsBookmarked = db.Where("post_id = ? AND user_id = ?", post.ID, currentUserID).First(&bookmark).RowsAffected > 0
                }
                
                response = append(response, pr)
        }
        
        c.JSON(http.StatusOK, gin.H{
                "posts":    response,
                "has_more": hasMore,
        })
}

func createPostHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                Title   string `json:"title" binding:"required"`
                Content string `json:"content" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        post := Post{
                AuthorID: uint(userID.(float64)),
                Title:    req.Title,
                Content:  req.Content,
        }
        if err := db.Create(&post).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post"})
                return
        }
        c.JSON(http.StatusCreated, post)
}

func getPlatformStatsHandler(c *gin.Context) {
        var userCount, guildCount, messageCount int64
        db.Model(&User{}).Count(&userCount)
        db.Model(&Guild{}).Count(&guildCount)
        db.Model(&Message{}).Count(&messageCount)

        c.JSON(http.StatusOK, gin.H{
                "users":    userCount,
                "guilds":   guildCount,
                "messages": messageCount,
                "uptime":   time.Since(startTime).String(),
        })
}

var startTime = time.Now()

func getLiveStreamsHandler(c *gin.Context) {
        // Placeholder for live streams integration
        c.JSON(http.StatusOK, []gin.H{})
}

// Videos
func getVideosHandler(c *gin.Context) {
        var videos []Video
        db.Find(&videos)
        c.JSON(http.StatusOK, videos)
}

func getVideoHandler(c *gin.Context) {
        id := c.Param("id")
        var video Video
        if err := db.First(&video, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
                return
        }
        c.JSON(http.StatusOK, video)
}

func createVideoHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                Title string `json:"title" binding:"required"`
                URL   string `json:"url" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        video := Video{
                AuthorID: uint(userID.(float64)),
                Title:    req.Title,
                VideoURL: req.URL,
        }
        db.Create(&video)
        c.JSON(http.StatusCreated, video)
}

func updateVideoHandler(c *gin.Context) {
        id := c.Param("id")
        var video Video
        if err := db.First(&video, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
                return
        }
        c.BindJSON(&video)
        db.Save(&video)
        c.JSON(http.StatusOK, video)
}

func deleteVideoHandler(c *gin.Context) {
        id := c.Param("id")
        db.Delete(&Video{}, id)
        c.JSON(http.StatusOK, gin.H{"message": "Video deleted"})
}

// Post Likes
func likePostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "liked"})
}
func unlikePostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unliked"})
}

// Post Bookmarks
func bookmarkPostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "bookmarked"})
}
func unbookmarkPostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unbookmarked"})
}

// Subscriptions
func getSubscriptionsHandler(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
                return
        }
        uid := uint(userID.(float64))
        
        var subscriptions []Subscription
        db.Where("follower_id = ?", uid).Find(&subscriptions)
        
        type SubResponse struct {
                ID          uint   `json:"id"`
                FollowingID uint   `json:"following_id"`
                UserID      uint   `json:"user_id"`
                Username    string `json:"username"`
                Avatar      string `json:"avatar,omitempty"`
        }
        
        var response []SubResponse
        for _, sub := range subscriptions {
                var user User
                if db.First(&user, sub.FollowingID).RowsAffected > 0 {
                        avatar := ""
                        if user.Avatar != nil {
                                avatar = *user.Avatar
                        }
                        response = append(response, SubResponse{
                                ID:          sub.ID,
                                FollowingID: sub.FollowingID,
                                UserID:      sub.FollowingID,
                                Username:    user.Username,
                                Avatar:      avatar,
                        })
                }
        }
        
        c.JSON(http.StatusOK, response)
}

func subscribeHandler(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
                return
        }
        uid := uint(userID.(float64))
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }
        
        if uid == uint(targetID) {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot subscribe to yourself"})
                return
        }
        
        var existing Subscription
        if db.Where("follower_id = ? AND following_id = ?", uid, targetID).First(&existing).RowsAffected > 0 {
                c.JSON(http.StatusOK, gin.H{"status": "already_subscribed"})
                return
        }
        
        sub := Subscription{
                FollowerID:  uid,
                FollowingID: uint(targetID),
        }
        db.Create(&sub)
        c.JSON(http.StatusOK, gin.H{"status": "subscribed", "id": sub.ID})
}

func unsubscribeHandler(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
                return
        }
        uid := uint(userID.(float64))
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }
        
        db.Where("follower_id = ? AND following_id = ?", uid, targetID).Delete(&Subscription{})
        c.JSON(http.StatusOK, gin.H{"status": "unsubscribed"})
}

func getSubscribersHandler(c *gin.Context) {
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }
        
        var subscriptions []Subscription
        db.Where("following_id = ?", targetID).Find(&subscriptions)
        
        type SubResponse struct {
                ID         uint   `json:"id"`
                FollowerID uint   `json:"follower_id"`
                Username   string `json:"username"`
                Avatar     string `json:"avatar,omitempty"`
        }
        
        var response []SubResponse
        for _, sub := range subscriptions {
                var user User
                if db.First(&user, sub.FollowerID).RowsAffected > 0 {
                        avatar := ""
                        if user.Avatar != nil {
                                avatar = *user.Avatar
                        }
                        response = append(response, SubResponse{
                                ID:         sub.ID,
                                FollowerID: sub.FollowerID,
                                Username:   user.Username,
                                Avatar:     avatar,
                        })
                }
        }
        
        c.JSON(http.StatusOK, response)
}

// User Profile and Stats
func getUserProfileHandler(c *gin.Context) {
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }
        
        var user User
        if db.First(&user, targetID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }
        
        // Get subscription stats
        var followersCount int64
        var followingCount int64
        db.Model(&Subscription{}).Where("following_id = ?", targetID).Count(&followersCount)
        db.Model(&Subscription{}).Where("follower_id = ?", targetID).Count(&followingCount)
        
        // Check if current user is subscribed to this profile
        isSubscribed := false
        if userID, exists := c.Get("user_id"); exists {
                uid := uint(userID.(float64))
                if uid != uint(targetID) {
                        var sub Subscription
                        if db.Where("follower_id = ? AND following_id = ?", uid, targetID).First(&sub).RowsAffected > 0 {
                                isSubscribed = true
                        }
                }
        }
        
        avatar := ""
        if user.Avatar != nil {
                avatar = *user.Avatar
        }
        bio := ""
        if user.Bio != nil {
                bio = *user.Bio
        }
        
        c.JSON(http.StatusOK, gin.H{
                "id":              user.ID,
                "username":        user.Username,
                "avatar":          avatar,
                "bio":             bio,
                "role":            user.Role,
                "created_at":      user.CreatedAt,
                "followers_count": followersCount,
                "following_count": followingCount,
                "is_subscribed":   isSubscribed,
        })
}

func getUserStatsHandler(c *gin.Context) {
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }
        
        var followersCount int64
        var followingCount int64
        var postsCount int64
        var friendsCount int64
        
        db.Model(&Subscription{}).Where("following_id = ?", targetID).Count(&followersCount)
        db.Model(&Subscription{}).Where("follower_id = ?", targetID).Count(&followingCount)
        db.Model(&Post{}).Where("author_id = ?", targetID).Count(&postsCount)
        
        // Count friends (accepted friend requests in either direction)
        db.Model(&FriendRequest{}).Where("(from_user_id = ? OR to_user_id = ?) AND status = ?", targetID, targetID, "accepted").Count(&friendsCount)
        
        c.JSON(http.StatusOK, gin.H{
                "followers_count": followersCount,
                "following_count": followingCount,
                "posts_count":     postsCount,
                "friends_count":   friendsCount,
        })
}

// Video Extras
func likeVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "liked"})
}
func unlikeVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unliked"})
}
func bookmarkVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "bookmarked"})
}
func unbookmarkVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unbookmarked"})
}
func getVideoChaptersHandler(c *gin.Context) {
        c.JSON(http.StatusOK, []string{})
}
func incrementVideoViewHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "viewed"})
}

// Premium Subscription Handlers
func getPremiumPlansHandler(c *gin.Context) {
        var plans []PremiumPlan
        db.Where("is_active = ?", true).Find(&plans)
        c.JSON(http.StatusOK, plans)
}

func getUserPremiumHandler(c *gin.Context) {
        userIDParam := c.Param("id")
        userID, err := strconv.ParseUint(userIDParam, 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
                return
        }
        
        var premium UserPremium
        result := db.Preload("Plan").Where("user_id = ? AND status = ?", userID, "active").First(&premium)
        
        if result.Error != nil {
                c.JSON(http.StatusOK, gin.H{
                        "has_premium": false,
                        "plan": nil,
                })
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "has_premium":           true,
                "plan_name":             premium.Plan.Name,
                "plan_slug":             premium.Plan.Slug,
                "current_period_end":    premium.CurrentPeriodEnd,
                "auto_renew":            premium.AutoRenew,
        })
}

func createDonationHandler(c *gin.Context) {
        toUserIDParam := c.Param("id")
        toUserID, err := strconv.ParseUint(toUserIDParam, 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
                return
        }
        
        var fromUserID *uint
        if uid, exists := c.Get("user_id"); exists {
                id := uint(uid.(float64))
                fromUserID = &id
        }
        
        var req struct {
                Amount  float64 `json:"amount" binding:"required,min=10"`
                Message string  `json:"message"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        donation := CreatorDonation{
                FromUserID: fromUserID,
                ToUserID:   uint(toUserID),
                AmountRub:  req.Amount,
                Message:    req.Message,
                Status:     "pending",
                CreatedAt:  time.Now(),
        }
        
        if err := db.Create(&donation).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create donation"})
                return
        }
        
        c.JSON(http.StatusCreated, gin.H{
                "id":      donation.ID,
                "status":  "pending",
                "message": "Donation created. Redirecting to payment...",
        })
}

func getUserDonationsHandler(c *gin.Context) {
        userIDParam := c.Param("id")
        userID, err := strconv.ParseUint(userIDParam, 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
                return
        }
        
        var donations []CreatorDonation
        db.Where("to_user_id = ?", userID).
                Order("created_at desc").
                Limit(50).
                Find(&donations)
        
        var total float64
        db.Model(&CreatorDonation{}).
                Where("to_user_id = ?", userID).
                Select("COALESCE(SUM(amount_rub), 0)").
                Scan(&total)
        
        c.JSON(http.StatusOK, gin.H{
                "donations": donations,
                "total":     total,
        })
}

// Premium Billing Endpoints

func getPremiumSubscriptionHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var sub PremiumSubscription
        if err := db.Preload("Plan").Where("user_id = ? AND status IN ?", uid, []string{"active", "cancelled"}).Order("current_period_end DESC").First(&sub).Error; err != nil {
                c.JSON(http.StatusOK, gin.H{})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "id":                   sub.ID,
                "plan_id":              sub.PlanID,
                "plan_name":            sub.Plan.Name,
                "status":               sub.Status,
                "current_period_start": sub.CurrentPeriodStart,
                "current_period_end":   sub.CurrentPeriodEnd,
                "auto_renew":           sub.AutoRenew,
                "cancel_at_period_end": sub.CancelAtPeriodEnd,
        })
}

func checkoutPremiumHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var req struct {
                PlanID int `json:"plan_id" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        // Check if user already has active subscription
        var existingSub PremiumSubscription
        if db.Where("user_id = ? AND status = ?", uid, "active").First(&existingSub).RowsAffected > 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Already have active subscription"})
                return
        }
        
        // Get plan
        var plan PremiumPlan
        if db.First(&plan, req.PlanID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
                return
        }
        
        // Create pending transaction
        transaction := PremiumTransaction{
                UserID:          uid,
                PlanID:          uint(req.PlanID),
                AmountRub:       plan.PriceRub,
                Status:          "pending",
                PaymentProvider: "yookassa",
                Description:     "Premium subscription: " + plan.Name,
        }
        db.Create(&transaction)
        
        if yookassaService == nil {
                c.JSON(http.StatusOK, gin.H{
                        "payment_id":       transaction.ID,
                        "confirmation_url": "",
                        "message":          "YooKassa not configured. Please contact admin.",
                })
                return
        }
        
        returnURL := os.Getenv("APP_URL")
        if returnURL == "" {
                returnURL = "https://nemaks.com"
        }
        
        payment, err := yookassaService.CreatePayment(
                transaction.ID,
                plan.PriceRub,
                "Подписка "+plan.Name,
                returnURL+"/premium?status=success",
                true,
        )
        if err != nil {
                log.Printf("[Billing] YooKassa payment error: %v", err)
                db.Model(&transaction).Update("status", "failed")
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Payment creation failed"})
                return
        }
        
        db.Model(&transaction).Updates(map[string]interface{}{
                "provider_payment_id": payment.ID,
                "confirmation_url":    payment.Confirmation.ConfirmationURL,
        })
        
        c.JSON(http.StatusOK, gin.H{
                "payment_id":       transaction.ID,
                "confirmation_url": payment.Confirmation.ConfirmationURL,
        })
}

func cancelPremiumHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var sub PremiumSubscription
        if err := db.Where("user_id = ? AND status = ?", uid, "active").First(&sub).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No active subscription"})
                return
        }
        
        now := time.Now()
        db.Model(&sub).Updates(map[string]interface{}{
                "cancel_at_period_end": true,
                "cancelled_at":         now,
                "status":               "cancelled",
                "auto_renew":           false,
        })
        
        go SendSubscriptionCancelled(uid, sub.CurrentPeriodEnd)
        
        c.JSON(http.StatusOK, gin.H{"status": "cancelled", "ends_at": sub.CurrentPeriodEnd})
}

func getPremiumTransactionsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var transactions []PremiumTransaction
        db.Where("user_id = ?", uid).Order("created_at DESC").Limit(50).Find(&transactions)
        
        result := make([]gin.H, len(transactions))
        for i, t := range transactions {
                result[i] = gin.H{
                        "id":               t.ID,
                        "plan_id":          t.PlanID,
                        "amount_rub":       t.AmountRub,
                        "status":           t.Status,
                        "payment_provider": t.PaymentProvider,
                        "created_at":       t.CreatedAt,
                        "completed_at":     t.CompletedAt,
                }
        }
        
        c.JSON(http.StatusOK, result)
}

func yookassaWebhookHandler(c *gin.Context) {
        var payload struct {
                Type   string `json:"type"`
                Event  string `json:"event"`
                Object struct {
                        ID       string `json:"id"`
                        Status   string `json:"status"`
                        Metadata struct {
                                TransactionID string `json:"transaction_id"`
                        } `json:"metadata"`
                        PaymentMethod struct {
                                Type  string `json:"type"`
                                ID    string `json:"id"`
                                Saved bool   `json:"saved"`
                        } `json:"payment_method"`
                } `json:"object"`
        }
        
        if err := c.BindJSON(&payload); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
                return
        }
        
        if payload.Object.Status == "succeeded" {
                transactionID, err := strconv.ParseUint(payload.Object.Metadata.TransactionID, 10, 32)
                if err != nil {
                        log.Printf("Invalid transaction ID in webhook: %s", payload.Object.Metadata.TransactionID)
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
                        return
                }
                
                var transaction PremiumTransaction
                if db.First(&transaction, transactionID).RowsAffected == 0 {
                        log.Printf("Transaction not found: %d", transactionID)
                        c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
                        return
                }
                
                if transaction.Status == "succeeded" {
                        c.JSON(http.StatusOK, gin.H{"status": "already_processed"})
                        return
                }
                
                now := time.Now()
                transaction.Status = "succeeded"
                transaction.CompletedAt = &now
                transaction.ProviderPaymentID = payload.Object.ID
                db.Save(&transaction)
                
                var plan PremiumPlan
                db.First(&plan, transaction.PlanID)
                
                periodEnd := now.AddDate(0, 1, 0)
                if plan.BillingCycle == "quarterly" {
                        periodEnd = now.AddDate(0, 3, 0)
                } else if plan.BillingCycle == "annual" {
                        periodEnd = now.AddDate(1, 0, 0)
                }
                
                paymentMethodID := ""
                if payload.Object.PaymentMethod.Saved && payload.Object.PaymentMethod.ID != "" {
                        paymentMethodID = payload.Object.PaymentMethod.ID
                        log.Printf("[Billing] Saved payment method %s for user %d", paymentMethodID, transaction.UserID)
                }
                
                var existingSub PremiumSubscription
                if db.Where("user_id = ?", transaction.UserID).First(&existingSub).RowsAffected > 0 {
                        updates := map[string]interface{}{
                                "plan_id":              transaction.PlanID,
                                "status":               "active",
                                "current_period_start": now,
                                "current_period_end":   periodEnd,
                                "auto_renew":           true,
                                "cancel_at_period_end": false,
                                "cancelled_at":         nil,
                        }
                        if paymentMethodID != "" {
                                updates["payment_method_id"] = paymentMethodID
                        }
                        db.Model(&existingSub).Updates(updates)
                        db.Model(&transaction).Update("subscription_id", existingSub.ID)
                } else {
                        sub := PremiumSubscription{
                                UserID:             transaction.UserID,
                                PlanID:             transaction.PlanID,
                                Status:             "active",
                                CurrentPeriodStart: now,
                                CurrentPeriodEnd:   periodEnd,
                                AutoRenew:          true,
                                PaymentMethodID:    paymentMethodID,
                        }
                        db.Create(&sub)
                        db.Model(&transaction).Update("subscription_id", sub.ID)
                }
                
                go SendPaymentConfirmation(transaction.UserID, plan.Name, plan.PriceRub)
                
                log.Printf("Premium subscription activated for user %d, plan %d", transaction.UserID, transaction.PlanID)
        }
        
        c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// Seed premium plans
func seedPremiumPlans() {
        plans := []PremiumPlan{
                {
                        Slug:         "basic",
                        Name:         "Basic",
                        Description:  "Базовый план для начинающих",
                        PriceRub:     199,
                        BillingCycle: "monthly",
                        Features:     `["Без рекламы","Базовые темы оформления","Поддержка 24/7"]`,
                        IsActive:     true,
                        SortOrder:    1,
                },
                {
                        Slug:         "pro",
                        Name:         "Pro",
                        Description:  "Расширенные возможности для активных пользователей",
                        PriceRub:     499,
                        BillingCycle: "monthly",
                        Features:     `["Все из Basic","HD видео","Эксклюзивные темы","Приоритетная поддержка","Расширенное хранилище"]`,
                        IsActive:     true,
                        SortOrder:    2,
                },
                {
                        Slug:         "vip",
                        Name:         "VIP",
                        Description:  "Максимальные возможности и эксклюзивный доступ",
                        PriceRub:     999,
                        BillingCycle: "monthly",
                        Features:     `["Все из Pro","VIP значок","Ранний доступ к новым функциям","Персональный менеджер","Неограниченное хранилище"]`,
                        IsActive:     true,
                        SortOrder:    3,
                },
        }
        
        for _, plan := range plans {
                var existing PremiumPlan
                if db.Where("slug = ?", plan.Slug).First(&existing).RowsAffected == 0 {
                        db.Create(&plan)
                        log.Printf("Created premium plan: %s", plan.Name)
                }
        }
}

func getAdminBillingStatsHandler(c *gin.Context) {
        now := time.Now()
        startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
        
        var activeSubscriptions int64
        db.Model(&PremiumSubscription{}).Where("status = ?", "active").Count(&activeSubscriptions)
        
        var monthlyRevenue float64
        db.Model(&PremiumTransaction{}).
                Select("COALESCE(SUM(amount_rub), 0)").
                Where("status = ? AND created_at >= ?", "succeeded", startOfMonth).
                Scan(&monthlyRevenue)
        
        var totalRevenue float64
        db.Model(&PremiumTransaction{}).
                Select("COALESCE(SUM(amount_rub), 0)").
                Where("status = ?", "succeeded").
                Scan(&totalRevenue)
        
        var newSubscriptions int64
        db.Model(&PremiumSubscription{}).Where("created_at >= ?", startOfMonth).Count(&newSubscriptions)
        
        var cancelledSubscriptions int64
        db.Model(&PremiumSubscription{}).Where("cancelled_at >= ?", startOfMonth).Count(&cancelledSubscriptions)
        
        var churnRate float64
        if activeSubscriptions > 0 {
                churnRate = float64(cancelledSubscriptions) / float64(activeSubscriptions+cancelledSubscriptions) * 100
        }
        
        var recentTransactions []PremiumTransaction
        db.Preload("User").Order("created_at DESC").Limit(20).Find(&recentTransactions)
        
        txList := make([]gin.H, len(recentTransactions))
        for i, tx := range recentTransactions {
                username := ""
                if tx.User.Username != "" {
                        username = tx.User.Username
                }
                txList[i] = gin.H{
                        "id":           tx.ID,
                        "user_id":      tx.UserID,
                        "username":     username,
                        "amount_rub":   tx.AmountRub,
                        "status":       tx.Status,
                        "created_at":   tx.CreatedAt,
                        "completed_at": tx.CompletedAt,
                }
        }
        
        c.JSON(http.StatusOK, gin.H{
                "active_subscriptions":    activeSubscriptions,
                "monthly_revenue":         monthlyRevenue,
                "total_revenue":           totalRevenue,
                "new_subscriptions":       newSubscriptions,
                "cancelled_subscriptions": cancelledSubscriptions,
                "churn_rate":              churnRate,
                "recent_transactions":     txList,
        })
}

