import React, { useState, useEffect } from 'react'
import { Bell, Check, X, Filter, Settings, ChevronDown, RefreshCw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationsAPI, Notification, NotificationGroup, getNotificationTypeInfo, formatNotificationTime, NOTIFICATION_TYPES } from '../lib/notificationsApi'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { cn } from '@/lib/utils'

const iconButtonClass =
  'h-10 w-10 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [groups, setGroups] = useState<NotificationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedType, setSelectedType] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const loadSeqRef = React.useRef(0)
  const mountedRef = React.useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    loadNotifications(1)
    loadGroups()
  }, [selectedType, unreadOnly])

  const loadNotifications = async (pageNum: number) => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const data = await notificationsAPI.getAll(pageNum, 20, selectedType || undefined, unreadOnly)
      // Игнорируем устаревший ответ (фильтр/страница уже сменились или компонент размонтирован)
      if (!mountedRef.current || seq !== loadSeqRef.current) return
      if (pageNum === 1) {
        setNotifications(data.notifications)
      } else {
        setNotifications(prev => [...prev, ...data.notifications])
      }
      setPage(pageNum)
      setHasMore(data.has_more)
    } catch (err) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return
      console.error('Failed to load notifications:', err)
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) {
        setLoading(false)
      }
    }
  }

  const loadGroups = async () => {
    try {
      const data = await notificationsAPI.getGroups()
      if (!mountedRef.current) return
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
    setShowDeleteAllConfirm(false)
    try {
      await notificationsAPI.deleteAll()
      setNotifications([])
      toast.success('Все уведомления удалены')
    } catch (err) {
      console.error('Failed to delete all:', err)
      toast.error('Не удалось удалить уведомления')
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
    <div className="min-h-screen bg-background p-4 sm:p-6 animate-rise-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" strokeWidth={1.75} />
            <h1 className="text-2xl font-display font-bold text-graphite-900 tracking-[-0.015em]">Уведомления</h1>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center animate-pop-menu">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => loadNotifications(1)}
              className={iconButtonClass}
              title="Обновить"
            >
              <RefreshCw className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                iconButtonClass,
                showFilters && 'bg-accent text-accent-foreground'
              )}
              title="Фильтры"
            >
              <Filter className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => navigate('/notifications/settings')}
              className={iconButtonClass}
              title="Настройки"
            >
              <Settings className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-xl border border-border bg-card shadow-none p-4 mb-4 animate-rise-in">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedType('')}
                className={cn(
                  'h-8 px-3 rounded-md text-sm transition-all duration-150',
                  !selectedType
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'bg-secondary text-secondary-foreground hover:bg-graphite-200'
                )}
              >
                Все
              </button>
              {Object.entries(NOTIFICATION_TYPES).map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'h-8 px-3 rounded-md text-sm transition-all duration-150 flex items-center gap-1.5',
                    selectedType === type
                      ? 'bg-primary text-primary-foreground shadow-soft'
                      : 'bg-secondary text-secondary-foreground hover:bg-graphite-200'
                  )}
                >
                  <span>{info.icon}</span>
                  {info.label}
                </button>
              ))}
            </div>

            {/* Filter pills: Все / Непрочитанные */}
            <div className="inline-flex p-1 rounded-lg bg-secondary gap-1">
              <button
                onClick={() => setUnreadOnly(false)}
                className={cn(
                  'h-8 px-3 rounded-md text-sm transition-all duration-150',
                  !unreadOnly ? 'bg-card text-foreground shadow-soft font-medium' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Все
              </button>
              <button
                onClick={() => setUnreadOnly(true)}
                className={cn(
                  'h-8 px-3 rounded-md text-sm transition-all duration-150',
                  unreadOnly ? 'bg-card text-foreground shadow-soft font-medium' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Непрочитанные
              </button>
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {groups.slice(0, 4).map((group, i) => {
              const info = getNotificationTypeInfo(group.type)
              return (
                <button
                  key={group.type}
                  onClick={() => setSelectedType(group.type)}
                  className={cn(
                    'p-3 rounded-xl border bg-card text-left transition-all duration-150 animate-rise-in',
                    'hover:-translate-y-0.5 hover:shadow-elev',
                    selectedType === group.type
                      ? 'border-primary shadow-soft'
                      : 'border-border hover:border-graphite-300'
                  )}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{info.icon}</span>
                    <span className="text-foreground text-sm font-medium truncate">{info.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{group.count} всего</span>
                    {group.unread > 0 && (
                      <span className="text-primary font-medium">{group.unread} новых</span>
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
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="h-8 px-3 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" strokeWidth={1.75} />
                Прочитать все
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="h-8 px-3 rounded-lg text-sm text-destructive hover:bg-danger-soft transition-all duration-150 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                Очистить
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {loading && page === 1 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
                  <div className="skeleton h-12 w-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 px-6 rounded-xl border border-border bg-card animate-rise-in">
              <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
                <Bell className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-semibold text-foreground mt-4">
                {unreadOnly ? 'Все уведомления прочитаны' : 'Нет уведомлений'}
              </p>
              <p className="text-sm text-muted-foreground max-w-[320px] mx-auto mt-1">
                {unreadOnly ? 'Новые уведомления появятся здесь' : 'Здесь будут появляться ваши уведомления'}
              </p>
            </div>
          ) : (
            <>
              {notifications.map((notification, i) => {
                const info = getNotificationTypeInfo(notification.type)
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'group flex items-start gap-4 p-4 rounded-xl border transition-all duration-150 cursor-pointer animate-rise-in',
                      'hover:border-graphite-300 hover:shadow-elev',
                      !notification.is_read
                        ? 'border-emerald-200 bg-accent/40'
                        : 'border-border bg-card'
                    )}
                    style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                  >
                    <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-700 ring-1 ring-border flex items-center justify-center overflow-hidden">
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
                        <div className="min-w-0">
                          <p className={cn('text-sm', !notification.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {info.label} • {formatNotificationTime(notification.created_at)}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <span className="w-2.5 h-2.5 bg-primary rounded-full shrink-0 mt-1" />
                        )}
                      </div>
                      {notification.content && (
                        <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
                          {notification.content}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkAsRead(notification.id)
                          }}
                          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-emerald-700 transition-all duration-150"
                          title="Прочитано"
                        >
                          <Check className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(notification.id)
                        }}
                        className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-destructive transition-all duration-150"
                        title="Удалить"
                      >
                        <X className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <button
                  onClick={() => loadNotifications(page + 1)}
                  disabled={loading}
                  className="w-full h-10 rounded-lg border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" strokeWidth={1.75} />
                      Загрузить ещё
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        title="Удаление уведомлений"
        message="Удалить все уведомления? Это действие нельзя отменить."
        confirmText="Удалить"
        variant="danger"
      />
    </div>
  )
}

export default NotificationsPage
