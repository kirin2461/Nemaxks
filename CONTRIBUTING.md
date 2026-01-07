# Contributing to Nemaks

## Setup
- Backend prerequisites: Go (see `backend/go.mod`), PostgreSQL, Redis.
- Frontend prerequisites: Node.js 20+.

## Local run
- Use `start.sh` / `start.bat` for a full local start.
- Or run separately:
  - Backend: `cd backend && go test ./...` then run `go run .`
  - Frontend: `cd frontend && npm i && npm run dev`

## Branching
- Use feature branches from `main`, e.g. `feature/...`, `fix/...`, `improvements/...`.

## Pull requests
- Keep PRs focused (one theme per PR).
- Include a short description, screenshots (UI) if relevant, and testing notes.

### PR checklist
- [ ] Code builds locally.
- [ ] Lint passes (frontend).
- [ ] Added/updated docs if behavior changed.
- [ ] No secrets committed.

## Code style
- Follow `.editorconfig`.
- Prefer small, readable functions.

## Security issues
Please avoid opening public issues for security-sensitive reports.
