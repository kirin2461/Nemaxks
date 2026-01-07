import React, { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger' | 'success'
  disabled?: boolean
  divider?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  position: { x: number; y: number }
  onClose: () => void
  visible: boolean
}

export function ContextMenu({ items, position, onClose, visible }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Add small delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 100)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible) return null

  // Calculate position to keep menu in viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 9999,
  }

  return (
    <div
      ref={menuRef}
      className="context-menu animate-context-menu"
      style={menuStyle}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.divider ? (
            <div className="context-menu-divider" />
          ) : (
            <button
              onClick={() => {
                if (!item.disabled) {
                  item.onClick()
                  onClose()
                }
              }}
              disabled={item.disabled}
              className={cn(
                'context-menu-item',
                item.variant === 'danger' && 'context-menu-item-danger',
                item.variant === 'success' && 'context-menu-item-success',
                item.disabled && 'context-menu-item-disabled'
              )}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              <span className="context-menu-label">{item.label}</span>
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// Hook for managing context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = React.useState<{
    visible: boolean
    position: { x: number; y: number }
    items: ContextMenuItem[]
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    items: [],
  })

  const showContextMenu = (
    e: React.MouseEvent,
    items: ContextMenuItem[]
  ) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      items,
    })
  }

  const hideContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }))
  }

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  }
}
