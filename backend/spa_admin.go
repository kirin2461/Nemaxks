package main

// SPA (Signed Admin Actions) — Ed25519-подпись админ-действий рубильника
// (NSP spec v2.1 §6, в v2 — §8.4). Защита от угона JWT суперадмина:
// kill_all (в обе стороны — иначе угонщик сам выключит защиту) и,
// при spa_required_for_all=true, все ключи рубильника требуют подписи
// приватным ключом, который не покидает IndexedDB админки.
//
// Подпись: Ed25519_verify(pubkey, "nsp-spa"||key||value_str||nonce||window),
// window = timestamp/60; принимаются window, window±1 (±60s clock skew).
// nonce одноразовый (admin_spa_nonces, TTL 5 мин, lazy GC при проверке).
// key_id = hex(BLAKE2b-64(pubkey)) — 16 hex-символов, вычисляет сервер.
//
// Аварийный путь (backward compat): если у суперадмина НЕТ ни одного
// неотозванного SPA-ключа — подпись не требуется. После регистрации
// первого ключа kill_all требует подписи в обе стороны.

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/blake2b"
)

const spaNonceTTL = 5 * time.Minute // TTL одноразового nonce (спека §6)

// AdminSPAKey — Ed25519 pubkey суперадмина (admin_spa_keys).
type AdminSPAKey struct {
	KeyID     string    `gorm:"primaryKey;column:key_id" json:"key_id"` // hex(BLAKE2b-64(pubkey))
	Pubkey    string    `gorm:"column:pubkey" json:"pubkey"`            // base64, 32 байта Ed25519
	CreatedBy uint      `gorm:"column:created_by;index" json:"created_by"`
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
	Revoked   bool      `gorm:"column:revoked" json:"revoked"`
}

func (AdminSPAKey) TableName() string { return "admin_spa_keys" }

// AdminSPANonce — одноразовый nonce SPA-подписи (admin_spa_nonces).
type AdminSPANonce struct {
	Nonce     string    `gorm:"primaryKey;column:nonce"`
	ExpiresAt time.Time `gorm:"column:expires_at;index"`
}

func (AdminSPANonce) TableName() string { return "admin_spa_nonces" }

// spaKeyID — key_id = hex(BLAKE2b-64(pubkey)) (спека §6).
func spaKeyID(pub []byte) string {
	h, err := blake2b.New(8, nil) // BLAKE2b-64
	if err != nil {
		return ""
	}
	h.Write(pub)
	return hex.EncodeToString(h.Sum(nil))
}

// spaUserHasActiveKey — есть ли у юзера хоть один неотозванный ключ.
func spaUserHasActiveKey(userID uint) bool {
	var n int64
	if err := db.Model(&AdminSPAKey{}).Where("created_by = ? AND revoked = false", userID).Count(&n).Error; err != nil {
		log.Printf("[SPA] count keys for user %d: %v", userID, err)
		return false
	}
	return n > 0
}

// spaRequired — нужна ли SPA-подпись для данного действия данного юзера.
// kill_all (в обе стороны) — всегда, если у юзера есть ключ; остальные
// ключи — при включённой настройке spa_required_for_all. Без ключа у
// юзера — не требуем (backward compat до первой регистрации, спека §6).
func spaRequired(userID uint, key string) bool {
	if key != "kill_all" && !IsTransportEnabled("spa_required_for_all") {
		return false
	}
	return spaUserHasActiveKey(userID)
}

