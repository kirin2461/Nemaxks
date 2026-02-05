package main

import (
        "fmt"
        "log"
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

type Achievement struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        Name        string    `json:"name" gorm:"not null"`
        NameRu      string    `json:"name_ru"`
        Description string    `json:"description"`
        DescRu      string    `json:"description_ru"`
        Icon        string    `json:"icon"`
        Category    string    `json:"category"`
        XPReward    int       `json:"xp_reward" gorm:"default:100"`
        Rarity      string    `json:"rarity" gorm:"default:'common'"`
        Condition   string    `json:"condition"`
        Threshold   int       `json:"threshold"`
        CreatedAt   time.Time `json:"created_at"`
}

type UserAchievement struct {
        ID            uint        `json:"id" gorm:"primaryKey"`
        UserID        uint        `json:"user_id" gorm:"not null;index"`
        AchievementID uint        `json:"achievement_id" gorm:"not null"`
        UnlockedAt    time.Time   `json:"unlocked_at"`
        User          User        `json:"user,omitempty" gorm:"foreignKey:UserID"`
        Achievement   Achievement `json:"achievement,omitempty" gorm:"foreignKey:AchievementID"`
}

type UserLevel struct {
        ID             uint      `json:"id" gorm:"primaryKey"`
        UserID         uint      `json:"user_id" gorm:"uniqueIndex;not null"`
        Level          int       `json:"level" gorm:"default:1"`
        CurrentXP      int       `json:"current_xp" gorm:"default:0"`
        TotalXP        int       `json:"total_xp" gorm:"default:0"`
        MessagesCount  int       `json:"messages_count" gorm:"default:0"`
        VoiceMinutes   int       `json:"voice_minutes" gorm:"default:0"`
        ReactionsGiven int       `json:"reactions_given" gorm:"default:0"`
        PostsCreated   int       `json:"posts_created" gorm:"default:0"`
        UpdatedAt      time.Time `json:"updated_at"`
        User           User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type XPEvent struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        UserID    uint      `json:"user_id" gorm:"not null;index"`
        Amount    int       `json:"amount"`
        Reason    string    `json:"reason"`
        CreatedAt time.Time `json:"created_at"`
}

type Leaderboard struct {
        UserID   uint   `json:"user_id"`
        Username string `json:"username"`
        Avatar   string `json:"avatar"`
        Level    int    `json:"level"`
        TotalXP  int    `json:"total_xp"`
        Rank     int    `json:"rank"`
}

type Poll struct {
        ID          uint         `json:"id" gorm:"primaryKey"`
        ChannelID   *uint        `json:"channel_id,omitempty"`
        GuildID     *uint        `json:"guild_id,omitempty"`
        AuthorID    uint         `json:"author_id" gorm:"not null"`
        Question    string       `json:"question" gorm:"not null"`
        Description string       `json:"description"`
        MultiChoice bool         `json:"multi_choice" gorm:"default:false"`
        Anonymous   bool         `json:"anonymous" gorm:"default:false"`
        ExpiresAt   *time.Time   `json:"expires_at,omitempty"`
        IsClosed    bool         `json:"is_closed" gorm:"default:false"`
        CreatedAt   time.Time    `json:"created_at"`
        UpdatedAt   time.Time    `json:"updated_at"`
        Author      User         `json:"author,omitempty" gorm:"foreignKey:AuthorID"`
        Options     []PollOption `json:"options,omitempty" gorm:"foreignKey:PollID"`
        VotesCount  int          `json:"votes_count" gorm:"-"`
}

type PollOption struct {
        ID         uint       `json:"id" gorm:"primaryKey"`
        PollID     uint       `json:"poll_id" gorm:"not null;index"`
        Text       string     `json:"text" gorm:"not null"`
        Position   int        `json:"position" gorm:"default:0"`
        VotesCount int        `json:"votes_count" gorm:"default:0"`
        Votes      []PollVote `json:"votes,omitempty" gorm:"foreignKey:OptionID"`
}

