# Jarvis MCP Integration Setup Guide

## Overview

Jarvis MCP (Model Context Protocol) is integrated as a **sidecar service** in your project. The backend provides a safe bridge to execute whitelisted MCP tools (file operations, URL fetching, etc.) with proper admin-only access controls and audit logging.

## Architecture

```
┌──────────────────────────────────────┐
│  Frontend (React/JarvisPage.tsx)    │
└────────────────┬─────────────────────┘
                 │ HTTP/WS
┌────────────────▼─────────────────────┐
│  Backend (Go - main.go)              │
│  ├─ /api/jarvis/mcp/tools            │
│  ├─ /api/jarvis/mcp/execute          │
│  └─ /api/jarvis/mcp/status           │
└────────────────┬─────────────────────┘
                 │ stdio (JSON protocol)
┌────────────────▼─────────────────────┐
│  Jarvis MCP Server                   │
│  (can-acar/jarvis)                   │
│  - read-file                         │
│  - write-file                        │
│  - list-directory                    │
│  - fetch-url                         │
│  - get-config / set-config           │
└──────────────────────────────────────┘
```

## Installation Steps

### 1. Clone Jarvis Repository

Add `can-acar/jarvis` as a submodule (or download/copy the binary):

```bash
cd your-project
git submodule add https://github.com/can-acar/jarvis jarvis
cd jarvis
go mod download
go build -o jarvis
```

After building, the binary should be at `./jarvis/jarvis`.

### 2. Backend Integration

The MCP bridge is already implemented in `backend/jarvis_mcp.go`. You need to:

#### a) Register Routes in `backend/main.go`

Add this in your router setup (around where other routes are registered):

```go
// Jarvis MCP routes (admin only)
jarisGroup := router.Group("/api/jarvis/mcp", authMiddleware())
{
    jarvisGroup.GET("/tools", getMCPToolsHandler)
    jarvisGroup.GET("/status", getMCPStatusHandler)
    jarvisGroup.POST("/execute", adminMiddleware(), executeMCPToolHandler)
}
```

#### b) Initialize Jarvis MCP on Server Start

Add this in `main()` function, after database initialization:

```go
func main() {
    // ... existing setup (DB, Redis, etc.) ...

    // Initialize Jarvis MCP bridge
    mcpCfg := MCPConfig{
        BinaryPath:         "./jarvis/jarvis", // adjust if binary is elsewhere
        AllowedDirectories: []string{"./uploads", "./jsvoice", "./backend"},
        Timeout:            30 * time.Second,
    }
    if err := InitJarvisMCP(mcpCfg); err != nil {
        log.Printf("Warning: Jarvis MCP initialization failed: %v\n", err)
        // Server continues without MCP, but /api/jarvis/mcp will return "unavailable"
    }
    defer jarvisMCP.stopProcess() // cleanup on shutdown

    // ... rest of setup ...
}
```

### 3. Frontend Integration (Optional - for UI)

If you want a UI in JarvisPage to call MCP tools:

```typescript
// In JarvisPage.tsx or new MCPToolsPanel component
const executeMCPTool = async (toolName: string, input: Record<string, any>) => {
  const response = await fetch('/api/jarvis/mcp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: toolName, input }),
  });
  return response.json();
};

// Example usage: read a file
const readLogFile = async () => {
  const result = await executeMCPTool('read-file', {
    path: './backend/logs/jarvis.log'
  });
  console.log(result.data);
};
```

### 4. Configuration

#### Binary Path

If Jarvis binary is in a non-standard location, update in `main.go`:

```go
mcpCfg.BinaryPath = "/path/to/jarvis"
```

#### Allowed Directories

Edit in `jarvis_mcp.go` (function `isToolAllowed`) to control which directories files can be read/written:

```go
if len(cfg.AllowedDirectories) == 0 {
    cfg.AllowedDirectories = []string{"./uploads", "./jsvoice", "./your-dir"}
}
```

#### Tool Whitelisting

