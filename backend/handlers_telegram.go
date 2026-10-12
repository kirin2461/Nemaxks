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

func sendTelegramMessage(chatID int64, text string) error {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		log.Println("TELEGRAM_BOT_TOKEN not set")
		return nil
	}

	apiURL := "https://api.telegram.org/bot" + botToken + "/sendMessage"
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	}

	jsonPayload, _ := json.Marshal(payload)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		log.Printf("Failed to send Telegram message: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Telegram API returned non-OK status: %s", resp.Status)
	}
	return nil
}

func handleTelegramStart(chatID int64, username string) {
	message := `🎉 <b>Добро пожаловать в Nemaks Bot!</b>

Я помогу вам получать уведомления от платформы Nemaks прямо в Telegram.

<b>Доступные команды:</b>
/link <код> - Привязать аккаунт Nemaks
/unlink - Отвязать аккаунт
/status - Проверить статус привязки
/help - Показать справку

<b>Как привязать аккаунт:</b>
1. Откройте настройки в Nemaks
2. Перейдите в раздел "Telegram"
3. Нажмите "Получить код"
4. Отправьте команду: /link ВАШ_КОД`

	sendTelegramMessage(chatID, message)
}

func handleTelegramHelp(chatID int64) {
	message := `📖 <b>Справка по командам:</b>

/start - Начать работу с ботом
/link <код> - Привязать аккаунт Nemaks (код получите в настройках)
/unlink - Отвязать аккаунт от Telegram
/status - Проверить статус привязки
/help - Показать эту справку

<b>Что умеет бот:</b>
• Отправлять уведомления о новых сообщениях
• Уведомлять о новых подписчиках
• Сообщать о важных событиях

<b>Нужна помощь?</b>
Напишите в поддержку на платформе Nemaks.`

	sendTelegramMessage(chatID, message)
}

func handleTelegramLink(chatID int64, telegramID int64, username string, code string) {
	if code == "" {
		message := `❌ <b>Ошибка:</b> Укажите код привязки.

<b>Использование:</b> /link ВАШКОД

Получите код в настройках Nemaks → Telegram.`
		sendTelegramMessage(chatID, message)
		return
	}

	var link TelegramLink
	if db.Where("link_code = ? AND is_verified = ?", code, false).First(&link).RowsAffected == 0 {
		message := `❌ <b>Ошибка:</b> Неверный или просроченный код.

Получите новый код в настройках Nemaks → Telegram.`
		sendTelegramMessage(chatID, message)
		return
	}

	if time.Since(link.CreatedAt) > 5*time.Minute {
		db.Delete(&link)
		message := `❌ <b>Ошибка:</b> Код истёк.

Получите новый код в настройках Nemaks → Telegram.`
		sendTelegramMessage(chatID, message)
		return
	}

	var existingLink TelegramLink
	if db.Where("telegram_id = ? AND is_verified = ?", telegramID, true).First(&existingLink).RowsAffected > 0 {
		message := `⚠️ Этот Telegram аккаунт уже привязан к другому пользователю.

Используйте /unlink чтобы отвязать его.`
		sendTelegramMessage(chatID, message)
		return
	}

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
	} else {
		settings = UserSettings{
			UserID:                link.UserID,
			TelegramNotifications: true,
		}
		db.Create(&settings)
	}

	message := `✅ <b>Аккаунт успешно привязан!</b>

Теперь вы будете получать уведомления от Nemaks в Telegram.

Используйте /status для проверки статуса или /unlink для отвязки.`
	sendTelegramMessage(chatID, message)
}

func handleTelegramUnlink(chatID int64, telegramID int64) {
	var link TelegramLink
	if db.Where("telegram_id = ? AND is_verified = ?", telegramID, true).First(&link).RowsAffected == 0 {
		message := `⚠️ Ваш Telegram не привязан к аккаунту Nemaks.

Используйте /link <код> для привязки.`
		sendTelegramMessage(chatID, message)
		return
	}

	var settings UserSettings
	if db.Where("user_id = ?", link.UserID).First(&settings).RowsAffected > 0 {
		settings.TelegramNotifications = false
		db.Save(&settings)
	}

	db.Delete(&link)

	message := `✅ <b>Аккаунт отвязан!</b>

Вы больше не будете получать уведомления от Nemaks.

Чтобы снова привязать аккаунт, получите новый код в настройках.`
	sendTelegramMessage(chatID, message)
}

func handleTelegramStatus(chatID int64, telegramID int64) {
	var link TelegramLink
	if db.Where("telegram_id = ? AND is_verified = ?", telegramID, true).First(&link).RowsAffected == 0 {
		message := `📊 <b>Статус:</b> Не привязан

Ваш Telegram не привязан к аккаунту Nemaks.

Используйте /link <код> для привязки.`
		sendTelegramMessage(chatID, message)
		return
	}

	var user User
	db.First(&user, link.UserID)

	var settings UserSettings
	notificationsEnabled := false
	if db.Where("user_id = ?", link.UserID).First(&settings).RowsAffected > 0 {
		notificationsEnabled = settings.TelegramNotifications
	}

	notifStatus := "❌ Отключены"
	if notificationsEnabled {
		notifStatus = "✅ Включены"
	}

	verifiedAt := ""
	if link.VerifiedAt != nil {
		verifiedAt = link.VerifiedAt.Format("02.01.2006 15:04")
	}

	message := `📊 <b>Статус привязки:</b>

✅ <b>Привязан</b>
👤 Пользователь: ` + user.Username + `
📅 Дата привязки: ` + verifiedAt + `
🔔 Уведомления: ` + notifStatus + `

Используйте /unlink для отвязки аккаунта.`
	sendTelegramMessage(chatID, message)
}

