package main

import (
        "math/rand"
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

type VirtualCurrency struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        UserID    uint      `json:"user_id" gorm:"uniqueIndex;not null"`
        Coins     int       `json:"coins" gorm:"default:0"`
        Gems      int       `json:"gems" gorm:"default:0"`
        UpdatedAt time.Time `json:"updated_at"`
}

type ShopItem struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        Name        string    `json:"name" gorm:"not null"`
        NameRu      string    `json:"name_ru"`
        Description string    `json:"description"`
        DescRu      string    `json:"description_ru"`
        Type        string    `json:"type" gorm:"not null"`
        Category    string    `json:"category"`
        PriceCoins  int       `json:"price_coins" gorm:"default:0"`
        PriceGems   int       `json:"price_gems" gorm:"default:0"`
        Rarity      string    `json:"rarity" gorm:"default:'common'"`
        ImageURL    string    `json:"image_url"`
        Data        string    `json:"data"`
        IsAvailable bool      `json:"is_available" gorm:"default:true"`
        CreatedAt   time.Time `json:"created_at"`
}

type UserInventory struct {
        ID         uint      `json:"id" gorm:"primaryKey"`
        UserID     uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_user_item"`
        ItemID     uint      `json:"item_id" gorm:"not null;uniqueIndex:idx_user_item"`
        IsEquipped bool      `json:"is_equipped" gorm:"default:false"`
        AcquiredAt time.Time `json:"acquired_at"`
        Item       ShopItem  `json:"item,omitempty" gorm:"foreignKey:ItemID;constraint:OnDelete:CASCADE"`
}

type Challenge struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        Name        string     `json:"name" gorm:"not null"`
        NameRu      string     `json:"name_ru"`
        Description string     `json:"description"`
        DescRu      string     `json:"description_ru"`
        Type        string     `json:"type" gorm:"not null"`
        Category    string     `json:"category"`
        Condition   string     `json:"condition" gorm:"not null"`
        Target      int        `json:"target" gorm:"not null"`
        XPReward    int        `json:"xp_reward" gorm:"default:50"`
        CoinReward  int        `json:"coin_reward" gorm:"default:10"`
        GemReward   int        `json:"gem_reward" gorm:"default:0"`
        ResetPeriod string     `json:"reset_period"`
        StartsAt    *time.Time `json:"starts_at,omitempty"`
        EndsAt      *time.Time `json:"ends_at,omitempty"`
        IsActive    bool       `json:"is_active" gorm:"default:true"`
        CreatedAt   time.Time  `json:"created_at"`
}

type UserChallenge struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        UserID      uint       `json:"user_id" gorm:"not null;uniqueIndex:idx_user_challenge"`
        ChallengeID uint       `json:"challenge_id" gorm:"not null;uniqueIndex:idx_user_challenge"`
        Progress    int        `json:"progress" gorm:"default:0"`
        IsCompleted bool       `json:"is_completed" gorm:"default:false"`
        CompletedAt *time.Time `json:"completed_at,omitempty"`
        ResetAt     *time.Time `json:"reset_at,omitempty"`
        CreatedAt   time.Time  `json:"created_at"`
        Challenge   Challenge  `json:"challenge,omitempty" gorm:"foreignKey:ChallengeID;constraint:OnDelete:CASCADE"`
}

type UserStreak struct {
        ID              uint       `json:"id" gorm:"primaryKey"`
        UserID          uint       `json:"user_id" gorm:"uniqueIndex;not null"`
        LoginStreak     int        `json:"login_streak" gorm:"default:0"`
        MaxLoginStreak  int        `json:"max_login_streak" gorm:"default:0"`
        MessageStreak   int        `json:"message_streak" gorm:"default:0"`
        MaxMessageStreak int       `json:"max_message_streak" gorm:"default:0"`
        LastLoginDate   *time.Time `json:"last_login_date,omitempty"`
        LastMessageDate *time.Time `json:"last_message_date,omitempty"`
        UpdatedAt       time.Time  `json:"updated_at"`
}

type GuildCompetition struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        Name        string     `json:"name" gorm:"not null"`
        NameRu      string     `json:"name_ru"`
        Description string     `json:"description"`
        DescRu      string     `json:"description_ru"`
        Type        string     `json:"type" gorm:"not null"`
        Metric      string     `json:"metric" gorm:"not null"`
        StartsAt    time.Time  `json:"starts_at"`
        EndsAt      time.Time  `json:"ends_at"`
        Prizes      string     `json:"prizes"`
        IsActive    bool       `json:"is_active" gorm:"default:true"`
        CreatedAt   time.Time  `json:"created_at"`
}

type GuildCompetitionEntry struct {
        ID            uint             `json:"id" gorm:"primaryKey"`
        CompetitionID uint             `json:"competition_id" gorm:"not null;uniqueIndex:idx_comp_guild;index:idx_comp_score"`
        GuildID       uint             `json:"guild_id" gorm:"not null;uniqueIndex:idx_comp_guild"`
        Score         int              `json:"score" gorm:"default:0;index:idx_comp_score"`
        Rank          int              `json:"rank" gorm:"default:0"`
        UpdatedAt     time.Time        `json:"updated_at"`
        Competition   GuildCompetition `json:"competition,omitempty" gorm:"foreignKey:CompetitionID;constraint:OnDelete:CASCADE"`
        Guild         Guild            `json:"guild,omitempty" gorm:"foreignKey:GuildID;constraint:OnDelete:CASCADE"`
}

