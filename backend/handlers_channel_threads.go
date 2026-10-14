package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
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
		ID       uint    `json:"id"`
		Username string  `json:"username"`
		Avatar   *string `json:"avatar"`
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

	var replies []Message
	db.Preload("Author").
		Where("parent_id = ?", messageID).
		Order("created_at asc").
		Limit(200).
		Find(&replies)

	result := make([]channelMessageResponse, 0, len(replies))
	for _, msg := range replies {
		result = append(result, toChannelMessageResponse(msg))
	}

	c.JSON(http.StatusOK, result)
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
