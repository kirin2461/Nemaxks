export type ConnectionType = 'websocket' | 'sse' | 'long_polling' | 'disconnected'

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
  private messageHandlers: Set<MessageHandler> = new Set()
  private stateChangeHandlers: Set<StateChangeHandler> = new Set()
  private isConnecting: boolean = false
  private shouldReconnect: boolean = true

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
    
    this.token = token
    this.shouldReconnect = true
    this.isConnecting = true
    this.setState({ reconnectAttempts: 0 })

    const success = await this.tryWebSocket()
    if (!success) {
      const sseSuccess = await this.trySSE()
      if (!sseSuccess) {
        this.startLongPolling()
      }
    }
    
    this.isConnecting = false
  }

  private async tryWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log('[ConnectionManager] Trying WebSocket...')
        const wsUrlWithToken = `${this.wsUrl}?token=${this.token}`
        this.ws = new WebSocket(wsUrlWithToken)

        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.log('[ConnectionManager] WebSocket timeout')
            this.ws.close()
            resolve(false)
          }
        }, WEBSOCKET_TIMEOUT)

        this.ws.onopen = () => {
          clearTimeout(timeout)
          console.log('[ConnectionManager] WebSocket connected')
          this.setState({
            type: 'websocket',
            isConnected: true,
            lastError: null,
            reconnectAttempts: 0
          })
          resolve(true)
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (e) {
            console.error('[ConnectionManager] WebSocket message parse error:', e)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[ConnectionManager] WebSocket error:', error)
          clearTimeout(timeout)
        }

        this.ws.onclose = () => {
          console.log('[ConnectionManager] WebSocket closed')
          clearTimeout(timeout)
          if (this.state.type === 'websocket') {
            this.setState({ isConnected: false })
            this.scheduleReconnect()
          }
          resolve(false)
        }
      } catch (e) {
        console.error('[ConnectionManager] WebSocket exception:', e)
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

        const timeout = setTimeout(() => {
          if (this.sse && this.sse.readyState !== EventSource.OPEN) {
            console.log('[ConnectionManager] SSE timeout')
            this.sse.close()
            resolve(false)
          }
        }, SSE_TIMEOUT)

        this.sse.onopen = () => {
          clearTimeout(timeout)
          console.log('[ConnectionManager] SSE connected')
          this.setState({
            type: 'sse',
            isConnected: true,
            lastError: null,
            reconnectAttempts: 0
          })
          resolve(true)
        }

        this.sse.addEventListener('connected', (event: MessageEvent) => {
          clearTimeout(timeout)
          console.log('[ConnectionManager] SSE connected event:', event.data)
        })

        this.sse.addEventListener('message', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (e) {
            console.error('[ConnectionManager] SSE message parse error:', e)
          }
        })

        this.sse.onerror = (error) => {
          console.error('[ConnectionManager] SSE error:', error)
          clearTimeout(timeout)
          if (this.state.type === 'sse') {
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
    if (this.state.type === 'websocket' && this.ws?.readyState === WebSocket.OPEN) {
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

  forceConnectionType(type: 'websocket' | 'sse' | 'long_polling'): void {
    if (!this.token) return

    this.disconnect(false)
    
    switch (type) {
      case 'websocket':
        this.tryWebSocket()
        break
      case 'sse':
        this.trySSE()
        break
      case 'long_polling':
        this.startLongPolling()
        break
    }
  }
}

export const connectionManager = new ConnectionManager()
