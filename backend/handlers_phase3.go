package main

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

// ============= GIFT SYSTEM =============

type UserGiftItem struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        SenderID    uint       `json:"sender_id" gorm:"not null;index"`
        ReceiverID  uint       `json:"receiver_id" gorm:"not null;index"`
        ItemID      uint       `json:"item_id" gorm:"not null"`
        Message     string     `json:"message" gorm:"size:500"`
        IsOpened    bool       `json:"is_opened" gorm:"default:false"`
        OpenedAt    *time.Time `json:"opened_at,omitempty"`
        CreatedAt   time.Time  `json:"created_at"`
        Sender      User       `json:"sender,omitempty" gorm:"foreignKey:SenderID;constraint:OnDelete:SET NULL"`
        Receiver    User       `json:"receiver,omitempty" gorm:"foreignKey:ReceiverID;constraint:OnDelete:CASCADE"`
        Item        ShopItem   `json:"item,omitempty" gorm:"foreignKey:ItemID;constraint:OnDelete:CASCADE"`
}

// ============= TRADING SYSTEM =============

type Trade struct {
        ID            uint       `json:"id" gorm:"primaryKey"`
        InitiatorID   uint       `json:"initiator_id" gorm:"not null;index"`
        ReceiverID    uint       `json:"receiver_id" gorm:"not null;index"`
        Status        string     `json:"status" gorm:"default:pending"` // pending, accepted, rejected, cancelled
        InitiatorNote string     `json:"initiator_note" gorm:"size:500"`
        ReceiverNote  string     `json:"receiver_note" gorm:"size:500"`
        ExpiresAt     time.Time  `json:"expires_at"`
        CompletedAt   *time.Time `json:"completed_at,omitempty"`
        CreatedAt     time.Time  `json:"created_at"`
        Initiator     User       `json:"initiator,omitempty" gorm:"foreignKey:InitiatorID;constraint:OnDelete:CASCADE"`
        Receiver      User       `json:"receiver,omitempty" gorm:"foreignKey:ReceiverID;constraint:OnDelete:CASCADE"`
}

type TradeItem struct {
        ID          uint   `json:"id" gorm:"primaryKey"`
        TradeID     uint   `json:"trade_id" gorm:"not null;index"`
        OwnerID     uint   `json:"owner_id" gorm:"not null"`
        InventoryID uint   `json:"inventory_id"`
        ItemType    string `json:"item_type"` // item, coins, gems
        Amount      int    `json:"amount" gorm:"default:1"`
        Trade       Trade  `json:"-" gorm:"foreignKey:TradeID;constraint:OnDelete:CASCADE"`
}

// ============= ACTIVITY FEED =============

type ActivityFeed struct {
        ID         uint      `json:"id" gorm:"primaryKey"`
        UserID     uint      `json:"user_id" gorm:"not null;index"`
        ActorID    uint      `json:"actor_id" gorm:"not null;index"`
        ActionType string    `json:"action_type" gorm:"not null;index"` // level_up, achievement, gift_received, trade, friend_add, post, etc.
        TargetType string    `json:"target_type,omitempty"`             // user, post, guild, achievement, etc.
        TargetID   uint      `json:"target_id,omitempty"`
        Metadata   string    `json:"metadata,omitempty" gorm:"type:text"` // JSON metadata
        IsRead     bool      `json:"is_read" gorm:"default:false"`
        CreatedAt  time.Time `json:"created_at"`
        Actor      User      `json:"actor,omitempty" gorm:"foreignKey:ActorID"`
}

// ============= ENHANCED FRIENDS =============

type FriendInteraction struct {
        ID              uint      `json:"id" gorm:"primaryKey"`
        UserID          uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_friend_pair"`
        FriendID        uint      `json:"friend_id" gorm:"not null;uniqueIndex:idx_friend_pair"`
        InteractionType string    `json:"interaction_type"` // message, reaction, gift, voice
        Count           int       `json:"count" gorm:"default:0"`
        LastInteraction time.Time `json:"last_interaction"`
        UpdatedAt       time.Time `json:"updated_at"`
}

type BestFriend struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        UserID    uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_best_friend"`
        FriendID  uint      `json:"friend_id" gorm:"not null;uniqueIndex:idx_best_friend"`
        Score     int       `json:"score" gorm:"default:0"`
        Rank      int       `json:"rank" gorm:"default:0"` // 1-3 for top 3 best friends
        CreatedAt time.Time `json:"created_at"`
        UpdatedAt time.Time `json:"updated_at"`
        Friend    User      `json:"friend,omitempty" gorm:"foreignKey:FriendID"`
}

// ============= EVENTS SYSTEM =============

type Event struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        Name        string     `json:"name" gorm:"not null"`
        Description string     `json:"description" gorm:"type:text"`
        EventType   string     `json:"event_type" gorm:"not null"` // seasonal, special, community, challenge
        Theme       string     `json:"theme"`                      // christmas, halloween, summer, etc.
        BannerURL   string     `json:"banner_url"`
        StartDate   time.Time  `json:"start_date" gorm:"not null;index"`
        EndDate     time.Time  `json:"end_date" gorm:"not null;index"`
        IsActive    bool       `json:"is_active" gorm:"default:true"`
        CoinBonus   float64    `json:"coin_bonus" gorm:"default:1.0"` // Multiplier for coin earnings
        XPBonus     float64    `json:"xp_bonus" gorm:"default:1.0"`   // Multiplier for XP earnings
        CreatedAt   time.Time  `json:"created_at"`
}

type EventReward struct {
        ID          uint   `json:"id" gorm:"primaryKey"`
        EventID     uint   `json:"event_id" gorm:"not null;index;constraint:OnDelete:CASCADE"`
        Name        string `json:"name" gorm:"not null"`
        Description string `json:"description"`
        RewardType  string `json:"reward_type"` // item, badge, coins, gems, xp
        RewardValue int    `json:"reward_value"`
        ItemID      *uint  `json:"item_id,omitempty"`
        BadgeID     *uint  `json:"badge_id,omitempty"`
        Requirement string `json:"requirement"` // points, rank, participation
        Threshold   int    `json:"threshold"`   // Points needed or rank required
}

type EventParticipant struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        EventID   uint      `json:"event_id" gorm:"not null;uniqueIndex:idx_event_user;constraint:OnDelete:CASCADE"`
        UserID    uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_event_user"`
        Points    int       `json:"points" gorm:"default:0;index"`
        Rank      int       `json:"rank" gorm:"default:0"`
        JoinedAt  time.Time `json:"joined_at"`
        UpdatedAt time.Time `json:"updated_at"`
        User      User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type EventRewardClaim struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        EventID   uint      `json:"event_id" gorm:"not null;uniqueIndex:idx_event_reward_user;constraint:OnDelete:CASCADE"`
        UserID    uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_event_reward_user"`
        RewardID  uint      `json:"reward_id" gorm:"not null;uniqueIndex:idx_event_reward_user;constraint:OnDelete:CASCADE"`
        ClaimedAt time.Time `json:"claimed_at"`
}

