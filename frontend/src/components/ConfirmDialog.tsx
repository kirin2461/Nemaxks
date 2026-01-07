import { useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'danger',
  loading = false
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-500 hover:bg-red-600 text-white'
    },
    warning: {
      icon: 'text-yellow-500',
      button: 'bg-yellow-500 hover:bg-yellow-600 text-black'
    },
    info: {
      icon: 'text-blue-500',
      button: 'bg-blue-500 hover:bg-blue-600 text-white'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div 
        ref={dialogRef}
        className="relative bg-[#2b2d31] rounded-lg shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#3f4147]">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full bg-[#1e1f22]", variantStyles[variant].icon)}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3f4147] text-[#b5bac1] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-[#dbdee1] text-sm leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-[#3f4147]">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[#dbdee1] hover:text-white hover:underline transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50",
              variantStyles[variant].button
            )}
          >
            {loading ? 'Загрузка...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
