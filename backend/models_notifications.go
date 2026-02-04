package main

import (
        "time"
)

type NotificationType string

const (
        NotifTypeMessage      NotificationType = "message"
        NotifTypeMention      NotificationType = "mention"
        NotifTypeFriendReq    NotificationType = "friend_request"
        NotifTypeFriendAccept NotificationType = "friend_accept"
        NotifTypeGuildInvite  NotificationType = "guild_invite"
        NotifTypeGuildJoin    NotificationType = "guild_join"
        NotifTypeAchievement  NotificationType = "achievement"
        NotifTypeLevelUp      NotificationType = "level_up"
        NotifTypeDailyReward  NotificationType = "daily_reward"
        NotifTypeGift         NotificationType = "gift"
        NotifTypeSystem       NotificationType = "system"
        NotifTypeLike         NotificationType = "like"
        NotifTypeComment      NotificationType = "comment"
        NotifTypeFollow       NotificationType = "follow"
)

type Notification struct {
        ID        uint             `json:"id" gorm:"primaryKey"`
        UserID    uint             `json:"user_id" gorm:"index;not null;index:idx_notifications_user_unread,priority:1"`
        Type      NotificationType `json:"type" gorm:"not null"`
        Title     string           `json:"title" gorm:"not null"`
        Content   string           `json:"content" gorm:"type:text"`
        Icon      *string          `json:"icon,omitempty"`
        ImageURL  *string          `json:"image_url,omitempty"`
        ActionURL *string          `json:"action_url,omitempty"`
        ActorID   *uint            `json:"actor_id,omitempty"`
        Actor     *User            `json:"actor,omitempty" gorm:"foreignKey:ActorID"`
        EntityID  *uint            `json:"entity_id,omitempty"`
        EntityType *string         `json:"entity_type,omitempty"`
        Data      *string          `json:"data,omitempty" gorm:"type:jsonb"`
        IsRead    bool             `json:"is_read" gorm:"default:false;index;index:idx_notifications_user_unread,priority:2"`
        ReadAt    *time.Time       `json:"read_at,omitempty"`
        CreatedAt time.Time        `json:"created_at" gorm:"index:idx_notifications_user_unread,priority:3,sort:desc"`
        UpdatedAt time.Time        `json:"updated_at"`
}

type NotificationPreferences struct {
        ID                    uint      `json:"id" gorm:"primaryKey"`
        UserID                uint      `json:"user_id" gorm:"uniqueIndex;not null"`
        Messages              bool      `json:"messages" gorm:"default:true"`
        Mentions              bool      `json:"mentions" gorm:"default:true"`
        FriendRequests        bool      `json:"friend_requests" gorm:"default:true"`
        GuildInvites          bool      `json:"guild_invites" gorm:"default:true"`
        Achievements          bool      `json:"achievements" gorm:"default:true"`
        DailyRewards          bool      `json:"daily_rewards" gorm:"default:true"`
        Gifts                 bool      `json:"gifts" gorm:"default:true"`
        System                bool      `json:"system" gorm:"default:true"`
        Likes                 bool      `json:"likes" gorm:"default:true"`
        Comments              bool      `json:"comments" gorm:"default:true"`
        Follows               bool      `json:"follows" gorm:"default:true"`
        SoundEnabled          bool      `json:"sound_enabled" gorm:"default:true"`
        DesktopNotifications  bool      `json:"desktop_notifications" gorm:"default:true"`
        EmailNotifications    bool      `json:"email_notifications" gorm:"default:false"`
        QuietHoursEnabled     bool      `json:"quiet_hours_enabled" gorm:"default:false"`
        QuietHoursStart       *string   `json:"quiet_hours_start,omitempty"`
        QuietHoursEnd         *string   `json:"quiet_hours_end,omitempty"`
        CreatedAt             time.Time `json:"created_at"`
        UpdatedAt             time.Time `json:"updated_at"`
}

type NotificationGroup struct {
        Type      NotificationType `json:"type"`
        Count     int64            `json:"count"`
        Unread    int64            `json:"unread"`
        LatestAt  time.Time        `json:"latest_at"`
}

