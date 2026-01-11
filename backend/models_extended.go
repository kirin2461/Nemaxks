package main

import (
        "time"

        "github.com/lib/pq"
        "gorm.io/gorm"
)

// Users & Roles
type AdminRole struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        Name      string    `gorm:"unique;not null" json:"name"`
        CreatedAt time.Time `json:"created_at"`
}

type AdminUserRole struct {
        ID     uint `gorm:"primaryKey" json:"id"`
        UserID uint `gorm:"index" json:"user_id"`
        RoleID uint `gorm:"index" json:"role_id"`
}

type BanHistory struct {
        ID        uint       `gorm:"primaryKey" json:"id"`
        UserID    uint       `gorm:"index" json:"user_id"`
        Reason    string     `json:"reason"`
        BannedBy  uint       `json:"banned_by"`
        ExpiresAt *time.Time `json:"expires_at"`
        CreatedAt time.Time  `json:"created_at"`
}

type Ban struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"uniqueIndex" json:"user_id"`
        Reason    string    `json:"reason"`
        CreatedAt time.Time `json:"created_at"`
}

type BlockedUser struct {
        ID            uint      `gorm:"primaryKey" json:"id"`
        UserID        uint      `gorm:"index" json:"user_id"`
        BlockedUserID uint      `gorm:"index" json:"blocked_user_id"`
        CreatedAt     time.Time `json:"created_at"`
}

// Bot Management
type BotActivityLog struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        BotID     uint      `gorm:"index" json:"bot_id"`
        Action    string    `json:"action"`
        CreatedAt time.Time `json:"created_at"`
}

type BotRateLimit struct {
        ID         uint   `gorm:"primaryKey" json:"id"`
        BotID      uint   `gorm:"index" json:"bot_id"`
        Endpoint   string `json:"endpoint"`
        LimitCount int    `json:"limit_count"`
}

type BotToken struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        BotID     uint      `gorm:"index" json:"bot_id"`
        Token     string    `gorm:"unique;not null" json:"token"`
        CreatedAt time.Time `json:"created_at"`
}

type BotWebhook struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        BotID     uint      `gorm:"index" json:"bot_id"`
        URL       string    `json:"url"`
        Secret    string    `json:"secret"`
        CreatedAt time.Time `json:"created_at"`
}

type BotWebhookDelivery struct {
        ID         uint      `gorm:"primaryKey" json:"id"`
        WebhookID  uint      `gorm:"index" json:"webhook_id"`
        StatusCode int       `json:"status_code"`
        Payload    string    `gorm:"type:text" json:"payload"`
        CreatedAt  time.Time `json:"created_at"`
}

// Calls
type Call struct {
        ID        uint       `gorm:"primaryKey" json:"id"`
        ChannelID uint       `gorm:"index" json:"channel_id"`
        Status    string     `json:"status"` // ongoing, ended
        StartedAt time.Time  `json:"started_at"`
        EndedAt   *time.Time `json:"ended_at"`
}

type CallParticipant struct {
        ID       uint       `gorm:"primaryKey" json:"id"`
        CallID   uint       `gorm:"index" json:"call_id"`
        UserID   uint       `gorm:"index" json:"user_id"`
        JoinedAt time.Time  `json:"joined_at"`
        LeftAt   *time.Time `json:"left_at"`
}

type CallRecording struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        CallID    uint      `gorm:"index" json:"call_id"`
        URL       string    `json:"url"`
        CreatedAt time.Time `json:"created_at"`
}

type CallSignaling struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        CallID    uint      `gorm:"index" json:"call_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Data      string    `gorm:"type:text" json:"data"`
        CreatedAt time.Time `json:"created_at"`
}

// Channels & Members
type ChannelCategory struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        GuildID   uint      `gorm:"index" json:"guild_id"`
        Name      string    `json:"name"`
        Position  int       `gorm:"default:0" json:"position"`
        CreatedAt time.Time `json:"created_at"`
}

type ChannelInvitation struct {
        ID        uint       `gorm:"primaryKey" json:"id"`
        ChannelID uint       `gorm:"index" json:"channel_id"`
        InviterID uint       `json:"inviter_id"`
        Code      string     `gorm:"unique" json:"code"`
        ExpiresAt *time.Time `json:"expires_at"`
        CreatedAt time.Time  `json:"created_at"`
}

