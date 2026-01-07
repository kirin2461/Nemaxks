import { create } from 'zustand'
import { authAPI, userAPI, messagesAPI, type User, type Conversation, type Settings } from './api'

type ThemeName = 'dark' | 'light' | 'cosmic' | 'nebula-winter' | 'glass' | 'midnight-ocean' | 'forest-night' | 'sunset-glow' | 'neon-tokyo' | 'arctic-aurora'

interface NotificationCounts {
  messages: number
  friends: number
  channels: number
}

interface AppState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  conversations: Conversation[]
  settings: Settings | null
  theme: ThemeName
  isDemoMode: boolean
  notifications: NotificationCounts
  soundEnabled: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  fetchConversations: () => Promise<void>
  setTheme: (theme: ThemeName) => void
  enableDemoMode: () => void
  setNotifications: (counts: Partial<NotificationCounts>) => void
  clearNotification: (type: keyof NotificationCounts) => void
  setSoundEnabled: (enabled: boolean) => void
  playNotificationSound: () => void
}

let notificationAudio: HTMLAudioElement | null = null
if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
  try {
    notificationAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleB8LdJ3w2aRxGxJsnvLepXkeFm2a8d2ldBsQa5ry3qV2GxFrmu/dpnYcE2ua796mdhwUbJnv3ad2HBVsmu7ep3YcFWya7t6ndhwVbJru3qd2HBVsmu7ep3YdFWya7t6ndhwVbJru3qd2HBVsmu7ep3YcFWya7t6ndhwVbJru3qd2HBVsmu7ep3YcFWya7t6ndhwVbJru3qd2HBVsmu7ep3YcFWya7t6ndhwVbJru3qd2HBVsmu7ep3YcFWya7t6ndhwVbJru3qd2HBVsmu7ep3YcFWya7t6ndhwVbJru3qd2HBVsmu7ep3YcFWya7t6ndhwVbJru3qd2HBVsmu7ep3YcFg==')
  } catch {
    notificationAudio = null
  }
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  conversations: [],
  settings: null,
  theme: (localStorage.getItem('theme') as any) || 'dark',
  isDemoMode: false,
  notifications: { messages: 0, friends: 0, channels: 0 },
  soundEnabled: localStorage.getItem('soundEnabled') !== 'false',

  login: async (username, password) => {
    try {
      const response = await authAPI.login(username, password)
      if (response && response.token) {
        // localStorage is already set by api.ts but we'll be explicit
        localStorage.setItem('token', response.token)
        set({ user: response.user, isAuthenticated: true, isDemoMode: false })
      }
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  },

  register: async (username, password) => {
    try {
      const response = await authAPI.register(username, '', password)
      if (response && response.token) {
        localStorage.setItem('token', response.token)
        set({ user: response.user, isAuthenticated: true, isDemoMode: false })
      }
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  },

  logout: async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      localStorage.removeItem('token')
      set({ user: null, isAuthenticated: false, conversations: [], settings: null, isDemoMode: false })
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    try {
      set({ isLoading: true })
      const user = await authAPI.getMe()
      set({ user, isAuthenticated: true, isDemoMode: false })
    } catch (error) {
      localStorage.removeItem('token')
      set({ user: null, isAuthenticated: false, isDemoMode: false })
    } finally {
      set({ isLoading: false })
    }
  },

  updateProfile: async (data) => {
    try {
      const updatedUser = await userAPI.updateProfile(data)
      set({ user: updatedUser })
    } catch (error) {
      console.error('Profile update failed:', error)
      throw error
    }
  },

  fetchConversations: async () => {
    try {
      const conversations = await messagesAPI.getConversations()
      set({ conversations })
      const unreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
      set((state) => ({
        notifications: { ...state.notifications, messages: unreadCount }
      }))
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    }
  },

  setTheme: (theme) => {
    set({ theme })
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  },

  enableDemoMode: () => {
    const demoUser: User = {
      id: 'demo-user-1',
      username: 'demo',
      alias: 'Demo User',
      bio: 'Exploring Nemaks in demo mode',
      created_at: new Date().toISOString(),
    }
    set({ user: demoUser, isAuthenticated: true, isDemoMode: true, isLoading: false })
  },

  setNotifications: (counts) => {
    set((state) => ({
      notifications: { ...state.notifications, ...counts }
    }))
  },

  clearNotification: (type) => {
    set((state) => ({
      notifications: { ...state.notifications, [type]: 0 }
    }))
  },

  setSoundEnabled: (enabled) => {
    set({ soundEnabled: enabled })
    localStorage.setItem('soundEnabled', String(enabled))
  },

  playNotificationSound: () => {
    const state = get()
    if (state.soundEnabled && notificationAudio) {
      notificationAudio.currentTime = 0
      notificationAudio.volume = 0.5
      notificationAudio.play().catch(() => {})
    }
  },
}))
