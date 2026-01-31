package main

import (
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

type FraudDetector struct{}

type DetectionResult struct {
	IsFraud         bool     `json:"is_fraud"`
	AlertType       string   `json:"alert_type"`
	Severity        string   `json:"severity"`
	Description     string   `json:"description"`
	MatchedKeywords []string `json:"matched_keywords,omitempty"`
	MatchedPatterns []string `json:"matched_patterns,omitempty"`
	Action          string   `json:"action"`
	RiskIncrease    float64  `json:"risk_increase"`
}

func NewFraudDetector() *FraudDetector {
	return &FraudDetector{}
}

func (fd *FraudDetector) AnalyzeMessage(content string, userID uint) []DetectionResult {
	var results []DetectionResult
	
	normalized := NormalizeText(content)
	
	if result := fd.DetectImpersonation(content, normalized); result.IsFraud {
		results = append(results, result)
	}
	
	if result := fd.DetectPhishing(content); result.IsFraud {
		results = append(results, result)
	}
	
	if result := fd.DetectScam(content, normalized); result.IsFraud {
		results = append(results, result)
	}
	
	return results
}

func (fd *FraudDetector) DetectImpersonation(original, normalized string) DetectionResult {
	result := DetectionResult{
		AlertType: "impersonation",
		Severity:  "critical",
		Action:    "permaban",
	}
	
	var matchedKeywords []string
	
	agencies := GetAllAgencyKeywords()
	abbreviations := GetAllAbbreviations()
	phrases := GetImpersonationPhrases()
	
	for _, keyword := range agencies {
		if strings.Contains(normalized, strings.ToLower(keyword)) {
			matchedKeywords = append(matchedKeywords, keyword)
		}
	}
	
	for _, abbr := range abbreviations {
		if FuzzyMatch(normalized, abbr, 1) {
			found := false
			for _, mk := range matchedKeywords {
				if strings.ToLower(mk) == abbr {
					found = true
					break
				}
			}
			if !found {
				matchedKeywords = append(matchedKeywords, abbr)
			}
		}
	}
	
	hasImpersonationPhrase := false
	for _, phrase := range phrases {
		if strings.Contains(normalized, strings.ToLower(phrase)) {
			hasImpersonationPhrase = true
			matchedKeywords = append(matchedKeywords, phrase)
			break
		}
	}
	
	if len(matchedKeywords) > 0 && hasImpersonationPhrase {
		result.IsFraud = true
		result.MatchedKeywords = matchedKeywords
		result.Description = "User is impersonating law enforcement or government agency"
		result.RiskIncrease = 100
		return result
	}
	
	claimPatterns := []string{
		`(?i)(я|i am|i'm|this is)\s+(из|from|сотрудник|работник|agent|officer|представитель)`,
		`(?i)(звоню|пишу|обращаюсь|calling|writing|contacting)\s+(из|from|от имени)`,
		`(?i)(вас|you are)\s+(подозрева|обвиня|разыскива|suspected|accused|wanted)`,
		`(?i)(уголовн|criminal|legal)\s+(дел|case|matter)`,
	}
	
	for _, pattern := range claimPatterns {
		re := regexp.MustCompile(pattern)
		if re.MatchString(normalized) && len(matchedKeywords) > 0 {
			result.IsFraud = true
			result.MatchedKeywords = matchedKeywords
			result.MatchedPatterns = []string{pattern}
			result.Description = "User is impersonating law enforcement with claim patterns"
			result.RiskIncrease = 100
			return result
		}
	}
	
	if len(matchedKeywords) >= 2 {
		result.IsFraud = true
		result.MatchedKeywords = matchedKeywords
		result.Description = "Multiple law enforcement keywords detected"
		result.RiskIncrease = 100
		return result
	}
	
	return result
}

func (fd *FraudDetector) DetectPhishing(content string) DetectionResult {
	result := DetectionResult{
		AlertType: "phishing",
		Severity:  "high",
		Action:    "ban",
	}
	
	urlPattern := regexp.MustCompile(`https?://[^\s]+|www\.[^\s]+`)
	urls := urlPattern.FindAllString(content, -1)
	
	phishingDomains := GetPhishingDomains()
	var matchedPatterns []string
	
	for _, url := range urls {
		urlLower := strings.ToLower(url)
		for _, domain := range phishingDomains {
			if strings.Contains(urlLower, domain) {
				matchedPatterns = append(matchedPatterns, url)
			}
		}
		
		suspiciousIndicators := []string{
			"discord-nitro", "free-nitro", "steam-gift", "steamcommunlty",
			"login", "verify", "password", "account", "security",
		}
		
		for _, indicator := range suspiciousIndicators {
			if strings.Contains(urlLower, indicator) && !strings.Contains(urlLower, "discord.com") && !strings.Contains(urlLower, "steampowered.com") {
				matchedPatterns = append(matchedPatterns, url+" (suspicious: "+indicator+")")
			}
		}
	}
	
	if len(matchedPatterns) > 0 {
		result.IsFraud = true
		result.MatchedPatterns = matchedPatterns
		result.Description = "Phishing links detected in message"
		result.RiskIncrease = 50
	}
	
	return result
}

func (fd *FraudDetector) DetectScam(original, normalized string) DetectionResult {
	result := DetectionResult{
		AlertType: "scam",
		Severity:  "medium",
		Action:    "warn",
	}
	
	scamKeywords := GetScamKeywords()
	var matchedKeywords []string
	
	for _, keyword := range scamKeywords {
		if strings.Contains(normalized, strings.ToLower(keyword)) {
			matchedKeywords = append(matchedKeywords, keyword)
		}
	}
	
	patterns := GetSuspiciousPatterns()
	var matchedPatterns []string
	
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		if re.MatchString(original) || re.MatchString(normalized) {
			matchedPatterns = append(matchedPatterns, pattern)
		}
	}
	
	if len(matchedKeywords) >= 2 || len(matchedPatterns) >= 1 {
		result.IsFraud = true
		result.MatchedKeywords = matchedKeywords
		result.MatchedPatterns = matchedPatterns
		result.Description = "Potential scam content detected"
		result.RiskIncrease = 25
		
		if len(matchedKeywords) >= 3 || len(matchedPatterns) >= 2 {
			result.Severity = "high"
			result.Action = "mute"
			result.RiskIncrease = 40
		}
	}
	
	return result
}