type ChannelMember struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        ChannelID uint      `gorm:"index" json:"channel_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Role      string    `json:"role"`
        JoinedAt  time.Time `json:"joined_at"`
}

// GuildMember represents membership of a user in a guild.
// Used by voice/LiveKit handlers for access checks.
type GuildMember struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        GuildID   uint      `gorm:"index" json:"guild_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Role      string    `gorm:"size:32;default:'member'" json:"role"`
        JoinedAt  time.Time `json:"joined_at"`
        CreatedAt time.Time `json:"created_at"`
        UpdatedAt time.Time `json:"updated_at"`
}

type ChannelMessageReaction struct {
        ID        uint   `gorm:"primaryKey" json:"id"`
        MessageID uint   `gorm:"index" json:"message_id"`
        UserID    uint   `gorm:"index" json:"user_id"`
        Emoji     string `json:"emoji"`
}

// Jarvis AI
type JarvisCommand struct {
        ID          uint   `gorm:"primaryKey" json:"id"`
        Name        string `gorm:"unique" json:"name"`
        Description string `json:"description"`
}

type JarvisContext struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Content   string    `gorm:"type:text" json:"content"`
        CreatedAt time.Time `json:"created_at"`
}

type JarvisReminder struct {
        ID                  uint      `gorm:"primaryKey" json:"id"`
        UserID              uint      `gorm:"index" json:"user_id"`
        Content             string    `json:"content"`
        RemindAt            time.Time `json:"remind_at"`
        IsSent              bool      `gorm:"default:false" json:"is_sent"`
        CreatedAt           time.Time `json:"created_at"`
}

type JarvisSession struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Token     string    `gorm:"unique" json:"token"`
        ExpiresAt time.Time `json:"expires_at"`
}

// Existing types (for consistency in models_extended.go)
type Friend struct {
        ID        uint           `gorm:"primaryKey" json:"id"`
        UserID    uint           `gorm:"index" json:"user_id"`
        FriendID  uint           `gorm:"index" json:"friend_id"`
        CreatedAt time.Time      `json:"created_at"`
        DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type FriendRequest struct {
        ID          uint      `gorm:"primaryKey" json:"id"`
        RequesterID uint      `gorm:"index" json:"requester_id"`
        AddresseeID uint      `gorm:"index" json:"addressee_id"`
        Status      string    `gorm:"size:16;default:'pending'" json:"status"`
        CreatedAt   time.Time `json:"created_at"`
}

type DirectMessage struct {
        ID              uint           `gorm:"primaryKey" json:"id"`
        SenderID        uint           `gorm:"index" json:"sender_id"`
        ReceiverID      uint           `gorm:"index" json:"receiver_id"`
        Content         string         `gorm:"type:text" json:"content"`
        Read            bool           `gorm:"default:false" json:"read"`
        Edited          bool           `gorm:"default:false" json:"edited"`
        ReplyToID       *uint          `gorm:"index" json:"reply_to_id"`
        ReplyTo         *DirectMessage `gorm:"foreignKey:ReplyToID" json:"reply_to,omitempty"`
        ForwardedFromID *uint          `gorm:"index" json:"forwarded_from_id"`
        VoiceURL        *string        `json:"voice_url"`
        VoiceDuration   int            `gorm:"default:0" json:"voice_duration"`
        IsPinned        bool           `gorm:"default:false" json:"is_pinned"`
        CreatedAt       time.Time      `json:"created_at"`
        UpdatedAt       time.Time      `json:"updated_at"`
        DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type MessageReaction struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        MessageID uint      `gorm:"index" json:"message_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Emoji     string    `gorm:"size:10" json:"emoji"`
        CreatedAt time.Time `json:"created_at"`
}

// Stories (24-hour disappearing content)
type Story struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Content   string    `gorm:"type:text" json:"content"`
        MediaURL  *string   `json:"media_url"`
        MediaType string    `gorm:"size:20" json:"media_type"`
        ViewCount int       `gorm:"default:0" json:"view_count"`
        ExpiresAt time.Time `gorm:"index" json:"expires_at"`
        CreatedAt time.Time `json:"created_at"`
}

type StoryView struct {
        ID       uint      `gorm:"primaryKey" json:"id"`
        StoryID  uint      `gorm:"index" json:"story_id"`
        ViewerID uint      `gorm:"index" json:"viewer_id"`
        ViewedAt time.Time `json:"viewed_at"`
}

type Video struct {
        ID          uint          `gorm:"primaryKey" json:"id"`
        AuthorID    uint          `gorm:"index" json:"author_id"`
        Title       string        `gorm:"size:255;not null" json:"title"`
        Description string        `gorm:"type:text" json:"description"`
        VideoURL    string        `gorm:"type:text;not null" json:"video_url"`
        Thumbnail   string        `gorm:"type:text" json:"thumbnail"`
        Duration    int           `gorm:"default:0" json:"duration"`
        Views       int           `gorm:"default:0" json:"views"`
        Likes       int           `gorm:"default:0" json:"likes"`
        Category    string        `gorm:"size:50" json:"category"`
        Tags        pq.StringArray `gorm:"type:text[]" json:"tags"`
        IsPublic    bool          `gorm:"default:true" json:"is_public"`
        CreatedAt   time.Time     `json:"created_at"`
        UpdatedAt   time.Time     `json:"updated_at"`
}

type VideoChapter struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        VideoID   uint      `gorm:"index" json:"video_id"`
        Title     string    `gorm:"size:255;not null" json:"title"`
        Timestamp int       `gorm:"not null" json:"timestamp"`
        Duration  int       `gorm:"default:0" json:"duration"`
        Summary   string    `gorm:"type:text" json:"summary"`
        SortOrder int       `gorm:"default:0" json:"sort_order"`
        CreatedAt time.Time `json:"created_at"`
}

type VideoLike struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        VideoID   uint      `gorm:"index" json:"video_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        CreatedAt time.Time `json:"created_at"`
}

type VideoBookmark struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        VideoID   uint      `gorm:"index" json:"video_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        CreatedAt time.Time `json:"created_at"`
}

// Post Ratings (5-star system)
type PostRating struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        PostID    uint      `gorm:"index" json:"post_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Rating    int       `gorm:"check:rating >= 1 AND rating <= 5" json:"rating"`
        CreatedAt time.Time `json:"created_at"`
}

