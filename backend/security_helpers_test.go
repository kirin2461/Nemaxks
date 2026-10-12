package main

import (
        "os"
        "testing"
)

func TestValidatePasswordPolicy(t *testing.T) {
        cases := []struct {
                password string
                wantErr  bool
        }{
                {"short1a", true},          // < 8 символов
                {"abcdefgh", true},         // нет цифры
                {"12345678", true},         // нет буквы
                {"abcd1234", false},        // валидный
                {"Пароль123", false},       // unicode-буквы считаются
                {"averylongpassword1", false},
        }
        for _, tc := range cases {
                err := validatePasswordPolicy(tc.password)
                if (err != nil) != tc.wantErr {
                        t.Errorf("validatePasswordPolicy(%q): err=%v, wantErr=%v", tc.password, err, tc.wantErr)
                }
        }
}

func TestMaskAPIKey(t *testing.T) {
        if got := MaskAPIKey(""); got != "" {
                t.Errorf("empty key should stay empty, got %q", got)
        }
        if got := MaskAPIKey("sk-abcdef1234567890"); got != "sk-...7890" {
                t.Errorf("unexpected mask: %q", got)
        }
        if got := MaskAPIKey("abc"); got != "****" {
                t.Errorf("short key should be fully masked, got %q", got)
        }
        // Маска не должна содержать середину ключа
        masked := MaskAPIKey("sk-live-secret-key-9876")
        if masked == "sk-live-secret-key-9876" {
                t.Error("key was not masked")
        }
}

func TestIsMaskedAPIKey(t *testing.T) {
        if !IsMaskedAPIKey("") {
                t.Error("empty value counts as mask (must not overwrite)")
        }
        if !IsMaskedAPIKey("sk-...1234") || !IsMaskedAPIKey("****") {
                t.Error("masked values not detected")
        }
        if IsMaskedAPIKey("sk-realnewkey123") {
                t.Error("real key detected as mask")
        }
}

func TestYooKassaWebhookIPAllowed(t *testing.T) {
        // По умолчанию проверка включена
        os.Unsetenv("YOOKASSA_WEBHOOK_IP_CHECK")
        if !yookassaWebhookIPAllowed("185.71.76.10") {
                t.Error("official YooKassa IP 185.71.76.10 rejected")
        }
        if !yookassaWebhookIPAllowed("77.75.153.5") {
                t.Error("official YooKassa IP 77.75.153.5 rejected")
        }
        if yookassaWebhookIPAllowed("8.8.8.8") {
                t.Error("foreign IP 8.8.8.8 allowed")
        }
        if yookassaWebhookIPAllowed("not-an-ip") {
                t.Error("garbage IP allowed")
        }
        // Feature-flag off
        t.Setenv("YOOKASSA_WEBHOOK_IP_CHECK", "false")
        if !yookassaWebhookIPAllowed("8.8.8.8") {
                t.Error("IP check disabled via env should allow any IP")
        }
}

func TestIsOriginAllowed(t *testing.T) {
        // Без env — dev fallback (replit/localhost)
        os.Unsetenv("CORS_ALLOWED_ORIGINS")
        os.Unsetenv("ALLOWED_ORIGINS")
        if !isOriginAllowed("http://localhost:5000") {
                t.Error("localhost should be allowed in dev fallback")
        }
        if isOriginAllowed("https://evil.example.com") {
                t.Error("unknown origin allowed in dev fallback")
        }
        // С env — строгий allowlist
        t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com, https://admin.example.com")
        if !isOriginAllowed("https://app.example.com") {
                t.Error("allowlisted origin rejected")
        }
        if isOriginAllowed("http://localhost:5000") {
                t.Error("localhost allowed despite explicit allowlist")
        }
        if isOriginAllowed("https://app.example.com.evil.com") {
                t.Error("suffix-spoofed origin allowed")
        }
}

func TestIsReleaseMode(t *testing.T) {
        t.Setenv("GIN_MODE", "release")
        if !isReleaseMode() {
                t.Error("release mode not detected")
        }
        t.Setenv("GIN_MODE", "debug")
        if isReleaseMode() {
                t.Error("debug mode detected as release")
        }
        t.Setenv("GIN_MODE", "test")
        if isReleaseMode() {
                t.Error("test mode detected as release")
        }
}