type UserProfile struct {
        ID               uint      `json:"id" gorm:"primaryKey"`
        UserID           uint      `json:"user_id" gorm:"uniqueIndex;not null"`
        ThemeID          *uint     `json:"theme_id,omitempty"`
        FrameID          *uint     `json:"frame_id,omitempty"`
        BannerID         *uint     `json:"banner_id,omitempty"`
        BadgeIDs         string    `json:"badge_ids"`
        ProfileColor     string    `json:"profile_color"`
        Bio              string    `json:"bio" gorm:"size:500"`
        ShowLevel        bool      `json:"show_level" gorm:"default:true"`
        ShowAchievements bool      `json:"show_achievements" gorm:"default:true"`
        ShowActivity     bool      `json:"show_activity" gorm:"default:true"`
        UpdatedAt        time.Time `json:"updated_at"`
}

type Badge struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        Name        string    `json:"name" gorm:"not null"`
        NameRu      string    `json:"name_ru"`
        Description string    `json:"description"`
        DescRu      string    `json:"description_ru"`
        Icon        string    `json:"icon"`
        Rarity      string    `json:"rarity" gorm:"default:'common'"`
        Condition   string    `json:"condition"`
        IsSpecial   bool      `json:"is_special" gorm:"default:false"`
        CreatedAt   time.Time `json:"created_at"`
}

type UserBadge struct {
        ID         uint      `json:"id" gorm:"primaryKey"`
        UserID     uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_user_badge"`
        BadgeID    uint      `json:"badge_id" gorm:"not null;uniqueIndex:idx_user_badge"`
        AcquiredAt time.Time `json:"acquired_at"`
        Badge      Badge     `json:"badge,omitempty" gorm:"foreignKey:BadgeID;constraint:OnDelete:CASCADE"`
}

func getCurrencyHandler(c *gin.Context) {
        userID := c.GetUint("user_id")

        var currency VirtualCurrency
        if err := db.Where("user_id = ?", userID).First(&currency).Error; err != nil {
                currency = VirtualCurrency{
                        UserID:    userID,
                        Coins:     100,
                        Gems:      5,
                        UpdatedAt: time.Now(),
                }
                db.Create(&currency)
        }

        c.JSON(http.StatusOK, currency)
}

func getShopItemsHandler(c *gin.Context) {
        category := c.Query("category")
        itemType := c.Query("type")

        var items []ShopItem
        query := db.Where("is_available = ?", true)

        if category != "" {
                query = query.Where("category = ?", category)
        }
        if itemType != "" {
                query = query.Where("type = ?", itemType)
        }

        query.Order("price_coins ASC").Find(&items)
        c.JSON(http.StatusOK, items)
}

func purchaseItemHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        itemID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
                return
        }

        var item ShopItem
        if err := db.First(&item, itemID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
                return
        }

        if !item.IsAvailable {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Item not available"})
                return
        }

        var existing UserInventory
        if err := db.Where("user_id = ? AND item_id = ?", userID, itemID).First(&existing).Error; err == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Item already owned"})
                return
        }

        var currency VirtualCurrency
        if err := db.Where("user_id = ?", userID).First(&currency).Error; err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "No currency balance"})
                return
        }

        var req struct {
                PayWith string `json:"pay_with"`
        }
        c.BindJSON(&req)

        if req.PayWith == "gems" && item.PriceGems > 0 {
                if currency.Gems < item.PriceGems {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Not enough gems"})
                        return
                }
                currency.Gems -= item.PriceGems
        } else {
                if currency.Coins < item.PriceCoins {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Not enough coins"})
                        return
                }
                currency.Coins -= item.PriceCoins
        }

        currency.UpdatedAt = time.Now()
        db.Save(&currency)

        inventory := UserInventory{
                UserID:     userID,
                ItemID:     uint(itemID),
                AcquiredAt: time.Now(),
        }
        db.Create(&inventory)

        c.JSON(http.StatusOK, gin.H{
                "message":   "Item purchased",
                "item":      item,
                "inventory": inventory,
                "balance":   currency,
        })
}

func getInventoryHandler(c *gin.Context) {
        userID := c.GetUint("user_id")

        var inventory []UserInventory
        db.Preload("Item").Where("user_id = ?", userID).Find(&inventory)
        c.JSON(http.StatusOK, inventory)
}

func equipItemHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        itemID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
                return
        }

        var inventory UserInventory
        if err := db.Preload("Item").Where("user_id = ? AND item_id = ?", userID, itemID).First(&inventory).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Item not in inventory"})
                return
        }

        db.Model(&UserInventory{}).Where("user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)", userID, inventory.Item.Type).Update("is_equipped", false)

        inventory.IsEquipped = true
        db.Save(&inventory)

        var profile UserProfile
        if err := db.Where("user_id = ?", userID).First(&profile).Error; err != nil {
                profile = UserProfile{UserID: userID, UpdatedAt: time.Now()}
                db.Create(&profile)
        }

        switch inventory.Item.Type {
        case "theme":
                profile.ThemeID = &inventory.ItemID
        case "frame":
                profile.FrameID = &inventory.ItemID
        case "banner":
                profile.BannerID = &inventory.ItemID
        }
        profile.UpdatedAt = time.Now()
        db.Save(&profile)

        c.JSON(http.StatusOK, gin.H{"message": "Item equipped", "inventory": inventory})
}

func getChallengesHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        challengeType := c.Query("type")

        var challenges []Challenge
        query := db.Where("is_active = ?", true)

        if challengeType != "" {
                query = query.Where("type = ?", challengeType)
        }

        query.Find(&challenges)

        var userChallenges []UserChallenge
        db.Where("user_id = ?", userID).Find(&userChallenges)

        progressMap := make(map[uint]UserChallenge)
        for _, uc := range userChallenges {
                progressMap[uc.ChallengeID] = uc
        }

        type ChallengeWithProgress struct {
                Challenge
                Progress    int        `json:"progress"`
                IsCompleted bool       `json:"is_completed"`
                CompletedAt *time.Time `json:"completed_at,omitempty"`
        }

        result := make([]ChallengeWithProgress, len(challenges))
        for i, ch := range challenges {
                result[i] = ChallengeWithProgress{Challenge: ch}
                if uc, ok := progressMap[ch.ID]; ok {
                        result[i].Progress = uc.Progress
                        result[i].IsCompleted = uc.IsCompleted
                        result[i].CompletedAt = uc.CompletedAt
                }
        }

        c.JSON(http.StatusOK, result)
}

func updateChallengeProgress(userID uint, condition string, amount int) {
        var challenges []Challenge
        db.Where("is_active = ? AND condition = ?", true, condition).Find(&challenges)

        for _, ch := range challenges {
                var uc UserChallenge
                if err := db.Where("user_id = ? AND challenge_id = ?", userID, ch.ID).First(&uc).Error; err != nil {
                        uc = UserChallenge{
                                UserID:      userID,
                                ChallengeID: ch.ID,
                                Progress:    0,
                                CreatedAt:   time.Now(),
                        }
                        db.Create(&uc)
                }

                if uc.IsCompleted {
                        continue
                }

                uc.Progress += amount
                if uc.Progress >= ch.Target {
                        uc.Progress = ch.Target
                        uc.IsCompleted = true
                        now := time.Now()
                        uc.CompletedAt = &now

                        if ch.XPReward > 0 {
                                awardXP(userID, ch.XPReward, "challenge_"+ch.Name)
                        }
                        if ch.CoinReward > 0 || ch.GemReward > 0 {
                                addCurrency(userID, ch.CoinReward, ch.GemReward)
                        }
                }
                db.Save(&uc)
        }
}

func addCurrency(userID uint, coins, gems int) {
        var currency VirtualCurrency
        if err := db.Where("user_id = ?", userID).First(&currency).Error; err != nil {
                currency = VirtualCurrency{
                        UserID:    userID,
                        Coins:     coins,
                        Gems:      gems,
                        UpdatedAt: time.Now(),
                }
                db.Create(&currency)
                return
        }

        currency.Coins += coins
        currency.Gems += gems
        currency.UpdatedAt = time.Now()
        db.Save(&currency)
}

func claimChallengeHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        challengeID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid challenge ID"})
                return
        }

        var uc UserChallenge
        if err := db.Preload("Challenge").Where("user_id = ? AND challenge_id = ?", userID, challengeID).First(&uc).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Challenge not found"})
                return
        }

        if !uc.IsCompleted {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Challenge not completed"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"message": "Rewards already claimed", "challenge": uc})
}

func getStreaksHandler(c *gin.Context) {
        userID := c.GetUint("user_id")

        var streak UserStreak
        if err := db.Where("user_id = ?", userID).First(&streak).Error; err != nil {
                streak = UserStreak{
                        UserID:    userID,
                        UpdatedAt: time.Now(),
                }
                db.Create(&streak)
        }

        c.JSON(http.StatusOK, streak)
}

func updateLoginStreak(userID uint) {
        var streak UserStreak
        if err := db.Where("user_id = ?", userID).First(&streak).Error; err != nil {
                streak = UserStreak{
                        UserID:    userID,
                        UpdatedAt: time.Now(),
                }
                db.Create(&streak)
        }

        today := time.Now().Truncate(24 * time.Hour)

        if streak.LastLoginDate != nil {
                lastLogin := streak.LastLoginDate.Truncate(24 * time.Hour)
                if lastLogin.Equal(today) {
                        return
                }

                if today.Sub(lastLogin) == 24*time.Hour {
                        streak.LoginStreak++
                } else {
                        streak.LoginStreak = 1
                }
        } else {
                streak.LoginStreak = 1
        }

        if streak.LoginStreak > streak.MaxLoginStreak {
                streak.MaxLoginStreak = streak.LoginStreak
        }

        now := time.Now()
        streak.LastLoginDate = &now
        streak.UpdatedAt = now
        db.Save(&streak)

        if streak.LoginStreak == 7 {
                addCurrency(userID, 50, 2)
                awardXP(userID, 100, "weekly_login_streak")
        } else if streak.LoginStreak == 30 {
                addCurrency(userID, 200, 10)
                awardXP(userID, 500, "monthly_login_streak")
        } else if streak.LoginStreak%7 == 0 {
                addCurrency(userID, 25, 1)
        }

        updateChallengeProgress(userID, "login_streak", 1)
}

