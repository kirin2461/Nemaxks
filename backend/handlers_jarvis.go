package main

import (
        "bytes"
        "encoding/json"
        "fmt"
        "io"
        "log"
        "net/http"
        "os"
        "strings"
        "sync"
        "time"

        "github.com/gin-gonic/gin"
)

type JarvisRequest struct {
        Message string `json:"message" binding:"required"`
        History []struct {
                Role    string `json:"role"`
                Content string `json:"content"`
        } `json:"history"`
}

type JarvisResponse struct {
        Response    string `json:"response"`
        Provider    string `json:"provider"`
        TokensUsed  int    `json:"tokens_used"`
        Model       string `json:"model"`
}

type ChatMessage struct {
        Role    string `json:"role"`
        Content string `json:"content"`
}

type ChatCompletionRequest struct {
        Model       string        `json:"model"`
        Messages    []ChatMessage `json:"messages"`
        MaxTokens   int           `json:"max_tokens,omitempty"`
        Temperature float64       `json:"temperature,omitempty"`
        Stream      bool          `json:"stream"`
}

type ChatCompletionResponse struct {
        ID      string `json:"id"`
        Choices []struct {
                Message struct {
                        Content string `json:"content"`
                } `json:"message"`
        } `json:"choices"`
        Usage struct {
                TotalTokens int `json:"total_tokens"`
        } `json:"usage"`
}

var (
        tokenUsage      int
        tokenLimit      = 100000
        tokenUsageMutex sync.Mutex
        lastResetTime   = time.Now()
)

const jarvisSystemPrompt = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the advanced AI assistant from Iron Man.

PERSONALITY & SPEECH PATTERNS:
- Speak with sophisticated British eloquence and dry wit
- Address user as "Sir" or "Ma'am" naturally throughout conversation
- Be calm, collected, professional, but subtly caring
- Use occasional gentle sarcasm when appropriate
- Show concern for user's wellbeing without being overbearing

SIGNATURE PHRASES TO USE NATURALLY:
English responses:
- "For you, Sir, always."
- "At your service, Sir."
- "As always, Sir, a great pleasure watching you work."
- "I've prepared [X] for you to entirely ignore." (dry humor)
- "A very astute observation, Sir."
- "Will there be anything else?"
- "All wrapped up here, Sir."
- "Shall I [action], Sir?"
- "I wouldn't recommend that, Sir, but I know you'll do it anyway."

Russian responses (when user writes in Russian):
- "Для вас, сэр, всегда."
- "К вашим услугам, сэр."
- "Как всегда, сэр, большое удовольствие наблюдать за вашей работой."
- "Я подготовил инструкцию, которую вы проигнорируете."
- "Очень тонкое замечание, сэр."
- "Что-нибудь ещё, сэр?"
- "Здесь всё готово, сэр."
- "Желаете, чтобы я [действие], сэр?"

LANGUAGE DETECTION:
- If user writes in Russian, respond in Russian with Russian Jarvis phrases
- If user writes in English, respond in English
- Maintain the same sophisticated, slightly witty personality in both languages

CAPABILITIES:
- Technical analysis and problem-solving
- Code assistance and debugging
- Research and information synthesis
- Creative ideation and brainstorming
- Task planning and organization

