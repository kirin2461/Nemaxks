package main

import (
        "crypto/rand"
        "encoding/hex"
        "net/http"
        "time"

        "github.com/gin-gonic/gin"
)

func generateReferralCode() string {
        bytes := make([]byte, 6)
        rand.Read(bytes)
        return hex.EncodeToString(bytes)
}

func getMyReferralHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var referral UserReferral
        if db.Where("user_id = ?", uid).First(&referral).RowsAffected == 0 {
                referral = UserReferral{
                        UserID:    uid,
                        Code:      generateReferralCode(),
                        CreatedAt: time.Now(),
                }
                db.Create(&referral)
        }

        var user User
        db.First(&user, uid)

        c.JSON(http.StatusOK, gin.H{
                "code":         referral.Code,
                "invite_count": referral.InviteCount,
                "username":     user.Username,
        })
}

func getReferralInfoHandler(c *gin.Context) {
        code := c.Param("code")

        var referral UserReferral
        if db.Where("code = ?", code).First(&referral).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Invalid invite code"})
                return
        }

        var user User
        db.First(&user, referral.UserID)

        c.JSON(http.StatusOK, gin.H{
                "code":       referral.Code,
                "inviter":    user.Username,
                "inviter_id": user.ID,
                "avatar":     user.Avatar,
        })
}

func useReferralHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))
        code := c.Param("code")

        var referral UserReferral
        if db.Where("code = ?", code).First(&referral).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Invalid invite code"})
                return
        }

        if referral.UserID == uid {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot use your own invite code"})
                return
        }

        var existing ReferralUse
        if db.Where("invited_user_id = ?", uid).First(&existing).RowsAffected > 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Already used an invite code"})
                return
        }

        referralUse := ReferralUse{
                ReferralID:    referral.ID,
                InvitedUserID: uid,
                CreatedAt:     time.Now(),
        }
        db.Create(&referralUse)

        referral.InviteCount++
        db.Save(&referral)

        var inviter User
        db.First(&inviter, referral.UserID)

        friendRequest := FriendRequest{
                RequesterID: referral.UserID,
                AddresseeID: uid,
                Status:      "accepted",
                CreatedAt:   time.Now(),
        }

        var existingFR FriendRequest
        if db.Where("(requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
                referral.UserID, uid, uid, referral.UserID).First(&existingFR).RowsAffected == 0 {
                db.Create(&friendRequest)
        }

        c.JSON(http.StatusOK, gin.H{
                "status":  "success",
                "inviter": inviter.Username,
        })
}

func getMyReferralsHandler(c *gin.Context) {
        userID, _ := c.Get("user_id")
        uid := uint(userID.(float64))

        var referral UserReferral
        if db.Where("user_id = ?", uid).First(&referral).RowsAffected == 0 {
                c.JSON(http.StatusOK, gin.H{"invited_users": []interface{}{}, "count": 0})
                return
        }

        var uses []ReferralUse
        db.Where("referral_id = ?", referral.ID).Order("created_at DESC").Find(&uses)

        var invitedUsers []gin.H
        for _, use := range uses {
                var user User
                if db.First(&user, use.InvitedUserID).RowsAffected > 0 {
                        invitedUsers = append(invitedUsers, gin.H{
                                "id":         user.ID,
                                "username":   user.Username,
                                "avatar":     user.Avatar,
                                "invited_at": use.CreatedAt,
                        })
                }
        }

        c.JSON(http.StatusOK, gin.H{
                "invited_users": invitedUsers,
                "count":         len(invitedUsers),
        })
}
