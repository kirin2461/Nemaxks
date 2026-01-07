package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
)

type MCPRequest struct {
	Tool  string                 `json:"tool"`
	Input map[string]interface{} `json:"input"`
}

type MCPResponse struct {
	Success bool                   `json:"success"`
	Data    interface{}            `json:"data,omitempty"`
	Error   string                 `json:"error,omitempty"`
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		var req MCPRequest
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			sendResponse(MCPResponse{Success: false, Error: "Invalid request"})
			continue
		}

		switch req.Tool {
		case "get-config":
			sendResponse(MCPResponse{Success: true, Data: map[string]string{"version": "1.0", "name": "Jarvis"}})
		case "list-directory":
			path := "."
			if p, ok := req.Input["path"].(string); ok {
				path = p
			}
			files, err := os.ReadDir(path)
			if err != nil {
				sendResponse(MCPResponse{Success: false, Error: err.Error()})
				continue
			}
			var names []string
			for _, f := range files {
				names = append(names, f.Name())
			}
			sendResponse(MCPResponse{Success: true, Data: names})
		default:
			sendResponse(MCPResponse{Success: false, Error: "Unknown tool"})
		}
	}
}

func sendResponse(resp MCPResponse) {
	bytes, _ := json.Marshal(resp)
	fmt.Println(string(bytes))
}
