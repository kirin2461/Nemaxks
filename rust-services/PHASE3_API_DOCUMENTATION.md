# Phase 3: Microservices API Documentation

## Overview

Phase 3 implements production-ready HTTP servers for all microservices with:
- Complete Axum HTTP routes
- Comprehensive error handling
- Health check endpoints
- Database migration scripts
- Structured logging and tracing

## Message Service (Port 8001)

### Endpoints

#### POST /api/messages
Create a new message
```bash
curl -X POST http://localhost:8001/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "uuid",
    "user_id": "uuid",
    "content": "Hello world"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message_id": "uuid",
  "timestamp": "2024-01-03T06:00:00Z"
}
```

#### GET /api/messages/:id
Fetch a specific message
```bash
curl http://localhost:8001/api/messages/uuid
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "content": "Sample message",
  "timestamp": "2024-01-03T06:00:00Z"
}
```

#### GET /api/channels/:channel_id/messages
List messages in a channel
```bash
curl http://localhost:8001/api/channels/uuid/messages
```

**Response (200 OK):**
```json
{
  "channel_id": "uuid",
  "messages": [],
  "total": 0
}
```

#### GET /health
Service health check
```bash
curl http://localhost:8001/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "message-service",
  "timestamp": "2024-01-03T06:00:00Z"
}
```

## Channel Service (Port 8002)

### Endpoints

#### POST /api/channels
Create a new channel
```bash
curl -X POST http://localhost:8002/api/channels \
  -H "Content-Type: application/json" \
  -d '{"name": "general"}'
```

#### GET /api/channels/:id
Get channel details
```bash
curl http://localhost:8002/api/channels/uuid
```

#### POST /api/channels/:id/subscribe
Subscribe to a channel
```bash
curl -X POST http://localhost:8002/api/channels/uuid/subscribe
```

#### GET /health
Service health check

## Voice Service (Port 8003)

### Endpoints

#### GET /health
Service health check

#### GET /api/status
Service status

## Board Service (Port 8004)

### Endpoints

#### GET /health
Service health check

#### GET /api/status
Service status

## Error Handling

All services return consistent error responses:

```json
{
  "error": "Descriptive error message",
  "status": 400
}
```

### HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Guilds Table
```sql
CREATE TABLE guilds (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id BIGINT REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Channels Table
```sql
CREATE TABLE channels (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL,
  guild_id BIGINT REFERENCES guilds(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'text',
  position BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL,
  channel_id BIGINT REFERENCES channels(id),
  user_id BIGINT REFERENCES users(id),
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

## Running the Services

### With Docker Compose
```bash
docker-compose up -d
```

### Locally
```bash
# Terminal 1: Start database and cache
docker-compose up -d postgres redis

# Terminal 2: Run message service
cd services/message-service
cargo run

# Terminal 3: Run channel service
cd services/channel-service
cargo run
```

## Logging

All services use structured logging with tracing. Set log level:
```bash
RUST_LOG=debug cargo run
```

## Testing

### Health Checks
```bash
for port in 8001 8002 8003 8004; do
  echo "Testing port $port"
  curl -s http://localhost:$port/health | jq
done
```

## Files Created in Phase 3

- `services/message-service/src/main.rs` - Message service binary
- `services/message-service/src/error.rs` - Error handling
- `services/channel-service/src/main.rs` - Channel service binary
- `services/voice-service/src/main.rs` - Voice service binary
- `services/board-service/src/main.rs` - Board service binary
- `migrations/001_init_schema.sql` - Database schema
- Updated `Cargo.toml` files with binary targets

