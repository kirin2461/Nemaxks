import { useEffect, useRef } from 'react'
import { X, AlertTriangle, Info } from 'lucide-react'
import { cn, lockBodyScroll, unlockBodyScroll } from '@/lib/utils'
import { Button } from './Button'

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
    if (!isOpen) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [isOpen])

  if (!isOpen) return null

  const variantStyles = {
    danger: {
      icon: 'text-red-400',
      iconBg: 'bg-red-500/15',
      buttonVariant: 'danger' as const,
      Icon: AlertTriangle
    },
    warning: {
      icon: 'text-amber-400',
      iconBg: 'bg-amber-500/15',
      buttonVariant: 'primary' as const,
      Icon: AlertTriangle
    },
    info: {
      icon: 'text-primary',
      iconBg: 'bg-primary/15',
      buttonVariant: 'primary' as const,
      Icon: Info
    }
  }

  const styles = variantStyles[variant]
  const IconComponent = styles.Icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="relative glass-strong rounded-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", styles.iconBg, styles.icon)}>
              <IconComponent className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border/60">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={styles.buttonVariant}
            onClick={onConfirm}
            disabled={loading}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
