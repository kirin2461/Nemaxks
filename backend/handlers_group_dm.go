package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func createGroupDMHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	ownerID := uint(userID.(float64))

	var req struct {
		Name           string `json:"name" binding:"required"`
		ParticipantIDs []uint `json:"participant_ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	allParticipants := make(map[uint]bool)
	allParticipants[ownerID] = true
	for _, pid := range req.ParticipantIDs {
		allParticipants[pid] = true
	}

	if len(allParticipants) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group DM requires at least 2 participants (including owner)"})
		return
	}

	group := GroupDM{
		Name:      req.Name,
		OwnerID:   ownerID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create group DM"})
		return
	}

	for pid := range allParticipants {
		participant := GroupDMParticipant{
			GroupID:  group.ID,
			UserID:   pid,
			JoinedAt: time.Now(),
		}
		db.Create(&participant)
	}

	var participants []GroupDMParticipant
	db.Where("group_id = ?", group.ID).Find(&participants)

	var users []User
	var userIDs []uint
	for _, p := range participants {
		userIDs = append(userIDs, p.UserID)
	}
	db.Where("id IN ?", userIDs).Find(&users)

	c.JSON(http.StatusCreated, gin.H{
		"group":        group,
		"participants": participants,
		"users":        users,
	})
}

func getGroupDMsHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var participantRecords []GroupDMParticipant
	db.Where("user_id = ?", uid).Find(&participantRecords)

	if len(participantRecords) == 0 {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	var groupIDs []uint
	for _, p := range participantRecords {
		groupIDs = append(groupIDs, p.GroupID)
	}

	var groups []GroupDM
	db.Where("id IN ?", groupIDs).Find(&groups)

	type GroupDMResponse struct {
		Group        GroupDM              `json:"group"`
		Participants []GroupDMParticipant  `json:"participants"`
		Users        []User               `json:"users"`
		LastMessage  *GroupDMMessage       `json:"last_message"`
	}

	var result []GroupDMResponse
	for _, g := range groups {
		var participants []GroupDMParticipant
		db.Where("group_id = ?", g.ID).Find(&participants)

		var userIDs []uint
		for _, p := range participants {
			userIDs = append(userIDs, p.UserID)
		}
		var users []User
		db.Where("id IN ?", userIDs).Find(&users)

		var lastMessage GroupDMMessage
		var lastMsg *GroupDMMessage
		if err := db.Where("group_id = ?", g.ID).Order("created_at DESC").First(&lastMessage).Error; err == nil {
			lastMsg = &lastMessage
		}

		result = append(result, GroupDMResponse{
			Group:        g,
			Participants: participants,
			Users:        users,
			LastMessage:  lastMsg,
		})
	}

	c.JSON(http.StatusOK, result)
}

func getGroupDMMessagesHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var participant GroupDMParticipant
	if err := db.Where("group_id = ? AND user_id = ?", groupID, uid).First(&participant).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a participant of this group"})
		return
	}

	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	var messages []GroupDMMessage
	if err := db.Preload("ReplyTo").Where("group_id = ?", groupID).
		Order("created_at ASC").Limit(limit).Offset(offset).Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	var senderIDs []uint
	senderMap := make(map[uint]bool)
	for _, m := range messages {
		if !senderMap[m.SenderID] {
			senderIDs = append(senderIDs, m.SenderID)
			senderMap[m.SenderID] = true
		}
	}

	var senders []User
	if len(senderIDs) > 0 {
		db.Where("id IN ?", senderIDs).Find(&senders)
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"senders":  senders,
	})
}

func sendGroupDMMessageHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	senderID := uint(userID.(float64))

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var participant GroupDMParticipant
	if err := db.Where("group_id = ? AND user_id = ?", groupID, senderID).First(&participant).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a participant of this group"})
		return
	}

	var req struct {
		Content   string `json:"content" binding:"required"`
		ReplyToID *uint  `json:"reply_to_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	filterResult := checkContentFilter(req.Content, senderID, "group_dm_message")
	if filterResult.IsForbidden {
		c.JSON(http.StatusForbidden, gin.H{
			"error":         "Message contains forbidden content",
			"matched_words": filterResult.MatchedWords,
			"blocked":       true,
		})
		return
	}

	sanitizedContent := SanitizeMessageContent(req.Content)

	message := GroupDMMessage{
		GroupID:   uint(groupID),
		SenderID:  senderID,
		Content:   sanitizedContent,
		ReplyToID: req.ReplyToID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(&message).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
		return
	}

	var sender User
	db.First(&sender, senderID)

	senderIDStr := strconv.FormatUint(uint64(senderID), 10)
	wsMessage := map[string]interface{}{
		"type":       "group_dm_message",
		"id":         message.ID,
		"group_id":   message.GroupID,
		"content":    message.Content,
		"sender_id":  senderID,
		"username":   sender.Username,
		"created_at": message.CreatedAt.Format(time.RFC3339),
	}
	if sender.Avatar != nil && *sender.Avatar != "" {
		wsMessage["avatar"] = *sender.Avatar
	}
	if message.ReplyToID != nil {
		wsMessage["reply_to_id"] = *message.ReplyToID
	}

	var participants []GroupDMParticipant
	db.Where("group_id = ?", groupID).Find(&participants)
	for _, p := range participants {
		if p.UserID != senderID {
			targetUserIDStr := fmt.Sprintf("%d", p.UserID)
			hub.sendToUser(targetUserIDStr, wsMessage)
		}
	}
	_ = senderIDStr

	c.JSON(http.StatusCreated, message)
}

func addGroupDMParticipantHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var group GroupDM
	if err := db.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	if group.OwnerID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the group owner can add participants"})
		return
	}

	var req struct {
		UserID uint `json:"user_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing GroupDMParticipant
	if err := db.Where("group_id = ? AND user_id = ?", groupID, req.UserID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a participant"})
		return
	}

	participant := GroupDMParticipant{
		GroupID:  uint(groupID),
		UserID:   req.UserID,
		JoinedAt: time.Now(),
	}

	if err := db.Create(&participant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add participant"})
		return
	}

	c.JSON(http.StatusCreated, participant)
}

func removeGroupDMParticipantHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	targetUserIDStr := c.Param("user_id")
	targetUserID, err := strconv.ParseUint(targetUserIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var group GroupDM
	if err := db.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	if uid != uint(targetUserID) && group.OwnerID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the group owner can remove other participants"})
		return
	}

	if err := db.Where("group_id = ? AND user_id = ?", groupID, targetUserID).Delete(&GroupDMParticipant{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove participant"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Participant removed"})
}

func updateGroupDMHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var group GroupDM
	if err := db.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	if group.OwnerID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the group owner can update the group"})
		return
	}

	var req struct {
		Name   *string `json:"name"`
		Avatar *string `json:"avatar"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Avatar != nil {
		updates["avatar"] = *req.Avatar
	}

	if err := db.Model(&group).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update group"})
		return
	}

	db.First(&group, groupID)
	c.JSON(http.StatusOK, group)
}
