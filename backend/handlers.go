package main

import (
        "log"
        "net/http"
        "os"
        "strings"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
        "golang.org/x/crypto/bcrypt"
        "gorm.io/driver/postgres"
        "gorm.io/gorm"
)

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
        )
        log.Println("DB connected")

        initDefaultForbiddenWords()
        ensureGlobalGuild()
}

func ensureGlobalGuild() {
        var globalGuild Guild
        if err := db.Where("name = ?", "Nemaks Общий").First(&globalGuild).Error; err != nil {
                // Create a system user if none exists to own the global guild
                var systemUser User
                if err := db.Where("id = ?", 1).First(&systemUser).Error; err != nil {
                        systemUser = User{
                                ID:       1,
                                Username: "System",
                                Password: "system_protected_password", // Placeholder
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
        var req struct {
                Username string `json:"username" binding:"required"`
                Email    string `json:"email"`
                Password string `json:"password" binding:"required,min=6"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
        user := User{
                Username: req.Username,
                Email:    req.Email,
                Password: string(hashedPassword),
        }

        if err := db.Create(&user).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "User or email already exists"})
                return
        }

        token, _ := generateToken(&user)
        c.JSON(http.StatusCreated, gin.H{"token": token, "user": user})
}

func loginHandler(c *gin.Context) {
        var req struct {
                Username string `json:"username" binding:"required"`
                Password string `json:"password" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var user User
        if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
                return
        }

        if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
                return
        }

        token, _ := generateToken(&user)
        c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func logoutHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func meHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var user User
        db.First(&user, userID)
        c.JSON(http.StatusOK, user)
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
                        return []byte("your-secret-key"), nil
                })

                if err != nil || !token.Valid {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                        return
                }

                claims, _ := token.Claims.(jwt.MapClaims)
                c.Set("user_id", claims["user_id"])
                c.Next()
        }
}

func generateToken(user *User) (string, error) {
        token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
                "user_id":  user.ID,
                "username": user.Username,
                "exp":      time.Now().Add(time.Hour * 24).Unix(),
        })
        return token.SignedString([]byte("your-secret-key"))
}

func getGuildsHandler(c *gin.Context) {
        var guilds []Guild
        db.Find(&guilds)
        c.JSON(http.StatusOK, guilds)
}

func createGuildHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                Name string `json:"name" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        guild := Guild{
                Name:    req.Name,
                OwnerID: uint(userID.(float64)),
        }
        db.Create(&guild)
        c.JSON(http.StatusCreated, guild)
}

func getChannelsHandler(c *gin.Context) {
        guildID := c.Param("guild_id")
        var channels []Channel
        db.Where("guild_id = ?", guildID).Find(&channels)
        c.JSON(http.StatusOK, channels)
}

func createChannelHandler(c *gin.Context) {
        guildID, _ := strconv.ParseUint(c.Param("guild_id"), 10, 32)
        var req struct {
                Name string `json:"name" binding:"required"`
                Type string `json:"type" gorm:"default:'text'"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        channel := Channel{
                GuildID: uint(guildID),
                Name:    req.Name,
                Type:    req.Type,
        }
        db.Create(&channel)
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