Currently enabled tools (in `isToolAllowed`):
- ✅ `read-file` — read file contents from allowed dirs
- ✅ `write-file` — write file to allowed dirs
- ✅ `list-directory` — list directory contents
- ✅ `fetch-url` — fetch content from URLs
- ✅ `get-config` / `set-config` — manage config (if jarvis supports)
- ❌ `execute-command` — **disabled by default** (security risk)

To enable `execute-command` only for `super_admin` role, edit:

```go
func (jm *JarvisMCP) isToolAllowed(toolName string, userRole string) bool {
    if toolName == "execute-command" {
        return userRole == "super_admin"
    }
    // ... rest of logic
}
```

### 5. Replit Deployment

In `.replit`, update the run commands to start Jarvis as sidecar:

```toml
[deployment]
run = ["./backend/server", "./jarvis/jarvis"]
```

Or, if you prefer separate processes:

```toml
[[workflows.workflow]]
name = "Backend"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "cd backend && go run main.go"

[[workflows.workflow]]
name = "Jarvis"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "cd jarvis && go run ."
```

## API Endpoints

### GET `/api/jarvis/mcp/tools`

List available MCP tools.

**Response:**
```json
{
  "tools": [
    { "name": "read-file", "description": "Read file contents" },
    { "name": "write-file", "description": "Write to file" },
    ...
  ],
  "status": { "available": true }
}
```

### GET `/api/jarvis/mcp/status`

Check if Jarvis MCP server is running.

**Response:**
```json
{
  "status": "running",
  "version": "1.0",
  "bridge": "jarvis-mcp-v1.0"
}
```

### POST `/api/jarvis/mcp/execute`

Execute a whitelisted MCP tool. **Requires admin role.**

**Request:**
```json
{
  "tool": "read-file",
  "input": {
    "path": "./uploads/example.txt"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": "File contents here..."
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Tool not allowed"
}
```

## Security Considerations

1. **Admin-Only Access**: All MCP endpoints require `admin` or `super_admin` role.
2. **Tool Whitelisting**: Only approved tools can be executed (no arbitrary commands by default).
3. **Directory Whitelist**: File operations restricted to `AllowedDirectories`.
4. **Audit Logging**: Every MCP tool execution is logged with user ID, IP, and operation details.
5. **Timeout**: Requests timeout after 30 seconds to prevent hanging.
6. **Execute-Command Disabled**: Command execution is blocked unless explicitly enabled for `super_admin`.

## Troubleshooting

### Jarvis MCP not starting

Check logs:
- Verify binary path is correct
- Ensure `./jarvis/jarvis` binary exists and is executable: `chmod +x ./jarvis/jarvis`
- Check stderr output from backend startup

### "Jarvis MCP not available" error

- Backend may not have initialized the bridge (check logs)
- Binary crashed or exited
- Try restarting backend service

### Tool returns "Tool not allowed"

- Tool not in whitelist (add to `isToolAllowed`)
- User is not admin (check role in DB)

### Timeout errors

- Jarvis process might be unresponsive
- Increase timeout in `MCPConfig.Timeout` if operations are slow

## Testing

Quick test using `curl`:

```bash
# Check if Jarvis is running
curl http://localhost:8000/api/jarvis/mcp/status

# List tools (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/jarvis/mcp/tools

# Execute a tool (requires admin + auth token)
curl -X POST http://localhost:8000/api/jarvis/mcp/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "list-directory",
    "input": { "path": "./uploads" }
  }'
```

## Next Steps

1. Build and test Jarvis binary locally
2. Add MCP routes to `main.go`
3. Initialize Jarvis on startup
4. Test endpoints with proper auth tokens
5. Add frontend UI for MCP tool execution (optional)
6. Deploy to Replit

## References

- [Jarvis GitHub](https://github.com/can-acar/jarvis)
- [MCP Protocol Spec](https://spec.modelcontextprotocol.io/)
- Project: `JARVIS_COMMAND_CONTRACT.md` — comprehensive intent & policy specification

---

**Version**: 1.0  
**Last Updated**: 2026-01-06
