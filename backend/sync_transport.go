package main

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm/clause"
)

// SyncTransportSetting — рубильник транспорта синхронизации (NSP spec §8).
// key: ws | wstunnel | sse | nsp | kill_all.
// Для транспортов enabled=true = транспорт работает; kill_all=true = аварийное
// глушение всей realtime-синхронизации.
type SyncTransportSetting struct {
	Key       string    `gorm:"primaryKey;column:key" json:"key"`
	Enabled   bool      `gorm:"column:enabled" json:"enabled"`
	UpdatedBy uint      `gorm:"column:updated_by" json:"updated_by"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (SyncTransportSetting) TableName() string { return "sync_transport_settings" }

// SyncTransportAudit — журнал каждого движения рубильника.
type SyncTransportAudit struct {
	ID        uint      `gorm:"primaryKey;column:id" json:"id"`
	Key       string    `gorm:"column:key;index" json:"key"`
	OldValue  bool      `gorm:"column:old_value" json:"old_value"`
	NewValue  bool      `gorm:"column:new_value" json:"new_value"`
	ChangedBy uint      `gorm:"column:changed_by" json:"changed_by"`
	ChangedAt time.Time `gorm:"column:changed_at" json:"changed_at"`
	SpaKeyID  string    `gorm:"column:spa_key_id" json:"spa_key_id"` // SPA-подпись (NSP spec §6), "" если не требовалась
}

func (SyncTransportAudit) TableName() string { return "sync_transport_audit" }

// syncTransportKeys — whitelist допустимых ключей рубильника.
// spa_required_for_all — не транспорт, а настройка SPA (NSP spec §6):
// true = SPA-подпись требуется для ВСЕХ ключей, не только kill_all.
var syncTransportKeys = map[string]bool{
	"ws":                   true,
	"wstunnel":             true,
	"sse":                  true,
	"nsp":                  true,
	"kill_all":             true,
	"spa_required_for_all": true,
}

// Дефолты при отсутствии записи/ошибке БД: транспорты включены,
// kill switch выключен, SPA-for-all выключен.
func syncTransportDefault(key string) bool {
	return key != "kill_all" && key != "spa_required_for_all"
}

// --- Кэш: sync.Map + TTL 5s. Горячий путь не ходит в БД; инвалидация при PUT.

const syncTransportCacheTTL = 5 * time.Second

type syncTransportCacheEntry struct {
	value    bool
	loadedAt time.Time
}

var syncTransportCache sync.Map // key -> syncTransportCacheEntry

// IsTransportEnabled возвращает состояние рубильника.
// Семантика: для ws/wstunnel/sse/nsp true = транспорт работает;
// для kill_all true = kill switch активен (всё realtime глушится).
func IsTransportEnabled(key string) bool {
	if v, ok := syncTransportCache.Load(key); ok {
		if e, ok := v.(syncTransportCacheEntry); ok && time.Since(e.loadedAt) < syncTransportCacheTTL {
			return e.value
		}
	}
	var s SyncTransportSetting
	if err := db.Where("key = ?", key).First(&s).Error; err != nil {
		// БД недоступна/записи нет — stale-значение или дефолт
		if v, ok := syncTransportCache.Load(key); ok {
			if e, ok := v.(syncTransportCacheEntry); ok {
				return e.value
			}
		}
		return syncTransportDefault(key)
	}
	syncTransportCache.Store(key, syncTransportCacheEntry{value: s.Enabled, loadedAt: time.Now()})
	return s.Enabled
}

// seedSyncTransports — upsert дефолтных ключей при старте (не затирает существующие).
func seedSyncTransports() {
	seeds := []SyncTransportSetting{
		{Key: "ws", Enabled: true},
		{Key: "wstunnel", Enabled: true},
		{Key: "sse", Enabled: true},
		{Key: "nsp", Enabled: true},
		{Key: "kill_all", Enabled: false},
		{Key: "spa_required_for_all", Enabled: false}, // NSP spec §6: SPA по дефолту только для kill_all
	}
	for i := range seeds {
		seeds[i].UpdatedAt = time.Now()
		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&seeds[i]).Error; err != nil {
			log.Printf("sync-transports seed %s: %v", seeds[i].Key, err)
		}
	}
}

// --- Счётчики активных соединений по транспортам (для админки).
// -1 = точный счёт недоступен/неприменим.

func countCollabWSConnections() int {
	total := 0
	SessionMu.RLock()
	sessions := make([]*CollaborativeSession, 0, len(Sessions))
	for _, s := range Sessions {
		sessions = append(sessions, s)
	}
	SessionMu.RUnlock()
	for _, s := range sessions {
		s.Mutex.RLock()
		total += len(s.Connections)
		s.Mutex.RUnlock()
	}
	return total
}

func countMessengerWSConnections() int {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	return len(hub.clients)
}

func countSSEConnections() int {
	sseHub.mu.RLock()
	total := len(sseHub.clients)
	sseHub.mu.RUnlock()
	collabSSEHub.mu.RLock()
	for _, subs := range collabSSEHub.subs {
		total += len(subs)
	}
	collabSSEHub.mu.RUnlock()
	return total
}

func syncTransportConnectionCounts() map[string]int {
	return map[string]int{
		// ws: мессенджер /ws + collab WS (wstunnel делит hub с /ws, разделить нельзя)
		"ws":                   countMessengerWSConnections() + countCollabWSConnections(),
		"wstunnel":             -1, // соединения /wstunnel неотличимы от /ws в общем hub
		"sse":                  countSSEConnections(),
		"nsp":                  countNSPConnections(),
		"kill_all":             -1,
		"spa_required_for_all": -1,
	}
}

// --- Enforcement helpers (матрица из NSP spec §8)

// enforceSyncTransportHTTP — для SSE/REST: 503 {"error":...} при выключенном
// транспорте или активном kill switch. Возвращает false, если запрос отклонён.
func enforceSyncTransportHTTP(c *gin.Context, transportKey string) bool {
	if IsTransportEnabled("kill_all") {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "kill switch active"})
		return false
	}
	if !IsTransportEnabled(transportKey) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "transport disabled"})
		return false
	}
	return true
}

// enforceCollabWSTransport — для уже поднятого collab WS: close 4600 (kill switch)
// или 4503 (транспорт выкл). Вызывать ПОСЛЕ auth. false = соединение закрыто.
func enforceCollabWSTransport(ws *websocket.Conn, transportKey string) bool {
	if IsTransportEnabled("kill_all") {
		ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(4600, "kill switch active"))
		return false
	}
	if !IsTransportEnabled(transportKey) {
		ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(4503, "transport disabled"))
		return false
	}
	return true
}

// rejectMessengerWS — для messenger /ws и /wstunnel: upgrade + close с кодом,
// чтобы клиент получил осмысленный close code (4503/4600), а не HTTP-ошибку.
func rejectMessengerWS(c *gin.Context, code int, reason string) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason))
}

// enforceMessengerWSTransport — после успешной auth, до регистрации в hub.
// false = соединение отклонено (ответ уже отправлен).
func enforceMessengerWSTransport(c *gin.Context, transportKey string) bool {
	if IsTransportEnabled("kill_all") {
		rejectMessengerWS(c, 4600, "kill switch active")
		return false
	}
	if !IsTransportEnabled(transportKey) {
		rejectMessengerWS(c, 4503, "transport disabled")
		return false
	}
	return true
}

// --- Force-close активных соединений (рубильник гасит мгновенно, NSP spec §8).
// Паттерн: собираем цели под локом, закрываем вне лока (избегаем deadlock).
// Close-фрейм шлём через WriteControl — единственный метод gorilla/websocket,
// безопасный для конкурентного вызова параллельно с write-pump'ами.

// forceCloseCollabWS закрывает все активные collab WS-соединения с кодом/reason.
func forceCloseCollabWS(code int, reason string) int {
	type target struct {
		s      *CollaborativeSession
		connID string
		ws     *websocket.Conn
	}
	var targets []target

	SessionMu.RLock()
	sessions := make([]*CollaborativeSession, 0, len(Sessions))
	for _, s := range Sessions {
		sessions = append(sessions, s)
	}
	SessionMu.RUnlock()

	for _, s := range sessions {
		s.Mutex.RLock()
		for connID, conn := range s.Connections {
			if conn.WS != nil {
				targets = append(targets, target{s, connID, conn.WS})
			}
		}
		s.Mutex.RUnlock()
	}

	for _, t := range targets {
		// Close-фрейм (клиент получит код), затем TCP-close → read-loop обрывается
		t.ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(5*time.Second))
		t.ws.Close()
		// RemoveUser закрывает conn.Chan → write-pump выходит; повторный defer RemoveUser в handler — no-op
		t.s.RemoveUser(t.connID)
	}
	return len(targets)
}

// forceCloseMessengerWS закрывает все клиентские соединения messenger hub
// (/ws и /wstunnel в общем hub неразличимы — закрываются вместе).
func forceCloseMessengerWS(code int, reason string) int {
	hub.mu.RLock()
	clients := make([]*WSClient, 0, len(hub.clients))
	for c := range hub.clients {
		clients = append(clients, c)
	}
	hub.mu.RUnlock()

	for _, c := range clients {
		c.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(5*time.Second))
		c.Conn.Close()
	}
	return len(clients)
}

// forceCloseSSE обрывает все SSE-стримы (мессенджер /api/sse/events + collab /api/sse/collab/*)
// через Done-каналы; хендлеры выходят по select и соединение закрывается.
func forceCloseSSE() int {
	n := 0
	sseHub.mu.RLock()
	clients := make([]*SSEClient, 0, len(sseHub.clients))
	for c := range sseHub.clients {
		clients = append(clients, c)
	}
	sseHub.mu.RUnlock()
	for _, c := range clients {
		c.terminate()
		n++
	}

	collabSSEHub.mu.RLock()
	var subs []*collabSSESubscriber
	for _, byID := range collabSSEHub.subs {
		for _, sub := range byID {
			subs = append(subs, sub)
		}
	}
	collabSSEHub.mu.RUnlock()
	for _, sub := range subs {
		sub.terminate()
		n++
	}
	return n
}

// forceCloseForSwitch вызывается из PUT-хендлера после обновления настройки.
// enabled=false для транспорта → глушим его активные соединения;
// kill_all=true → глушим всё. enabled=true / kill_all=false → ничего не закрываем.
func forceCloseForSwitch(key string, enabled bool) {
	if key == "kill_all" {
		if !enabled {
			return
		}
		n := forceCloseCollabWS(4600, "kill switch active")
		n += forceCloseMessengerWS(4600, "kill switch active")
		n += forceCloseSSE()
		n += forceCloseNSP()
		log.Printf("sync-transports: kill_all on — force-closed %d active connections", n)
		return
	}
	if enabled {
		return
	}
	switch key {
	case "ws":
		n := forceCloseCollabWS(4503, "transport disabled")
		n += forceCloseMessengerWS(4503, "transport disabled")
		log.Printf("sync-transports: ws off — force-closed %d active connections", n)
	case "sse":
		n := forceCloseSSE()
		log.Printf("sync-transports: sse off — force-closed %d active connections", n)
	case "wstunnel":
		// Активные /wstunnel неотличимы от /ws в общем messenger hub —
		// активные не закрываем, действует только на новые подключения.
		log.Printf("sync-transports: wstunnel off — active connections left open (shared hub with /ws)")
	case "nsp":
		n := forceCloseNSP()
		log.Printf("sync-transports: nsp off — force-closed %d active connections", n)
	}
}

// --- Handlers (за authMiddleware + superAdminMiddleware)

// GET /api/super-admin/sync-transports → [{key, enabled, updated_by, updated_at, active_connections}]
func getSyncTransportsHandler(c *gin.Context) {
	var settings []SyncTransportSetting
	if err := db.Order("key").Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sync transport settings"})
		return
	}
	counts := syncTransportConnectionCounts()
	out := make([]gin.H, 0, len(settings))
	for _, s := range settings {
		out = append(out, gin.H{
			"key":                s.Key,
			"enabled":            s.Enabled,
			"updated_by":         s.UpdatedBy,
			"updated_at":         s.UpdatedAt,
			"active_connections": counts[s.Key],
		})
	}
	c.JSON(http.StatusOK, out)
}

// PUT /api/super-admin/sync-transports {key, enabled} → обновление + аудит
func putSyncTransportHandler(c *gin.Context) {
	var req struct {
		Key     string `json:"key"`
		Enabled *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Enabled == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "key and enabled are required"})
		return
	}
	if !syncTransportKeys[req.Key] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown transport key"})
		return
	}

	changedBy, _ := getUserIDFromContext(c)

	// SPA-подпись (NSP spec §6): kill_all в обе стороны (+ все ключи при
	// spa_required_for_all=true) требуют Ed25519-подписи, если у админа
	// есть зарегистрированный ключ. Без ключа — JWT достаточно (backward compat).
	spaKeyID := ""
	if spaRequired(changedBy, req.Key) {
		code, kid := verifySPA(c, changedBy, req.Key, *req.Enabled)
		if code != "" {
			c.JSON(http.StatusForbidden, gin.H{"error": code})
			return
		}
		spaKeyID = kid
	}

	var s SyncTransportSetting
	if err := db.Where("key = ?", req.Key).First(&s).Error; err != nil {
		// Записи нет (не засидена) — создаём с дефолтом, затем применяем
		s = SyncTransportSetting{Key: req.Key, Enabled: syncTransportDefault(req.Key)}
	}
	oldValue := s.Enabled
	s.Enabled = *req.Enabled
	s.UpdatedBy = changedBy
	s.UpdatedAt = time.Now()
	if err := db.Save(&s).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update setting"})
		return
	}

	audit := SyncTransportAudit{
		Key:       req.Key,
		OldValue:  oldValue,
		NewValue:  *req.Enabled,
		ChangedBy: changedBy,
		ChangedAt: time.Now(),
		SpaKeyID:  spaKeyID,
	}
	if err := db.Create(&audit).Error; err != nil {
		log.Printf("sync-transports audit write failed: %v", err)
	}

	// Инвалидация кэша: сразу кладём новое значение
	syncTransportCache.Store(req.Key, syncTransportCacheEntry{value: s.Enabled, loadedAt: time.Now()})

	// Мгновенное глушение: принудительно закрываем активные соединения
	forceCloseForSwitch(req.Key, *req.Enabled)

	log.Printf("sync-transports: %s %v -> %v by user %d", req.Key, oldValue, s.Enabled, changedBy)
	c.JSON(http.StatusOK, gin.H{
		"key":        s.Key,
		"enabled":    s.Enabled,
		"updated_by": s.UpdatedBy,
		"updated_at": s.UpdatedAt,
	})
}