type PostComment struct {
        ID        uint           `gorm:"primaryKey" json:"id"`
        PostID    uint           `gorm:"index" json:"post_id"`
        UserID    uint           `gorm:"index" json:"user_id"`
        Content   string         `gorm:"type:text;not null" json:"content"`
        ParentID  *uint          `gorm:"index" json:"parent_id"`
        CreatedAt time.Time      `json:"created_at"`
        UpdatedAt time.Time      `json:"updated_at"`
        DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type PostLike struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        PostID    uint      `gorm:"index" json:"post_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        CreatedAt time.Time `json:"created_at"`
}

type Subscription struct {
        ID          uint      `gorm:"primaryKey" json:"id"`
        FollowerID  uint      `gorm:"index" json:"follower_id"`
        FollowingID uint      `gorm:"index" json:"following_id"`
        CreatedAt   time.Time `json:"created_at"`
}

type PostBookmark struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        PostID    uint      `gorm:"index" json:"post_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        CreatedAt time.Time `json:"created_at"`
}

// User Presence & Status
type UserPresence struct {
        ID           uint      `gorm:"primaryKey" json:"id"`
        UserID       uint      `gorm:"uniqueIndex" json:"user_id"`
        Status       string    `gorm:"size:20;default:'offline'" json:"status"`
        LastSeenAt   time.Time `json:"last_seen_at"`
        CustomStatus *string   `json:"custom_status"`
        UpdatedAt    time.Time `json:"updated_at"`
}

type TypingIndicator struct {
        ID         uint      `gorm:"primaryKey" json:"id"`
        UserID     uint      `gorm:"index" json:"user_id"`
        ChannelID  *uint     `gorm:"index" json:"channel_id"`
        ChatUserID *uint     `gorm:"index" json:"chat_user_id"`
        StartedAt  time.Time `json:"started_at"`
}

type ReadReceipt struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        MessageID uint      `gorm:"index" json:"message_id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        ReadAt    time.Time `json:"read_at"`
}

// IP Bans & Security
type IPBan struct {
        ID        uint       `gorm:"primaryKey" json:"id"`
        IPAddress string     `gorm:"index;not null" json:"ip_address"`
        Reason    string     `json:"reason"`
        BannedBy  uint       `json:"banned_by"`
        ExpiresAt *time.Time `json:"expires_at"`
        CreatedAt time.Time  `json:"created_at"`
}

type AuditLog struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"index" json:"user_id"`
        Action    string    `gorm:"size:50" json:"action"`
        Target    string    `json:"target"`
        Details   string    `gorm:"type:text" json:"details"`
        IPAddress string    `json:"ip_address"`
        CreatedAt time.Time `json:"created_at"`
}