func updateMessageStreak(userID uint) {
        var streak UserStreak
        if err := db.Where("user_id = ?", userID).First(&streak).Error; err != nil {
                streak = UserStreak{UserID: userID, UpdatedAt: time.Now()}
                db.Create(&streak)
        }

        today := time.Now().Truncate(24 * time.Hour)

        if streak.LastMessageDate != nil {
                lastMsg := streak.LastMessageDate.Truncate(24 * time.Hour)
                if lastMsg.Equal(today) {
                        return
                }

                if today.Sub(lastMsg) == 24*time.Hour {
                        streak.MessageStreak++
                } else {
                        streak.MessageStreak = 1
                }
        } else {
                streak.MessageStreak = 1
        }

        if streak.MessageStreak > streak.MaxMessageStreak {
                streak.MaxMessageStreak = streak.MessageStreak
        }

        now := time.Now()
        streak.LastMessageDate = &now
        streak.UpdatedAt = now
        db.Save(&streak)

        updateChallengeProgress(userID, "message_streak", 1)
}

func getCompetitionsHandler(c *gin.Context) {
        status := c.Query("status")

        var competitions []GuildCompetition
        query := db

        now := time.Now()
        if status == "active" {
                query = query.Where("is_active = ? AND starts_at <= ? AND ends_at >= ?", true, now, now)
        } else if status == "upcoming" {
                query = query.Where("is_active = ? AND starts_at > ?", true, now)
        } else if status == "ended" {
                query = query.Where("ends_at < ?", now)
        }

        query.Order("starts_at DESC").Find(&competitions)
        c.JSON(http.StatusOK, competitions)
}

func getCompetitionHandler(c *gin.Context) {
        competitionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid competition ID"})
                return
        }

        var competition GuildCompetition
        if err := db.First(&competition, competitionID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Competition not found"})
                return
        }

        var entries []GuildCompetitionEntry
        db.Preload("Guild").Where("competition_id = ?", competitionID).Order("score DESC").Find(&entries)

        for i := range entries {
                entries[i].Rank = i + 1
        }

        c.JSON(http.StatusOK, gin.H{
                "competition": competition,
                "leaderboard": entries,
        })
}

func joinCompetitionHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        competitionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid competition ID"})
                return
        }

        var req struct {
                GuildID uint `json:"guild_id" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Guild ID required"})
                return
        }

        var member GuildMember
        if err := db.Where("guild_id = ? AND user_id = ? AND role IN ('owner', 'admin')", req.GuildID, userID).First(&member).Error; err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": "Only guild admins can join competitions"})
                return
        }

        var competition GuildCompetition
        if err := db.First(&competition, competitionID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Competition not found"})
                return
        }

        now := time.Now()
        if now.Before(competition.StartsAt) || now.After(competition.EndsAt) {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Competition not active"})
                return
        }

        var existing GuildCompetitionEntry
        if err := db.Where("competition_id = ? AND guild_id = ?", competitionID, req.GuildID).First(&existing).Error; err == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Guild already joined"})
                return
        }

        entry := GuildCompetitionEntry{
                CompetitionID: uint(competitionID),
                GuildID:       req.GuildID,
                Score:         0,
                UpdatedAt:     time.Now(),
        }
        db.Create(&entry)

        c.JSON(http.StatusOK, gin.H{"message": "Joined competition", "entry": entry})
}

func updateCompetitionScore(guildID uint, metric string, amount int) {
        now := time.Now()
        var competitions []GuildCompetition
        db.Where("is_active = ? AND metric = ? AND starts_at <= ? AND ends_at >= ?", true, metric, now, now).Find(&competitions)

        for _, comp := range competitions {
                var entry GuildCompetitionEntry
                if err := db.Where("competition_id = ? AND guild_id = ?", comp.ID, guildID).First(&entry).Error; err == nil {
                        entry.Score += amount
                        entry.UpdatedAt = time.Now()
                        db.Save(&entry)
                }
        }
}

func getProfileCustomizationHandler(c *gin.Context) {
        userIDParam := c.Param("user_id")
        var userID uint
        if userIDParam == "" || userIDParam == "me" {
                userID = c.GetUint("user_id")
        } else {
                id, errParse := strconv.ParseUint(userIDParam, 10, 32)
                if errParse != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                        return
                }
                userID = uint(id)
        }

        var profile UserProfile
        if err := db.Where("user_id = ?", userID).First(&profile).Error; err != nil {
                profile = UserProfile{
                        UserID:           userID,
                        ShowLevel:        true,
                        ShowAchievements: true,
                        ShowActivity:     true,
                        UpdatedAt:        time.Now(),
                }
                db.Create(&profile)
        }

        var inventory []UserInventory
        db.Preload("Item").Where("user_id = ? AND is_equipped = ?", userID, true).Find(&inventory)

        var badges []UserBadge
        db.Preload("Badge").Where("user_id = ?", userID).Find(&badges)

        c.JSON(http.StatusOK, gin.H{
                "profile":        profile,
                "equipped_items": inventory,
                "badges":         badges,
        })
}

func updateProfileCustomizationHandler(c *gin.Context) {
        userID := c.GetUint("user_id")

        var profile UserProfile
        if err := db.Where("user_id = ?", userID).First(&profile).Error; err != nil {
                profile = UserProfile{UserID: userID, UpdatedAt: time.Now()}
                db.Create(&profile)
        }

        var req struct {
                Bio              *string `json:"bio,omitempty"`
                ProfileColor     *string `json:"profile_color,omitempty"`
                ShowLevel        *bool   `json:"show_level,omitempty"`
                ShowAchievements *bool   `json:"show_achievements,omitempty"`
                ShowActivity     *bool   `json:"show_activity,omitempty"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.Bio != nil {
                profile.Bio = *req.Bio
        }
        if req.ProfileColor != nil {
                profile.ProfileColor = *req.ProfileColor
        }
        if req.ShowLevel != nil {
                profile.ShowLevel = *req.ShowLevel
        }
        if req.ShowAchievements != nil {
                profile.ShowAchievements = *req.ShowAchievements
        }
        if req.ShowActivity != nil {
                profile.ShowActivity = *req.ShowActivity
        }
        profile.UpdatedAt = time.Now()
        db.Save(&profile)

        c.JSON(http.StatusOK, profile)
}

