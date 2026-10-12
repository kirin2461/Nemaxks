package main

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

// CreateMessage handles creating a new direct message
func createMessageHandler(c *gin.Context) {
  userID, _ := c.Get("user_id")
  senderID := uint(userID.(float64))

  var req struct {
    ToUserID        string  `json:"to_user_id" binding:"required"`
    Content         string  `json:"content"`
    ReplyToID       *uint   `json:"reply_to_id"`
    ForwardedFromID *uint   `json:"forwarded_from_id"`
    VoiceURL        *string `json:"voice_url"`
    VoiceDuration   int     `json:"voice_duration"`
  }

  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
  }

  if req.Content == "" && req.VoiceURL == nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Content or voice message required"})
    return
  }

  receiverID, err := strconv.ParseUint(req.ToUserID, 10, 32)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receiver ID"})
    return
  }

  if req.Content != "" {
    filterResult := checkContentFilter(req.Content, senderID, "direct_message")
    if filterResult.IsForbidden {
      c.JSON(http.StatusForbidden, gin.H{
        "error":         "Message contains forbidden content",
        "matched_words": filterResult.MatchedWords,
        "blocked":       true,
      })
      return
    }
  }

  // Sanitize content before storing
  sanitizedContent := SanitizeMessageContent(req.Content)

  message := DirectMessage{
    SenderID:        senderID,
    ReceiverID:      uint(receiverID),
    Content:         sanitizedContent,
    ReplyToID:       req.ReplyToID,
    ForwardedFromID: req.ForwardedFromID,
    VoiceURL:        req.VoiceURL,
    VoiceDuration:   req.VoiceDuration,
    CreatedAt:       time.Now(),
    UpdatedAt:       time.Now(),
  }

  if err := db.Create(&message).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create message"})
    return
  }

  // Get sender info for WebSocket notification
  var sender User
  db.First(&sender, senderID)

  // Send real-time notification via WebSocket - include both camelCase and snake_case for compatibility
  senderIDStr := strconv.FormatUint(uint64(senderID), 10)
  wsMessage := map[string]interface{}{
    "type":         "direct_message",
    "id":           message.ID,
    "content":      message.Content,
    "fromUserId":   senderIDStr,
    "from_user_id": senderIDStr,
    "toUserId":     req.ToUserID,
    "to_user_id":   req.ToUserID,
    "createdAt":    message.CreatedAt.Format(time.RFC3339),
    "created_at":   message.CreatedAt.Format(time.RFC3339),
    "username":     sender.Username,
    "sender_id":    senderID,
  }
  if sender.Avatar != nil && *sender.Avatar != "" {
    wsMessage["avatar"] = *sender.Avatar
  }
  if message.VoiceURL != nil && *message.VoiceURL != "" {
    wsMessage["voice_url"] = *message.VoiceURL
    wsMessage["voice_duration"] = message.VoiceDuration
  }
  if message.ReplyToID != nil {
    wsMessage["reply_to_id"] = *message.ReplyToID
  }
  hub.sendToUser(req.ToUserID, wsMessage)

  go createNotificationHandler(uint(receiverID), "new_message", "New message from user")

  c.JSON(http.StatusCreated, message)
}

// ПРИМЕЧАНИЕ (security): старый getMessagesHandler (GET сообщений по паре
// user_id_1/user_id_2 без проверки участия вызывающего) удалён — он позволял
// читать чужие переписки (IDOR). Используйте getUserMessagesHandler, который
// жёстко привязан к текущему пользователю из контекста.

// DeleteMessage soft deletes a message
func deleteMessageHandler(c *gin.Context) {
  userID, _ := c.Get("user_id")
  uid := uint(userID.(float64))

  messageIDStr := c.Param("message_id")
  messageID, err := strconv.ParseUint(messageIDStr, 10, 32)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
    return
  }

  // IDOR fix: удалять можно только свои сообщения (sender_id = текущий пользователь)
  result := db.Model(&DirectMessage{}).
    Where("id = ? AND sender_id = ?", messageID, uid).
    Update("deleted_at", time.Now())
  if result.Error != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
    return
  }
  if result.RowsAffected == 0 {
    // Либо сообщение не существует, либо оно принадлежит другому пользователю.
    // Не раскрываем различие: 404 для обоих случаев.
    c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
    return
  }

  c.JSON(http.StatusOK, gin.H{"message": "Message deleted"})
}

// UpdateMessage edits a message
func updateMessageHandler(c *gin.Context) {
  userID, _ := c.Get("user_id")
  uid := uint(userID.(float64))

  messageIDStr := c.Param("message_id")
  var req struct {
    Content string `json:"content" binding:"required"`
  }

  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
  }

  messageID, err := strconv.ParseUint(messageIDStr, 10, 32)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
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

  // Sanitize content before storing
  sanitizedContent := SanitizeMessageContent(req.Content)

  result := db.Model(&DirectMessage{}).Where("id = ? AND sender_id = ?", messageID, uid).
    Updates(map[string]interface{}{"content": sanitizedContent, "edited": true, "updated_at": time.Now()})
  if result.Error != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update message"})
    return
  }
  if result.RowsAffected == 0 {
    // Сообщение не найдено или принадлежит другому пользователю (IDOR-защита)
    c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
    return
  }

  var message DirectMessage
  db.First(&message, messageID)
  c.JSON(http.StatusOK, message)
}

