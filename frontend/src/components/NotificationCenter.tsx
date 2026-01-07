import { useState, useRef, useEffect } from 'react'
import { Bell, X, CheckCheck, Trash2, MessageSquare, UserPlus, Heart, AtSign, Phone } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { formatTimeAgo, type Notification } from './NotificationToast'

const getIcon = (type: Notification['type']) => {
  switch (type) {
    case 'message':
      return <MessageSquare className="w-4 h-4 text-blue-400" />
    case 'friend_request':
    case 'friend_accepted':
      return <UserPlus className="w-4 h-4 text-green-400" />
    case 'mention':
      return <AtSign className="w-4 h-4 text-purple-400" />
    case 'like':
      return <Heart className="w-4 h-4 text-pink-400" />
    case 'call':
      return <Phone className="w-4 h-4 text-green-400" />
    default:
      return <Bell className="w-4 h-4 text-primary" />
  }
}

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-accent/20 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Уведомления</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                  title="Прочитать все"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                  title="Очистить все"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => {
                      markAsRead(notification.id)
                      if (notification.onClick) notification.onClick()
                    }}
                    className={cn(
                      "p-4 hover:bg-accent/10 cursor-pointer transition-colors flex items-start gap-3",
                      !notification.read && "bg-primary/5"
                    )}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm truncate",
                            !notification.read && "font-semibold"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(notification.timestamp)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            clearNotification(notification.id)
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
