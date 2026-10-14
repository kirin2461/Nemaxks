package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Интеграция с мессенджером MAX (https://platform-api.max.ru).
//
// Персональная модель: каждый пользователь Nebula подключает СВОЕГО бота MAX
// (POST /api/max/connect с токеном). Токен хранится в БД (MaxLink.BotToken)
// и никогда не отдаётся в JSON (json:"-").
//
// Авторизация MAX API — заголовком `Authorization: <token>`.
// Webhook: POST /api/max/webhook/:link_id, секрет проверяется из заголовка
// X-Max-Bot-Api-Secret или query-параметра ?secret= против MaxLink.WebhookSecret.
//
// Env:
//   MAX_API_BASE — база Bot API MAX (дефолт https://platform-api.max.ru).
//   PUBLIC_URL   — публичный адрес backend'а для webhook (дефолт http://82.114.226.204).

const (
	defaultMaxAPIBase = "https://platform-api.max.ru"
	defaultPublicURL  = "http://82.114.226.204"
)

// maxAPIBase возвращает базовый URL Bot API MAX.
func maxAPIBase() string {
	if base := strings.TrimRight(os.Getenv("MAX_API_BASE"), "/"); base != "" {
		return base
	}
	return defaultMaxAPIBase
}

// publicURL возвращает публичный адрес backend'а (для webhook URL).
func publicURL() string {
	if u := strings.TrimRight(os.Getenv("PUBLIC_URL"), "/"); u != "" {
		return u
	}
	return defaultPublicURL
}

// generateWebhookSecret генерирует 24 hex-символа для проверки webhook.
func generateWebhookSecret() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return generateSecurePassword()[:24]
	}
	return hex.EncodeToString(b)
}

