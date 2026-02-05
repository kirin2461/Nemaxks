package main

import (
        "net/http"
        "regexp"
        "strconv"
        "strings"
        "time"

        "github.com/gin-gonic/gin"
)

var defaultForbiddenWords = []string{
        "криминал", "насилие", "оскорбления", "спам", "фишинг", "мошенничество",
        "crime", "violence", "insult", "spam", "phishing", "fraud",
}

var financialFraudPatterns = []string{
        "номер карты", "номер карт", "cvv", "cvv2", "cvc", "cvc2",
        "пин код", "пин-код", "пинкод", "pin code", "pincode",
        "перевод денег", "переведи деньги", "скинь деньги",
        "дай карту", "дайте карту", "скинь карту",
        "реквизиты", "банковские данные", "данные карты",
        "номер счета", "номер счёта",
        "кредитка", "кредитная карта", "дебетовая карта",
        "срок действия карты", "expiry date", "card number",
        "send money", "bank details", "credit card",
        "crypto wallet", "криптокошелек", "крипто кошелек",
        "qiwi", "киви", "юмани", "yoomoney",
}

var normalizedFraudPatternsCyrillic []string
var normalizedFraudPatternsLatin []string

func init() {
        for _, pattern := range financialFraudPatterns {
                normalizedFraudPatternsCyrillic = append(normalizedFraudPatternsCyrillic, NormalizeText(pattern))
                normalizedFraudPatternsLatin = append(normalizedFraudPatternsLatin, normalizeToLatin(pattern))
        }
}

func normalizeToLatin(text string) string {
        text = strings.ToLower(text)
        var result strings.Builder
        
        cyrillicToLatinMap := map[rune]rune{
                'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y',
                'в': 'b', 'н': 'h', 'к': 'k', 'м': 'm', 'т': 't',
        }
        leetToLatin := map[rune]rune{
                '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i',
                '3': 'e', '$': 's', '5': 's', '7': 't', '6': 'b', '8': 'b', '9': 'g',
        }
        
        for _, r := range text {
                if replacement, ok := leetToLatin[r]; ok {
                        result.WriteRune(replacement)
                } else if replacement, ok := cyrillicToLatinMap[r]; ok {
                        result.WriteRune(replacement)
                } else {
                        result.WriteRune(r)
                }
        }
        
        normalized := strings.Map(func(r rune) rune {
                if r == '-' || r == '_' || r == '.' || r == ',' || r == '*' || r == '#' {
                        return -1
                }
                return r
        }, result.String())
        
        return strings.Join(strings.Fields(normalized), " ")
}

func checkFinancialFraud(content string) (bool, string) {
        normalizedCyrillic := NormalizeText(content)
        normalizedLatin := normalizeToLatin(content)
        
        for i, pattern := range financialFraudPatterns {
                if strings.Contains(normalizedCyrillic, normalizedFraudPatternsCyrillic[i]) {
                        return true, pattern
                }
                if strings.Contains(normalizedLatin, normalizedFraudPatternsLatin[i]) {
                        return true, pattern
                }
        }
        return false, ""
}

func permaBanUser(userID uint, reason string, matchedPattern string) error {
        now := time.Now()
        
        truncatedReason := reason
        if len(truncatedReason) > 200 {
                truncatedReason = truncatedReason[:200] + "..."
        }
        truncatedPattern := matchedPattern
        if len(truncatedPattern) > 100 {
                truncatedPattern = truncatedPattern[:100]
        }
        
        if db != nil {
                db.Create(&ForbiddenAttempt{
                        UserID:           userID,
                        AttemptedContent: truncatedReason,
                        MatchedWords:     truncatedPattern,
                        Context:          "financial_fraud_permaban",
                        CreatedAt:        now,
                })
        }
        
        logAudit(0, "auto_permaban_financial_fraud", "user", strconv.FormatUint(uint64(userID), 10), "system")
        
        if db == nil {
                return nil
        }
        
        var user User
        if db.First(&user, userID).RowsAffected == 0 {
                return nil
        }
        
        user.IsBlocked = true
        user.BlockReason = "Автоматический пермабан: финансовое мошенничество (паттерн: " + truncatedPattern + ")"
        
        db.Save(&user)
        
        return nil
}

func initDefaultForbiddenWords() {
        if db == nil {
                return
        }

        var count int64
        db.Model(&ForbiddenWord{}).Count(&count)
        if count == 0 {
                for _, word := range defaultForbiddenWords {
                        category := "general"
                        if strings.Contains(word, "крим") || word == "crime" {
                                category = "criminal"
                        } else if strings.Contains(word, "насил") || word == "violence" {
                                category = "violence"
                        } else if strings.Contains(word, "спам") || word == "spam" {
                                category = "spam"
                        } else if strings.Contains(word, "фиш") || word == "phishing" || strings.Contains(word, "мошен") || word == "fraud" {
                                category = "fraud"
                        }

                        db.Create(&ForbiddenWord{
                                Word:      strings.ToLower(word),
                                Category:  category,
                                IsRegex:   false,
                                AddedBy:   0,
                                CreatedAt: time.Now(),
                        })
                }
        }
}

type ContentFilterResult struct {
        IsForbidden   bool     `json:"is_forbidden"`
        MatchedWords  []string `json:"matched_words"`
        OriginalText  string   `json:"original_text"`
}

