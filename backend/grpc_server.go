package main

import (
	"context"
	"fmt"
	"log"
	"net"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var grpcServer *grpc.Server

// InitGRPCServer initializes the gRPC server
func InitGRPCServer() error {
	// Create gRPC server with interceptors
	grpcServer = grpc.NewServer(
		grpc.UnaryInterceptor(grpcAuthInterceptor),
		grpc.StreamInterceptor(grpcStreamAuthInterceptor),
	)

	// Register services here (after proto generation)
	// voicepb.RegisterVoiceServiceServer(grpcServer, &VoiceServiceServer{})
	// authpb.RegisterAuthServiceServer(grpcServer, &AuthServiceServer{})
	// channelspb.RegisterChannelsServiceServer(grpcServer, &ChannelsServiceServer{})

	log.Println("✓ gRPC server initialized")
	return nil
}

// StartGRPCServer starts the gRPC server on a separate port
func StartGRPCServer(port string) error {
	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return fmt.Errorf("failed to listen on gRPC port: %w", err)
	}

	log.Printf("🚀 gRPC server listening on :%s", port)
	return grpcServer.Serve(lis)
}

// grpcAuthInterceptor authenticates gRPC requests
func grpcAuthInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	// Skip auth for login/register endpoints
	if info.FullMethod == "/auth.v1.AuthService/Login" ||
		info.FullMethod == "/auth.v1.AuthService/Register" {
		return handler(ctx, req)
	}

	// Extract token from metadata
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.Unauthenticated, "missing metadata")
	}

	tokens := md.Get("authorization")
	if len(tokens) == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "missing authorization token")
	}

	token := tokens[0]
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Validate JWT token (reuse existing validateToken function)
	userID, err := validateToken(token)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
	}

	// Add user ID to context
	ctx = context.WithValue(ctx, "user_id", userID)

	return handler(ctx, req)
}

// grpcStreamAuthInterceptor authenticates streaming gRPC requests
func grpcStreamAuthInterceptor(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	// Extract token from metadata
	md, ok := metadata.FromIncomingContext(ss.Context())
	if !ok {
		return status.Errorf(codes.Unauthenticated, "missing metadata")
	}

	tokens := md.Get("authorization")
	if len(tokens) == 0 {
		return status.Errorf(codes.Unauthenticated, "missing authorization token")
	}

	token := tokens[0]
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Validate JWT token
	userID, err := validateToken(token)
	if err != nil {
		return status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
	}

	// Create wrapped stream with user context
	wrappedStream := &authenticatedStream{
		ServerStream: ss,
		ctx:          context.WithValue(ss.Context(), "user_id", userID),
	}

	return handler(srv, wrappedStream)
}

// authenticatedStream wraps grpc.ServerStream with authenticated context
type authenticatedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *authenticatedStream) Context() context.Context {
	return s.ctx
}

// Helper function to validate JWT token and return user ID
func validateToken(tokenString string) (uint, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte("your-secret-key"), nil
	})

	if err != nil {
		return 0, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return 0, fmt.Errorf("token is not valid")
	}

	claims, ok := token.Claims.(*jwt.MapClaims)
	if !ok {
		return 0, fmt.Errorf("invalid claims")
	}

	userIDFloat, ok := (*claims)["user_id"].(float64)
	if !ok {
		return 0, fmt.Errorf("user_id not found in token")
	}

	return uint(userIDFloat), nil
}

// StopGRPCServer gracefully stops the gRPC server
func StopGRPCServer() {
	if grpcServer != nil {
		log.Println("Stopping gRPC server...")
		grpcServer.GracefulStop()
	}
}
