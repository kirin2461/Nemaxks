package main

import (
        "log"
        "net/http"
        "os"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
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
                PlanID    int    `json:"plan_id" binding:"required"`
                PromoCode string `json:"promo_code"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var existingSub PremiumSubscription
        if db.Where("user_id = ? AND status = ?", uid, "active").First(&existingSub).RowsAffected > 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Already have active subscription"})
                return
        }
        
        var plan PremiumPlan
        if db.First(&plan, req.PlanID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
                return
        }
        
        finalAmount := plan.PriceRub
        var discountRub float64
        var promoCodeID *uint
        
        if req.PromoCode != "" {
                discount, promo, _ := applyPromoCode(req.PromoCode, uint(req.PlanID), uid)
                if promo != nil {
                        discountRub = discount
                        finalAmount = plan.PriceRub - discount
                        promoCodeID = &promo.ID
                        if finalAmount < 0 {
                                finalAmount = 0
                        }
                }
        }
        
        transaction := PremiumTransaction{
                UserID:          uid,
                PlanID:          uint(req.PlanID),
                AmountRub:       finalAmount,
                DiscountRub:     discountRub,
                PromoCodeID:     promoCodeID,
                Status:          "pending",
                PaymentProvider: "yookassa",
                Description:     "Premium subscription: " + plan.Name,
        }
        db.Create(&transaction)
        
        if finalAmount == 0 && promoCodeID != nil {
                now := time.Now()
                periodEnd := now.AddDate(0, 1, 0)
                if plan.BillingCycle == "quarterly" {
                        periodEnd = now.AddDate(0, 3, 0)
                } else if plan.BillingCycle == "annual" {
                        periodEnd = now.AddDate(1, 0, 0)
                }
                
                db.Model(&transaction).Updates(map[string]interface{}{
                        "status":       "succeeded",
                        "completed_at": now,
                })
                
                sub := PremiumSubscription{
                        UserID:             uid,
                        PlanID:             uint(req.PlanID),
                        Status:             "active",
                        CurrentPeriodStart: now,
                        CurrentPeriodEnd:   periodEnd,
                        AutoRenew:          true,
                }
                db.Create(&sub)
                db.Model(&transaction).Update("subscription_id", sub.ID)
                
                db.Model(&PromoCode{}).Where("id = ?", *promoCodeID).Update("used_count", gorm.Expr("used_count + 1"))
                db.Create(&PromoCodeUsage{
                        PromoCodeID:   *promoCodeID,
                        UserID:        uid,
                        TransactionID: transaction.ID,
                        DiscountRub:   discountRub,
                })
                
                c.JSON(http.StatusOK, gin.H{
                        "payment_id": transaction.ID,
                        "status":     "free_with_promo",
                        "message":    "Subscription activated with 100% discount",
                })
                return
        }
        
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
                finalAmount,
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
        
        if promoCodeID != nil {
                db.Model(&PromoCode{}).Where("id = ?", *promoCodeID).Update("used_count", gorm.Expr("used_count + 1"))
                db.Create(&PromoCodeUsage{
                        PromoCodeID:   *promoCodeID,
                        UserID:        uid,
                        TransactionID: transaction.ID,
                        DiscountRub:   discountRub,
                })
        }
        
        c.JSON(http.StatusOK, gin.H{
                "payment_id":       transaction.ID,
                "confirmation_url": payment.Confirmation.ConfirmationURL,
                "original_price":   plan.PriceRub,
                "discount":         discountRub,
                "final_price":      finalAmount,
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
                go grantReferralBonus(transaction.UserID, 7, "premium_subscription")
                go activateBoostFromWebhook(transaction.ID)
                
                log.Printf("Premium subscription activated for user %d, plan %d", transaction.UserID, transaction.PlanID)
        }
        
        c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// Seed premium plans
func seedPremiumPlans() {
        plans := []PremiumPlan{
                {
                        Slug:         "basic-monthly",
                        Name:         "Basic",
                        Description:  "Базовый план для начинающих",
                        PriceRub:     199,
                        BillingCycle: "monthly",
                        Features:     `["Без рекламы","Базовые темы оформления","Поддержка 24/7"]`,
                        IsActive:     true,
                        SortOrder:    1,
                },
                {
                        Slug:         "basic-quarterly",
                        Name:         "Basic (3 месяца)",
                        Description:  "Базовый план - скидка 15%",
                        PriceRub:     507,
                        BillingCycle: "quarterly",
                        Features:     `["Без рекламы","Базовые темы оформления","Поддержка 24/7","Скидка 15%"]`,
                        IsActive:     true,
                        SortOrder:    2,
                },
                {
                        Slug:         "basic-annual",
                        Name:         "Basic (1 год)",
                        Description:  "Базовый план - скидка 25%",
                        PriceRub:     1789,
                        BillingCycle: "annual",
                        Features:     `["Без рекламы","Базовые темы оформления","Поддержка 24/7","Скидка 25%"]`,
                        IsActive:     true,
                        SortOrder:    3,
                },
                {
                        Slug:         "pro-monthly",
                        Name:         "Pro",
                        Description:  "Расширенные возможности для активных пользователей",
                        PriceRub:     499,
                        BillingCycle: "monthly",
                        Features:     `["Все из Basic","HD видео","Эксклюзивные темы","Приоритетная поддержка","Расширенное хранилище"]`,
                        IsActive:     true,
                        SortOrder:    4,
                },
                {
                        Slug:         "pro-quarterly",
                        Name:         "Pro (3 месяца)",
                        Description:  "Расширенные возможности - скидка 15%",
                        PriceRub:     1272,
                        BillingCycle: "quarterly",
                        Features:     `["Все из Basic","HD видео","Эксклюзивные темы","Приоритетная поддержка","Расширенное хранилище","Скидка 15%"]`,
                        IsActive:     true,
                        SortOrder:    5,
                },
                {
                        Slug:         "pro-annual",
                        Name:         "Pro (1 год)",
                        Description:  "Расширенные возможности - скидка 25%",
                        PriceRub:     4491,
                        BillingCycle: "annual",
                        Features:     `["Все из Basic","HD видео","Эксклюзивные темы","Приоритетная поддержка","Расширенное хранилище","Скидка 25%"]`,
                        IsActive:     true,
                        SortOrder:    6,
                },
                {
                        Slug:         "vip-monthly",
                        Name:         "VIP",
                        Description:  "Максимальные возможности и эксклюзивный доступ",
                        PriceRub:     999,
                        BillingCycle: "monthly",
                        Features:     `["Все из Pro","VIP значок","Ранний доступ к новым функциям","Персональный менеджер","Неограниченное хранилище"]`,
                        IsActive:     true,
                        SortOrder:    7,
                },
                {
                        Slug:         "vip-quarterly",
                        Name:         "VIP (3 месяца)",
                        Description:  "Максимальные возможности - скидка 15%",
                        PriceRub:     2547,
                        BillingCycle: "quarterly",
                        Features:     `["Все из Pro","VIP значок","Ранний доступ к новым функциям","Персональный менеджер","Неограниченное хранилище","Скидка 15%"]`,
                        IsActive:     true,
                        SortOrder:    8,
                },
                {
                        Slug:         "vip-annual",
                        Name:         "VIP (1 год)",
                        Description:  "Максимальные возможности - скидка 25%",
                        PriceRub:     8991,
                        BillingCycle: "annual",
                        Features:     `["Все из Pro","VIP значок","Ранний доступ к новым функциям","Персональный менеджер","Неограниченное хранилище","Скидка 25%"]`,
                        IsActive:     true,
                        SortOrder:    9,
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

// Promo Code Handlers
func validatePromoCodeHandler(c *gin.Context) {
        code := c.Query("code")
        planIDStr := c.Query("plan_id")
        
        if code == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Promo code required"})
                return
        }
        
        var promo PromoCode
        if db.Where("code = ? AND is_active = ?", code, true).First(&promo).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Invalid promo code"})
                return
        }
        
        now := time.Now()
        if now.Before(promo.ValidFrom) || now.After(promo.ValidUntil) {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Promo code expired"})
                return
        }
        
        if promo.MaxUses > 0 && promo.UsedCount >= promo.MaxUses {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Promo code usage limit reached"})
                return
        }
        
        var plan PremiumPlan
        if planIDStr != "" {
                planID, _ := strconv.ParseUint(planIDStr, 10, 32)
                if db.First(&plan, planID).RowsAffected > 0 {
                        if plan.PriceRub < promo.MinPurchase {
                                c.JSON(http.StatusBadRequest, gin.H{"error": "Minimum purchase not met"})
                                return
                        }
                }
        }
        
        c.JSON(http.StatusOK, gin.H{
                "valid":          true,
                "discount_type":  promo.DiscountType,
                "discount_value": promo.DiscountValue,
                "description":    promo.Description,
        })
}

func applyPromoCode(code string, planID uint, userID uint) (float64, *PromoCode, error) {
        var promo PromoCode
        if db.Where("code = ? AND is_active = ?", code, true).First(&promo).RowsAffected == 0 {
                return 0, nil, nil
        }
        
        now := time.Now()
        if now.Before(promo.ValidFrom) || now.After(promo.ValidUntil) {
                return 0, nil, nil
        }
        
        if promo.MaxUses > 0 && promo.UsedCount >= promo.MaxUses {
                return 0, nil, nil
        }
        
        var existing PromoCodeUsage
        if db.Where("promo_code_id = ? AND user_id = ?", promo.ID, userID).First(&existing).RowsAffected > 0 {
                return 0, nil, nil
        }
        
        var plan PremiumPlan
        if db.First(&plan, planID).RowsAffected == 0 {
                return 0, nil, nil
        }
        
        if plan.PriceRub < promo.MinPurchase {
                return 0, nil, nil
        }
        
        var discount float64
        if promo.DiscountType == "percent" {
                discount = plan.PriceRub * (promo.DiscountValue / 100)
        } else {
                discount = promo.DiscountValue
        }
        
        if discount > plan.PriceRub {
                discount = plan.PriceRub
        }
        
        return discount, &promo, nil
}

func createPromoCodeHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var user User
        if db.First(&user, uid).RowsAffected == 0 || user.Role != "admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
                return
        }
        
        var req struct {
                Code            string  `json:"code" binding:"required"`
                Description     string  `json:"description"`
                DiscountType    string  `json:"discount_type" binding:"required"`
                DiscountValue   float64 `json:"discount_value" binding:"required"`
                MaxUses         int     `json:"max_uses"`
                MinPurchase     float64 `json:"min_purchase"`
                ValidFrom       string  `json:"valid_from"`
                ValidUntil      string  `json:"valid_until"`
                ApplicablePlans string  `json:"applicable_plans"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        validFrom := time.Now()
        validUntil := time.Now().AddDate(1, 0, 0)
        
        if req.ValidFrom != "" {
                if t, err := time.Parse("2006-01-02", req.ValidFrom); err == nil {
                        validFrom = t
                }
        }
        if req.ValidUntil != "" {
                if t, err := time.Parse("2006-01-02", req.ValidUntil); err == nil {
                        validUntil = t
                }
        }
        
        promo := PromoCode{
                Code:            req.Code,
                Description:     req.Description,
                DiscountType:    req.DiscountType,
                DiscountValue:   req.DiscountValue,
                MaxUses:         req.MaxUses,
                MinPurchase:     req.MinPurchase,
                ValidFrom:       validFrom,
                ValidUntil:      validUntil,
                ApplicablePlans: req.ApplicablePlans,
                IsActive:        true,
                CreatedBy:       uid,
        }
        
        if err := db.Create(&promo).Error; err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Code already exists"})
                return
        }
        
        c.JSON(http.StatusCreated, promo)
}

func getPromoCodesHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var user User
        if db.First(&user, uid).RowsAffected == 0 || user.Role != "admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
                return
        }
        
        var promos []PromoCode
        db.Order("created_at DESC").Find(&promos)
        c.JSON(http.StatusOK, promos)
}

func deletePromoCodeHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var user User
        if db.First(&user, uid).RowsAffected == 0 || user.Role != "admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
                return
        }
        
        promoID := c.Param("id")
        db.Model(&PromoCode{}).Where("id = ?", promoID).Update("is_active", false)
        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// Trial Period Handler
func startTrialHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var req struct {
                PlanID uint `json:"plan_id" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var existingSub PremiumSubscription
        if db.Where("user_id = ?", uid).First(&existingSub).RowsAffected > 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Already have subscription"})
                return
        }
        
        var plan PremiumPlan
        if db.First(&plan, req.PlanID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
                return
        }
        
        now := time.Now()
        trialEnd := now.AddDate(0, 0, 7)
        
        sub := PremiumSubscription{
                UserID:             uid,
                PlanID:             req.PlanID,
                Status:             "trialing",
                CurrentPeriodStart: now,
                CurrentPeriodEnd:   trialEnd,
                TrialEnd:           &trialEnd,
                IsTrialing:         true,
                AutoRenew:          false,
        }
        db.Create(&sub)
        
        c.JSON(http.StatusCreated, gin.H{
                "message":   "Trial started",
                "trial_end": trialEnd,
                "plan":      plan.Name,
        })
}

// Gift Subscription Handlers
func purchaseGiftHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var req struct {
                PlanID       uint   `json:"plan_id" binding:"required"`
                DurationDays int    `json:"duration_days"`
                Message      string `json:"message"`
                RecipientID  *uint  `json:"recipient_id"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var plan PremiumPlan
        if db.First(&plan, req.PlanID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
                return
        }
        
        if req.DurationDays <= 0 {
                if plan.BillingCycle == "monthly" {
                        req.DurationDays = 30
                } else if plan.BillingCycle == "quarterly" {
                        req.DurationDays = 90
                } else {
                        req.DurationDays = 365
                }
        }
        
        giftCode := generateGiftCode()
        
        gift := GiftSubscription{
                Code:         giftCode,
                FromUserID:   uid,
                ToUserID:     req.RecipientID,
                PlanID:       req.PlanID,
                DurationDays: req.DurationDays,
                Message:      req.Message,
                Status:       "pending",
                ExpiresAt:    time.Now().AddDate(1, 0, 0),
        }
        
        transaction := PremiumTransaction{
                UserID:          uid,
                PlanID:          req.PlanID,
                AmountRub:       plan.PriceRub,
                Status:          "pending",
                PaymentProvider: "yookassa",
                Description:     "Gift: " + plan.Name,
        }
        db.Create(&transaction)
        
        gift.TransactionID = &transaction.ID
        db.Create(&gift)
        
        if yookassaService != nil {
                returnURL := os.Getenv("APP_URL")
                if returnURL == "" {
                        returnURL = "https://nemaks.com"
                }
                
                payment, err := yookassaService.CreatePayment(
                        transaction.ID,
                        plan.PriceRub,
                        "Подарочная подписка "+plan.Name,
                        returnURL+"/gifts?code="+giftCode,
                        false,
                )
                if err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                        return
                }
                
                db.Model(&transaction).Updates(map[string]interface{}{
                        "provider_payment_id": payment.ID,
                        "confirmation_url":    payment.Confirmation.ConfirmationURL,
                })
                
                c.JSON(http.StatusOK, gin.H{
                        "gift_code":        giftCode,
                        "confirmation_url": payment.Confirmation.ConfirmationURL,
                })
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "gift_code": giftCode,
                "message":   "Payment system not configured",
        })
}

func redeemGiftHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var req struct {
                Code string `json:"code" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var gift GiftSubscription
        if db.Preload("Plan").Where("code = ?", req.Code).First(&gift).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Gift code not found"})
                return
        }
        
        if gift.Status != "pending" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Gift already redeemed or expired"})
                return
        }
        
        if time.Now().After(gift.ExpiresAt) {
                db.Model(&gift).Update("status", "expired")
                c.JSON(http.StatusBadRequest, gin.H{"error": "Gift code expired"})
                return
        }
        
        if gift.TransactionID != nil {
                var tx PremiumTransaction
                if db.First(&tx, *gift.TransactionID).RowsAffected > 0 && tx.Status != "succeeded" {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Gift not yet paid for"})
                        return
                }
        }
        
        now := time.Now()
        periodEnd := now.AddDate(0, 0, gift.DurationDays)
        
        var existingSub PremiumSubscription
        if db.Where("user_id = ?", uid).First(&existingSub).RowsAffected > 0 {
                if existingSub.CurrentPeriodEnd.After(now) {
                        periodEnd = existingSub.CurrentPeriodEnd.AddDate(0, 0, gift.DurationDays)
                }
                db.Model(&existingSub).Updates(map[string]interface{}{
                        "plan_id":              gift.PlanID,
                        "status":               "active",
                        "current_period_end":   periodEnd,
                        "gift_code_id":         gift.ID,
                        "cancel_at_period_end": false,
                })
        } else {
                sub := PremiumSubscription{
                        UserID:             uid,
                        PlanID:             gift.PlanID,
                        Status:             "active",
                        CurrentPeriodStart: now,
                        CurrentPeriodEnd:   periodEnd,
                        AutoRenew:          false,
                        GiftCodeID:         &gift.ID,
                }
                db.Create(&sub)
        }
        
        db.Model(&gift).Updates(map[string]interface{}{
                "to_user_id":  uid,
                "status":      "redeemed",
                "redeemed_at": now,
        })
        
        c.JSON(http.StatusOK, gin.H{
                "message":    "Gift redeemed successfully",
                "plan":       gift.Plan.Name,
                "expires_at": periodEnd,
        })
}

func getUserGiftsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var sentGifts []GiftSubscription
        db.Preload("Plan").Where("from_user_id = ?", uid).Order("created_at DESC").Find(&sentGifts)
        
        var receivedGifts []GiftSubscription
        db.Preload("Plan").Where("to_user_id = ?", uid).Order("created_at DESC").Find(&receivedGifts)
        
        c.JSON(http.StatusOK, gin.H{
                "sent":     sentGifts,
                "received": receivedGifts,
        })
}

func generateGiftCode() string {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        code := "GIFT-"
        for i := 0; i < 8; i++ {
                code += string(chars[time.Now().UnixNano()%int64(len(chars))])
                time.Sleep(time.Nanosecond)
        }
        return code
}

// Post Boost Handlers
func getBoostPricingHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
                "pricing": []gin.H{
                        {"type": "featured", "hours": 24, "price_rub": 99, "description": "Featured in category"},
                        {"type": "featured", "hours": 72, "price_rub": 249, "description": "Featured in category (3 days)"},
                        {"type": "trending", "hours": 24, "price_rub": 199, "description": "Trending section placement"},
                        {"type": "trending", "hours": 72, "price_rub": 499, "description": "Trending section (3 days)"},
                        {"type": "top", "hours": 24, "price_rub": 399, "description": "Top of feed placement"},
                        {"type": "top", "hours": 72, "price_rub": 999, "description": "Top of feed (3 days)"},
                },
        })
}

func createPostBoostHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var req struct {
                PostID        uint   `json:"post_id" binding:"required"`
                BoostType     string `json:"boost_type" binding:"required"`
                DurationHours int    `json:"duration_hours" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var post Post
        if db.First(&post, req.PostID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
                return
        }
        
        if post.AuthorID != uid {
                c.JSON(http.StatusForbidden, gin.H{"error": "Can only boost your own posts"})
                return
        }
        
        var existingBoost PostBoost
        if db.Where("post_id = ? AND status IN ?", req.PostID, []string{"pending", "active"}).First(&existingBoost).RowsAffected > 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Post already has active boost"})
                return
        }
        
        priceMap := map[string]map[int]float64{
                "featured": {24: 99, 72: 249},
                "trending": {24: 199, 72: 499},
                "top":      {24: 399, 72: 999},
        }
        
        price, ok := priceMap[req.BoostType][req.DurationHours]
        if !ok {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid boost type or duration"})
                return
        }
        
        var sub PremiumSubscription
        isPremium := db.Where("user_id = ? AND status = ?", uid, "active").First(&sub).RowsAffected > 0
        if isPremium {
                price = price * 0.8
        }
        
        transaction := PremiumTransaction{
                UserID:          uid,
                AmountRub:       price,
                Status:          "pending",
                PaymentProvider: "yookassa",
                Description:     "Post boost: " + req.BoostType,
        }
        db.Create(&transaction)
        
        boost := PostBoost{
                PostID:        req.PostID,
                UserID:        uid,
                BoostType:     req.BoostType,
                AmountRub:     price,
                DurationHours: req.DurationHours,
                Status:        "pending",
                TransactionID: &transaction.ID,
        }
        db.Create(&boost)
        
        if yookassaService != nil {
                returnURL := os.Getenv("APP_URL")
                if returnURL == "" {
                        returnURL = "https://nemaks.com"
                }
                
                payment, err := yookassaService.CreatePayment(
                        transaction.ID,
                        price,
                        "Буст публикации",
                        returnURL+"/feed?boosted="+strconv.FormatUint(uint64(boost.ID), 10),
                        false,
                )
                if err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                        return
                }
                
                db.Model(&transaction).Updates(map[string]interface{}{
                        "provider_payment_id": payment.ID,
                        "confirmation_url":    payment.Confirmation.ConfirmationURL,
                })
                
                c.JSON(http.StatusOK, gin.H{
                        "boost_id":         boost.ID,
                        "confirmation_url": payment.Confirmation.ConfirmationURL,
                        "price":            price,
                })
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "boost_id": boost.ID,
                "message":  "Payment system not configured",
        })
}

func getMyBoostsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        
        var boosts []PostBoost
        db.Where("user_id = ?", uid).Order("created_at DESC").Find(&boosts)
        
        c.JSON(http.StatusOK, boosts)
}

func getBoostedPostsHandler(c *gin.Context) {
        boostType := c.DefaultQuery("type", "")
        now := time.Now()
        
        query := db.Model(&PostBoost{}).Where("status = ? AND expires_at > ?", "active", now)
        if boostType != "" {
                query = query.Where("boost_type = ?", boostType)
        }
        
        var boosts []PostBoost
        query.Order("boost_type DESC, created_at DESC").Limit(20).Find(&boosts)
        
        var postIDs []uint
        for _, b := range boosts {
                postIDs = append(postIDs, b.PostID)
        }
        
        var posts []Post
        if len(postIDs) > 0 {
                db.Preload("Author").Where("id IN ?", postIDs).Find(&posts)
        }
        
        c.JSON(http.StatusOK, gin.H{
                "boosted_posts": posts,
                "boost_info":    boosts,
        })
}

func activateBoostFromWebhook(transactionID uint) {
        var boost PostBoost
        if db.Where("transaction_id = ? AND status = ?", transactionID, "pending").First(&boost).RowsAffected == 0 {
                return
        }
        
        now := time.Now()
        expiresAt := now.Add(time.Duration(boost.DurationHours) * time.Hour)
        
        db.Model(&boost).Updates(map[string]interface{}{
                "status":     "active",
                "started_at": now,
                "expires_at": expiresAt,
        })
        
        log.Printf("[Boost] Post %d boosted until %v", boost.PostID, expiresAt)
}

