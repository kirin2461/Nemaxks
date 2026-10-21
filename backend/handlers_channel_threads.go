package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// channelMessageResponse — единый формат сообщения канала (топ-левел посты и replies веток).
type channelMessageResponse struct {
	ID         uint      `json:"id"`
	ChannelID  uint      `json:"channel_id"`
	AuthorID   uint      `json:"author_id"`
	Content    string    `json:"content"`
	Edited     bool      `json:"edited"`
	CreatedAt  time.Time `json:"created_at"`
	ParentID   *uint     `json:"parent_id,omitempty"`
	ReplyCount int       `json:"reply_count"`
	Author     struct {
		ID          uint    `json:"id"`
		Username    string  `json:"username"`
		DisplayName *string `json:"display_name"`
		Avatar      *string `json:"avatar"`
	} `json:"author"`
}

func toChannelMessageResponse(msg Message) channelMessageResponse {
	resp := channelMessageResponse{
		ID:         msg.ID,
		ChannelID:  msg.ChannelID,
		AuthorID:   msg.AuthorID,
		Content:    msg.Content,
		Edited:     msg.Edited,
		CreatedAt:  msg.CreatedAt,
		ParentID:   msg.ParentID,
		ReplyCount: msg.ReplyCount,
	}
	resp.Author.ID = msg.Author.ID
	resp.Author.Username = msg.Author.Username
	resp.Author.DisplayName = msg.Author.DisplayName
	resp.Author.Avatar = msg.Author.Avatar
	return resp
}

