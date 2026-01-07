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

  message := DirectMessage{
    SenderID:        senderID,
    ReceiverID:      uint(receiverID),
    Content:         req.Content,
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

  go createNotificationHandler(uint(receiverID), "new_message", "New message from user")

  c.JSON(http.StatusCreated, message)
}

// GetMessages retrieves messages between two users
func getMessagesHandler(c *gin.Context) {
  userID1Str := c.Param("user_id_1")
  userID2Str := c.Param("user_id_2")
  limitStr := c.DefaultQuery("limit", "50")
  offsetStr := c.DefaultQuery("offset", "0")

        userID1, err1 := strconv.ParseUint(userID1Str, 10, 32)
        userID2, err2 := strconv.ParseUint(userID2Str, 10, 32)
        limit, _ := strconv.Atoi(limitStr)
        offset, _ := strconv.Atoi(offsetStr)

        if err1 != nil || err2 != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user IDs"})
                return
        }

  var messages []DirectMessage
  if err := db.Preload("ReplyTo").Where(
    "(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
    userID1, userID2, userID2, userID1,
  ).Order("created_at ASC").Limit(limit).Offset(offset).Find(&messages).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
    return
  }

  c.JSON(http.StatusOK, messages)
}

// DeleteMessage soft deletes a message
func deleteMessageHandler(c *gin.Context) {
  messageIDStr := c.Param("message_id")
  messageID, err := strconv.ParseUint(messageIDStr, 10, 32)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
    return
  }

  if err := db.Model(&DirectMessage{}).Where("id = ?", messageID).Update("deleted_at", time.Now()).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
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

  if err := db.Model(&DirectMessage{}).Where("id = ? AND sender_id = ?", messageID, uid).
    Updates(map[string]interface{}{"content": req.Content, "edited": true, "updated_at": time.Now()}).Error; err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update message"})
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