// verifySPA проверяет SPA-подпись запроса. Возвращает ("" , keyID) при успехе
// или (errCode, ""): spa_required | spa_expired | spa_invalid | replay.
func verifySPA(c *gin.Context, userID uint, key string, value bool) (string, string) {
	keyID := c.GetHeader("X-SPA-Key-Id")
	nonce := c.GetHeader("X-SPA-Nonce")
	tsStr := c.GetHeader("X-SPA-Timestamp")
	sigB64 := c.GetHeader("X-SPA-Signature")
	if keyID == "" || nonce == "" || tsStr == "" || sigB64 == "" {
		return "spa_required", ""
	}

	// Ключ должен принадлежать юзеру и быть неотозванным
	var k AdminSPAKey
	if err := db.Where("key_id = ? AND created_by = ? AND revoked = false", keyID, userID).First(&k).Error; err != nil {
		return "spa_invalid", ""
	}
	pub, err := base64.StdEncoding.DecodeString(k.Pubkey)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return "spa_invalid", ""
	}

	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil || ts <= 0 {
		return "spa_invalid", ""
	}
	// Окно ±60s: подпись со window клиента принимаем, пока серверное окно
	// ∈ {w-1, w, w+1} (спека §6 требует минимум window и window-1).
	w := ts / 60
	cur := time.Now().Unix() / 60
	if w < cur-1 || w > cur+1 {
		return "spa_expired", ""
	}

	valueStr := "false"
	if value {
		valueStr = "true"
	}
	msg := []byte("nsp-spa" + key + valueStr + nonce + strconv.FormatInt(w, 10))
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil || !ed25519.Verify(ed25519.PublicKey(pub), msg, sig) {
		return "spa_invalid", ""
	}

	// nonce одноразовый: lazy GC протухших + PK-конфликт = replay
	db.Where("expires_at < ?", time.Now()).Delete(&AdminSPANonce{})
	rec := AdminSPANonce{Nonce: nonce, ExpiresAt: time.Now().Add(spaNonceTTL)}
	if err := db.Create(&rec).Error; err != nil {
		return "replay", ""
	}
	return "", keyID
}

// --- Handlers (за authMiddleware + superAdminMiddleware) ---

// POST /api/super-admin/spa-keys {pubkey: base64} — регистрация ключа.
// key_id вычисляет сервер (клиент не может подменить привязку).
func registerSPAKeyHandler(c *gin.Context) {
	uid, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var req struct {
		Pubkey string `json:"pubkey"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Pubkey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pubkey is required"})
		return
	}
	pub, err := base64.StdEncoding.DecodeString(req.Pubkey)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pubkey must be base64-encoded 32-byte Ed25519 public key"})
		return
	}
	keyID := spaKeyID(pub)

	var existing AdminSPAKey
	if err := db.Where("key_id = ?", keyID).First(&existing).Error; err == nil {
		if existing.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "key belongs to another admin"})
			return
		}
		if existing.Revoked {
			existing.Revoked = false
			existing.CreatedAt = time.Now()
			if err := db.Save(&existing).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to restore key"})
				return
			}
		}
		c.JSON(http.StatusOK, existing)
		return
	}

	k := AdminSPAKey{KeyID: keyID, Pubkey: req.Pubkey, CreatedBy: uid, CreatedAt: time.Now()}
	if err := db.Create(&k).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register key"})
		return
	}
	log.Printf("[SPA] key %s registered by user %d (SPA enforcement теперь активен для него)", keyID, uid)
	c.JSON(http.StatusOK, k)
}

// GET /api/super-admin/spa-keys — список своих ключей.
func listSPAKeysHandler(c *gin.Context) {
	uid, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var keys []AdminSPAKey
	if err := db.Where("created_by = ?", uid).Order("created_at DESC").Find(&keys).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load keys"})
		return
	}
	c.JSON(http.StatusOK, keys)
}

// DELETE /api/super-admin/spa-keys/:key_id — revoke (только свои).
// Отзыв последнего ключа снимает SPA-требование (аварийный путь, спека §6).
func revokeSPAKeyHandler(c *gin.Context) {
	uid, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	keyID := c.Param("key_id")
	var k AdminSPAKey
	if err := db.Where("key_id = ? AND created_by = ?", keyID, uid).First(&k).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "key not found"})
		return
	}
	k.Revoked = true
	if err := db.Save(&k).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke key"})
		return
	}
	log.Printf("[SPA] key %s revoked by user %d", keyID, uid)
	c.JSON(http.StatusOK, gin.H{"key_id": keyID, "revoked": true})
}
