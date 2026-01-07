package main

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

// GetFriends retrieves the list of friends for the current user
func getFriendsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var friends []Friend
        if err := db.Where("user_id = ? OR friend_id = ?", uid, uid).Find(&friends).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch friends"})
                return
        }

        var pendingRequests []FriendRequest
        db.Where("addressee_id = ? AND status = ?", uid, "pending").Find(&pendingRequests)

        var outgoingRequests []FriendRequest
        db.Where("requester_id = ? AND status = ?", uid, "pending").Find(&outgoingRequests)

        type FriendInfo struct {
                ID         uint    `json:"id"`
                RequestID  uint    `json:"request_id,omitempty"`
                Username   string  `json:"username"`
                Avatar     *string `json:"avatar"`
                Status     string  `json:"status"`
                Bio        *string `json:"bio"`
                IsFriend   bool    `json:"isFriend"`
                IsPending  bool    `json:"isPending"`
                IsOutgoing bool    `json:"isOutgoing"`
                CreatedAt  string  `json:"created_at"`
        }

        var result []FriendInfo

        for _, f := range friends {
                var friendUser User
                friendUID := f.FriendID
                if f.UserID != uid {
                        friendUID = f.UserID
                }
                if err := db.First(&friendUser, friendUID).Error; err == nil {
                        result = append(result, FriendInfo{
                                ID:        friendUser.ID,
                                Username:  friendUser.Username,
                                Avatar:    friendUser.Avatar,
                                Status:    friendUser.Status,
                                Bio:       friendUser.Bio,
                                IsFriend:  true,
                                IsPending: false,
                                CreatedAt: f.CreatedAt.Format(time.RFC3339),
                        })
                }
        }

        for _, req := range pendingRequests {
                var requester User
                if err := db.First(&requester, req.RequesterID).Error; err == nil {
                        result = append(result, FriendInfo{
                                ID:         requester.ID,
                                RequestID:  req.ID,
                                Username:   requester.Username,
                                Avatar:     requester.Avatar,
                                Status:     requester.Status,
                                Bio:        requester.Bio,
                                IsFriend:   false,
                                IsPending:  true,
                                IsOutgoing: false,
                                CreatedAt:  req.CreatedAt.Format(time.RFC3339),
                        })
                }
        }

        for _, req := range outgoingRequests {
                var addressee User
                if err := db.First(&addressee, req.AddresseeID).Error; err == nil {
                        result = append(result, FriendInfo{
                                ID:         addressee.ID,
                                RequestID:  req.ID,
                                Username:   addressee.Username,
                                Avatar:     addressee.Avatar,
                                Status:     addressee.Status,
                                Bio:        addressee.Bio,
                                IsFriend:   false,
                                IsPending:  true,
                                IsOutgoing: true,
                                CreatedAt:  req.CreatedAt.Format(time.RFC3339),
                        })
                }
        }

        c.JSON(http.StatusOK, result)
}