type PollVote struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        PollID    uint      `json:"poll_id" gorm:"not null;index"`
        OptionID  uint      `json:"option_id" gorm:"not null"`
        UserID    uint      `json:"user_id" gorm:"not null"`
        CreatedAt time.Time `json:"created_at"`
        User      User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type CustomStatus struct {
        ID        uint       `json:"id" gorm:"primaryKey"`
        UserID    uint       `json:"user_id" gorm:"uniqueIndex;not null"`
        Text      string     `json:"text"`
        Emoji     string     `json:"emoji"`
        ExpiresAt *time.Time `json:"expires_at,omitempty" gorm:"index:idx_custom_statuses_expires"`
        ClearAt   *time.Time `json:"clear_at,omitempty"`
        UpdatedAt time.Time  `json:"updated_at"`
        User      User       `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type StatusPreset struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        UserID    uint      `json:"user_id" gorm:"not null;index"`
        Name      string    `json:"name"`
        Text      string    `json:"text"`
        Emoji     string    `json:"emoji"`
        CreatedAt time.Time `json:"created_at"`
}

type DisappearingSettings struct {
        ID              uint      `json:"id" gorm:"primaryKey"`
        ConversationKey string    `json:"conversation_key" gorm:"uniqueIndex;not null"`
        UserID1         uint      `json:"user_id_1" gorm:"not null;index:idx_disappearing_users"`
        UserID2         uint      `json:"user_id_2" gorm:"not null;index:idx_disappearing_users"`
        Enabled         bool      `json:"enabled" gorm:"default:false;index:idx_disappearing_enabled"`
        Duration        int       `json:"duration" gorm:"default:86400"`
        UpdatedAt       time.Time `json:"updated_at"`
}

func calculateLevel(totalXP int) int {
        level := 1
        xpNeeded := 100
        xpAccumulated := 0
        for xpAccumulated+xpNeeded <= totalXP {
                xpAccumulated += xpNeeded
                level++
                xpNeeded = int(float64(xpNeeded) * 1.15)
        }
        return level
}

func xpForNextLevel(level int) int {
        xp := 100
        for i := 1; i < level; i++ {
                xp = int(float64(xp) * 1.15)
        }
        return xp
}

func xpRequiredForLevel(level int) int {
        total := 0
        xp := 100
        for i := 1; i < level; i++ {
                total += xp
                xp = int(float64(xp) * 1.15)
        }
        return total
}

func awardXP(userID uint, amount int, reason string) error {
        var userLevel UserLevel
        if err := db.Where("user_id = ?", userID).First(&userLevel).Error; err != nil {
                userLevel = UserLevel{
                        UserID:    userID,
                        Level:     1,
                        CurrentXP: 0,
                        TotalXP:   0,
                }
                db.Create(&userLevel)
        }

        userLevel.TotalXP += amount
        newLevel := calculateLevel(userLevel.TotalXP)

        leveledUp := newLevel > userLevel.Level
        userLevel.Level = newLevel

        xpForPreviousLevels := xpRequiredForLevel(userLevel.Level)
        userLevel.CurrentXP = userLevel.TotalXP - xpForPreviousLevels

        userLevel.UpdatedAt = time.Now()
        db.Save(&userLevel)

        db.Create(&XPEvent{
                UserID:    userID,
                Amount:    amount,
                Reason:    reason,
                CreatedAt: time.Now(),
        })

        if leveledUp {
                checkLevelAchievements(userID, newLevel)
        }

        return nil
}

func checkLevelAchievements(userID uint, level int) {
        var achievements []Achievement
        db.Where("condition = ? AND threshold <= ?", "level", level).Find(&achievements)

        for _, ach := range achievements {
                var existing UserAchievement
                if db.Where("user_id = ? AND achievement_id = ?", userID, ach.ID).First(&existing).Error != nil {
                        db.Create(&UserAchievement{
                                UserID:        userID,
                                AchievementID: ach.ID,
                                UnlockedAt:    time.Now(),
                        })
                        if ach.XPReward > 0 {
                                awardXPWithoutAchievementCheck(userID, ach.XPReward, "achievement_"+ach.Name)
                        }
                }
        }
}

func awardXPWithoutAchievementCheck(userID uint, amount int, reason string) {
        var userLevel UserLevel
        if err := db.Where("user_id = ?", userID).First(&userLevel).Error; err != nil {
                return
        }

        userLevel.TotalXP += amount
        userLevel.Level = calculateLevel(userLevel.TotalXP)
        userLevel.CurrentXP = userLevel.TotalXP - xpRequiredForLevel(userLevel.Level)
        userLevel.UpdatedAt = time.Now()
        db.Save(&userLevel)

        db.Create(&XPEvent{
                UserID:    userID,
                Amount:    amount,
                Reason:    reason,
                CreatedAt: time.Now(),
        })
}

func checkActivityAchievements(userID uint, activityType string, count int) {
        var achievements []Achievement
        db.Where("condition = ? AND threshold <= ?", activityType, count).Find(&achievements)

        for _, ach := range achievements {
                var existing UserAchievement
                if db.Where("user_id = ? AND achievement_id = ?", userID, ach.ID).First(&existing).Error != nil {
                        db.Create(&UserAchievement{
                                UserID:        userID,
                                AchievementID: ach.ID,
                                UnlockedAt:    time.Now(),
                        })
                        awardXP(userID, ach.XPReward, "achievement_"+ach.Name)
                }
        }
}

func getAchievementsHandler(c *gin.Context) {
        var achievements []Achievement
        db.Order("category, xp_reward").Find(&achievements)
        c.JSON(http.StatusOK, achievements)
}

func getUserAchievementsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")

        targetID := c.Param("user_id")
        var uid uint
        if targetID != "" && targetID != "me" {
                id, _ := strconv.ParseUint(targetID, 10, 32)
                uid = uint(id)
        } else {
                uid = userID.(uint)
        }

        var userAchievements []UserAchievement
        db.Preload("Achievement").Where("user_id = ?", uid).Order("unlocked_at DESC").Find(&userAchievements)

        c.JSON(http.StatusOK, userAchievements)
}

func getUserLevelHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")

        targetID := c.Param("user_id")
        var uid uint
        if targetID != "" && targetID != "me" {
                id, _ := strconv.ParseUint(targetID, 10, 32)
                uid = uint(id)
        } else {
                uid = userID.(uint)
        }

        var userLevel UserLevel
        if err := db.Where("user_id = ?", uid).First(&userLevel).Error; err != nil {
                userLevel = UserLevel{
                        UserID:    uid,
                        Level:     1,
                        CurrentXP: 0,
                        TotalXP:   0,
                }
        }

        xpNeeded := xpForNextLevel(userLevel.Level)
        progress := float64(userLevel.CurrentXP) / float64(xpNeeded) * 100

        c.JSON(http.StatusOK, gin.H{
                "level":       userLevel.Level,
                "current_xp":  userLevel.CurrentXP,
                "total_xp":    userLevel.TotalXP,
                "xp_needed":   xpNeeded,
                "progress":    progress,
                "messages":    userLevel.MessagesCount,
                "voice_mins":  userLevel.VoiceMinutes,
                "reactions":   userLevel.ReactionsGiven,
                "posts":       userLevel.PostsCreated,
        })
}

func getLeaderboardHandler(c *gin.Context) {
        scope := c.DefaultQuery("scope", "global")
        period := c.DefaultQuery("period", "all")
        limit := 50

        var leaderboard []Leaderboard

        query := db.Table("user_levels").
                Select("user_levels.user_id, users.username, users.avatar, user_levels.level, user_levels.total_xp").
                Joins("JOIN users ON users.id = user_levels.user_id").
                Order("user_levels.total_xp DESC").
                Limit(limit)

        if scope != "global" {
                guildID, _ := strconv.ParseUint(scope, 10, 32)
                query = query.Joins("JOIN guild_members ON guild_members.user_id = user_levels.user_id").
                        Where("guild_members.guild_id = ?", guildID)
        }

        if period == "week" {
                weekAgo := time.Now().AddDate(0, 0, -7)
                query = query.Where("user_levels.updated_at >= ?", weekAgo)
        } else if period == "month" {
                monthAgo := time.Now().AddDate(0, -1, 0)
                query = query.Where("user_levels.updated_at >= ?", monthAgo)
        }

        query.Scan(&leaderboard)

        for i := range leaderboard {
                leaderboard[i].Rank = i + 1
        }

        c.JSON(http.StatusOK, leaderboard)
}

func createPollHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")

        var req struct {
                ChannelID   *uint    `json:"channel_id"`
                GuildID     *uint    `json:"guild_id"`
                Question    string   `json:"question" binding:"required"`
                Description string   `json:"description"`
                Options     []string `json:"options" binding:"required,min=2,max=10"`
                MultiChoice bool     `json:"multi_choice"`
                Anonymous   bool     `json:"anonymous"`
                Duration    int      `json:"duration"`
        }

        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var expiresAt *time.Time
        if req.Duration > 0 {
                t := time.Now().Add(time.Duration(req.Duration) * time.Second)
                expiresAt = &t
        }

        poll := Poll{
                ChannelID:   req.ChannelID,
                GuildID:     req.GuildID,
                AuthorID:    userID.(uint),
                Question:    SanitizeForDisplay(req.Question),
                Description: SanitizeForDisplay(req.Description),
                MultiChoice: req.MultiChoice,
                Anonymous:   req.Anonymous,
                ExpiresAt:   expiresAt,
                CreatedAt:   time.Now(),
        }

        if err := db.Create(&poll).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create poll"})
                return
        }

        for i, optText := range req.Options {
                option := PollOption{
                        PollID:   poll.ID,
                        Text:     SanitizeForDisplay(optText),
                        Position: i,
                }
                db.Create(&option)
        }

        awardXP(userID.(uint), 15, "poll_created")

        db.Preload("Options").Preload("Author").First(&poll, poll.ID)

        c.JSON(http.StatusCreated, poll)
}

func getPollsHandler(c *gin.Context) {
        channelID := c.Query("channel_id")
        guildID := c.Query("guild_id")
        active := c.DefaultQuery("active", "true")

        query := db.Preload("Options").Preload("Author")

        if channelID != "" {
                query = query.Where("channel_id = ?", channelID)
        }
        if guildID != "" {
                query = query.Where("guild_id = ?", guildID)
        }
        if active == "true" {
                query = query.Where("is_closed = ? AND (expires_at IS NULL OR expires_at > ?)", false, time.Now())
        }

        var polls []Poll
        query.Order("created_at DESC").Find(&polls)

        for i := range polls {
                var count int64
                db.Model(&PollVote{}).Where("poll_id = ?", polls[i].ID).Count(&count)
                polls[i].VotesCount = int(count)
        }

        c.JSON(http.StatusOK, polls)
}

func getPollHandler(c *gin.Context) {
        pollID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
                return
        }

        var poll Poll
        if err := db.Preload("Options").Preload("Author").First(&poll, pollID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
                return
        }

        var count int64
        db.Model(&PollVote{}).Where("poll_id = ?", poll.ID).Count(&count)
        poll.VotesCount = int(count)

        userID, exists := c.Get("user_id")
        var myVotes []uint
        if exists {
                var votes []PollVote
                db.Where("poll_id = ? AND user_id = ?", poll.ID, userID).Find(&votes)
                for _, v := range votes {
                        myVotes = append(myVotes, v.OptionID)
                }
        }

        c.JSON(http.StatusOK, gin.H{
                "poll":     poll,
                "my_votes": myVotes,
        })
}

func votePollHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        pollID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
                return
        }

        var req struct {
                OptionIDs []uint `json:"option_ids" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var poll Poll
        if err := db.First(&poll, pollID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
                return
        }

        if poll.IsClosed {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Poll is closed"})
                return
        }

        if poll.ExpiresAt != nil && time.Now().After(*poll.ExpiresAt) {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Poll has expired"})
                return
        }

        if !poll.MultiChoice && len(req.OptionIDs) > 1 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "This poll only allows single choice"})
                return
        }

        db.Where("poll_id = ? AND user_id = ?", pollID, userID).Delete(&PollVote{})

        for _, optID := range req.OptionIDs {
                var option PollOption
                if db.Where("id = ? AND poll_id = ?", optID, pollID).First(&option).Error == nil {
                        db.Create(&PollVote{
                                PollID:    uint(pollID),
                                OptionID:  optID,
                                UserID:    userID.(uint),
                                CreatedAt: time.Now(),
                        })
                        db.Model(&option).Update("votes_count", option.VotesCount+1)
                }
        }

        awardXP(userID.(uint), 5, "poll_vote")

        c.JSON(http.StatusOK, gin.H{"message": "Vote recorded"})
}

func closePollHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        pollID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
                return
        }

        var poll Poll
        if err := db.First(&poll, pollID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
                return
        }

        if poll.AuthorID != userID.(uint) {
                c.JSON(http.StatusForbidden, gin.H{"error": "Only poll author can close it"})
                return
        }

        poll.IsClosed = true
        db.Save(&poll)

        c.JSON(http.StatusOK, gin.H{"message": "Poll closed"})
}

func getCustomStatusHandler(c *gin.Context) {
        targetID := c.Param("user_id")
        var uid uint
        if targetID == "me" {
                userID, _ := c.Get("user_id")
                uid = userID.(uint)
        } else {
                id, _ := strconv.ParseUint(targetID, 10, 32)
                uid = uint(id)
        }

        var status CustomStatus
        if err := db.Where("user_id = ?", uid).First(&status).Error; err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "text":       "",
                        "emoji":      "",
                        "expires_at": nil,
                })
                return
        }

        if status.ExpiresAt != nil && time.Now().After(*status.ExpiresAt) {
                db.Delete(&status)
                c.JSON(http.StatusOK, gin.H{
                        "text":       "",
                        "emoji":      "",
                        "expires_at": nil,
                })
                return
        }

        c.JSON(http.StatusOK, status)
}

func updateCustomStatusHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")

        var req struct {
                Text      string `json:"text"`
                Emoji     string `json:"emoji"`
                Duration  int    `json:"duration"`
                ClearAt   string `json:"clear_at"`
        }

        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var status CustomStatus
        db.Where("user_id = ?", userID).FirstOrCreate(&status, CustomStatus{UserID: userID.(uint)})

        status.Text = SanitizeForDisplay(req.Text)
        status.Emoji = req.Emoji
        status.UpdatedAt = time.Now()

        if req.Duration > 0 {
                t := time.Now().Add(time.Duration(req.Duration) * time.Second)
                status.ExpiresAt = &t
        } else {
                status.ExpiresAt = nil
        }

        if req.ClearAt != "" {
                t, err := time.Parse(time.RFC3339, req.ClearAt)
                if err == nil {
                        status.ClearAt = &t
                }
        }

        db.Save(&status)

        c.JSON(http.StatusOK, status)
}

func clearCustomStatusHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")

        db.Where("user_id = ?", userID).Delete(&CustomStatus{})

        c.JSON(http.StatusOK, gin.H{"message": "Status cleared"})
}

func getStatusPresetsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")

        var presets []StatusPreset
        db.Where("user_id = ?", userID).Order("created_at DESC").Find(&presets)

        defaultPresets := []map[string]string{
                {"emoji": "💼", "text": "На работе", "name": "Working"},
                {"emoji": "🎮", "text": "Играю", "name": "Gaming"},
                {"emoji": "🎧", "text": "Слушаю музыку", "name": "Music"},
                {"emoji": "📚", "text": "Учусь", "name": "Studying"},
                {"emoji": "🍔", "text": "На обеде", "name": "Lunch"},
                {"emoji": "😴", "text": "Не беспокоить", "name": "DND"},
        }

        c.JSON(http.StatusOK, gin.H{
                "custom":  presets,
                "default": defaultPresets,
        })
}

func createStatusPresetHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")

        var req struct {
                Name  string `json:"name" binding:"required"`
                Text  string `json:"text" binding:"required"`
                Emoji string `json:"emoji"`
        }

        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        preset := StatusPreset{
                UserID:    userID.(uint),
                Name:      req.Name,
                Text:      SanitizeForDisplay(req.Text),
                Emoji:     req.Emoji,
                CreatedAt: time.Now(),
        }

        db.Create(&preset)

        c.JSON(http.StatusCreated, preset)
}

func deleteStatusPresetHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        presetID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

        result := db.Where("id = ? AND user_id = ?", presetID, userID).Delete(&StatusPreset{})
        if result.RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Preset not found"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"message": "Preset deleted"})
}

func getDisappearingSettingsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        otherUserID, _ := strconv.ParseUint(c.Param("user_id"), 10, 32)

        key := getConversationKey(userID.(uint), uint(otherUserID))

        var settings DisappearingSettings
        if err := db.Where("conversation_key = ?", key).First(&settings).Error; err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "enabled":  false,
                        "duration": 86400,
                })
                return
        }

        c.JSON(http.StatusOK, settings)
}

func updateDisappearingSettingsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        otherUserID, _ := strconv.ParseUint(c.Param("user_id"), 10, 32)

        var req struct {
                Enabled  bool `json:"enabled"`
                Duration int  `json:"duration"`
        }

        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.Duration < 60 {
                req.Duration = 60
        }
        if req.Duration > 604800 {
                req.Duration = 604800
        }

        key := getConversationKey(userID.(uint), uint(otherUserID))

        var settings DisappearingSettings
        db.Where("conversation_key = ?", key).FirstOrCreate(&settings, DisappearingSettings{
                ConversationKey: key,
                UserID1:         userID.(uint),
                UserID2:         uint(otherUserID),
        })

        settings.Enabled = req.Enabled
        settings.Duration = req.Duration
        settings.UpdatedAt = time.Now()

        db.Save(&settings)

        c.JSON(http.StatusOK, settings)
}

