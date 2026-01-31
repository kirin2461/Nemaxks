package main

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	zeroWidthChars = regexp.MustCompile(`[\x{200B}\x{200C}\x{200D}\x{FEFF}\x{00AD}]`)
	
	separatorPattern = regexp.MustCompile(`([a-zA-Zа-яА-ЯёЁ])[\s\.\-_,]+([a-zA-Zа-яА-ЯёЁ])`)
	
	cyrillicToLatin = map[rune]rune{
		'а': 'a', 'А': 'A',
		'с': 'c', 'С': 'C',
		'е': 'e', 'Е': 'E',
		'о': 'o', 'О': 'O',
		'р': 'p', 'Р': 'P',
		'х': 'x', 'Х': 'X',
		'у': 'y', 'У': 'Y',
		'В': 'B', 'в': 'b',
		'Н': 'H', 'н': 'h',
		'К': 'K', 'к': 'k',
		'М': 'M', 'м': 'm',
		'Т': 'T', 'т': 't',
	}
	
	latinToCyrillic = map[rune]rune{
		'a': 'а', 'A': 'А',
		'c': 'с', 'C': 'С',
		'e': 'е', 'E': 'Е',
		'o': 'о', 'O': 'О',
		'p': 'р', 'P': 'Р',
		'x': 'х', 'X': 'Х',
		'y': 'у', 'Y': 'У',
		'B': 'В', 'b': 'в',
		'H': 'Н', 'h': 'н',
		'K': 'К', 'k': 'к',
		'M': 'М', 'm': 'м',
		'T': 'Т', 't': 'т',
	}
	
	leetspeak = map[rune]rune{
		'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
		'6': 'b', '7': 't', '8': 'b', '9': 'g', '@': 'a',
		'$': 's', '!': 'i', '|': 'l',
	}
	
	cyrillicLeetspeak = map[rune]rune{
		'0': 'о', '3': 'з', '4': 'а', '6': 'б', '8': 'в',
	}
	
	unicodeConfusables = map[rune]rune{
		'ℱ': 'F', 'ℬ': 'B', 'ℐ': 'I', 'Ⓕ': 'F', 'Ⓑ': 'B', 'Ⓘ': 'I',
		'Ｆ': 'F', 'Ｂ': 'B', 'Ｉ': 'I',
		'Ѕ': 'S', 'І': 'I', 'Ј': 'J',
		'ᴵ': 'I', 'ᴮ': 'B', 'ᶠ': 'F',
		'🅕': 'F', '🅑': 'B', '🅘': 'I',
		'Ƒ': 'F', 'ᙠ': 'B',
		'∂': 'd', 'ß': 'b',
	}
	
	emojiPattern = regexp.MustCompile(`[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{26FF}]|[\x{2700}-\x{27BF}]`)
)

func NormalizeText(input string) string {
	text := input
	
	text = zeroWidthChars.ReplaceAllString(text, "")
	
	text = normalizeUnicodeConfusables(text)
	
	text = removeSeparators(text)
	
	text = normalizeMixedScript(text)
	
	text = decodeLeetspeak(text)
	
	text = removeInlineEmojis(text)
	
	text = strings.ToLower(text)
	
	text = normalizeWhitespace(text)
	
	return text
}

func normalizeUnicodeConfusables(text string) string {
	var result strings.Builder
	for _, r := range text {
		if replacement, ok := unicodeConfusables[r]; ok {
			result.WriteRune(replacement)
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

func removeSeparators(text string) string {
	for {
		newText := separatorPattern.ReplaceAllString(text, "$1$2")
		if newText == text {
			break
		}
		text = newText
	}
	return text
}

func normalizeMixedScript(text string) string {
	var result strings.Builder
	hasCyrillic := false
	hasLatin := false
	
	for _, r := range text {
		if isCyrillic(r) {
			hasCyrillic = true
		} else if isLatin(r) {
			hasLatin = true
		}
	}
	
	if hasCyrillic && hasLatin {
		for _, r := range text {
			if replacement, ok := latinToCyrillic[r]; ok {
				result.WriteRune(replacement)
			} else {
				result.WriteRune(r)
			}
		}
		return result.String()
	}
	
	return text
}

func decodeLeetspeak(text string) string {
	var result strings.Builder
	hasCyrillic := false
	
	for _, r := range text {
		if isCyrillic(r) {
			hasCyrillic = true
			break
		}
	}
	
	for _, r := range text {
		if hasCyrillic {
			if replacement, ok := cyrillicLeetspeak[r]; ok {
				result.WriteRune(replacement)
				continue
			}
		}
		if replacement, ok := leetspeak[r]; ok {
			result.WriteRune(replacement)
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

func removeInlineEmojis(text string) string {
	return emojiPattern.ReplaceAllString(text, "")
}

func normalizeWhitespace(text string) string {
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func isCyrillic(r rune) bool {
	return unicode.Is(unicode.Cyrillic, r)
}

func isLatin(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
}

func LevenshteinDistance(s1, s2 string) int {
	if len(s1) == 0 {
		return len(s2)
	}
	if len(s2) == 0 {
		return len(s1)
	}
	
	r1 := []rune(s1)
	r2 := []rune(s2)
	
	d := make([][]int, len(r1)+1)
	for i := range d {
		d[i] = make([]int, len(r2)+1)
	}
	
	for i := 0; i <= len(r1); i++ {
		d[i][0] = i
	}
	for j := 0; j <= len(r2); j++ {
		d[0][j] = j
	}
	
	for i := 1; i <= len(r1); i++ {
		for j := 1; j <= len(r2); j++ {
			cost := 0
			if r1[i-1] != r2[j-1] {
				cost = 1
			}
			d[i][j] = min(
				d[i-1][j]+1,
				d[i][j-1]+1,
				d[i-1][j-1]+cost,
			)
		}
	}
	
	return d[len(r1)][len(r2)]
}

func FuzzyMatch(text, keyword string, maxDistance int) bool {
	text = strings.ToLower(text)
	keyword = strings.ToLower(keyword)
	
	if strings.Contains(text, keyword) {
		return true
	}
	
	words := strings.Fields(text)
	for _, word := range words {
		if LevenshteinDistance(word, keyword) <= maxDistance {
			return true
		}
	}
	
	for i := 0; i <= len(text)-len(keyword); i++ {
		if LevenshteinDistance(text[i:i+len(keyword)], keyword) <= maxDistance {
			return true
		}
	}
	
	return false
}

func ContainsNGram(text string, keywords []string, n int) bool {
	text = strings.ToLower(text)
	
	for _, keyword := range keywords {
		keyword = strings.ToLower(keyword)
		if len(keyword) < n {
			if strings.Contains(text, keyword) {
				return true
			}
			continue
		}
		
		matchCount := 0
		requiredMatches := len(keyword) - n + 1
		threshold := requiredMatches * 70 / 100
		
		for i := 0; i <= len(keyword)-n; i++ {
			ngram := keyword[i : i+n]
			if strings.Contains(text, ngram) {
				matchCount++
			}
		}
		
		if matchCount >= threshold {
			return true
		}
	}
	
	return false
}

func min(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}
