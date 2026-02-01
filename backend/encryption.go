package main

import (
        "crypto/rand"
        "encoding/base64"
        "fmt"
        "net/http"
        "time"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

type UserKeyPair struct {
        ID              uint      `json:"id" gorm:"primaryKey"`
        UserID          uint      `json:"user_id" gorm:"uniqueIndex;not null"`
        PublicKey       string    `json:"public_key" gorm:"type:text;not null"`
        EncryptedPrivateKey string `json:"-" gorm:"type:text;not null"`
        KeyVersion      int       `json:"key_version" gorm:"default:1"`
        Algorithm       string    `json:"algorithm" gorm:"default:'X25519-XSalsa20-Poly1305'"`
        CreatedAt       time.Time `json:"created_at"`
        UpdatedAt       time.Time `json:"updated_at"`
}

type ChannelEncryptionSettings struct {
        ID              uint      `json:"id" gorm:"primaryKey"`
        ChannelID       uint      `json:"channel_id" gorm:"uniqueIndex;not null"`
        E2EEnabled      bool      `json:"e2e_enabled" gorm:"default:false"`
        GroupKeyVersion int       `json:"group_key_version" gorm:"default:1"`
        CreatedAt       time.Time `json:"created_at"`
        UpdatedAt       time.Time `json:"updated_at"`
}

type ChannelGroupKey struct {
        ID                  uint      `json:"id" gorm:"primaryKey"`
        ChannelID           uint      `json:"channel_id" gorm:"index;not null"`
        UserID              uint      `json:"user_id" gorm:"index;not null"`
        EncryptedGroupKey   string    `json:"-" gorm:"type:text;not null"`
        KeyVersion          int       `json:"key_version" gorm:"default:1"`
        CreatedAt           time.Time `json:"created_at"`
}

type AdminAccessPermission struct {
        ID              uint       `json:"id" gorm:"primaryKey"`
        UserID          uint       `json:"user_id" gorm:"index;not null"`
        GrantedToUserID uint       `json:"granted_to_user_id" gorm:"index;not null"`
        PermissionType  string     `json:"permission_type" gorm:"default:'dm_read'"`
        EncryptedKey    string     `json:"-" gorm:"type:text"`
        Reason          string     `json:"reason"`
        GrantedAt       time.Time  `json:"granted_at"`
        ExpiresAt       *time.Time `json:"expires_at,omitempty"`
        RevokedAt       *time.Time `json:"revoked_at,omitempty"`
        IsActive        bool       `json:"is_active" gorm:"default:true"`
}

type ConversationEncryption struct {
        ID                  uint      `json:"id" gorm:"primaryKey"`
        User1ID             uint      `json:"user1_id" gorm:"index;not null"`
        User2ID             uint      `json:"user2_id" gorm:"index;not null"`
        E2EEnabled          bool      `json:"e2e_enabled" gorm:"default:true"`
        SharedSecretVersion int       `json:"shared_secret_version" gorm:"default:1"`
        CreatedAt           time.Time `json:"created_at"`
        UpdatedAt           time.Time `json:"updated_at"`
}

type EncryptedDirectMessage struct {
        gorm.Model
        SenderID           uint   `json:"sender_id" gorm:"index;not null"`
        RecipientID        uint   `json:"recipient_id" gorm:"index;not null"`
        EncryptedContent   string `json:"encrypted_content" gorm:"type:text;not null"`
        Nonce              string `json:"nonce" gorm:"type:varchar(64)"`
        KeyVersion         int    `json:"key_version" gorm:"default:1"`
        IsE2E              bool   `json:"is_e2e" gorm:"default:true"`
        PlaintextContent   string `json:"-" gorm:"type:text"`
        Read               bool   `json:"read" gorm:"default:false"`
}

func generateNonce() (string, error) {
        nonce := make([]byte, 24)
        if _, err := rand.Read(nonce); err != nil {
                return "", err
        }
        return base64.StdEncoding.EncodeToString(nonce), nil
}

func registerUserKeysHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var req struct {
                PublicKey           string `json:"public_key" binding:"required"`
                EncryptedPrivateKey string `json:"encrypted_private_key" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var existing UserKeyPair
        if err := db.Where("user_id = ?", userID).First(&existing).Error; err == nil {
                existing.PublicKey = req.PublicKey
                existing.EncryptedPrivateKey = req.EncryptedPrivateKey
                existing.KeyVersion++
                db.Save(&existing)
                c.JSON(http.StatusOK, gin.H{"message": "Keys updated", "key_version": existing.KeyVersion})
                return
        }

        keyPair := UserKeyPair{
                UserID:              userID,
                PublicKey:           req.PublicKey,
                EncryptedPrivateKey: req.EncryptedPrivateKey,
                KeyVersion:          1,
        }
        if err := db.Create(&keyPair).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store keys"})
                return
        }

        c.JSON(http.StatusCreated, gin.H{"message": "Keys registered", "key_version": 1})
}

func getUserPublicKeyHandler(c *gin.Context) {
        userID := c.Param("user_id")

        var keyPair UserKeyPair
        if err := db.Where("user_id = ?", userID).First(&keyPair).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User has no encryption keys"})
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "user_id":     keyPair.UserID,
                "public_key":  keyPair.PublicKey,
                "key_version": keyPair.KeyVersion,
                "algorithm":   keyPair.Algorithm,
        })
}

func getMyEncryptedPrivateKeyHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var keyPair UserKeyPair
        if err := db.Where("user_id = ?", userID).First(&keyPair).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No keys found"})
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "encrypted_private_key": keyPair.EncryptedPrivateKey,
                "public_key":            keyPair.PublicKey,
                "key_version":           keyPair.KeyVersion,
        })
}

func sendEncryptedDMHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var req struct {
                RecipientID      uint   `json:"recipient_id" binding:"required"`
                EncryptedContent string `json:"encrypted_content" binding:"required"`
                Nonce            string `json:"nonce" binding:"required"`
                KeyVersion       int    `json:"key_version"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        msg := EncryptedDirectMessage{
                SenderID:         userID,
                RecipientID:      req.RecipientID,
                EncryptedContent: req.EncryptedContent,
                Nonce:            req.Nonce,
                KeyVersion:       req.KeyVersion,
                IsE2E:            true,
        }
        if err := db.Create(&msg).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
                return
        }

        hub.sendToUser(fmt.Sprintf("%d", req.RecipientID), map[string]interface{}{
                "type":       "encrypted_dm",
                "message_id": msg.ID,
                "sender_id":  userID,
                "nonce":      req.Nonce,
        })

        c.JSON(http.StatusCreated, gin.H{"message_id": msg.ID})
}

func getEncryptedDMsHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        otherUserID := c.Param("user_id")

        var messages []EncryptedDirectMessage
        db.Where(
                "(sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
                userID, otherUserID, otherUserID, userID,
        ).Order("created_at desc").Limit(100).Find(&messages)

        c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func markMessagesReadHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        otherUserID := c.Param("user_id")

        result := db.Model(&EncryptedDirectMessage{}).
                Where("sender_id = ? AND recipient_id = ? AND read = false", otherUserID, userID).
                Update("read", true)

        if result.Error != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark messages as read"})
                return
        }

        db.Model(&Notification{}).
                Where("user_id = ? AND actor_id = ? AND type = ? AND is_read = false", userID, otherUserID, NotifTypeMessage).
                Update("is_read", true)

        hub.sendToUser(otherUserID, map[string]interface{}{
                "type":      "messages-read",
                "reader_id": userID,
        })

        c.JSON(http.StatusOK, gin.H{"marked_count": result.RowsAffected})
}

func getUnreadMessagesCountHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var counts []struct {
                SenderID uint `json:"sender_id"`
                Count    int  `json:"count"`
        }

        db.Model(&EncryptedDirectMessage{}).
                Select("sender_id, COUNT(*) as count").
                Where("recipient_id = ? AND read = false", userID).
                Group("sender_id").
                Scan(&counts)

        c.JSON(http.StatusOK, gin.H{"unread_counts": counts})
}

func grantAdminAccessHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var req struct {
                AdminUserID  uint   `json:"admin_user_id" binding:"required"`
                EncryptedKey string `json:"encrypted_key" binding:"required"`
                Reason       string `json:"reason"`
                ExpiresIn    int    `json:"expires_in_hours"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var admin User
        if err := db.First(&admin, req.AdminUserID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Admin user not found"})
                return
        }

        if admin.Role != "admin" && admin.Role != "super_admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Target user is not an admin"})
                return
        }

        permission := AdminAccessPermission{
                UserID:          userID,
                GrantedToUserID: req.AdminUserID,
                PermissionType:  "dm_read",
                EncryptedKey:    req.EncryptedKey,
                Reason:          req.Reason,
                GrantedAt:       time.Now(),
                IsActive:        true,
        }

        if req.ExpiresIn > 0 {
                expires := time.Now().Add(time.Duration(req.ExpiresIn) * time.Hour)
                permission.ExpiresAt = &expires
        }

        if err := db.Create(&permission).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to grant access"})
                return
        }

        c.JSON(http.StatusCreated, gin.H{
                "message":       "Admin access granted",
                "permission_id": permission.ID,
                "expires_at":    permission.ExpiresAt,
        })
}

func revokeAdminAccessHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        permissionID := c.Param("permission_id")

        var permission AdminAccessPermission
        if err := db.Where("id = ? AND user_id = ?", permissionID, userID).First(&permission).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found"})
                return
        }

        now := time.Now()
        permission.IsActive = false
        permission.RevokedAt = &now
        db.Save(&permission)

        c.JSON(http.StatusOK, gin.H{"message": "Admin access revoked"})
}

func getMyAdminPermissionsHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var permissions []AdminAccessPermission
        db.Where("user_id = ? AND is_active = ?", userID, true).
                Where("expires_at IS NULL OR expires_at > ?", time.Now()).
                Find(&permissions)

        c.JSON(http.StatusOK, gin.H{"permissions": permissions})
}

func getAdminAccessibleDMsHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        if user.Role != "admin" && user.Role != "super_admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
                return
        }

        var permissions []AdminAccessPermission
        db.Where("granted_to_user_id = ? AND is_active = ?", userID, true).
                Where("expires_at IS NULL OR expires_at > ?", time.Now()).
                Preload("User").
                Find(&permissions)

        type AccessibleConversation struct {
                UserID       uint   `json:"user_id"`
                Username     string `json:"username"`
                EncryptedKey string `json:"encrypted_key"`
                Reason       string `json:"reason"`
                GrantedAt    time.Time `json:"granted_at"`
        }

        var conversations []AccessibleConversation
        for _, p := range permissions {
                var u User
                db.First(&u, p.UserID)
                conversations = append(conversations, AccessibleConversation{
                        UserID:       p.UserID,
                        Username:     u.Username,
                        EncryptedKey: p.EncryptedKey,
                        Reason:       p.Reason,
                        GrantedAt:    p.GrantedAt,
                })
        }

        c.JSON(http.StatusOK, gin.H{"accessible_conversations": conversations})
}

func setChannelE2EHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        channelID := c.Param("channel_id")

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        var guild Guild
        if err := db.First(&guild, channel.GuildID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if guild.OwnerID != userID {
                c.JSON(http.StatusForbidden, gin.H{"error": "Only guild owner can enable E2E"})
                return
        }

        var req struct {
                E2EEnabled bool `json:"e2e_enabled"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var settings ChannelEncryptionSettings
        if err := db.Where("channel_id = ?", channelID).First(&settings).Error; err != nil {
                settings = ChannelEncryptionSettings{
                        ChannelID:  channel.ID,
                        E2EEnabled: req.E2EEnabled,
                }
                db.Create(&settings)
        } else {
                settings.E2EEnabled = req.E2EEnabled
                if req.E2EEnabled {
                        settings.GroupKeyVersion++
                }
                db.Save(&settings)
        }

        c.JSON(http.StatusOK, gin.H{
                "channel_id":        channel.ID,
                "e2e_enabled":       settings.E2EEnabled,
                "group_key_version": settings.GroupKeyVersion,
        })
}

func getChannelE2EStatusHandler(c *gin.Context) {
        channelID := c.Param("channel_id")

        var settings ChannelEncryptionSettings
        if err := db.Where("channel_id = ?", channelID).First(&settings).Error; err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "channel_id":  channelID,
                        "e2e_enabled": false,
                })
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "channel_id":        settings.ChannelID,
                "e2e_enabled":       settings.E2EEnabled,
                "group_key_version": settings.GroupKeyVersion,
        })
}

func distributeChannelGroupKeyHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        channelID := c.Param("channel_id")

        var channel Channel
        if err := db.First(&channel, channelID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
                return
        }

        var guild Guild
        if err := db.First(&guild, channel.GuildID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }

        if guild.OwnerID != userID {
                c.JSON(http.StatusForbidden, gin.H{"error": "Only guild owner can distribute keys"})
                return
        }

        var req struct {
                EncryptedKeys []struct {
                        UserID            uint   `json:"user_id"`
                        EncryptedGroupKey string `json:"encrypted_group_key"`
                } `json:"encrypted_keys"`
                KeyVersion int `json:"key_version"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        for _, key := range req.EncryptedKeys {
                groupKey := ChannelGroupKey{
                        ChannelID:         channel.ID,
                        UserID:            key.UserID,
                        EncryptedGroupKey: key.EncryptedGroupKey,
                        KeyVersion:        req.KeyVersion,
                }
                db.Where("channel_id = ? AND user_id = ?", channel.ID, key.UserID).Delete(&ChannelGroupKey{})
                db.Create(&groupKey)
        }

        c.JSON(http.StatusOK, gin.H{"message": "Group keys distributed", "count": len(req.EncryptedKeys)})
}

func getMyChannelGroupKeyHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        channelID := c.Param("channel_id")

        var groupKey ChannelGroupKey
        if err := db.Where("channel_id = ? AND user_id = ?", channelID, userID).
                Order("key_version desc").First(&groupKey).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "No group key found"})
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "encrypted_group_key": groupKey.EncryptedGroupKey,
                "key_version":         groupKey.KeyVersion,
        })
}

func getEncryptionStatusHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
                "dm_encryption":              "e2e",
                "group_channel_encryption":   "optional_e2e",
                "jarvis_chat_encryption":     "none_with_consent",
                "public_channel_encryption":  "none",
                "algorithm":                  "X25519-XSalsa20-Poly1305",
                "key_exchange":               "X25519",
        })
}