// SearchMessages searches messages in a conversation
func searchMessagesHandler(c *gin.Context) {
  userID, _ := c.Get("user_id")
  uid := uint(userID.(float64))
  query := c.Query("q")
  targetUserID := c.Query("user_id")

  if query == "" {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Search query required"})
    return
  }

  var messages []DirectMessage
  dbQuery := db.Where("content ILIKE ?", "%"+query+"%")

  if targetUserID != "" {
    targetID, err := strconv.ParseUint(targetUserID, 10, 32)
    if err == nil {
      dbQuery = dbQuery.Where(
        "(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
        uid, targetID, targetID, uid,
      )
    }
  } else {
    dbQuery = dbQuery.Where("sender_id = ? OR receiver_id = ?", uid, uid)
  }

  if err := dbQuery.Order("created_at DESC").Limit(50).Find(&messages).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
    return
  }

  c.JSON(http.StatusOK, messages)
}

// ForwardMessage forwards a message to another user
func forwardMessageHandler(c *gin.Context) {
  userID, _ := c.Get("user_id")
  senderID := uint(userID.(float64))

  var req struct {
    MessageID  uint   `json:"message_id" binding:"required"`
    ToUserID   string `json:"to_user_id" binding:"required"`
  }

  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
  }

  var originalMessage DirectMessage
  if err := db.First(&originalMessage, req.MessageID).Error; err != nil {
    c.JSON(http.StatusNotFound, gin.H{"error": "Original message not found"})
    return
  }

  if originalMessage.SenderID != senderID && originalMessage.ReceiverID != senderID {
    c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to forward this message"})
    return
  }

  receiverID, err := strconv.ParseUint(req.ToUserID, 10, 32)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receiver ID"})
    return
  }

  originalID := originalMessage.ID
  if originalMessage.ForwardedFromID != nil {
    originalID = *originalMessage.ForwardedFromID
  }

  forwardedMessage := DirectMessage{
    SenderID:        senderID,
    ReceiverID:      uint(receiverID),
    Content:         originalMessage.Content,
    ForwardedFromID: &originalID,
    VoiceURL:        originalMessage.VoiceURL,
    VoiceDuration:   originalMessage.VoiceDuration,
    CreatedAt:       time.Now(),
    UpdatedAt:       time.Now(),
  }

  if err := db.Create(&forwardedMessage).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to forward message"})
    return
  }

  c.JSON(http.StatusCreated, forwardedMessage)
}

// PinDirectMessage toggles pin status of a direct message
func pinDirectMessageHandler(c *gin.Context) {
  userID, _ := c.Get("user_id")
  uid := uint(userID.(float64))
  messageIDStr := c.Param("message_id")

  messageID, err := strconv.ParseUint(messageIDStr, 10, 32)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
    return
  }

  var message DirectMessage
  if err := db.First(&message, messageID).Error; err != nil {
    c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
    return
  }

  if message.SenderID != uid && message.ReceiverID != uid {
    c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
    return
  }

  newPinStatus := !message.IsPinned
  if err := db.Model(&message).Update("is_pinned", newPinStatus).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pin status"})
    return
  }

  message.IsPinned = newPinStatus
  c.JSON(http.StatusOK, message)
}

// GetPinnedDirectMessages gets pinned direct messages in a conversation
func getPinnedDirectMessagesHandler(c *gin.Context) {
  userID, _ := c.Get("user_id")
  uid := uint(userID.(float64))
  targetUserID := c.Param("user_id")

  targetID, err := strconv.ParseUint(targetUserID, 10, 32)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
    return
  }

  var messages []DirectMessage
  if err := db.Where(
    "is_pinned = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))",
    true, uid, targetID, targetID, uid,
  ).Order("created_at DESC").Find(&messages).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pinned messages"})
    return
  }

  c.JSON(http.StatusOK, messages)
}

type ConversationResponse struct {
        User        User           `json:"user"`
        LastMessage *DirectMessage `json:"last_message"`
        UnreadCount int64          `json:"unread_count"`
}

func getConversationsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var messages []DirectMessage
        db.Where("sender_id = ? OR receiver_id = ?", uid, uid).
                Order("created_at DESC").
                Find(&messages)

        userMap := make(map[uint]bool)
        var conversations []ConversationResponse

        for _, msg := range messages {
                var otherUserID uint
                if msg.SenderID == uid {
                        otherUserID = msg.ReceiverID
                } else {
                        otherUserID = msg.SenderID
                }

                if userMap[otherUserID] {
                        continue
                }
                userMap[otherUserID] = true

                var otherUser User
                if db.First(&otherUser, otherUserID).RowsAffected == 0 {
                        continue
                }

                var unreadCount int64
                db.Model(&DirectMessage{}).Where("sender_id = ? AND receiver_id = ? AND read = ?", otherUserID, uid, false).Count(&unreadCount)

                msgCopy := msg
                conversations = append(conversations, ConversationResponse{
                        User:        otherUser,
                        LastMessage: &msgCopy,
                        UnreadCount: unreadCount,
                })
        }

        c.JSON(http.StatusOK, conversations)
}

func getUserMessagesHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        targetUserID := c.Param("user_id")
        limitStr := c.DefaultQuery("limit", "50")
        offsetStr := c.DefaultQuery("offset", "0")

        uid := uint(userID.(float64))
        targetID, err := strconv.ParseUint(targetUserID, 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }
        limit, _ := strconv.Atoi(limitStr)
        offset, _ := strconv.Atoi(offsetStr)

        var messages []DirectMessage
        if err := db.Where(
                "(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
                uid, targetID, targetID, uid,
        ).Order("created_at DESC").Limit(limit).Offset(offset).Find(&messages).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
                return
        }

        c.JSON(http.StatusOK, messages)
}
