package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Request DM Access (Admin only)
func requestDMAccessHandler(c *gin.Context) {
	userIDRaw, _ := c.Get("user_id")
	adminID, _ := extractUserID(userIDRaw)

	// Guard: Admin or SuperAdmin
	if !hasGlobalRole(adminID, "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can request DM access"})
		return
	}

	var req struct {
		TargetUserID uint   `json:"target_user_id" binding:"required"`
		Reason       string `json:"reason" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	sanction := DMAccessSanction{
		RequestedBy: adminID,
		TargetUserID: req.TargetUserID,
		Reason:      req.Reason,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}
	db.Create(&sanction)

	logExtendedAudit(adminID, "dm_access_request", "user", strconv.FormatUint(uint64(req.TargetUserID), 10),
		"pending_approval", req.Reason, c.ClientIP(), c.Request.UserAgent())

	c.JSON(http.StatusCreated, gin.H{"id": sanction.ID, "status": "pending"})
}

// Approve DM Access (SuperAdmin only)
func approveDMAccessHandler(c *gin.Context) {
	userIDRaw, _ := c.Get("user_id")
	superAdminID, _ := extractUserID(userIDRaw)

	// Guard: SuperAdmin only
	if !hasGlobalRole(superAdminID, "super_admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only super_admin can approve DM access"})
		return
	}

	requestID, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var sanction DMAccessSanction
	if err := db.First(&sanction, requestID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	expiresAt := time.Now().Add(24 * time.Hour) // 24h window
	sanction.Status = "approved"
	sanction.ApprovedBy = &superAdminID
	sanction.ExpiresAt = &expiresAt
	sanction.UpdatedAt = time.Now()
	db.Save(&sanction)

	logExtendedAudit(superAdminID, "dm_access_approve", "sanction", strconv.FormatUint(uint64(sanction.ID), 10),
		fmt.Sprintf("target:%d expires:%s", sanction.TargetUserID, expiresAt.Format(time.RFC3339)), "", c.ClientIP(), c.Request.UserAgent())

	c.JSON(http.StatusOK, gin.H{"status": "approved", "expires_at": expiresAt})
}

// Revoke DM Access (SuperAdmin)
func revokeDMAccessHandler(c *gin.Context) {
	userIDRaw, _ := c.Get("user_id")
	superAdminID, _ := extractUserID(userIDRaw)

	// Guard: SuperAdmin only
	if !hasGlobalRole(superAdminID, "super_admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only super_admin can revoke DM access"})
		return
	}

	requestID, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	db.Model(&DMAccessSanction{}).Where("id = ?", requestID).Updates(map[string]interface{}{
		"status": "revoked",
		"updated_at": time.Now(),
	})

	logExtendedAudit(superAdminID, "dm_access_revoke", "sanction", strconv.FormatUint(uint64(requestID), 10),
		"revoked_early", "", c.ClientIP(), c.Request.UserAgent())

	c.JSON(http.StatusOK, gin.H{"status": "revoked"})
}
