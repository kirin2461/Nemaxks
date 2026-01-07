package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ToolVersion - одна версия инструмента в истории
type ToolVersion struct {
	ID                uint   `json:"id" gorm:"primaryKey"`
	ToolID            uint   `json:"tool_id"`
	VersionNum        int    `json:"version_number"`
	Title             string `json:"title"`
	Content           string `json:"content"` // JSON содержание
	ChangedBy         uint   `json:"changed_by"`
	ChangeDescription string `json:"change_description"`
	CreatedAt         int64  `json:"created_at"`
}

// HandleGetToolVersionHistory - получить историю всех версий
func HandleGetToolVersionHistory(c *gin.Context) {
	toolIDStr := c.Param("tool_id")
	toolID, err := strconv.Atoi(toolIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tool ID"})
		return
	}

	var versions []ToolVersion
	if err := db.Where("tool_id = ?", toolID).Order("version_num ASC").Find(&versions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tool_id":        toolID,
		"total_versions": len(versions),
		"versions":       versions,
	})
}

// HandleRestoreToolVersion - восстановить инструмент на старую версию
func HandleRestoreToolVersion(c *gin.Context) {
	toolIDStr := c.Param("tool_id")
	toolID, err := strconv.Atoi(toolIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tool ID"})
		return
	}

	versionStr := c.Query("version")
	versionNum, err := strconv.Atoi(versionStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
		return
	}

	// Получить целевую версию
	var targetVersion ToolVersion
	if err := db.Where("tool_id = ? AND version_num = ?", toolID, versionNum).First(&targetVersion).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version not found"})
		return
	}

	// Обновить инструмент
	var tool ChannelTool
	db.First(&tool, toolID)
	updates := map[string]interface{}{
		"title":      targetVersion.Title,
		"content":    targetVersion.Content,
		"updated_at": time.Now().Unix(),
	}
	db.Model(&tool).Updates(updates)

	c.JSON(http.StatusOK, gin.H{"message": "Version restored", "version": versionNum})
}
