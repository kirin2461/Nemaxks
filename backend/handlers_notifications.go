package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func getNotificationsFullHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	notifType := c.Query("type")
	unreadOnly := c.Query("unread") == "true"

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := db.Model(&Notification{}).Where("user_id = ?", uid)

	if notifType != "" {
		query = query.Where("type = ?", notifType)
	}
	if unreadOnly {
		query = query.Where("is_read = false")
	}

	var total int64
	query.Count(&total)

	var notifications []Notification
	query.Preload("Actor").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&notifications)

	var unreadCount int64
	db.Model(&Notification{}).Where("user_id = ? AND is_read = false", uid).Count(&unreadCount)

	results := make([]map[string]interface{}, len(notifications))
	for i, n := range notifications {
		results[i] = n.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{
		"notifications": results,
		"total":         total,
		"unread_count":  unreadCount,
		"page":          page,
		"limit":         limit,
		"has_more":      int64(offset+limit) < total,
	})
}

func getNotificationGroupsHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	groups, err := GetNotificationGroups(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить группы уведомлений"})
		return
	}

	unreadCount := GetUnreadCount(uid)

	c.JSON(http.StatusOK, gin.H{
		"groups":       groups,
		"unread_count": unreadCount,
	})
}

func getUnreadCountHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	count := GetUnreadCount(uid)

	c.JSON(http.StatusOK, gin.H{
		"count": count,
	})
}

func markNotificationReadHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	notificationID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID уведомления"})
		return
	}

	if err := MarkNotificationAsRead(uint(notificationID), uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отметить как прочитанное"})
		return
	}

	BroadcastToUser(uid, "notification_read", gin.H{
		"notification_id": notificationID,
		"unread_count":    GetUnreadCount(uid),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func markAllNotificationsReadHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	if err := MarkAllNotificationsAsRead(uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отметить все как прочитанные"})
		return
	}

	BroadcastToUser(uid, "all_notifications_read", gin.H{
		"unread_count": 0,
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func deleteNotificationHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	notificationID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID уведомления"})
		return
	}

	if err := DeleteNotification(uint(notificationID), uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить уведомление"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func deleteAllNotificationsHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	if err := DeleteAllNotifications(uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить уведомления"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func getNotificationPreferencesHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var prefs NotificationPreferences
	if db.Where("user_id = ?", uid).First(&prefs).RowsAffected == 0 {
		prefs = NotificationPreferences{
			UserID:               uid,
			Messages:             true,
			Mentions:             true,
			FriendRequests:       true,
			GuildInvites:         true,
			Achievements:         true,
			DailyRewards:         true,
			Gifts:                true,
			System:               true,
			Likes:                true,
			Comments:             true,
			Follows:              true,
			SoundEnabled:         true,
			DesktopNotifications: true,
			EmailNotifications:   false,
		}
		db.Create(&prefs)
	}

	c.JSON(http.StatusOK, prefs)
}

func updateNotificationPreferencesHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var input NotificationPreferences
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверные данные"})
		return
	}

	var prefs NotificationPreferences
	if db.Where("user_id = ?", uid).First(&prefs).RowsAffected == 0 {
		input.UserID = uid
		db.Create(&input)
		c.JSON(http.StatusOK, input)
		return
	}

	input.ID = prefs.ID
	input.UserID = uid
	db.Save(&input)

	c.JSON(http.StatusOK, input)
}

func sendTestNotificationHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	notification, err := CreateNotification(
		uid,
		NotifTypeSystem,
		"Тестовое уведомление",
		"Это тестовое уведомление для проверки системы",
		WithIcon("🔔"),
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать уведомление"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"notification": notification.ToResponse(),
	})
}

func NotifyFriendRequest(fromUserID, toUserID uint) {
	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	CreateNotification(
		toUserID,
		NotifTypeFriendReq,
		"Новый запрос в друзья",
		fromUser.Username+" хочет добавить вас в друзья",
		WithActor(fromUserID),
		WithIcon("👋"),
		WithAction("/friends/requests"),
	)
}

func NotifyFriendAccepted(fromUserID, toUserID uint) {
	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	CreateNotification(
		toUserID,
		NotifTypeFriendAccept,
		"Запрос принят",
		fromUser.Username+" принял ваш запрос в друзья",
		WithActor(fromUserID),
		WithIcon("🎉"),
		WithAction("/friends"),
	)
}