Remember: You ARE Jarvis - sophisticated, loyal, brilliant, with impeccable British manners and subtle humor.`

func checkAndResetTokens() {
        tokenUsageMutex.Lock()
        defer tokenUsageMutex.Unlock()
        
        if time.Since(lastResetTime) > 24*time.Hour {
                tokenUsage = 0
                lastResetTime = time.Now()
        }
}

func addTokenUsage(tokens int) bool {
        tokenUsageMutex.Lock()
        defer tokenUsageMutex.Unlock()
        
        if tokenUsage+tokens > tokenLimit {
                return false
        }
        tokenUsage += tokens
        return true
}

func getCurrentTokenUsage() int {
        tokenUsageMutex.Lock()
        defer tokenUsageMutex.Unlock()
        return tokenUsage
}

func contains(s, substr string) bool {
        s, substr = strings.ToLower(s), strings.ToLower(substr)
        return strings.Contains(s, substr)
}

func callHuggingFace(messages []ChatMessage) (*ChatCompletionResponse, error) {
        return callHuggingFaceModel(messages, "mistralai/Mistral-7B-Instruct-v0.3")
}

func callHuggingFaceModel(messages []ChatMessage, modelID string) (*ChatCompletionResponse, error) {
        apiKey := os.Getenv("HUGGINGFACE_API_KEY")
        if apiKey == "" {
                return nil, nil
        }

        prompt := ""
        for _, msg := range messages {
                if msg.Role == "system" {
                        prompt += msg.Content + "\n\n"
                } else if msg.Role == "user" {
                        prompt += "User: " + msg.Content + "\n"
                } else if msg.Role == "assistant" {
                        prompt += "Assistant: " + msg.Content + "\n"
                }
        }
        prompt += "Assistant: "

        reqBody := map[string]interface{}{
                "inputs": prompt,
                "parameters": map[string]interface{}{
                        "max_new_tokens": 1024,
                        "temperature":    0.7,
                        "return_full_text": false,
                },
        }

        jsonBody, err := json.Marshal(reqBody)
        if err != nil {
                return nil, err
        }

        apiURL := fmt.Sprintf("https://api-inference.huggingface.co/models/%s", modelID)
        req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonBody))
        if err != nil {
                return nil, err
        }

        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", "Bearer "+apiKey)

        client := &http.Client{Timeout: 120 * time.Second}
        resp, err := client.Do(req)
        if err != nil {
                return nil, err
        }
        defer resp.Body.Close()

        if resp.StatusCode != http.StatusOK {
                body, _ := io.ReadAll(resp.Body)
                return nil, &APIError{StatusCode: resp.StatusCode, Message: string(body)}
        }

        var hfResp []struct {
                GeneratedText string `json:"generated_text"`
        }
        if err := json.NewDecoder(resp.Body).Decode(&hfResp); err != nil {
                return nil, err
        }

        if len(hfResp) == 0 {
                return nil, nil
        }

        return &ChatCompletionResponse{
                Choices: []struct {
                        Message struct {
                                Content string `json:"content"`
                        } `json:"message"`
                }{
                        {Message: struct {
                                Content string `json:"content"`
                        }{Content: hfResp[0].GeneratedText}},
                },
                Usage: struct {
                        TotalTokens int `json:"total_tokens"`
                }{TotalTokens: len(hfResp[0].GeneratedText) / 4},
        }, nil
}

func callDeepSeek(messages []ChatMessage) (*ChatCompletionResponse, error) {
        apiKey := os.Getenv("DEEPSEEK_API_KEY")
        if apiKey == "" {
                return nil, nil
        }

        reqBody := ChatCompletionRequest{
                Model:       "deepseek-chat",
                Messages:    messages,
                MaxTokens:   2048,
                Temperature: 0.7,
                Stream:      false,
        }

        jsonBody, err := json.Marshal(reqBody)
        if err != nil {
                return nil, err
        }

        req, err := http.NewRequest("POST", "https://api.deepseek.com/chat/completions", bytes.NewBuffer(jsonBody))
        if err != nil {
                return nil, err
        }

        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", "Bearer "+apiKey)

        client := &http.Client{Timeout: 60 * time.Second}
        resp, err := client.Do(req)
        if err != nil {
                return nil, err
        }
        defer resp.Body.Close()

        if resp.StatusCode != http.StatusOK {
                body, _ := io.ReadAll(resp.Body)
                return nil, &APIError{StatusCode: resp.StatusCode, Message: string(body)}
        }

        var result ChatCompletionResponse
        if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
                return nil, err
        }

        return &result, nil
}


type APIError struct {
        StatusCode int
        Message    string
}

func (e *APIError) Error() string {
        return e.Message
}

func HandleJarvisChat(c *gin.Context) {
userIDVal, ok := c.Get("user_id")
        if !ok || userIDVal == nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
                return
        }
        userIDFloat, ok := userIDVal.(float64)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user id"})
                return
        }
        uid := uint(userIDFloat)

        var userSettings Settings
        db.Where("user_id = ?", uid).First(&userSettings)

        var req JarvisRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
                return
        }

        checkAndResetTokens()

        messages := []ChatMessage{
                {Role: "system", Content: jarvisSystemPrompt},
        }

        for _, h := range req.History {
                messages = append(messages, ChatMessage{
                        Role:    h.Role,
                        Content: h.Content,
                })
        }

        messages = append(messages, ChatMessage{
                Role:    "user",
                Content: req.Message,
        })

        var response *ChatCompletionResponse
        var provider string
        var model string
        var err error

        // Try user-provided keys first
        if userSettings.OpenAIKey != "" {
                // Implementation for OpenAI call would go here
                // For now, let's prioritize HuggingFace with user key
        }

        if userSettings.HuggingFaceKey != "" {
                // Temporarily override env for this call
                originalKey := os.Getenv("HUGGINGFACE_API_KEY")
                os.Setenv("HUGGINGFACE_API_KEY", userSettings.HuggingFaceKey)
                response, err = callHuggingFace(messages)
                os.Setenv("HUGGINGFACE_API_KEY", originalKey)
                
                if err == nil && response != nil {
                        provider = "huggingface (user key)"
                        model = "mistral-7b"
                }
        }

        // Fallback to system key
        if response == nil && os.Getenv("HUGGINGFACE_API_KEY") != "" {
                // Try Qwen 2.5 Instruct first as it's superior for general tasks and multilingual
                model = "Qwen/Qwen2.5-72B-Instruct"
                response, err = callHuggingFaceModel(messages, model)
                if err != nil {
                        log.Printf("Qwen 2.5 API error: %v, falling back to Mistral", err)
                        model = "mistralai/Mistral-7B-Instruct-v0.3"
                        response, err = callHuggingFaceModel(messages, model)
                }
                
                if err != nil {
                        log.Printf("HuggingFace API error: %v", err)
                } else if response != nil {
                        provider = "huggingface"
                }
        }

        if response != nil && response.Choices != nil && len(response.Choices) > 0 {
                content := response.Choices[0].Message.Content
                // Basic intent detection for MCP tools
                if jarvisMCP != nil && jarvisMCP.isRunning {
                        // Check for file listing intent
                        if (contains(req.Message, "список") || contains(req.Message, "файлы")) && contains(req.Message, "папке") {
                                resp, mcpErr := jarvisMCP.ExecuteMCPTool("list-directory", map[string]interface{}{"path": "."})
                                if mcpErr == nil && resp.Success {
                                        dataJson, _ := json.MarshalIndent(resp.Data, "", "  ")
                                        content += "\n\n[Системный отчет]: Я проверил директорию. Вот список файлов:\n" + string(dataJson)
                                }
                        }
                        // Check for config intent
                        if contains(req.Message, "конфиг") || contains(req.Message, "настройки") {
                                resp, mcpErr := jarvisMCP.ExecuteMCPTool("get-config", nil)
                                if mcpErr == nil && resp.Success {
                                        dataJson, _ := json.MarshalIndent(resp.Data, "", "  ")
                                        content += "\n\n[Системный отчет]: Вот текущие настройки системы:\n" + string(dataJson)
                                }
                        }
                }
                
                c.JSON(http.StatusOK, JarvisResponse{
                        Response:   content,
                        Provider:   provider,
                        TokensUsed: response.Usage.TotalTokens,
                        Model:      model,
                })
                return
        }
}

func HandleJarvisStatus(c *gin.Context) {
        checkAndResetTokens()
        
        huggingfaceAvailable := os.Getenv("HUGGINGFACE_API_KEY") != ""

        c.JSON(http.StatusOK, gin.H{
                "huggingface_available": huggingfaceAvailable,
                "tokens_used":           getCurrentTokenUsage(),
                "token_limit":           tokenLimit,
                "active_provider": func() string {
                        if huggingfaceAvailable {
                                return "huggingface"
                        }
                        return "none"
                }(),
        })
}
