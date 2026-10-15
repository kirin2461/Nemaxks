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
      icon: 'text-destructive',
      iconBg: 'bg-danger-soft',
      buttonVariant: 'danger' as const,
      Icon: AlertTriangle
    },
    warning: {
      icon: 'text-warning',
      iconBg: 'bg-warning-soft',
      buttonVariant: 'primary' as const,
      Icon: AlertTriangle
    },
    info: {
      icon: 'text-emerald-700',
      iconBg: 'bg-accent',
      buttonVariant: 'primary' as const,
      Icon: Info
    }
  }

  const styles = variantStyles[variant]
  const IconComponent = styles.Icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-graphite-950/40 backdrop-blur-[3px] animate-fade-in-soft"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="relative bg-card border border-border shadow-pop rounded-2xl w-full max-w-sm p-6 animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-full grid place-items-center", styles.iconBg, styles.icon)}>
              <IconComponent className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors duration-150"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="pt-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
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
