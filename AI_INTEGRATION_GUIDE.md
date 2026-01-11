# AI Integration Guide

This guide covers the AI integration capabilities in Nemaxks, including the Jarvis AI assistant and external AI provider integrations.

## Overview

Nemaxks supports multiple AI providers for intelligent chat assistance:

- **Jarvis** - Built-in AI assistant with MCP (Model Context Protocol) support
- **DeepSeek** - External AI provider integration
- **Ollama** - Local AI model support
- **OpenAI** - GPT model integration (optional)
- **HuggingFace** - Open-source model support (optional)

## Configuration

### Environment Variables

Set the following environment variables in your `.env` file:

```bash
# Jarvis AI Configuration
JARVIS_ENABLED=true
JARVIS_BINARY_PATH=../jarvis/jarvis

# DeepSeek API (optional)
DEEPSEEK_API_KEY=your_deepseek_api_key

# OpenAI API (optional)
OPENAI_API_KEY=your_openai_api_key

# HuggingFace API (optional)
HUGGINGFACE_API_KEY=your_huggingface_api_key

# Ollama Configuration (for local models)
OLLAMA_HOST=http://localhost:11434
```

## API Endpoints

### Chat Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jarvis/chat` | POST | General AI chat |
| `/api/jarvis/chat/ollama` | POST | Chat using Ollama |
| `/api/jarvis/chat/deepseek` | POST | Chat using DeepSeek |
| `/api/jarvis/chat/auto` | POST | Auto-select best provider |
| `/api/jarvis/status` | GET | Get AI service status |

### Request Format

```json
{
  "message": "Your question or prompt",
  "context": {
    "channel_id": 123,
    "conversation_history": []
  }
}
```

### Response Format

```json
{
  "response": "AI generated response",
  "provider": "jarvis",
  "tokens_used": 150,
  "processing_time_ms": 1200
}
```

## Jarvis MCP Integration

Jarvis uses the Model Context Protocol (MCP) for enhanced capabilities:

### Supported Commands

- File operations (read, write, list)
- Code analysis and suggestions
- Context-aware responses
- Tool execution (sandboxed)

### Security

- Commands are sandboxed to specific directories
- Dangerous commands are blocked by default
- All operations are logged for audit

### Configuration

```go
mcpCfg := MCPConfig{
    BinaryPath:         "../jarvis/jarvis",
    AllowedDirectories: []string{"./uploads", "./jsvoice", "./backend"},
    BlockedCommands:    []string{"execute-command"},
    Timeout:            30 * time.Second,
}
```

## User Settings

Users can configure their own AI API keys in settings:

1. Navigate to Settings > AI Integration
2. Enter API keys for preferred providers
3. Keys are stored securely (encrypted at rest)

## Best Practices

1. **Rate Limiting** - Implement rate limiting for AI endpoints
2. **Error Handling** - Gracefully handle provider failures
3. **Fallback** - Use `/api/jarvis/chat/auto` for automatic provider fallback
4. **Context Management** - Limit conversation history to reduce token usage
5. **Monitoring** - Log AI usage for cost tracking

## Troubleshooting

### Common Issues

**Jarvis not responding:**
- Check if the Jarvis binary exists at the configured path
- Verify the binary has execute permissions
- Check server logs for MCP initialization errors

**API key errors:**
- Verify API keys are correctly set in environment
- Check for rate limiting from external providers
- Ensure keys have sufficient quota

**Slow responses:**
- Consider using local Ollama for faster responses
- Reduce conversation context size
- Check network connectivity to AI providers

## See Also

- [JARVIS_INTEGRATION_SETUP.md](./JARVIS_INTEGRATION_SETUP.md)
- [JARVIS_COMMAND_CONTRACT.md](./JARVIS_COMMAND_CONTRACT.md)
- [JARVIS_TESTING_GUIDE.md](./JARVIS_TESTING_GUIDE.md)
