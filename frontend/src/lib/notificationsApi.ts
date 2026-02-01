const API_BASE = '/api'

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Ошибка запроса')
  }

  return response.json()
}

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  content: string
  icon?: string
  image_url?: string
  action_url?: string
  actor_id?: number
  actor?: {
    id: number
    username: string
    avatar?: string
  }
  entity_id?: number
  entity_type?: string
  data?: string
  is_read: boolean
  read_at?: string
  created_at: string
}

export interface NotificationGroup {
  type: string
  count: number
  unread: number
  latest_at: string
}

export interface NotificationPreferences {
  id: number
  user_id: number
  messages: boolean
  mentions: boolean
  friend_requests: boolean
  guild_invites: boolean
  achievements: boolean
  daily_rewards: boolean
  gifts: boolean
  system: boolean
  likes: boolean
  comments: boolean
  follows: boolean
  sound_enabled: boolean
  desktop_notifications: boolean
  email_notifications: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
}

export interface NotificationsResponse {
  notifications: Notification[]
  total: number
  unread_count: number
  page: number
  limit: number
  has_more: boolean
}

export const notificationsAPI = {
  getAll: (page = 1, limit = 20, type?: string, unreadOnly = false) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(type && { type }),
      ...(unreadOnly && { unread: 'true' })
    })
    return request<NotificationsResponse>(`/notifications/full?${params}`)
  },

  getGroups: () =>
    request<{ groups: NotificationGroup[], unread_count: number }>('/notifications/groups'),

  getUnreadCount: () =>
    request<{ count: number }>('/notifications/unread-count'),

  markAsRead: (id: number) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllAsRead: () =>
    request('/notifications/read-all', { method: 'POST' }),

  delete: (id: number) =>
    request(`/notifications/${id}`, { method: 'DELETE' }),

  deleteAll: () =>
    request('/notifications', { method: 'DELETE' }),

  getPreferences: () =>
    request<NotificationPreferences>('/notifications/preferences'),

  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs)
    }),

  sendTest: () =>
    request<{ success: boolean, notification: Notification }>('/notifications/test', {
      method: 'POST'
    })
}

export const NOTIFICATION_TYPES: Record<string, { label: string, icon: string, color: string }> = {
  message: { label: 'Сообщения', icon: '💬', color: 'blue' },
  mention: { label: 'Упоминания', icon: '@', color: 'purple' },
  friend_request: { label: 'Запросы в друзья', icon: '👋', color: 'green' },
  friend_accept: { label: 'Друзья', icon: '🎉', color: 'green' },
  guild_invite: { label: 'Приглашения', icon: '🏰', color: 'orange' },
  guild_join: { label: 'Гильдии', icon: '🏰', color: 'orange' },
  achievement: { label: 'Достижения', icon: '🏆', color: 'yellow' },
  level_up: { label: 'Уровни', icon: '⬆️', color: 'yellow' },
  daily_reward: { label: 'Награды', icon: '🎁', color: 'pink' },
  gift: { label: 'Подарки', icon: '🎁', color: 'pink' },
  system: { label: 'Система', icon: '🔔', color: 'gray' },
  like: { label: 'Лайки', icon: '❤️', color: 'red' },
  comment: { label: 'Комментарии', icon: '💬', color: 'blue' },
  follow: { label: 'Подписки', icon: '👤', color: 'cyan' }
}

export function getNotificationTypeInfo(type: string) {
  return NOTIFICATION_TYPES[type] || { label: type, icon: '🔔', color: 'gray' }
}

export function formatNotificationTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
