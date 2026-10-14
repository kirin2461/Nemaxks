import { describe, it, expect, beforeEach } from 'vitest'
import {
  LWWElementMap,
  mergeOp,
  mergeState,
  parseContent,
  serializeContent,
  loadQueue,
  saveQueue,
  enqueueOp,
  removeAcked,
  type CRDTState,
} from './crdt'

describe('parseContent', () => {
  it('возвращает {} для пустого/битого контента', () => {
    expect(parseContent('')).toEqual({})
    expect(parseContent(null)).toEqual({})
    expect(parseContent('broken{')).toEqual({})
    expect(parseContent('{"other":1}')).toEqual({})
  })

  it('парсит валидный elements map', () => {
    const state = parseContent('{"elements":{"a":{"value":1,"lamport":2,"user_id":3,"deleted":false}}}')
    expect(state.a).toEqual({ value: 1, lamport: 2, user_id: 3, deleted: false })
  })
})

describe('mergeOp (LWW-правило)', () => {
  it('побеждает больший lamport', () => {
    const el: CRDTState = {}
    expect(mergeOp(el, { op_id: '1', element_id: 'a', action: 'set', value: 'x', lamport: 1, user_id: 1 })).toBe(true)
    expect(mergeOp(el, { op_id: '2', element_id: 'a', action: 'set', value: 'y', lamport: 2, user_id: 1 })).toBe(true)
    expect(mergeOp(el, { op_id: '3', element_id: 'a', action: 'set', value: 'z', lamport: 1, user_id: 9 })).toBe(false)
    expect(el.a.value).toBe('y')
  })

  it('при равном lamport побеждает больший user_id', () => {
    const el: CRDTState = {}
    mergeOp(el, { op_id: '1', element_id: 'a', action: 'set', value: 'x', lamport: 1, user_id: 2 })
    expect(mergeOp(el, { op_id: '2', element_id: 'a', action: 'set', value: 'y', lamport: 1, user_id: 1 })).toBe(false)
    expect(mergeOp(el, { op_id: '3', element_id: 'a', action: 'set', value: 'z', lamport: 1, user_id: 3 })).toBe(true)
    expect(el.a.value).toBe('z')
  })

  it('delete ставит tombstone, элемент не удаляется физически', () => {
    const el: CRDTState = {}
    mergeOp(el, { op_id: '1', element_id: 'a', action: 'set', value: 'x', lamport: 1, user_id: 1 })
    mergeOp(el, { op_id: '2', element_id: 'a', action: 'delete', lamport: 2, user_id: 1 })
    expect(el.a).toBeDefined()
    expect(el.a.deleted).toBe(true)
  })
})

describe('LWWElementMap', () => {
  it('локальный clock = max(все известные) + 1', () => {
    const map = new LWWElementMap(1, '{"elements":{"a":{"value":1,"lamport":41,"user_id":2,"deleted":false}}}')
    const op = map.localSet('b', 2)
    expect(op.lamport).toBe(42)
  })

  it('удалённая операция двигает clock', () => {
    const map = new LWWElementMap(1)
    map.applyOp({ op_id: 'r', element_id: 'a', action: 'set', value: 1, lamport: 100, user_id: 5 })
    expect(map.localDelete('a').lamport).toBe(101)
  })

  it('visibleElements скрывает tombstones', () => {
    const map = new LWWElementMap(1)
    map.localSet('a', { text: 'hi' })
    map.localSet('b', { text: 'bye' })
    map.localDelete('a')
    expect(Object.keys(map.visibleElements())).toEqual(['b'])
  })

  it('applyState мержит полное состояние', () => {
    const map = new LWWElementMap(1)
    map.localSet('a', 'old')
    const applied = map.applyState({
      a: { value: 'new', lamport: 999, user_id: 2, deleted: false },
      b: { value: 'fresh', lamport: 5, user_id: 2, deleted: false },
    })
    expect(applied).toBe(2)
    expect(map.visibleElements().a).toBe('new')
  })

  it('serializeContent/parseContent round-trip', () => {
    const map = new LWWElementMap(1)
    map.localSet('a', { text: 'x', x: 1, y: 2 })
    const restored = new LWWElementMap(1, serializeContent(map.getState()))
    expect(restored.visibleElements()).toEqual(map.visibleElements())
  })
})

describe('offline queue (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('enqueue/load/removeAcked', () => {
    expect(loadQueue('t1')).toEqual([])
    enqueueOp('t1', { op_id: 'o1', element_id: 'a', action: 'set', value: 1, lamport: 1, user_id: 1 })
    enqueueOp('t1', { op_id: 'o2', element_id: 'b', action: 'set', value: 2, lamport: 2, user_id: 1 })
    expect(loadQueue('t1').map((o) => o.op_id)).toEqual(['o1', 'o2'])
    const remaining = removeAcked('t1', ['o1'])
    expect(remaining.map((o) => o.op_id)).toEqual(['o2'])
    expect(loadQueue('t1')).toHaveLength(1)
    saveQueue('t1', [])
    expect(localStorage.getItem('collab_queue_t1')).toBeNull()
  })
})
