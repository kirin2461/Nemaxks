package main

import (
        "bytes"
        "crypto/rand"
        "encoding/hex"
        "encoding/json"
        "log"
        "net/http"
        "os"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

func generateLinkCode() string {
        bytes := make([]byte, 3)
        rand.Read(bytes)
        code := ""
        for _, b := range bytes {
                code += strconv.Itoa(int(b) % 10)
        }
        for len(code) < 6 {
                code = "0" + code
        }
        return code[:6]
}

func generateVerificationCode() string {
        bytes := make([]byte, 16)
        rand.Read(bytes)
        return hex.EncodeToString(bytes)[:6]
}

func getTelegramLinkHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var link TelegramLink
        if db.Where("user_id = ?", uid).First(&link).RowsAffected == 0 {
                c.JSON(http.StatusOK, gin.H{
                        "linked":   false,
                        "telegram": nil,
                })
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "linked":            link.IsVerified,
                "telegram_username": link.TelegramUsername,
                "telegram_id":       link.TelegramID,
                "verified_at":       link.VerifiedAt,
        })
}

func createTelegramLinkHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var existingLink TelegramLink
        if db.Where("user_id = ? AND is_verified = ?", uid, true).First(&existingLink).RowsAffected > 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Telegram already linked"})
                return
        }

        code := generateLinkCode()

        link := TelegramLink{
                UserID:    uid,
                LinkCode:  code,
                CreatedAt: time.Now(),
        }

        db.Where("user_id = ?", uid).Delete(&TelegramLink{})
        db.Create(&link)

        botUsername := os.Getenv("TELEGRAM_BOT_USERNAME")
        if botUsername == "" {
                botUsername = "JarvisNotesBot"
        }

        c.JSON(http.StatusOK, gin.H{
                "code":         code,
                "bot_username": botUsername,
                "expires_in":   300,
        })
}

func unlinkTelegramHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        db.Where("user_id = ?", uid).Delete(&TelegramLink{})

        var settings UserSettings
        if db.Where("user_id = ?", uid).First(&settings).RowsAffected > 0 {
                settings.TelegramNotifications = false
                db.Save(&settings)
        }

        c.JSON(http.StatusOK, gin.H{"status": "unlinked"})
}

func verifyTelegramLinkHandler(c *gin.Context) {
        var req struct {
                Code             string `json:"code" binding:"required"`
                TelegramID       int64  `json:"telegram_id" binding:"required"`
                TelegramUsername string `json:"telegram_username"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var link TelegramLink
        if db.Where("link_code = ? AND is_verified = ?", req.Code, false).First(&link).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Invalid or expired code"})
                return
        }

        if time.Since(link.CreatedAt) > 5*time.Minute {
                db.Delete(&link)
                c.JSON(http.StatusBadRequest, gin.H{"error": "Code expired"})
                return
        }

        now := time.Now()
        link.TelegramID = req.TelegramID
        link.TelegramUsername = req.TelegramUsername
        link.IsVerified = true
        link.VerifiedAt = &now
        db.Save(&link)

        var settings UserSettings
        if db.Where("user_id = ?", link.UserID).First(&settings).RowsAffected > 0 {
                settings.TelegramNotifications = true
                db.Save(&settings)
        }

        c.JSON(http.StatusOK, gin.H{
                "status":  "verified",
                "user_id": link.UserID,
        })
}

func updateTelegramSettingsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var req struct {
                TelegramNotifications bool `json:"telegram_notifications"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var settings UserSettings
        if db.Where("user_id = ?", uid).First(&settings).RowsAffected == 0 {
                settings = UserSettings{
                        UserID:                uid,
                        TelegramNotifications: req.TelegramNotifications,
                }
                db.Create(&settings)
        } else {
                settings.TelegramNotifications = req.TelegramNotifications
                db.Save(&settings)
        }

        c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func getNotificationsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset := (page - 1) * limit

        var notifications []TelegramNotification
        var total int64

        db.Model(&TelegramNotification{}).Where("user_id = ?", uid).Count(&total)
        db.Where("user_id = ?", uid).Offset(offset).Limit(limit).Order("created_at DESC").Find(&notifications)

        c.JSON(http.StatusOK, gin.H{
                "notifications": notifications,
                "total":         total,
                "page":          page,
                "limit":         limit,
        })
}

func createNotificationHandler(userID uint, notifType string, content string) {
        if db == nil {
                return
        }

        var settings UserSettings
        sendToTelegram := false
        if db.Where("user_id = ?", userID).First(&settings).RowsAffected > 0 {
                sendToTelegram = settings.TelegramNotifications
        }

        notification := TelegramNotification{
                UserID:         userID,
                Type:           notifType,
                Content:        content,
                SentToTelegram: sendToTelegram,
                SentToSite:     !sendToTelegram,
                CreatedAt:      time.Now(),
        }
        db.Create(&notification)

        if sendToTelegram {
                go sendTelegramNotification(userID, content)
        }
}

func sendTelegramNotification(userID uint, content string) {
        var link TelegramLink
        if db.Where("user_id = ? AND is_verified = ?", userID, true).First(&link).RowsAffected == 0 {
                return
        }

        botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
        if botToken == "" {
                log.Println("TELEGRAM_BOT_TOKEN not set")
                return
        }

        apiURL := "https://api.telegram.org/bot" + botToken + "/sendMessage"
        payload := map[string]interface{}{
                "chat_id": link.TelegramID,
                "text":    content,
        }

        jsonPayload, _ := json.Marshal(payload)
        resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonPayload))
        if err != nil {
                log.Printf("Failed to send Telegram notification: %v", err)
                return
        }
        defer resp.Body.Close()

        if resp.StatusCode != http.StatusOK {
                log.Printf("Telegram API returned non-OK status: %s", resp.Status)
        }
}

func getTelegramWebhookHandler(c *gin.Context) {
        var update struct {
                Message struct {
                        From struct {
                                ID       int64  `json:"id"`
                                Username string `json:"username"`
                        } `json:"from"`
                        Text string `json:"text"`
                        Chat struct {
                                ID int64 `json:"id"`
                        } `json:"chat"`
                } `json:"message"`
        }

        if err := c.BindJSON(&update); err != nil {
                c.JSON(http.StatusOK, gin.H{"status": "ok"})
                return
        }

        text := update.Message.Text
        telegramID := update.Message.From.ID
        username := update.Message.From.Username

        if len(text) == 6 {
                var link TelegramLink
                if db.Where("link_code = ? AND is_verified = ?", text, false).First(&link).RowsAffected > 0 {
                        if time.Since(link.CreatedAt) <= 5*time.Minute {
                                now := time.Now()
                                link.TelegramID = telegramID
                                link.TelegramUsername = username
                                link.IsVerified = true
                                link.VerifiedAt = &now
                                db.Save(&link)

                                var settings UserSettings
                                if db.Where("user_id = ?", link.UserID).First(&settings).RowsAffected > 0 {
                                        settings.TelegramNotifications = true
                                        db.Save(&settings)
                                }
                        }
                }
        }

        c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
