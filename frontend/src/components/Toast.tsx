import React, { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Bell } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'notification'

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps extends ToastData {
  onClose: (id: string) => void
}

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
  notification: Bell
}

const TOAST_COLORS = {
  success: 'from-green-500/20 to-green-600/20 border-green-500/50',
  error: 'from-red-500/20 to-red-600/20 border-red-500/50',
  info: 'from-blue-500/20 to-blue-600/20 border-blue-500/50',
  warning: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/50',
  notification: 'from-purple-500/20 to-pink-500/20 border-purple-500/50'
}

const TOAST_ICON_COLORS = {
  success: 'text-green-400',
  error: 'text-red-400',
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  notification: 'text-purple-400'
}

function Toast({ id, type, title, message, duration = 5000, action, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(() => onClose(id), 300)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(id), 300)
  }

  const Icon = TOAST_ICONS[type]

  return (
    <div
      className={`flex items-start gap-3 p-4 bg-gradient-to-r ${TOAST_COLORS[type]} border rounded-xl shadow-lg backdrop-blur-sm transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${TOAST_ICON_COLORS[type]}`} />
      
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium">{title}</p>
        {message && (
          <p className="text-gray-300 text-sm mt-1 line-clamp-2">{message}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 text-sm text-purple-400 hover:text-purple-300 font-medium"
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

let addToastHandler: ((toast: Omit<ToastData, 'id'>) => void) | null = null

export function useToast() {
  const showToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    if (addToastHandler) {
      addToastHandler(toast)
    }
  }, [])

  return {
    success: (title: string, message?: string) => 
      showToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => 
      showToast({ type: 'error', title, message }),
    info: (title: string, message?: string) => 
      showToast({ type: 'info', title, message }),
    warning: (title: string, message?: string) => 
      showToast({ type: 'warning', title, message }),
    notification: (title: string, message?: string, action?: ToastData['action']) => 
      showToast({ type: 'notification', title, message, action }),
    show: showToast
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    addToastHandler = (toast) => {
      const id = Math.random().toString(36).slice(2)
      setToasts(prev => [...prev, { ...toast, id }])
    }
    return () => {
      addToastHandler = null
    }
  }, [])

  const handleClose = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onClose={handleClose} />
        </div>
      ))}
    </div>
  )
}

export function showToast(toast: Omit<ToastData, 'id'>) {
  if (addToastHandler) {
    addToastHandler(toast)
  }
}

export default Toast
