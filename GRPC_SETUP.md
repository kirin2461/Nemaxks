# 🚀 gRPC + REST API + Envoy Integration Guide

## 📋 Architecture Overview

```
┌─────────────┐
│   Clients   │
│ (Web/Mobile)│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│      Envoy Proxy (Port 8080)    │
│  ┌──────────────────────────┐   │
│  │   gRPC-Web Support       │   │
│  │   CORS Handling          │   │
│  │   Load Balancing         │   │
│  │   HTTP/1.1 → gRPC        │   │
│  └──────────────────────────┘   │
└──────────┬──────────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌──────────┐
│ REST API│ │  gRPC    │
│  :8000  │ │  :9090   │
│  (Gin)  │ │ (Go)     │
└────┬────┘ └────┬─────┘
     │           │
     └─────┬─────┘
           ▼
    ┌─────────────┐
    │  Backend    │
    │  Services   │
    │  ┌────────┐ │
    │  │ Redis  │ │
    │  │LiveKit │ │
    │  │Postgres│ │
    │  └────────┘ │
    └─────────────┘
```

## 🎯 What You Get

### 1. **Triple API Support**
- ✅ **REST API** (existing) - `/api/*` routes
- ✅ **gRPC** - High-performance RPC
- ✅ **gRPC-Web** - gRPC from browser

### 2. **Unified Entry Point**
- **Single Port (8080)** - All traffic through Envoy
- **Smart Routing** - Automatically routes to REST or gRPC
- **Protocol Translation** - HTTP/1.1 ↔ HTTP/2 (gRPC)

### 3. **Production Features**
- Load balancing
- CORS handling
- Health checks
- Admin interface (:9901)
- Graceful degradation

---

## 📁 File Structure

```
911/
├── proto/                      # Protocol Buffer definitions
│   ├── voice.proto            # Voice service (LiveKit, participants, events)
│   ├── auth.proto             # Authentication service
│   └── channels.proto         # Channels & messages service
├── backend/
│   ├── proto/                 # Generated Go code (after make proto)
│   │   ├── voice/
│   │   ├── auth/
│   │   └── channels/
│   ├── grpc_server.go         # gRPC server implementation
│   ├── redis.go               # Redis client
│   ├── livekit.go             # LiveKit integration
│   └── main.go                # Main server (REST + gRPC)
├── envoy.yaml                 # Envoy proxy configuration
├── docker-compose.yml         # All services (Envoy, Redis, LiveKit, Postgres)
├── Makefile                   # Proto generation commands
└── .env.example               # Environment configuration
```

---

## 🔧 Setup Guide

### Prerequisites

1. **Install Protocol Buffers Compiler**
   ```bash
   # macOS
   brew install protobuf

   # Ubuntu/Debian
   sudo apt install -y protobuf-compiler

   # Windows (use Chocolatey)
   choco install protoc

   # Or download from: https://github.com/protocolbuffers/protobuf/releases
   ```

2. **Install Go** (if not installed)
   - Download from https://go.dev/dl/

### Step 1: Install Proto Plugins

```bash
cd /path/to/911
make proto-install
```

This installs:
- `protoc-gen-go` - Generate Go structs
- `protoc-gen-go-grpc` - Generate gRPC service code
- `protoc-gen-grpc-gateway` - Generate REST-to-gRPC gateway
- `googleapis` - Google API annotations for HTTP transcoding

### Step 2: Generate Code from Proto Files

```bash
make proto
```

This generates:
- `backend/proto/voice/voice.pb.go` - Voice service messages
- `backend/proto/voice/voice_grpc.pb.go` - Voice service gRPC server/client
- `backend/proto/auth/*` - Auth service code
- `backend/proto/channels/*` - Channels service code

### Step 3: Start Infrastructure

```bash
# Start Envoy, Redis, LiveKit, Postgres
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f envoy
```

### Step 4: Run Backend

```bash
# Terminal 1: REST API (Gin)
cd backend
go mod tidy
go run . --rest

# Terminal 2: gRPC Server
cd backend
go run . --grpc

# Or run both together:
go run . --both
```

---

## 🌐 API Endpoints

### Envoy Proxy Routes (Port 8080)

| Route Pattern | Backend | Protocol | Description |
|---------------|---------|----------|-------------|
| `/api/*` | REST:8000 | HTTP/1.1 | Existing REST API |
| `/ws` | REST:8000 | WebSocket | Real-time events |
| `/v1/*` | gRPC:9090 | gRPC/HTTP2 | gRPC services via HTTP |
| `/voice.v1.*` | gRPC:9090 | gRPC | Direct gRPC calls |
| `/auth.v1.*` | gRPC:9090 | gRPC | Direct gRPC calls |
| `/channels.v1.*` | gRPC:9090 | gRPC | Direct gRPC calls |
| `/health` | REST:8000 | HTTP/1.1 | Health check |

### Voice Service (gRPC)

**Get LiveKit Token**
```bash
# gRPC
grpcurl -d '{"channel_id": "1", "room_name": "voice-1"}' \
  -H 'authorization: Bearer YOUR_TOKEN' \
  localhost:9090 voice.v1.VoiceService/GetToken

# REST (via Envoy transcoding)
curl -X POST http://localhost:8080/v1/voice/token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel_id": "1", "room_name": "voice-1"}'
```

**Get Participants**
```bash
# gRPC
grpcurl -H 'authorization: Bearer YOUR_TOKEN' \
  localhost:9090 voice.v1.VoiceService/GetParticipants

# REST
curl http://localhost:8080/v1/voice/channels/1/participants \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Stream Voice Events** (gRPC only)
```bash
grpcurl -H 'authorization: Bearer YOUR_TOKEN' \
  -d '{"channel_id": "1"}' \
  localhost:9090 voice.v1.VoiceService/StreamVoiceEvents
```

### Auth Service (gRPC)

**Register**
```bash
# gRPC
grpcurl -d '{"username":"user1","email":"user@example.com","password":"pass123"}' \
  localhost:9090 auth.v1.AuthService/Register

# REST
curl -X POST http://localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","email":"user@example.com","password":"pass123"}'
```

**Login**
```bash
# gRPC
grpcurl -d '{"email":"user@example.com","password":"pass123"}' \
  localhost:9090 auth.v1.AuthService/Login

# REST
curl -X POST http://localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'
```

### Channels Service (gRPC)

**Get Channels**
```bash
# gRPC
grpcurl -H 'authorization: Bearer YOUR_TOKEN' \
  -d '{"guild_id": "1"}' \
  localhost:9090 channels.v1.ChannelsService/GetChannels

# REST
curl http://localhost:8080/v1/guilds/1/channels \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Stream Messages** (gRPC only)
```bash
grpcurl -H 'authorization: Bearer YOUR_TOKEN' \
  -d '{"channel_id": "1"}' \
  localhost:9090 channels.v1.ChannelsService/StreamMessages
```

---

## 🎨 Frontend Integration

### Using gRPC-Web (Browser)

Install gRPC-Web:
```bash
cd frontend
npm install @improbable-eng/grpc-web google-protobuf
```

Generate TypeScript types:
```bash
# Install protoc plugin
npm install -g protoc-gen-ts

# Generate
protoc -I proto \
  --js_out=import_style=commonjs:frontend/src/proto \
  --grpc-web_out=import_style=typescript,mode=grpcwebtext:frontend/src/proto \
  proto/*.proto
```

Example client:
```typescript
import { VoiceServiceClient } from './proto/voice_grpc_web_pb'
import { GetTokenRequest } from './proto/voice_pb'

const client = new VoiceServiceClient('http://localhost:8080')

// Get voice token
const request = new GetTokenRequest()
request.setChannelId('1')
request.setRoomName('voice-1')

const metadata = {
  'authorization': `Bearer ${token}`
}

client.getToken(request, metadata, (err, response) => {
  if (err) {
    console.error(err)
  } else {
    console.log('Token:', response.getToken())
    console.log('URL:', response.getUrl())
  }
})
```

### Using REST API (Existing)

```typescript
// No changes needed! Existing REST calls work through Envoy
fetch('http://localhost:8080/api/livekit/token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel_id: '1',
    room_name: 'voice-1'
  })
})
```

---

## 🔍 Monitoring & Debugging

### Envoy Admin Interface

Access at `http://localhost:9901`

Useful endpoints:
- `/stats` - Metrics and statistics
- `/clusters` - Backend cluster health
- `/config_dump` - Current configuration
- `/logging` - Change log levels

### Test Endpoints

```bash
# Check Envoy health
curl http://localhost:9901/ready

# Check backend health (via Envoy)
curl http://localhost:8080/health

# List gRPC services
grpcurl localhost:9090 list

# Describe a service
grpcurl localhost:9090 describe voice.v1.VoiceService

# Test with grpcui (interactive UI)
grpcui -plaintext localhost:9090
```

### Logs

```bash
# Envoy logs
docker logs -f nemaks-envoy

# View all services
docker-compose logs -f

# View specific service
docker-compose logs -f envoy
docker-compose logs -f redis
docker-compose logs -f livekit
```

---

## 📊 Performance Comparison