func getConversationKey(user1, user2 uint) string {
        if user1 < user2 {
                return fmt.Sprintf("%d_%d", user1, user2)
        }
        return fmt.Sprintf("%d_%d", user2, user1)
}

func cleanupExpiredMessagesJob() {
        ticker := time.NewTicker(1 * time.Minute)
        defer ticker.Stop()

        for range ticker.C {
                var settings []DisappearingSettings
                db.Where("enabled = ?", true).Find(&settings)

                for _, s := range settings {
                        threshold := time.Now().Add(-time.Duration(s.Duration) * time.Second)
                        db.Where("((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND created_at < ?",
                                s.UserID1, s.UserID2, s.UserID2, s.UserID1, threshold).
                                Delete(&DirectMessage{})
                }
        }
}

func cleanupExpiredStatusesJob() {
        ticker := time.NewTicker(1 * time.Minute)
        defer ticker.Stop()

        for range ticker.C {
                db.Where("expires_at < ?", time.Now()).Delete(&CustomStatus{})
        }
}

func seedDefaultAchievements() {
        achievements := []Achievement{
                {Name: "First Steps", NameRu: "Первые шаги", Description: "Send your first message", DescRu: "Отправь первое сообщение", Icon: "👶", Category: "social", XPReward: 50, Rarity: "common", Condition: "messages", Threshold: 1},
                {Name: "Chatterbox", NameRu: "Болтун", Description: "Send 100 messages", DescRu: "Отправь 100 сообщений", Icon: "💬", Category: "social", XPReward: 200, Rarity: "uncommon", Condition: "messages", Threshold: 100},
                {Name: "Communicator", NameRu: "Коммуникатор", Description: "Send 1000 messages", DescRu: "Отправь 1000 сообщений", Icon: "📢", Category: "social", XPReward: 500, Rarity: "rare", Condition: "messages", Threshold: 1000},
                {Name: "Voice Starter", NameRu: "Голосовой старт", Description: "Spend 10 minutes in voice", DescRu: "Проведи 10 минут в голосе", Icon: "🎤", Category: "voice", XPReward: 100, Rarity: "common", Condition: "voice_minutes", Threshold: 10},
                {Name: "Voice Pro", NameRu: "Голосовой про", Description: "Spend 1 hour in voice", DescRu: "Проведи 1 час в голосе", Icon: "🎧", Category: "voice", XPReward: 300, Rarity: "uncommon", Condition: "voice_minutes", Threshold: 60},
                {Name: "Voice Master", NameRu: "Мастер голоса", Description: "Spend 10 hours in voice", DescRu: "Проведи 10 часов в голосе", Icon: "🎵", Category: "voice", XPReward: 1000, Rarity: "epic", Condition: "voice_minutes", Threshold: 600},
                {Name: "Reactor", NameRu: "Реактор", Description: "Give 50 reactions", DescRu: "Поставь 50 реакций", Icon: "👍", Category: "social", XPReward: 150, Rarity: "common", Condition: "reactions", Threshold: 50},
                {Name: "Creator", NameRu: "Создатель", Description: "Create 10 posts", DescRu: "Создай 10 постов", Icon: "✍️", Category: "content", XPReward: 250, Rarity: "uncommon", Condition: "posts", Threshold: 10},
                {Name: "Level 5", NameRu: "Уровень 5", Description: "Reach level 5", DescRu: "Достигни 5 уровня", Icon: "⭐", Category: "progression", XPReward: 100, Rarity: "common", Condition: "level", Threshold: 5},
                {Name: "Level 10", NameRu: "Уровень 10", Description: "Reach level 10", DescRu: "Достигни 10 уровня", Icon: "🌟", Category: "progression", XPReward: 250, Rarity: "uncommon", Condition: "level", Threshold: 10},
                {Name: "Level 25", NameRu: "Уровень 25", Description: "Reach level 25", DescRu: "Достигни 25 уровня", Icon: "💫", Category: "progression", XPReward: 500, Rarity: "rare", Condition: "level", Threshold: 25},
                {Name: "Level 50", NameRu: "Уровень 50", Description: "Reach level 50", DescRu: "Достигни 50 уровня", Icon: "🏆", Category: "progression", XPReward: 1000, Rarity: "epic", Condition: "level", Threshold: 50},
                {Name: "Pollster", NameRu: "Опросник", Description: "Create 5 polls", DescRu: "Создай 5 опросов", Icon: "📊", Category: "content", XPReward: 200, Rarity: "uncommon", Condition: "polls_created", Threshold: 5},
                {Name: "Voter", NameRu: "Избиратель", Description: "Vote in 20 polls", DescRu: "Проголосуй в 20 опросах", Icon: "🗳️", Category: "social", XPReward: 150, Rarity: "common", Condition: "poll_votes", Threshold: 20},
                {Name: "Helper", NameRu: "Помощник", Description: "Receive 10 thanks reactions", DescRu: "Получи 10 благодарностей", Icon: "🤝", Category: "reputation", XPReward: 300, Rarity: "rare", Condition: "thanks_received", Threshold: 10},
                {Name: "Veteran", NameRu: "Ветеран", Description: "Be a member for 30 days", DescRu: "Будь участником 30 дней", Icon: "🎖️", Category: "loyalty", XPReward: 500, Rarity: "rare", Condition: "days_member", Threshold: 30},
        }

        for _, ach := range achievements {
                var existing Achievement
                if db.Where("name = ?", ach.Name).First(&existing).Error != nil {
                        db.Create(&ach)
                }
        }
}

