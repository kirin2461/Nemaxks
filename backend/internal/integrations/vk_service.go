package integrations

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"

	"gorm.io/gorm"
)

// VKService handles VK (VKontakte) integration
type VKService struct {
	db          *gorm.DB
	accessToken string
	groupID     string
	httpClient  *http.Client
	vkAPIBase   string
	confirmKey  string
}

// VKMessage represents incoming VK callback message
type VKMessage struct {
	Type   string `json:"type"`
	Object struct {
		ID      int64  `json:"id"`
		GroupID int64  `json:"group_id"`
		UserID  int64  `json:"user_id"`
		Text    string `json:"text"`
		Date    int64  `json:"date"`
		PeerID  int64  `json:"peer_id"`
	} `json:"object"`
	GroupID int64  `json:"group_id"`
	Secret  string `json:"secret"`
}

// VKResponse represents VK API response
type VKResponse struct {
	Response interface{} `json:"response"`
	Error    struct {
		ErrorCode int    `json:"error_code"`
		ErrorMsg  string `json:"error_msg"`
	} `json:"error"`
}

// NewVKService creates a new VK service
func NewVKService(db *gorm.DB, accessToken, groupID, confirmKey string) *VKService {
	return &VKService{
		db:          db,
		accessToken: accessToken,
		groupID:     groupID,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
		vkAPIBase:   "https://api.vk.com/method",
		confirmKey:  confirmKey,
	}
}

// VerifyCallback verifies VK callback signature
func (vs *VKService) VerifyCallback(body []byte, signature string) bool {
	h := hmac.New(sha256.New, []byte(vs.accessToken))
	h.Write(body)
	externHash := hex.EncodeToString(h.Sum(nil))
	return externHash == signature
}

// HandleCallback processes incoming VK callback
func (vs *VKService) HandleCallback(data []byte) (string, error) {
	var message VKMessage
	if err := json.Unmarshal(data, &message); err != nil {
		return "", fmt.Errorf("failed to unmarshal VK message: %w", err)
	}

	// Confirmation request
	if message.Type == "confirmation" {
		log.Printf("VK confirmation request received")
		return vs.confirmKey, nil
	}

	// Process message event
	if message.Type == "message_new" && message.Object.Text != "" {
		chatMsg := ChatMessage{
			Source:          "vk",
			SourceMessageID: fmt.Sprintf("%d", message.Object.ID),
			ChatID:          fmt.Sprintf("%d", message.Object.PeerID),
			UserID:          fmt.Sprintf("%d", message.Object.UserID),
			Content:         message.Object.Text,
			ReceivedAt:      time.Unix(message.Object.Date, 0),
		}

		// Save to database
		if err := vs.db.Create(&chatMsg).Error; err != nil {
			return "", fmt.Errorf("failed to save VK message: %w", err)
		}

		// Security: содержимое сообщения в логи не пишем — только метаданные
		log.Printf("VK message saved: user=%s, chat=%s, msg_id=%s, len=%d",
			chatMsg.UserID, chatMsg.ChatID, chatMsg.SourceMessageID, len(chatMsg.Content))
	}

	return "ok", nil
}

// SendMessage sends message via VK API
func (vs *VKService) SendMessage(peerID, text string) error {
	params := url.Values{}
	params.Add("access_token", vs.accessToken)
	params.Add("peer_id", peerID)
	params.Add("message", text)
	params.Add("random_id", fmt.Sprintf("%d", time.Now().UnixNano()))
	params.Add("v", "5.131")

	urlStr := fmt.Sprintf("%s/messages.send?%s", vs.vkAPIBase, params.Encode())

	resp, err := vs.httpClient.Get(urlStr)
	if err != nil {
		return fmt.Errorf("failed to send VK message: %w", err)
	}
	defer resp.Body.Close()

	var vkResp VKResponse
	if err := json.NewDecoder(resp.Body).Decode(&vkResp); err != nil {
		return fmt.Errorf("failed to decode VK response: %w", err)
	}

	if vkResp.Error.ErrorCode != 0 {
		return fmt.Errorf("VK API error: %s", vkResp.Error.ErrorMsg)
	}

	log.Printf("Message sent via VK to peer %s", peerID)
	return nil
}

// GetUserInfo retrieves VK user information
func (vs *VKService) GetUserInfo(userID string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Add("access_token", vs.accessToken)
	params.Add("user_ids", userID)
	params.Add("fields", "first_name,last_name,photo_100,online")
	params.Add("v", "5.131")

	urlStr := fmt.Sprintf("%s/users.get?%s", vs.vkAPIBase, params.Encode())

	resp, err := vs.httpClient.Get(urlStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get VK user info: %w", err)
	}
	defer resp.Body.Close()

	var vkResp VKResponse
	if err := json.NewDecoder(resp.Body).Decode(&vkResp); err != nil {
		return nil, fmt.Errorf("failed to decode VK response: %w", err)
	}

	if vkResp.Error.ErrorCode != 0 {
		return nil, fmt.Errorf("VK API error: %s", vkResp.Error.ErrorMsg)
	}

	data, _ := json.Marshal(vkResp.Response)
	var result map[string]interface{}
	json.Unmarshal(data, &result)

	return result, nil
}

// GetChatMessages retrieves messages from VK peer
func (vs *VKService) GetChatMessages(peerID string, limit int) ([]ChatMessage, error) {
	var messages []ChatMessage

	if err := vs.db.Where("source = ? AND chat_id = ?", "vk", peerID).
		Order("received_at DESC").
		Limit(limit).
		Find(&messages).Error; err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}

	return messages, nil
}

// GetGroupInfo retrieves VK group information
func (vs *VKService) GetGroupInfo() (map[string]interface{}, error) {
	params := url.Values{}
	params.Add("access_token", vs.accessToken)
	params.Add("group_id", vs.groupID)
	params.Add("fields", "members_count,status,description")
	params.Add("v", "5.131")

	urlStr := fmt.Sprintf("%s/groups.getById?%s", vs.vkAPIBase, params.Encode())

	resp, err := vs.httpClient.Get(urlStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get VK group info: %w", err)
	}
	defer resp.Body.Close()

	var vkResp VKResponse
	if err := json.NewDecoder(resp.Body).Decode(&vkResp); err != nil {
		return nil, fmt.Errorf("failed to decode VK response: %w", err)
	}

	if vkResp.Error.ErrorCode != 0 {
		return nil, fmt.Errorf("VK API error: %s", vkResp.Error.ErrorMsg)
	}

	data, _ := json.Marshal(vkResp.Response)
	var result map[string]interface{}
	json.Unmarshal(data, &result)

	return result, nil
}
