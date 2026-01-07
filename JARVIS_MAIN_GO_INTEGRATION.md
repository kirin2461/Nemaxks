# Jarvis MCP Integration in main.go

## Step 1: Register Routes in main() function

Find where you register other routes (look for `router.POST`, `router.GET`, etc.) and add this code:

```go
// Jarvis MCP routes (admin only)
jarvisGroup := router.Group("/api/jarvis/mcp", authMiddleware())
{
    jarvisGroup.GET("/tools", getMCPToolsHandler)
    jarvisGroup.GET("/status", getMCPStatusHandler)
    jarvisGroup.POST("/execute", adminMiddleware(), executeMCPToolHandler)
}
```

Typical location: after other admin routes, around where you see patterns like:
```go
adminGroup := router.Group("/api/admin", authMiddleware(), adminMiddleware())
{
    // existing routes
    adminGroup.GET("/stats", getAdminStatsHandler)
    // ... etc
}
```

## Step 2: Initialize Jarvis MCP on Server Startup

Find the `main()` function where database and other services are initialized. Add this code **AFTER** database initialization (after `db.AutoMigrate(...)`):

```go
func main() {
    // ... existing code (Database, Redis setup, etc.) ...
    
    // Initialize Jarvis MCP bridge
    mcpCfg := MCPConfig{
        BinaryPath:         "./jarvis/jarvis",  // adjust path if needed
        AllowedDirectories: []string{"./uploads", "./jsvoice", "./backend"},
        Timeout:            30 * time.Second,
    }
    if err := InitJarvisMCP(mcpCfg); err != nil {
        log.Printf("Warning: Jarvis MCP initialization failed: %v\\n", err)
        // Server continues to run even if Jarvis fails to start
    }
    
    // Defer cleanup on shutdown
    defer func() {
        if jarvisMCP != nil {
            jarvisMCP.stopProcess()
        }
    }()
    
    // ... rest of server setup ...
    router.Run(":8000") // or your configured port
}
```

## Step 3: Build Jarvis Binary (Local/Replit)

Before running your backend, build Jarvis:

```bash
# Initialize submodule (if not already done)
git submodule update --init --recursive

# Build Jarvis
cd jarvis
go mod download
go build -o jarvis
cd ..

# Now Jarvis binary is at: ./jarvis/jarvis
```

**For Replit**: Add a build step in your Replit config or build script:
```bash
#!/bin/bash
cd jarvis && go build -o jarvis && cd ..
cd backend && go build -o server && cd ..
```

## Step 4: Verify Integration

After adding the code above, start your backend:

```bash
cd backend
go run main.go
```

You should see in logs:
```
Jarvis MCP bridge started successfully
```

If you see a warning instead, check:
- Is `./jarvis/jarvis` binary present?
- Is it executable? (`chmod +x ./jarvis/jarvis`)
- Check stderr output from the server

## Code to Copy-Paste

### In main.go - Router Setup Section

```go
// This goes in main() function where you setup router groups

// Jarvis MCP endpoints (admin-only access to MCP tools)
jarvisGroup := router.Group("/api/jarvis/mcp", authMiddleware())
{
    jarvisGroup.GET("/tools", getMCPToolsHandler)
    jarvisGroup.GET("/status", getMCPStatusHandler)
    jarvisGroup.POST("/execute", adminMiddleware(), executeMCPToolHandler)
}
```

### In main.go - Server Initialization Section

```go
// This goes in main() function after database is initialized

// Initialize Jarvis MCP bridge
log.Println("[*] Initializing Jarvis MCP bridge...")
mcpCfg := MCPConfig{
    BinaryPath:         "./jarvis/jarvis",
    AllowedDirectories: []string{"./uploads", "./jsvoice", "./backend"},
    Timeout:            30 * time.Second,
}
if err := InitJarvisMCP(mcpCfg); err != nil {
    log.Printf("[!] Jarvis MCP failed to start (non-fatal): %v\\n", err)
}
defer func() {
    if jarvisMCP != nil {
        jarvisMCP.stopProcess()
    }
}()
```

## Troubleshooting

### Error: "Jarvis MCP is not running"
- Check if `./jarvis/jarvis` binary exists
- Try building manually: `cd jarvis && go build`
- Check permissions: `ls -la ./jarvis/jarvis`

### Error: "failed to open stdin"
- Binary might not exist at that path
- Try absolute path or verify relative path from working directory

### Error: "no such file or directory"
- Jarvis submodule not cloned
- Run: `git submodule update --init --recursive`

## After Integration

Once integrated, you can:

1. **Check Jarvis status**:
   ```bash
   curl http://localhost:8000/api/jarvis/mcp/status
   ```

2. **List available tools**:
   ```bash
   curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:8000/api/jarvis/mcp/tools
   ```

3. **Execute a tool** (requires admin):
   ```bash
   curl -X POST http://localhost:8000/api/jarvis/mcp/execute \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "tool": "list-directory",
       "input": { "path": "./uploads" }
     }'
   ```

## Notes

- All MCP operations are **admin-only** (checked by `adminMiddleware()`)
- Operations are **logged to AuditLog** with user ID and IP
- `execute-command` is **disabled by default** (security feature)
- **Timeout**: 30 seconds per request (configurable in `MCPConfig.Timeout`)
- **No blocking**: If Jarvis fails to start, backend continues to run

---

**Version**: 1.0  
**Last Updated**: 2026-01-06
