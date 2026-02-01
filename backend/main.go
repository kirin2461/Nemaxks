package main

import (
        "context"
        "log"
        "net/http"
        "os"
        "os/signal"
        "strings"
        "syscall"
        "time"

        "github.com/gin-contrib/cors"
        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

var db *gorm.DB

func main() {
        // godotenv.Load() // Not needed in Replit
        initDB()
        initPhase1()
        initPhase2()

        // Initialize Redis (optional, non-fatal)
        if os.Getenv("REDIS_URL") != "" {
                if err := InitRedis(); err != nil {
                        log.Printf("[DEGRADED MODE] Redis not available: %v", err)
                        log.Println("[DEGRADED MODE] Caching features disabled. Session persistence may be affected.")
                } else {
                        log.Println("[Redis] Successfully connected")
                        defer CloseRedis()
                }
        } else {
                log.Println("[DEGRADED MODE] Redis not configured. Caching and session persistence disabled.")
        }

        // Initialize LiveKit (optional, non-fatal)
        if os.Getenv("LIVEKIT_API_KEY") != "" {
                if err := InitLiveKit(); err != nil {
                        log.Printf("[DEGRADED MODE] LiveKit not configured: %v", err)
                        log.Println("[DEGRADED MODE] Advanced voice features disabled. Using WebRTC P2P fallback.")
                } else {
                        log.Println("[LiveKit] Successfully connected")
                }
        } else {
                log.Println("[DEGRADED MODE] LiveKit not configured. Using WebRTC P2P for voice channels.")
        }

        // Initialize Email Service
        InitEmailService()
        
        // Initialize Billing System
        InitBillingSystem()
        defer StopBillingSystem()

        // Initialize Jarvis MCP bridge
        log.Println("[*] Initializing Jarvis MCP bridge...")
        mcpCfg := MCPConfig{
                BinaryPath:         "../jarvis/jarvis",
                AllowedDirectories: []string{"./uploads", "./jsvoice", "./backend"},
                BlockedCommands:    []string{"execute-command"},
                Timeout:            30 * time.Second,
        }
        if err := InitJarvisMCP(mcpCfg); err != nil {
                log.Printf("[!] Jarvis MCP failed to start (non-fatal): %v\n", err)
        }
        defer func() {
                if jarvisMCP != nil {
                        jarvisMCP.stopProcess()
                }
        }()

        r := gin.Default()
        r.SetTrustedProxies(nil) // Trust all proxies for Replit reverse proxy

        // Configure CORS with proper origin restrictions
        corsConfig := cors.Config{
                AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
                AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "Cache-Control"},
                ExposeHeaders:    []string{"Content-Length"},
                MaxAge:           12 * time.Hour,
                AllowCredentials: true,
        }

        // Get allowed origins from environment or use defaults for development
        allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
        if allowedOrigins != "" {
                corsConfig.AllowOrigins = strings.Split(allowedOrigins, ",")
                log.Printf("CORS: Restricting to origins: %v", corsConfig.AllowOrigins)
        } else {
                // In development/Replit, allow the Replit domain and localhost
                replitDomain := os.Getenv("REPL_SLUG")
                replitOwner := os.Getenv("REPL_OWNER")
                if replitDomain != "" && replitOwner != "" {
                        corsConfig.AllowOrigins = []string{
                                "https://" + replitDomain + "." + replitOwner + ".repl.co",
                                "https://*.replit.dev",
                                "http://localhost:5000",
                                "http://127.0.0.1:5000",
                        }
                        corsConfig.AllowOriginFunc = func(origin string) bool {
                                // Allow Replit preview domains
                                return strings.Contains(origin, ".replit.dev") ||
                                        strings.Contains(origin, ".repl.co") ||
                                        strings.HasPrefix(origin, "http://localhost") ||
                                        strings.HasPrefix(origin, "http://127.0.0.1")
                        }
                        log.Println("CORS: Using Replit-compatible origins with dynamic matching")
                } else {
                        // In non-Replit environments, CORS must be explicitly configured
                        // Default to localhost only for development safety
                        corsConfig.AllowOriginFunc = func(origin string) bool {
                                return strings.HasPrefix(origin, "http://localhost") ||
                                        strings.HasPrefix(origin, "http://127.0.0.1")
                        }
                        log.Println("CORS: No CORS_ALLOWED_ORIGINS set and not in Replit environment.")
                        log.Println("CORS: Defaulting to localhost only. Set CORS_ALLOWED_ORIGINS for production!")
                }
        }

        r.Use(cors.New(corsConfig))

        // Security middleware
        r.Use(SecurityHeadersMiddleware())
        r.Use(HTTPSEnforcementMiddleware())

        r.NoRoute(func(c *gin.Context) {
                log.Printf("404 Not Found: %s %s from %s", c.Request.Method, c.Request.URL.Path, c.ClientIP())
                c.JSON(http.StatusNotFound, gin.H{"error": "Route not found"})
        })

        r.GET("/", func(c *gin.Context) {
                // In production with frontend, serve index.html; in dev, return API status
                if _, err := os.Stat("../frontend/dist/index.html"); err == nil {
                        c.File("../frontend/dist/index.html")
                        return
                }
                c.JSON(http.StatusOK, gin.H{
                        "status":  "ok",
                        "message": "Nemaks API Server",
                        "version": "1.0.0",
                })
        })

        r.GET("/health", func(c *gin.Context) {
                c.JSON(http.StatusOK, gin.H{"status": "ok"})
        })

        // Auth routes with rate limiting and account lockout to prevent brute force attacks
        r.POST("/api/auth/register", AuthRateLimitMiddleware(), registerHandler)
        r.POST("/api/auth/login", AuthRateLimitMiddleware(), AccountLockoutMiddleware(), loginHandler)
        r.POST("/api/auth/logout", authMiddleware(), logoutHandler)
        r.GET("/api/auth/me", authMiddleware(), meHandler)
        r.PUT("/api/users/me", authMiddleware(), updateMeHandler)
        
        // QR Login (10-minute expiration)
        r.POST("/api/auth/qr/generate", generateQRLoginHandler)
        r.GET("/api/auth/qr/status/:token", checkQRLoginStatusHandler)
        r.POST("/api/auth/qr/confirm/:token", authMiddleware(), confirmQRLoginHandler)

        // Two-Factor Authentication (2FA)
        r.POST("/api/auth/2fa/setup", authMiddleware(), setup2FAHandler)
        r.POST("/api/auth/2fa/verify-setup", authMiddleware(), verify2FASetupHandler)
        r.POST("/api/auth/2fa/disable", authMiddleware(), disable2FAHandler)
        r.GET("/api/auth/2fa/status", authMiddleware(), get2FAStatusHandler)
        r.POST("/api/auth/2fa/recovery-codes", authMiddleware(), regenerateRecoveryCodesHandler)
        r.POST("/api/auth/2fa/verify", verify2FALoginHandler)

        // Token Management (Refresh tokens, sessions)
        r.POST("/api/auth/refresh", refreshTokenHandler)
        r.POST("/api/auth/revoke", authMiddleware(), revokeTokenHandler)
        r.GET("/api/auth/sessions", authMiddleware(), getSessionsHandler)

        // E2E Encryption
        r.GET("/api/encryption/status", getEncryptionStatusHandler)
        r.POST("/api/encryption/keys", authMiddleware(), registerUserKeysHandler)
        r.GET("/api/encryption/keys/me", authMiddleware(), getMyEncryptedPrivateKeyHandler)
        r.GET("/api/encryption/keys/:user_id", authMiddleware(), getUserPublicKeyHandler)
        r.POST("/api/encryption/dm", authMiddleware(), sendEncryptedDMHandler)
        r.GET("/api/encryption/dm/:user_id", authMiddleware(), getEncryptedDMsHandler)
        r.POST("/api/encryption/dm/:user_id/read", authMiddleware(), markMessagesReadHandler)
        r.GET("/api/encryption/dm/unread-counts", authMiddleware(), getUnreadMessagesCountHandler)
        r.POST("/api/encryption/admin-access", authMiddleware(), grantAdminAccessHandler)
        r.DELETE("/api/encryption/admin-access/:permission_id", authMiddleware(), revokeAdminAccessHandler)
        r.GET("/api/encryption/admin-access/my", authMiddleware(), getMyAdminPermissionsHandler)
        r.GET("/api/encryption/admin-access/accessible", authMiddleware(), getAdminAccessibleDMsHandler)
        r.PUT("/api/channels/:channel_id/e2e", authMiddleware(), setChannelE2EHandler)
        r.GET("/api/channels/:channel_id/e2e", authMiddleware(), getChannelE2EStatusHandler)
        r.POST("/api/channels/:channel_id/group-keys", authMiddleware(), distributeChannelGroupKeyHandler)
        r.GET("/api/channels/:channel_id/group-key", authMiddleware(), getMyChannelGroupKeyHandler)

        // Guilds
        r.GET("/api/guilds", authMiddleware(), getGuildsHandler)
        r.POST("/api/guilds", authMiddleware(), createGuildHandler)
        r.GET("/api/guilds/view/:id", authMiddleware(), getGuildHandler)

        // Channels
        r.GET("/api/guilds/channels/:guild_id", authMiddleware(), getChannelsHandler)
        r.POST("/api/guilds/channels/:guild_id", authMiddleware(), createChannelHandler)

        // Channel CRUD
        r.GET("/api/channels/:channel_id", authMiddleware(), getChannelHandler)
        r.PUT("/api/channels/:channel_id", authMiddleware(), updateChannelHandler)
        r.DELETE("/api/channels/:channel_id", authMiddleware(), deleteChannelHandler)

        // Channel Members
        r.GET("/api/channels/:channel_id/members", authMiddleware(), getChannelMembersHandler)
        r.POST("/api/channels/:channel_id/members", authMiddleware(), addChannelMemberHandler)
        r.PUT("/api/channels/:channel_id/members/:member_id", authMiddleware(), updateChannelMemberHandler)
        r.DELETE("/api/channels/:channel_id/members/:member_id", authMiddleware(), removeChannelMemberHandler)

        // Channel Permissions
        r.GET("/api/channels/:channel_id/permissions", authMiddleware(), getChannelPermissionsHandler)
        r.POST("/api/channels/:channel_id/permissions", authMiddleware(), setChannelPermissionHandler)
        r.DELETE("/api/channels/:channel_id/permissions/:perm_id", authMiddleware(), deleteChannelPermissionHandler)

        // Channel Roles
        r.GET("/api/channels/:channel_id/roles", authMiddleware(), getChannelRolesHandler)

        // Channel Categories
        r.GET("/api/guild-categories/:guild_id", authMiddleware(), getChannelCategoriesHandler)
        r.POST("/api/guild-categories/:guild_id", authMiddleware(), createChannelCategoryHandler)
        r.PUT("/api/categories/:category_id", authMiddleware(), updateChannelCategoryHandler)
        r.DELETE("/api/categories/:category_id", authMiddleware(), deleteChannelCategoryHandler)

        // Channel Reordering
        r.PUT("/api/guild-channels/:guild_id/reorder", authMiddleware(), reorderChannelsHandler)

        // Messages
        r.GET("/api/channels/:channel_id/messages", authMiddleware(), getMessagesByChannelHandler)
        r.POST("/api/channels/:channel_id/messages", authMiddleware(), createChannelMessageHandler)

        // Voice Channel Participants
        r.GET("/api/voice/channels/:channel_id/participants", authMiddleware(), GetVoiceChannelParticipants)

        // LiveKit Voice Integration
        r.POST("/api/livekit/token", authMiddleware(), getLiveKitTokenHandler)
        r.POST("/api/livekit/leave/:channel_id", authMiddleware(), leaveLiveKitRoomHandler)

        // RTC/WebRTC Configuration
        r.GET("/api/rtc/ice-servers", authMiddleware(), getICEServersHandler)

        r.GET("/ws", handleWSConnection)

        // Posts
        r.GET("/api/posts", getPostsHandler)
        r.POST("/api/posts", authMiddleware(), createPostHandler)
        r.PUT("/api/posts/:id", authMiddleware(), updatePostHandler)
        r.DELETE("/api/posts/:id", authMiddleware(), deletePostHandler)
        r.GET("/api/posts/tags/popular", getPopularTagsHandler)
        r.GET("/api/settings", authMiddleware(), getUserSettingsHandler)
        r.PUT("/api/settings", authMiddleware(), updateUserSettingsHandler)

        // Friends API
        r.GET("/api/friends", authMiddleware(), getFriendsHandler)
        r.POST("/api/friends/request", authMiddleware(), sendFriendRequestHandler)
        r.PUT("/api/friends/request/:id", authMiddleware(), respondFriendRequestHandler)
        r.DELETE("/api/friends/request/:id", authMiddleware(), cancelFriendRequestHandler)
        r.DELETE("/api/friends/:id", authMiddleware(), deleteFriendHandler)
        r.GET("/api/friends/blocked", authMiddleware(), getBlockedUsersHandler)
        r.POST("/api/friends/block", authMiddleware(), blockUserHandler)
        r.DELETE("/api/friends/block/:id", authMiddleware(), unblockUserHandler)

        // Direct Messages API
        r.GET("/api/messages/conversations", authMiddleware(), getConversationsHandler)
        r.POST("/api/messages", authMiddleware(), createMessageHandler)
        r.GET("/api/messages/with/:user_id", authMiddleware(), getUserMessagesHandler)
        r.PUT("/api/messages/update/:message_id", authMiddleware(), updateMessageHandler)
        r.DELETE("/api/messages/delete/:message_id", authMiddleware(), deleteMessageHandler)
        r.GET("/api/messages/search", authMiddleware(), searchMessagesHandler)
        r.POST("/api/messages/forward", authMiddleware(), forwardMessageHandler)
        r.POST("/api/messages/pin/:message_id", authMiddleware(), pinDirectMessageHandler)
        r.GET("/api/messages/pinned/:user_id", authMiddleware(), getPinnedDirectMessagesHandler)

        // Jarvis AI routes
        r.POST("/api/jarvis/chat/ollama", HandleJarvisChat) // Simplified mapping for now
        r.POST("/api/jarvis/chat/deepseek", HandleJarvisChat)
        r.POST("/api/jarvis/chat/auto", HandleJarvisChat)
        r.POST("/api/jarvis/chat", HandleJarvisChat)
        r.GET("/api/jarvis/status", HandleJarvisStatus)

        // Stories API
        r.GET("/api/stories", authMiddleware(), getStoriesHandler)
        r.POST("/api/stories", authMiddleware(), createStoryHandler)
        r.POST("/api/stories/:id/view", authMiddleware(), viewStoryHandler)
        r.DELETE("/api/stories/:id", authMiddleware(), deleteStoryHandler)

        // Videos
        r.GET("/api/videos", getVideosHandler)
        r.GET("/api/videos/:id", getVideoHandler)
        r.POST("/api/videos", authMiddleware(), createVideoHandler)
        r.PUT("/api/videos/:id", authMiddleware(), updateVideoHandler)
        r.DELETE("/api/videos/:id", authMiddleware(), deleteVideoHandler)
        r.POST("/api/videos/:id/like", authMiddleware(), likeVideoHandler)
        r.DELETE("/api/videos/:id/like", authMiddleware(), unlikeVideoHandler)
        r.POST("/api/videos/:id/bookmark", authMiddleware(), bookmarkVideoHandler)
        r.DELETE("/api/videos/:id/bookmark", authMiddleware(), unbookmarkVideoHandler)
        r.GET("/api/videos/:id/chapters", getVideoChaptersHandler)
        r.POST("/api/videos/:id/view", incrementVideoViewHandler)

        // Post Ratings & Comments
        r.POST("/api/posts/:id/rate", authMiddleware(), ratePostHandler)
        r.GET("/api/posts/:id/rating", getPostRatingHandler)
        r.GET("/api/posts/:id/comments", getPostCommentsHandler)
        r.POST("/api/posts/:id/comments", authMiddleware(), createCommentHandler)
        r.DELETE("/api/comments/:id", authMiddleware(), deleteCommentHandler)

        // Post Likes
        r.POST("/api/posts/:id/like", authMiddleware(), likePostHandler)
        r.DELETE("/api/posts/:id/like", authMiddleware(), unlikePostHandler)

        // Post Bookmarks
        r.POST("/api/posts/:id/bookmark", authMiddleware(), bookmarkPostHandler)
        r.DELETE("/api/posts/:id/bookmark", authMiddleware(), unbookmarkPostHandler)

        // User Profile
        r.GET("/api/users/:id/profile", optionalAuthMiddleware(), getUserProfileHandler)
        r.GET("/api/users/:id/stats", getUserStatsHandler)

        // Subscriptions (Follow)
        r.GET("/api/subscriptions", authMiddleware(), getSubscriptionsHandler)
        r.POST("/api/users/:id/subscribe", authMiddleware(), subscribeHandler)
        r.DELETE("/api/users/:id/subscribe", authMiddleware(), unsubscribeHandler)
        r.GET("/api/users/:id/subscribers", getSubscribersHandler)

        // Premium & Donations
        r.GET("/api/premium/plans", getPremiumPlansHandler)
        r.GET("/api/premium/subscription", authMiddleware(), getPremiumSubscriptionHandler)
        r.POST("/api/premium/checkout", authMiddleware(), checkoutPremiumHandler)
        r.POST("/api/premium/cancel", authMiddleware(), cancelPremiumHandler)
        r.GET("/api/premium/transactions", authMiddleware(), getPremiumTransactionsHandler)
        r.GET("/api/users/:id/premium", getUserPremiumHandler)
        r.POST("/api/users/:id/donate", optionalAuthMiddleware(), createDonationHandler)
        r.GET("/api/users/:id/donations", getUserDonationsHandler)
        
        // Promo Codes
        r.GET("/api/promo/validate", validatePromoCodeHandler)
        r.GET("/api/admin/promo-codes", authMiddleware(), getPromoCodesHandler)
        r.POST("/api/admin/promo-codes", authMiddleware(), createPromoCodeHandler)
        r.DELETE("/api/admin/promo-codes/:id", authMiddleware(), deletePromoCodeHandler)
        
        // Trial Period
        r.POST("/api/premium/trial", authMiddleware(), startTrialHandler)
        
        // Gift Subscriptions
        r.POST("/api/gifts/purchase", authMiddleware(), purchaseGiftHandler)
        r.POST("/api/gifts/redeem", authMiddleware(), redeemGiftHandler)
        r.GET("/api/gifts/my", authMiddleware(), getUserGiftsHandler)
        
        // Post Boosts
        r.GET("/api/boosts/pricing", getBoostPricingHandler)
        r.POST("/api/boosts", authMiddleware(), createPostBoostHandler)
        r.GET("/api/boosts/my", authMiddleware(), getMyBoostsHandler)
        r.GET("/api/posts/boosted", getBoostedPostsHandler)
        
        // Billing webhooks (no auth - external service)
        r.POST("/api/billing/yookassa/webhook", yookassaWebhookHandler)

        // Presence & Status
        r.GET("/api/users/:id/presence", authMiddleware(), getUserPresenceHandler)
        r.PUT("/api/presence", authMiddleware(), updatePresenceHandler)
        r.POST("/api/typing", authMiddleware(), sendTypingHandler)
        r.POST("/api/messages/:id/read", authMiddleware(), markAsReadHandler)

        // Message Reactions
        r.POST("/api/messages/:id/reactions", authMiddleware(), addReactionHandler)
        r.DELETE("/api/messages/:id/reactions/:emoji", authMiddleware(), removeReactionHandler)

        // Invite Links
        r.POST("/api/invites", authMiddleware(), createInviteHandler)
        r.GET("/api/invites/:code", getInviteHandler)
        r.POST("/api/invites/:code/use", authMiddleware(), useInviteHandler)

        // User Referrals
        r.GET("/api/referral/my", authMiddleware(), getMyReferralHandler)
        r.GET("/api/referral/info/:code", getReferralInfoHandler)
        r.POST("/api/referral/use/:code", authMiddleware(), useReferralHandler)
        r.GET("/api/referral/invited", authMiddleware(), getMyReferralsHandler)
        r.GET("/api/referral/bonuses", authMiddleware(), getReferralBonusesHandler)

        // User Notes
        r.GET("/api/users/:id/notes", authMiddleware(), getUserNoteHandler)
        r.PUT("/api/users/:id/notes", authMiddleware(), updateUserNoteHandler)

        // User Search
        r.GET("/api/users/search", authMiddleware(), searchUsersHandler)
        r.GET("/api/users/all", authMiddleware(), getAllUsersHandler)

        // Super Admin Panel
        r.GET("/api/super-admin/stats", authMiddleware(), superAdminMiddleware(), getSuperAdminStatsHandler)
        r.GET("/api/super-admin/users", authMiddleware(), superAdminMiddleware(), getSuperAdminUsersHandler)
        r.GET("/api/super-admin/users/:id", authMiddleware(), superAdminMiddleware(), getUserDetailHandler)
        r.GET("/api/super-admin/users/:id/sessions", authMiddleware(), superAdminMiddleware(), getUserSessionsHandler)
        r.DELETE("/api/super-admin/users/:id/sessions/:session_id", authMiddleware(), superAdminMiddleware(), revokeUserSessionHandler)
        r.DELETE("/api/super-admin/users/:id/sessions", authMiddleware(), superAdminMiddleware(), revokeAllUserSessionsHandler)
        r.POST("/api/super-admin/users/:id/reset-password", authMiddleware(), superAdminMiddleware(), resetUserPasswordHandler)
        r.PUT("/api/super-admin/users/:id/role", authMiddleware(), superAdminMiddleware(), changeUserRoleHandler)
        r.GET("/api/super-admin/guilds", authMiddleware(), superAdminMiddleware(), getSuperAdminGuildsHandler)
        r.GET("/api/super-admin/guilds/:id", authMiddleware(), superAdminMiddleware(), getGuildDetailHandler)
        r.POST("/api/super-admin/guilds/:id/transfer", authMiddleware(), superAdminMiddleware(), transferGuildOwnershipHandler)
        r.DELETE("/api/super-admin/guilds/:id", authMiddleware(), superAdminMiddleware(), deleteGuildHandler)
        r.GET("/api/super-admin/security-logs", authMiddleware(), superAdminMiddleware(), getSecurityLogsHandler)
        r.GET("/api/super-admin/failed-logins", authMiddleware(), superAdminMiddleware(), getFailedLoginsHandler)
        r.GET("/api/super-admin/service-status", authMiddleware(), superAdminMiddleware(), getServiceStatusHandler)
        r.GET("/api/super-admin/jarvis/stats", authMiddleware(), superAdminMiddleware(), getJarvisStatsHandler)
        r.GET("/api/super-admin/jarvis/users/:user_id", authMiddleware(), superAdminMiddleware(), getJarvisUserUsageHandler)
        r.DELETE("/api/super-admin/messages/:id", authMiddleware(), superAdminMiddleware(), deleteMessageAdminHandler)
        r.DELETE("/api/super-admin/posts/:id", authMiddleware(), superAdminMiddleware(), deletePostAdminHandler)

        // Admin Panel
        r.GET("/api/admin/stats", authMiddleware(), adminMiddleware(), getAdminStatsHandler)
        r.GET("/api/stats/platform", getPlatformStatsHandler)
        r.GET("/api/streams/live", getLiveStreamsHandler)
        r.GET("/api/admin/users", authMiddleware(), adminMiddleware(), getAdminUsersHandler)
        r.POST("/api/admin/users/:id/ban", authMiddleware(), adminMiddleware(), banUserHandler)
        r.DELETE("/api/admin/users/:id/ban", authMiddleware(), adminMiddleware(), unbanUserHandler)
        r.POST("/api/admin/ip-bans", authMiddleware(), adminMiddleware(), createIPBanHandler)
        r.GET("/api/admin/ip-bans", authMiddleware(), adminMiddleware(), getIPBansHandler)
        r.DELETE("/api/admin/ip-bans/:id", authMiddleware(), adminMiddleware(), deleteIPBanHandler)
        r.GET("/api/admin/reports", authMiddleware(), adminMiddleware(), getReportsHandler)
        r.PUT("/api/admin/reports/:id", authMiddleware(), adminMiddleware(), updateReportHandler)
        r.GET("/api/admin/audit-logs", authMiddleware(), adminMiddleware(), getAuditLogsHandler)

        // User reports (public endpoint for authenticated users)
        r.POST("/api/reports", authMiddleware(), createReportHandler)

        // Jarvis Moderation System
        r.GET("/api/admin/moderation/cases", authMiddleware(), adminMiddleware(), getModerationCasesHandler)
        r.GET("/api/admin/moderation/cases/:id", authMiddleware(), adminMiddleware(), getModerationCaseHandler)
        r.POST("/api/admin/moderation/cases", authMiddleware(), adminMiddleware(), createModerationCaseHandler)
        r.POST("/api/admin/moderation/cases/:id/review", authMiddleware(), adminMiddleware(), jarvisReviewCaseHandler)
        r.PUT("/api/admin/moderation/verdicts/:id/override", authMiddleware(), adminMiddleware(), overrideVerdictHandler)
        r.GET("/api/admin/moderation/stats", authMiddleware(), adminMiddleware(), getModerationStatsHandler)

        // Appeals (user-facing)
        r.POST("/api/appeals", authMiddleware(), createAppealHandler)

        // Appeals (admin)
        r.GET("/api/admin/appeals", authMiddleware(), adminMiddleware(), getAppealsHandler)
        r.PUT("/api/admin/appeals/:id", authMiddleware(), adminMiddleware(), reviewAppealHandler)

        // Jarvis Audio Responses (admin)
        r.GET("/api/admin/jarvis/audio-responses", authMiddleware(), adminMiddleware(), getJarvisAudioResponsesHandler)
        r.POST("/api/admin/jarvis/audio-responses", authMiddleware(), adminMiddleware(), createJarvisAudioResponseHandler)
        r.PUT("/api/admin/jarvis/audio-responses/:id", authMiddleware(), adminMiddleware(), updateJarvisAudioResponseHandler)
        r.DELETE("/api/admin/jarvis/audio-responses/:id", authMiddleware(), adminMiddleware(), deleteJarvisAudioResponseHandler)

        // Voicemails
        r.GET("/api/voicemails", authMiddleware(), getVoicemailsHandler)
        r.PUT("/api/voicemails/:id/read", authMiddleware(), markVoicemailReadHandler)
        r.POST("/api/voicemails", authMiddleware(), createVoicemailHandler)

        // User Requests (general requests/reports to admins)
        r.POST("/api/requests", authMiddleware(), createUserRequestHandler)
        r.GET("/api/requests/my", authMiddleware(), getUserRequestsHandler)
        r.DELETE("/api/requests/:id", authMiddleware(), cancelUserRequestHandler)
        r.GET("/api/admin/requests", authMiddleware(), adminMiddleware(), getAdminUserRequestsHandler)
        r.PUT("/api/admin/requests/:id", authMiddleware(), adminMiddleware(), updateUserRequestHandler)
        
        // Admin Billing
        r.POST("/api/admin/billing/refund", authMiddleware(), adminMiddleware(), refundPremiumHandler)
        r.GET("/api/admin/billing/stats", authMiddleware(), adminMiddleware(), getAdminBillingStatsHandler)
        r.GET("/api/billing/transactions/:id/status", authMiddleware(), getPaymentStatusHandler)

        // Content Filtering (Admin)
        r.GET("/api/admin/forbidden-words", authMiddleware(), adminMiddleware(), getForbiddenWordsHandler)
        r.POST("/api/admin/forbidden-words", authMiddleware(), adminMiddleware(), addForbiddenWordHandler)
        r.PUT("/api/admin/forbidden-words/:id", authMiddleware(), adminMiddleware(), updateForbiddenWordHandler)
        r.DELETE("/api/admin/forbidden-words/:id", authMiddleware(), adminMiddleware(), deleteForbiddenWordHandler)
        r.GET("/api/admin/forbidden-attempts", authMiddleware(), adminMiddleware(), getForbiddenAttemptsHandler)

        // Content Validation (Public)
        r.POST("/api/content/validate", authMiddleware(), validateContentHandler)

        // Telegram Integration
        r.GET("/api/telegram/link", authMiddleware(), getTelegramLinkHandler)
        r.POST("/api/telegram/link", authMiddleware(), createTelegramLinkHandler)
        r.DELETE("/api/telegram/link", authMiddleware(), unlinkTelegramHandler)
        r.POST("/api/telegram/verify", verifyTelegramLinkHandler)
        r.PUT("/api/telegram/settings", authMiddleware(), updateTelegramSettingsHandler)
        r.POST("/api/telegram/webhook/setup", authMiddleware(), adminMiddleware(), setupTelegramWebhookHandler)
        r.GET("/api/telegram/webhook/info", authMiddleware(), adminMiddleware(), getTelegramWebhookInfoHandler)
        r.POST("/api/telegram/commands/setup", authMiddleware(), adminMiddleware(), setBotCommandsHandler)
        r.GET("/api/notifications", authMiddleware(), getNotificationsHandler)
        r.GET("/api/notifications/full", authMiddleware(), getNotificationsFullHandler)
        r.GET("/api/notifications/groups", authMiddleware(), getNotificationGroupsHandler)
        r.GET("/api/notifications/unread-count", authMiddleware(), getUnreadCountHandler)
        r.PATCH("/api/notifications/:id/read", authMiddleware(), markNotificationReadHandler)
        r.POST("/api/notifications/read-all", authMiddleware(), markAllNotificationsReadHandler)
        r.DELETE("/api/notifications/:id", authMiddleware(), deleteNotificationHandler)
        r.DELETE("/api/notifications", authMiddleware(), deleteAllNotificationsHandler)
        r.GET("/api/notifications/preferences", authMiddleware(), getNotificationPreferencesHandler)
        r.PUT("/api/notifications/preferences", authMiddleware(), updateNotificationPreferencesHandler)
        r.POST("/api/notifications/test", authMiddleware(), sendTestNotificationHandler)
        r.POST("/api/1470", getTelegramWebhookHandler)

        // File uploads
        r.POST("/api/upload", authMiddleware(), uploadFileHandler)
        r.Static("/uploads", "./uploads")

        // Channel Tools (Board/Notebook)
        r.POST("/api/channels/:channel_id/tools", authMiddleware(), HandleCreateChannelTool)
        r.GET("/api/channels/:channel_id/tools", authMiddleware(), HandleGetChannelTools)
        r.PUT("/api/channels/tools/:tool_id", authMiddleware(), HandleUpdateChannelTool)
        r.DELETE("/api/channels/tools/:tool_id", authMiddleware(), HandleDeleteChannelTool)

        // Real-time Collaborative Editing (WebSocket)
        r.GET("/ws/collab/:channel_id/:tool_id", handleRealtimeCollaboration)
        r.POST("/api/collab/sync", authMiddleware(), handleCollaborationSync)
        r.GET("/api/collab/users/:channel_id/:tool_id", authMiddleware(), handleGetCollaborationUsers)
        r.POST("/api/collab/cursor", authMiddleware(), handleUpdateCursorPosition)

        // Guild Roles & Permissions
        r.GET("/api/guilds/:id/roles", authMiddleware(), getGuildRolesHandler)
        r.POST("/api/guilds/:id/roles", authMiddleware(), createGuildRoleHandler)
        r.PUT("/api/guilds/:id/roles/:role_id", authMiddleware(), updateGuildRoleHandler)
        r.DELETE("/api/guilds/:id/roles/:role_id", authMiddleware(), deleteGuildRoleHandler)

        // Organization Billing & Templates
        setupOrgBillingRoutes(r, authMiddleware())

        // Admin Organization & Billing Management
        setupAdminOrgRoutes(r, authMiddleware(), adminMiddleware())

        // Phase 1: Achievements, Polls, Custom Statuses, Disappearing Messages
        registerPhase1Routes(r, authMiddleware())

        // Phase 2: Badges, Rewards, Challenges, Streaks, Competitions, Profile Customization
        registerPhase2Routes(r, authMiddleware())

        // Phase 3: Gifts, Trading, Activity Feed, Events, Clans, Mini-Games, Quests, Mentorship, Collections
        initPhase3()
        registerPhase3Routes(r, authMiddleware())
        
        // Anti-Fraud System
        initFraudModels()
        registerFraudRoutes(r, authMiddleware(), adminMiddleware())
        
        // License System
        initLicenseModels()
        registerLicenseRoutes(r, authMiddleware(), adminMiddleware())
        go cleanupExpiredLicenses()

        // Serve frontend static files in production
        if _, err := os.Stat("../frontend/dist"); err == nil {
                r.Static("/assets", "../frontend/dist/assets")
                r.Static("/audio", "../frontend/dist/audio")
                r.Static("/jarvis-audio", "../frontend/dist/jarvis-audio")
                r.Static("/logos", "../frontend/dist/logos")
                r.NoRoute(func(c *gin.Context) {
                        // Serve index.html for SPA routing (except API and WebSocket routes)
                        if !strings.HasPrefix(c.Request.URL.Path, "/api") && !strings.HasPrefix(c.Request.URL.Path, "/ws") && !strings.HasPrefix(c.Request.URL.Path, "/uploads") {
                                c.File("../frontend/dist/index.html")
                        }
                })
        }

        port := os.Getenv("PORT")
        if port == "" {
                port = "8000"
        }

        // Create HTTP server with timeouts
        srv := &http.Server{
                Addr:         ":" + port,
                Handler:      r,
                ReadTimeout:  15 * time.Second,
                WriteTimeout: 15 * time.Second,
                IdleTimeout:  60 * time.Second,
        }

        // Start server in goroutine
        go func() {
                log.Printf("Server starting on port %s", port)
                if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                        log.Fatalf("Server failed to start: %v", err)
                }
        }()

        // Wait for interrupt signal for graceful shutdown
        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        <-quit
        log.Println("Shutting down server...")

        // Give outstanding requests 30 seconds to complete
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        if err := srv.Shutdown(ctx); err != nil {
                log.Printf("Server forced to shutdown: %v", err)
        }

        log.Println("Server exited gracefully")
}
