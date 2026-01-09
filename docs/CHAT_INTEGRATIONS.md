# Chat Integrations Guide

## Overview

Nemaxks supports integration with multiple chat platforms, allowing you to receive and send messages from Telegram and VK (VKontakte) directly through the platform.

## Supported Platforms

### 1. Telegram Bot Integration

Integrate Telegram bots to receive messages from users and send responses.

#### Setup

1. Create a Telegram bot using [@BotFather](https://t.me/botfather)
2. Obtain your bot token from BotFather
3. Get your webhook URL (your server domain + `/webhooks/telegram`)

#### Configuration

```go
telegramService := integrations.NewTelegramService(
    db,
    "YOUR_BOT_TOKEN",
    "https://your-domain.com/webhooks/telegram",
)

// Set webhook
err := telegramService.SetWebhook()
```

#### Receiving Messages

Telegram will send incoming messages as HTTP POST requests to your webhook URL:

```json
{
  "update_id": 12345,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "John",
      "username": "john_doe"
    },
    "chat": {
      "id": -123456789,
      "type": "group",
      "title": "My Group"
    },
    "date": 1704067200,
    "text": "Hello bot!"
  }
}
```

#### Sending Messages

```go
err := telegramService.SendMessage("-123456789", "Hello! I received your message.")
```

#### Available Methods

- `SetWebhook()` - Configure webhook for receiving messages
- `HandleWebhook(data []byte)` - Process incoming webhook data
- `SendMessage(chatID, text string)` - Send message to a chat
- `GetChatMessages(chatID string, limit int)` - Retrieve message history
- `GetBotInfo()` - Get bot information

---

### 2. VK (VKontakte) Integration

Integrate with VK Community (group) to receive and send messages.

#### Setup

1. Create a VK Community (group) at https://vk.com
2. Get Community API token (Manage → API usage → Access tokens)
3. Enable Callback API in group settings
4. Set your webhook URL (your server domain + `/webhooks/vk`)

#### Configuration

```go
vkService := integrations.NewVKService(
    db,
    "YOUR_ACCESS_TOKEN",
    "YOUR_GROUP_ID",
    "YOUR_CONFIRMATION_KEY",
)
```

#### Handling Callbacks

VK sends three types of callbacks:

1. **Confirmation Request** (once on setup)
   ```json
   {"type": "confirmation", "group_id": 123456}
   ```
   Response should be your confirmation key

2. **Message Events**
   ```json
   {
     "type": "message_new",
     "object": {
       "id": 1,
       "user_id": 123456,
       "peer_id": 123456,
       "text": "Hello!",
       "date": 1704067200
     },
     "group_id": 654321
   }
   ```

#### Processing Callbacks

```go
response, err := vkService.HandleCallback(requestBody)
// Returns: "ok" for regular events, confirmation key for confirmation request
```

#### Sending Messages

```go
err := vkService.SendMessage("123456", "Hello from Nemaxks!")
```

#### Available Methods

- `VerifyCallback(body []byte, signature string) bool` - Verify callback signature
- `HandleCallback(data []byte)` - Process incoming callback
- `SendMessage(peerID, text string)` - Send message
- `GetUserInfo(userID string)` - Get user profile
- `GetChatMessages(peerID string, limit int)` - Retrieve messages
- `GetGroupInfo()` - Get group/community info

---

## Unified Message Format

All incoming messages are stored in a unified format:

```go
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
```

This allows you to query messages from all platforms together:

```go
// Get last 10 messages from any source
var messages []integrations.ChatMessage
db.Order("received_at DESC").Limit(10).Find(&messages)

// Get messages only from Telegram
db.Where("source = ?", "telegram").Find(&messages)

// Get messages from specific chat
db.Where("source = ? AND chat_id = ?", "vk", "123456").Find(&messages)
```

---

## Webhook Endpoints

### Telegram Webhook

```
POST /webhooks/telegram
Content-Type: application/json

Body: Telegram Update object (see Telegram Bot API docs)
```

### VK Webhook

```
POST /webhooks/vk
Content-Type: application/json

Body: VK Callback API object
X-Signature: HMAC-SHA256 signature (optional, for verification)
```

---

## Security Considerations

1. **Telegram**: Always verify webhook URLs and use HTTPS
2. **VK**: Verify callback signatures using `VerifyCallback()`
3. **Tokens**: Store API tokens in environment variables, never in code
4. **Rate Limiting**: Both platforms have rate limits - implement proper queuing
5. **Validation**: Validate all incoming data before processing

---

## Error Handling

Both services return detailed errors:

```go
if err := telegramService.SendMessage(chatID, text); err != nil {
    log.Printf("Failed to send Telegram message: %v", err)
    // Handle error: invalid chat ID, API issues, etc.
}
```

---

## Implementation Example

```go
// Initialize services
telegramSvc := integrations.NewTelegramService(db, telegramToken, webhookURL)
vkSvc := integrations.NewVKService(db, vkToken, groupID, confirmKey)

// In your HTTP handlers
func handleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
    body, _ := ioutil.ReadAll(r.Body)
    if err := telegramSvc.HandleWebhook(body); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.WriteHeader(http.StatusOK)
}

func handleVKWebhook(w http.ResponseWriter, r *http.Request) {
    body, _ := ioutil.ReadAll(r.Body)
    response, err := vkSvc.HandleCallback(body)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(response))
}
```

---

## Troubleshooting

### Messages Not Received

1. Verify webhook URL is accessible from the internet
2. Check bot/group API token validity
3. Ensure webhook is properly configured
4. Check server logs for errors

### Send Failures

1. Verify chat/peer ID format
2. Check API token permissions
3. Ensure chat ID is valid (negative for groups in Telegram)
4. Monitor API rate limits

### Performance

1. Use database indexing on `source`, `chat_id`, `user_id`
2. Implement message pagination for history retrieval
3. Use goroutines for concurrent message processing
4. Consider caching user information

---

## API Reference

For detailed API specifications:
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [VK Callback API Documentation](https://vk.com/dev/callback_api)
- [VK Messages API Documentation](https://vk.com/dev/messages_api)
