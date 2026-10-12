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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div className={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col bg-card text-card-foreground rounded-xl shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200 ${className}`}>
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-3 md:p-4 border-b border-border shrink-0">
            {title && <h2 className="text-base md:text-lg font-semibold text-foreground">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground touch-target"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="p-3 md:p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
