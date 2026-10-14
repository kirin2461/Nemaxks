package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

// Интеграция с мессенджером MAX (https://platform-api.max.ru).
//
// Авторизация API — заголовком `Authorization: <MAX_BOT_TOKEN>` (НЕ query!).
// Webhook: POST /api/max/webhook, секрет проверяется из заголовка
// X-Max-Bot-Api-Secret или query-параметра ?secret= (env MAX_WEBHOOK_SECRET).

const maxAPIBase = "https://platform-api.max.ru"

// maxAPIRequest выполняет запрос к Bot API MAX с заголовком Authorization.
func maxAPIRequest(method string, path string, body interface{}) (*http.Response, error) {
	token := os.Getenv("MAX_BOT_TOKEN")
	if token == "" {
		return nil, fmt.Errorf("MAX_BOT_TOKEN не задан")
	}

	var reader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest(method, maxAPIBase+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	return client.Do(req)
}

// sendMaxMessage отправляет сообщение в чат MAX.
func sendMaxMessage(chatID int64, text string) error {
	if os.Getenv("MAX_BOT_TOKEN") == "" {
		return errors.New("MAX_BOT_TOKEN not set")
	}

	payload := map[string]interface{}{
		"text": text,
	}
	resp, err := maxAPIRequest(http.MethodPost, fmt.Sprintf("/messages?chat_id=%d", chatID), payload)
	if err != nil {
		log.Printf("Failed to send MAX message: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("MAX API returned non-OK status: %s, body: %s", resp.Status, string(body))
		return fmt.Errorf("max API: %s", resp.Status)
	}
	return nil
}

// --- Привязка аккаунта (authMiddleware) ---

func getMaxLinkHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var link MaxLink
	if db.Where("user_id = ?", uid).First(&link).RowsAffected == 0 {
		c.JSON(http.StatusOK, gin.H{
			"linked": false,
			"max":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"linked":       link.IsVerified,
		"max_username": link.MaxUsername,
		"max_user_id":  link.MaxUserID,
		"verified_at":  link.VerifiedAt,
	})
}

func createMaxLinkHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var existingLink MaxLink
	if db.Where("user_id = ? AND is_verified = ?", uid, true).First(&existingLink).RowsAffected > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "MAX уже привязан"})
		return
	}

	code := generateLinkCode()

	link := MaxLink{
		UserID:    uid,
		LinkCode:  code,
		CreatedAt: time.Now(),
	}

	db.Where("user_id = ?", uid).Delete(&MaxLink{})
	db.Create(&link)

	botName := os.Getenv("MAX_BOT_NAME")
	if botName == "" {
		botName = "Nemaks"
	}

	c.JSON(http.StatusOK, gin.H{
		"code":       code,
		"bot_name":   botName,
		"expires_in": 300,
	})
}

func unlinkMaxHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	db.Where("user_id = ?", uid).Delete(&MaxLink{})

	c.JSON(http.StatusOK, gin.H{"status": "unlinked"})
}

// --- Команды бота ---

func handleMaxStart(chatID int64) {
	message := `🎉 Добро пожаловать в Nemaks Bot!

Я помогу вам получать сообщения и уведомления от платформы Nemaks прямо в MAX.

Доступные команды:
/link <код> — Привязать аккаунт Nemaks
/unlink — Отвязать аккаунт
/status — Проверить статус привязки
/help — Показать справку

Как привязать аккаунт:
1. Откройте настройки в Nemaks
2. Перейдите в раздел "MAX"
3. Нажмите "Получить код"
4. Отправьте команду: /link ВАШ_КОД`

	sendMaxMessage(chatID, message)
}

func handleMaxHelp(chatID int64) {
	message := `📖 Справка по командам:

/start — Начать работу с ботом
/link <код> — Привязать аккаунт Nemaks (код получите в настройках)
/unlink — Отвязать аккаунт от MAX
/status — Проверить статус привязки
/help — Показать эту справку

После привязки все ваши сообщения боту будут доставляться в Nebula, а ответы из Nebula — возвращаться сюда.

Нужна помощь? Напишите в поддержку на платформе Nemaks.`

	sendMaxMessage(chatID, message)
}

