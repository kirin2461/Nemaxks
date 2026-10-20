import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { useLocation } from 'wouter'
import { NotificationContainer, type Notification } from '@/components/NotificationToast'
import { IncomingCallModal } from '@/components/IncomingCallModal'
import { OutgoingCallModal } from '@/components/OutgoingCallModal'
import { useStore } from '@/lib/store'
import { playNotificationSound } from '@/lib/notificationSounds'
import { connectionManager, ConnectionType, ConnectionState } from '@/lib/connectionManager'
import { useTranslation } from 'react-i18next'

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
  clearMessageNotificationsFromUser: (userId: string) => void
  incomingCall: IncomingCall | null
  outgoingCall: OutgoingCall | null
  acceptCall: () => void
  rejectCall: () => void
  initiateCall: (targetUserId: string, targetUserName: string) => void
  cancelCall: () => void
  subscribeToMessages: (handler: WebSocketMessageHandler) => () => void
  sendWebSocketMessage: (message: any) => void
  connectionStatus: ConnectionStatus
  connectionType: ConnectionType
  forceConnectionType: (type: 'websocket' | 'sse' | 'long_polling') => void
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
  const { t } = useTranslation()
  const { user } = useStore()
  const [, setLocation] = useLocation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toasts, setToasts] = useState<Notification[]>([])
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [connectionType, setConnectionType] = useState<ConnectionType>('disconnected')
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

    // Звук — только если вкладка скрыта ИЛИ чат с отправителем не открыт
    const isMessage = notification.type === 'message'
    let chatWithSenderOpen = false
    if (isMessage && notification.userId && !document.hidden) {
      const { pathname, search } = window.location
      if (pathname === '/messages') {
        const openUserId = new URLSearchParams(search).get('user')
        chatWithSenderOpen = !!openUserId && String(openUserId) === String(notification.userId)
      }
    }
    if (document.hidden || !chatWithSenderOpen) {
      const soundType = notification.type === 'call' ? 'call' :
                        isMessage ? 'message' : 'system'
      playNotificationSound(soundType)
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

  const clearMessageNotificationsFromUser = useCallback(async (userId: string) => {
    setNotifications(prev => prev.filter(n => 
      !(n.type === 'message' && n.userId === userId)
    ))
    setToasts(prev => prev.filter(n => 
      !(n.type === 'message' && n.userId === userId)
    ))
    
    const token = localStorage.getItem('token')
    if (token) {
      try {
        await fetch(`/api/encryption/dm/${userId}/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      } catch (e) {
        console.error('[NotificationContext] Failed to mark messages as read:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return

    const token = localStorage.getItem('token')
    if (!token) return

    const controller = new AbortController()
    let cancelled = false

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        })
        if (response.ok) {
          const data = await response.json()
          if (cancelled) return
          if (Array.isArray(data)) {
            const mappedNotifications: Notification[] = data.map((n: any) => ({
              id: String(n.id || crypto.randomUUID()),
              type: n.type === 'new_message' ? 'message' :
                    n.type === 'call' ? 'call' : 'system',
              title: n.title || n.type || 'Notification',
              message: n.message || n.content || '',
              read: n.read || false,
              timestamp: n.created_at ? new Date(n.created_at) : new Date(),
              userId: n.sender_id ? String(n.sender_id) : n.user_id ? String(n.user_id) : undefined
            }))
            setNotifications(mappedNotifications)
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        console.error('[NotificationContext] Failed to fetch notifications:', e)
      }
    }

    fetchNotifications()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [user?.id])

  useEffect(() => {
    const token = localStorage.getItem('token')
    
    console.log('[NotificationContext] useEffect triggered, user:', user?.id, token ? 'has token' : 'no token')
    
    if (!token) {
      console.log('[NotificationContext] No token, skipping connection')
      setConnectionStatus('disconnected')
      return
    }
    
    console.log('[NotificationContext] Connecting via connectionManager')
    setConnectionStatus('connecting')
    
    const unsubscribeState = connectionManager.onStateChange((state) => {
      setConnectionType(state.type)
      if (state.isConnected) {
        setConnectionStatus('connected')
      } else if (state.reconnectAttempts > 0) {
        setConnectionStatus('reconnecting')
      } else if (state.lastError) {
        setConnectionStatus('error')
      } else {
        setConnectionStatus('disconnected')
      }
    })
    
    const unsubscribeMsg = connectionManager.onMessage((data) => {
      console.log('[NotificationContext] Received message:', data.type)
      handleWebSocketMessage(data)
    })
    
    connectionManager.connect(token)
    
    return () => {
      console.log('[NotificationContext] Cleaning up connection')
      unsubscribeState()
      unsubscribeMsg()
      connectionManager.disconnect()
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
            title: 'Входящий звонок',
            message: `${data.callerName || 'Кто-то'} звонит вам`,
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
            title: 'Звонок отклонён',
            message: 'Звонок был отклонён'
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
            // Store call info for the call page
            sessionStorage.setItem('callConnected', JSON.stringify({
              callId: acceptedCallId,
              targetUserId: outgoingCall.targetUserId,
              targetUserName: outgoingCall.targetUserName
            }))
            // Navigate caller to the call page
            setLocation(`/call/${outgoingCall.targetUserId}?connected=true&callId=${acceptedCallId}`)
            // Clear outgoing call modal
            setOutgoingCall(null)
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
              title: 'Звонок отменён',
              message: 'Звонящий положил трубку'
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
              username: data.username,
              userId: String(senderId)
            })
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(data.username || 'Новое сообщение', {
                body: data.content || data.message?.content || 'Новое сообщение',
                tag: `msg-${senderId}`,
                icon: '/nebula-logo.png'
              })
            }
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
              username: data.username,
              userId: String(senderId)
            })
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(data.username || 'Новое сообщение', {
                body: data.content || data.message?.content || 'Новое сообщение',
                tag: `msg-${senderId}`,
                icon: '/nebula-logo.png'
              })
            }
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
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Запрос в друзья', {
            body: `${data.username || 'Кто-то'} хочет добавить вас в друзья`,
            tag: 'friend-request',
            icon: '/nebula-logo.png'
          })
        }
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
      case 'notification':
        {
          const notifData = data.data || data
          window.dispatchEvent(new CustomEvent('ws:notification', { detail: notifData }))
          if (notifData.title) {
            addNotification({
              type: notifData.type || 'system',
              title: notifData.title,
              message: notifData.content || notifData.message || '',
              username: notifData.actor?.username
            })
          }
        }
        break
      case 'notification_read':
      case 'all_notifications_read':
        window.dispatchEvent(new CustomEvent('ws:notification_read', { detail: data.data || data }))
        break
      case 'new_post':
        window.dispatchEvent(new CustomEvent('ws:new_post', { detail: data.data || data }))
        break
      case 'messages-read':
        window.dispatchEvent(new CustomEvent('ws:messages-read', { detail: { reader_id: data.reader_id } }))
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
    if (incomingCall) {
      connectionManager.send({
        type: 'call-accepted',
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId
      })
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
  }, [incomingCall, setLocation])

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      connectionManager.send({
        type: 'call-rejected',
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId
      })
    }
    setIncomingCall(null)
    pendingOfferRef.current = null
    activeCallIdRef.current = null
  }, [incomingCall])

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
    if (outgoingCall) {
      connectionManager.send({
        type: 'call-cancelled',
        callId: outgoingCall.callId,
        targetUserId: outgoingCall.targetUserId
      })
    }
    setOutgoingCall(null)
    activeCallIdRef.current = null
  }, [outgoingCall])

  const subscribeToMessages = useCallback((handler: WebSocketMessageHandler) => {
    messageHandlersRef.current.add(handler)
    return () => {
      messageHandlersRef.current.delete(handler)
    }
  }, [])

  const sendWebSocketMessage = useCallback((message: any) => {
    connectionManager.send(message)
  }, [])

  const forceConnectionType = useCallback((type: 'websocket' | 'sse' | 'long_polling') => {
    connectionManager.forceConnectionType(type)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const baseTitle = 'Nebula'
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`
    } else {
      document.title = baseTitle
    }
  }, [unreadCount])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err))
    }
  }, [])

  // FE-9: запрос push-разрешения — только для авторизованного пользователя,
  // с понятным UI (баннер) вместо молчаливого системного попапа при загрузке.
  // Системный запрос вызывается по клику (user gesture), иначе браузеры
  // его игнорируют.
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return
    if (sessionStorage.getItem('push_prompt_dismissed')) return
    setShowPushPrompt(true)
  }, [user])

  const handleEnablePush = useCallback(() => {
    setShowPushPrompt(false)
    sessionStorage.setItem('push_prompt_dismissed', '1')
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(err =>
        console.log('Notification permission request failed:', err)
      )
    }
  }, [])

  const handleDismissPushPrompt = useCallback(() => {
    setShowPushPrompt(false)
    sessionStorage.setItem('push_prompt_dismissed', '1')
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
      clearMessageNotificationsFromUser,
      incomingCall,
      outgoingCall,
      acceptCall,
      rejectCall,
      initiateCall,
      cancelCall,
      subscribeToMessages,
      sendWebSocketMessage,
      connectionStatus,
      connectionType,
      forceConnectionType
    }}>
      {children}
      {showPushPrompt && (
        <div className="fixed bottom-20 lg:bottom-4 right-4 z-[70] max-w-sm rounded-2xl border border-border bg-card shadow-pop p-4 animate-scale-in">
          <p className="font-semibold text-sm mb-1">{t('notifications.promptTitle')}</p>
          <p className="text-xs text-muted-foreground mb-3">{t('notifications.promptBody')}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleDismissPushPrompt}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-xs transition-colors"
            >
              {t('notifications.promptLater')}
            </button>
            <button
              onClick={handleEnablePush}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
            >
              {t('notifications.promptEnable')}
            </button>
          </div>
        </div>
      )}
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