func getBadgesHandler(c *gin.Context) {
        var badges []Badge
        db.Find(&badges)
        c.JSON(http.StatusOK, badges)
}

func getUserBadgesHandler(c *gin.Context) {
        userIDParam := c.Param("user_id")
        var userID uint
        if userIDParam == "" {
                userID = c.GetUint("user_id")
        } else {
                id, errParse := strconv.ParseUint(userIDParam, 10, 32)
                if errParse != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                        return
                }
                userID = uint(id)
        }

        var badges []UserBadge
        db.Preload("Badge").Where("user_id = ?", userID).Find(&badges)
        c.JSON(http.StatusOK, badges)
}

func awardBadge(userID uint, badgeID uint) {
        var existing UserBadge
        if err := db.Where("user_id = ? AND badge_id = ?", userID, badgeID).First(&existing).Error; err == nil {
                return
        }

        db.Create(&UserBadge{
                UserID:     userID,
                BadgeID:    badgeID,
                AcquiredAt: time.Now(),
        })
}

func seedDefaultChallenges() {
        var count int64
        db.Model(&Challenge{}).Count(&count)
        if count > 0 {
                return
        }

        challenges := []Challenge{
                {Name: "Daily Chatter", NameRu: "Ежедневный чат", Description: "Send 10 messages today", DescRu: "Отправьте 10 сообщений сегодня", Type: "daily", Condition: "messages", Target: 10, XPReward: 25, CoinReward: 5, ResetPeriod: "daily"},
                {Name: "Active Participant", NameRu: "Активный участник", Description: "Send 50 messages today", DescRu: "Отправьте 50 сообщений сегодня", Type: "daily", Condition: "messages", Target: 50, XPReward: 75, CoinReward: 15, ResetPeriod: "daily"},
                {Name: "Reaction Master", NameRu: "Мастер реакций", Description: "Add 5 reactions today", DescRu: "Добавьте 5 реакций сегодня", Type: "daily", Condition: "reactions", Target: 5, XPReward: 20, CoinReward: 5, ResetPeriod: "daily"},
                {Name: "Voice Active", NameRu: "Голосовая активность", Description: "Spend 30 minutes in voice channels today", DescRu: "Проведите 30 минут в голосовых каналах", Type: "daily", Condition: "voice_minutes", Target: 30, XPReward: 50, CoinReward: 10, ResetPeriod: "daily"},
                {Name: "Weekly Warrior", NameRu: "Недельный воин", Description: "Send 200 messages this week", DescRu: "Отправьте 200 сообщений на этой неделе", Type: "weekly", Condition: "messages", Target: 200, XPReward: 150, CoinReward: 30, GemReward: 2, ResetPeriod: "weekly"},
                {Name: "Social Butterfly", NameRu: "Социальная бабочка", Description: "React to 50 messages this week", DescRu: "Добавьте 50 реакций на этой неделе", Type: "weekly", Condition: "reactions", Target: 50, XPReward: 100, CoinReward: 20, GemReward: 1, ResetPeriod: "weekly"},
                {Name: "Voice Champion", NameRu: "Голосовой чемпион", Description: "Spend 5 hours in voice channels this week", DescRu: "Проведите 5 часов в голосовых каналах", Type: "weekly", Condition: "voice_minutes", Target: 300, XPReward: 200, CoinReward: 40, GemReward: 3, ResetPeriod: "weekly"},
                {Name: "Poll Creator", NameRu: "Создатель опросов", Description: "Create a poll this week", DescRu: "Создайте опрос на этой неделе", Type: "weekly", Condition: "polls_created", Target: 1, XPReward: 50, CoinReward: 10, ResetPeriod: "weekly"},
                {Name: "Login Streak", NameRu: "Серия входов", Description: "Log in for 7 consecutive days", DescRu: "Входите 7 дней подряд", Type: "special", Condition: "login_streak", Target: 7, XPReward: 100, CoinReward: 50, GemReward: 5, ResetPeriod: ""},
                {Name: "Post Master", NameRu: "Мастер постов", Description: "Create 5 posts this week", DescRu: "Создайте 5 постов на этой неделе", Type: "weekly", Condition: "posts", Target: 5, XPReward: 75, CoinReward: 15, GemReward: 1, ResetPeriod: "weekly"},
        }

        for _, ch := range challenges {
                ch.IsActive = true
                ch.CreatedAt = time.Now()
                db.Create(&ch)
        }
}

