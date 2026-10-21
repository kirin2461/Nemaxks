package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Мосты во внешние мессенджеры (Telegram, MAX).
//
// Архитектура: для каждого пользователя с привязанным мессенджером
// создаётся приватный канал-мост в служебной гильдии "Интеграции".
// Входящие сообщения из мессенджера публикуются в канал от имени
// системного пользователя nebula_bridge; ответы пользователя в канале
// пересылаются обратно в мессенджер (см. hook в createChannelMessageHandler).

const (
	bridgeUsername  = "nebula_bridge"
	bridgeGuildName = "Интеграции"
)

// bridgeMeta — содержимое Channel.BridgeMeta (JSON).
type bridgeMeta struct {
	ChatID           int64  `json:"chat_id"`
	ExternalUsername string `json:"external_username,omitempty"`
	OwnerUserID      uint   `json:"owner_user_id,omitempty"`
}

// ensureBridgeInfrastructure идемпотентно создаёт системного пользователя
// nebula_bridge и приватную гильдию "Интеграции". Вызывается при старте
// (initDB). Повторный запуск ничего не дублирует.
func ensureBridgeInfrastructure() {
	if db == nil {
		return
	}

	bridgeUser, err := getBridgeUser()
	if err != nil {
		// Пароль — случайный bcrypt-хэш: логин под системным пользователем
		// невозможен и не нужен.
		securePassword := generateSecurePassword()
		hashedPassword, hashErr := bcrypt.GenerateFromPassword([]byte(securePassword), bcrypt.DefaultCost)
		if hashErr != nil {
			log.Printf("Bridge: ошибка хэширования пароля системного пользователя: %v", hashErr)
			return
		}
		displayName := "Nebula Bridge"
		bridgeUser = &User{
			Username:    bridgeUsername,
			DisplayName: &displayName,
			Password:    string(hashedPassword),
			Role:        "system",
		}
		if err := db.Create(bridgeUser).Error; err != nil {
			log.Printf("Bridge: не удалось создать пользователя %s: %v", bridgeUsername, err)
			return
		}
		log.Printf("Bridge: создан системный пользователь %s (id=%d)", bridgeUsername, bridgeUser.ID)
	}

	var guild Guild
	if err := db.Where("name = ? AND owner_id = ?", bridgeGuildName, bridgeUser.ID).First(&guild).Error; err != nil {
		guild = Guild{
			Name:      bridgeGuildName,
			OwnerID:   bridgeUser.ID,
			IsPrivate: true,
		}
		if err := db.Create(&guild).Error; err != nil {
			log.Printf("Bridge: не удалось создать гильдию %q: %v", bridgeGuildName, err)
			return
		}
		log.Printf("Bridge: создана гильдия %q (id=%d)", bridgeGuildName, guild.ID)
	}
}