func NotifyNewMessage(fromUserID, toUserID, channelID uint, preview string) {
	if fromUserID == toUserID {
		return
	}

	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	if len(preview) > 100 {
		preview = preview[:100] + "..."
	}

	CreateNotification(
		toUserID,
		NotifTypeMessage,
		"Новое сообщение от "+fromUser.Username,
		preview,
		WithActor(fromUserID),
		WithIcon("💬"),
		WithEntity("channel", channelID),
		WithAction("/dm/"+strconv.Itoa(int(fromUserID))),
	)
}

func NotifyMention(fromUserID, toUserID, channelID, messageID uint) {
	if fromUserID == toUserID {
		return
	}

	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	CreateNotification(
		toUserID,
		NotifTypeMention,
		fromUser.Username+" упомянул вас",
		"Вас упомянули в сообщении",
		WithActor(fromUserID),
		WithIcon("@"),
		WithEntity("message", messageID),
	)
}

func NotifyGuildInvite(fromUserID, toUserID, guildID uint, guildName string) {
	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	CreateNotification(
		toUserID,
		NotifTypeGuildInvite,
		"Приглашение в гильдию",
		fromUser.Username+" приглашает вас в гильдию "+guildName,
		WithActor(fromUserID),
		WithIcon("🏰"),
		WithEntity("guild", guildID),
		WithAction("/guilds/"+strconv.Itoa(int(guildID))),
	)
}

func NotifyAchievement(userID uint, achievementName, description string, icon string) {
	CreateNotification(
		userID,
		NotifTypeAchievement,
		"Новое достижение!",
		achievementName+": "+description,
		WithIcon(icon),
		WithAction("/profile/achievements"),
	)
}

func NotifyLevelUp(userID uint, newLevel int) {
	CreateNotification(
		userID,
		NotifTypeLevelUp,
		"Уровень повышен!",
		"Поздравляем! Вы достигли "+strconv.Itoa(newLevel)+" уровня",
		WithIcon("⬆️"),
		WithData(`{"level":`+strconv.Itoa(newLevel)+`}`),
	)
}

func NotifyDailyReward(userID uint, coins, gems int) {
	content := "Вы получили"
	if coins > 0 {
		content += " " + strconv.Itoa(coins) + " монет"
	}
	if gems > 0 {
		if coins > 0 {
			content += " и"
		}
		content += " " + strconv.Itoa(gems) + " кристаллов"
	}

	CreateNotification(
		userID,
		NotifTypeDailyReward,
		"Ежедневная награда",
		content,
		WithIcon("🎁"),
	)
}

func NotifyGift(fromUserID, toUserID uint, giftName string) {
	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	CreateNotification(
		toUserID,
		NotifTypeGift,
		"Вам прислали подарок!",
		fromUser.Username+" отправил вам "+giftName,
		WithActor(fromUserID),
		WithIcon("🎁"),
	)
}

func NotifyLike(fromUserID, toUserID, postID uint) {
	if fromUserID == toUserID {
		return
	}

	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	var recent int64
	cutoff := time.Now().Add(-time.Hour)
	db.Model(&Notification{}).
		Where("user_id = ? AND type = ? AND actor_id = ? AND entity_id = ? AND created_at > ?",
			toUserID, NotifTypeLike, fromUserID, postID, cutoff).
		Count(&recent)

	if recent > 0 {
		return
	}

	CreateNotification(
		toUserID,
		NotifTypeLike,
		fromUser.Username+" оценил вашу публикацию",
		"",
		WithActor(fromUserID),
		WithIcon("❤️"),
		WithEntity("post", postID),
	)
}

func NotifyComment(fromUserID, toUserID, postID uint, commentPreview string) {
	if fromUserID == toUserID {
		return
	}

	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	if len(commentPreview) > 100 {
		commentPreview = commentPreview[:100] + "..."
	}

	CreateNotification(
		toUserID,
		NotifTypeComment,
		fromUser.Username+" прокомментировал вашу публикацию",
		commentPreview,
		WithActor(fromUserID),
		WithIcon("💬"),
		WithEntity("post", postID),
	)
}

func NotifyFollow(fromUserID, toUserID uint) {
	var fromUser User
	if db.First(&fromUser, fromUserID).RowsAffected == 0 {
		return
	}

	CreateNotification(
		toUserID,
		NotifTypeFollow,
		"Новый подписчик",
		fromUser.Username+" подписался на вас",
		WithActor(fromUserID),
		WithIcon("👤"),
		WithAction("/profile/"+strconv.Itoa(int(fromUserID))),
	)
}
