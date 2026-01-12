package main

import (
        "crypto/rand"
        "encoding/hex"
        "log"
        "net/http"
        "os"
        "strconv"
        "strings"
        "time"

        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
        "golang.org/x/crypto/bcrypt"
        "gorm.io/driver/postgres"
        "gorm.io/gorm"
)

// getJWTSecret returns the JWT secret from environment or a default for development
func getJWTSecret() []byte {
        secret := os.Getenv("JWT_SECRET")
        if secret == "" {
                log.Println("WARNING: JWT_SECRET not set, using insecure default. Set JWT_SECRET in production!")
                secret = "development-only-secret-change-in-production"
        }
        return []byte(secret)
}

// generateSecurePassword generates a cryptographically secure random password
func generateSecurePassword() string {
        bytes := make([]byte, 32)
        if _, err := rand.Read(bytes); err != nil {
                log.Printf("Error generating secure password: %v", err)
                return "fallback-secure-password-" + time.Now().String()
        }
        return hex.EncodeToString(bytes)
}

// getUserIDFromContext safely extracts user ID from gin context
func getUserIDFromContext(c *gin.Context) (uint, bool) {
        userID, exists := c.Get("user_id")
        if !exists {
                return 0, false
        }

        switch v := userID.(type) {
        case float64:
                return uint(v), true
        case uint:
                return v, true
        case int:
                return uint(v), true
        case int64:
                return uint(v), true
        default:
                log.Printf("Unexpected user_id type: %T", userID)
                return 0, false
        }
}

func initDB() {
        dsn := os.Getenv("DATABASE_URL")
        if dsn == "" {
                log.Println("DATABASE_URL not set")
                return
        }

        var err error
        db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
        if err != nil {
                log.Printf("DB error: %v", err)
                return
        }

        db.AutoMigrate(
                &User{}, &Guild{}, &Channel{}, &Message{}, &Post{},
                &Friend{}, &FriendRequest{}, &DirectMessage{}, &MessageReaction{}, &Settings{},
                &AdminRole{}, &AdminUserRole{}, &BanHistory{}, &Ban{}, &BlockedUser{},
                &BotActivityLog{}, &BotRateLimit{}, &BotToken{}, &BotWebhook{}, &BotWebhookDelivery{},
                &Call{}, &CallParticipant{}, &CallRecording{}, &CallSignaling{},
                &ChannelCategory{}, &ChannelInvitation{}, &ChannelMember{}, &ChannelMessageReaction{},
                &JarvisCommand{}, &JarvisContext{}, &JarvisReminder{}, &JarvisSession{},
                &Story{}, &StoryView{}, &PostRating{}, &PostComment{}, &PostLike{}, &Subscription{}, &PostBookmark{},
                &UserPresence{}, &TypingIndicator{}, &ReadReceipt{},
                &IPBan{}, &AuditLog{}, &AbuseReport{},
                &InviteLink{}, &UserNote{}, &FileAttachment{},
                &PinnedMessage{}, &ChannelPermission{}, &GuildRole{}, &GuildMemberRole{},
                &UserSettings{}, &QRLoginSession{},
                &ForbiddenWord{}, &ForbiddenAttempt{},
                &TelegramLink{}, &TelegramNotification{},
                &UserReferral{}, &ReferralUse{},
                &Video{}, &VideoChapter{}, &VideoLike{}, &VideoBookmark{},
                &PremiumPlan{}, &UserPremium{}, &CreatorDonation{},
                &UserRequest{}, &PremiumSubscription{}, &PremiumTransaction{},
                &PromoCode{}, &PromoCodeUsage{}, &GiftSubscription{}, &ReferralBonus{}, &PostBoost{},
                &SubscriptionPlan{}, &SeatPricing{}, &OveragePricing{},
                &Org{}, &OrgSubscription{}, &OrgEntitlement{}, &OrgMember{}, &ChannelACL{},
                &StorageOverageDaily{}, &DonationSettings{}, &Donation{}, &PricingChangeLog{},
                &GuildTemplate{}, &ChannelTemplate{}, &InteractiveBoard{}, &OnlineNotebook{},
                &JarvisUsage{}, &ManualPayment{}, &GuildMember{},
                &ModerationCase{}, &ModerationVerdict{}, &ModerationActionLog{},
                &Appeal{}, &JarvisAudioResponse{}, &JarvisVoiceCommand{}, &Voicemail{}, &JarvisCallSession{},
                &ChannelTool{},
        )
        log.Println("DB connected")

        initDefaultForbiddenWords()
        ensureGlobalGuild()
        seedPremiumPlans()
        initOrgBillingSeeds()
}