func initPhase1() {
        db.AutoMigrate(
                &Achievement{}, &UserAchievement{}, &UserLevel{}, &XPEvent{},
                &Poll{}, &PollOption{}, &PollVote{},
                &CustomStatus{}, &StatusPreset{},
                &DisappearingSettings{},
        )

        seedDefaultAchievements()

        go cleanupExpiredMessagesJob()
        go cleanupExpiredStatusesJob()

        log.Println("[Phase1] Achievement system, Polls, Custom statuses, and Disappearing messages initialized")
}

func registerPhase1Routes(r *gin.Engine, auth gin.HandlerFunc) {
        api := r.Group("/api")

        api.GET("/achievements", getAchievementsHandler)
        api.GET("/achievements/:user_id", auth, getUserAchievementsHandler)
        api.GET("/level/:user_id", getUserLevelHandler)
        api.GET("/leaderboard", getLeaderboardHandler)

        api.POST("/polls", auth, createPollHandler)
        api.GET("/polls", getPollsHandler)
        api.GET("/polls/:id", getPollHandler)
        api.POST("/polls/:id/vote", auth, votePollHandler)
        api.POST("/polls/:id/close", auth, closePollHandler)

        api.GET("/status/:user_id", getCustomStatusHandler)
        api.PUT("/status", auth, updateCustomStatusHandler)
        api.DELETE("/status", auth, clearCustomStatusHandler)
        api.GET("/status-presets", auth, getStatusPresetsHandler)
        api.POST("/status-presets", auth, createStatusPresetHandler)
        api.DELETE("/status-presets/:id", auth, deleteStatusPresetHandler)

        api.GET("/disappearing/:user_id", auth, getDisappearingSettingsHandler)
        api.PUT("/disappearing/:user_id", auth, updateDisappearingSettingsHandler)
}
