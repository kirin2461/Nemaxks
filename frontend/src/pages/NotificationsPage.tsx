import React, { useState, useEffect } from 'react'
import { Bell, Check, Trash2, Filter, Settings, ChevronDown, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationsAPI, Notification, NotificationGroup, getNotificationTypeInfo, formatNotificationTime, NOTIFICATION_TYPES } from '../lib/notificationsApi'

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [groups, setGroups] = useState<NotificationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedType, setSelectedType] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadNotifications(1)
    loadGroups()
  }, [selectedType, unreadOnly])

  const loadNotifications = async (pageNum: number) => {
    setLoading(true)
    try {
      const data = await notificationsAPI.getAll(pageNum, 20, selectedType || undefined, unreadOnly)
      if (pageNum === 1) {
        setNotifications(data.notifications)
      } else {
        setNotifications(prev => [...prev, ...data.notifications])
      }
      setPage(pageNum)
      setHasMore(data.has_more)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const data = await notificationsAPI.getGroups()
      setGroups(data.groups)
    } catch (err) {
      console.error('Failed to load groups:', err)
    }
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await notificationsAPI.delete(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('Удалить все уведомления?')) return
    try {
      await notificationsAPI.deleteAll()
      setNotifications([])
    } catch (err) {
      console.error('Failed to delete all:', err)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }
    if (notification.action_url) {
      navigate(notification.action_url)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl font-bold text-foreground">Уведомления</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-purple-500 rounded-full text-white text-sm font-bold">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadNotifications(1)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Обновить"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title="Фильтры"
            >
              <Filter className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/notifications/settings')}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Настройки"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4 animate-in slide-in-from-top-2">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedType('')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  !selectedType ? 'bg-purple-500 text-white' : 'bg-muted/60 text-foreground hover:bg-muted'
                }`}
              >
                Все
              </button>
              {Object.entries(NOTIFICATION_TYPES).map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                    selectedType === type ? 'bg-purple-500 text-white' : 'bg-muted/60 text-foreground hover:bg-muted'
                  }`}
                >
                  <span>{info.icon}</span>
                  {info.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={e => setUnreadOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-500 bg-transparent text-purple-500 focus:ring-purple-500"
              />
              <span className="text-foreground text-sm">Только непрочитанные</span>
            </label>
          </div>
        )}

        {groups.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {groups.slice(0, 4).map(group => {
              const info = getNotificationTypeInfo(group.type)
              return (
                <button
                  key={group.type}
                  onClick={() => setSelectedType(group.type)}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedType === group.type
                      ? 'bg-purple-500/20 border-purple-500'
                      : 'bg-card border-border hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{info.icon}</span>
                    <span className="text-foreground font-medium">{info.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{group.count} всего</span>
                    {group.unread > 0 && (
                      <span className="text-purple-400">{group.unread} новых</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-muted-foreground text-sm">
            {notifications.length} уведомлений
          </p>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-3 py-1.5 text-sm bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                Прочитать все
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Очистить
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {loading && page === 1 ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg">Нет уведомлений</p>
              <p className="text-muted-foreground text-sm mt-1">
                {unreadOnly ? 'Все уведомления прочитаны' : 'Здесь будут появляться ваши уведомления'}
              </p>
            </div>
          ) : (
            <>
              {notifications.map(notification => {
                const info = getNotificationTypeInfo(notification.type)
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex items-start gap-4 p-4 bg-card border rounded-xl transition-all cursor-pointer hover:border-white/20 ${
                      !notification.is_read ? 'border-purple-500/50 bg-purple-500/5' : 'border-border'
                    }`}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      {notification.actor?.avatar ? (
                        <img
                          src={notification.actor.avatar}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">{notification.icon || info.icon}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-medium ${notification.is_read ? 'text-foreground' : 'text-foreground'}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {info.label} • {formatNotificationTime(notification.created_at)}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <span className="w-2.5 h-2.5 bg-purple-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      {notification.content && (
                        <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
                          {notification.content}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkAsRead(notification.id)
                          }}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-green-400 transition-colors"
                          title="Прочитано"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(notification.id)
                        }}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <button
                  onClick={() => loadNotifications(page + 1)}
                  disabled={loading}
                  className="w-full py-3 bg-muted/60 hover:bg-muted rounded-xl text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ChevronDown className="w-5 h-5" />
                      Загрузить ещё
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage
