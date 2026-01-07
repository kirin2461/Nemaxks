# 🎯 Redis + LiveKit Integration Guide

## 📋 Overview

This project now includes:
- ✅ **Redis** - For session management, user presence, and caching
- ✅ **LiveKit** - Scalable SFU media server for voice/video (replaces peer-to-peer WebRTC)
- ✅ **WebRTC Fixes** - Fixed custom WebRTC implementation (still available as fallback)

## 🔧 What Changed

### Backend Changes
| File | Changes |
|------|---------|
| `backend/go.mod` | Added Redis and LiveKit SDK dependencies |
| `backend/redis.go` | New - Redis client with presence, caching, voice channel management |
| `backend/livekit.go` | New - LiveKit integration with token generation |
| `backend/handlers_livekit.go` | New - API endpoints for LiveKit tokens |
| `backend/main.go` | Added Redis and LiveKit initialization + new routes |

### Configuration Files
| File | Purpose |
|------|---------|
| `.env.example` | Added Redis and LiveKit configuration |
| `docker-compose.yml` | New - Redis, LiveKit, and PostgreSQL containers |
| `livekit.yaml` | New - LiveKit server configuration |

### Frontend Fixes (Custom WebRTC)
| File | Line | Fix |
|------|------|-----|
| `frontend/src/components/VoiceChannel.tsx` | 100 | Added audio element storage |
| `frontend/src/components/VoiceChannel.tsx` | 614-658 | Fixed remote audio playback |
| `frontend/src/components/VoiceChannel.tsx` | 428-446 | Fixed audio processing chain |
| `frontend/src/components/VoiceChannel.tsx` | 930-976 | Added audio cleanup |
| `frontend/src/pages/VideoCallPage.tsx` | 362-392 | Fixed multiple audio tracks |

---

## 🚀 Quick Start

### Option 1: Using Docker (Recommended)

```bash
# 1. Start Redis and LiveKit
cd /path/to/911
docker-compose up -d

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your settings
nano .env

# 4. Start backend (requires Go installed)
cd backend
go mod tidy
go run .

# 5. Start frontend
cd ../frontend
npm install
npm run dev
```

### Option 2: Manual Installation

#### Install Redis
```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# macOS
brew install redis
brew services start redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
```

#### Install LiveKit

**Using Docker (easiest):**
```bash
docker run -d \
  --name livekit \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 50000-50100:50000-50100/udp \
  -v $(pwd)/livekit.yaml:/etc/livekit.yaml \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml
```

**Or download binary:**
- Go to https://github.com/livekit/livekit/releases
- Download for your OS
- Run: `./livekit-server --config livekit.yaml`

---

## ⚙️ Configuration

### 1. Environment Variables

Edit `.env`:

```env
# Redis
REDIS_URL=localhost:6379
REDIS_PASSWORD=

# LiveKit
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret

# Use LiveKit (true) or custom WebRTC (false)
USE_LIVEKIT=true
```

### 2. LiveKit Cloud (Alternative)

Instead of self-hosting, use LiveKit Cloud:

1. Sign up at https://cloud.livekit.io
2. Create a project
3. Get your credentials
4. Update `.env`:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

---

## 📡 API Endpoints

### LiveKit Token Generation

**POST** `/api/livekit/token`

Request:
```json
{
  "room_name": "voice-channel-1",
  "channel_id": "1"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "url": "ws://localhost:7880"
}
```

### Leave Voice Channel

**POST** `/api/livekit/leave/:channel_id`

### Get Voice Participants

**GET** `/api/voice/channels/:channel_id/participants`

Response:
```json
[
  {
    "user_id": "1",
    "username": "User1",
    "avatar": "https://..."
  }
]
```

---

## 🎨 Frontend Integration

### Using LiveKit (Recommended for 10+ users)

Install LiveKit client:
```bash
cd frontend
npm install livekit-client
```

Create `frontend/src/hooks/useLiveKit.ts`:

