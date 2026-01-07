package main

import (
        "context"
        "fmt"
        "log"
        "sync"
        "time"

        "google.golang.org/grpc"
        "google.golang.org/grpc/credentials/insecure"
)

var (
        auditClient interface{}
        searchClient interface{}
        grpcMutex sync.RWMutex
)

// InitGRPCClients initializes connections to Rust microservices
func InitGRPCClients() error {
        grpcMutex.Lock()
        defer grpcMutex.Unlock()

        // Connect to Audit Service
        auditConn, err := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
        if err != nil {
                return fmt.Errorf("failed to dial audit service: %w", err)
        }
        // auditClient = pb.NewAuditServiceClient(auditConn)
        log.Println("[gRPC] Connected to Audit Service")
        _ = auditConn // Keep connection alive

        // Connect to Search Service
        searchConn, err := grpc.Dial("localhost:50052", grpc.WithTransportCredentials(insecure.NewCredentials()))
        if err != nil {
                return fmt.Errorf("failed to dial search service: %w", err)
        }
        // searchClient = pb.NewSearchServiceClient(searchConn)
        log.Println("[gRPC] Connected to Search Service")
        _ = searchConn // Keep connection alive

        return nil
}

// LogAuditViaGRPC sends audit log to Rust service (async)
func LogAuditViaGRPC(userID uint, action, targetType, targetID, scope, details, ip, ua string) {
        go func() {
                grpcMutex.RLock()
                defer grpcMutex.RUnlock()

                if auditClient == nil {
                        log.Println("[gRPC] Audit client not initialized, falling back to direct DB write")
                        logExtendedAudit(userID, action, targetType, targetID, scope, details, ip, ua)
                        return
                }

                _, cancel := context.WithTimeout(context.Background(), 5*time.Second)
                defer cancel()

                // Call would be: auditClient.LogEvent(ctx, &pb.LogEventRequest{...})
                // For now, fallback to direct write
                logExtendedAudit(userID, action, targetType, targetID, scope, details, ip, ua)
        }()
}

// SearchMessagesViaGRPC calls Rust search service
func SearchMessagesViaGRPC(query, channelID, guildID, authorID string, limit, offset int) (interface{}, error) {
        grpcMutex.RLock()
        defer grpcMutex.RUnlock()

        if searchClient == nil {
                // Fallback to SQL search
                log.Println("[gRPC] Search client not initialized, falling back to SQL")
                return nil, fmt.Errorf("search service unavailable")
        }

        _, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()

        // Call would be: searchClient.SearchMessages(ctx, &pb.SearchMessagesRequest{...})
        // For now, placeholder
        return nil, fmt.Errorf("search service call not yet implemented")
}
