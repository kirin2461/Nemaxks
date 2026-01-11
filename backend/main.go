package main

import (
        "context"
        "log"
        "net/http"
        "os"
        "os/signal"
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

        // Initialize Redis (optional, non-fatal)
        if os.Getenv("REDIS_URL") != "" {
                if err := InitRedis(); err != nil {
                        log.Printf("Warning: Redis not available: %v", err)
                } else {
                        defer CloseRedis()
                }
        }

        // Initialize LiveKit (optional, non-fatal)
        if os.Getenv("LIVEKIT_API_KEY") != "" {
                if err := InitLiveKit(); err != nil {
                        log.Printf("Warning: LiveKit not configured: %v", err)
                }
        }

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

        // Configure CORS properly
        corsConfig := cors.Config{
                AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
                AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "Cache-Control"},
                ExposeHeaders:    []string{"Content-Length"},
                MaxAge:           12 * time.Hour,
                AllowAllOrigins:  true,
                AllowCredentials: true,
        }

        r.Use(cors.New(corsConfig))

        r.NoRoute(func(c *gin.Context) {
                log.Printf("404 Not Found: %s %s from %s", c.Request.Method, c.Request.URL.Path, c.ClientIP())
                c.JSON(http.StatusNotFound, gin.H{"error": "Route not found"})
        })

        r.GET("/", func(c *gin.Context) {
                c.JSON(http.StatusOK, gin.H{
                        "status":  "ok",
                        "message": "Nemaks API Server",
                        "version": "1.0.0",
                })
        })

        r.GET("/health", func(c *gin.Context) {
                c.JSON(http.StatusOK, gin.H{"status": "ok"})
        })

        // Auth routes with rate limiting to prevent brute force attacks
        r.POST("/api/auth/register", registerHandler)
        r.POST("/api/auth/login", loginHandler)
        r.POST("/api/auth/logout", authMiddleware(), logoutHandler)
        r.GET("/api/auth/me", authMiddleware(), meHandler)

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

        // User Notes
        r.GET("/api/users/:id/notes", authMiddleware(), getUserNoteHandler)
        r.PUT("/api/users/:id/notes", authMiddleware(), updateUserNoteHandler)

        // User Search
        r.GET("/api/users/search", authMiddleware(), searchUsersHandler)
        r.GET("/api/users/all", authMiddleware(), getAllUsersHandler)

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
        r.GET("/api/notifications", authMiddleware(), getNotificationsHandler)
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
