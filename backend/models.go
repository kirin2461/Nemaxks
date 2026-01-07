package main

import (
	"time"
)

type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"unique;not null"`
	Email     string    `json:"email" gorm:"unique"`
	Password  string    `json:"password" gorm:"not null"`
	Avatar    *string   `json:"avatar"`
	Status    string    `json:"status" gorm:"default:'offline'"`
	Bio       *string   `json:"bio"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Role      string    `json:"role" gorm:"default:'user'"`
}

type Guild struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"not null"`
	Description *string   `json:"description"`
	Icon        *string   `json:"icon"`
	OwnerID     uint      `json:"owner_id" gorm:"not null"`
	IsPrivate   bool      `json:"is_private" gorm:"default:false"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Owner       User      `json:"owner" gorm:"foreignKey:OwnerID"`
}

type Channel struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	GuildID     uint      `json:"guild_id" gorm:"not null"`
	CategoryID  *uint     `json:"category_id"`
	Name        string    `json:"name" gorm:"not null"`
	Description *string   `json:"description"`
	Type        string    `json:"type" gorm:"default:'text'"`
	Position    int       `json:"position" gorm:"default:0"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Guild       Guild     `json:"guild" gorm:"foreignKey:GuildID"`
}

type Message struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ChannelID uint      `json:"channel_id" gorm:"not null"`
	AuthorID  uint      `json:"author_id" gorm:"not null"`
	Content   string    `json:"content" gorm:"type:text"`
	Edited    bool      `json:"edited" gorm:"default:false"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Channel   Channel   `json:"channel" gorm:"foreignKey:ChannelID"`
	Author    User      `json:"author" gorm:"foreignKey:AuthorID"`
}

type Post struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	AuthorID  uint      `json:"author_id" gorm:"not null"`
	Author    User      `json:"author" gorm:"foreignKey:AuthorID"`
	Content   string    `json:"content" gorm:"not null"`
	Tags      []string  `json:"tags" gorm:"type:text[]"`
	Likes     int       `json:"likes" gorm:"default:0"`
	Comments  int       `json:"comments" gorm:"default:0"`
	Shares    int       `json:"shares" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Settings struct {
	ID                   uint      `json:"id" gorm:"primaryKey"`
	UserID               uint      `json:"user_id" gorm:"uniqueIndex"`
	Theme                string    `json:"theme" gorm:"default:'cosmic'"`
	Language             string    `json:"language" gorm:"default:'en'"`
	NotificationsEnabled bool      `json:"notifications_enabled" gorm:"default:true"`
	SoundEnabled         bool      `json:"sound_enabled" gorm:"default:true"`
	VoiceEnabled         bool      `json:"voice_enabled" gorm:"default:true"`
	OpenAIKey            string    `json:"openai_key"`
	DeepSeekKey          string    `json:"deepseek_key"`
	HuggingFaceKey       string    `json:"huggingface_key"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type QRLoginSession struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Token       string    `json:"token" gorm:"uniqueIndex;not null"`
	Status      string    `json:"status" gorm:"default:'pending'"` // pending, confirmed, expired
	UserID      *uint     `json:"user_id"`
	User        *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
	ConfirmedBy *uint     `json:"confirmed_by"`
	JWTToken    *string   `json:"jwt_token,omitempty"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
