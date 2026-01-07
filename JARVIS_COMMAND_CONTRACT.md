# Jarvis Command Contract v1.0

## Overview

This document describes the complete contract for Jarvis commands: intent recognition, API specifications, policy rules, and implementation details.

## Architecture

### Command Flow
1. **Parse**: User utterance (voice/text) → Intent + Parameters
2. **Plan**: Generate action plan with API calls + policy requirements
3. **Approval**: Check if approval is required, show preview to user
4. **Execute**: Perform API calls in sequence, log to audit trail
5. **Result**: Return effects + confirmation + audio response

### Core Endpoints

#### 1. Planning Endpoint
**POST** `/api/jarvis/command/plan`

Request:
```json
{
  "utterance": "string (user voice/text)",
  "actor": {
    "user_id": "uint",
    "role": "string (user|moderator|admin|super_admin)"
  },
  "context": {
    "guild_id": "uint",
    "channel_id": "uint",
    "locale": "string (ru|en)",
    "source": "string (voice|text)"
  }
}
```

Response:
```json
{
  "intent": "string (intent_name)",
  "confidence": "float (0-1)",
  "params": "object (extracted parameters)",
  "policy": {
    "required_role": "string",
    "requires_approval": "boolean",
    "approval_reason": "string"
  },
  "plan": [
    {
      "step": "string (operation type)",
      "api": "string (HTTP method + path)",
      "body": "object (request body, if any)"
    }
  ],
  "result_preview": "string (human-readable preview)"
}
```

#### 2. Execute Endpoint
**POST** `/api/jarvis/command/execute`

Request:
```json
{
  "plan_id": "uuid (from plan response)",
  "approved": "boolean",
  "approved_by": {
    "user_id": "uint",
    "role": "string"
  }
}
```

Response:
```json
{
  "status": "ok|error",
  "effects": [
    {
      "type": "string (operation type)",
      "resource_id": "uint",
      "details": "object"
    }
  ],
  "audio_intent": "string (audio response type: greeting|success|error|etc)"
}
```

---

## Intent Catalog (MVP)

### A. User & Access Management

#### Intent: `user.ban`
**Utterances**: 
- "Джарвис, забань [Имя] на [Время] за [Причина]"
- "Джарвис, забань [Имя] навечно за [Причина]"

**Parameters**:
- `target` {username: string, user_id: uint?}
- `duration_seconds` {uint? | null for permanent}
- `reason` {string}

**Resolution**:
- Resolve username → user_id via `GET /api/users/search?q={username}`

**Execute**:
- `POST /api/admin/users/{id}/ban`
  ```json
  {
    "reason": "string",
    "expires_at": "RFC3339 timestamp | null for permanent"
  }
  ```

**Policy**:
- Required Role: `admin+`
- Requires Approval: `true` (unless super_admin)
- Audit: `logAudit(adminID, 'ban_user', 'user', userID, ip)`

---

#### Intent: `user.unban`
**Utterances**:
- "Джарвис, разбань [Имя]"

**Execute**:
- `DELETE /api/admin/users/{id}/ban`

**Policy**:
- Required Role: `admin+`
- Requires Approval: `true`

---

#### Intent: `ip.ban`
**Utterances**:
- "Джарвис, заблокируй IP [Адрес]"
- "Джарвис, заблокируй IP [Адрес] навечно за [Причина]"

**Parameters**:
- `ip` {string, validation: valid IPv4/IPv6}
- `reason` {string}
- `expires_at` {RFC3339 timestamp | null}

**Execute**:
- `POST /api/admin/ip-bans`
  ```json
  {
    "ip_address": "string",
    "reason": "string",
    "expires_at": "RFC3339 | null"
  }
  ```

**Policy**:
- Required Role: `admin+`
- Requires Approval: `true`

---

#### Intent: `role.set` (NEW)
**Utterances**:
- "Джарвис, назначь [Имя] модератором"
- "Джарвис, разжалуй модератора [Имя]"

**Execute**:
- `PATCH /api/admin/users/{id}/role` (NEW ENDPOINT)
  ```json
  {
    "role": "moderator|admin" (string)
  }
  ```

**Policy**:
- `admin` → can only set `moderator` role
- `super_admin` → can set any role
- Requires Approval: `true`

---

### B. Content & Moderation

#### Intent: `filter.word.add`
**Utterances**:
- "Джарвис, заблокируй слово [Слово]"

**Execute**:
- `POST /api/admin/forbidden-words`
  ```json
  {
    "word": "string",
    "category": "general|criminal|violence|spam|fraud" (optional)",
    "is_regex": false
  }
  ```

**Policy**:
- Required Role: `admin+`
- Requires Approval: `false`

---