type AbuseReport struct {
        ID         uint       `gorm:"primaryKey" json:"id"`
        ReporterID uint       `gorm:"index" json:"reporter_id"`
        TargetType string     `gorm:"size:20" json:"target_type"`
        TargetID   uint       `json:"target_id"`
        Reason     string     `gorm:"type:text" json:"reason"`
        Status     string     `gorm:"size:20;default:'pending'" json:"status"`
        ReviewedBy *uint      `json:"reviewed_by"`
        ReviewedAt *time.Time `json:"reviewed_at"`
        CreatedAt  time.Time  `json:"created_at"`
}

// UserRequest - general user requests/reports to admins
type UserRequest struct {
        ID          uint       `gorm:"primaryKey" json:"id"`
        UserID      uint       `gorm:"index" json:"user_id"`
        User        User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
        Category    string     `gorm:"size:30;not null" json:"category"` // abuse, technical, feature_request, billing, other
        Subject     string     `gorm:"size:200;not null" json:"subject"`
        Description string     `gorm:"type:text" json:"description"`
        Priority    string     `gorm:"size:20;default:'normal'" json:"priority"` // low, normal, high
        Status      string     `gorm:"size:20;default:'pending'" json:"status"`  // pending, in_progress, resolved, rejected
        AdminNotes  string     `gorm:"type:text" json:"admin_notes,omitempty"`
        ReviewedBy  *uint      `json:"reviewed_by,omitempty"`
        ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
        CreatedAt   time.Time  `json:"created_at"`
        UpdatedAt   time.Time  `json:"updated_at"`
}

// Invite Links
type InviteLink struct {
        ID        uint       `gorm:"primaryKey" json:"id"`
        Code      string     `gorm:"unique;not null" json:"code"`
        GuildID   *uint      `gorm:"index" json:"guild_id"`
        ChannelID *uint      `gorm:"index" json:"channel_id"`
        CreatorID uint       `json:"creator_id"`
        MaxUses   *int       `json:"max_uses"`
        Uses      int        `gorm:"default:0" json:"uses"`
        ExpiresAt *time.Time `json:"expires_at"`
        CreatedAt time.Time  `json:"created_at"`
}

// User Notes
type UserNote struct {
        ID       uint      `gorm:"primaryKey" json:"id"`
        UserID   uint      `gorm:"index" json:"user_id"`
        TargetID uint      `gorm:"index" json:"target_id"`
        Note     string    `gorm:"type:text" json:"note"`
        CreatedAt time.Time `json:"created_at"`
        UpdatedAt time.Time `json:"updated_at"`
}

// File Attachments
type FileAttachment struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        MessageID uint      `gorm:"index" json:"message_id"`
        FileName  string    `json:"file_name"`
        FileSize  int64     `json:"file_size"`
        FileType  string    `json:"file_type"`
        URL       string    `json:"url"`
        CreatedAt time.Time `json:"created_at"`
}

// Pinned Messages
type PinnedMessage struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        ChannelID uint      `gorm:"index" json:"channel_id"`
        MessageID uint      `gorm:"index" json:"message_id"`
        PinnedBy  uint      `json:"pinned_by"`
        CreatedAt time.Time `json:"created_at"`
}

// Channel Permissions
type ChannelPermission struct {
        ID        uint  `gorm:"primaryKey" json:"id"`
        ChannelID uint  `gorm:"index" json:"channel_id"`
        RoleID    *uint `gorm:"index" json:"role_id"`
        UserID    *uint `gorm:"index" json:"user_id"`
        Allow     int64 `gorm:"default:0" json:"allow"`
        Deny      int64 `gorm:"default:0" json:"deny"`
}

type GuildRole struct {
        ID          uint   `gorm:"primaryKey" json:"id"`
        GuildID     uint   `gorm:"index" json:"guild_id"`
        Name        string `json:"name"`
        Color       string `gorm:"size:7" json:"color"`
        Position    int    `gorm:"default:0" json:"position"`
        Permissions int64  `gorm:"default:0" json:"permissions"`
        Mentionable bool   `gorm:"default:false" json:"mentionable"`
}