func handleMaxLink(chatID int64, maxUserID int64, username string, code string) {
	if code == "" {
		message := `❌ Ошибка: укажите код привязки.

Использование: /link ВАШКОД

Получите код в настройках Nemaks → MAX.`
		sendMaxMessage(chatID, message)
		return
	}

	var link MaxLink
	if db.Where("link_code = ? AND is_verified = ?", code, false).First(&link).RowsAffected == 0 {
		message := `❌ Ошибка: неверный или просроченный код.

Получите новый код в настройках Nemaks → MAX.`
		sendMaxMessage(chatID, message)
		return
	}

	if time.Since(link.CreatedAt) > 5*time.Minute {
		db.Delete(&link)
		message := `❌ Ошибка: код истёк.

Получите новый код в настройках Nemaks → MAX.`
		sendMaxMessage(chatID, message)
		return
	}

	var existingLink MaxLink
	if db.Where("max_user_id = ? AND is_verified = ?", maxUserID, true).First(&existingLink).RowsAffected > 0 {
		message := `⚠️ Этот аккаунт MAX уже привязан к другому пользователю.

Используйте /unlink чтобы отвязать его.`
		sendMaxMessage(chatID, message)
		return
	}

	now := time.Now()
	link.MaxUserID = maxUserID
	link.MaxUsername = username
	link.ChatID = chatID
	link.IsVerified = true
	link.VerifiedAt = &now
	db.Save(&link)

	message := `✅ Аккаунт успешно привязан!

Теперь ваши сообщения будут доставляться в Nebula, а ответы — возвращаться в MAX.

Используйте /status для проверки статуса или /unlink для отвязки.`
	sendMaxMessage(chatID, message)
}

func handleMaxUnlink(chatID int64, maxUserID int64) {
	var link MaxLink
	if db.Where("max_user_id = ? AND is_verified = ?", maxUserID, true).First(&link).RowsAffected == 0 {
		message := `⚠️ Ваш MAX не привязан к аккаунту Nemaks.

Используйте /link <код> для привязки.`
		sendMaxMessage(chatID, message)
		return
	}

	db.Delete(&link)

	message := `✅ Аккаунт отвязан!

Вы больше не будете получать сообщения от Nemaks.

Чтобы снова привязать аккаунт, получите новый код в настройках.`
	sendMaxMessage(chatID, message)
}

func handleMaxStatus(chatID int64, maxUserID int64) {
	var link MaxLink
	if db.Where("max_user_id = ? AND is_verified = ?", maxUserID, true).First(&link).RowsAffected == 0 {
		message := `📊 Статус: не привязан

Ваш MAX не привязан к аккаунту Nemaks.

Используйте /link <код> для привязки.`
		sendMaxMessage(chatID, message)
		return
	}

	var user User
	db.First(&user, link.UserID)

	verifiedAt := ""
	if link.VerifiedAt != nil {
		verifiedAt = link.VerifiedAt.Format("02.01.2006 15:04")
	}

	message := `📊 Статус привязки:

✅ Привязан
👤 Пользователь: ` + user.Username + `
📅 Дата привязки: ` + verifiedAt + `

Используйте /unlink для отвязки аккаунта.`
	sendMaxMessage(chatID, message)
}

// handleMaxBridgeMessage доставляет обычное сообщение из MAX в канал-мост.
func handleMaxBridgeMessage(chatID int64, maxUserID int64, name string, text string) {
	var link MaxLink
	if db.Where("max_user_id = ? AND is_verified = ?", maxUserID, true).First(&link).RowsAffected == 0 {
		sendMaxMessage(chatID, `Чтобы получать сообщения в Nebula, привяжите аккаунт: /link <код>. Код — в настройках профиля Nebula.`)
		return
	}

	// Обновляем chat_id, если MAX прислал другой (смена диалога).
	if link.ChatID != chatID {
		link.ChatID = chatID
		db.Save(&link)
	}

	meta, _ := json.Marshal(bridgeMeta{
		ChatID:           chatID,
		ExternalUsername: name,
		OwnerUserID:      link.UserID,
	})

	channel, err := getOrCreateBridgeChannel(link.UserID, "max", string(meta))
	if err != nil {
		log.Printf("Bridge MAX: не удалось получить канал-мост для user %d: %v", link.UserID, err)
		sendMaxMessage(chatID, `⚠️ Не удалось доставить сообщение в Nebula. Попробуйте позже.`)
		return
	}

	label := "MAX"
	if name != "" {
		label = "MAX " + name
	}
	deliverBridgeMessage(channel.ID, label, text)
}

// --- Webhook ---

