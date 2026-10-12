# 🚀 Replit Deployment Guide

## Quick Start

### 1. Import to Replit
1. Go to [Replit](https://replit.com)
2. Click "Create Repl"
3. Select "Import from GitHub"
4. Paste: `https://github.com/kirin2461/Nemaxks`

### 2. Setup Dependencies

**Backend (Go)**
```bash
cd backend
chmod +x scripts/setup-deps.sh
./scripts/setup-deps.sh
```

**Frontend (React)**
```bash
cd frontend
npm install
```

### 3. Environment Variables

Create `.env` files:

**backend/.env**
```env
PORT=8000
DATABASE_URL=your_postgres_url
JWT_SECRET=your_secret_key
REDIS_URL=your_redis_url
```

**frontend/.env**
```env
VITE_API_URL=https://your-repl.replit.app/api
VITE_WS_URL=wss://your-repl.replit.app/ws
```

### 4. Run the Application

Replit will automatically (см. `.replit`):
1. Build backend: `cd backend && CGO_ENABLED=0 go build -o ./server .`
   (main package находится в корне `backend/`, а не в `cmd/server`)
2. Build frontend: `cd frontend && npm install && npm run build`
3. Start backend: `cd backend && ./server` (PORT=3000 по `.replit`)

### 5. Access Your App

- **Frontend**: `https://your-repl.replit.app`
- **Backend API**: `https://your-repl.replit.app/api`
- **WebSocket**: `wss://your-repl.replit.app/ws`

## Troubleshooting

### Backend errors
```bash
cd backend
go mod tidy
go run .
```

### Frontend errors
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Database connection
Use Replit's PostgreSQL addon or external service like:
- [Neon](https://neon.tech)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

## Features Enabled

✅ Real-time messaging (WebSocket)
✅ Voice & Video calls (WebRTC)
✅ File uploads
✅ Screen sharing
✅ User authentication
✅ Redis caching
✅ PostgreSQL database

## Production Checklist

- [ ] Set strong JWT_SECRET
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Monitor logs
- [ ] Rate limiting enabled

## Support

If you encounter issues:
1. Check Replit console logs
2. Verify environment variables
3. Run dependency setup scripts
4. Open an issue on GitHub
