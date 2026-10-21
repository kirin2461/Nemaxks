import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { Layout } from '@/components/Layout'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useStore } from '@/lib/store'
import { collabAPI, toolsAPI, type ChannelTool, type CollabUser, type ToolSnapshotInfo } from '@/lib/api'
import {
  LWWElementMap,
  loadQueue,
  enqueueOp,
  removeAcked,
  generateElementId,
  type CRDTOp,
} from '@/lib/crdt'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  History,
  Users,
  WifiOff,
  Plus,
  Trash2,
  Edit3,
  X,
  Presentation,
  FileText,
  Save,
  RotateCcw,
  MousePointer2,
  Loader2,
  Check,
} from 'lucide-react'

type RemoteCursor = {
  user_id: number
  username: string
  x: number
  y: number
  color: string
  ts: number
}

type DragState = {
  id: string
  x: number
  y: number
  offsetX: number
  offsetY: number
}

const NOTE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa']

function cursorColor(userId: number): string {
  return `hsl(${(userId * 47) % 360}, 70%, 60%)`
}

function formatSnapshotDate(value: string): string {
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function changeTypeLabel(changeType: string): string {
  switch (changeType) {
    case 'sync':
      return 'Синхронизация'
    case 'pre_restore':
      return 'Перед восстановлением'
    case 'restore':
      return 'Восстановление'
    case 'manual':
      return 'Вручную'
    case 'element_added':
      return 'Добавление'
    case 'element_updated':
      return 'Изменение'
    case 'element_removed':
      return 'Удаление'
    default:
      return changeType || 'Изменение'
  }
}

export default function ToolEditorPage() {
  const params = useParams<{ tool_id: string }>()
  const toolId = params.tool_id || ''
  const { user } = useStore()
  const [, navigate] = useLocation()
  const userId = Number(user?.id) || 0
  const username = user?.username || 'Аноним'

  const [tool, setTool] = useState<ChannelTool | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<CollabUser[]>([])
  const [cursors, setCursors] = useState<Map<number, RemoteCursor>>(new Map())
  const [queueCount, setQueueCount] = useState(0)
  const [elementsVersion, setElementsVersion] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [snapshots, setSnapshots] = useState<ToolSnapshotInfo[]>([])
  const [snapshotsLoading, setSnapshotsLoading] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshotDescription, setSnapshotDescription] = useState('')
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<ToolSnapshotInfo | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // Board state
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteColor, setNewNoteColor] = useState(NOTE_COLORS[0])
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [dragState, setDragState] = useState<DragState | null>(null)

  // Notebook state
  const [newParagraph, setNewParagraph] = useState('')
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null)
  const [editingParagraphText, setEditingParagraphText] = useState('')

  const crdtRef = useRef<LWWElementMap | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const lastCursorSentRef = useRef(0)

  const bumpElements = useCallback(() => setElementsVersion((v) => v + 1), [])

  const syncQueueCount = useCallback(() => {
    setQueueCount(loadQueue(toolId).length)
  }, [toolId])

  // --- Загрузка инструмента ---
  useEffect(() => {
    unmountedRef.current = false
    if (!toolId) return
    setLoading(true)
    setLoadError(null)
    toolsAPI
      .get(toolId)
      .then((t) => {
        if (unmountedRef.current) return
        const normalized: ChannelTool = {
          ...t,
          id: Number((t as any).id),
          channel_id: Number((t as any).channel_id),
          owner_id: Number((t as any).owner_id),
        }
        setTool(normalized)
        crdtRef.current = new LWWElementMap(userId, normalized.content)
        bumpElements()
      })
      .catch((err) => {
        if (unmountedRef.current) return
        console.error('Failed to load tool:', err)
        setLoadError('Не удалось загрузить инструмент')
      })
      .finally(() => {
        if (!unmountedRef.current) setLoading(false)
      })
    syncQueueCount()
    return () => {
      unmountedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId])

  // --- Офлайн-очередь: отправка накопленных ops ---
  const flushQueue = useCallback(async () => {
    if (!toolId) return
    const ops = loadQueue(toolId)
    if (ops.length === 0) return
    try {
      const res = await collabAPI.sync(toolId, ops)
      if (unmountedRef.current) return
      if (Array.isArray(res?.acked) && res.acked.length > 0) {
        removeAcked(toolId, res.acked)
      } else {
        // acked нет в ответе — считаем все отправленные ops подтверждёнными
        removeAcked(toolId, ops.map((o) => o.op_id))
      }
      if (res?.state && crdtRef.current) {
        crdtRef.current.applyState(res.state)
        bumpElements()
      }
    } catch (err) {
      console.error('Failed to sync offline queue:', err)
    } finally {
      if (!unmountedRef.current) syncQueueCount()
    }
  }, [toolId, bumpElements, syncQueueCount])

  // --- Обработка входящих WS-сообщений ---
  const handleWsMessage = useCallback(
    (raw: any) => {
      const crdt = crdtRef.current
      if (!crdt) return
      if (!raw || typeof raw !== 'object') return

      if (raw.type === 'update') {
        let applied = false
        // Новый формат: ops: CRDTOp[]
        const ops: CRDTOp[] = Array.isArray(raw.ops)
          ? raw.ops
          : raw.op
            ? [raw.op]
            : []
        for (const op of ops) {
          if (!op || typeof op.element_id !== 'string') continue
          if (crdt.applyOp(op)) applied = true
        }
        // Legacy-формат: update: {element_id, data, type: element_added/...}
        const legacy = raw.update
        if (legacy && typeof legacy.element_id === 'string') {
          if (legacy.type === 'element_removed') {
            applied = crdt.applyOp({
              op_id: `legacy_${legacy.element_id}_${legacy.timestamp || Date.now()}`,
              element_id: legacy.element_id,
              action: 'delete',
              lamport: (legacy.timestamp || Date.now()) % 2147483647,
              user_id: Number(legacy.user_id) || 0,
            }) || applied
          } else {
            applied = crdt.applyOp({
              op_id: `legacy_${legacy.element_id}_${legacy.timestamp || Date.now()}`,
              element_id: legacy.element_id,
              action: 'set',
              value: legacy.data,
              lamport: (legacy.timestamp || Date.now()) % 2147483647,
              user_id: Number(legacy.user_id) || 0,
            }) || applied
          }
        }
        if (applied) bumpElements()
      }

      if (raw.type === 'sync_state') {
        let state = raw.state
        if (!state && typeof raw.content === 'string') {
          try {
            state = JSON.parse(raw.content)?.elements
          } catch {
            state = null
          }
        }
        if (state && typeof state === 'object') {
          if (state.elements && typeof state.elements === 'object') state = state.elements
          if (crdt.applyState(state) > 0) bumpElements()
        }
      }

      if (raw.type === 'cursor' && raw.cursor) {
        const c = raw.cursor
        const cUserId = Number(c.user_id) || 0
        if (cUserId && cUserId !== userId) {
          setCursors((prev) => {
            const next = new Map(prev)
            next.set(cUserId, {
              user_id: cUserId,
              username: c.username || 'Участник',
              x: Number(c.x) || 0,
              y: Number(c.y) || 0,
              color: c.color || cursorColor(cUserId),
              ts: Date.now(),
            })
            return next
          })
        }
      }
    },
    [userId, bumpElements],
  )

  // --- WebSocket подключение с reconnect ---
  const connectWs = useCallback(() => {
    if (!tool || !toolId) return
    const token = localStorage.getItem('token')
    if (!token) return
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/collab/${tool.channel_id}/${toolId}?token=${encodeURIComponent(token)}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (unmountedRef.current) return
        setConnected(true)
        flushQueue()
        collabAPI
          .users(tool.channel_id, toolId)
          .then(setOnlineUsers)
          .catch(() => {})
      }

      ws.onmessage = (event) => {
        try {
          handleWsMessage(JSON.parse(event.data))
        } catch {
          // игнорируем битые сообщения
        }
      }

      ws.onclose = () => {
        if (unmountedRef.current) return
        setConnected(false)
        wsRef.current = null
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) connectWs()
        }, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (err) {
      console.error('WebSocket connect failed:', err)
      setConnected(false)
    }
  }, [tool, toolId, flushQueue, handleWsMessage])

  useEffect(() => {
    if (!tool) return
    connectWs()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [tool, connectWs])

  // --- Список онлайн-пользователей: первичная загрузка + polling ---
  useEffect(() => {
    if (!tool) return
    const fetchUsers = () => {
      collabAPI
        .users(tool.channel_id, toolId)
        .then((users) => {
          if (!unmountedRef.current) setOnlineUsers(users)
        })
        .catch(() => {})
    }
    fetchUsers()
    // TODO: перейти на collab-WS presence
    const interval = setInterval(fetchUsers, 30000)
    return () => clearInterval(interval)
  }, [tool, toolId])

  // --- window 'online' + периодический retry очереди ---
  useEffect(() => {
    const handleOnline = () => {
      connectWs()
      flushQueue()
    }
    window.addEventListener('online', handleOnline)
    const retryInterval = setInterval(() => {
      if (loadQueue(toolId).length > 0) flushQueue()
    }, 15000)
    return () => {
      window.removeEventListener('online', handleOnline)
      clearInterval(retryInterval)
    }
  }, [toolId, connectWs, flushQueue])

  // --- Очистка устаревших курсоров ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => {
        let changed = false
        const next = new Map(prev)
        next.forEach((cursor, key) => {
          if (now - cursor.ts > 5000) {
            next.delete(key)
            changed = true
          }
        })
        return changed ? next : prev
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // --- Отправка операции: по WS или в офлайн-очередь ---
  const commitOp = useCallback(
    (op: CRDTOp) => {
      bumpElements()
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'update', tool_id: Number(toolId), ops: [op] }))
      } else {
        enqueueOp(toolId, op)
        syncQueueCount()
      }
    },
    [toolId, bumpElements, syncQueueCount],
  )

  // --- Видимые элементы ---
  const visible = useMemo(() => {
    void elementsVersion
    return crdtRef.current?.visibleElements() ?? {}
  }, [elementsVersion])

  const isBoard = tool?.tool_type === 'board'

  // --- Board: заметки ---
  const handleAddNote = () => {
    const crdt = crdtRef.current
    const text = newNoteText.trim()
    if (!crdt || !text) return
    const id = generateElementId()
    const op = crdt.localSet(id, {
      text,
      color: newNoteColor,
      x: 40 + Math.round(Math.random() * 300),
      y: 40 + Math.round(Math.random() * 200),
      created: Date.now(),
    })
    setNewNoteText('')
    commitOp(op)
  }

  const handleSaveNoteText = (noteId: string) => {
    const crdt = crdtRef.current
    if (!crdt) return
    const current = crdt.getElement(noteId)
    if (!current || current.deleted) return
    const text = editingNoteText.trim()
    setEditingNoteId(null)
    if (!text || text === current.value?.text) return
    const op = crdt.localSet(noteId, { ...current.value, text })
    commitOp(op)
  }

  const handleDeleteNote = (noteId: string) => {
    const crdt = crdtRef.current
    if (!crdt) return
    commitOp(crdt.localDelete(noteId))
  }

  const handleNotePointerDown = (e: React.PointerEvent, noteId: string, noteX: number, noteY: number) => {
    if (editingNoteId === noteId) return
    const board = boardRef.current
    if (!board) return
    const rect = board.getBoundingClientRect()
    setDragState({
      id: noteId,
      x: noteX,
      y: noteY,
      offsetX: e.clientX - rect.left - noteX,
      offsetY: e.clientY - rect.top - noteY,
    })
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    const board = boardRef.current
    if (!board) return
    const rect = board.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (dragState) {
      setDragState({
        ...dragState,
        x: Math.max(0, x - dragState.offsetX),
        y: Math.max(0, y - dragState.offsetY),
      })
    }

    // Курсор: throttle ~80ms
    const now = Date.now()
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN && now - lastCursorSentRef.current > 80) {
      lastCursorSentRef.current = now
      ws.send(
        JSON.stringify({
          type: 'cursor',
          tool_id: Number(toolId),
          cursor: { user_id: userId, username, x, y, color: cursorColor(userId) },
        }),
      )
    }
  }

  const handleBoardPointerUp = () => {
    if (!dragState) return
    const crdt = crdtRef.current
    if (crdt) {
      const current = crdt.getElement(dragState.id)
      if (current && !current.deleted) {
        const op = crdt.localSet(dragState.id, { ...current.value, x: Math.round(dragState.x), y: Math.round(dragState.y) })
        commitOp(op)
      }
    }
    setDragState(null)
  }

  // --- Notebook: абзацы ---
  const handleAddParagraph = () => {
    const crdt = crdtRef.current
    const text = newParagraph.trim()
    if (!crdt || !text) return
    const id = generateElementId()
    const op = crdt.localSet(id, { text, created: Date.now() })
    setNewParagraph('')
    commitOp(op)
  }

  const handleSaveParagraph = (paragraphId: string) => {
    const crdt = crdtRef.current
    if (!crdt) return
    const current = crdt.getElement(paragraphId)
    if (!current || current.deleted) return
    const text = editingParagraphText.trim()
    setEditingParagraphId(null)
    if (!text || text === current.value?.text) return
    const op = crdt.localSet(paragraphId, { ...current.value, text })
    commitOp(op)
  }

  const handleDeleteParagraph = (paragraphId: string) => {
    const crdt = crdtRef.current
    if (!crdt) return
    commitOp(crdt.localDelete(paragraphId))
  }

  // --- История версий ---
  const loadSnapshots = useCallback(() => {
    if (!toolId) return
    setSnapshotsLoading(true)
    collabAPI
      .listSnapshots(toolId)
      .then((list) => {
        if (!unmountedRef.current) setSnapshots(list)
      })
      .catch((err) => console.error('Failed to load snapshots:', err))
      .finally(() => {
        if (!unmountedRef.current) setSnapshotsLoading(false)
      })
  }, [toolId])

  const handleOpenHistory = () => {
    setShowHistory(true)
    loadSnapshots()
  }

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim() || savingSnapshot) return
    setSavingSnapshot(true)
    try {
      await collabAPI.createSnapshot(toolId, snapshotName.trim(), snapshotDescription.trim())
      setSnapshotName('')
      setSnapshotDescription('')
      loadSnapshots()
    } catch (err) {
      console.error('Failed to save snapshot:', err)
    } finally {
      setSavingSnapshot(false)
    }
  }

  const handleRestoreSnapshot = async () => {
    if (!restoreTarget || restoreLoading) return
    setRestoreLoading(true)
    try {
      await collabAPI.restoreSnapshot(toolId, restoreTarget.id)
      // После restore — заново загрузить инструмент и пересоздать CRDT-стейт
      const t = await toolsAPI.get(toolId)
      if (!unmountedRef.current) {
        setTool(t)
        crdtRef.current = new LWWElementMap(userId, t.content)
        bumpElements()
        setRestoreTarget(null)
        loadSnapshots()
      }
    } catch (err) {
      console.error('Failed to restore snapshot:', err)
    } finally {
      if (!unmountedRef.current) setRestoreLoading(false)
    }
  }

  // --- Рендер ---
  if (loading) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <div className="w-full max-w-md space-y-3 px-6">
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-64 rounded-xl" />
            <div className="skeleton h-10 rounded-lg" />
          </div>
        </div>
      </Layout>
    )
  }

  if (loadError || !tool) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center animate-rise-in">
            <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-secondary grid place-items-center">
              <Presentation className="w-10 h-10 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-display font-semibold text-graphite-900 mb-2">{loadError || 'Инструмент не найден'}</h2>
            <button
              onClick={() => navigate('/channels')}
              className="mt-4 h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              К каналам
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  const boardNotes = Object.entries(visible).sort(
    (a, b) => ((a[1] as any)?.created ?? 0) - ((b[1] as any)?.created ?? 0),
  )

  return (
    <Layout>
      <div className="h-full flex flex-col min-h-0">
        {/* Header — IDE toolbar */}
        <div className="h-12 px-3 md:px-4 border-b border-border bg-card flex items-center gap-2 md:gap-3 shrink-0">
          <button
            onClick={() => navigate('/channels')}
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
            title="Назад к каналам"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {isBoard ? (
            <Presentation className="w-5 h-5 text-emerald-700 hidden sm:block" />
          ) : (
            <FileText className="w-5 h-5 text-emerald-700 hidden sm:block" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate text-sm">{tool.title}</h2>
            <p className="text-[11px] text-muted-foreground">{isBoard ? 'Доска' : 'Блокнот'}</p>
          </div>
          <div className="flex items-center gap-1 md:gap-3">
            {/* Индикатор соединения */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary"
              title={connected ? 'Подключено' : 'Нет соединения'}
            >
              <span
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  connected ? 'bg-emerald-500' : 'bg-destructive',
                )}
              />
              <span className="text-xs text-muted-foreground hidden md:inline">
                {connected ? 'Онлайн' : 'Офлайн'}
              </span>
            </div>
            {/* Онлайн-пользователи */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary"
              title={onlineUsers.length > 0 ? `Онлайн: ${onlineUsers.map((u) => u.username).join(', ')}` : 'Никого нет онлайн'}
            >
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">{onlineUsers.length}</span>
            </div>
            {/* История версий */}
            <button
              onClick={handleOpenHistory}
              className={cn(
                'h-8 w-8 rounded-lg inline-flex items-center justify-center transition-colors duration-150',
                showHistory ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              title="История версий"
            >
              <History className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Офлайн-баннер */}
        {(!connected || queueCount > 0) && (
          <div className="px-4 py-2 bg-warning-soft border-b border-warning/30 flex items-center gap-2 text-sm text-[hsl(32_95%_30%)] shrink-0">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Офлайн · {queueCount} {pluralChanges(queueCount)} в очереди
            </span>
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {/* Контент */}
          <div className="flex-1 overflow-auto min-w-0">
            {isBoard ? (
              <div className="p-4 h-full flex flex-col">
                {/* Форма добавления заметки */}
                <div className="mb-4 p-3 rounded-xl bg-card border border-border flex flex-col sm:flex-row gap-2 shrink-0">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Текст заметки..."
                    className="flex-1 bg-background border border-input rounded-xl py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition-all duration-150"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {NOTE_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewNoteColor(color)}
                          className={cn(
                            'w-7 h-7 rounded-lg border-2 transition-all',
                            newNoteColor === color ? 'border-foreground scale-110' : 'border-transparent hover:border-foreground/40',
                          )}
                          style={{ backgroundColor: color }}
                          title="Цвет заметки"
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleAddNote}
                      disabled={!newNoteText.trim()}
                      className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить
                    </button>
                  </div>
                </div>

                {/* Доска */}
                <div
                  ref={boardRef}
                  onPointerMove={handleBoardPointerMove}
                  onPointerUp={handleBoardPointerUp}
                  onPointerLeave={handleBoardPointerUp}
                  className="relative flex-1 min-h-[60vh] rounded-xl bg-graphite-100 border border-border overflow-hidden touch-none"
                >
                  {boardNotes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-muted-foreground text-sm">Доска пуста — добавьте первую заметку</p>
                    </div>
                  )}

                  {boardNotes.map(([noteId, value]) => {
                    const note = (value || {}) as { text?: string; color?: string; x?: number; y?: number }
                    const isDragging = dragState !== null && dragState.id === noteId
                    const x = isDragging && dragState ? dragState.x : note.x ?? 0
                    const y = isDragging && dragState ? dragState.y : note.y ?? 0
                    const isEditing = editingNoteId === noteId
                    return (
                      <div
                        key={noteId}
                        className={cn(
                          'absolute w-48 rounded-xl shadow-lg select-none group',
                          isDragging ? 'z-30 shadow-2xl scale-105' : 'z-10 hover:shadow-xl',
                          'transition-shadow',
                        )}
                        style={{ left: x, top: y, backgroundColor: note.color || NOTE_COLORS[0] }}
                      >
                        <div
                          onPointerDown={(e) => handleNotePointerDown(e, noteId, note.x ?? 0, note.y ?? 0)}
                          className="flex items-center justify-end gap-0.5 px-1.5 py-1 cursor-grab active:cursor-grabbing"
                        >
                          {!isEditing && (
                            <>
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => {
                                  setEditingNoteId(noteId)
                                  setEditingNoteText(note.text || '')
                                }}
                                className="p-1 rounded hover:bg-black/10 text-gray-700 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                                title="Редактировать"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => handleDeleteNote(noteId)}
                                className="p-1 rounded hover:bg-black/10 text-gray-700 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        <div className="px-3 pb-3 -mt-1">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5">
                              <textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSaveNoteText(noteId)
                                  }
                                  if (e.key === 'Escape') setEditingNoteId(null)
                                }}
                                className="w-full bg-white/60 border border-black/10 rounded-lg p-1.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-1 focus:ring-black/30"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="p-1 rounded hover:bg-black/10 text-gray-700"
                                  title="Отмена"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleSaveNoteText(noteId)}
                                  className="p-1 rounded hover:bg-black/10 text-gray-700"
                                  title="Сохранить"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{note.text}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Удалённые курсоры */}
                  {Array.from(cursors.values()).map((cursor) => (
                    <div
                      key={cursor.user_id}
                      className="absolute pointer-events-none z-40 transition-all duration-100"
                      style={{ left: cursor.x, top: cursor.y }}
                    >
                      <MousePointer2 className="w-4 h-4" style={{ color: cursor.color }} />
                      <span
                        className="ml-4 -mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
                        style={{ backgroundColor: cursor.color }}
                      >
                        {cursor.username}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 max-w-3xl mx-auto w-full">
                {/* Блокнот */}
                <div className="space-y-2">
                  {boardNotes.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground text-sm">Блокнот пуст — добавьте первый абзац</p>
                    </div>
                  )}
                  {boardNotes.map(([paragraphId, value]) => {
                    const paragraph = (value || {}) as { text?: string }
                    const isEditing = editingParagraphId === paragraphId
                    return (
                      <div
                        key={paragraphId}
                        className="group rounded-xl bg-card border border-border px-4 py-3 hover:border-graphite-300 transition-colors duration-150"
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editingParagraphText}
                              onChange={(e) => setEditingParagraphText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  handleSaveParagraph(paragraphId)
                                }
                                if (e.key === 'Escape') setEditingParagraphId(null)
                              }}
                              className="w-full bg-background border border-input rounded-lg p-2 text-sm text-foreground resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setEditingParagraphId(null)}
                                className="px-2.5 py-1 rounded-lg bg-secondary text-xs hover:bg-graphite-200 transition-colors duration-150"
                              >
                                Отмена
                              </button>
                              <button
                                onClick={() => handleSaveParagraph(paragraphId)}
                                className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-emerald-800 active:scale-[0.97] transition-all duration-150"
                              >
                                Сохранить
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <p className="flex-1 text-sm whitespace-pre-wrap break-words min-w-0">{paragraph.text}</p>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => {
                                  setEditingParagraphId(paragraphId)
                                  setEditingParagraphText(paragraph.text || '')
                                }}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors duration-150"
                                title="Редактировать"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteParagraph(paragraphId)}
                                className="p-1.5 rounded-lg hover:bg-danger-soft text-muted-foreground hover:text-destructive transition-colors duration-150"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Добавление абзаца */}
                <div className="mt-4 relative">
                  <textarea
                    value={newParagraph}
                    onChange={(e) => setNewParagraph(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddParagraph()
                      }
                    }}
                    placeholder="Новый абзац... (Enter — добавить)"
                    className="w-full bg-card border border-input rounded-xl py-3 px-4 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition-all duration-150 resize-none"
                    rows={2}
                  />
                  <button
                    onClick={handleAddParagraph}
                    disabled={!newParagraph.trim()}
                    className="absolute right-2 bottom-3 p-2 rounded-lg bg-primary text-primary-foreground shadow-soft disabled:opacity-50 disabled:pointer-events-none hover:bg-emerald-800 active:scale-[0.97] transition-all duration-150"
                    title="Добавить абзац"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Панель истории версий */}
          {showHistory && (
            <>
              <div className="md:hidden fixed inset-0 bg-graphite-950/40 z-[55]" onClick={() => setShowHistory(false)} />
              <div className="fixed inset-y-0 right-0 w-80 md:static md:w-80 bg-card flex flex-col shrink-0 border-l border-border z-[60] md:z-auto animate-slide-in-right">
                <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                  <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4" />
                    История версий
                  </h3>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Сохранить версию */}
                <div className="p-3 border-b border-border space-y-2 shrink-0">
                  <input
                    type="text"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    placeholder="Название версии"
                    className="w-full bg-background border border-input rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition-all duration-150"
                  />
                  <textarea
                    value={snapshotDescription}
                    onChange={(e) => setSnapshotDescription(e.target.value)}
                    placeholder="Описание (необязательно)"
                    className="w-full bg-background border border-input rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition-all duration-150 resize-none"
                    rows={2}
                  />
                  <button
                    onClick={handleSaveSnapshot}
                    disabled={!snapshotName.trim() || savingSnapshot}
                    className="w-full h-10 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 flex items-center justify-center gap-2"
                  >
                    {savingSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Сохранить версию
                  </button>
                </div>

                {/* Список снапшотов */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                  {snapshotsLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Загрузка...</p>
                  ) : snapshots.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Пока нет сохранённых версий</p>
                  ) : (
                    snapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="rounded-xl bg-secondary border border-border p-3 hover:border-graphite-300 transition-colors duration-150"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{snapshot.name || 'Без названия'}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {changeTypeLabel(snapshot.change_type)}
                              {snapshot.username ? ` · ${snapshot.username}` : ''}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{formatSnapshotDate(snapshot.created_at)}</p>
                            {snapshot.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{snapshot.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setRestoreTarget(snapshot)}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors duration-150 shrink-0"
                            title="Восстановить"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreSnapshot}
        title="Восстановить версию"
        message={`Восстановить версию "${restoreTarget?.name || 'Без названия'}"? Текущее состояние будет заменено (перед этим автоматически сохранится копия).`}
        confirmText="Восстановить"
        variant="warning"
        loading={restoreLoading}
      />
    </Layout>
  )
}

function pluralChanges(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'изменение'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'изменения'
  return 'изменений'
}
