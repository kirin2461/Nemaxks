package main

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

// Messages
func getMessagesByChannelHandler(c *gin.Context) {
        channelID := c.Param("channel_id")
        var messages []Message
        db.Where("channel_id = ?", channelID).Order("created_at asc").Find(&messages)
        c.JSON(http.StatusOK, messages)
}

func createChannelMessageHandler(c *gin.Context) {
        channelID, _ := strconv.ParseUint(c.Param("channel_id"), 10, 32)
        userID, _ := c.Get("user_id")

        var req struct {
                Content string `json:"content" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        msg := Message{
                ChannelID: uint(channelID),
                AuthorID:  uint(userID.(float64)),
                Content:   req.Content,
        }
        db.Create(&msg)
        c.JSON(http.StatusCreated, msg)
}

// RTC
func getICEServersHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
                "iceServers": []gin.H{
                        {"urls": "stun:stun.l.google.com:19302"},
                },
        })
}

// Posts
func getPostsHandler(c *gin.Context) {
        var posts []Post
        db.Preload("Author").Order("created_at desc").Find(&posts)
        c.JSON(http.StatusOK, posts)
}

func createPostHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                Title   string `json:"title" binding:"required"`
                Content string `json:"content" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        post := Post{
                AuthorID: uint(userID.(float64)),
                Title:    req.Title,
                Content:  req.Content,
        }
        if err := db.Create(&post).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post"})
                return
        }
        c.JSON(http.StatusCreated, post)
}

func getPlatformStatsHandler(c *gin.Context) {
        var userCount, guildCount, messageCount int64
        db.Model(&User{}).Count(&userCount)
        db.Model(&Guild{}).Count(&guildCount)
        db.Model(&Message{}).Count(&messageCount)

        c.JSON(http.StatusOK, gin.H{
                "users":    userCount,
                "guilds":   guildCount,
                "messages": messageCount,
                "uptime":   time.Since(startTime).String(),
        })
}

var startTime = time.Now()

func getLiveStreamsHandler(c *gin.Context) {
        // Placeholder for live streams integration
        c.JSON(http.StatusOK, []gin.H{})
}

// Videos
func getVideosHandler(c *gin.Context) {
        var videos []Video
        db.Find(&videos)
        c.JSON(http.StatusOK, videos)
}

func getVideoHandler(c *gin.Context) {
        id := c.Param("id")
        var video Video
        if err := db.First(&video, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
                return
        }
        c.JSON(http.StatusOK, video)
}

func createVideoHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        var req struct {
                Title string `json:"title" binding:"required"`
                URL   string `json:"url" binding:"required"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        video := Video{
                AuthorID: uint(userID.(float64)),
                Title:    req.Title,
                VideoURL: req.URL,
        }
        db.Create(&video)
        c.JSON(http.StatusCreated, video)
}

func updateVideoHandler(c *gin.Context) {
        id := c.Param("id")
        var video Video
        if err := db.First(&video, id).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
                return
        }
        c.BindJSON(&video)
        db.Save(&video)
        c.JSON(http.StatusOK, video)
}

func deleteVideoHandler(c *gin.Context) {
        id := c.Param("id")
        db.Delete(&Video{}, id)
        c.JSON(http.StatusOK, gin.H{"message": "Video deleted"})
}

// Post Likes
func likePostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "liked"})
}
func unlikePostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unliked"})
}

// Post Bookmarks
func bookmarkPostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "bookmarked"})
}
func unbookmarkPostHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unbookmarked"})
}

// Subscriptions
func getSubscriptionsHandler(c *gin.Context) {
        c.JSON(http.StatusOK, []string{})
}
func subscribeHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "subscribed"})
}
func unsubscribeHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unsubscribed"})
}
func getSubscribersHandler(c *gin.Context) {
        c.JSON(http.StatusOK, []string{})
}

// Video Extras
func likeVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "liked"})
}
func unlikeVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unliked"})
}
func bookmarkVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "bookmarked"})
}
func unbookmarkVideoHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "unbookmarked"})
}
func getVideoChaptersHandler(c *gin.Context) {
        c.JSON(http.StatusOK, []string{})
}
func incrementVideoViewHandler(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "viewed"})
}