type GuildMemberRole struct {
        ID      uint `gorm:"primaryKey" json:"id"`
        GuildID uint `gorm:"index" json:"guild_id"`
        UserID  uint `gorm:"index" json:"user_id"`
        RoleID  uint `gorm:"index" json:"role_id"`
}

// User Settings Extended
type UserSettings struct {
        ID                    uint   `gorm:"primaryKey" json:"id"`
        UserID                uint   `gorm:"uniqueIndex" json:"user_id"`
        Language              string `gorm:"size:10;default:'ru'" json:"language"`
        Theme                 string `gorm:"size:20;default:'dark'" json:"theme"`
        Notifications         bool   `gorm:"default:true" json:"notifications"`
        SoundEnabled          bool   `gorm:"default:true" json:"sound_enabled"`
        NoiseReduction        bool   `gorm:"default:true" json:"noise_reduction"`
        VoiceActivation       bool   `gorm:"default:false" json:"voice_activation"`
        TelegramNotifications bool   `gorm:"default:false" json:"telegram_notifications"`
}

// Content Filtering
type ForbiddenWord struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        Word      string    `gorm:"uniqueIndex;not null" json:"word"`
        Category  string    `gorm:"size:50" json:"category"`
        IsRegex   bool      `gorm:"default:false" json:"is_regex"`
        AddedBy   uint      `json:"added_by"`
        CreatedAt time.Time `json:"created_at"`
}

type ForbiddenAttempt struct {
        ID               uint      `gorm:"primaryKey" json:"id"`
        UserID           uint      `gorm:"index" json:"user_id"`
        AttemptedContent string    `gorm:"type:text" json:"attempted_content"`
        MatchedWords     string    `gorm:"type:text" json:"matched_words"`
        Context          string    `gorm:"size:50" json:"context"`
        CreatedAt        time.Time `json:"created_at"`
}

// Telegram Integration
type TelegramLink struct {
        ID               uint       `gorm:"primaryKey" json:"id"`
        UserID           uint       `gorm:"uniqueIndex" json:"user_id"`
        TelegramID       int64      `gorm:"uniqueIndex" json:"telegram_id"`
        TelegramUsername string     `json:"telegram_username"`
        LinkCode         string     `gorm:"index" json:"link_code"`
        IsVerified       bool       `gorm:"default:false" json:"is_verified"`
        CreatedAt        time.Time  `json:"created_at"`
        VerifiedAt       *time.Time `json:"verified_at"`
}

type TelegramNotification struct {
        ID             uint      `gorm:"primaryKey" json:"id"`
        UserID         uint      `gorm:"index" json:"user_id"`
        Type           string    `gorm:"size:50" json:"type"`
        Content        string    `gorm:"type:text" json:"content"`
        SentToTelegram bool      `gorm:"default:false" json:"sent_to_telegram"`
        SentToSite     bool      `gorm:"default:false" json:"sent_to_site"`
        CreatedAt      time.Time `json:"created_at"`
}

// User Referrals
type UserReferral struct {
        ID          uint      `gorm:"primaryKey" json:"id"`
        UserID      uint      `gorm:"uniqueIndex" json:"user_id"`
        Code        string    `gorm:"uniqueIndex;not null" json:"code"`
        InviteCount int       `gorm:"default:0" json:"invite_count"`
        CreatedAt   time.Time `json:"created_at"`
}

type ReferralUse struct {
        ID            uint      `gorm:"primaryKey" json:"id"`
        ReferralID    uint      `gorm:"index" json:"referral_id"`
        InvitedUserID uint      `gorm:"uniqueIndex" json:"invited_user_id"`
        CreatedAt     time.Time `json:"created_at"`
}

// Premium Subscriptions
type PremiumPlan struct {
        ID           uint      `gorm:"primaryKey" json:"id"`
        Slug         string    `gorm:"uniqueIndex" json:"slug"`
        Name         string    `json:"name"`
        Description  string    `json:"description"`
        PriceRub     float64   `json:"price_rub"`
        BillingCycle string    `gorm:"size:20;default:'monthly'" json:"billing_cycle"` // monthly, quarterly, annual
        Features     string    `gorm:"type:text" json:"features"` // JSON array of features
        IsActive     bool      `gorm:"default:true" json:"is_active"`
        SortOrder    int       `gorm:"default:0" json:"sort_order"`
        CreatedAt    time.Time `json:"created_at"`
}

