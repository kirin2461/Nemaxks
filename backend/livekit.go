package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/livekit/protocol/auth"
	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

var (
	livekitClient *lksdk.RoomServiceClient
)

func boolPtr(b bool) *bool { return &b }

// InitLiveKit initializes LiveKit client
func InitLiveKit() error {
	host := os.Getenv("LIVEKIT_URL")
	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")

	if host == "" || apiKey == "" || apiSecret == "" {
		return fmt.Errorf("LiveKit credentials not configured")
	}

	livekitClient = lksdk.NewRoomServiceClient(host, apiKey, apiSecret)
	return nil
}

// GenerateLiveKitToken generates an access token for a user to join a room
func GenerateLiveKitToken(roomName, userID, username string) (string, error) {
	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")

	if apiKey == "" || apiSecret == "" {
		return "", fmt.Errorf("LiveKit credentials not configured")
	}

	// Create access token
	at := auth.NewAccessToken(apiKey, apiSecret)
	grant := &auth.VideoGrant{
		RoomJoin:      true,
		Room:          roomName,
		CanPublish:    boolPtr(true),
		CanSubscribe:  boolPtr(true),
		CanPublishData: boolPtr(true),
	}

	at.AddGrant(grant).
		SetIdentity(userID).
		SetName(username).
		SetValidFor(24 * time.Hour) // Token valid for 24 hours

	return at.ToJWT()
}

// CreateLiveKitRoom creates a new LiveKit room
func CreateLiveKitRoom(roomName string, maxParticipants uint32) error {
	if livekitClient == nil {
		return fmt.Errorf("LiveKit client not initialized")
	}

	_, err := livekitClient.CreateRoom(context.Background(), &livekit.CreateRoomRequest{
		Name:            roomName,
		EmptyTimeout:    10 * 60, // 10 minutes
		MaxParticipants: maxParticipants,
	})

	return err
}

// ListLiveKitRooms lists all active LiveKit rooms
func ListLiveKitRooms() ([]*livekit.Room, error) {
	if livekitClient == nil {
		return nil, fmt.Errorf("LiveKit client not initialized")
	}

	res, err := livekitClient.ListRooms(context.Background(), &livekit.ListRoomsRequest{})
	if err != nil {
		return nil, err
	}

	return res.Rooms, nil
}

// GetLiveKitRoomParticipants gets participants in a room
func GetLiveKitRoomParticipants(roomName string) ([]*livekit.ParticipantInfo, error) {
	if livekitClient == nil {
		return nil, fmt.Errorf("LiveKit client not initialized")
	}

	res, err := livekitClient.ListParticipants(context.Background(), &livekit.ListParticipantsRequest{
		Room: roomName,
	})
	if err != nil {
		return nil, err
	}

	return res.Participants, nil
}

// DeleteLiveKitRoom deletes a LiveKit room
func DeleteLiveKitRoom(roomName string) error {
	if livekitClient == nil {
		return fmt.Errorf("LiveKit client not initialized")
	}

	_, err := livekitClient.DeleteRoom(context.Background(), &livekit.DeleteRoomRequest{
		Room: roomName,
	})

	return err
}
