import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { useLocation } from 'wouter'
import { NotificationContainer, type Notification } from '@/components/NotificationToast'
import { IncomingCallModal } from '@/components/IncomingCallModal'
import { OutgoingCallModal } from '@/components/OutgoingCallModal'
import { useStore } from '@/lib/store'

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
    
    let socket: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host.split(':')[0]
      const wsUrl = `${protocol}//${host}:8000/ws?token=${encodeURIComponent(token)}`
      
      console.log('Connecting to WebSocket:', wsUrl)
      socket = new WebSocket(wsUrl)
      
      socket.onopen = () => {
        console.log('Notification WebSocket connected')
        reconnectAttempts = 0
        setWs(socket)
      }
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      socket.onclose = () => {
        console.log('WebSocket disconnected')
        setWs(null)
        
        if (reconnectAttempts < maxReconnectAttempts && user?.id) {
          reconnectAttempts++
          const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts - 1), 30000)
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`)
          reconnectTimeout = setTimeout(connect, delay)
        }
      }
    }
    
    connect()
    
    return () => {
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
      case 'new_message':
        addNotification({
          type: 'message',
          title: 'Новое сообщение',
          message: data.content || `Сообщение от ${data.username || 'пользователя'}`,
          username: data.username
        })
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
      sendWebSocketMessage
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