type UserPremium struct {
        ID                 uint       `gorm:"primaryKey" json:"id"`
        UserID             uint       `gorm:"uniqueIndex" json:"user_id"`
        PlanID             uint       `json:"plan_id"`
        Plan               PremiumPlan `gorm:"foreignKey:PlanID" json:"plan"`
        Status             string     `gorm:"default:'active'" json:"status"`
        CurrentPeriodStart time.Time  `json:"current_period_start"`
        CurrentPeriodEnd   time.Time  `json:"current_period_end"`
        AutoRenew          bool       `gorm:"default:true" json:"auto_renew"`
        CreatedAt          time.Time  `json:"created_at"`
        UpdatedAt          time.Time  `json:"updated_at"`
}

// Creator Donations
type CreatorDonation struct {
        ID          uint      `gorm:"primaryKey" json:"id"`
        FromUserID  *uint     `gorm:"index" json:"from_user_id"`
        ToUserID    uint      `gorm:"index" json:"to_user_id"`
        AmountRub   float64   `json:"amount_rub"`
        Message     string    `gorm:"type:text" json:"message"`
        Status      string    `gorm:"default:'pending'" json:"status"`
        PaymentID   string    `json:"payment_id"`
        CreatedAt   time.Time `json:"created_at"`
}

// Premium Subscription (active subscription for billing)
type PremiumSubscription struct {
        ID                   uint       `gorm:"primaryKey" json:"id"`
        UserID               uint       `gorm:"uniqueIndex" json:"user_id"`
        User                 User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
        PlanID               uint       `json:"plan_id"`
        Plan                 PremiumPlan `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
        Status               string     `gorm:"size:20;default:'active'" json:"status"` // active, cancelled, expired, past_due
        CurrentPeriodStart   time.Time  `json:"current_period_start"`
        CurrentPeriodEnd     time.Time  `json:"current_period_end"`
        AutoRenew            bool       `gorm:"default:true" json:"auto_renew"`
        CancelAtPeriodEnd    bool       `gorm:"default:false" json:"cancel_at_period_end"`
        CancelledAt          *time.Time `json:"cancelled_at,omitempty"`
        PaymentMethodID      string     `json:"payment_method_id,omitempty"` // YooKassa saved payment method
        CreatedAt            time.Time  `json:"created_at"`
        UpdatedAt            time.Time  `json:"updated_at"`
}

// Premium Transaction (payment history)
type PremiumTransaction struct {
        ID              uint       `gorm:"primaryKey" json:"id"`
        UserID          uint       `gorm:"index" json:"user_id"`
        User            User       `gorm:"foreignKey:UserID" json:"-"`
        SubscriptionID  *uint      `gorm:"index" json:"subscription_id,omitempty"`
        PlanID          uint       `json:"plan_id"`
        AmountRub       float64    `json:"amount_rub"`
        Currency        string     `gorm:"size:3;default:'RUB'" json:"currency"`
        Status          string     `gorm:"size:20;default:'pending'" json:"status"` // pending, succeeded, failed, refunded
        PaymentProvider string     `gorm:"size:30" json:"payment_provider"` // yookassa, manual_transfer
        ProviderPaymentID string   `json:"provider_payment_id,omitempty"`
        Description     string     `json:"description"`
        ConfirmationURL string     `json:"confirmation_url,omitempty"`
        CompletedAt     *time.Time `json:"completed_at,omitempty"`
        CreatedAt       time.Time  `json:"created_at"`
}


// ChannelTool represents an educational tool for channels (board/notebook)
type ChannelTool struct {
        ID        uint   `json:"id" gorm:"primaryKey"`
        ChannelID uint   `json:"channel_id"`
        ToolType  string `json:"tool_type"` // "board" or "notebook"
        Title     string `json:"title"`
        Content   string `json:"content"` // Stores content as JSON
        OwnerID   uint   `json:"owner_id"`
        VisibleTo string `json:"visible_to"` // "all", "moderators", "owner"
        CreatedAt int64  `json:"created_at"`
        UpdatedAt int64  `json:"updated_at"`
}

// Helper functions for real-time collaboration

// GetCurrentTimestamp returns current timestamp in milliseconds
func GetCurrentTimestamp() int64 {
                return time.Now().UnixNano() / int64(time.Millisecond)
        }

// SaveToolSnapshot saves a snapshot of tool state for version history
func SaveToolSnapshot(toolID uint, name string, description string, userID uint, changeType string) error {
                // TODO: Implement snapshot saving to database
                return nil
        }
