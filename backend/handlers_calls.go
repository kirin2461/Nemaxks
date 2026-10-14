package main

import (
        "fmt"
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
)

// startDMCallRequest is the body of POST /api/calls/dm/start
type startDMCallRequest struct {
        PeerID uint `json:"peer_id" binding:"required"`
}

// CallHistoryParticipant — участник звонка в ответе истории
type CallHistoryParticipant struct {
        ID       uint    `json:"id"`
        Username string  `json:"username"`
        Avatar   *string `json:"avatar"`
}

// CallHistoryItem — элемент истории звонков (JSON-контракт из SPEC)
type CallHistoryItem struct {
        ID           uint                    `json:"id"`
        Type         string                  `json:"type"` // dm | voice_channel
        ChannelID    uint                    `json:"channel_id"`
        ChannelName  *string                 `json:"channel_name"`
        Status       string                  `json:"status"`
        StartedAt    time.Time               `json:"started_at"`
        EndedAt      *time.Time              `json:"ended_at"`
        DurationSec  int64                   `json:"duration_sec"`
        Participants []CallHistoryParticipant `json:"participants"`
}

// startDMCallHandler creates a DM call record with the caller and the peer as participants.
// POST /api/calls/dm/start body {"peer_id": uint} -> {"call_id": id}
func startDMCallHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        var req startDMCallRequest
        if err := c.ShouldBindJSON(&req); err != nil || req.PeerID == 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: peer_id required"})
                return
        }

        // Verify peer exists
        var peer User
        if err := db.First(&peer, req.PeerID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Peer not found"})
                return
        }

        now := time.Now()
        call := Call{
                ChannelID: 0,
                Type:      "dm",
                Status:    "ongoing",
                StartedAt: now,
        }
        if err := db.Create(&call).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create call"})
                return
        }

        participants := []CallParticipant{
                {CallID: call.ID, UserID: userID, JoinedAt: now},
                {CallID: call.ID, UserID: req.PeerID, JoinedAt: now},
        }
        if err := db.Create(&participants).Error; err != nil {
                fmt.Printf("Failed to create DM call participants: %v\n", err)
        }

        c.JSON(http.StatusOK, gin.H{"call_id": call.ID})
}

// endDMCallHandler ends a DM call. Only a participant of the call may end it.
// POST /api/calls/dm/:call_id/end -> {"success": true}
func endDMCallHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        callID, err := strconv.ParseUint(c.Param("call_id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid call ID"})
                return
        }

        var call Call
        if err := db.First(&call, uint(callID)).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
                return
        }
        if call.Type != "dm" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Not a DM call"})
                return
        }

        // Only a participant of the call may end it
        var cnt int64
        if err := db.Model(&CallParticipant{}).
                Where("call_id = ? AND user_id = ?", call.ID, userID).
                Count(&cnt).Error; err != nil || cnt == 0 {
                c.JSON(http.StatusForbidden, gin.H{"error": "Not a participant of this call"})
                return
        }

        now := time.Now()
        if call.Status == "ongoing" {
                if err := db.Model(&call).Updates(map[string]interface{}{
                        "status":   "ended",
                        "ended_at": now,
                }).Error; err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to end call"})
                        return
                }
        }

        if err := db.Model(&CallParticipant{}).
                Where("call_id = ? AND left_at IS NULL", call.ID).
                Update("left_at", now).Error; err != nil {
                fmt.Printf("Failed to mark DM call participants left: %v\n", err)
        }

        c.JSON(http.StatusOK, gin.H{"success": true})
}

// getCallHistoryHandler returns calls where the current user is a participant.
// GET /api/calls/history?limit=50 -> []CallHistoryItem
func getCallHistoryHandler(c *gin.Context) {
        userID, ok := getUserIDFromContext(c)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        limit := 50
        if l := c.Query("limit"); l != "" {
                if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
                        limit = parsed
                }
        }

        // IDs of calls where the user is a participant
        var callIDs []uint
        if err := db.Model(&CallParticipant{}).
                Where("user_id = ?", userID).
                Distinct().
                Pluck("call_id", &callIDs).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load call history"})
                return
        }

        items := make([]CallHistoryItem, 0)
        if len(callIDs) == 0 {
                c.JSON(http.StatusOK, items)
                return
        }

        var calls []Call
        if err := db.Where("id IN ?", callIDs).
                Order("started_at DESC").
                Limit(limit).
                Find(&calls).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load call history"})
                return
        }

        // Resolve channel names for voice_channel calls
        channelNames := make(map[uint]string)
        var voiceChannelIDs []uint
        for _, call := range calls {
                if call.Type != "dm" && call.ChannelID != 0 {
                        voiceChannelIDs = append(voiceChannelIDs, call.ChannelID)
                }
        }
        if len(voiceChannelIDs) > 0 {
                var channels []Channel
                if err := db.Select("id", "name").Where("id IN ?", voiceChannelIDs).Find(&channels).Error; err == nil {
                        for _, ch := range channels {
                                channelNames[ch.ID] = ch.Name
                        }
                }
        }

        for _, call := range calls {
                item := CallHistoryItem{
                        ID:        call.ID,
                        Type:      call.Type,
                        ChannelID: call.ChannelID,
                        Status:    call.Status,
                        StartedAt: call.StartedAt,
                        EndedAt:   call.EndedAt,
                }
                if call.Type == "dm" {
                        item.ChannelName = nil
                } else if name, ok := channelNames[call.ChannelID]; ok {
                        item.ChannelName = &name
                }
                if call.EndedAt != nil {
                        item.DurationSec = int64(call.EndedAt.Sub(call.StartedAt).Seconds())
                }

                var participants []CallHistoryParticipant
                if err := db.Table("call_participants").
                        Select("users.id, users.username, users.avatar").
                        Joins("JOIN users ON users.id = call_participants.user_id").
                        Where("call_participants.call_id = ?", call.ID).
                        Scan(&participants).Error; err != nil {
                        fmt.Printf("Failed to load call participants for call %d: %v\n", call.ID, err)
                }
                if participants == nil {
                        participants = make([]CallHistoryParticipant, 0)
                }
                item.Participants = participants

                items = append(items, item)
        }

        c.JSON(http.StatusOK, items)
}
