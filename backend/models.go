package main

import (
        "time"
)

// UserPublic represents the safe public view of a User (without password)
type UserPublic struct {
        ID        uint       `json:"id"`
        Username  string     `json:"username"`
        Email     *string    `json:"email,omitempty"`
        Avatar    *string    `json:"avatar,omitempty"`
        Status    string     `json:"status"`
        Bio       *string    `json:"bio,omitempty"`
        CreatedAt time.Time  `json:"created_at"`
        UpdatedAt time.Time  `json:"updated_at"`
        Role      string     `json:"role"`
        LastSeen  *time.Time `json:"last_seen,omitempty"`
        IsOnline  bool       `json:"is_online"`
}

type User struct {
        ID        uint       `json:"id" gorm:"primaryKey"`
        Username  string     `json:"username" gorm:"unique;not null"`
        Email     *string    `json:"email,omitempty" gorm:"unique"`
        Password  string     `json:"-" gorm:"not null"` // Hidden from JSON responses
        Avatar    *string    `json:"avatar,omitempty"`
        Status    string     `json:"status" gorm:"default:'offline'"`
        Bio       *string    `json:"bio,omitempty"`
        CreatedAt time.Time  `json:"created_at"`
        UpdatedAt time.Time  `json:"updated_at"`
        Role      string     `json:"role" gorm:"default:'user'"`
        LastSeen  *time.Time `json:"last_seen,omitempty"`
}

// ToPublic converts User to a safe public representation
func (u *User) ToPublic() UserPublic {
        isOnline := false
        if u.LastSeen != nil {
                isOnline = time.Since(*u.LastSeen) < 5*time.Minute
        }
        return UserPublic{
                ID:        u.ID,
                Username:  u.Username,
                Email:     u.Email,
                Avatar:    u.Avatar,
                Status:    u.Status,
                Bio:       u.Bio,
                CreatedAt: u.CreatedAt,
                UpdatedAt: u.UpdatedAt,
                Role:      u.Role,
                LastSeen:  u.LastSeen,
                IsOnline:  isOnline,
        }
}

type Guild struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        Name        string    `json:"name" gorm:"not null"`
        Description *string   `json:"description,omitempty"`
        Icon        *string   `json:"icon,omitempty"`
        OwnerID     uint      `json:"owner_id" gorm:"not null"`
        IsPrivate   bool      `json:"is_private" gorm:"default:false"`
        CreatedAt   time.Time `json:"created_at"`
        UpdatedAt   time.Time `json:"updated_at"`
        Owner       User      `json:"owner,omitempty" gorm:"foreignKey:OwnerID"`
}

type Channel struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        GuildID     uint      `json:"guild_id" gorm:"not null"`
        CategoryID  *uint     `json:"category_id,omitempty"`
        Name        string    `json:"name" gorm:"not null"`
        Description *string   `json:"description,omitempty"`
        Type        string    `json:"type" gorm:"default:'text'"`
        Position    int       `json:"position" gorm:"default:0"`
        IsPrivate   bool      `json:"is_private" gorm:"default:false"`
        CreatedAt   time.Time `json:"created_at"`
        UpdatedAt   time.Time `json:"updated_at"`
        Guild       Guild     `json:"guild,omitempty" gorm:"foreignKey:GuildID"`
}

type Message struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        ChannelID uint      `json:"channel_id" gorm:"not null"`
        AuthorID  uint      `json:"author_id" gorm:"not null"`
        Content   string    `json:"content" gorm:"type:text"`
        Edited    bool      `json:"edited" gorm:"default:false"`
        CreatedAt time.Time `json:"created_at"`
        UpdatedAt time.Time `json:"updated_at"`
        Channel   Channel   `json:"channel,omitempty" gorm:"foreignKey:ChannelID"`
        Author    User      `json:"author,omitempty" gorm:"foreignKey:AuthorID"`
}

type Post struct {
        ID        uint      `json:"id" gorm:"primaryKey"`
        AuthorID  uint      `json:"author_id" gorm:"not null"`
        Author    User      `json:"author,omitempty" gorm:"foreignKey:AuthorID"`
        Title     string    `json:"title" gorm:"not null"`
        Content   string    `json:"content" gorm:"not null"`
        Tags      []string  `json:"tags,omitempty" gorm:"type:text[]"`
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
        OpenAIKey            string    `json:"-"` // Hidden - sensitive API key
        DeepSeekKey          string    `json:"-"` // Hidden - sensitive API key
        HuggingFaceKey       string    `json:"-"` // Hidden - sensitive API key
        CreatedAt            time.Time `json:"created_at"`
        UpdatedAt            time.Time `json:"updated_at"`
}

type QRLoginSession struct {
        ID          uint      `json:"id" gorm:"primaryKey"`
        Token       string    `json:"token" gorm:"uniqueIndex;not null"`
        Status      string    `json:"status" gorm:"default:'pending'"` // pending, confirmed, expired
        UserID      *uint     `json:"user_id,omitempty"`
        User        *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
        ConfirmedBy *uint     `json:"confirmed_by,omitempty"`
        JWTToken    *string   `json:"-"` // Hidden from JSON for security
        ExpiresAt   time.Time `json:"expires_at"`
        CreatedAt   time.Time `json:"created_at"`
        UpdatedAt   time.Time `json:"updated_at"`
}