func (n *Notification) ToResponse() map[string]interface{} {
        response := map[string]interface{}{
                "id":         n.ID,
                "user_id":    n.UserID,
                "type":       n.Type,
                "title":      n.Title,
                "content":    n.Content,
                "is_read":    n.IsRead,
                "created_at": n.CreatedAt,
        }

        if n.Icon != nil {
                response["icon"] = *n.Icon
        }
        if n.ImageURL != nil {
                response["image_url"] = *n.ImageURL
        }
        if n.ActionURL != nil {
                response["action_url"] = *n.ActionURL
        }
        if n.ActorID != nil {
                response["actor_id"] = *n.ActorID
        }
        if n.Actor != nil {
                response["actor"] = n.Actor.ToPublic()
        }
        if n.EntityID != nil {
                response["entity_id"] = *n.EntityID
        }
        if n.EntityType != nil {
                response["entity_type"] = *n.EntityType
        }
        if n.Data != nil {
                response["data"] = *n.Data
        }
        if n.ReadAt != nil {
                response["read_at"] = *n.ReadAt
        }

        return response
}

func CreateNotification(userID uint, notifType NotificationType, title, content string, opts ...func(*Notification)) (*Notification, error) {
        if !ShouldSendNotification(userID, notifType) {
                return nil, nil
        }

        notification := &Notification{
                UserID:  userID,
                Type:    notifType,
                Title:   title,
                Content: content,
        }

        for _, opt := range opts {
                opt(notification)
        }

        if err := db.Create(notification).Error; err != nil {
                return nil, err
        }

        db.Preload("Actor").First(notification, notification.ID)

        BroadcastToUser(userID, "notification", notification.ToResponse())

        return notification, nil
}

func WithActor(actorID uint) func(*Notification) {
        return func(n *Notification) {
                n.ActorID = &actorID
        }
}

func WithIcon(icon string) func(*Notification) {
        return func(n *Notification) {
                n.Icon = &icon
        }
}

func WithImage(imageURL string) func(*Notification) {
        return func(n *Notification) {
                n.ImageURL = &imageURL
        }
}

func WithAction(actionURL string) func(*Notification) {
        return func(n *Notification) {
                n.ActionURL = &actionURL
        }
}

func WithEntity(entityType string, entityID uint) func(*Notification) {
        return func(n *Notification) {
                n.EntityType = &entityType
                n.EntityID = &entityID
        }
}

func WithData(data string) func(*Notification) {
        return func(n *Notification) {
                n.Data = &data
        }
}

func ShouldSendNotification(userID uint, notifType NotificationType) bool {
        var prefs NotificationPreferences
        if db.Where("user_id = ?", userID).First(&prefs).RowsAffected == 0 {
                return true
        }

        switch notifType {
        case NotifTypeMessage:
                return prefs.Messages
        case NotifTypeMention:
                return prefs.Mentions
        case NotifTypeFriendReq, NotifTypeFriendAccept:
                return prefs.FriendRequests
        case NotifTypeGuildInvite, NotifTypeGuildJoin:
                return prefs.GuildInvites
        case NotifTypeAchievement, NotifTypeLevelUp:
                return prefs.Achievements
        case NotifTypeDailyReward:
                return prefs.DailyRewards
        case NotifTypeGift:
                return prefs.Gifts
        case NotifTypeSystem:
                return prefs.System
        case NotifTypeLike:
                return prefs.Likes
        case NotifTypeComment:
                return prefs.Comments
        case NotifTypeFollow:
                return prefs.Follows
        }

        return true
}

func GetUnreadCount(userID uint) int64 {
        var count int64
        db.Model(&Notification{}).Where("user_id = ? AND is_read = false", userID).Count(&count)
        return count
}

func MarkNotificationAsRead(notificationID, userID uint) error {
        now := time.Now()
        return db.Model(&Notification{}).
                Where("id = ? AND user_id = ?", notificationID, userID).
                Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}

func MarkAllNotificationsAsRead(userID uint) error {
        now := time.Now()
        return db.Model(&Notification{}).
                Where("user_id = ? AND is_read = false", userID).
                Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}

func DeleteNotification(notificationID, userID uint) error {
        return db.Where("id = ? AND user_id = ?", notificationID, userID).Delete(&Notification{}).Error
}

func DeleteAllNotifications(userID uint) error {
        return db.Where("user_id = ?", userID).Delete(&Notification{}).Error
}

func GetNotificationGroups(userID uint) ([]NotificationGroup, error) {
        var groups []NotificationGroup
        
        err := db.Model(&Notification{}).
                Select("type, COUNT(*) as count, SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread, MAX(created_at) as latest_at").
                Where("user_id = ?", userID).
                Group("type").
                Order("latest_at DESC").
                Scan(&groups).Error

        return groups, err
}