| Metric | REST API | gRPC | gRPC-Web |
|--------|----------|------|----------|
| Protocol | HTTP/1.1 | HTTP/2 | HTTP/1.1 + Binary |
| Serialization | JSON | Protobuf | Protobuf |
| Size (avg) | 100% | 30% | 40% |
| Speed | 1x | 3-5x | 2-3x |
| Streaming | ❌ | ✅ | ✅ |
| Browser Support | ✅ | ❌ | ✅ |
| Type Safety | ❌ | ✅ | ✅ |

**Recommendation:**
- **REST**: Web apps, simple requests, existing code
- **gRPC**: Microservices, high-throughput, streaming
- **gRPC-Web**: Modern web apps needing performance

---

## 🛠️ Development Workflow

### 1. Modify Proto Files

Edit `proto/voice.proto`:
```protobuf
service VoiceService {
  rpc NewMethod(NewRequest) returns (NewResponse) {}
}
```

### 2. Regenerate Code

```bash
make proto
```

### 3. Implement gRPC Method

Create `backend/grpc_voice.go`:
```go
func (s *VoiceServiceServer) NewMethod(ctx context.Context, req *voicepb.NewRequest) (*voicepb.NewResponse, error) {
    // Implementation
    return &voicepb.NewResponse{}, nil
}
```

### 4. Test

```bash
grpcurl -d '{}' localhost:9090 voice.v1.VoiceService/NewMethod
```

---

## 🚀 Production Deployment

### 1. Update Envoy for Production

Edit `envoy.yaml`:
```yaml
clusters:
- name: grpc_backend
  load_assignment:
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: your-backend-service  # Not localhost
              port_value: 9090
```

### 2. Enable HTTPS

Add TLS termination to Envoy:
```yaml
listeners:
- name: listener_0
  filter_chains:
  - filters:
    transport_socket:
      name: envoy.transport_sockets.tls
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
        common_tls_context:
          tls_certificates:
          - certificate_chain:
              filename: "/etc/ssl/cert.pem"
            private_key:
              filename: "/etc/ssl/key.pem"
```

### 3. Environment Variables

Production `.env`:
```env
PORT=8000
GRPC_PORT=9090
ENVOY_PORT=443

# Use production URLs
REDIS_URL=redis-cluster:6379
LIVEKIT_URL=wss://livekit.yourdomain.com
```

### 4. Docker Compose (Production)

```yaml
services:
  envoy:
    image: envoyproxy/envoy:v1.28-latest
    ports:
      - "80:8080"
      - "443:8443"
    volumes:
      - ./envoy-prod.yaml:/etc/envoy/envoy.yaml
      - ./ssl:/etc/ssl
    deploy:
      replicas: 2
```

---

## 🆘 Troubleshooting

### Issue: "grpcurl: error: no services found"

**Solution:** Make sure gRPC server is running and reflection is enabled.

```go
// In grpc_server.go
import "google.golang.org/grpc/reflection"

func InitGRPCServer() {
    grpcServer = grpc.NewServer()
    reflection.Register(grpcServer)  // Add this
}
```

### Issue: "CORS error from browser"

**Solution:** Envoy CORS is configured, but check:
1. Frontend uses correct port (8080, not 8000 or 9090)
2. Authorization header format: `Bearer <token>`

### Issue: "Connection refused to Envoy"

**Solution:**
```bash
# Check if Envoy is running
docker ps | grep envoy

# Check Envoy logs
docker logs nemaks-envoy

# Restart Envoy
docker-compose restart envoy
```

### Issue: "Backend not reachable from Envoy"

**Solution:** Check `host.docker.internal`:
```bash
# From inside Envoy container
docker exec nemaks-envoy ping host.docker.internal

# If fails, update envoy.yaml to use bridge network
```

---

## 📦 Makefile Commands

```bash
make proto-install   # Install protoc plugins (one-time)
make proto           # Generate Go code from .proto files
make proto-clean     # Remove generated files
make help            # Show available commands
```

---

## ✅ Summary

You now have:

1. ✅ **gRPC Server** - High-performance RPC on port 9090
2. ✅ **REST API** - Existing Gin server on port 8000
3. ✅ **Envoy Proxy** - Single entry point on port 8080
4. ✅ **gRPC-Web** - Browser-compatible gRPC
5. ✅ **Protocol Buffers** - Type-safe APIs
6. ✅ **Streaming** - Real-time events via gRPC
7. ✅ **Production Ready** - Load balancing, CORS, TLS support

**Architecture Benefits:**
- **Unified Entry**: One port for all protocols
- **Performance**: gRPC 3-5x faster than REST
- **Type Safety**: Compile-time type checking
- **Streaming**: Real-time bidirectional communication
- **Backward Compatible**: Existing REST API still works

**Next Steps:**
1. Run `make proto-install` (one-time setup)
2. Run `make proto` to generate code
3. Implement gRPC service handlers
4. Test with `grpcurl` or gRPC-Web client

Happy coding! 🎉
