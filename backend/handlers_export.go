package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Export Chat (Download CSV/JSON)
func exportChatDownloadHandler(c *gin.Context) {
	handleExport(c, false)
}

// Export Chat (To Server Storage)
func exportChatStorageHandler(c *gin.Context) {
	handleExport(c, true)
}

func handleExport(c *gin.Context, toStorage bool) {
	// 1. Auth
	userIDRaw, _ := c.Get("user_id")
	userID, _ := extractUserID(userIDRaw)
	
	channelIDStr := c.Query("channel_id")
	format := c.DefaultQuery("format", "json")

	if channelIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "channel_id required"})
		return
	}

	cid, _ := strconv.ParseUint(channelIDStr, 10, 32)
	var channel Channel
	if err := db.First(&channel, cid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}

	// 2. Permission: ManageMessages or Global Admin
	allowed := false
	if hasGlobalRole(userID, "admin") {
		allowed = true
	} else {
		perms, _ := calculateGuildPermissions(userID, channel.GuildID)
		if (perms & PermManageMessages) != 0 || (perms & PermAdministrator) != 0 {
			allowed = true
		}
	}

	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions to export"})
		return
	}

	// 3. Fetch Data
	var messages []Message
	db.Where("channel_id = ?", cid).Order("created_at ASC").Preload("Author").Find(&messages)

	// 4. Process Export
	if toStorage {
		filename := fmt.Sprintf("export_%d_%d.%s", cid, time.Now().Unix(), format)
		filepath := "./uploads/exports/" + filename
		os.MkdirAll("./uploads/exports", 0750)

		file, err := os.Create(filepath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create export file"})
			return
		}
		defer file.Close()

		if format == "csv" {
			writer := csv.NewWriter(file)
			writer.Write([]string{"ID", "Author", "Content", "Date"})
			for _, m := range messages {
				writer.Write([]string{
					strconv.Itoa(int(m.ID)),
					m.Author.Username,
					m.Content,
					m.CreatedAt.Format(time.RFC3339),
				})
			}
			writer.Flush()
		} else {
			enc := json.NewEncoder(file)
			enc.SetIndent("", "  ")
			enc.Encode(messages)
		}

		go LogAuditViaGRPC(userID, "chat_export_storage", "channel", channelIDStr, 
			fmt.Sprintf("format:%s file:%s", format, filename), "", c.ClientIP(), c.Request.UserAgent())

		c.JSON(http.StatusOK, gin.H{"url": "/uploads/exports/" + filename, "count": len(messages)})

	} else {
		go LogAuditViaGRPC(userID, "chat_export_download", "channel", channelIDStr, 
			fmt.Sprintf("format:%s count:%d", format, len(messages)), "", c.ClientIP(), c.Request.UserAgent())

		if format == "csv" {
			c.Header("Content-Disposition", "attachment; filename=chat_export.csv")
			c.Header("Content-Type", "text/csv")
			writer := csv.NewWriter(c.Writer)
			writer.Write([]string{"ID", "Author", "Content", "Date"})
			for _, m := range messages {
				writer.Write([]string{
					strconv.Itoa(int(m.ID)),
					m.Author.Username,
					m.Content,
					m.CreatedAt.Format(time.RFC3339),
				})
			}
			writer.Flush()
		} else {
			c.Header("Content-Disposition", "attachment; filename=chat_export.json")
			c.JSON(http.StatusOK, messages)
		}
	}
}
