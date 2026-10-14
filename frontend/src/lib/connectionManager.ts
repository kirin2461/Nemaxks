export type ConnectionType = 'websocket' | 'wstunnel' | 'sse' | 'long_polling' | 'disconnected'

export interface ConnectionState {
  type: ConnectionType
  isConnected: boolean
  reconnectAttempts: number
  lastError: string | null
}

type MessageHandler = (data: any) => void
type StateChangeHandler = (state: ConnectionState) => void

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]
const WEBSOCKET_TIMEOUT = 5000
const WSTUNNEL_TIMEOUT = 8000
const SSE_TIMEOUT = 5000
const POLL_INTERVAL = 500

class ConnectionManager {
  private ws: WebSocket | null = null
  private sse: EventSource | null = null
  private pollTimeoutId: ReturnType<typeof setTimeout> | null = null
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private lastPollId: number = 0
  private token: string | null = null
  private baseUrl: string = ''
  private wsUrl: string = ''
  private wstunnelUrl: string = ''
  private messageHandlers: Set<MessageHandler> = new Set()
  private stateChangeHandlers: Set<StateChangeHandler> = new Set()
  private isConnecting: boolean = false
  private shouldReconnect: boolean = true
  private preferredTransport: ConnectionType | null = null
  // Поколение подключения: растёт при каждом connect()/disconnect().
  // Позволяет прервать in-flight цепочку connect после unmount/повторного mount,
  // чтобы устаревшие попытки не создавали новые сокеты и не затирали состояние.
  private connectEpoch: number = 0

  private state: ConnectionState = {
    type: 'disconnected',
    isConnected: false,
    reconnectAttempts: 0,
    lastError: null
  }