// maxAPIRequest выполняет запрос к Bot API MAX с заголовком Authorization.
// Токен передаётся параметром (персональный бот пользователя).
func maxAPIRequest(method string, token string, path string, body interface{}) (*http.Response, error) {
	if token == "" {
		return nil, fmt.Errorf("токен бота MAX не задан")
	}

	var reader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest(method, maxAPIBase()+path, reader)
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

// sendMaxMessage отправляет сообщение в чат MAX от имени бота пользователя.
func sendMaxMessage(token string, chatID int64, text string) error {
	if token == "" {
		return errors.New("токен бота MAX не задан")
	}

	payload := map[string]interface{}{
		"text": text,
	}
	resp, err := maxAPIRequest(http.MethodPost, token, fmt.Sprintf("/messages?chat_id=%d", chatID), payload)
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

// maxWebhookURL строит URL webhook для конкретной привязки (секрет в query).
func maxWebhookURL(link *MaxLink) string {
	return fmt.Sprintf("%s/api/max/webhook/%d?secret=%s", publicURL(), link.ID, link.WebhookSecret)
}

// --- Подключение персонального бота (authMiddleware) ---

// connectMaxHandler обрабатывает POST /api/max/connect {bot_token}.
// Валидирует токен через GET /me, upsert'ит MaxLink и пытается
// автоматически установить webhook через POST /subscriptions.
func connectMaxHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var req struct {
		BotToken string `json:"bot_token"`
	}
	if err := c.BindJSON(&req); err != nil || strings.TrimSpace(req.BotToken) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите токен бота MAX"})
		return
	}
	token := strings.TrimSpace(req.BotToken)

	// Валидация токена: GET /me возвращает информацию о боте.
	resp, err := maxAPIRequest(http.MethodGet, token, "/me", nil)
	if err != nil {
		log.Printf("MAX connect: ошибка сети при запросе /me: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Не удалось связаться с MAX. Проверьте подключение к интернету и попробуйте позже."})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Токен не принят MAX: проверьте, что скопировали токен полностью и без лишних пробелов"})
		return
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("MAX connect: /me вернул %s: %s", resp.Status, string(body))
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Токен не принят MAX (код %d). Попробуйте позже или создайте новый токен.", resp.StatusCode)})
		return
	}

	var me struct {
		Name     string `json:"name"`
		Username string `json:"username"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
		log.Printf("MAX connect: не удалось разобрать ответ /me: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "MAX вернул неожиданный ответ. Попробуйте позже."})
		return
	}

	// Upsert MaxLink по user_id (идемпотентность: повторный connect обновляет запись).
	var link MaxLink
	err = db.Where("user_id = ?", uid).First(&link).Error
	if err != nil {
		link = MaxLink{
			UserID:    uid,
			CreatedAt: time.Now(),
		}
	}
	link.BotToken = token
	link.BotName = me.Name
	link.BotUsername = me.Username
	link.IsVerified = true
	if link.WebhookSecret == "" {
		link.WebhookSecret = generateWebhookSecret()
	}
	if link.ID == 0 {
		if err := db.Create(&link).Error; err != nil {
			log.Printf("MAX connect: не удалось сохранить привязку: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить подключение. Попробуйте позже."})
			return
		}
	} else {
		if err := db.Save(&link).Error; err != nil {
			log.Printf("MAX connect: не удалось обновить привязку: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить подключение. Попробуйте позже."})
			return
		}
	}

	// Авто-установка webhook. Ошибка НЕ откатывает подключение:
	// возвращаем webhook_set:false и warning с URL для ручной настройки.
	webhookURL := maxWebhookURL(&link)
	webhookSet := true
	warning := ""

	subPayload := map[string]interface{}{
		"url":          webhookURL,
		"update_types": []string{"message_created", "bot_started"},
	}
	subResp, err := maxAPIRequest(http.MethodPost, token, "/subscriptions", subPayload)
	if err != nil {
		log.Printf("MAX connect: ошибка сети при установке webhook: %v", err)
		webhookSet = false
		warning = "Не удалось связаться с MAX для автоматической настройки webhook."
	} else {
		defer subResp.Body.Close()
		if subResp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(subResp.Body)
			log.Printf("MAX connect: установка webhook отклонена (%s): %s", subResp.Status, string(body))
			webhookSet = false
			warning = "MAX отклонил адрес webhook (возможно, требуется HTTPS)."
		}
	}
	if !webhookSet {
		warning += " Укажите webhook вручную в кабинете бота MAX: " + webhookURL
	}

	response := gin.H{
		"connected":    true,
		"bot_name":     link.BotName,
		"bot_username": link.BotUsername,
		"webhook_url":  webhookURL,
		"webhook_set":  webhookSet,
	}
	if warning != "" {
		response["warning"] = warning
	}
	c.JSON(http.StatusOK, response)
}

// getMaxLinkHandler обрабатывает GET /api/max/link — статус подключения владельцу.
func getMaxLinkHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var link MaxLink
	if db.Where("user_id = ?", uid).First(&link).RowsAffected == 0 || link.BotToken == "" {
		c.JSON(http.StatusOK, gin.H{"connected": false})
		return
	}

	response := gin.H{
		"connected":      true,
		"bot_name":       link.BotName,
		"bot_username":   link.BotUsername,
		"webhook_url":    maxWebhookURL(&link),
		"webhook_secret": link.WebhookSecret, // владельцу — для ручной настройки в кабинете MAX
	}

	// Канал-мост bridge-max-<userID>, если уже создан.
	var channel Channel
	if db.Where("name = ? AND is_bridge = ? AND bridge_type = ?", fmt.Sprintf("bridge-max-%d", uid), true, "max").First(&channel).RowsAffected > 0 {
		response["bridge_channel_id"] = channel.ID
	}

	c.JSON(http.StatusOK, response)
}

// unlinkMaxHandler обрабатывает DELETE /api/max/link — отключение бота.
// Best-effort удаление подписки в MAX, затем удаление MaxLink.
// Канал-мост НЕ удаляется (история сообщений сохраняется).
func unlinkMaxHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(userID.(float64))

	var link MaxLink
	if db.Where("user_id = ?", uid).First(&link).RowsAffected == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "disconnected"})
		return
	}

	// Best-effort: удаляем webhook-подписку токеном пользователя.
	if link.BotToken != "" {
		webhookURL := maxWebhookURL(&link)
		resp, err := maxAPIRequest(http.MethodDelete, link.BotToken, "/subscriptions?url="+webhookURL, nil)
		if err != nil {
			log.Printf("MAX unlink: не удалось удалить подписку для user %d: %v", uid, err)
		} else {
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				body, _ := io.ReadAll(resp.Body)
				log.Printf("MAX unlink: удаление подписки вернуло %s: %s", resp.Status, string(body))
			}
		}
	}

	db.Delete(&link)
	c.JSON(http.StatusOK, gin.H{"status": "disconnected"})
}

// --- Команды бота (ответы от имени бота пользователя) ---

func handleMaxStart(token string, chatID int64) {
	message := `🎉 Бот подключён к Nebula!

Все сообщения, которые вы отправите сюда, будут доставлены в ваш канал-мост в Nebula, а ответы из Nebula вернутся сюда.

Доступные команды:
/start — Начать работу с ботом
/help — Показать справку
/status — Проверить статус подключения`

	if err := sendMaxMessage(token, chatID, message); err != nil {
		log.Printf("MAX bot_started: не удалось отправить приветствие в чат %d: %v", chatID, err)
	}
}

func handleMaxHelp(token string, chatID int64) {
	message := `📖 Справка по командам:

/start — Начать работу с ботом
/help — Показать эту справку
/status — Проверить статус подключения

Просто напишите сообщение — оно появится в Nebula. Ответьте в канале-мосте Nebula — сообщение придёт сюда.

Нужна помощь? Напишите в поддержку на платформе Nebula.`

	if err := sendMaxMessage(token, chatID, message); err != nil {
		log.Printf("MAX /help: не удалось отправить ответ в чат %d: %v", chatID, err)
	}
}

func handleMaxStatus(token string, chatID int64, link *MaxLink) {
	var user User
	db.First(&user, link.UserID)

	botName := link.BotName
	if botName == "" {
		botName = "—"
	}

	message := `📊 Статус подключения:

✅ Бот подключён к Nebula
🤖 Бот: ` + botName + `
👤 Пользователь: ` + user.Username + `

Сообщения из этого чата доставляются в ваш канал-мост в Nebula.`

	if err := sendMaxMessage(token, chatID, message); err != nil {
		log.Printf("MAX /status: не удалось отправить ответ в чат %d: %v", chatID, err)
	}
}

// handleMaxBridgeMessage доставляет обычное сообщение из MAX в канал-мост владельца.
func handleMaxBridgeMessage(link *MaxLink, chatID int64, name string, text string) {
	meta, _ := json.Marshal(bridgeMeta{
		ChatID:           chatID,
		ExternalUsername: name,
		OwnerUserID:      link.UserID,
	})

	channel, err := getOrCreateBridgeChannel(link.UserID, "max", string(meta))
	if err != nil {
		log.Printf("Bridge MAX: не удалось получить канал-мост для user %d: %v", link.UserID, err)
		if err := sendMaxMessage(link.BotToken, chatID, `⚠️ Не удалось доставить сообщение в Nebula. Попробуйте позже.`); err != nil {
			log.Printf("Bridge MAX: не удалось отправить ошибку в чат %d: %v", chatID, err)
		}
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

// maxWebhookHandler обрабатывает POST /api/max/webhook/:link_id.
// Проверяет секрет (?secret= или X-Max-Bot-Api-Secret) против MaxLink.WebhookSecret.
func maxWebhookHandler(c *gin.Context) {
	linkID, err := strconv.ParseUint(c.Param("link_id"), 10, 64)
	if err != nil || linkID == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var link MaxLink
	if db.First(&link, uint(linkID)).RowsAffected == 0 || link.BotToken == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	// Секрет из заголовка или query (секрет в URL подписки надёжнее —
	// MAX не всегда прокидывает произвольные заголовки).
	secret := c.GetHeader("X-Max-Bot-Api-Secret")
	if secret == "" {
		secret = c.Query("secret")
	}
	if link.WebhookSecret == "" || secret != link.WebhookSecret {
		log.Printf("MAX webhook rejected: invalid secret for link %d from %s", link.ID, c.ClientIP())
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
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
			handleMaxStart(link.BotToken, chatID)
		}

	case "message_created":
		text := update.Message.Body.Text
		chatID := update.Message.Recipient.ChatID
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

			switch command {
			case "/start":
				handleMaxStart(link.BotToken, chatID)
			case "/help":
				handleMaxHelp(link.BotToken, chatID)
			case "/status":
				handleMaxStatus(link.BotToken, chatID, &link)
			default:
				if err := sendMaxMessage(link.BotToken, chatID, `❓ Неизвестная команда.

Используйте /help для просмотра доступных команд.`); err != nil {
					log.Printf("MAX webhook: не удалось ответить в чат %d: %v", chatID, err)
				}
			}
		} else if len(text) > 0 {
			handleMaxBridgeMessage(&link, chatID, name, text)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
