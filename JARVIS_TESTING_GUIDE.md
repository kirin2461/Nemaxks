# Jarvis MCP Endpoints Testing Guide

## Prerequisites

1. **Backend running**: `cd backend && go run main.go`
2. **Jarvis binary exists**: `./jarvis/jarvis` (built from submodule)
3. **Admin token**: You need an auth token for an admin user
   - Get token by logging in as admin user
   - Or check your database for admin user token

## Getting an Admin Token

If you need to generate a test admin token:

```bash
# Login endpoint (POST /api/auth/login)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_user",
    "password": "admin_password"
  }'

# Response will contain token:
# { "token": "eyJhbGciOiJIUzI1NiIs...", ... }
```

Or check `AuditLog` table in DB for tokens of logged-in admin users.

## Test 1: Check Jarvis MCP Status (No Auth Required)

```bash
curl http://localhost:8000/api/jarvis/mcp/status
```

**Expected Response** (if Jarvis is running):
```json
{
  "status": "running",
  "version": "1.0",
  "bridge": "jarvis-mcp-v1.0"
}
```

**Expected Response** (if Jarvis failed to start):
```json
{
  "status": "unavailable",
  "version": "1.0",
  "bridge": "jarvis-mcp-v1.0"
}
```

**Troubleshooting**:
- If status is "unavailable", check server logs for "Jarvis MCP failed to start"
- Verify `./jarvis/jarvis` binary exists and is executable

---

## Test 2: List Available MCP Tools (Requires Auth + Admin)

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:8000/api/jarvis/mcp/tools
```

Replace `YOUR_ADMIN_TOKEN` with real token (see "Getting an Admin Token" above).

**Expected Response**:
```json
{
  "tools": [
    {
      "name": "read-file",
      "description": "Read file contents"
    },
    {
      "name": "write-file",
      "description": "Write to file"
    },
    {
      "name": "list-directory",
      "description": "List directory contents"
    },
    {
      "name": "fetch-url",
      "description": "Fetch content from URL"
    },
    {
      "name": "get-config",
      "description": "Get configuration"
    }
  ],
  "status": {
    "available": true
  }
}
```

**Error Responses**:

401 Unauthorized (no token or invalid token):
```json
{"error": "Unauthorized"}
```

403 Forbidden (user is not admin):
```json
{"error": "Admin access required"}
```

---

## Test 3: Execute a Tool - List Directory (Requires Auth + Admin)

List files in `./uploads` directory:

```bash
curl -X POST http://localhost:8000/api/jarvis/mcp/execute \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "list-directory",
    "input": { "path": "./uploads" }
  }'
```

**Expected Response** (if successful):
```json
{
  "success": true,
  "data": [
    "file1.txt",
    "file2.jpg",
    "folder/"
  ]
}
```

**Error Response** (if directory doesn't exist or not whitelisted):
```json
{
  "success": false,
  "error": "Tool not allowed"
}
```

---

## Test 4: Execute a Tool - Read File

Read contents of a file in allowed directories:

```bash
curl -X POST http://localhost:8000/api/jarvis/mcp/execute \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "read-file",
    "input": { "path": "./uploads/example.txt" }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": "Contents of the file..."
}
```

---

## Test 5: Execute a Tool - Fetch URL

Fetch content from a URL:

```bash
curl -X POST http://localhost:8000/api/jarvis/mcp/execute \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "fetch-url",
    "input": { "url": "https://example.com" }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": "<html>...content of page...</html>"
}
```

---

## Test 6: Verify Audit Logging

After executing MCP tools, check that operations are logged:

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:8000/api/admin/audit-logs?limit=10
```

You should see entries with `action: "mcp_tool_execute"` and `target: <tool_name>`:

```json
{
  "logs": [
    {
      "user_id": 123,
      "action": "mcp_tool_execute",
      "target": "list-directory",
      "details": "list-directory",
      "ip_address": "127.0.0.1",
      "created_at": "2026-01-06T18:00:00Z"
    },
    ...
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

## Common Issues and Solutions

### Issue 1: "Jarvis MCP not available"

**Cause**: Backend couldn't start Jarvis process

**Solution**:
```bash
# Check if binary exists
ls -la ./jarvis/jarvis

# If missing, build it
cd jarvis
go mod download
go build -o jarvis
cd ..

# Check logs - restart backend
cd backend
go run main.go  # Look for "Jarvis MCP" in logs
```

### Issue 2: "Tool not allowed"

**Cause**: Tool might not be whitelisted OR path not in allowed directories

**Solution**:
- Check `jarvis_mcp.go` function `isToolAllowed()` for list of allowed tools
- `execute-command` is disabled by default
- For file operations, path must be in `AllowedDirectories` list (currently: `./uploads`, `./jsvoice`, `./backend`)

### Issue 3: Timeout after 30 seconds

**Cause**: Operation took too long or Jarvis process hung

**Solution**:
- Check if Jarvis process is running: `ps aux | grep jarvis`
- Increase timeout in `MCPConfig.Timeout` (edit `jarvis_mcp.go`)
- Restart backend if process hung

### Issue 4: "Unauthorized" (401)

**Cause**: Missing or invalid auth token

**Solution**:
- Get new token from login endpoint
- Ensure token is in header as: `Authorization: Bearer <token>`
- Token might be expired, login again

### Issue 5: "Admin access required" (403)

**Cause**: User is not admin

**Solution**:
- Login as admin user (must have `role = 'admin'` or `'super_admin'` in DB)
- Check database: `SELECT id, username, role FROM users WHERE username='admin'`

---

## Complete Test Script (Bash)

Save as `test-jarvis.sh` and run:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:8000"
ADMIN_TOKEN="YOUR_ADMIN_TOKEN_HERE"  # Replace with real token

echo "[1] Testing Jarvis MCP Status (no auth required)..."
curl -s $BASE_URL/api/jarvis/mcp/status | jq .

echo -e "\n[2] Testing Tools List (requires admin)..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $BASE_URL/api/jarvis/mcp/tools | jq .

echo -e "\n[3] Testing List Directory..."
curl -s -X POST $BASE_URL/api/jarvis/mcp/execute \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool":"list-directory","input":{"path":"./uploads"}}' | jq .

echo -e "\n[4] Testing Audit Logs..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/api/admin/audit-logs?limit=5" | jq '.logs[] | select(.action=="mcp_tool_execute")'

echo -e "\n[✓] All tests completed!"
```

Run:
```bash
chmod +x test-jarvis.sh
./test-jarvis.sh
```

---

## Security Notes

✅ All MCP endpoints are **admin-only** (checked by middleware)  
✅ All operations **logged to AuditLog** with user ID and IP  
✅ `execute-command` is **disabled by default**  
✅ File operations restricted to **whitelisted directories**  
✅ Requests timeout after **30 seconds** (configurable)  
✅ Tools are **whitelisted explicitly** (no "execute anything" mode)

---

**Version**: 1.0  
**Last Updated**: 2026-01-06