func ensureGlobalGuild() {
        var globalGuild Guild
        if err := db.Where("name = ?", "Nemaks Общий").First(&globalGuild).Error; err != nil {
                // Create a system user if none exists to own the global guild
                var systemUser User
                if err := db.Where("id = ?", 1).First(&systemUser).Error; err != nil {
                        // Generate a secure random password for system user
                        securePassword := generateSecurePassword()
                        hashedPassword, hashErr := bcrypt.GenerateFromPassword([]byte(securePassword), bcrypt.DefaultCost)
                        if hashErr != nil {
                                log.Printf("Error hashing system user password: %v", hashErr)
                                return
                        }

                        systemUser = User{
                                ID:       1,
                                Username: "System",
                                Password: string(hashedPassword),
                                Role:     "admin",
                        }
                        db.Create(&systemUser)
                }

                // Create global guild if it doesn't exist
                globalGuild = Guild{
                        Name:    "Nemaks Общий",
                        OwnerID: systemUser.ID,
                }
                if err := db.Create(&globalGuild).Error; err == nil {
                        // Create a default general channel
                        channel := Channel{
                                GuildID: globalGuild.ID,
                                Name:    "general",
                                Type:    "text",
                        }
                        db.Create(&channel)
                }
        }

        // Auto-add all existing users who aren't members
        var users []User
        db.Find(&users)
        for _, user := range users {
                var member ChannelMember
                var generalChannel Channel
                db.Where("guild_id = ? AND name = ?", globalGuild.ID, "general").First(&generalChannel)
                if generalChannel.ID != 0 {
                        if db.Where("channel_id = ? AND user_id = ?", generalChannel.ID, user.ID).First(&member).RowsAffected == 0 {
                                db.Create(&ChannelMember{
                                        ChannelID: generalChannel.ID,
                                        UserID:    user.ID,
                                        Role:      "member",
                                        JoinedAt:  time.Now(),
                                })
                        }
                }
        }
}

func registerHandler(c *gin.Context) {
        log.Printf("Register attempt: Method=%s Path=%s IP=%s", c.Request.Method, c.Request.URL.Path, c.ClientIP())
        var req struct {
                Username string  `json:"username" binding:"required"`
                Email    *string `json:"email"`
                Password string  `json:"password" binding:"required,min=6"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                log.Printf("Register bind error: %v", err)
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        // Content filter check
        filterResult := checkContentFilter(req.Username, 0, "registration")
        if filterResult.IsForbidden {
                log.Printf("Register blocked: username contains forbidden words: %v", filterResult.MatchedWords)
                c.JSON(http.StatusForbidden, gin.H{
                        "error":         "Username contains forbidden content",
                        "matched_words": filterResult.MatchedWords,
                })
                return
        }

        // Check if user already exists
        var count int64
        db.Model(&User{}).Where("username = ?", req.Username).Count(&count)
        if count > 0 {
                log.Printf("Register error: Username %s already taken", req.Username)
                c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
                return
        }

        hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
        if err != nil {
                log.Printf("Error hashing password: %v", err)
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
                return
        }

        email := req.Email
        if email != nil && *email == "" {
                email = nil
        }

        user := User{
                Username: req.Username,
                Email:    email,
                Password: string(hashedPassword),
        }

        if err := db.Create(&user).Error; err != nil {
                log.Printf("Registration error: %v", err)
                // Check for duplicate key constraint violation
                if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "23505") {
                        c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
                        return
                }
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
                return
        }

        token, err := generateToken(&user)
        if err != nil {
                log.Printf("Token generation error: %v", err)
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
                return
        }

        c.JSON(http.StatusCreated, gin.H{"token": token, "user": user.ToPublic()})
}

func loginHandler(c *gin.Context) {
        log.Printf("Login attempt: Method=%s Path=%s IP=%s", c.Request.Method, c.Request.URL.Path, c.ClientIP())
        var req struct {
                Username string `json:"username" binding:"required"`
                Password string `json:"password" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                log.Printf("Login bind error: %v", err)
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        // Content filter check
        filterResult := checkContentFilter(req.Username, 0, "login")
        if filterResult.IsForbidden {
                log.Printf("Login blocked: username contains forbidden words: %v", filterResult.MatchedWords)
                c.JSON(http.StatusForbidden, gin.H{
                        "error":         "Username contains forbidden content",
                        "matched_words": filterResult.MatchedWords,
                })
                return
        }

        var user User
        if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
                log.Printf("Login attempt failed for username %s: user not found", req.Username)
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
                return
        }

        if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
                log.Printf("Login attempt failed for username %s: invalid password", req.Username)
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
                return
        }

        token, err := generateToken(&user)
        if err != nil {
                log.Printf("Token generation error: %v", err)
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"token": token, "user": user.ToPublic()})
}

func logoutHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func meHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user session"})
                return
        }

        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        c.JSON(http.StatusOK, user.ToPublic())
}

func authMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                authHeader := c.GetHeader("Authorization")
                if authHeader == "" {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
                        return
                }

                tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
                token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
                        // Validate signing method
                        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                                return nil, jwt.ErrSignatureInvalid
                        }
                        return getJWTSecret(), nil
                })

                if err != nil || !token.Valid {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                        return
                }

                claims, ok := token.Claims.(jwt.MapClaims)
                if !ok {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
                        return
                }

                c.Set("user_id", claims["user_id"])
                c.Next()
        }
}

// optionalAuthMiddleware extracts user_id if token is present but doesn't require it
func optionalAuthMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                authHeader := c.GetHeader("Authorization")
                if authHeader == "" {
                        c.Next()
                        return
                }

                tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
                token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
                        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                                return nil, jwt.ErrSignatureInvalid
                        }
                        return getJWTSecret(), nil
                })

                if err == nil && token.Valid {
                        if claims, ok := token.Claims.(jwt.MapClaims); ok {
                                c.Set("user_id", claims["user_id"])
                        }
                }
                c.Next()
        }
}

func generateToken(user *User) (string, error) {
        token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
                "user_id":  user.ID,
                "username": user.Username,
                "exp":      time.Now().Add(time.Hour * 24).Unix(),
        })
        return token.SignedString(getJWTSecret())
}

func getGuildsHandler(c *gin.Context) {
        var guilds []Guild
        db.Find(&guilds)
        c.JSON(http.StatusOK, guilds)
}

func createGuildHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user session"})
                return
        }

        var req struct {
                Name string `json:"name" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        guild := Guild{
                Name:    req.Name,
                OwnerID: userID,
        }
        if err := db.Create(&guild).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create guild"})
                return
        }

        c.JSON(http.StatusCreated, guild)
}

func getChannelsHandler(c *gin.Context) {
        guildID := c.Param("guild_id")
        userID, _ := getUserIDFromContext(c)

        var channels []Channel
        db.Where("guild_id = ?", guildID).Find(&channels)

        var guild Guild
        db.First(&guild, guildID)
        isGuildOwner := guild.OwnerID == userID

        var user User
        db.First(&user, userID)
        isAdmin := user.Role == "admin"

        isGuildModerator := false
        if !isAdmin && !isGuildOwner {
                var memberRoles []GuildMemberRole
                db.Where("guild_id = ? AND user_id = ?", guildID, userID).Find(&memberRoles)
                for _, mr := range memberRoles {
                        var role GuildRole
                        if db.First(&role, mr.RoleID).Error == nil {
                                if role.Permissions&PermAdministrator != 0 || role.Permissions&PermManageChannels != 0 || role.Permissions&PermBanMembers != 0 {
                                        isGuildModerator = true
                                        break
                                }
                        }
                }
        }

        var visibleChannels []Channel
        for _, ch := range channels {
                if !ch.IsPrivate || ch.Name == "Nemaks Общий" {
                        visibleChannels = append(visibleChannels, ch)
                } else if isGuildOwner || isAdmin || isGuildModerator {
                        visibleChannels = append(visibleChannels, ch)
                } else {
                        var member ChannelMember
                        if db.Where("channel_id = ? AND user_id = ?", ch.ID, userID).First(&member).Error == nil {
                                visibleChannels = append(visibleChannels, ch)
                        }
                }
        }

        c.JSON(http.StatusOK, visibleChannels)
}

func createChannelHandler(c *gin.Context) {
        guildID, err := strconv.ParseUint(c.Param("guild_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid guild ID"})
                return
        }

        userID, _ := getUserIDFromContext(c)

        var req struct {
                Name      string `json:"name" binding:"required"`
                Type      string `json:"type"`
                IsPrivate bool   `json:"is_private"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        channelType := req.Type
        if channelType == "" {
                channelType = "text"
        }

        isPrivate := req.IsPrivate
        if req.Name == "Nemaks Общий" {
                isPrivate = false
        }

        channel := Channel{
                GuildID:   uint(guildID),
                Name:      req.Name,
                Type:      channelType,
                IsPrivate: isPrivate,
        }
        if err := db.Create(&channel).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
                return
        }

        if isPrivate {
                member := ChannelMember{
                        ChannelID: channel.ID,
                        UserID:    userID,
                }
                db.Create(&member)
        }

        c.JSON(http.StatusCreated, channel)
}