func getTelegramWebhookHandler(c *gin.Context) {
	// Security: если задан TELEGRAM_WEBHOOK_SECRET, проверяем заголовок
	// X-Telegram-Bot-Api-Secret-Token (Telegram шлёт его при setWebhook
	// с secret_token). Без секрета endpoint принимает запросы от кого угодно.
	if secret := os.Getenv("TELEGRAM_WEBHOOK_SECRET"); secret != "" {
		if c.GetHeader("X-Telegram-Bot-Api-Secret-Token") != secret {
			log.Printf("Telegram webhook rejected: invalid secret token from %s", c.ClientIP())
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
	}

	var update struct {
		Message struct {
			From struct {
				ID        int64  `json:"id"`
				Username  string `json:"username"`
				FirstName string `json:"first_name"`
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
	chatID := update.Message.Chat.ID
	telegramID := update.Message.From.ID
	username := update.Message.From.Username

	if username == "" {
		username = update.Message.From.FirstName
	}

	if len(text) > 0 && text[0] == '/' {
		parts := splitCommand(text)
		command := parts[0]
		args := ""
		if len(parts) > 1 {
			args = parts[1]
		}

		switch command {
		case "/start":
			handleTelegramStart(chatID, username)
		case "/help":
			handleTelegramHelp(chatID)
		case "/link":
			handleTelegramLink(chatID, telegramID, username, args)
		case "/unlink":
			handleTelegramUnlink(chatID, telegramID)
		case "/status":
			handleTelegramStatus(chatID, telegramID)
		default:
			message := `❓ Неизвестная команда.

Используйте /help для просмотра доступных команд.`
			sendTelegramMessage(chatID, message)
		}
	} else if len(text) == 6 {
		handleTelegramLink(chatID, telegramID, username, text)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func splitCommand(text string) []string {
	parts := make([]string, 0, 2)
	spaceIndex := -1
	for i, ch := range text {
		if ch == ' ' {
			spaceIndex = i
			break
		}
	}
	if spaceIndex == -1 {
		parts = append(parts, text)
	} else {
		parts = append(parts, text[:spaceIndex])
		if spaceIndex+1 < len(text) {
			parts = append(parts, text[spaceIndex+1:])
		}
	}
	return parts
}

func setupTelegramWebhookHandler(c *gin.Context) {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "TELEGRAM_BOT_TOKEN not configured"})
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "FRONTEND_URL not configured"})
		return
	}

	webhookPath := "/api/1470"
	webhookURL := frontendURL + webhookPath

	apiURL := "https://api.telegram.org/bot" + botToken + "/setWebhook"
	payload := map[string]interface{}{
		"url": webhookURL,
	}

	// SECURITY: задайте env TELEGRAM_WEBHOOK_SECRET — он передаётся в
	// setWebhook (secret_token) и проверяется на каждом webhook-запросе
	// (заголовок X-Telegram-Bot-Api-Secret-Token), иначе любой, кто знает
	// путь /api/1470, может слать поддельные команды боту.
	if secret := os.Getenv("TELEGRAM_WEBHOOK_SECRET"); secret != "" {
		payload["secret_token"] = secret
	} else {
		log.Println("WARNING: TELEGRAM_WEBHOOK_SECRET not set — webhook endpoint is unauthenticated")
	}

	jsonPayload, _ := json.Marshal(payload)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set webhook: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Telegram API error", "details": result})
		return
	}

	log.Printf("Telegram webhook set to: %s", webhookURL)
	c.JSON(http.StatusOK, gin.H{
		"status":      "ok",
		"webhook_url": webhookURL,
		"result":      result,
	})
}

func getTelegramWebhookInfoHandler(c *gin.Context) {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "TELEGRAM_BOT_TOKEN not configured"})
		return
	}

	apiURL := "https://api.telegram.org/bot" + botToken + "/getWebhookInfo"
	resp, err := http.Get(apiURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get webhook info: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	c.JSON(http.StatusOK, result)
}

func setBotCommandsHandler(c *gin.Context) {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "TELEGRAM_BOT_TOKEN not configured"})
		return
	}

	commands := []map[string]string{
		{"command": "start", "description": "Начать работу с ботом"},
		{"command": "help", "description": "Показать справку по командам"},
		{"command": "link", "description": "Привязать аккаунт Nemaks (укажите код)"},
		{"command": "unlink", "description": "Отвязать аккаунт"},
		{"command": "status", "description": "Проверить статус привязки"},
	}

	apiURL := "https://api.telegram.org/bot" + botToken + "/setMyCommands"
	payload := map[string]interface{}{
		"commands": commands,
	}

	jsonPayload, _ := json.Marshal(payload)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set commands: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Telegram API error", "details": result})
		return
	}

	log.Println("Telegram bot commands set successfully")
	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"commands": commands,
		"result":   result,
	})
}