// ============= CLANS/TEAMS =============

type Clan struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        GuildID     uint      `json:"guild_id" gorm:"not null;index"`
        Name        string    `json:"name" gorm:"not null"`
        Description string    `json:"description" gorm:"size:500"`
        IconURL     string    `json:"icon_url"`
        Color       string    `json:"color" gorm:"default:#6366f1"`
        LeaderID    uint      `json:"leader_id" gorm:"not null"`
        MaxMembers  int       `json:"max_members" gorm:"default:20"`
        TotalXP     int       `json:"total_xp" gorm:"default:0"`
        IsPublic    bool      `json:"is_public" gorm:"default:true"`
        CreatedAt   time.Time `json:"created_at"`
        Leader      User      `json:"leader,omitempty" gorm:"foreignKey:LeaderID"`
        Guild       Guild     `json:"guild,omitempty" gorm:"foreignKey:GuildID;constraint:OnDelete:CASCADE"`
}

type ClanMember struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        ClanID    uint      `json:"clan_id" gorm:"not null;uniqueIndex:idx_clan_member;constraint:OnDelete:CASCADE"`
        UserID    uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_clan_member"`
        Role      string    `json:"role" gorm:"default:member"` // leader, officer, member
        XPContrib int       `json:"xp_contrib" gorm:"default:0"`
        JoinedAt  time.Time `json:"joined_at"`
        User      User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type ClanChallenge struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        ClanID      uint       `json:"clan_id" gorm:"not null;index;constraint:OnDelete:CASCADE"`
        Name        string     `json:"name" gorm:"not null"`
        Description string     `json:"description"`
        Goal        int        `json:"goal" gorm:"not null"`
        Progress    int        `json:"progress" gorm:"default:0"`
        RewardCoins int        `json:"reward_coins" gorm:"default:0"`
        RewardXP    int        `json:"reward_xp" gorm:"default:0"`
        IsCompleted bool       `json:"is_completed" gorm:"default:false"`
        ExpiresAt   *time.Time `json:"expires_at,omitempty"`
        CreatedAt   time.Time  `json:"created_at"`
}

// ============= MINI-GAMES =============

type MiniGame struct {
        ID          uint   `json:"id" gorm:"primaryKey"`
        Name        string `json:"name" gorm:"not null"`
        Description string `json:"description"`
        GameType    string `json:"game_type" gorm:"not null"` // trivia, reaction, memory, typing
        Difficulty  string `json:"difficulty" gorm:"default:medium"`
        CoinReward  int    `json:"coin_reward" gorm:"default:10"`
        XPReward    int    `json:"xp_reward" gorm:"default:5"`
        CooldownMin int    `json:"cooldown_min" gorm:"default:60"` // Cooldown in minutes
        IsActive    bool   `json:"is_active" gorm:"default:true"`
}

type MiniGameSession struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        GameID      uint       `json:"game_id" gorm:"not null;index;constraint:OnDelete:CASCADE"`
        UserID      uint       `json:"user_id" gorm:"not null;index"`
        Score       int        `json:"score" gorm:"default:0"`
        HighScore   int        `json:"high_score" gorm:"default:0"`
        CoinsEarned int        `json:"coins_earned" gorm:"default:0"`
        XPEarned    int        `json:"xp_earned" gorm:"default:0"`
        PlayedAt    time.Time  `json:"played_at"`
        CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type TriviaQuestion struct {
        ID         uint      `json:"id" gorm:"primaryKey"`
        Question   string    `json:"question" gorm:"not null;type:text"`
        Options    string    `json:"options" gorm:"type:text"` // JSON array of options
        CorrectIdx int       `json:"correct_idx" gorm:"not null"`
        Category   string    `json:"category" gorm:"index"`
        Difficulty string    `json:"difficulty" gorm:"default:medium"`
        Points     int       `json:"points" gorm:"default:10"`
        CreatedAt  time.Time `json:"created_at"`
}

// ============= QUEST CHAINS =============

type QuestChain struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        Name        string    `json:"name" gorm:"not null"`
        Description string    `json:"description" gorm:"type:text"`
        Category    string    `json:"category"` // tutorial, social, content, exploration
        TotalSteps  int       `json:"total_steps" gorm:"not null"`
        FinalReward string    `json:"final_reward" gorm:"type:text"` // JSON with final rewards
        IsActive    bool      `json:"is_active" gorm:"default:true"`
        CreatedAt   time.Time `json:"created_at"`
}

type QuestStep struct {
        ID          uint   `json:"id" gorm:"primaryKey"`
        ChainID     uint   `json:"chain_id" gorm:"not null;index;constraint:OnDelete:CASCADE"`
        StepOrder   int    `json:"step_order" gorm:"not null"`
        Name        string `json:"name" gorm:"not null"`
        Description string `json:"description"`
        ActionType  string `json:"action_type"` // send_message, add_friend, join_guild, create_post, etc.
        Requirement int    `json:"requirement" gorm:"default:1"`
        RewardCoins int    `json:"reward_coins" gorm:"default:0"`
        RewardXP    int    `json:"reward_xp" gorm:"default:0"`
        RewardGems  int    `json:"reward_gems" gorm:"default:0"`
}

type UserQuestProgress struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        UserID      uint       `json:"user_id" gorm:"not null;uniqueIndex:idx_user_quest"`
        ChainID     uint       `json:"chain_id" gorm:"not null;uniqueIndex:idx_user_quest;constraint:OnDelete:CASCADE"`
        CurrentStep int        `json:"current_step" gorm:"default:1"`
        StepProgress int       `json:"step_progress" gorm:"default:0"`
        IsCompleted bool       `json:"is_completed" gorm:"default:false"`
        StartedAt   time.Time  `json:"started_at"`
        CompletedAt *time.Time `json:"completed_at,omitempty"`
        Chain       QuestChain `json:"chain,omitempty" gorm:"foreignKey:ChainID"`
}

// ============= MENTORSHIP SYSTEM =============

