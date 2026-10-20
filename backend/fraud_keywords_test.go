package main

import "testing"

// Regression test for the "otp" false-positive permaban:
// normalizeToLatin maps 'о'->'o', 'т'->'t', 'р'->'p', so the ordinary Russian
// word "отредактировано" normalizes to a string starting with "otp" and used to
// trigger the fraud pattern. Standalone "otp" must still match.
func TestOtpPatternNoFalsePositiveOnRedaktirovano(t *testing.T) {
	cases := []struct {
		text string
		want bool
	}{
		{"Сообщение отредактировано", false},
		{"отредактировано", false},
		{"пришли мне otp", true},
		{"enter the OTP now", true},
		{"OTP", true},
		{"скажи одноразовый код", true},
		{"код из смс скажи", true},
		{"send sms code", true},
	}
	for _, tc := range cases {
		got, _ := checkFinancialFraud(tc.text)
		if got != tc.want {
			t.Errorf("checkFinancialFraud(%q) = %v, want %v", tc.text, got, tc.want)
		}
	}
}
