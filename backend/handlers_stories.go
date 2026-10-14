package main

import (
        "crypto/rand"
        "encoding/hex"
        "fmt"
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

func getStoriesHandler(c *gin.Context) {
        myID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }
        var stories []Story
        now := time.Now()
        if err := db.Where("expires_at > ?", now).
                Where("user_id NOT IN (?)", db.Model(&StoryPrivacyExclusion{}).
                        Select("user_id").Where("excluded_user_id = ?", myID)).
                Order("created_at DESC").Find(&stories).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stories"})
                return
        }
        c.JSON(http.StatusOK, stories)
}

func createStoryHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                Content   string `json:"content"`
                MediaURL  string `json:"media_url"`
                MediaType string `json:"media_type"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))

        // Sanitize story content
        sanitizedContent := SanitizeForDisplay(req.Content)

        story := Story{
                UserID:    uid,
                Content:   sanitizedContent,
                MediaType: req.MediaType,
                ExpiresAt: time.Now().Add(24 * time.Hour),
        }
        if req.MediaURL != "" {
                story.MediaURL = &req.MediaURL
        }

        if err := db.Create(&story).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create story"})
                return
        }

        c.JSON(http.StatusCreated, story)
}

func viewStoryHandler(c *gin.Context) {
        uid, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }
        storyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid story ID"})
                return
        }

        var story Story
        if err := db.First(&story, storyID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Story not found"})
                return
        }

        if story.UserID != uid {
                var excluded int64
                db.Model(&StoryPrivacyExclusion{}).
                        Where("user_id = ? AND excluded_user_id = ?", story.UserID, uid).
                        Count(&excluded)
                if excluded > 0 {
                        c.JSON(http.StatusForbidden, gin.H{"error": "Story is private"})
                        return
                }
        }

        var existing StoryView
        if db.Where("story_id = ? AND viewer_id = ?", storyID, uid).First(&existing).RowsAffected == 0 {
                view := StoryView{
                        StoryID:  uint(storyID),
                        ViewerID: uid,
                        ViewedAt: time.Now(),
                }
                db.Create(&view)
                db.Model(&Story{}).Where("id = ?", storyID).Update("view_count", db.Raw("view_count + 1"))
        }

        c.JSON(http.StatusOK, gin.H{"status": "viewed"})
}

func deleteStoryHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        storyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid story ID"})
                return
        }

        uid := uint(userID.(float64))
        result := db.Where("id = ? AND user_id = ?", storyID, uid).Delete(&Story{})
        if result.RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Story not found or not owned"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// storyExclusionEntry — элемент списка исключений приватности историй
type storyExclusionEntry struct {
        ID       uint    `json:"id"`
        Username string  `json:"username"`
        Avatar   *string `json:"avatar"`
}

// getStoryExclusionsHandler — GET /api/stories/privacy/exclusions
// Возвращает список пользователей, от которых я скрыл свои истории.
func getStoryExclusionsHandler(c *gin.Context) {
        myID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        entries := make([]storyExclusionEntry, 0)
        if err := db.Table("story_privacy_exclusions AS spe").
                Select("u.id, u.username, u.avatar").
                Joins("JOIN users u ON u.id = spe.excluded_user_id").
                Where("spe.user_id = ?", myID).
                Order("spe.created_at ASC").
                Scan(&entries).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch exclusions"})
                return
        }
        c.JSON(http.StatusOK, entries)
}

// addStoryExclusionHandler — POST /api/stories/privacy/exclusions {"user_id": uint}
// Скрывает мои истории от указанного пользователя.
func addStoryExclusionHandler(c *gin.Context) {
        myID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var req struct {
                UserID uint `json:"user_id" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.UserID == myID {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot exclude yourself"})
                return
        }

        var user User
        if err := db.Select("id", "username", "avatar").First(&user, req.UserID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        var count int64
        db.Model(&StoryPrivacyExclusion{}).
                Where("user_id = ? AND excluded_user_id = ?", myID, req.UserID).
                Count(&count)
        if count > 0 {
                c.JSON(http.StatusConflict, gin.H{"error": "User already excluded"})
                return
        }

        exclusion := StoryPrivacyExclusion{
                UserID:         myID,
                ExcludedUserID: req.UserID,
        }
        if err := db.Create(&exclusion).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add exclusion"})
                return
        }

        c.JSON(http.StatusCreated, storyExclusionEntry{
                ID:       user.ID,
                Username: user.Username,
                Avatar:   user.Avatar,
        })
}

