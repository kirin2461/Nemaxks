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

/* design.md §6.5 — flat card + left accent bar */
const TOAST_BAR_COLORS = {
  success: 'bg-emerald-600',
  error: 'bg-destructive',
  info: 'bg-graphite-500',
  warning: 'bg-warning',
  notification: 'bg-primary'
}

const TOAST_ICON_COLORS = {
  success: 'text-emerald-600',
  error: 'text-destructive',
  info: 'text-graphite-500',
  warning: 'text-warning',
  notification: 'text-primary'
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
      className={`flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-pop ${
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
    >
      <span className={`w-1 self-stretch rounded-full shrink-0 ${TOAST_BAR_COLORS[type]}`} />
      <Icon className={`w-[18px] h-[18px] flex-shrink-0 mt-0.5 ${TOAST_ICON_COLORS[type]}`} strokeWidth={1.75} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {message && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{message}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 text-sm text-primary hover:text-emerald-800 font-medium"
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors duration-150"
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
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
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