func checkContentFilter(content string, userID uint, context string) ContentFilterResult {
        result := ContentFilterResult{
                IsForbidden:   false,
                MatchedWords:  []string{},
                OriginalText:  content,
        }

        if db == nil {
                return result
        }

        if isFraud, pattern := checkFinancialFraud(content); isFraud {
                result.IsForbidden = true
                result.MatchedWords = append(result.MatchedWords, "[FINANCIAL_FRAUD] "+pattern)
                
                if userID > 0 {
                        permaBanUser(userID, content, pattern)
                }
                return result
        }

        var forbiddenWords []ForbiddenWord
        db.Find(&forbiddenWords)

        lowerContent := strings.ToLower(content)
        normalizedContent := NormalizeText(content)

        for _, fw := range forbiddenWords {
                matched := false

                if fw.IsRegex {
                        re, err := regexp.Compile("(?i)" + fw.Word)
                        if err == nil && re.MatchString(content) {
                                matched = true
                        }
                } else {
                        normalizedWord := NormalizeText(fw.Word)
                        if strings.Contains(lowerContent, strings.ToLower(fw.Word)) {
                                matched = true
                        } else if strings.Contains(normalizedContent, normalizedWord) {
                                matched = true
                        }
                }

                if matched {
                        result.IsForbidden = true
                        result.MatchedWords = append(result.MatchedWords, fw.Word)
                }
        }

        if result.IsForbidden && userID > 0 {
                truncatedContent := content
                if len(truncatedContent) > 500 {
                        truncatedContent = truncatedContent[:500] + "..."
                }
                attempt := ForbiddenAttempt{
                        UserID:           userID,
                        AttemptedContent: truncatedContent,
                        MatchedWords:     strings.Join(result.MatchedWords, ", "),
                        Context:          context,
                        CreatedAt:        time.Now(),
                }
                db.Create(&attempt)
        }

        return result
}

func getForbiddenWordsHandler(c *gin.Context) {
        if db == nil {
                c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database not available"})
                return
        }
        var words []ForbiddenWord
        db.Order("category, word").Find(&words)
        c.JSON(http.StatusOK, words)
}

func addForbiddenWordHandler(c *gin.Context) {
        if db == nil {
                c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database not available"})
                return
        }
        userID, _ := c.Get("user_id")
        adminID := uint(userID.(float64))

        var req struct {
                Word     string `json:"word" binding:"required"`
                Category string `json:"category"`
                IsRegex  bool   `json:"is_regex"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        if req.IsRegex {
                _, err := regexp.Compile(req.Word)
                if err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid regex pattern"})
                        return
                }
        }

        word := ForbiddenWord{
                Word:      strings.ToLower(req.Word),
                Category:  req.Category,
                IsRegex:   req.IsRegex,
                AddedBy:   adminID,
                CreatedAt: time.Now(),
        }

        if err := db.Create(&word).Error; err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Word already exists"})
                return
        }

        logAudit(adminID, "add_forbidden_word", "forbidden_word", req.Word, c.ClientIP())

        c.JSON(http.StatusCreated, word)
}

func updateForbiddenWordHandler(c *gin.Context) {
        if db == nil {
                c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database not available"})
                return
        }
        userID, _ := c.Get("user_id")
        adminID := uint(userID.(float64))

        wordID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid word ID"})
                return
        }

        var req struct {
                Word     string `json:"word"`
                Category string `json:"category"`
                IsRegex  bool   `json:"is_regex"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var word ForbiddenWord
        if db.First(&word, wordID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Word not found"})
                return
        }

        if req.Word != "" {
                if req.IsRegex {
                        _, err := regexp.Compile(req.Word)
                        if err != nil {
                                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid regex pattern"})
                                return
                        }
                }
                word.Word = strings.ToLower(req.Word)
        }
        if req.Category != "" {
                word.Category = req.Category
        }
        word.IsRegex = req.IsRegex

        db.Save(&word)

        logAudit(adminID, "update_forbidden_word", "forbidden_word", word.Word, c.ClientIP())

        c.JSON(http.StatusOK, word)
}

func deleteForbiddenWordHandler(c *gin.Context) {
        if db == nil {
                c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database not available"})
                return
        }
        userID, _ := c.Get("user_id")
        adminID := uint(userID.(float64))

        wordID, err := strconv.ParseUint(c.Param("id"), 10, 32)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid word ID"})
                return
        }

        var word ForbiddenWord
        if db.First(&word, wordID).RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "Word not found"})
                return
        }

        db.Delete(&word)

        logAudit(adminID, "delete_forbidden_word", "forbidden_word", word.Word, c.ClientIP())

        c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func getForbiddenAttemptsHandler(c *gin.Context) {
        if db == nil {
                c.JSON(http.StatusOK, gin.H{"attempts": []ForbiddenAttempt{}, "total": 0})
                return
        }
        page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
        limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
        offset := (page - 1) * limit

        var attempts []ForbiddenAttempt
        var total int64

        query := db.Model(&ForbiddenAttempt{})

        if userID := c.Query("user_id"); userID != "" {
                query = query.Where("user_id = ?", userID)
        }
        if context := c.Query("context"); context != "" {
                query = query.Where("context = ?", context)
        }

        query.Count(&total)
        query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&attempts)

        c.JSON(http.StatusOK, gin.H{
                "attempts": attempts,
                "total":    total,
                "page":     page,
                "limit":    limit,
        })
}

func validateContentHandler(c *gin.Context) {
        userID, exists := c.Get("user_id")
        uid := uint(0)
        if exists {
                uid = uint(userID.(float64))
        }

        var req struct {
                Content string `json:"content" binding:"required"`
                Context string `json:"context"`
        }
        if err := c.BindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        result := checkContentFilter(req.Content, uid, req.Context)

        c.JSON(http.StatusOK, gin.H{
                "is_forbidden":  result.IsForbidden,
                "matched_words": result.MatchedWords,
        })
}