func seedDefaultShopItems() {
        var count int64
        db.Model(&ShopItem{}).Count(&count)
        if count > 0 {
                return
        }

        items := []ShopItem{
                {Name: "Midnight Theme", NameRu: "Полночная тема", Description: "Dark blue elegant theme", Type: "theme", Category: "themes", PriceCoins: 100, Rarity: "common", ImageURL: "/themes/midnight.png"},
                {Name: "Sunset Theme", NameRu: "Закатная тема", Description: "Warm orange and pink theme", Type: "theme", Category: "themes", PriceCoins: 150, Rarity: "uncommon", ImageURL: "/themes/sunset.png"},
                {Name: "Neon Theme", NameRu: "Неоновая тема", Description: "Vibrant neon colors", Type: "theme", Category: "themes", PriceCoins: 300, PriceGems: 5, Rarity: "rare", ImageURL: "/themes/neon.png"},
                {Name: "Galaxy Theme", NameRu: "Галактическая тема", Description: "Cosmic space theme", Type: "theme", Category: "themes", PriceCoins: 500, PriceGems: 10, Rarity: "epic", ImageURL: "/themes/galaxy.png"},
                {Name: "Golden Frame", NameRu: "Золотая рамка", Description: "Elegant golden profile frame", Type: "frame", Category: "frames", PriceCoins: 200, Rarity: "uncommon", ImageURL: "/frames/golden.png"},
                {Name: "Diamond Frame", NameRu: "Бриллиантовая рамка", Description: "Sparkling diamond frame", Type: "frame", Category: "frames", PriceCoins: 400, PriceGems: 8, Rarity: "rare", ImageURL: "/frames/diamond.png"},
                {Name: "Fire Frame", NameRu: "Огненная рамка", Description: "Animated fire effect frame", Type: "frame", Category: "frames", PriceCoins: 600, PriceGems: 15, Rarity: "epic", ImageURL: "/frames/fire.png"},
                {Name: "Gradient Banner", NameRu: "Градиентный баннер", Description: "Smooth color gradient banner", Type: "banner", Category: "banners", PriceCoins: 150, Rarity: "common", ImageURL: "/banners/gradient.png"},
                {Name: "Abstract Banner", NameRu: "Абстрактный баннер", Description: "Modern abstract design", Type: "banner", Category: "banners", PriceCoins: 250, Rarity: "uncommon", ImageURL: "/banners/abstract.png"},
                {Name: "Aurora Banner", NameRu: "Северное сияние", Description: "Beautiful aurora borealis", Type: "banner", Category: "banners", PriceCoins: 450, PriceGems: 10, Rarity: "rare", ImageURL: "/banners/aurora.png"},
        }

        for _, item := range items {
                item.IsAvailable = true
                item.CreatedAt = time.Now()
                db.Create(&item)
        }
}

func seedDefaultBadges() {
        var count int64
        db.Model(&Badge{}).Count(&count)
        if count > 0 {
                return
        }

        badges := []Badge{
                {Name: "Early Adopter", NameRu: "Ранний пользователь", Description: "Joined during launch", Icon: "star", Rarity: "epic", Condition: "early_adopter", IsSpecial: true},
                {Name: "Verified", NameRu: "Проверен", Description: "Verified account", Icon: "check-circle", Rarity: "uncommon", Condition: "verified"},
                {Name: "Supporter", NameRu: "Поддержка", Description: "Premium subscriber", Icon: "heart", Rarity: "rare", Condition: "premium"},
                {Name: "Bug Hunter", NameRu: "Охотник за багами", Description: "Found and reported bugs", Icon: "bug", Rarity: "epic", Condition: "bug_hunter", IsSpecial: true},
                {Name: "Content Creator", NameRu: "Создатель контента", Description: "Active content creator", Icon: "video", Rarity: "rare", Condition: "creator"},
                {Name: "Moderator", NameRu: "Модератор", Description: "Community moderator", Icon: "shield", Rarity: "epic", Condition: "moderator"},
                {Name: "Developer", NameRu: "Разработчик", Description: "Platform developer", Icon: "code", Rarity: "legendary", Condition: "developer", IsSpecial: true},
                {Name: "Partner", NameRu: "Партнёр", Description: "Official partner", Icon: "handshake", Rarity: "legendary", Condition: "partner", IsSpecial: true},
        }

        for _, badge := range badges {
                badge.CreatedAt = time.Now()
                db.Create(&badge)
        }
}