```typescript
import { Room, RoomEvent, Track } from 'livekit-client'
import { useState, useEffect } from 'react'

export function useLiveKit(channelId: string) {
  const [room, setRoom] = useState<Room>()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const connectToRoom = async () => {
      // Get token from backend
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          room_name: `voice-channel-${channelId}`,
          channel_id: channelId
        })
      })

      const { token, url } = await response.json()

      // Connect to LiveKit room
      const room = new Room()
      await room.connect(url, token)

      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true)

      // Listen to remote participants
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach()
          document.body.appendChild(audioElement)
        }
      })

      setRoom(room)
      setIsConnected(true)
    }

    connectToRoom()

    return () => {
      room?.disconnect()
    }
  }, [channelId])

  return { room, isConnected }
}
```

---

## 🧪 Testing

### Test Redis Connection
```bash
redis-cli ping
# Should return: PONG
```

### Test LiveKit
```bash
curl http://localhost:7881/
# Should return: LiveKit server info
```

### Test Voice Call
1. Open two browser windows
2. Login with different accounts
3. Join the same voice channel
4. You should hear each other!

---

## 🔍 Debugging

### Redis Issues
```bash
# Check if Redis is running
redis-cli ping

# Monitor Redis commands
redis-cli monitor

# Check connected clients
redis-cli client list
```

### LiveKit Issues
```bash
# Check logs
docker logs nemaks-livekit

# Test WebSocket connection
wscat -c ws://localhost:7880
```

### Voice Not Working
1. **Check browser console** for errors
2. **Allow microphone permissions**
3. **Check ICE connection state** in console
4. **Verify firewall** allows UDP ports 50000-50100
5. **Test with localhost first**, then public IP

---

## 📊 Comparison: Custom WebRTC vs LiveKit

| Feature | Custom WebRTC | LiveKit |
|---------|---------------|---------|
| Max Users | 5 (mesh) | 100+ (SFU) |
| Bandwidth | High (N-1 connections) | Low (1 connection) |
| Quality | Varies | Adaptive bitrate |
| Recording | ❌ | ✅ |
| Screen Share | ✅ | ✅ |
| Simulcast | ❌ | ✅ |
| Setup | Easy | Requires server |
| Cost | Free | Free (self-hosted) |

**Recommendation:**
- Use **Custom WebRTC** for 1-5 users
- Use **LiveKit** for 5+ users or advanced features

---

## 🎁 Bonus Features with Redis

### User Presence
```go
// Backend automatically tracks:
// - Online/offline status
// - Last seen timestamp
// - Current voice channel
```

### Voice Channel State
```go
// Real-time tracking of:
// - Who's in which channel
// - Auto-cleanup on disconnect
// - Presence expiry (5 min)
```

### Caching
```go
// Cache frequently accessed data:
CacheSet("user:1:profile", userData, 10*time.Minute)
```

---

## 📦 Package Installation

If Go isn't installed, you'll need to install dependencies manually when deploying:

```bash
cd backend
go mod download
```

Dependencies added:
- `github.com/redis/go-redis/v9` - Redis client
- `github.com/livekit/server-sdk-go/v2` - LiveKit SDK
- `github.com/livekit/protocol` - LiveKit protocol

---

## 🌐 Production Deployment

### 1. Update LiveKit Config

Edit `livekit.yaml`:
```yaml
rtc:
  use_external_ip: true
  # Add your public IP or domain
```

### 2. Firewall Rules
```bash
# Allow UDP for WebRTC
sudo ufw allow 50000:50100/udp

# Allow LiveKit ports
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
```

### 3. HTTPS/WSS
Use a reverse proxy (nginx/caddy) to add SSL:

```nginx
# nginx config
upstream livekit {
    server localhost:7880;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    location /livekit {
        proxy_pass http://livekit;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Update `.env`:
```env
LIVEKIT_URL=wss://your-domain.com/livekit
```

---

## 🆘 Support

- **LiveKit Docs**: https://docs.livekit.io
- **Redis Docs**: https://redis.io/docs
- **Custom WebRTC Still Works**: The fixes ensure custom WebRTC works as fallback

---

## ✅ Summary

You now have:
1. ✅ **Redis** for presence and caching
2. ✅ **LiveKit** for scalable voice/video
3. ✅ **Fixed Custom WebRTC** as fallback
4. ✅ **Docker setup** for easy deployment
5. ✅ **Production-ready** configuration

Choose LiveKit for better scalability or use the fixed custom WebRTC for simplicity!
