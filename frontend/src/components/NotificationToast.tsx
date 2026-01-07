import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, MessageSquare, UserPlus, Bell, Heart, AtSign, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Notification {
  id: string
  type: 'message' | 'friend_request' | 'friend_accepted' | 'mention' | 'like' | 'call' | 'system'
  title: string
  message: string
  avatar?: string
  username?: string
  timestamp: Date
  read: boolean
  onClick?: () => void
}

interface NotificationToastProps {
  notification: Notification
  onDismiss: (id: string) => void
}

const getIcon = (type: Notification['type']) => {
  switch (type) {
    case 'message':
      return <MessageSquare className="w-5 h-5 text-blue-400" />
    case 'friend_request':
    case 'friend_accepted':
      return <UserPlus className="w-5 h-5 text-green-400" />
    case 'mention':
      return <AtSign className="w-5 h-5 text-purple-400" />
    case 'like':
      return <Heart className="w-5 h-5 text-pink-400" />
    case 'call':
      return <Phone className="w-5 h-5 text-green-400" />
    default:
      return <Bell className="w-5 h-5 text-primary" />
  }
}

function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
    const timer = setTimeout(() => {
      handleDismiss()
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = useCallback(() => {
    setIsLeaving(true)
    setTimeout(() => {
      onDismiss(notification.id)
    }, 300)
  }, [notification.id, onDismiss])

  const handleClick = () => {
    if (notification.onClick) {
      notification.onClick()
    }
    handleDismiss()
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "w-80 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-4 cursor-pointer transition-all duration-300 transform",
        isVisible && !isLeaving ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          {notification.avatar ? (
            <img src={notification.avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            getIcon(notification.type)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate">{notification.title}</p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss()
              }}
              className="p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatTimeAgo(notification.timestamp)}
          </p>
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  
  if (seconds < 60) return 'Только что'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  return `${Math.floor(hours / 24)} дн назад`
}

interface NotificationContainerProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

export function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  if (typeof document === 'undefined') return null
  
  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-auto">
      {notifications.slice(0, 5).map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>,
    document.body
  )
}

export { formatTimeAgo }
