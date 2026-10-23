/**
 * SPA-ключи админки (NSP spec v2.1 §6): Ed25519 пара генерируется через
 * WebCrypto, ПРИВАТНЫЙ ключ хранится только в IndexedDB браузера и никогда
 * не уходит на сервер; на сервер отправляется только pubkey.
 *
 * Подпись запроса рубильника: Ed25519_sign("nsp-spa"||key||value||nonce||window),
 * window = unix/60; nonce одноразовый (uuid hex). Заголовки:
 * X-SPA-Key-Id / X-SPA-Nonce / X-SPA-Timestamp / X-SPA-Signature.
 */

const DB_NAME = 'nsp_admin_spa'
const STORE = 'keys'
const RECORD_ID = 'current'

export interface StoredSPAKey {
  keyId: string
  pkcs8: string // base64 приватного ключа (PKCS#8)
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Текущий локальный SPA-ключ (если регистрировался в этом браузере). */
export async function getSPAKey(): Promise<StoredSPAKey | null> {
  try {
    const db = await openDb()
    return await idbGet<StoredSPAKey>(db, RECORD_ID)
  } catch {
    return null
  }
}

export async function saveSPAKey(key: StoredSPAKey): Promise<void> {
  const db = await openDb()
  await idbPut(db, RECORD_ID, key)
}

export async function deleteSPAKey(): Promise<void> {
  try {
    const db = await openDb()
    await idbDelete(db, RECORD_ID)
  } catch {
    // ignore
  }
}

/** Генерация Ed25519 пары. Поддержка: современные Chrome/FF/Safari (WebCrypto). */
export async function generateSPAKeyPair(): Promise<{ pubkeyB64: string; pkcs8B64: string }> {
  if (!crypto?.subtle) throw new Error('WebCrypto unavailable')
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pub = await crypto.subtle.exportKey('raw', kp.publicKey)
  const sk = await crypto.subtle.exportKey('pkcs8', kp.privateKey)
  return { pubkeyB64: b64encode(pub), pkcs8B64: b64encode(sk) }
}

/**
 * Подписать действие рубильника локальным ключом.
 * Возвращает заголовки для PUT /api/super-admin/sync-transports
 * или null, если локального ключа нет.
 */
export async function signSPARequest(key: string, enabled: boolean): Promise<Record<string, string> | null> {
  const stored = await getSPAKey()
  if (!stored) return null
  const sk = await crypto.subtle.importKey(
    'pkcs8',
    b64decode(stored.pkcs8) as unknown as BufferSource,
    { name: 'Ed25519' },
    false,
    ['sign'],
  )
  const ts = Math.floor(Date.now() / 1000)
  const window_ = Math.floor(ts / 60)
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const msg = new TextEncoder().encode(`nsp-spa${key}${enabled ? 'true' : 'false'}${nonce}${window_}`)
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, sk, msg)
  return {
    'X-SPA-Key-Id': stored.keyId,
    'X-SPA-Nonce': nonce,
    'X-SPA-Timestamp': String(ts),
    'X-SPA-Signature': b64encode(sig),
  }
}
