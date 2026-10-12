package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// RequestIDHeader — заголовок, через который request-id проксируется
// между сервисами и возвращается клиенту.
const RequestIDHeader = "X-Request-ID"

// maxRequestIDLength ограничивает длину входящего request-id, чтобы
// клиент не мог раздуть логи/заголовки произвольно длинной строкой.
const maxRequestIDLength = 128

type requestIDContextKey struct{}

// Пакетные метрики Prometheus, регистрируемые на default registry.
var (
	httpRequestsTotal     *prometheus.CounterVec
	httpRequestDuration   *prometheus.HistogramVec
	metricsMiddlewareFunc gin.HandlerFunc
)

func init() {
	httpRequestsTotal, httpRequestDuration, metricsMiddlewareFunc = newHTTPMetrics(prometheus.DefaultRegisterer)
}

// newHTTPMetrics создаёт счётчик http_requests_total и гистограмму
// http_request_duration_seconds на заданном регистраторе и возвращает их
// вместе с middleware. Выделено в функцию, чтобы тесты могли использовать
// собственный prometheus.Registry без коллизий с default registry.
func newHTTPMetrics(reg prometheus.Registerer) (*prometheus.CounterVec, *prometheus.HistogramVec, gin.HandlerFunc) {
	requests := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total number of HTTP requests processed, labeled by method, route pattern and status code.",
	}, []string{"method", "path", "status"})

	duration := promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency in seconds, labeled by method, route pattern and status code.",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path", "status"})

	mw := func(c *gin.Context) {
		start := time.Now()
		c.Next()

		// FullPath возвращает шаблон маршрута ("/api/users/:id"), а не
		// сырой путь — это защищает от cardinality explosion по :id.
		path := c.FullPath()
		if path == "" {
			path = "unmatched"
		}
		status := strconv.Itoa(c.Writer.Status())
		requests.WithLabelValues(c.Request.Method, path, status).Inc()
		duration.WithLabelValues(c.Request.Method, path, status).Observe(time.Since(start).Seconds())
	}
	return requests, duration, mw
}

// MetricsMiddleware записывает http_requests_total и
// http_request_duration_seconds для каждого запроса.
func MetricsMiddleware() gin.HandlerFunc {
	return metricsMiddlewareFunc
}

// MetricsHandler отдаёт метрики Prometheus (GET /metrics).
func MetricsHandler() gin.HandlerFunc {
	return gin.WrapH(promhttp.Handler())
}

// RequestIDMiddleware генерирует (или проксирует входящий) request-id,
// кладёт его в заголовок ответа X-Request-ID, в gin.Context ("request_id")
// и в request.Context, после чего логирует method/path/status/duration.
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" || len(id) > maxRequestIDLength {
			id = uuid.NewString()
		}
		c.Header(RequestIDHeader, id)
		c.Set("request_id", id)
		ctx := context.WithValue(c.Request.Context(), requestIDContextKey{}, id)
		c.Request = c.Request.WithContext(ctx)

		start := time.Now()
		c.Next()

		log.Printf("request method=%s path=%s status=%d duration=%s request_id=%s",
			c.Request.Method, c.Request.URL.Path, c.Writer.Status(), time.Since(start), id)
	}
}

// RequestIDFromContext извлекает request-id из контекста запроса.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDContextKey{}).(string); ok {
		return id
	}
	return ""
}

// ReadyHandler — readiness probe: 200 только когда БД доступна.
// Redis: если REDIS_URL задан — пингуем; не задан — degraded, но на
// готовность не влияет. Ответ: {status, db, redis}.
func ReadyHandler(c *gin.Context) {
	dbStatus := "ok"
	ready := true

	if db == nil {
		dbStatus = "unavailable"
		ready = false
	} else if sqlDB, err := db.DB(); err != nil {
		dbStatus = "error"
		ready = false
	} else {
		pingCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(pingCtx); err != nil {
			dbStatus = "unavailable"
			ready = false
		}
	}

	redisStatus := "not_configured"
	if os.Getenv("REDIS_URL") != "" {
		switch {
		case redisClient == nil:
			redisStatus = "unavailable"
		default:
			pingCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
			defer cancel()
			if err := redisClient.Ping(pingCtx).Err(); err != nil {
				redisStatus = "unavailable"
			} else {
				redisStatus = "ok"
			}
		}
	}

	status := http.StatusOK
	overall := "ready"
	if !ready {
		status = http.StatusServiceUnavailable
		overall = "not_ready"
	}
	c.JSON(status, gin.H{
		"status": overall,
		"db":     dbStatus,
		"redis":  redisStatus,
	})
}