func (fd *FraudDetector) CheckSpam(userID uint, channelID uint, content string) DetectionResult {
	result := DetectionResult{
		AlertType: "spam",
		Severity:  "medium",
		Action:    "mute",
	}
	
	var rateLimit MessageRateLimit
	db.Where("user_id = ? AND channel_id = ?", userID, channelID).First(&rateLimit)
	
	now := time.Now()
	windowDuration := time.Minute
	
	if rateLimit.ID == 0 || now.Sub(rateLimit.WindowStart) > windowDuration {
		rateLimit = MessageRateLimit{
			UserID:        userID,
			ChannelID:     &channelID,
			MessageCount:  1,
			WindowStart:   now,
			LastMessageAt: now,
		}
		db.Create(&rateLimit)
		return result
	}
	
	rateLimit.MessageCount++
	rateLimit.LastMessageAt = now
	db.Save(&rateLimit)
	
	if rateLimit.MessageCount > 10 {
		result.IsFraud = true
		result.Description = "Message flooding detected"
		result.RiskIncrease = 15
	}
	
	return result
}

func (fd *FraudDetector) CreateAlert(userID uint, result DetectionResult, evidence map[string]interface{}, sourceIP, deviceFP string) error {
	evidenceJSON, _ := json.Marshal(evidence)
	
	alert := FraudAlert{
		UserID:            userID,
		AlertType:         result.AlertType,
		Severity:          result.Severity,
		Description:       result.Description,
		Evidence:          string(evidenceJSON),
		SourceIP:          sourceIP,
		DeviceFingerprint: deviceFP,
		Status:            "pending",
		ActionTaken:       result.Action,
		CreatedAt:         time.Now(),
	}
	
	if err := db.Create(&alert).Error; err != nil {
		return err
	}
	
	fd.UpdateRiskScore(userID, result)
	
	return nil
}

func (fd *FraudDetector) UpdateRiskScore(userID uint, result DetectionResult) {
	var riskScore UserRiskScore
	db.Where("user_id = ?", userID).First(&riskScore)
	
	if riskScore.ID == 0 {
		riskScore = UserRiskScore{
			UserID: userID,
		}
	}
	
	switch result.AlertType {
	case "spam":
		riskScore.SpamScore = minFloat(100, riskScore.SpamScore+result.RiskIncrease)
	case "phishing":
		riskScore.PhishingScore = minFloat(100, riskScore.PhishingScore+result.RiskIncrease)
	case "impersonation":
		riskScore.ImpersonationScore = minFloat(100, riskScore.ImpersonationScore+result.RiskIncrease)
	case "scam":
		riskScore.ScamScore = minFloat(100, riskScore.ScamScore+result.RiskIncrease)
	default:
		riskScore.BehaviorScore = minFloat(100, riskScore.BehaviorScore+result.RiskIncrease)
	}
	
	riskScore.TotalAlerts++
	now := time.Now()
	riskScore.LastAlertAt = &now
	
	db.Save(&riskScore)
}

func (fd *FraudDetector) ExecuteAction(userID uint, action string, reason string) error {
	switch action {
	case "warn":
		return nil
	case "mute":
		return fd.MuteUser(userID, time.Hour, reason)
	case "ban":
		return fd.BanUser(userID, false, reason)
	case "permaban":
		return fd.BanUser(userID, true, reason)
	}
	return nil
}

func (fd *FraudDetector) MuteUser(userID uint, duration time.Duration, reason string) error {
	expiresAt := time.Now().Add(duration)
	
	rateLimit := MessageRateLimit{
		UserID:        userID,
		IsMuted:       true,
		MuteExpiresAt: &expiresAt,
	}
	
	return db.Where("user_id = ?", userID).Assign(rateLimit).FirstOrCreate(&MessageRateLimit{}).Error
}

func (fd *FraudDetector) BanUser(userID uint, permanent bool, reason string) error {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}
	
	if permanent {
		user.Role = "banned"
	}
	
	return db.Save(&user).Error
}

func (fd *FraudDetector) RecordImpersonationBan(userID uint, username, original, normalized string, keywords []string, sourceIP, deviceFP string) error {
	keywordsJSON, _ := json.Marshal(keywords)
	
	ban := ImpersonationBan{
		UserID:            userID,
		Username:          username,
		DetectedKeywords:  string(keywordsJSON),
		OriginalMessage:   original,
		NormalizedMessage: normalized,
		SourceIP:          sourceIP,
		DeviceFingerprint: deviceFP,
		BannedAt:          time.Now(),
		BannedBy:          "system",
	}
	
	return db.Create(&ban).Error
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

var fraudDetector = NewFraudDetector()
