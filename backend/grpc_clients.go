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

// SearchMessagesViaGRPC calls Rust search service with SQL fallback
func SearchMessagesViaGRPC(query, channelID, guildID, authorID string, limit, offset int) (interface{}, error) {
        // Validate query to prevent expensive searches
        if len(query) < 3 {
                return nil, fmt.Errorf("query must be at least 3 characters")
        }
        if len(query) > 100 {
                query = query[:100] // Truncate to prevent oversized queries
        }
        
        grpcMutex.RLock()
        defer grpcMutex.RUnlock()

        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()

        if searchClient == nil {
                // Fallback to SQL LIKE search when gRPC service is unavailable
                log.Println("[gRPC] Search client not initialized, using SQL fallback")
                return searchMessagesSQL(ctx, query, channelID, guildID, authorID, limit, offset)
        }

        // TODO: Call gRPC client when proto is implemented
        // result, err := searchClient.SearchMessages(ctx, &pb.SearchMessagesRequest{...})
        // For now, fallback to SQL until gRPC proto is implemented
        return searchMessagesSQL(ctx, query, channelID, guildID, authorID, limit, offset)
}

// searchMessagesSQL performs SQL-based message search as fallback
func searchMessagesSQL(ctx context.Context, query, channelID, guildID, authorID string, limit, offset int) ([]Message, error) {
        var messages []Message
        
        // Use context for database query cancellation
        dbQuery := db.WithContext(ctx).Model(&Message{}).Where("content ILIKE ?", "%"+query+"%")
        
        if channelID != "" {
                dbQuery = dbQuery.Where("channel_id = ?", channelID)
        }
        if guildID != "" {
                dbQuery = dbQuery.Joins("JOIN channels ON messages.channel_id = channels.id").
                        Where("channels.guild_id = ?", guildID)
        }
        if authorID != "" {
                dbQuery = dbQuery.Where("user_id = ?", authorID)
        }
        
        if limit <= 0 || limit > 100 {
                limit = 50 // Cap at 100 for performance
        }
        
        if err := dbQuery.Order("created_at DESC").Limit(limit).Offset(offset).Find(&messages).Error; err != nil {
                return nil, err
        }
        
        return messages, nil
}