func getGuildHandler(c *gin.Context) {
        id := c.Param("id")
        var guild Guild
        if err := db.First(&guild, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Guild not found"})
                return
        }
        c.JSON(http.StatusOK, guild)
}

// QR Login Handlers - 10 minute expiration

func generateQRLoginHandler(c *gin.Context) {
        // Generate unique token
        token := generateRandomString(32)
        
        // Create session with 10-minute expiration
        session := QRLoginSession{
                Token:     token,
                Status:    "pending",
                ExpiresAt: time.Now().Add(10 * time.Minute),
        }
        
        if err := db.Create(&session).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create QR session"})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "token":      token,
                "expires_at": session.ExpiresAt,
        })
}

func checkQRLoginStatusHandler(c *gin.Context) {
        token := c.Param("token")
        
        var session QRLoginSession
        if err := db.Preload("User").Where("token = ?", token).First(&session).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
                return
        }
        
        // Check if expired
        if time.Now().After(session.ExpiresAt) {
                session.Status = "expired"
                db.Save(&session)
                c.JSON(http.StatusGone, gin.H{
                        "status":     "expired",
                        "expires_at": session.ExpiresAt,
                })
                return
        }
        
        response := gin.H{
                "status":     session.Status,
                "expires_at": session.ExpiresAt,
        }
        
        // If confirmed, include JWT token and user info
        if session.Status == "confirmed" && session.JWTToken != nil {
                response["jwt_token"] = *session.JWTToken
                if session.User != nil {
                        response["user"] = session.User.ToPublic()
                }
        }
        
        c.JSON(http.StatusOK, response)
}

func confirmQRLoginHandler(c *gin.Context) {
        token := c.Param("token")
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }
        
        var session QRLoginSession
        if err := db.Where("token = ?", token).First(&session).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
                return
        }
        
        // Check if expired
        if time.Now().After(session.ExpiresAt) {
                session.Status = "expired"
                db.Save(&session)
                c.JSON(http.StatusGone, gin.H{"error": "QR code has expired"})
                return
        }
        
        // Check if already confirmed
        if session.Status == "confirmed" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Session already confirmed"})
                return
        }
        
        // Get user
        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }
        
        // Generate JWT for the QR session
        jwtToken, err := generateToken(&user)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
                return
        }
        
        // Update session
        session.Status = "confirmed"
        session.UserID = &user.ID
        session.ConfirmedBy = &user.ID
        session.JWTToken = &jwtToken
        
        if err := db.Save(&session).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm session"})
                return
        }
        
        c.JSON(http.StatusOK, gin.H{
                "message":  "Login confirmed",
                "username": user.Username,
        })
}

func generateRandomString(length int) string {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        b := make([]byte, length)
        randomBytes := make([]byte, length)
        _, err := rand.Read(randomBytes)
        if err != nil {
                log.Printf("CRITICAL: crypto/rand failed: %v", err)
                panic("crypto/rand unavailable - cannot generate secure tokens")
        }
        for i := range b {
                b[i] = chars[int(randomBytes[i])%len(chars)]
        }
        return string(b)
}
