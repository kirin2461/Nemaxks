import React, { useState, useEffect, useRef } from 'react'
import { Bell, Check, Trash2, Settings, X, ExternalLink } from 'lucide-react'
import { notificationsAPI, Notification, getNotificationTypeInfo, formatNotificationTime } from '../lib/notificationsApi'
import { useLocation } from 'wouter'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [, setLocation] = useLocation()

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      const notification = event.detail as Notification
      setNotifications(prev => [notification, ...prev.slice(0, 19)])
      setUnreadCount(prev => prev + 1)
    }

    window.addEventListener('ws:notification' as any, handleNotification)
    return () => window.removeEventListener('ws:notification' as any, handleNotification)
  }, [])

  const loadUnreadCount = async () => {
    try {
      const { count } = await notificationsAPI.getUnreadCount()
      setUnreadCount(count)
    } catch (err) {
      console.error('Failed to load unread count:', err)
    }
  }

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const data = await notificationsAPI.getAll(1, 10)
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await notificationsAPI.delete(id)
      const notification = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      notificationsAPI.markAsRead(notification.id)
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    if (notification.action_url) {
      setLocation(notification.action_url)
      setIsOpen(false)
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-lg font-bold text-white">Уведомления</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  title="Прочитать все"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  setLocation('/notifications/settings')
                  setIsOpen(false)
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Настройки"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              notifications.map(notification => {
                const typeInfo = getNotificationTypeInfo(notification.type)
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex items-start gap-3 p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                      !notification.is_read ? 'bg-purple-500/5' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      {notification.actor?.avatar ? (
                        <img 
                          src={notification.actor.avatar} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">{notification.icon || typeInfo.icon}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${notification.is_read ? 'text-gray-300' : 'text-white'}`}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      {notification.content && (
                        <p className="text-sm text-gray-400 line-clamp-2 mt-0.5">
                          {notification.content}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatNotificationTime(notification.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.is_read && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-green-400 transition-colors"
                          title="Отметить как прочитанное"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(notification.id, e)}
                        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => {
                  setLocation('/notifications')
                  setIsOpen(false)
                }}
                className="w-full py-2 text-center text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Все уведомления
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
