package integrations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"time"

	"gorm.io/gorm"
)

// TelegramService handles Telegram bot integration
type TelegramService struct {
	db              *gorm.DB
	botToken        string
	webhookURL      string
	httpClient      *http.Client
	telegramAPIBase string
}

// TelegramMessage represents incoming Telegram message
type TelegramMessage struct {
	UpdateID int64 `json:"update_id"`
	Message  struct {
		MessageID int64 `json:"message_id"`
		From      struct {
			ID        int64  `json:"id"`
			IsBot     bool   `json:"is_bot"`
			FirstName string `json:"first_name"`
			Username  string `json:"username"`
		} `json:"from"`
		Chat struct {
			ID        int64  `json:"id"`
			Title     string `json:"title"`
			Type      string `json:"type"`
			Username  string `json:"username"`
		} `json:"chat"`
		Date int64  `json:"date"`
		Text string `json:"text"`
	} `json:"message"`
}

// ChatMessage represents unified message format
type ChatMessage struct {
	ID              uint
	Source          string    // "telegram" or "vk"
	SourceMessageID string
	ChatID          string
	UserID          string
	Username        string
	Content         string
	ReceivedAt      time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// NewTelegramService creates a new Telegram service
func NewTelegramService(db *gorm.DB, botToken, webhookURL string) *TelegramService {
	return &TelegramService{
		db:              db,
		botToken:        botToken,
		webhookURL:      webhookURL,
		httpClient:      &http.Client{Timeout: 30 * time.Second},
		telegramAPIBase: "https://api.telegram.org",
	}
}

// SetWebhook sets webhook for Telegram bot
func (ts *TelegramService) SetWebhook(ctx string) error {
	url := fmt.Sprintf("%s/bot%s/setWebhook", ts.telegramAPIBase, ts.botToken)

	payload := map[string]string{
		"url": ts.webhookURL,
	}

	body, _ := json.Marshal(payload)
	resp, err := ts.httpClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to set webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("telegram api error: %s", string(data))
	}

	log.Printf("Telegram webhook set successfully: %s", ts.webhookURL)
	return nil
}

// HandleWebhook processes incoming Telegram webhook
func (ts *TelegramService) HandleWebhook(data []byte) error {
	var message TelegramMessage
	if err := json.Unmarshal(data, &message); err != nil {
		return fmt.Errorf("failed to unmarshal telegram message: %w", err)
	}

	// Skip if no message text
	if message.Message.Text == "" {
		return nil
	}

	// Create unified chat message
	chatMsg := ChatMessage{
		Source:          "telegram",
		SourceMessageID: fmt.Sprintf("%d", message.Message.MessageID),
		ChatID:          fmt.Sprintf("%d", message.Message.Chat.ID),
		UserID:          fmt.Sprintf("%d", message.Message.From.ID),
		Username:        message.Message.From.Username,
		Content:         message.Message.Text,
		ReceivedAt:      time.Unix(message.Message.Date, 0),
	}

	// Save to database
	if err := ts.db.Create(&chatMsg).Error; err != nil {
		return fmt.Errorf("failed to save telegram message: %w", err)
	}

	log.Printf("Telegram message saved: user=%s, chat=%s, content=%s",
		chatMsg.UserID, chatMsg.ChatID, chatMsg.Content)

	return nil
}

// SendMessage sends message via Telegram bot
func (ts *TelegramService) SendMessage(chatID, text string) error {
	url := fmt.Sprintf("%s/bot%s/sendMessage", ts.telegramAPIBase, ts.botToken)

	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	}

	body, _ := json.Marshal(payload)
	resp, err := ts.httpClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to send telegram message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("telegram api error: %s", string(data))
	}

	log.Printf("Message sent via Telegram to chat %s", chatID)
	return nil
}

// GetChatMessages retrieves messages from Telegram chat
func (ts *TelegramService) GetChatMessages(chatID string, limit int) ([]ChatMessage, error) {
	var messages []ChatMessage

	if err := ts.db.Where("source = ? AND chat_id = ?", "telegram", chatID).
		Order("received_at DESC").
		Limit(limit).
		Find(&messages).Error; err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}

	return messages, nil
}

// GetBotInfo retrieves Telegram bot information
func (ts *TelegramService) GetBotInfo() (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/bot%s/getMe", ts.telegramAPIBase, ts.botToken)

	resp, err := ts.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get bot info: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode bot info: %w", err)
	}

	return result, nil
}