// getBridgeUser возвращает системного пользователя-моста.
func getBridgeUser() (*User, error) {
	var user User
	if err := db.Where("username = ?", bridgeUsername).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// getBridgeGuild возвращает служебную гильдию "Интеграции".
func getBridgeGuild() (*Guild, error) {
	bridgeUser, err := getBridgeUser()
	if err != nil {
		return nil, fmt.Errorf("системный пользователь моста не найден: %w", err)
	}
	var guild Guild
	if err := db.Where("name = ? AND owner_id = ?", bridgeGuildName, bridgeUser.ID).First(&guild).Error; err != nil {
		return nil, fmt.Errorf("гильдия мостов не найдена: %w", err)
	}
	return &guild, nil
}

// getOrCreateBridgeChannel идемпотентно возвращает приватный канал-мост
// bridge-<type>-<userID> в гильдии "Интеграции". Владелец (userID) и
// системный пользователь добавляются в ChannelMember.
func getOrCreateBridgeChannel(userID uint, bridgeType string, meta string) (*Channel, error) {
	if db == nil {
		return nil, fmt.Errorf("база данных недоступна")
	}

	guild, err := getBridgeGuild()
	if err != nil {
		return nil, err
	}
	bridgeUser, err := getBridgeUser()
	if err != nil {
		return nil, err
	}

	channelName := fmt.Sprintf("bridge-%s-%d", bridgeType, userID)

	var channel Channel
	if err := db.Where("guild_id = ? AND name = ?", guild.ID, channelName).First(&channel).Error; err == nil {
		// Канал уже существует — обновляем метаданные (chat_id мог измениться).
		if meta != "" && channel.BridgeMeta != meta {
			db.Model(&channel).Update("bridge_meta", meta)
			channel.BridgeMeta = meta
		}
		return &channel, nil
	}

	description := fmt.Sprintf("Мост %s для пользователя #%d", bridgeType, userID)
	channel = Channel{
		GuildID:     guild.ID,
		Name:        channelName,
		Description: &description,
		Type:        "text",
		IsPrivate:   true,
		IsBridge:    true,
		BridgeType:  bridgeType,
		BridgeMeta:  meta,
	}
	if err := db.Create(&channel).Error; err != nil {
		return nil, fmt.Errorf("не удалось создать канал-мост: %w", err)
	}

	// Участники канала: владелец и системный пользователь-мост.
	for _, memberID := range []uint{userID, bridgeUser.ID} {
		var member ChannelMember
		if db.Where("channel_id = ? AND user_id = ?", channel.ID, memberID).First(&member).RowsAffected == 0 {
			db.Create(&ChannelMember{
				ChannelID: channel.ID,
				UserID:    memberID,
				Role:      "member",
				JoinedAt:  time.Now(),
			})
		}
	}

	log.Printf("Bridge: создан канал-мост %s (id=%d) для пользователя #%d", channelName, channel.ID, userID)
	return &channel, nil
}

// deliverBridgeMessage публикует входящее сообщение из внешнего мессенджера
// в канал-мост от имени системного пользователя и рассылает broadcast
// channel-message в том же формате, что createChannelMessageHandler.
func deliverBridgeMessage(channelID uint, fromLabel string, text string) {
	if db == nil {
		return
	}

	bridgeUser, err := getBridgeUser()
	if err != nil {
		log.Printf("Bridge: системный пользователь не найден, сообщение в канал %d не доставлено", channelID)
		return
	}

	content := SanitizeMessageContent(fmt.Sprintf("**[%s]** %s", fromLabel, text))

	msg := Message{
		ChannelID: channelID,
		AuthorID:  bridgeUser.ID,
		Content:   content,
	}
	if err := db.Create(&msg).Error; err != nil {
		log.Printf("Bridge: не удалось сохранить сообщение в канал %d: %v", channelID, err)
		return
	}

	messageResponse := map[string]interface{}{
		"id":          msg.ID,
		"channel_id":  msg.ChannelID,
		"author_id":   msg.AuthorID,
		"content":     msg.Content,
		"created_at":  msg.CreatedAt,
		"parent_id":   msg.ParentID,
		"reply_count": msg.ReplyCount,
		"author": map[string]interface{}{
			"id":           bridgeUser.ID,
			"username":     bridgeUser.Username,
			"display_name": bridgeUser.DisplayName,
			"avatar":       bridgeUser.Avatar,
		},
	}

	hub.broadcast <- map[string]interface{}{
		"type":       "channel-message",
		"channel_id": channelID,
		"message":    messageResponse,
	}
}

// forwardBridgeReply пересылает ответ пользователя из канала-моста во
// внешний мессенджер. Ошибки доставки публикуются в канал, чтобы
// пользователь видел, что ответ не ушёл.
func forwardBridgeReply(channel *Channel, senderUserID uint, text string) {
	if db == nil || channel == nil || !channel.IsBridge {
		return
	}

	bridgeUser, err := getBridgeUser()
	if err != nil || bridgeUser.ID == senderUserID {
		// Не пересылаем собственные сообщения моста (защита от петли).
		return
	}

	var meta bridgeMeta
	if err := json.Unmarshal([]byte(channel.BridgeMeta), &meta); err != nil || meta.ChatID == 0 {
		log.Printf("Bridge: некорректные метаданные канала %d: %v", channel.ID, err)
		deliverBridgeMessage(channel.ID, "Мост", "⚠️ Не удалось доставить ответ: повреждены настройки моста.")
		return
	}

	var sendErr error
	switch channel.BridgeType {
	case "telegram":
		sendErr = sendTelegramMessage(meta.ChatID, text)
	case "max":
		// Персональная модель: токен бота берём из MaxLink владельца канала.
		var link MaxLink
		if meta.OwnerUserID == 0 || db.Where("user_id = ?", meta.OwnerUserID).First(&link).RowsAffected == 0 || link.BotToken == "" {
			log.Printf("Bridge: нет привязки MAX для владельца #%d (канал %d)", meta.OwnerUserID, channel.ID)
			deliverBridgeMessage(channel.ID, "Мост", "⚠️ Не удалось доставить ответ: бот MAX не подключён. Подключите бота в настройках профиля (раздел «Интеграции»).")
			return
		}
		sendErr = sendMaxMessage(link.BotToken, meta.ChatID, text)
	default:
		log.Printf("Bridge: неизвестный тип моста %q (канал %d)", channel.BridgeType, channel.ID)
		return
	}

	if sendErr != nil {
		log.Printf("Bridge: ошибка доставки ответа из канала %d (%s): %v", channel.ID, channel.BridgeType, sendErr)
		deliverBridgeMessage(channel.ID, "Мост", "⚠️ Не удалось доставить ответ во внешний мессенджер. Попробуйте позже.")
	}
}
