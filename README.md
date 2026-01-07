# Nemaks

Nemaks is a Discord-like communication platform.

## Tech stack
- Backend: Go + Gin + GORM + PostgreSQL
- Realtime: WebSockets (and gRPC for service-to-service)
- Frontend: React + Vite + Tailwind
- Voice/Video: WebRTC / LiveKit

## Repo structure
- `backend/` — Go API + realtime
- `frontend/` — React application
- `proto/` — gRPC contracts
- `rust-services/` — Rust microservices workspace

## Quick start (local)
1) Configure environment:
- Copy `.env.example` to `.env` and fill required values.

2) Start services:
- Linux/macOS: `./start.sh`
- Windows: `start.bat`

3) Run apps:
- Backend typically runs on port configured in `.env`.
- Frontend dev server: `cd frontend && npm i && npm run dev`

## Development
- Frontend: `cd frontend && npm run lint && npm run build`
- Backend: `cd backend && go test ./...`

## Security / privacy
This project intentionally does **not** use end-to-end encryption (E2E) so that server-side moderation and administrative access (with auditing) is possible.

See `CONTRIBUTING.md` for workflow and standards.
