import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { useLocation } from 'wouter'
import { NotificationContainer, type Notification } from '@/components/NotificationToast'
import { IncomingCallModal } from '@/components/IncomingCallModal'
import { OutgoingCallModal } from '@/components/OutgoingCallModal'
import { useStore } from '@/lib/store'
import { playNotificationSound } from '@/lib/notificationSounds'

interface IncomingCall {
  callId: string
  callerId: string
  callerName: string
  callerAvatar?: string
  channelId?: string
  offer?: RTCSessionDescriptionInit
}

interface OutgoingCall {
  callId: string
  targetUserId: string
  targetUserName: string
  status: 'dialing' | 'ringing' | 'connected' | 'rejected' | 'ended'
}

type WebSocketMessageHandler = (data: any) => void

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotification: (id: string) => void
  clearAll: () => void
  incomingCall: IncomingCall | null
  outgoingCall: OutgoingCall | null
  acceptCall: () => void
  rejectCall: () => void
  initiateCall: (targetUserId: string, targetUserName: string) => void
  cancelCall: () => void
  subscribeToMessages: (handler: WebSocketMessageHandler) => () => void
  sendWebSocketMessage: (message: any) => void
  connectionStatus: ConnectionStatus
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useStore()
  const [, setLocation] = useLocation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toasts, setToasts] = useState<Notification[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const pendingOfferRef = useRef<{ offer: RTCSessionDescriptionInit; fromUserId: string } | null>(null)
  const activeCallIdRef = useRef<string | null>(null)
  const messageHandlersRef = useRef<Set<WebSocketMessageHandler>>(new Set())

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false
    }
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50))
    setToasts(prev => [newNotification, ...prev])
    
    const soundType = notification.type === 'call' ? 'call' : 
                      notification.type === 'message' ? 'message' : 'system'
    playNotificationSound(soundType)
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico'
      })
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(n => n.id !== id))
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  useEffect(() => {
    if (!user?.id) return
    
    const token = localStorage.getItem('token')
    if (!token) return
    
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data)) {
            const mappedNotifications: Notification[] = data.map((n: any) => ({
              id: String(n.id || crypto.randomUUID()),
              type: n.type === 'new_message' ? 'message' : 
                    n.type === 'call' ? 'call' : 'system',
              title: n.title || n.type || 'Notification',
              message: n.message || n.content || '',
              read: n.read || false,
              timestamp: n.created_at ? new Date(n.created_at) : new Date()
            }))
            setNotifications(mappedNotifications)
          }
        }
      } catch (e) {
        console.error('[NotificationContext] Failed to fetch notifications:', e)
      }
    }
    
    fetchNotifications()
  }, [user?.id])

  useEffect(() => {
    console.log('[NotificationContext] useEffect triggered, user:', user?.id, user?.username)
    
    if (!user?.id) {
      console.log('[NotificationContext] No user ID, skipping WebSocket connection')
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      console.log('[NotificationContext] No token in localStorage, skipping WebSocket connection')
      return
    }
    
    console.log('[NotificationContext] Starting WebSocket connection for user:', user.id, user.username)
    
    let socket: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host.split(':')[0]
      const wsUrl = `${protocol}//${host}:8000/ws?token=${encodeURIComponent(token)}`
      
      console.log('[NotificationContext] Connecting to WebSocket:', wsUrl)
      setConnectionStatus('connecting')
      
      try {
        socket = new WebSocket(wsUrl)
      } catch (e) {
        console.error('[NotificationContext] Failed to create WebSocket:', e)
        setConnectionStatus('error')
        return
      }
      
      socket.onopen = () => {
        console.log('[NotificationContext] WebSocket connected for user:', user.id, user.username)
        reconnectAttempts = 0
        setWs(socket)
        setConnectionStatus('connected')
      }
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[NotificationContext] Received message:', data.type)
          handleWebSocketMessage(data)
        } catch (e) {
          console.error('[NotificationContext] Failed to parse WebSocket message:', e)
        }
      }
      
      socket.onerror = (error) => {
        console.error('[NotificationContext] WebSocket error for user:', user.id, error)
        setConnectionStatus('error')
      }
      
      socket.onclose = (event) => {
        console.log('[NotificationContext] WebSocket disconnected for user:', user.id, 'code:', event.code, 'reason:', event.reason)
        setWs(null)
        setConnectionStatus('disconnected')
        
        if (reconnectAttempts < maxReconnectAttempts && user?.id) {
          reconnectAttempts++
          const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts - 1), 30000)
          console.log(`[NotificationContext] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`)
          setConnectionStatus('reconnecting')
          reconnectTimeout = setTimeout(connect, delay)
        }
      }
    }
    
    connect()
    
    return () => {
      console.log('[NotificationContext] Cleaning up WebSocket for user:', user?.id)
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (socket) socket.close()
    }
  }, [user?.id])

  const handleWebSocketMessage = (data: any) => {
    messageHandlersRef.current.forEach(handler => handler(data))
    
    switch (data.type) {
      case 'call-offer':
        {
          if (data.channel_id) {
            break
          }
          const callId = data.callId || crypto.randomUUID()
          pendingOfferRef.current = { offer: data.offer, fromUserId: data.fromUserId }
          activeCallIdRef.current = callId
          setIncomingCall({
            callId,
            callerId: data.fromUserId,
            callerName: data.callerName || `User ${data.fromUserId}`,
            callerAvatar: data.callerAvatar,
            channelId: data.channelId,
            offer: data.offer
          })
          addNotification({
            type: 'call',
            title: 'Incoming Call',
            message: `${data.callerName || 'Someone'} is calling you`,
            username: data.callerName
          })
        }
        break
      case 'call-rejected':
        {
          const rejectedCallId = data.callId
          if (rejectedCallId && activeCallIdRef.current !== rejectedCallId) {
            break
          }
          if (outgoingCall) {
            setOutgoingCall(prev => prev ? { ...prev, status: 'rejected' } : null)
            setTimeout(() => {
              setOutgoingCall(null)
              activeCallIdRef.current = null
            }, 2000)
          }
          addNotification({
            type: 'system',
            title: 'Call Declined',
            message: 'The call was declined'
          })
        }
        break
      case 'call-accepted':
        {
          const acceptedCallId = data.callId
          if (acceptedCallId && activeCallIdRef.current !== acceptedCallId) {
            break
          }
          if (outgoingCall) {
            setOutgoingCall(prev => prev ? { ...prev, status: 'connected' } : null)
          }
        }
        break
      case 'call-cancelled':
        {
          const cancelledCallId = data.callId
          if (cancelledCallId && incomingCall?.callId !== cancelledCallId) {
            break
          }
          if (incomingCall) {
            setIncomingCall(null)
            pendingOfferRef.current = null
            activeCallIdRef.current = null
            addNotification({
              type: 'system',
              title: 'Call Cancelled',
              message: 'The caller hung up'
            })
          }
        }
        break;
      case 'call-end':
        {
          const endedCallId = data.callId
          if (endedCallId && activeCallIdRef.current !== endedCallId) {
            break
          }
          setIncomingCall(null)
          setOutgoingCall(null)
          pendingOfferRef.current = null
          activeCallIdRef.current = null
          
          // Emit local event for useVoiceVideoCall to end the session
          window.dispatchEvent(new CustomEvent('remote-call-end', { 
            detail: { fromUserId: data.fromUserId || data.from_user_id } 
          }));
        }
        break;
      case 'dm':
        {
          const { updateConversationMessage, user: currentUser } = useStore.getState()
          const senderId = data.from_user_id || data.sender_id
          const isFromCurrentUser = String(senderId) === String(currentUser?.id)
          if (!isFromCurrentUser) {
            updateConversationMessage(String(senderId), {
              content: data.content || data.message?.content,
              created_at: data.created_at || new Date().toISOString()
            }, false)
            addNotification({
              type: 'message',
              title: 'Новое сообщение',
              message: data.content || `Сообщение от ${data.username || 'пользователя'}`,
              username: data.username
            })
          }
        }
        break
      case 'direct_message':
      case 'new_message':
        {
          const { updateConversationMessage, user: currentUser } = useStore.getState()
          const senderId = data.from_user_id || data.sender_id
          const isFromCurrentUser = String(senderId) === String(currentUser?.id)
          if (!isFromCurrentUser) {
            updateConversationMessage(String(senderId), {
              content: data.content || data.message?.content,
              created_at: data.created_at || new Date().toISOString()
            }, false)
            addNotification({
              type: 'message',
              title: 'Новое сообщение',
              message: data.content || `Сообщение от ${data.username || 'пользователя'}`,
              username: data.username
            })
          }
        }
        break
      case 'friend_request':
        addNotification({
          type: 'friend_request',
          title: 'Заявка в друзья',
          message: `${data.username || 'Кто-то'} хочет добавить вас в друзья`,
          username: data.username
        })
        break
      case 'friend_accepted':
        addNotification({
          type: 'friend_accepted',
          title: 'Заявка принята',
          message: `${data.username || 'Пользователь'} принял вашу заявку в друзья`,
          username: data.username
        })
        break
      case 'mention':
        addNotification({
          type: 'mention',
          title: 'Упоминание',
          message: `${data.username || 'Кто-то'} упомянул вас`,
          username: data.username
        })
        break
      case 'like':
        addNotification({
          type: 'like',
          title: 'Новый лайк',
          message: `${data.username || 'Кто-то'} оценил вашу публикацию`,
          username: data.username
        })
        break
      case 'incoming_call':
        addNotification({
          type: 'call',
          title: 'Входящий звонок',
          message: `${data.username || 'Пользователь'} звонит вам`,
          username: data.username
        })
        break
      default:
        if (data.title && data.message) {
          addNotification({
            type: 'system',
            title: data.title,
            message: data.message
          })
        }
    }
  }

  const acceptCall = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN && incomingCall) {
      ws.send(JSON.stringify({
        type: 'call-accepted',
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId
      }))
    }
    
    if (incomingCall) {
      sessionStorage.setItem('pendingCall', JSON.stringify({
        callId: incomingCall.callId,
        callerId: incomingCall.callerId,
        callerName: incomingCall.callerName,
        callerAvatar: incomingCall.callerAvatar,
        offer: incomingCall.offer
      }))
    }
    
    if (incomingCall?.channelId) {
      setLocation(`/channels?channel=${incomingCall.channelId}&accept=true`)
    } else if (incomingCall?.callerId) {
      setLocation(`/call/${incomingCall.callerId}?accept=true`)
    }
    setIncomingCall(null)
  }, [ws, incomingCall, setLocation])

  const rejectCall = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN && incomingCall) {
      ws.send(JSON.stringify({
        type: 'call-rejected',
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId
      }))
    }
    setIncomingCall(null)
    pendingOfferRef.current = null
    activeCallIdRef.current = null
  }, [ws, incomingCall])

  const initiateCall = useCallback((targetUserId: string, targetUserName: string) => {
    if (outgoingCall) {
      return
    }

    const callId = crypto.randomUUID()
    activeCallIdRef.current = callId
    
    sessionStorage.setItem('outgoingCall', JSON.stringify({
      callId,
      targetUserId,
      targetUserName
    }))
    
    setOutgoingCall({
      callId,
      targetUserId,
      targetUserName,
      status: 'dialing'
    })

    setLocation(`/call/${targetUserId}?initiate=true&callId=${callId}`)
  }, [outgoingCall, setLocation])

  const cancelCall = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN && outgoingCall) {
      ws.send(JSON.stringify({
        type: 'call-cancelled',
        callId: outgoingCall.callId,
        targetUserId: outgoingCall.targetUserId
      }))
    }
    setOutgoingCall(null)
    activeCallIdRef.current = null
  }, [ws, outgoingCall])

  const subscribeToMessages = useCallback((handler: WebSocketMessageHandler) => {
    messageHandlersRef.current.add(handler)
    return () => {
      messageHandlersRef.current.delete(handler)
    }
  }, [])

  const sendWebSocketMessage = useCallback((message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }, [ws])

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const baseTitle = 'Nemaks'
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`
    } else {
      document.title = baseTitle
    }
  }, [unreadCount])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAll,
      incomingCall,
      outgoingCall,
      acceptCall,
      rejectCall,
      initiateCall,
      cancelCall,
      subscribeToMessages,
      sendWebSocketMessage,
      connectionStatus
    }}>
      {children}
      <NotificationContainer notifications={toasts} onDismiss={dismissToast} />
      {incomingCall && (
        <IncomingCallModal
          caller={{
            id: incomingCall.callerId,
            username: incomingCall.callerName,
            avatar: incomingCall.callerAvatar
          }}
          channelId={incomingCall.channelId}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}
      {outgoingCall && (
        <OutgoingCallModal
          targetUser={{
            id: outgoingCall.targetUserId,
            username: outgoingCall.targetUserName
          }}
          status={outgoingCall.status}
          onCancel={cancelCall}
        />
      )}
    </NotificationContext.Provider>
  )
}