  constructor() {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      this.wsUrl = `${protocol}//${window.location.host}/ws`
      this.wstunnelUrl = `${protocol}//${window.location.host}/wstunnel`
      this.baseUrl = window.location.origin
    }
  }

  private setState(updates: Partial<ConnectionState>) {
    this.state = { ...this.state, ...updates }
    this.stateChangeHandlers.forEach(handler => handler(this.state))
  }

  getState(): ConnectionState {
    return { ...this.state }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStateChange(handler: StateChangeHandler): () => void {
    this.stateChangeHandlers.add(handler)
    return () => this.stateChangeHandlers.delete(handler)
  }

  private handleMessage(data: any) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(data)
      } catch (e) {
        console.error('[ConnectionManager] Message handler error:', e)
      }
    })
  }

  async connect(token: string): Promise<void> {
    if (this.isConnecting) return

    const epoch = ++this.connectEpoch
    const isStale = () => epoch !== this.connectEpoch || !this.shouldReconnect

    this.token = token
    this.shouldReconnect = true
    this.isConnecting = true
    this.setState({ reconnectAttempts: 0 })

    try {
      const success = await this.tryWebSocket()
      if (isStale()) return
      if (!success) {
        console.log('[ConnectionManager] WebSocket failed, trying wstunnel...')
        const wstunnelSuccess = await this.tryWSTunnel()
        if (isStale()) return
        if (!wstunnelSuccess) {
          console.log('[ConnectionManager] wstunnel failed, trying SSE...')
          const sseSuccess = await this.trySSE()
          if (isStale()) return
          if (!sseSuccess) {
            this.startLongPolling()
          }
        }
      }
    } finally {
      if (epoch === this.connectEpoch) {
        this.isConnecting = false
      }
    }
  }

  private async tryWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log('[ConnectionManager] Trying WebSocket...')
        const wsUrlWithToken = `${this.wsUrl}?token=${this.token}`
        const ws = new WebSocket(wsUrlWithToken)
        this.ws = ws

        const timeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log('[ConnectionManager] WebSocket timeout')
            ws.close()
            resolve(false)
          }
        }, WEBSOCKET_TIMEOUT)

        ws.onopen = () => {
          clearTimeout(timeout)
          // Сокет мог быть закрыт disconnect() во время подключения (unmount)
          if (this.ws !== ws || !this.shouldReconnect) {
            console.log('[ConnectionManager] WebSocket opened after disconnect, closing')
            ws.close()
            resolve(false)
            return
          }
          console.log('[ConnectionManager] WebSocket connected')
          this.setState({
            type: 'websocket',
            isConnected: true,
            lastError: null,
            reconnectAttempts: 0
          })
          resolve(true)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (e) {
            console.error('[ConnectionManager] WebSocket message parse error:', e)
          }
        }

        ws.onerror = (error) => {
          console.error('[ConnectionManager] WebSocket error:', error)
          clearTimeout(timeout)
        }

        ws.onclose = () => {
          console.log('[ConnectionManager] WebSocket closed')
          clearTimeout(timeout)
          if (this.ws === ws) {
            this.ws = null
            if (this.state.type === 'websocket') {
              this.setState({ isConnected: false })
              this.scheduleReconnect()
            }
          }
          resolve(false)
        }
      } catch (e) {
        console.error('[ConnectionManager] WebSocket exception:', e)
        resolve(false)
      }
    })
  }

  private async tryWSTunnel(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log('[ConnectionManager] Trying wstunnel (WebSocket over HTTPS/443)...')
        const wstunnelUrlWithToken = `${this.wstunnelUrl}?token=${this.token}`
        const ws = new WebSocket(wstunnelUrlWithToken)
        this.ws = ws

        const timeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log('[ConnectionManager] wstunnel timeout')
            ws.close()
            resolve(false)
          }
        }, WSTUNNEL_TIMEOUT)

        ws.onopen = () => {
          clearTimeout(timeout)
          if (this.ws !== ws || !this.shouldReconnect) {
            console.log('[ConnectionManager] wstunnel opened after disconnect, closing')
            ws.close()
            resolve(false)
            return
          }
          console.log('[ConnectionManager] wstunnel connected successfully')
          this.preferredTransport = 'wstunnel'
          this.setState({
            type: 'wstunnel',
            isConnected: true,
            lastError: null,
            reconnectAttempts: 0
          })
          resolve(true)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (e) {
            console.error('[ConnectionManager] wstunnel message parse error:', e)
          }
        }

        ws.onerror = (error) => {
          console.error('[ConnectionManager] wstunnel error:', error)
          clearTimeout(timeout)
        }

        ws.onclose = () => {
          console.log('[ConnectionManager] wstunnel closed')
          clearTimeout(timeout)
          if (this.ws === ws) {
            this.ws = null
            if (this.state.type === 'wstunnel') {
              this.setState({ isConnected: false })
              this.scheduleReconnect()
            }
          }
          resolve(false)
        }
      } catch (e) {
        console.error('[ConnectionManager] wstunnel exception:', e)
        resolve(false)
      }
    })
  }

  private async trySSE(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log('[ConnectionManager] Trying SSE...')
        const sseUrl = `${this.baseUrl}/api/sse/events?token=${encodeURIComponent(this.token || '')}`
        
        this.sse = new EventSource(sseUrl)
        const sse = this.sse

        const timeout = setTimeout(() => {
          if (sse.readyState !== EventSource.OPEN) {
            console.log('[ConnectionManager] SSE timeout')
            sse.close()
            resolve(false)
          }
        }, SSE_TIMEOUT)

        sse.onopen = () => {
          clearTimeout(timeout)
          if (this.sse !== sse || !this.shouldReconnect) {
            console.log('[ConnectionManager] SSE opened after disconnect, closing')
            sse.close()
            resolve(false)
            return
          }
          console.log('[ConnectionManager] SSE connected')
          this.setState({
            type: 'sse',
            isConnected: true,
            lastError: null,
            reconnectAttempts: 0
          })
          resolve(true)
        }

        sse.addEventListener('connected', (event: MessageEvent) => {
          clearTimeout(timeout)
          console.log('[ConnectionManager] SSE connected event:', event.data)
        })

        sse.addEventListener('message', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (e) {
            console.error('[ConnectionManager] SSE message parse error:', e)
          }
        })

        sse.onerror = (error) => {
          console.error('[ConnectionManager] SSE error:', error)
          clearTimeout(timeout)
          if (this.sse === sse && this.state.type === 'sse') {
            this.setState({ isConnected: false })
            this.scheduleReconnect()
          }
          resolve(false)
        }
      } catch (e) {
        console.error('[ConnectionManager] SSE exception:', e)
        resolve(false)
      }
    })
  }

  private startLongPolling() {
    console.log('[ConnectionManager] Starting long polling...')
    this.setState({
      type: 'long_polling',
      isConnected: true,
      lastError: null,
      reconnectAttempts: 0
    })
    this.poll()
  }

  private async poll() {
    if (this.state.type !== 'long_polling' || !this.shouldReconnect) return

    try {
      const response = await fetch(
        `${this.baseUrl}/api/poll/events?since_id=${this.lastPollId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.messages && Array.isArray(data.messages)) {
        for (const msg of data.messages) {
          if (msg.id > this.lastPollId) {
            this.lastPollId = msg.id
          }
          this.handleMessage(msg.data || msg)
        }
      }

      this.pollTimeoutId = setTimeout(() => this.poll(), POLL_INTERVAL)
    } catch (e) {
      console.error('[ConnectionManager] Long polling error:', e)
      this.setState({
        isConnected: false,
        lastError: String(e)
      })
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return

    const attempts = this.state.reconnectAttempts
    const delay = RECONNECT_DELAYS[Math.min(attempts, RECONNECT_DELAYS.length - 1)]
    
    console.log(`[ConnectionManager] Reconnecting in ${delay}ms (attempt ${attempts + 1})`)
    this.setState({ reconnectAttempts: attempts + 1 })

    this.reconnectTimeoutId = setTimeout(async () => {
      if (this.token && this.shouldReconnect) {
        this.disconnect(false)
        await this.connect(this.token)
      }
    }, delay)
  }

  send(message: any): boolean {
    if ((this.state.type === 'websocket' || this.state.type === 'wstunnel') && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
      return true
    }
    
    if (this.state.type === 'sse' || this.state.type === 'long_polling') {
      fetch(`${this.baseUrl}/api/poll/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      }).catch(e => console.error('[ConnectionManager] Send error:', e))
      return true
    }

    return false
  }

  disconnect(permanent: boolean = true) {
    // Инвалидируем in-flight цепочку connect(), чтобы она не пересоздала соединение
    this.connectEpoch++
    this.isConnecting = false

    if (permanent) {
      this.shouldReconnect = false
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    if (this.sse) {
      this.sse.close()
      this.sse = null
    }

    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId)
      this.pollTimeoutId = null
    }

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    this.setState({
      type: 'disconnected',
      isConnected: false
    })
  }

  forceConnectionType(type: 'websocket' | 'wstunnel' | 'sse' | 'long_polling'): void {
    if (!this.token) return

    this.disconnect(false)
    
    switch (type) {
      case 'websocket':
        this.tryWebSocket()
        break
      case 'wstunnel':
        this.tryWSTunnel()
        break
      case 'sse':
        this.trySSE()
        break
      case 'long_polling':
        this.startLongPolling()
        break
    }
  }

  getTransportInfo(): { type: ConnectionType; fallbackUsed: boolean } {
    return {
      type: this.state.type,
      fallbackUsed: this.state.type !== 'websocket' && this.state.type !== 'disconnected'
    }
  }
}

export const connectionManager = new ConnectionManager()