func seedDefaultCompetition() {
        var count int64
        db.Model(&GuildCompetition{}).Count(&count)
        if count > 0 {
                return
        }

        now := time.Now()
        weekEnd := now.AddDate(0, 0, 7)

        competitions := []GuildCompetition{
                {
                        Name:        "Weekly Message Race",
                        NameRu:      "Еженедельная гонка сообщений",
                        Description: "The guild with most messages wins!",
                        DescRu:      "Гильдия с наибольшим количеством сообщений побеждает!",
                        Type:        "weekly",
                        Metric:      "messages",
                        StartsAt:    now,
                        EndsAt:      weekEnd,
                        Prizes:      `{"1st": {"coins": 1000, "gems": 50}, "2nd": {"coins": 500, "gems": 25}, "3rd": {"coins": 250, "gems": 10}}`,
                        IsActive:    true,
                        CreatedAt:   now,
                },
        }

        for _, comp := range competitions {
                db.Create(&comp)
        }
}

func initPhase2() {
        db.AutoMigrate(
                &VirtualCurrency{},
                &ShopItem{},
                &UserInventory{},
                &Challenge{},
                &UserChallenge{},
                &UserStreak{},
                &GuildCompetition{},
                &GuildCompetitionEntry{},
                &UserProfile{},
                &Badge{},
                &UserBadge{},
        )

        seedDefaultChallenges()
        seedDefaultShopItems()
        seedDefaultBadges()
        seedDefaultCompetition()

        go resetDailyChallenges()
}

func resetDailyChallenges() {
        ticker := time.NewTicker(1 * time.Hour)
        defer ticker.Stop()

        for range ticker.C {
                now := time.Now()
                if now.Hour() == 0 {
                        db.Model(&UserChallenge{}).
                                Joins("JOIN challenges ON challenges.id = user_challenges.challenge_id").
                                Where("challenges.reset_period = ? AND user_challenges.is_completed = ?", "daily", true).
                                Updates(map[string]interface{}{
                                        "progress":     0,
                                        "is_completed": false,
                                        "completed_at": nil,
                                        "reset_at":     now,
                                })
                }

                if now.Hour() == 0 && now.Weekday() == time.Monday {
                        db.Model(&UserChallenge{}).
                                Joins("JOIN challenges ON challenges.id = user_challenges.challenge_id").
                                Where("challenges.reset_period = ? AND user_challenges.is_completed = ?", "weekly", true).
                                Updates(map[string]interface{}{
                                        "progress":     0,
                                        "is_completed": false,
                                        "completed_at": nil,
                                        "reset_at":     now,
                                })
                }
        }
}

func getDailyRewardHandler(c *gin.Context) {
        userID := c.GetUint("user_id")

        var streak UserStreak
        if err := db.Where("user_id = ?", userID).First(&streak).Error; err != nil {
                streak = UserStreak{UserID: userID, UpdatedAt: time.Now()}
                db.Create(&streak)
        }

        today := time.Now().Truncate(24 * time.Hour)
        if streak.LastLoginDate != nil && streak.LastLoginDate.Truncate(24*time.Hour).Equal(today) {
                c.JSON(http.StatusOK, gin.H{
                        "already_claimed": true,
                        "streak":          streak.LoginStreak,
                        "next_reward":     getStreakReward(streak.LoginStreak + 1),
                })
                return
        }

        updateLoginStreak(userID)

        db.Where("user_id = ?", userID).First(&streak)

        reward := getStreakReward(streak.LoginStreak)

        c.JSON(http.StatusOK, gin.H{
                "claimed":         true,
                "streak":          streak.LoginStreak,
                "reward":          reward,
                "next_reward":     getStreakReward(streak.LoginStreak + 1),
        })
}

func getStreakReward(day int) map[string]int {
        baseCoins := 10
        baseXP := 5

        if day%7 == 0 {
                return map[string]int{"coins": 50, "gems": 2, "xp": 100}
        }
        if day%30 == 0 {
                return map[string]int{"coins": 200, "gems": 10, "xp": 500}
        }

        coins := baseCoins + (day-1)*2
        if coins > 30 {
                coins = 30
        }

        return map[string]int{"coins": coins, "xp": baseXP + day}
}

func spinWheelHandler(c *gin.Context) {
        userID := c.GetUint("user_id")

        var currency VirtualCurrency
        if err := db.Where("user_id = ?", userID).First(&currency).Error; err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "No balance"})
                return
        }

        spinCost := 25
        if currency.Coins < spinCost {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Not enough coins", "required": spinCost})
                return
        }

        currency.Coins -= spinCost
        currency.UpdatedAt = time.Now()

        prizes := []struct {
                Name   string
                Coins  int
                Gems   int
                XP     int
                Weight int
        }{
                {"Nothing", 0, 0, 0, 20},
                {"10 Coins", 10, 0, 0, 25},
                {"25 Coins", 25, 0, 0, 20},
                {"50 Coins", 50, 0, 0, 15},
                {"100 Coins", 100, 0, 0, 8},
                {"1 Gem", 0, 1, 0, 7},
                {"3 Gems", 0, 3, 0, 3},
                {"50 XP", 0, 0, 50, 2},
        }

        totalWeight := 0
        for _, p := range prizes {
                totalWeight += p.Weight
        }

        roll := rand.Intn(totalWeight)
        cumWeight := 0
        var won struct {
                Name   string
                Coins  int
                Gems   int
                XP     int
        }

        for _, p := range prizes {
                cumWeight += p.Weight
                if roll < cumWeight {
                        won.Name = p.Name
                        won.Coins = p.Coins
                        won.Gems = p.Gems
                        won.XP = p.XP
                        break
                }
        }

        currency.Coins += won.Coins
        currency.Gems += won.Gems
        db.Save(&currency)

        if won.XP > 0 {
                awardXP(userID, won.XP, "wheel_spin")
        }

        c.JSON(http.StatusOK, gin.H{
                "prize":   won,
                "balance": currency,
        })
}