// removeStoryExclusionHandler — DELETE /api/stories/privacy/exclusions/:user_id
// Убирает пользователя из списка скрытия историй.
func removeStoryExclusionHandler(c *gin.Context) {
        myID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        excludedID, err := strconv.ParseUint(c.Param("user_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        result := db.Where("user_id = ? AND excluded_user_id = ?", myID, uint(excludedID)).
                Delete(&StoryPrivacyExclusion{})
        if result.RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Exclusion not found"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func ratePostHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
                return
        }

        var req struct {
                Rating int `json:"rating" binding:"required,min=1,max=5"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))
        var existing PostRating
        if db.Where("post_id = ? AND user_id = ?", postID, uid).First(&existing).RowsAffected > 0 {
                db.Model(&existing).Update("rating", req.Rating)
        } else {
                rating := PostRating{
                        PostID:    uint(postID),
                        UserID:    uid,
                        Rating:    req.Rating,
                        CreatedAt: time.Now(),
                }
                db.Create(&rating)
        }

        c.JSON(http.StatusOK, gin.H{"status": "rated"})
}

func getPostRatingHandler(c *gin.Context) {
        postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
                return
        }

        var result struct {
                Average float64 `json:"average"`
                Count   int64   `json:"count"`
        }
        db.Model(&PostRating{}).Where("post_id = ?", postID).Select("COALESCE(AVG(rating), 0) as average, COUNT(*) as count").Scan(&result)

        c.JSON(http.StatusOK, result)
}

func getPostCommentsHandler(c *gin.Context) {
        postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
                return
        }

        var comments []PostComment
        db.Where("post_id = ?", postID).Order("created_at DESC").Find(&comments)
        c.JSON(http.StatusOK, comments)
}

func createCommentHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
                return
        }

        var req struct {
                Content  string `json:"content" binding:"required"`
                ParentID *uint  `json:"parent_id"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))

        // Sanitize comment content
        sanitizedContent := SanitizeForDisplay(req.Content)

        comment := PostComment{
                PostID:    uint(postID),
                UserID:    uid,
                Content:   sanitizedContent,
                ParentID:  req.ParentID,
                CreatedAt: time.Now(),
        }

        if err := db.Create(&comment).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
                return
        }

        db.Model(&Post{}).Where("id = ?", postID).Update("comments", db.Raw("comments + 1"))
        c.JSON(http.StatusCreated, comment)
}

func deleteCommentHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        commentID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
                return
        }

        uid := uint(userID.(float64))
        var comment PostComment
        if db.First(&comment, commentID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
                return
        }

        if comment.UserID != uid {
                c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
                return
        }

        db.Delete(&comment)
        db.Model(&Post{}).Where("id = ?", comment.PostID).Update("comments", db.Raw("GREATEST(comments - 1, 0)"))
        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func getUserPresenceHandler(c *gin.Context) {
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var presence UserPresence
        if db.Where("user_id = ?", targetID).First(&presence).RowsAffected == 0 {
                c.JSON(http.StatusOK, gin.H{"status": "offline", "last_seen_at": nil})
                return
        }

        c.JSON(http.StatusOK, presence)
}

func updatePresenceHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                Status       string  `json:"status"`
                CustomStatus *string `json:"custom_status"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))
        var presence UserPresence
        if db.Where("user_id = ?", uid).First(&presence).RowsAffected == 0 {
                presence = UserPresence{
                        UserID:       uid,
                        Status:       req.Status,
                        CustomStatus: req.CustomStatus,
                        LastSeenAt:   time.Now(),
                        UpdatedAt:    time.Now(),
                }
                db.Create(&presence)
        } else {
                updates := map[string]interface{}{
                        "status":        req.Status,
                        "last_seen_at":  time.Now(),
                        "updated_at":    time.Now(),
                        "custom_status": req.CustomStatus,
                }
                db.Model(&presence).Updates(updates)
        }

        hub.broadcast <- map[string]interface{}{
                "type":    "presence_update",
                "user_id": uid,
                "status":  req.Status,
        }

        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func sendTypingHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                ChannelID  *uint  `json:"channel_id"`
                ChatUserID *uint  `json:"chat_user_id"`
                Status     string `json:"status"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))
        
        var user User
        db.First(&user, uid)
        
        status := req.Status
        if status == "" {
                status = "typing"
        }

        payload := map[string]interface{}{
                "type":         status,
                "user_id":      uid,
                "username":     user.Username,
                "avatar":       user.Avatar,
                "channel_id":   req.ChannelID,
                "chat_user_id": req.ChatUserID,
        }

        if req.ChatUserID != nil {
                hub.direct <- WSDirectMessage{
                        TargetUserID: fmt.Sprintf("%d", *req.ChatUserID),
                        Payload:      payload,
                }
        } else {
                hub.broadcast <- payload
        }

        c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

func markAsReadHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        messageID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
                return
        }

        uid := uint(userID.(float64))
        receipt := ReadReceipt{
                MessageID: uint(messageID),
                UserID:    uid,
                ReadAt:    time.Now(),
        }

        db.Where("message_id = ? AND user_id = ?", messageID, uid).FirstOrCreate(&receipt)

        hub.broadcast <- map[string]interface{}{
                "type":       "read_receipt",
                "message_id": messageID,
                "user_id":    uid,
        }

        c.JSON(http.StatusOK, gin.H{"status": "read"})
}

func addReactionHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        messageID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
                return
        }

        var req struct {
                Emoji string `json:"emoji" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))
        reaction := MessageReaction{
                MessageID: uint(messageID),
                UserID:    uid,
                Emoji:     req.Emoji,
                CreatedAt: time.Now(),
        }

        if db.Where("message_id = ? AND user_id = ? AND emoji = ?", messageID, uid, req.Emoji).First(&MessageReaction{}).RowsAffected > 0 {
                c.JSON(http.StatusConflict, gin.H{"error": "Reaction already exists"})
                return
        }

        db.Create(&reaction)

        hub.broadcast <- map[string]interface{}{
                "type":       "reaction_add",
                "message_id": messageID,
                "user_id":    uid,
                "emoji":      req.Emoji,
        }

        c.JSON(http.StatusCreated, reaction)
}

func removeReactionHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        messageID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
                return
        }

        emoji := c.Param("emoji")
        uid := uint(userID.(float64))

        db.Where("message_id = ? AND user_id = ? AND emoji = ?", messageID, uid, emoji).Delete(&MessageReaction{})

        hub.broadcast <- map[string]interface{}{
                "type":       "reaction_remove",
                "message_id": messageID,
                "user_id":    uid,
                "emoji":      emoji,
        }

        c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func generateInviteCode() string {
        bytes := make([]byte, 8)
        rand.Read(bytes)
        return hex.EncodeToString(bytes)
}

func createInviteHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                GuildID   *uint      `json:"guild_id"`
                ChannelID *uint      `json:"channel_id"`
                MaxUses   *int       `json:"max_uses"`
                ExpiresAt *time.Time `json:"expires_at"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))
        invite := InviteLink{
                Code:      generateInviteCode(),
                GuildID:   req.GuildID,
                ChannelID: req.ChannelID,
                CreatorID: uid,
                MaxUses:   req.MaxUses,
                ExpiresAt: req.ExpiresAt,
                CreatedAt: time.Now(),
        }

        if err := db.Create(&invite).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invite"})
                return
        }

        c.JSON(http.StatusCreated, invite)
}

func getInviteHandler(c *gin.Context) {
        code := c.Param("code")
        var invite InviteLink
        if db.Where("code = ?", code).First(&invite).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
                return
        }

        if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
                c.JSON(http.StatusGone, gin.H{"error": "Invite expired"})
                return
        }

        if invite.MaxUses != nil && invite.Uses >= *invite.MaxUses {
                c.JSON(http.StatusGone, gin.H{"error": "Invite max uses reached"})
                return
        }

        c.JSON(http.StatusOK, invite)
}

func useInviteHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        code := c.Param("code")

        var invite InviteLink
        if db.Where("code = ?", code).First(&invite).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
                return
        }

        if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
                c.JSON(http.StatusGone, gin.H{"error": "Invite expired"})
                return
        }

        if invite.MaxUses != nil && invite.Uses >= *invite.MaxUses {
                c.JSON(http.StatusGone, gin.H{"error": "Invite max uses reached"})
                return
        }

        uid := uint(userID.(float64))

        if invite.GuildID != nil {
                member := ChannelMember{
                        ChannelID: *invite.GuildID,
                        UserID:    uid,
                        Role:      "member",
                        JoinedAt:  time.Now(),
                }
                db.Create(&member)
        }

        db.Model(&invite).Update("uses", invite.Uses+1)

        c.JSON(http.StatusOK, gin.H{"status": "joined"})
}

func getUserNoteHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        uid := uint(userID.(float64))
        var note UserNote
        if db.Where("user_id = ? AND target_id = ?", uid, targetID).First(&note).RowsAffected == 0 {
                c.JSON(http.StatusOK, gin.H{"note": ""})
                return
        }

        c.JSON(http.StatusOK, note)
}

func updateUserNoteHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
                return
        }

        var req struct {
                Note string `json:"note"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        uid := uint(userID.(float64))
        var note UserNote
        if db.Where("user_id = ? AND target_id = ?", uid, targetID).First(&note).RowsAffected == 0 {
                note = UserNote{
                        UserID:    uid,
                        TargetID:  uint(targetID),
                        Note:      req.Note,
                        CreatedAt: time.Now(),
                        UpdatedAt: time.Now(),
                }
                db.Create(&note)
        } else {
                db.Model(&note).Updates(map[string]interface{}{
                        "note":       req.Note,
                        "updated_at": time.Now(),
                })
        }

        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func searchUsersHandler(c *gin.Context) {
        query := c.Query("q")
        if query == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Query required"})
                return
        }

        var users []User
        db.Where("username ILIKE ? OR email ILIKE ?", "%"+query+"%", "%"+query+"%").Limit(20).Find(&users)

        safeUsers := make([]map[string]interface{}, len(users))
        for i, u := range users {
                safeUsers[i] = map[string]interface{}{
                        "id":       u.ID,
                        "username": u.Username,
                        "avatar":   u.Avatar,
                        "bio":      u.Bio,
                }
        }

        c.JSON(http.StatusOK, safeUsers)
}

func getAllUsersHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var users []User
        db.Where("id != ?", uid).Limit(100).Find(&users)

        var friends []Friend
        db.Where("user_id = ? OR friend_id = ?", uid, uid).Find(&friends)

        friendMap := make(map[uint]bool)
        for _, f := range friends {
                if f.UserID == uid {
                        friendMap[f.FriendID] = true
                } else {
                        friendMap[f.UserID] = true
                }
        }

        var pendingRequests []FriendRequest
        db.Where("(requester_id = ? OR addressee_id = ?) AND status = ?", uid, uid, "pending").Find(&pendingRequests)

        pendingMap := make(map[uint]string)
        for _, r := range pendingRequests {
                if r.RequesterID == uid {
                        pendingMap[r.AddresseeID] = "outgoing"
                } else {
                        pendingMap[r.RequesterID] = "incoming"
                }
        }

        result := make([]map[string]interface{}, 0, len(users))
        for _, u := range users {
                status := "none"
                if friendMap[u.ID] {
                        status = "friend"
                } else if pendingMap[u.ID] != "" {
                        status = pendingMap[u.ID]
                }

                result = append(result, map[string]interface{}{
                        "id":              u.ID,
                        "username":        u.Username,
                        "avatar":          u.Avatar,
                        "bio":             u.Bio,
                        "status":          u.Status,
                        "friendship_status": status,
                })
        }

        c.JSON(http.StatusOK, result)
}
