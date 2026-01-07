package main

import (
        "bufio"
        "encoding/json"
        "fmt"
        "io"
        "net/http"
        "os"
        "os/exec"
        "sync"
        "time"

        "github.com/gin-gonic/gin"
)

// JarvisMCP handles communication with the Jarvis MCP server
type JarvisMCP struct {
        cmd       *exec.Cmd
        stdin     io.WriteCloser
        stdout    *bufio.Scanner
        mu        sync.Mutex
        isRunning bool
        cfg       MCPConfig
}

type MCPConfig struct {
        BinaryPath       string
        AllowedDirectories []string
        BlockedCommands  []string
        Timeout          time.Duration
}

var jarvisMCP *JarvisMCP

// InitJarvisMCP initializes the Jarvis MCP bridge
func InitJarvisMCP(cfg MCPConfig) error {
        if cfg.BinaryPath == "" {
                cfg.BinaryPath = "./jarvis/jarvis" // relative to working directory
        }
        if cfg.Timeout == 0 {
                cfg.Timeout = 30 * time.Second
        }
        if len(cfg.AllowedDirectories) == 0 {
                cfg.AllowedDirectories = []string{"./uploads", "./jsvoice"}
        }

        jm := &JarvisMCP{
                cfg: cfg,
        }

        // Try to start Jarvis process
        binaryPath := jm.cfg.BinaryPath
        if _, err := os.Stat(binaryPath); os.IsNotExist(err) {
                // Try absolute path if relative fails
                if abs, err := os.Getwd(); err == nil {
                        binaryPath = abs + "/" + jm.cfg.BinaryPath
                }
        }
        jm.cfg.BinaryPath = binaryPath

        if err := jm.startProcess(); err != nil {
                fmt.Printf("Warning: Failed to start Jarvis MCP: %v\n", err)
                return err
        }

        jarvisMCP = jm
        return nil
}

func (jm *JarvisMCP) startProcess() error {
        jm.mu.Lock()
        defer jm.mu.Unlock()

        if jm.isRunning {
                return nil
        }

        // Start Jarvis as MCP server over stdio
        jm.cmd = exec.Command(jm.cfg.BinaryPath)
        
        stdin, err := jm.cmd.StdinPipe()
        if err != nil {
                return fmt.Errorf("failed to open stdin: %w", err)
        }
        jm.stdin = stdin

        stdout, err := jm.cmd.StdoutPipe()
        if err != nil {
                return fmt.Errorf("failed to open stdout: %w", err)
        }
        jm.stdout = bufio.NewScanner(stdout)

        // Redirect stderr for debugging
        jm.cmd.Stderr = os.Stderr

        if err := jm.cmd.Start(); err != nil {
                return fmt.Errorf("failed to start jarvis process: %w", err)
        }

        jm.isRunning = true
        fmt.Println("Jarvis MCP bridge started successfully")
        return nil
}

func (jm *JarvisMCP) stopProcess() error {
        jm.mu.Lock()
        defer jm.mu.Unlock()

        if !jm.isRunning {
                return nil
        }

        if jm.stdin != nil {
                jm.stdin.Close()
        }

        if jm.cmd.Process != nil {
                jm.cmd.Process.Kill()
        }

        jm.isRunning = false
        return jm.cmd.Wait()
}

// MCPRequest represents a request to Jarvis MCP
type MCPRequest struct {
        Tool   string                 `json:"tool"`
        Input  map[string]interface{} `json:"input"`
}

// MCPResponse represents a response from Jarvis MCP
type MCPResponse struct {
        Success bool                   `json:"success"`
        Data    interface{}            `json:"data,omitempty"`
        Error   string                 `json:"error,omitempty"`
}

// ExecuteMCPTool safely executes a tool from Jarvis
func (jm *JarvisMCP) ExecuteMCPTool(toolName string, input map[string]interface{}) (MCPResponse, error) {
        jm.mu.Lock()
        defer jm.mu.Unlock()

        if !jm.isRunning {
                return MCPResponse{}, fmt.Errorf("Jarvis MCP is not running")
        }

        // Validate tool and input
        if !jm.isToolAllowed(toolName) {
                return MCPResponse{Success: false, Error: "Tool not allowed"}, nil
        }

        // Send request to Jarvis
        req := MCPRequest{
                Tool:  toolName,
                Input: input,
        }
        reqBytes, _ := json.Marshal(req)
        fmt.Fprintf(jm.stdin, "%s\n", reqBytes)

        // Read response with timeout
        done := make(chan MCPResponse, 1)
        go func() {
                var resp MCPResponse
                if jm.stdout.Scan() {
                        json.Unmarshal(jm.stdout.Bytes(), &resp)
                        done <- resp
                }
        }()

        select {
        case resp := <-done:
                return resp, nil
        case <-time.After(jm.cfg.Timeout):
                return MCPResponse{}, fmt.Errorf("Jarvis MCP request timeout")
        }
}

func (jm *JarvisMCP) isToolAllowed(toolName string) bool {
        allowedTools := []string{
                "read-file",
                "write-file",
                "list-directory",
                "fetch-url",
                "get-config",
                "set-config",
                "execute-command", // disabled by default for safety
        }

        for _, allowed := range allowedTools {
                if toolName == allowed {
                        // Additional check: execute-command requires super_admin
                        if toolName == "execute-command" {
                                return false // Only allowed via explicit admin endpoints
                        }
                        return true
                }
        }
        return false
}

// HTTP Handlers for Jarvis MCP

func getMCPToolsHandler(c *gin.Context) {
        // List available MCP tools
        tools := []map[string]string{
                {"name": "read-file", "description": "Read file contents"},
                {"name": "write-file", "description": "Write to file"},
                {"name": "list-directory", "description": "List directory contents"},
                {"name": "fetch-url", "description": "Fetch content from URL"},
                {"name": "get-config", "description": "Get configuration"},
        }
        c.JSON(http.StatusOK, gin.H{
                "tools": tools,
                "status": map[string]bool{"available": jarvisMCP != nil && jarvisMCP.isRunning},
        })
}

func executeMCPToolHandler(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }

        // Only allow admins to use MCP tools
        var user User
        if err := db.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
                return
        }
        if user.Role != "admin" && user.Role != "super_admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
                return
        }

        var req struct {
                Tool  string                 `json:"tool" binding:"required"`
                Input map[string]interface{} `json:"input"`
        }

        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if jarvisMCP == nil {
                c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Jarvis MCP not available"})
                return
        }

        resp, err := jarvisMCP.ExecuteMCPTool(req.Tool, req.Input)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }

        // Log the operation
        logAudit(user.ID, "mcp_tool_execute", "mcp", req.Tool, c.ClientIP())

        c.JSON(http.StatusOK, resp)
}

func getMCPStatusHandler(c *gin.Context) {
        status := "unavailable"
        if jarvisMCP != nil && jarvisMCP.isRunning {
                status = "running"
        }

        c.JSON(http.StatusOK, gin.H{
                "status": status,
                "version": "1.0",
                "bridge": "jarvis-mcp-v1.0",
        })
}
