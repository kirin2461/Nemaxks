package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// unreachableDB возвращает *gorm.DB поверх соединения, которое гарантированно
// не отвечает (порт 1 на loopback — connection refused, быстро и без сети).
func unreachableDB(t *testing.T) *gorm.DB {
	t.Helper()
	sqlDB, err := sql.Open("postgres", "host=127.0.0.1 port=1 user=x dbname=x connect_timeout=1 sslmode=disable")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	gdb, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}),
		&gorm.Config{DisableAutomaticPing: true})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	return gdb
}

func performReadyRequest(t *testing.T) (int, map[string]string) {
	t.Helper()
	r := gin.New()
	r.GET("/ready", ReadyHandler)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	r.ServeHTTP(w, req)

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON body %q: %v", w.Body.String(), err)
	}
	return w.Code, body
}

func TestReadyHandlerNilDB(t *testing.T) {
	oldDB, oldRedis := db, redisClient
	defer func() { db, redisClient = oldDB, oldRedis }()
	db = nil
	redisClient = nil
	t.Setenv("REDIS_URL", "")

	code, body := performReadyRequest(t)
	if code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", code)
	}
	if body["status"] != "not_ready" {
		t.Fatalf("expected status=not_ready, got %q", body["status"])
	}
	if body["db"] != "unavailable" {
		t.Fatalf("expected db=unavailable, got %q", body["db"])
	}
	if body["redis"] != "not_configured" {
		t.Fatalf("expected redis=not_configured, got %q", body["redis"])
	}
}

func TestReadyHandlerUnreachableDB(t *testing.T) {
	oldDB, oldRedis := db, redisClient
	defer func() { db, redisClient = oldDB, oldRedis }()
	db = unreachableDB(t)
	redisClient = nil
	// REDIS_URL задан, но клиент не инициализирован → redis unavailable,
	// однако на код ответа влияет только БД.
	t.Setenv("REDIS_URL", "localhost:6379")

	code, body := performReadyRequest(t)
	if code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", code)
	}
	if body["status"] != "not_ready" {
		t.Fatalf("expected status=not_ready, got %q", body["status"])
	}
	if body["db"] != "unavailable" {
		t.Fatalf("expected db=unavailable, got %q", body["db"])
	}
	if body["redis"] != "unavailable" {
		t.Fatalf("expected redis=unavailable, got %q", body["redis"])
	}
}

func TestMetricsMiddlewareRecordsMetrics(t *testing.T) {
	reg := prometheus.NewRegistry()
	_, _, mw := newHTTPMetrics(reg)

	r := gin.New()
	r.Use(mw)
	r.GET("/api/users/:id", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/users/123", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	families, err := reg.Gather()
	if err != nil {
		t.Fatalf("gather: %v", err)
	}
	counter := findMetricValue(t, families, "http_requests_total", map[string]string{
		"method": "GET", "path": "/api/users/:id", "status": "200",
	})
	if counter != 1 {
		t.Fatalf("expected http_requests_total=1 for normalized path, got %v", counter)
	}

	// Гистограмма должна иметь count=1 для тех же лейблов.
	histCount := 0
	for _, f := range families {
		if f.GetName() != "http_request_duration_seconds" {
			continue
		}
		for _, m := range f.GetMetric() {
			if labelsMatch(m, map[string]string{"method": "GET", "path": "/api/users/:id", "status": "200"}) {
				histCount = int(m.GetHistogram().GetSampleCount())
			}
		}
	}
	if histCount != 1 {
		t.Fatalf("expected http_request_duration_seconds count=1, got %d", histCount)
	}

	// Метрика не должна создаваться для сырого пути с конкретным id.
	if v := findMetricValueAllowZero(families, "http_requests_total", map[string]string{
		"method": "GET", "path": "/api/users/123", "status": "200",
	}); v != 0 {
		t.Fatalf("raw path leaked into labels: %v", v)
	}
}

func labelsMatch(m *dto.Metric, want map[string]string) bool {
	got := map[string]string{}
	for _, l := range m.GetLabel() {
		got[l.GetName()] = l.GetValue()
	}
	for k, v := range want {
		if got[k] != v {
			return false
		}
	}
	return true
}

func findMetricValue(t *testing.T, families []*dto.MetricFamily, name string, labels map[string]string) float64 {
	t.Helper()
	return findMetricValueAllowZero(families, name, labels)
}

func findMetricValueAllowZero(families []*dto.MetricFamily, name string, labels map[string]string) float64 {
	for _, f := range families {
		if f.GetName() != name {
			continue
		}
		for _, m := range f.GetMetric() {
			if labelsMatch(m, labels) {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}

func TestRequestIDMiddlewareGeneratesID(t *testing.T) {
	r := gin.New()
	r.Use(RequestIDMiddleware())
	r.GET("/ping", func(c *gin.Context) {
		ctxID := RequestIDFromContext(c.Request.Context())
		ginID := c.GetString("request_id")
		if ctxID == "" || ctxID != ginID {
			t.Errorf("request id not propagated: ctx=%q gin=%q", ctxID, ginID)
		}
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)

	id := w.Header().Get(RequestIDHeader)
	if id == "" {
		t.Fatal("X-Request-ID header missing in response")
	}
	if _, err := uuid.Parse(id); err != nil {
		t.Fatalf("generated request id is not a valid UUID: %q", id)
	}
}

func TestRequestIDMiddlewareProxiesIncomingID(t *testing.T) {
	r := gin.New()
	r.Use(RequestIDMiddleware())
	r.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set(RequestIDHeader, "incoming-req-42")
	r.ServeHTTP(w, req)

	if got := w.Header().Get(RequestIDHeader); got != "incoming-req-42" {
		t.Fatalf("expected proxied request id, got %q", got)
	}
}

func TestRequestIDMiddlewareRejectsTooLongID(t *testing.T) {
	r := gin.New()
	r.Use(RequestIDMiddleware())
	r.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set(RequestIDHeader, strings.Repeat("a", maxRequestIDLength+1))
	r.ServeHTTP(w, req)

	got := w.Header().Get(RequestIDHeader)
	if _, err := uuid.Parse(got); err != nil {
		t.Fatalf("expected regenerated UUID for oversized id, got %q", got)
	}
}