type Mentorship struct {
        ID          uint       `json:"id" gorm:"primaryKey"`
        MentorID    uint       `json:"mentor_id" gorm:"not null;index"`
        MenteeID    uint       `json:"mentee_id" gorm:"not null;uniqueIndex"` // Each user can only have one mentor
        Status      string     `json:"status" gorm:"default:active"`         // active, completed, cancelled
        MentorXP    int        `json:"mentor_xp" gorm:"default:0"`
        MenteeLevel int        `json:"mentee_level" gorm:"default:1"` // Level when mentorship started
        TasksDone   int        `json:"tasks_done" gorm:"default:0"`
        StartedAt   time.Time  `json:"started_at"`
        CompletedAt *time.Time `json:"completed_at,omitempty"`
        Mentor      User       `json:"mentor,omitempty" gorm:"foreignKey:MentorID"`
        Mentee      User       `json:"mentee,omitempty" gorm:"foreignKey:MenteeID"`
}

type MentorTask struct {
        ID          uint   `json:"id" gorm:"primaryKey"`
        Name        string `json:"name" gorm:"not null"`
        Description string `json:"description"`
        ActionType  string `json:"action_type"` // same as quest actions
        Requirement int    `json:"requirement" gorm:"default:1"`
        MentorXP    int    `json:"mentor_xp" gorm:"default:10"`
        MenteeCoins int    `json:"mentee_coins" gorm:"default:20"`
        TaskOrder   int    `json:"task_order" gorm:"not null"`
        IsActive    bool   `json:"is_active" gorm:"default:true"`
}

type MentorshipProgress struct {
        ID           uint       `json:"id" gorm:"primaryKey"`
        MentorshipID uint       `json:"mentorship_id" gorm:"not null;uniqueIndex:idx_mentorship_task;constraint:OnDelete:CASCADE"`
        TaskID       uint       `json:"task_id" gorm:"not null;uniqueIndex:idx_mentorship_task;constraint:OnDelete:CASCADE"`
        Progress     int        `json:"progress" gorm:"default:0"`
        IsCompleted  bool       `json:"is_completed" gorm:"default:false"`
        CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

// ============= TRENDING & RECOMMENDATIONS =============

type TrendingContent struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        ContentType string    `json:"content_type" gorm:"not null;index"` // post, video, channel, guild
        ContentID   uint      `json:"content_id" gorm:"not null"`
        Score       float64   `json:"score" gorm:"default:0;index"`
        Views       int       `json:"views" gorm:"default:0"`
        Likes       int       `json:"likes" gorm:"default:0"`
        Comments    int       `json:"comments" gorm:"default:0"`
        Shares      int       `json:"shares" gorm:"default:0"`
        UpdatedAt   time.Time `json:"updated_at"`
}

type UserRecommendation struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        UserID      uint      `json:"user_id" gorm:"not null;index"`
        ContentType string    `json:"content_type" gorm:"not null"`
        ContentID   uint      `json:"content_id" gorm:"not null"`
        Reason      string    `json:"reason"` // similar_users, popular, category_match, friend_activity
        Score       float64   `json:"score" gorm:"default:0"`
        IsViewed    bool      `json:"is_viewed" gorm:"default:false"`
        IsDismissed bool      `json:"is_dismissed" gorm:"default:false"`
        CreatedAt   time.Time `json:"created_at"`
}

// ============= COLLECTIONS SYSTEM =============

type Collection struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        UserID      uint      `json:"user_id" gorm:"not null;index"`
        Name        string    `json:"name" gorm:"not null"`
        Description string    `json:"description" gorm:"size:500"`
        IconEmoji   string    `json:"icon_emoji" gorm:"default:📁"`
        IsPrivate   bool      `json:"is_private" gorm:"default:false"`
        ItemCount   int       `json:"item_count" gorm:"default:0"`
        CreatedAt   time.Time `json:"created_at"`
        UpdatedAt   time.Time `json:"updated_at"`
}

type CollectionItem struct {
        ID           uint      `json:"id" gorm:"primaryKey"`
        CollectionID uint      `json:"collection_id" gorm:"not null;uniqueIndex:idx_collection_item;constraint:OnDelete:CASCADE"`
        ContentType  string    `json:"content_type" gorm:"not null;uniqueIndex:idx_collection_item"` // post, video, message, channel
        ContentID    uint      `json:"content_id" gorm:"not null;uniqueIndex:idx_collection_item"`
        Note         string    `json:"note" gorm:"size:500"`
        AddedAt      time.Time `json:"added_at"`
}

// ============= HANDLERS =============

// Gift System Handlers
func sendGiftHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                ReceiverID uint   `json:"receiver_id" binding:"required"`
                ItemID     uint   `json:"item_id" binding:"required"`
                Message    string `json:"message"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        if userID == req.ReceiverID {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot gift to yourself"})
                return
        }
        
        // Check if user owns the item
        var inventory UserInventory
        if err := db.Where("user_id = ? AND item_id = ?", userID, req.ItemID).First(&inventory).Error; err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "You don't own this item"})
                return
        }
        
        // Create gift and transfer item
        tx := db.Begin()
        
        gift := UserGiftItem{
                SenderID:   userID,
                ReceiverID: req.ReceiverID,
                ItemID:     req.ItemID,
                Message:    req.Message,
                CreatedAt:  time.Now(),
        }
        if err := tx.Create(&gift).Error; err != nil {
                tx.Rollback()
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send gift"})
                return
        }
        
        // Transfer item ownership
        if err := tx.Model(&inventory).Update("user_id", req.ReceiverID).Error; err != nil {
                tx.Rollback()
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to transfer item"})
                return
        }
        
        // Create activity feed entry
        createActivityFeed(tx, req.ReceiverID, userID, "gift_received", "item", req.ItemID, "")
        
        tx.Commit()
        c.JSON(http.StatusOK, gift)
}

func getReceivedGiftsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var gifts []UserGiftItem
        db.Where("receiver_id = ?", userID).
                Preload("Sender").
                Preload("Item").
                Order("created_at DESC").
                Find(&gifts)
        
        c.JSON(http.StatusOK, gifts)
}

func openGiftHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        giftID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid gift ID"})
                return
        }
        
        var gift UserGiftItem
        if err := db.Where("id = ? AND receiver_id = ?", giftID, userID).First(&gift).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Gift not found"})
                return
        }
        
        now := time.Now()
        gift.IsOpened = true
        gift.OpenedAt = &now
        db.Save(&gift)
        
        c.JSON(http.StatusOK, gift)
}

// Trading System Handlers
func createTradeHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                ReceiverID    uint   `json:"receiver_id" binding:"required"`
                OfferItems    []uint `json:"offer_items"`
                OfferCoins    int    `json:"offer_coins"`
                RequestItems  []uint `json:"request_items"`
                RequestCoins  int    `json:"request_coins"`
                Note          string `json:"note"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        if userID == req.ReceiverID {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot trade with yourself"})
                return
        }
        
        // Check user owns offered items
        for _, invID := range req.OfferItems {
                var inv UserInventory
                if err := db.Where("id = ? AND user_id = ?", invID, userID).First(&inv).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "You don't own one of the offered items"})
                        return
                }
        }
        
        tx := db.Begin()
        
        trade := Trade{
                InitiatorID:   userID,
                ReceiverID:    req.ReceiverID,
                Status:        "pending",
                InitiatorNote: req.Note,
                ExpiresAt:     time.Now().Add(24 * time.Hour),
                CreatedAt:     time.Now(),
        }
        if err := tx.Create(&trade).Error; err != nil {
                tx.Rollback()
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create trade"})
                return
        }
        
        // Add offer items
        for _, invID := range req.OfferItems {
                item := TradeItem{
                        TradeID:     trade.ID,
                        OwnerID:     userID,
                        InventoryID: invID,
                        ItemType:    "item",
                        Amount:      1,
                }
                tx.Create(&item)
        }
        
        // Add coins offer
        if req.OfferCoins > 0 {
                item := TradeItem{
                        TradeID:  trade.ID,
                        OwnerID:  userID,
                        ItemType: "coins",
                        Amount:   req.OfferCoins,
                }
                tx.Create(&item)
        }
        
        // Add request items
        for _, invID := range req.RequestItems {
                item := TradeItem{
                        TradeID:     trade.ID,
                        OwnerID:     req.ReceiverID,
                        InventoryID: invID,
                        ItemType:    "item",
                        Amount:      1,
                }
                tx.Create(&item)
        }
        
        // Add coins request
        if req.RequestCoins > 0 {
                item := TradeItem{
                        TradeID:  trade.ID,
                        OwnerID:  req.ReceiverID,
                        ItemType: "coins",
                        Amount:   req.RequestCoins,
                }
                tx.Create(&item)
        }
        
        createActivityFeed(tx, req.ReceiverID, userID, "trade_request", "trade", trade.ID, "")
        
        tx.Commit()
        c.JSON(http.StatusCreated, trade)
}

func getTradesHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        status := c.Query("status")
        
        query := db.Where("initiator_id = ? OR receiver_id = ?", userID, userID)
        if status != "" {
                query = query.Where("status = ?", status)
        }
        
        var trades []Trade
        query.Preload("Initiator").Preload("Receiver").Order("created_at DESC").Find(&trades)
        
        c.JSON(http.StatusOK, trades)
}

func respondTradeHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        tradeID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trade ID"})
                return
        }
        
        var req struct {
                Action string `json:"action" binding:"required"` // accept, reject
                Note   string `json:"note"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var trade Trade
        if err := db.Where("id = ? AND receiver_id = ? AND status = ?", tradeID, userID, "pending").First(&trade).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Trade not found or already processed"})
                return
        }
        
        tx := db.Begin()
        
        if req.Action == "accept" {
                // Get all trade items
                var items []TradeItem
                db.Where("trade_id = ?", tradeID).Find(&items)
                
                // Execute the trade
                for _, item := range items {
                        if item.ItemType == "item" {
                                var inv UserInventory
                                db.First(&inv, item.InventoryID)
                                
                                // Swap ownership
                                if inv.UserID == trade.InitiatorID {
                                        inv.UserID = trade.ReceiverID
                                } else {
                                        inv.UserID = trade.InitiatorID
                                }
                                tx.Save(&inv)
                        } else if item.ItemType == "coins" {
                                // Transfer coins
                                if item.OwnerID == trade.InitiatorID {
                                        adjustCurrency(tx, trade.InitiatorID, -item.Amount, 0)
                                        adjustCurrency(tx, trade.ReceiverID, item.Amount, 0)
                                } else {
                                        adjustCurrency(tx, trade.ReceiverID, -item.Amount, 0)
                                        adjustCurrency(tx, trade.InitiatorID, item.Amount, 0)
                                }
                        }
                }
                
                now := time.Now()
                trade.Status = "accepted"
                trade.CompletedAt = &now
                createActivityFeed(tx, trade.InitiatorID, userID, "trade_accepted", "trade", trade.ID, "")
        } else {
                trade.Status = "rejected"
                createActivityFeed(tx, trade.InitiatorID, userID, "trade_rejected", "trade", trade.ID, "")
        }
        
        trade.ReceiverNote = req.Note
        tx.Save(&trade)
        
        tx.Commit()
        c.JSON(http.StatusOK, trade)
}

// Activity Feed Handlers
func getActivityFeedHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        
        var activities []ActivityFeed
        db.Where("user_id = ?", userID).
                Preload("Actor").
                Order("created_at DESC").
                Limit(limit).
                Find(&activities)
        
        c.JSON(http.StatusOK, activities)
}

func markActivityReadHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        activityID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid activity ID"})
                return
        }
        
        db.Model(&ActivityFeed{}).Where("id = ? AND user_id = ?", activityID, userID).Update("is_read", true)
        c.JSON(http.StatusOK, gin.H{"success": true})
}

func markAllActivitiesReadHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        db.Model(&ActivityFeed{}).Where("user_id = ? AND is_read = ?", userID, false).Update("is_read", true)
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// Enhanced Friends Handlers
func getBestFriendsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var bestFriends []BestFriend
        db.Where("user_id = ?", userID).
                Preload("Friend").
                Order("score DESC").
                Limit(3).
                Find(&bestFriends)
        
        c.JSON(http.StatusOK, bestFriends)
}

func getFriendInteractionsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var interactions []FriendInteraction
        db.Where("user_id = ?", userID).
                Order("count DESC").
                Find(&interactions)
        
        c.JSON(http.StatusOK, interactions)
}

// Events Handlers
func getEventsHandler(c *gin.Context) {
        now := time.Now()
        activeOnly := c.Query("active") == "true"
        
        query := db.Model(&Event{})
        if activeOnly {
                query = query.Where("is_active = ? AND start_date <= ? AND end_date >= ?", true, now, now)
        }
        
        var events []Event
        query.Order("start_date DESC").Find(&events)
        
        c.JSON(http.StatusOK, events)
}

func getEventHandler(c *gin.Context) {
        eventID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
                return
        }
        
        var event Event
        if err := db.First(&event, eventID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
                return
        }
        
        var rewards []EventReward
        db.Where("event_id = ?", eventID).Find(&rewards)
        
        c.JSON(http.StatusOK, gin.H{
                "event":   event,
                "rewards": rewards,
        })
}

func joinEventHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        eventID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
                return
        }
        
        var event Event
        if err := db.First(&event, eventID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
                return
        }
        
        now := time.Now()
        if now.Before(event.StartDate) || now.After(event.EndDate) {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Event is not active"})
                return
        }
        
        participant := EventParticipant{
                EventID:  uint(eventID),
                UserID:   userID,
                JoinedAt: now,
        }
        
        if err := db.Create(&participant).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Already joined this event"})
                return
        }
        
        c.JSON(http.StatusOK, participant)
}

func getEventLeaderboardHandler(c *gin.Context) {
        eventID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
                return
        }
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        
        var participants []EventParticipant
        db.Where("event_id = ?", eventID).
                Preload("User").
                Order("points DESC").
                Limit(limit).
                Find(&participants)
        
        // Update ranks
        for i := range participants {
                participants[i].Rank = i + 1
        }
        
        c.JSON(http.StatusOK, participants)
}

func claimEventRewardHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        eventID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
                return
        }
        rewardID, err := strconv.ParseUint(c.Param("reward_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reward ID"})
                return
        }
        
        // Check participant and points
        var participant EventParticipant
        if err := db.Where("event_id = ? AND user_id = ?", eventID, userID).First(&participant).Error; err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Not participating in this event"})
                return
        }
        
        var reward EventReward
        if err := db.First(&reward, rewardID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Reward not found"})
                return
        }
        
        // Check if already claimed
        var existing EventRewardClaim
        if err := db.Where("event_id = ? AND user_id = ? AND reward_id = ?", eventID, userID, rewardID).First(&existing).Error; err == nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Reward already claimed"})
                return
        }
        
        // Check threshold
        if participant.Points < reward.Threshold {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Not enough points for this reward"})
                return
        }
        
        tx := db.Begin()
        
        // Grant reward
        switch reward.RewardType {
        case "coins":
                adjustCurrency(tx, userID, reward.RewardValue, 0)
        case "gems":
                adjustCurrency(tx, userID, 0, reward.RewardValue)
        case "xp":
                awardXP(userID, reward.RewardValue, "event_reward")
        case "item":
                if reward.ItemID != nil {
                        inv := UserInventory{
                                UserID:     userID,
                                ItemID:     *reward.ItemID,
                                AcquiredAt: time.Now(),
                        }
                        tx.Create(&inv)
                }
        case "badge":
                if reward.BadgeID != nil {
                        badge := UserBadge{
                                UserID:     userID,
                                BadgeID:    *reward.BadgeID,
                                AcquiredAt: time.Now(),
                        }
                        tx.Create(&badge)
                }
        }
        
        claim := EventRewardClaim{
                EventID:   uint(eventID),
                UserID:    userID,
                RewardID:  uint(rewardID),
                ClaimedAt: time.Now(),
        }
        tx.Create(&claim)
        
        tx.Commit()
        c.JSON(http.StatusOK, gin.H{"success": true, "reward": reward})
}

// Clans Handlers
func getGuildClansHandler(c *gin.Context) {
        guildID, err := strconv.ParseUint(c.Param("guild_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }
        
        var clans []Clan
        db.Where("guild_id = ?", guildID).
                Preload("Leader").
                Order("total_xp DESC").
                Find(&clans)
        
        c.JSON(http.StatusOK, clans)
}

func createClanHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                GuildID     uint   `json:"guild_id" binding:"required"`
                Name        string `json:"name" binding:"required"`
                Description string `json:"description"`
                Color       string `json:"color"`
                IsPublic    bool   `json:"is_public"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        // Check if user is guild member
        var member GuildMember
        if err := db.Where("guild_id = ? AND user_id = ?", req.GuildID, userID).First(&member).Error; err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": "You must be a guild member to create a clan"})
                return
        }
        
        clan := Clan{
                GuildID:     req.GuildID,
                Name:        req.Name,
                Description: req.Description,
                Color:       req.Color,
                LeaderID:    userID,
                IsPublic:    req.IsPublic,
                CreatedAt:   time.Now(),
        }
        
        if clan.Color == "" {
                clan.Color = "#6366f1"
        }
        
        tx := db.Begin()
        if err := tx.Create(&clan).Error; err != nil {
                tx.Rollback()
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create clan"})
                return
        }
        
        // Add creator as leader
        clanMember := ClanMember{
                ClanID:   clan.ID,
                UserID:   userID,
                Role:     "leader",
                JoinedAt: time.Now(),
        }
        tx.Create(&clanMember)
        
        tx.Commit()
        c.JSON(http.StatusCreated, clan)
}

func joinClanHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        clanID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid clan ID"})
                return
        }
        
        var clan Clan
        if err := db.First(&clan, clanID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Clan not found"})
                return
        }
        
        if !clan.IsPublic {
                c.JSON(http.StatusForbidden, gin.H{"error": "This clan is private"})
                return
        }
        
        // Check member count
        var count int64
        db.Model(&ClanMember{}).Where("clan_id = ?", clanID).Count(&count)
        if int(count) >= clan.MaxMembers {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Clan is full"})
                return
        }
        
        member := ClanMember{
                ClanID:   uint(clanID),
                UserID:   userID,
                Role:     "member",
                JoinedAt: time.Now(),
        }
        
        if err := db.Create(&member).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Already a member of this clan"})
                return
        }
        
        c.JSON(http.StatusOK, member)
}

func getClanChallengesHandler(c *gin.Context) {
        clanID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid clan ID"})
                return
        }
        
        var challenges []ClanChallenge
        db.Where("clan_id = ?", clanID).Order("created_at DESC").Find(&challenges)
        
        c.JSON(http.StatusOK, challenges)
}

// Mini-Games Handlers
func getMiniGamesHandler(c *gin.Context) {
        var games []MiniGame
        db.Where("is_active = ?", true).Find(&games)
        c.JSON(http.StatusOK, games)
}

func startMiniGameHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        gameID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid game ID"})
                return
        }
        
        var game MiniGame
        if err := db.First(&game, gameID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Game not found"})
                return
        }
        
        // Check cooldown
        var lastSession MiniGameSession
        if err := db.Where("game_id = ? AND user_id = ?", gameID, userID).
                Order("played_at DESC").First(&lastSession).Error; err == nil {
                cooldownEnd := lastSession.PlayedAt.Add(time.Duration(game.CooldownMin) * time.Minute)
                if time.Now().Before(cooldownEnd) {
                        remaining := time.Until(cooldownEnd).Minutes()
                        c.JSON(http.StatusTooManyRequests, gin.H{
                                "error":            "Game is on cooldown",
                                "remaining_minutes": int(remaining),
                        })
                        return
                }
        }
        
        session := MiniGameSession{
                GameID:   uint(gameID),
                UserID:   userID,
                PlayedAt: time.Now(),
        }
        db.Create(&session)
        
        // Return game data based on type
        var gameData interface{}
        if game.GameType == "trivia" {
                var questions []TriviaQuestion
                db.Where("difficulty = ?", game.Difficulty).
                        Order("RANDOM()").
                        Limit(5).
                        Find(&questions)
                gameData = questions
        }
        
        c.JSON(http.StatusOK, gin.H{
                "session":   session,
                "game":      game,
                "game_data": gameData,
        })
}

func completeMiniGameHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        sessionID, err := strconv.ParseUint(c.Param("session_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
                return
        }
        
        var req struct {
                Score int `json:"score" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        var session MiniGameSession
        if err := db.Where("id = ? AND user_id = ? AND completed_at IS NULL", sessionID, userID).First(&session).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Session not found or already completed"})
                return
        }
        
        var game MiniGame
        db.First(&game, session.GameID)
        
        tx := db.Begin()
        
        // Calculate rewards based on score
        scoreMultiplier := float64(req.Score) / 100.0
        if scoreMultiplier > 1 {
                scoreMultiplier = 1
        }
        
        coinsEarned := int(float64(game.CoinReward) * scoreMultiplier)
        xpEarned := int(float64(game.XPReward) * scoreMultiplier)
        
        now := time.Now()
        session.Score = req.Score
        session.CoinsEarned = coinsEarned
        session.XPEarned = xpEarned
        session.CompletedAt = &now
        
        if req.Score > session.HighScore {
                session.HighScore = req.Score
        }
        
        tx.Save(&session)
        
        // Award rewards
        adjustCurrency(tx, userID, coinsEarned, 0)
        awardXP(userID, xpEarned, "minigame")
        
        tx.Commit()
        
        c.JSON(http.StatusOK, gin.H{
                "session":      session,
                "coins_earned": coinsEarned,
                "xp_earned":    xpEarned,
        })
}

// Quest Chain Handlers
func getQuestChainsHandler(c *gin.Context) {
        var chains []QuestChain
        db.Where("is_active = ?", true).Find(&chains)
        c.JSON(http.StatusOK, chains)
}

func getUserQuestsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var progress []UserQuestProgress
        db.Where("user_id = ?", userID).
                Preload("Chain").
                Find(&progress)
        
        c.JSON(http.StatusOK, progress)
}

func startQuestChainHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        chainID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid quest chain ID"})
                return
        }
        
        var chain QuestChain
        if err := db.First(&chain, chainID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Quest chain not found"})
                return
        }
        
        progress := UserQuestProgress{
                UserID:      userID,
                ChainID:     uint(chainID),
                CurrentStep: 1,
                StartedAt:   time.Now(),
        }
        
        if err := db.Create(&progress).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Already started this quest chain"})
                return
        }
        
        // Get first step
        var step QuestStep
        db.Where("chain_id = ? AND step_order = ?", chainID, 1).First(&step)
        
        c.JSON(http.StatusOK, gin.H{
                "progress":     progress,
                "current_step": step,
        })
}

func getQuestStepsHandler(c *gin.Context) {
        chainID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid quest chain ID"})
                return
        }
        
        var steps []QuestStep
        db.Where("chain_id = ?", chainID).Order("step_order ASC").Find(&steps)
        
        c.JSON(http.StatusOK, steps)
}

// Mentorship Handlers
func getMentorsHandler(c *gin.Context) {
        // Find eligible mentors (users with level >= 10)
        var mentors []User
        db.Where("level >= ?", 10).
                Order("level DESC").
                Limit(20).
                Find(&mentors)
        
        c.JSON(http.StatusOK, mentors)
}

func requestMentorHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        mentorID, err := strconv.ParseUint(c.Param("mentor_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mentor ID"})
                return
        }
        
        // Check user level (mentees should be new)
        var userLevel UserLevel
        db.Where("user_id = ?", userID).First(&userLevel)
        if userLevel.Level > 5 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Only users below level 5 can request a mentor"})
                return
        }
        
        // Check if already has mentor
        var existing Mentorship
        if err := db.Where("mentee_id = ? AND status = ?", userID, "active").First(&existing).Error; err == nil {
                c.JSON(http.StatusConflict, gin.H{"error": "You already have an active mentor"})
                return
        }
        
        mentorship := Mentorship{
                MentorID:    uint(mentorID),
                MenteeID:    userID,
                MenteeLevel: userLevel.Level,
                StartedAt:   time.Now(),
        }
        
        if err := db.Create(&mentorship).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create mentorship"})
                return
        }
        
        createActivityFeed(db, uint(mentorID), userID, "mentorship_request", "user", userID, "")
        
        c.JSON(http.StatusCreated, mentorship)
}

func getMentorshipHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var mentorship Mentorship
        if err := db.Where("(mentor_id = ? OR mentee_id = ?) AND status = ?", userID, userID, "active").
                Preload("Mentor").
                Preload("Mentee").
                First(&mentorship).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No active mentorship found"})
                return
        }
        
        // Get tasks and progress
        var tasks []MentorTask
        db.Where("is_active = ?", true).Order("task_order ASC").Find(&tasks)
        
        var progress []MentorshipProgress
        db.Where("mentorship_id = ?", mentorship.ID).Find(&progress)
        
        c.JSON(http.StatusOK, gin.H{
                "mentorship": mentorship,
                "tasks":      tasks,
                "progress":   progress,
        })
}

// Trending & Recommendations Handlers
func getTrendingHandler(c *gin.Context) {
        contentType := c.Query("type")
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
        
        query := db.Model(&TrendingContent{})
        if contentType != "" {
                query = query.Where("content_type = ?", contentType)
        }
        
        var trending []TrendingContent
        query.Order("score DESC").Limit(limit).Find(&trending)
        
        c.JSON(http.StatusOK, trending)
}

func getRecommendationsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        contentType := c.Query("type")
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
        
        query := db.Where("user_id = ? AND is_dismissed = ?", userID, false)
        if contentType != "" {
                query = query.Where("content_type = ?", contentType)
        }
        
        var recs []UserRecommendation
        query.Order("score DESC").Limit(limit).Find(&recs)
        
        c.JSON(http.StatusOK, recs)
}

func dismissRecommendationHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        recID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid recommendation ID"})
                return
        }
        
        db.Model(&UserRecommendation{}).
                Where("id = ? AND user_id = ?", recID, userID).
                Update("is_dismissed", true)
        
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// Collections Handlers
func getCollectionsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var collections []Collection
        db.Where("user_id = ?", userID).Order("updated_at DESC").Find(&collections)
        
        c.JSON(http.StatusOK, collections)
}

func createCollectionHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        
        var req struct {
                Name        string `json:"name" binding:"required"`
                Description string `json:"description"`
                IconEmoji   string `json:"icon_emoji"`
                IsPrivate   bool   `json:"is_private"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        collection := Collection{
                UserID:      userID,
                Name:        req.Name,
                Description: req.Description,
                IconEmoji:   req.IconEmoji,
                IsPrivate:   req.IsPrivate,
                CreatedAt:   time.Now(),
                UpdatedAt:   time.Now(),
        }
        
        if collection.IconEmoji == "" {
                collection.IconEmoji = "📁"
        }
        
        db.Create(&collection)
        c.JSON(http.StatusCreated, collection)
}

func addToCollectionHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
                return
        }
        
        var req struct {
                ContentType string `json:"content_type" binding:"required"`
                ContentID   uint   `json:"content_id" binding:"required"`
                Note        string `json:"note"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        
        // Verify collection ownership
        var collection Collection
        if err := db.Where("id = ? AND user_id = ?", collectionID, userID).First(&collection).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
                return
        }
        
        item := CollectionItem{
                CollectionID: uint(collectionID),
                ContentType:  req.ContentType,
                ContentID:    req.ContentID,
                Note:         req.Note,
                AddedAt:      time.Now(),
        }
        
        if err := db.Create(&item).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Item already in collection"})
                return
        }
        
        // Update item count
        db.Model(&collection).Update("item_count", gorm.Expr("item_count + 1"))
        db.Model(&collection).Update("updated_at", time.Now())
        
        c.JSON(http.StatusCreated, item)
}

func getCollectionItemsHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
                return
        }
        
        // Verify access
        var collection Collection
        if err := db.Where("id = ? AND (user_id = ? OR is_private = ?)", collectionID, userID, false).First(&collection).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
                return
        }
        
        var items []CollectionItem
        db.Where("collection_id = ?", collectionID).Order("added_at DESC").Find(&items)
        
        c.JSON(http.StatusOK, gin.H{
                "collection": collection,
                "items":      items,
        })
}

func removeFromCollectionHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
                return
        }
        itemID, err := strconv.ParseUint(c.Param("item_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
                return
        }
        
        // Verify collection ownership
        var collection Collection
        if err := db.Where("id = ? AND user_id = ?", collectionID, userID).First(&collection).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
                return
        }
        
        if err := db.Delete(&CollectionItem{}, itemID).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove item"})
                return
        }
        
        db.Model(&collection).Update("item_count", gorm.Expr("item_count - 1"))
        
        c.JSON(http.StatusOK, gin.H{"success": true})
}

func deleteCollectionHandler(c *gin.Context) {
        userID := c.GetUint("user_id")
        collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
                return
        }
        
        result := db.Where("id = ? AND user_id = ?", collectionID, userID).Delete(&Collection{})
        if result.RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// Helper Functions
func createActivityFeed(tx *gorm.DB, userID, actorID uint, actionType, targetType string, targetID uint, metadata string) {
        activity := ActivityFeed{
                UserID:     userID,
                ActorID:    actorID,
                ActionType: actionType,
                TargetType: targetType,
                TargetID:   targetID,
                Metadata:   metadata,
                CreatedAt:  time.Now(),
        }
        tx.Create(&activity)
}

func adjustCurrency(tx *gorm.DB, userID uint, coins, gems int) {
        var currency VirtualCurrency
        if err := tx.Where("user_id = ?", userID).First(&currency).Error; err != nil {
                currency = VirtualCurrency{UserID: userID}
                tx.Create(&currency)
        }
        
        currency.Coins += coins
        currency.Gems += gems
        if currency.Coins < 0 {
                currency.Coins = 0
        }
        if currency.Gems < 0 {
                currency.Gems = 0
        }
        tx.Save(&currency)
}


// Update trending scores (run periodically)
func updateTrendingScores() {
        // Calculate trending score: (likes * 3 + comments * 2 + views) * time_decay
        db.Exec(`
                UPDATE trending_contents SET
                score = (likes * 3 + comments * 2 + views) * 
                        EXP(-EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400),
                updated_at = NOW()
        `)
}

// Generate recommendations for users
func generateRecommendations(userID uint) {
        // Get user's interests based on activity
        var likedPosts []uint
        db.Model(&PostLike{}).Where("user_id = ?", userID).Pluck("post_id", &likedPosts)
        
        // Find similar content
        var trending []TrendingContent
        db.Where("content_type = ?", "post").Order("score DESC").Limit(10).Find(&trending)
        
        for _, t := range trending {
                rec := UserRecommendation{
                        UserID:      userID,
                        ContentType: t.ContentType,
                        ContentID:   t.ContentID,
                        Reason:      "popular",
                        Score:       t.Score,
                        CreatedAt:   time.Now(),
                }
                db.Create(&rec)
        }
}

// Seed default data
func seedPhase3Data() {
        // Seed mini-games
        games := []MiniGame{
                {Name: "Quick Trivia", Description: "Answer 5 random questions", GameType: "trivia", Difficulty: "easy", CoinReward: 20, XPReward: 10, CooldownMin: 30},
                {Name: "Brain Buster", Description: "Hard trivia challenge", GameType: "trivia", Difficulty: "hard", CoinReward: 50, XPReward: 25, CooldownMin: 60},
                {Name: "Speed Type", Description: "Type as fast as you can", GameType: "typing", Difficulty: "medium", CoinReward: 30, XPReward: 15, CooldownMin: 45},
        }
        for _, g := range games {
                db.FirstOrCreate(&g, MiniGame{Name: g.Name})
        }
        
        // Seed trivia questions
        questions := []TriviaQuestion{
                {Question: "What year was Discord founded?", Options: `["2013", "2015", "2017", "2019"]`, CorrectIdx: 1, Category: "tech", Difficulty: "easy", Points: 10},
                {Question: "Which programming language is Go inspired by?", Options: `["C", "Python", "Java", "Ruby"]`, CorrectIdx: 0, Category: "tech", Difficulty: "medium", Points: 15},
                {Question: "What does API stand for?", Options: `["Application Programming Interface", "Advanced Program Integration", "Automated Process Input", "Application Process Interface"]`, CorrectIdx: 0, Category: "tech", Difficulty: "easy", Points: 10},
        }
        for _, q := range questions {
                db.FirstOrCreate(&q, TriviaQuestion{Question: q.Question})
        }
        
        // Seed quest chains
        chains := []QuestChain{
                {Name: "Getting Started", Description: "Learn the basics of Nemaks", Category: "tutorial", TotalSteps: 5, FinalReward: `{"coins": 100, "xp": 50}`},
                {Name: "Social Butterfly", Description: "Make friends and connect", Category: "social", TotalSteps: 4, FinalReward: `{"coins": 200, "gems": 10}`},
                {Name: "Content Creator", Description: "Share your creativity", Category: "content", TotalSteps: 3, FinalReward: `{"coins": 150, "badge_id": 1}`},
        }
        for _, ch := range chains {
                var existing QuestChain
                if db.Where("name = ?", ch.Name).First(&existing).Error != nil {
                        db.Create(&ch)
                        
                        // Add steps for Getting Started
                        if ch.Name == "Getting Started" {
                                steps := []QuestStep{
                                        {ChainID: ch.ID, StepOrder: 1, Name: "Complete Profile", ActionType: "update_profile", Requirement: 1, RewardCoins: 10, RewardXP: 5},
                                        {ChainID: ch.ID, StepOrder: 2, Name: "Send First Message", ActionType: "send_message", Requirement: 1, RewardCoins: 15, RewardXP: 10},
                                        {ChainID: ch.ID, StepOrder: 3, Name: "Add a Friend", ActionType: "add_friend", Requirement: 1, RewardCoins: 20, RewardXP: 15},
                                        {ChainID: ch.ID, StepOrder: 4, Name: "Join a Guild", ActionType: "join_guild", Requirement: 1, RewardCoins: 25, RewardXP: 20},
                                        {ChainID: ch.ID, StepOrder: 5, Name: "Create Your First Post", ActionType: "create_post", Requirement: 1, RewardCoins: 30, RewardXP: 25},
                                }
                                for _, s := range steps {
                                        db.Create(&s)
                                }
                        }
                }
        }
        
        // Seed mentor tasks
        tasks := []MentorTask{
                {Name: "Profile Setup", Description: "Help mentee complete their profile", ActionType: "update_profile", Requirement: 1, MentorXP: 10, MenteeCoins: 20, TaskOrder: 1},
                {Name: "First Steps", Description: "Guide mentee to send 10 messages", ActionType: "send_message", Requirement: 10, MentorXP: 20, MenteeCoins: 30, TaskOrder: 2},
                {Name: "Making Friends", Description: "Help mentee add 3 friends", ActionType: "add_friend", Requirement: 3, MentorXP: 30, MenteeCoins: 50, TaskOrder: 3},
                {Name: "Community Member", Description: "Guide mentee to join a guild", ActionType: "join_guild", Requirement: 1, MentorXP: 25, MenteeCoins: 40, TaskOrder: 4},
        }
        for _, t := range tasks {
                db.FirstOrCreate(&t, MentorTask{Name: t.Name})
        }
}

func initPhase3() {
        db.AutoMigrate(
                &UserGiftItem{},
                &Trade{},
                &TradeItem{},
                &ActivityFeed{},
                &FriendInteraction{},
                &BestFriend{},
                &Event{},
                &EventReward{},
                &EventParticipant{},
                &EventRewardClaim{},
                &Clan{},
                &ClanMember{},
                &ClanChallenge{},
                &MiniGame{},
                &MiniGameSession{},
                &TriviaQuestion{},
                &QuestChain{},
                &QuestStep{},
                &UserQuestProgress{},
                &Mentorship{},
                &MentorTask{},
                &MentorshipProgress{},
                &TrendingContent{},
                &UserRecommendation{},
                &Collection{},
                &CollectionItem{},
        )
        
        seedPhase3Data()
        
        // Start periodic jobs
        go func() {
                ticker := time.NewTicker(5 * time.Minute)
                for range ticker.C {
                        updateTrendingScores()
                }
        }()
}

func registerPhase3Routes(r *gin.Engine, auth gin.HandlerFunc) {
        // Gift System
        r.POST("/api/gifts/send", auth, sendGiftHandler)
        r.GET("/api/gifts/received", auth, getReceivedGiftsHandler)
        r.POST("/api/gifts/:id/open", auth, openGiftHandler)
        
        // Trading System
        r.POST("/api/trades", auth, createTradeHandler)
        r.GET("/api/trades", auth, getTradesHandler)
        r.POST("/api/trades/:id/respond", auth, respondTradeHandler)
        
        // Activity Feed
        r.GET("/api/activity-feed", auth, getActivityFeedHandler)
        r.POST("/api/activity-feed/:id/read", auth, markActivityReadHandler)
        r.POST("/api/activity-feed/read-all", auth, markAllActivitiesReadHandler)
        
        // Enhanced Friends
        r.GET("/api/friends/best", auth, getBestFriendsHandler)
        r.GET("/api/friends/interactions", auth, getFriendInteractionsHandler)
        
        // Events
        r.GET("/api/events", getEventsHandler)
        r.GET("/api/events/:id", getEventHandler)
        r.POST("/api/events/:id/join", auth, joinEventHandler)
        r.GET("/api/events/:id/leaderboard", getEventLeaderboardHandler)
        r.POST("/api/events/:id/rewards/:reward_id/claim", auth, claimEventRewardHandler)
        
        // Clans
        r.GET("/api/guild-clans/:guild_id", auth, getGuildClansHandler)
        r.POST("/api/clans", auth, createClanHandler)
        r.POST("/api/clans/:id/join", auth, joinClanHandler)
        r.GET("/api/clans/:id/challenges", auth, getClanChallengesHandler)
        
        // Mini-Games
        r.GET("/api/minigames", getMiniGamesHandler)
        r.POST("/api/minigames/:id/start", auth, startMiniGameHandler)
        r.POST("/api/minigames/session/:session_id/complete", auth, completeMiniGameHandler)
        
        // Quest Chains
        r.GET("/api/quests", getQuestChainsHandler)
        r.GET("/api/quests/my", auth, getUserQuestsHandler)
        r.POST("/api/quests/:id/start", auth, startQuestChainHandler)
        r.GET("/api/quests/:id/steps", getQuestStepsHandler)
        
        // Mentorship
        r.GET("/api/mentors", auth, getMentorsHandler)
        r.POST("/api/mentors/:mentor_id/request", auth, requestMentorHandler)
        r.GET("/api/mentorship", auth, getMentorshipHandler)
        
        // Trending & Recommendations
        r.GET("/api/trending", getTrendingHandler)
        r.GET("/api/recommendations", auth, getRecommendationsHandler)
        r.POST("/api/recommendations/:id/dismiss", auth, dismissRecommendationHandler)
        
        // Collections
        r.GET("/api/collections", auth, getCollectionsHandler)
        r.POST("/api/collections", auth, createCollectionHandler)
        r.POST("/api/collections/:id/items", auth, addToCollectionHandler)
        r.GET("/api/collections/:id/items", auth, getCollectionItemsHandler)
        r.DELETE("/api/collections/:id/items/:item_id", auth, removeFromCollectionHandler)
        r.DELETE("/api/collections/:id", auth, deleteCollectionHandler)
}