// maxUpdate — гибкий разбор update от MAX. Поля omitempty, т.к. формат
// может отличаться между типами событий и версиями API.
type maxUpdate struct {
	UpdateType string `json:"update_type"`
	ChatID     int64  `json:"chat_id"` // для bot_started
	User       struct {
		UserID   int64  `json:"user_id"`
		Name     string `json:"name"`
		Username string `json:"username"`
	} `json:"user"` // для bot_started
	Message struct {
		Sender struct {
			UserID   int64  `json:"user_id"`
			Name     string `json:"name"`
			Username string `json:"username"`
		} `json:"sender"`
		Body struct {
			Text string `json:"text"`
		} `json:"body"`
		Recipient struct {
			ChatID int64 `json:"chat_id"`
		} `json:"recipient"`
	} `json:"message"`
}

func getMaxWebhookHandler(c *gin.Context) {
	// Security: если задан MAX_WEBHOOK_SECRET, принимаем его из заголовка
	// X-Max-Bot-Api-Secret ИЛИ из query ?secret= (секрет в URL подписки
	// надёжнее — MAX не всегда прокидывает произвольные заголовки).
	if secret := os.Getenv("MAX_WEBHOOK_SECRET"); secret != "" {
		if c.GetHeader("X-Max-Bot-Api-Secret") != secret && c.Query("secret") != secret {
			log.Printf("MAX webhook rejected: invalid secret from %s", c.ClientIP())
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
	}

	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}

	var update maxUpdate
	if err := json.Unmarshal(rawBody, &update); err != nil {
		log.Printf("MAX webhook: не удалось разобрать update: %v; raw body: %s", err, string(rawBody))
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}

	switch update.UpdateType {
	case "bot_started":
		chatID := update.ChatID
		if chatID == 0 {
			chatID = update.Message.Recipient.ChatID
		}
		if chatID != 0 {
			handleMaxStart(chatID)
		}

	case "message_created":
		text := update.Message.Body.Text
		chatID := update.Message.Recipient.ChatID
		maxUserID := update.Message.Sender.UserID
		name := update.Message.Sender.Username
		if name == "" {
			name = update.Message.Sender.Name
		}

		if chatID == 0 {
			log.Printf("MAX webhook: message_created без chat_id; raw body: %s", string(rawBody))
			break
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
				handleMaxStart(chatID)
			case "/help":
				handleMaxHelp(chatID)
			case "/link":
				handleMaxLink(chatID, maxUserID, name, args)
			case "/unlink":
				handleMaxUnlink(chatID, maxUserID)
			case "/status":
				handleMaxStatus(chatID, maxUserID)
			default:
				sendMaxMessage(chatID, `❓ Неизвестная команда.

Используйте /help для просмотра доступных команд.`)
			}
		} else if len(text) == 6 {
			handleMaxLink(chatID, maxUserID, name, text)
		} else if len(text) > 0 {
			handleMaxBridgeMessage(chatID, maxUserID, name, text)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// --- Административные роуты ---

func setupMaxWebhookHandler(c *gin.Context) {
	if os.Getenv("MAX_BOT_TOKEN") == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "MAX_BOT_TOKEN not configured"})
		return
	}

	var req struct {
		URL string `json:"url"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	webhookURL := req.URL
	if webhookURL == "" {
		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите url или настройте FRONTEND_URL"})
			return
		}
		webhookURL = frontendURL + "/api/max/webhook"
	}

	// Секрет вшиваем в URL подписки — MAX передаст его обратно как ?secret=.
	if secret := os.Getenv("MAX_WEBHOOK_SECRET"); secret != "" {
		webhookURL += "?secret=" + secret
	} else {
		log.Println("WARNING: MAX_WEBHOOK_SECRET not set — webhook endpoint is unauthenticated")
	}

	payload := map[string]interface{}{
		"url":          webhookURL,
		"update_types": []string{"message_created", "bot_started"},
	}

	resp, err := maxAPIRequest(http.MethodPost, "/subscriptions", payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set webhook: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MAX API error", "details": result})
		return
	}

	log.Printf("MAX webhook set to: %s", webhookURL)
	c.JSON(http.StatusOK, gin.H{
		"status":      "ok",
		"webhook_url": webhookURL,
		"result":      result,
	})
}

func getMaxWebhookInfoHandler(c *gin.Context) {
	if os.Getenv("MAX_BOT_TOKEN") == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "MAX_BOT_TOKEN not configured"})
		return
	}

	resp, err := maxAPIRequest(http.MethodGet, "/subscriptions", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get webhook info: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	c.JSON(http.StatusOK, result)
}

func getMaxBotInfoHandler(c *gin.Context) {
	if os.Getenv("MAX_BOT_TOKEN") == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "MAX_BOT_TOKEN not configured"})
		return
	}

	resp, err := maxAPIRequest(http.MethodGet, "/me", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get bot info: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	c.JSON(http.StatusOK, result)
}
