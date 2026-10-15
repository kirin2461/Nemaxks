import React, { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = ''
}: ModalProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleEscape)
    lockBodyScroll()
    return () => {
      document.removeEventListener('keydown', handleEscape)
      unlockBodyScroll()
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-graphite-950/40 backdrop-blur-[3px] animate-fade-in-soft"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div className={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border shadow-pop text-card-foreground rounded-2xl animate-scale-in ${className}`}>
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            {title && <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors duration-150 touch-target"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 pb-6 overflow-y-auto flex-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