#### Intent: `filter.word.remove`
**Utterances**:
- "Джарвис, разреши слово [Слово]"

**Resolution**:
- Resolve word → word_id via `GET /api/admin/forbidden-words` (search)

**Execute**:
- `DELETE /api/admin/forbidden-words/{id}`

**Policy**:
- Required Role: `admin+`
- Requires Approval: `false`

---

#### Intent: `filter.attempts.report`
**Utterances**:
- "Джарвис, покажи попытки запрещённых слов"
- "Джарвис, дай отчет по фильтру"

**Execute**:
- `GET /api/admin/forbidden-attempts?limit=50&page=1`

**Policy**:
- Required Role: `admin+`
- Requires Approval: `false`

---

### C. Monitoring & Information

#### Intent: `stats.platform`
**Utterances**:
- "Джарвис, дай отчет по статистике"
- "Джарвис, сколько пользователей онлайн?"

**Execute**:
- `GET /api/admin/stats`
- `GET /api/stats/platform`

**Policy**:
- Required Role: `admin+`
- Requires Approval: `false`

---

#### Intent: `audit.recent`
**Utterances**:
- "Джарвис, покажи последние действия админов"
- "Джарвис, покажи аудит за день"

**Execute**:
- `GET /api/admin/audit-logs?limit=50&page=1`

**Policy**:
- Required Role: `admin+`
- Requires Approval: `false`

---

#### Intent: `server.health`
**Utterances**:
- "Джарвис, статус сервера"

**Execute**:
- `GET /health`

**Policy**:
- Required Role: `admin+`
- Requires Approval: `false`

---

## New Endpoints (Required for Full Implementation)

### 1. Role Management
**PATCH** `/api/admin/users/{id}/role`
```json
{
  "role": "moderator|admin|super_admin"
}
```
Required middleware: `adminMiddleware()` + role validation

### 2. Chat Purge
**DELETE** `/api/admin/channels/{channel_id}/messages?limit=50`
Required middleware: `adminMiddleware()`

### 3. Admin Post Delete
**DELETE** `/api/admin/posts/{id}`
Required middleware: `adminMiddleware()`

### 4. System Announcement
**POST** `/api/admin/announce`
```json
{
  "message": "string",
  "target": "all|channel|guild" (optional, default: all)
}
```

### 5. Maintenance Mode
**POST** `/api/admin/maintenance`
```json
{
  "enabled": boolean,
  "message": "string (optional)"
}
```

---

## Policy & Security Rules

### Approval Logic
- Commands marked `requires_approval: true` must show preview + wait for user confirmation
- If `actor.role == 'super_admin'`, some commands auto-approve (configurable per intent)
- All approval decisions logged to `AuditLog` with `approved_by`, `approval_timestamp`

### Audit Trail
All commands write to `AuditLog`:
```go
type AuditLog struct {
  UserID      uint
  Actor       string        // "jarvis" or user ID
  Action      string        // intent name
  Target      string        // "user", "word", "ip", etc.
  Details     string        // JSON-encoded parameters
  Approved    bool          
  ApprovedBy  uint          
  IPAddress   string        
  CreatedAt   time.Time     
}
```

### Role Hierarchy
1. `user`: no admin commands
2. `moderator`: basic moderation (bans, content filter)
3. `admin`: full moderation + some system commands
4. `super_admin`: all commands + veto/override of others' decisions

---

## Jarvis Bot Account

Upon first deploy:
1. Create user `jarvis` with:
   - `is_bot: true`
   - `role: "admin"`
   - `username: "Jarvis"`
2. All Jarvis-initiated actions have `actor_id = jarvis.ID` in audit log
3. Super-admin can override/revert any Jarvis decision via `verdict.override` intent

---

## Audio Responses

Jarvis will automatically select audio file from `/jsvoice/` based on result intent:

| Intent | File | Trigger |
|--------|------|----------|
| `greeting` | "Мы работаем над проектом сэр 2.wav" | On page load |
| `success` | "Я провел симуляции со всеми известными элементами.wav" | Successful command |
| `error` | "К сожалению его невозможно синтезировать.wav" | Command failed/rejected |

---

## Implementation Checklist

- [ ] Add 5 new endpoints (role, purge, post-delete, announce, maintenance)
- [ ] Implement `/api/jarvis/command/plan` endpoint
- [ ] Implement `/api/jarvis/command/execute` endpoint
- [ ] Add intent parser (NLU) to JarvisPage.tsx
- [ ] Add approval UI modal in JarvisPage
- [ ] Extend `AuditLog` model with Jarvis-specific fields
- [ ] Create Jarvis bot user on first run
- [ ] Connect WebSocket for real-time command feedback
- [ ] Test all intents end-to-end

---

**Version**: 1.0  
**Last Updated**: 2026-01-06
