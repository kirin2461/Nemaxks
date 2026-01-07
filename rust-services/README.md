# Communication Platform - Rust Microservices

A scalable, real-time communication backend built with Rust microservices, PostgreSQL, and Redis.

## Architecture

### Technology Stack

- **Language**: Rust with Tokio async runtime
- **Framework**: Axum web framework
- **Database**: PostgreSQL with tokio-postgres
- **Cache**: Redis with connection pooling
- **Containerization**: Docker & Docker Compose
- **API Gateway**: Go (Echo framework) - handles HTTP/WebSocket

### Microservices

1. **Message Service** (Port 8001)
   - Real-time message storage and retrieval
   - Message caching with Redis
   - PostgreSQL persistence

2. **Channel Service** (Port 8002)
   - Channel management
   - User subscriptions
   - Channel metadata

3. **Voice Service** (Port 8003)
   - Voice channel management
   - Session handling
   - Audio stream coordination

4. **Board Service** (Port 8004)
   - Discussion boards
   - Thread management
   - Post aggregation

### Shared Library

Common types and utilities used across all microservices:
- Request/Response models
- Error handling
- Serialization helpers

## Project Structure

```
rust-services/
├── Cargo.toml                 # Workspace configuration
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # Complete infrastructure
├── README.md                  # Documentation
├── shared/                    # Shared library
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
└── services/
    ├── message-service/       # Message handling
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── models.rs
    │       ├── db.rs
    │       ├── cache.rs
    │       └── handlers.rs
    ├── channel-service/       # Channel management
    ├── voice-service/         # Voice features
    └── board-service/         # Discussion boards
```

## Getting Started

### Prerequisites

- Rust 1.70+ (via rustup)
- Docker & Docker Compose
- 4GB RAM minimum

### Local Development

1. Clone the repository
2. Navigate to the rust-services directory
3. Start all services: `docker-compose up -d`
4. Services will be available at:
   - Message Service: `http://localhost:8001`
   - Channel Service: `http://localhost:8002`
   - Voice Service: `http://localhost:8003`
   - Board Service: `http://localhost:8004`

### Building from Source

```bash
cargo build --release
```

## Service Communication

All microservices:
- Share the same PostgreSQL database
- Use Redis for distributed caching
- Communicate via REST APIs
- Support health checks at `/health`

## Database Schema

The platform uses tables for:
- Users
- Guilds (servers/communities)
- Channels
- Messages
- Voice sessions
- Posts/Boards

## Redis Configuration

- Connection pooling with async connection manager
- Key prefix: `comm:{service}:{entity_type}:{id}`
- TTL: 1 hour for messages, 30 mins for sessions

## Scaling Considerations

- Services can run on separate machines
- Database can be scaled with replication
- Redis can use clustering for high availability
- Load balancer recommended for API Gateway

## Next Steps

1. Implement binary builds for each service
2. Add gRPC for inter-service communication
3. Implement distributed tracing with Jaeger
4. Add Prometheus metrics
5. Kubernetes deployment configurations