func getGuildLeaderboardHandler(c *gin.Context) {
        guildID, err := strconv.ParseUint(c.Param("guild_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }
        period := c.DefaultQuery("period", "all")

        var members []GuildMember
        db.Where("guild_id = ?", guildID).Find(&members)

        memberIDs := make([]uint, len(members))
        for i, m := range members {
                memberIDs[i] = m.UserID
        }

        var levels []UserLevel
        query := db.Preload("User").Where("user_id IN ?", memberIDs)

        if period == "week" {
                weekAgo := time.Now().AddDate(0, 0, -7)
                var xpEvents []XPEvent
                db.Where("user_id IN ? AND created_at >= ?", memberIDs, weekAgo).Find(&xpEvents)

                xpMap := make(map[uint]int)
                for _, e := range xpEvents {
                        xpMap[e.UserID] += e.Amount
                }

                var leaderboard []Leaderboard
                for userID, xp := range xpMap {
                        var user User
                        db.First(&user, userID)
                        avatar := ""
                        if user.Avatar != nil {
                                avatar = *user.Avatar
                        }
                        leaderboard = append(leaderboard, Leaderboard{
                                UserID:   userID,
                                Username: user.Username,
                                Avatar:   avatar,
                                TotalXP:  xp,
                        })
                }

                for i := range leaderboard {
                        for j := i + 1; j < len(leaderboard); j++ {
                                if leaderboard[j].TotalXP > leaderboard[i].TotalXP {
                                        leaderboard[i], leaderboard[j] = leaderboard[j], leaderboard[i]
                                }
                        }
                        leaderboard[i].Rank = i + 1
                }

                c.JSON(http.StatusOK, leaderboard)
                return
        }

        query.Order("total_xp DESC").Find(&levels)

        leaderboard := make([]Leaderboard, len(levels))
        for i, l := range levels {
                avatar := ""
                if l.User.Avatar != nil {
                        avatar = *l.User.Avatar
                }
                leaderboard[i] = Leaderboard{
                        UserID:   l.UserID,
                        Username: l.User.Username,
                        Avatar:   avatar,
                        Level:    l.Level,
                        TotalXP:  l.TotalXP,
                        Rank:     i + 1,
                }
        }

        c.JSON(http.StatusOK, leaderboard)
}

func getLevelRewardsHandler(c *gin.Context) {
        rewards := []map[string]interface{}{
                {"level": 5, "coins": 50, "description": "Reach level 5"},
                {"level": 10, "coins": 100, "gems": 5, "description": "Reach level 10"},
                {"level": 25, "coins": 250, "gems": 10, "unlock": "custom_frame", "description": "Reach level 25"},
                {"level": 50, "coins": 500, "gems": 25, "unlock": "animated_avatar", "description": "Reach level 50"},
                {"level": 100, "coins": 1000, "gems": 50, "unlock": "legendary_badge", "description": "Reach level 100"},
        }
        c.JSON(http.StatusOK, rewards)
}

func registerPhase2Routes(r *gin.Engine, auth gin.HandlerFunc) {
        r.GET("/api/currency", auth, getCurrencyHandler)
        r.GET("/api/shop", getShopItemsHandler)
        r.POST("/api/shop/:id/purchase", auth, purchaseItemHandler)
        r.GET("/api/inventory", auth, getInventoryHandler)
        r.POST("/api/inventory/:id/equip", auth, equipItemHandler)

        r.GET("/api/challenges", auth, getChallengesHandler)
        r.POST("/api/challenges/:id/claim", auth, claimChallengeHandler)

        r.GET("/api/streaks", auth, getStreaksHandler)
        r.POST("/api/daily-reward", auth, getDailyRewardHandler)
        r.POST("/api/spin-wheel", auth, spinWheelHandler)

        r.GET("/api/competitions", getCompetitionsHandler)
        r.GET("/api/competitions/:id", getCompetitionHandler)
        r.POST("/api/competitions/:id/join", auth, joinCompetitionHandler)

        r.GET("/api/profile/:user_id/customization", auth, getProfileCustomizationHandler)
        r.PUT("/api/profile/customization", auth, updateProfileCustomizationHandler)
        r.GET("/api/badges", getBadgesHandler)
        r.GET("/api/badges/:user_id", getUserBadgesHandler)

        r.GET("/api/guild-leaderboard/:guild_id", auth, getGuildLeaderboardHandler)
        r.GET("/api/level-rewards", getLevelRewardsHandler)
}
