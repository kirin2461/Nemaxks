// CRDT-клиент (Phase E): LWW-Element-Map.
// Модель (общая с backend): Tool.Content — JSON
//   {"elements": {"<element_id>": {"value": <any>, "lamport": <int>, "user_id": <int>, "deleted": <bool>}}}
// Операция: {op_id, element_id, action: "set"|"delete", value?, lamport, user_id}.
// Merge-правило: побеждает операция с большим lamport; при равенстве — больший user_id.
// delete → deleted=true (tombstone, элемент физически не удаляется).
// Локальный clock = max(все известные lamport) + 1.

export interface CRDTElement {
  value: any
  lamport: number
  user_id: number
  deleted: boolean
}

export interface CRDTOp {
  op_id: string
  element_id: string
  action: 'set' | 'delete'
  value?: any
  lamport: number
  user_id: number
}

export type CRDTState = Record<string, CRDTElement>

/** Парсит Tool.Content (JSON string) в карту элементов. Битый/пустой контент → {}. */
export function parseContent(content: string | null | undefined): CRDTState {
  if (!content) return {}
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && parsed.elements && typeof parsed.elements === 'object') {
      return parsed.elements as CRDTState
    }
    return {}
  } catch {
    return {}
  }
}

/** Сериализует карту элементов в формат Tool.Content. */
export function serializeContent(elements: CRDTState): string {
  return JSON.stringify({ elements })
}

/** Применить одну операцию по merge-правилу LWW. Возвращает true, если операция применена. */
export function mergeOp(elements: CRDTState, op: CRDTOp): boolean {
  const existing = elements[op.element_id]
  if (existing) {
    if (op.lamport < existing.lamport) return false
    if (op.lamport === existing.lamport && op.user_id <= existing.user_id) return false
  }
  elements[op.element_id] = {
    value: op.action === 'delete' ? (existing ? existing.value : null) : op.value,
    lamport: op.lamport,
    user_id: op.user_id,
    deleted: op.action === 'delete',
  }
  return true
}

/** Слить полное состояние (elements map) в текущее. Возвращает число применённых элементов. */
export function mergeState(target: CRDTState, incoming: CRDTState): number {
  let applied = 0
  for (const [elementId, el] of Object.entries(incoming || {})) {
    if (!el || typeof el !== 'object') continue
    const op: CRDTOp = {
      op_id: `state_${elementId}`,
      element_id: elementId,
      action: el.deleted ? 'delete' : 'set',
      value: el.value,
      lamport: el.lamport || 0,
      user_id: el.user_id || 0,
    }
    if (mergeOp(target, op)) applied++
  }
  return applied
}

/** Максимальный известный lamport в состоянии. */
export function maxLamport(elements: CRDTState): number {
  let max = 0
  for (const el of Object.values(elements)) {
    if (el && typeof el.lamport === 'number' && el.lamport > max) max = el.lamport
  }
  return max
}

let opCounter = 0

/** Генерация уникального op_id. */
export function generateOpId(userId: number): string {
  opCounter = (opCounter + 1) % 1_000_000
  return `${userId}_${Date.now()}_${opCounter}_${Math.random().toString(36).slice(2, 8)}`
}

/** Генерация уникального element_id. */
export function generateElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * LWW-Element-Map клиент: локальный стейт + lamport clock.
 */
export class LWWElementMap {
  private elements: CRDTState
  private clock: number
  readonly userId: number

  constructor(userId: number, contentJSON?: string | null) {
    this.userId = userId
    this.elements = parseContent(contentJSON)
    this.clock = maxLamport(this.elements)
  }

  /** Применить удалённую (или свою подтверждённую) операцию. Обновляет clock = max+... */
  applyOp(op: CRDTOp): boolean {
    const applied = mergeOp(this.elements, op)
    if (op.lamport > this.clock) this.clock = op.lamport
    return applied
  }

  /** Применить полное состояние (например, из ответа /collab/sync или sync_state). */
  applyState(state: CRDTState): number {
    const applied = mergeState(this.elements, state)
    this.clock = Math.max(this.clock, maxLamport(this.elements))
    return applied
  }

  /** Локальная операция set: создаёт op с новым lamport и сразу применяет. */
  localSet(elementId: string, value: any): CRDTOp {
    const op: CRDTOp = {
      op_id: generateOpId(this.userId),
      element_id: elementId,
      action: 'set',
      value,
      lamport: ++this.clock,
      user_id: this.userId,
    }
    mergeOp(this.elements, op)
    return op
  }

  /** Локальная операция delete (tombstone). */
  localDelete(elementId: string): CRDTOp {
    const op: CRDTOp = {
      op_id: generateOpId(this.userId),
      element_id: elementId,
      action: 'delete',
      lamport: ++this.clock,
      user_id: this.userId,
    }
    mergeOp(this.elements, op)
    return op
  }

  /** Видимые (не удалённые) элементы: element_id → value. */
  visibleElements(): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [id, el] of Object.entries(this.elements)) {
      if (!el.deleted) result[id] = el.value
    }
    return result
  }

  getElement(elementId: string): CRDTElement | undefined {
    return this.elements[elementId]
  }

  getState(): CRDTState {
    return { ...this.elements }
  }

  getClock(): number {
    return this.clock
  }

  toJSON(): string {
    return serializeContent(this.elements)
  }
}

// --- Offline-очередь в localStorage (`collab_queue_<tool_id>`) ---

function queueKey(toolId: string | number): string {
  return `collab_queue_${toolId}`
}

export function loadQueue(toolId: string | number): CRDTOp[] {
  try {
    const raw = localStorage.getItem(queueKey(toolId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveQueue(toolId: string | number, ops: CRDTOp[]): void {
  try {
    if (ops.length === 0) {
      localStorage.removeItem(queueKey(toolId))
    } else {
      localStorage.setItem(queueKey(toolId), JSON.stringify(ops))
    }
  } catch {
    // localStorage переполнен/недоступен — игнорируем
  }
}

export function enqueueOp(toolId: string | number, op: CRDTOp): CRDTOp[] {
  const queue = loadQueue(toolId)
  queue.push(op)
  saveQueue(toolId, queue)
  return queue
}

/** Удалить подтверждённые (acked) op_id из очереди. Возвращает оставшиеся ops. */
export function removeAcked(toolId: string | number, ackedIds: string[]): CRDTOp[] {
  const acked = new Set(ackedIds)
  const remaining = loadQueue(toolId).filter((op) => !acked.has(op.op_id))
  saveQueue(toolId, remaining)
  return remaining
}