// SendFriendRequest handles sending a new friend request
func sendFriendRequestHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        var req struct {
                Username string `json:"username" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var targetUser User
        if err := db.Where("username = ?", req.Username).First(&targetUser).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        if targetUser.ID == uid {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot add yourself"})
                return
        }

        var existingRequest FriendRequest
        if err := db.Where("(requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
                uid, targetUser.ID, targetUser.ID, uid).First(&existingRequest).Error; err == nil {
                if existingRequest.Status == "pending" {
                        c.JSON(http.StatusConflict, gin.H{"error": "Request already exists"})
                        return
                }
        }

        var existingFriend Friend
        if err := db.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                uid, targetUser.ID, targetUser.ID, uid).First(&existingFriend).Error; err == nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Already friends"})
                return
        }

        request := FriendRequest{
                RequesterID: uid,
                AddresseeID: targetUser.ID,
                Status:      "pending",
                CreatedAt:   time.Now(),
        }

        if err := db.Create(&request).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send request"})
                return
        }

        hub.sendToUser(strconv.Itoa(int(targetUser.ID)), map[string]interface{}{
                "type": "friend_request",
                "from": map[string]interface{}{
                        "id":       uid,
                        "username": c.GetString("username"),
                },
                "requestId": request.ID,
        })

        c.JSON(http.StatusCreated, request)
}

// RespondFriendRequestHandler handles accepting/declining a friend request
func respondFriendRequestHandler(c *gin.Context) {
        requestID := c.Param("id")
        var req struct {
                Action string `json:"action" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var fr FriendRequest
        if err := db.First(&fr, requestID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
                return
        }

        if req.Action == "accept" {
                fr.Status = "accepted"
                friend := Friend{
                        UserID:   fr.RequesterID,
                        FriendID: fr.AddresseeID,
                        CreatedAt: time.Now(),
                }
                if err := db.Create(&friend).Error; err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create friendship"})
                        return
                }
        } else if req.Action == "decline" {
                fr.Status = "declined"
        }

        if err := db.Save(&fr).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update request"})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteFriendHandler removes a friendship
func deleteFriendHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        friendID := c.Param("id")
        fid, _ := strconv.Atoi(friendID)

        if err := db.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                uid, fid, fid, uid).Delete(&Friend{}).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove friend"})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// BlockUserHandler blocks a user
func blockUserHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var req struct {
                UserID uint `json:"user_id" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.UserID == uid {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot block yourself"})
                return
        }

        var existing BlockedUser
        if err := db.Where("user_id = ? AND blocked_user_id = ?", uid, req.UserID).First(&existing).Error; err == nil {
                c.JSON(http.StatusConflict, gin.H{"error": "User already blocked"})
                return
        }

        db.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                uid, req.UserID, req.UserID, uid).Delete(&Friend{})

        db.Where("(requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
                uid, req.UserID, req.UserID, uid).Delete(&FriendRequest{})

        block := BlockedUser{
                UserID:        uid,
                BlockedUserID: req.UserID,
                CreatedAt:     time.Now(),
        }

        if err := db.Create(&block).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to block user"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"success": true, "id": block.ID})
}

// UnblockUserHandler unblocks a user
func unblockUserHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        blockedID := c.Param("id")
        bid, _ := strconv.Atoi(blockedID)

        if err := db.Where("user_id = ? AND blocked_user_id = ?", uid, bid).Delete(&BlockedUser{}).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unblock user"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetBlockedUsersHandler returns blocked users
func getBlockedUsersHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var blocked []BlockedUser
        db.Where("user_id = ?", uid).Find(&blocked)

        type BlockedInfo struct {
                ID        uint    `json:"id"`
                UserID    uint    `json:"user_id"`
                Username  string  `json:"username"`
                Avatar    *string `json:"avatar"`
                CreatedAt string  `json:"created_at"`
        }

        var result []BlockedInfo
        for _, b := range blocked {
                var blockedUser User
                if err := db.First(&blockedUser, b.BlockedUserID).Error; err == nil {
                        result = append(result, BlockedInfo{
                                ID:        b.ID,
                                UserID:    blockedUser.ID,
                                Username:  blockedUser.Username,
                                Avatar:    blockedUser.Avatar,
                                CreatedAt: b.CreatedAt.Format(time.RFC3339),
                        })
                }
        }

        c.JSON(http.StatusOK, result)
}

// CancelFriendRequestHandler cancels an outgoing friend request
func cancelFriendRequestHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        requestID := c.Param("id")
        rid, _ := strconv.Atoi(requestID)

        var req FriendRequest
        if err := db.First(&req, rid).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
                return
        }

        if req.RequesterID != uid {
                c.JSON(http.StatusForbidden, gin.H{"error": "Not your request"})
                return
        }

        db.Delete(&req)
        c.JSON(http.StatusOK, gin.H{"success": true})
}
