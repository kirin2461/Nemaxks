package main

import (
        "encoding/json"
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

// HandleGetChannelTool возвращает один инструмент канала по ID.
// GET /api/channels/tools/:tool_id → 200 tool object, 404 если нет.
func HandleGetChannelTool(c *gin.Context) {
        toolID, err := strconv.ParseUint(c.Param("tool_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tool ID"})
                return
        }

        var tool ChannelTool
        if err := db.First(&tool, toolID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Tool not found"})
                return
        }

        c.JSON(http.StatusOK, tool)
}

// ToolSnapshotResponse — снапшот с username автора (join users).
type ToolSnapshotResponse struct {
        ID          uint      `json:"id"`
        Name        string    `json:"name"`
        Description string    `json:"description"`
        ChangeType  string    `json:"change_type"`
        UserID      uint      `json:"user_id"`
        Username    string    `json:"username"`
        CreatedAt   time.Time `json:"created_at"`
}

// loadToolOr404 загружает инструмент или отвечает 404/400. Возвращает nil, если ответ уже отправлен.
func loadToolOr404(c *gin.Context) *ChannelTool {
        toolID, err := strconv.ParseUint(c.Param("tool_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tool ID"})
                return nil
        }

        var tool ChannelTool
        if err := db.First(&tool, toolID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Tool not found"})
                return nil
        }
        return &tool
}

// HandleGetToolSnapshots — список снапшотов инструмента, created_at DESC, с username автора.
// GET /api/channels/tools/:tool_id/snapshots
func HandleGetToolSnapshots(c *gin.Context) {
        tool := loadToolOr404(c)
        if tool == nil {
                return
        }

        var snapshots []ToolSnapshotResponse
        if err := db.Table("tool_snapshots").
                Select("tool_snapshots.id, tool_snapshots.name, tool_snapshots.description, tool_snapshots.change_type, tool_snapshots.user_id, COALESCE(users.username, '') AS username, tool_snapshots.created_at").
                Joins("LEFT JOIN users ON users.id = tool_snapshots.user_id").
                Where("tool_snapshots.tool_id = ?", tool.ID).
                Order("tool_snapshots.created_at DESC").
                Scan(&snapshots).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load snapshots"})
                return
        }
        if snapshots == nil {
                snapshots = []ToolSnapshotResponse{}
        }

        c.JSON(http.StatusOK, gin.H{"snapshots": snapshots})
}

// HandleCreateToolSnapshot — ручной именованный снапшот текущего состояния.
// POST /api/channels/tools/:tool_id/snapshots {name, description} → 201 {id}
func HandleCreateToolSnapshot(c *gin.Context) {
        tool := loadToolOr404(c)
        if tool == nil {
                return
        }

        userID, _ := getUserIDFromContext(c)

        var req struct {
                Name        string `json:"name" binding:"required"`
                Description string `json:"description"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        snapshot := ToolSnapshot{
                ToolID:      tool.ID,
                Name:        req.Name,
                Content:     tool.Content,
                UserID:      userID,
                ChangeType:  "manual",
                Description: req.Description,
                CreatedAt:   time.Now(),
        }
        if err := db.Create(&snapshot).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create snapshot"})
                return
        }

        // Ограничение истории: последние 100 снапшотов (как в SaveToolSnapshot)
        var count int64
        db.Model(&ToolSnapshot{}).Where("tool_id = ?", tool.ID).Count(&count)
        if count > 100 {
                var oldest []ToolSnapshot
                db.Where("tool_id = ?", tool.ID).Order("created_at ASC").Limit(int(count - 100)).Find(&oldest)
                for _, s := range oldest {
                        db.Delete(&s)
                }
        }

        c.JSON(http.StatusCreated, gin.H{"id": snapshot.ID})
}

// HandleRestoreToolSnapshot — восстановление состояния инструмента из снапшота.
// POST /api/channels/tools/:tool_id/snapshots/:snapshot_id/restore
// Перед восстановлением сохраняет pre_restore снапшот, затем Content = snapshot.Content,
// broadcast sync_state в сессию, ответ {status:"restored"}.
func HandleRestoreToolSnapshot(c *gin.Context) {
        tool := loadToolOr404(c)
        if tool == nil {
                return
        }

        snapshotID, err := strconv.ParseUint(c.Param("snapshot_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid snapshot ID"})
                return
        }

        var snapshot ToolSnapshot
        if err := db.Where("id = ? AND tool_id = ?", snapshotID, tool.ID).First(&snapshot).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Snapshot not found"})
                return
        }

        userID, _ := getUserIDFromContext(c)

        // Сохраняем текущее состояние перед восстановлением
        if err := SaveToolSnapshot(tool.ID, "", "", userID, "pre_restore"); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save pre-restore snapshot"})
                return
        }

        tool.Content = snapshot.Content
        tool.UpdatedAt = GetCurrentTimestamp()
        if err := db.Save(tool).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore tool"})
                return
        }

        // Broadcast нового состояния в сессию совместного редактирования
        var state interface{}
        if err := json.Unmarshal([]byte(snapshot.Content), &state); err != nil {
                state = snapshot.Content
        }
        session := GetOrCreateSession(tool.ID)
        session.BroadcastState(state)

        c.JSON(http.StatusOK, gin.H{"status": "restored"})
}