// getThreadRepliesHandler — GET /api/channels/:channel_id/messages/:message_id/thread
// Возвращает replies (parent_id = message_id) ветки, ASC, limit 200.
func getThreadRepliesHandler(c *gin.Context) {
	channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	messageID, err := strconv.ParseUint(c.Param("message_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	// Access check for private channels (same as getMessagesByChannelHandler)
	var channel Channel
	if err := db.First(&channel, channelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	if channel.IsPrivate {
		uid, ok := getUserIDFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		if !hasChannelAccessSingle(uid, channel) {
			c.JSON(http.StatusForbidden, gin.H{"error": "No access to this channel"})
			return
		}
	}

	// Parent message must exist and belong to this channel
	var parent Message
	if err := db.First(&parent, messageID).Error; err != nil || parent.ChannelID != uint(channelID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	// Shadowban enforcement: replies shadowbanned-авторов видны только им самим
	// и тем, у кого manage_messages.
	repliesQuery := db.Preload("Author").Where("parent_id = ?", messageID)
	if viewerID, ok := getUserIDFromContext(c); ok &&
		!hasChannelPermission(viewerID, uint(channelID), channel.GuildID, "manage_messages") {
		var shadowbannedIDs []uint
		db.Model(&Shadowban{}).Where("guild_id = ?", channel.GuildID).Pluck("user_id", &shadowbannedIDs)
		if len(shadowbannedIDs) > 0 {
			repliesQuery = repliesQuery.Where("author_id NOT IN ? OR author_id = ?", shadowbannedIDs, viewerID)
		}
	}

	var replies []Message
	repliesQuery.
		Order("created_at asc").
		Limit(200).
		Find(&replies)

	result := make([]channelMessageResponse, 0, len(replies))
	for _, msg := range replies {
		result = append(result, toChannelMessageResponse(msg))
	}

	c.JSON(http.StatusOK, result)
}

// updateChannelMessageHandler — PUT /api/channels/:channel_id/messages/:message_id
// Редактирование текста сообщения канала (BE-4). Только автор сообщения;
// выставляет edited=true. Раньше фронт отправлял редактирование канальных
// сообщений на /api/messages/update/:id, который работает только с
// DirectMessage и для channel-сообщений отвечал 404.
func updateChannelMessageHandler(c *gin.Context) {
	channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	messageID, err := strconv.ParseUint(c.Param("message_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	uid, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	filterResult := checkContentFilter(req.Content, uid, "edit_message")
	if filterResult.IsForbidden {
		c.JSON(http.StatusForbidden, gin.H{
			"error":         "Message contains forbidden content",
			"matched_words": filterResult.MatchedWords,
			"blocked":       true,
		})
		return
	}

	// Sanitize content before storing (как в createChannelMessageHandler)
	sanitizedContent := SanitizeMessageContent(req.Content)

	// Только автор может редактировать; сообщение должно принадлежать каналу из URL
	result := db.Model(&Message{}).
		Where("id = ? AND channel_id = ? AND author_id = ?", messageID, channelID, uid).
		Updates(map[string]interface{}{
			"content":    sanitizedContent,
			"edited":     true,
			"updated_at": time.Now(),
		})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update message"})
		return
	}
	if result.RowsAffected == 0 {
		// Сообщение не существует, из другого канала или чужое (IDOR-защита)
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	var msg Message
	db.Preload("Author").First(&msg, messageID)
	resp := toChannelMessageResponse(msg)

	// Рассылаем редактирование подписчикам канала (тот же паттерн,
	// что у createChannelMessageHandler)
	hub.broadcast <- map[string]interface{}{
		"type":       "channel-message-edited",
		"channel_id": channelID,
		"message":    resp,
	}

	c.JSON(http.StatusOK, resp)
}

// deleteChannelMessageHandler — DELETE /api/channels/:channel_id/messages/:message_id
// Удаление сообщения канала. Только автор сообщения; чужое/несуществующее —
// 404 (IDOR-защита, как в updateChannelMessageHandler). Soft delete через
// gorm.DeletedAt (как deleteMessageHandler для DM): запись остаётся в БД
// и исключается из выборок автоматически.
func deleteChannelMessageHandler(c *gin.Context) {
	channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	messageID, err := strconv.ParseUint(c.Param("message_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	uid, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Только автор; сообщение должно принадлежать каналу из URL
	var msg Message
	if err := db.Where("id = ? AND channel_id = ? AND author_id = ?", messageID, channelID, uid).First(&msg).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	if err := db.Delete(&msg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}

	// Уменьшаем счётчик ответов у родителя, если удалили reply ветки
	// (increment — в createChannelMessageHandler)
	if msg.ParentID != nil {
		db.Model(&Message{}).Where("id = ?", *msg.ParentID).
			Update("reply_count", gorm.Expr("reply_count - 1"))
	}

	// Рассылаем удаление подписчикам канала (паттерн updateChannelMessageHandler)
	hub.broadcast <- map[string]interface{}{
		"type":       "channel-message-deleted",
		"channel_id": channelID,
		"message_id": messageID,
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message deleted"})
}

// getMyChannelPermissionsHandler — GET /api/channels/:channel_id/permissions/me
// Возвращает права текущего пользователя в канале (для announcement/text логики фронта).
func getMyChannelPermissionsHandler(c *gin.Context) {
	channelID, err := strconv.ParseUint(c.Param("channel_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	uid, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var channel Channel
	if err := db.First(&channel, channelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}

	// Access check for private channels
	if channel.IsPrivate && !hasChannelAccessSingle(uid, channel) {
		c.JSON(http.StatusForbidden, gin.H{"error": "No access to this channel"})
		return
	}

	canManage := hasChannelPermission(uid, uint(channelID), channel.GuildID, "manage_messages")

	// can_post: в announcement-канале топ-левел посты только для manage_messages,
	// в остальных каналах — всем с доступом
	canPost := true
	if channel.Type == "announcement" {
		canPost = canManage
	}

	// role: владелец гильдии → owner; иначе роль ChannelMember; иначе member
	role := "member"
	var guild Guild
	if db.First(&guild, channel.GuildID).RowsAffected > 0 && guild.OwnerID == uid {
		role = "owner"
	} else {
		var member ChannelMember
		if db.Where("channel_id = ? AND user_id = ?", channelID, uid).First(&member).RowsAffected > 0 && member.Role != "" {
			role = member.Role
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"can_post":     canPost,
		"can_manage":   canManage,
		"role":         role,
		"channel_type": channel.Type,
	})
}
