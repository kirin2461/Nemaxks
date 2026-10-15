import React from 'react'
import { cn, getInitials } from '@/lib/utils'
import { Mic } from 'lucide-react'

type PresenceStatus = 'online' | 'offline' | 'idle' | 'dnd' | 'typing' | 'recording_voice'

interface AvatarProps {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  userId?: string
  className?: string
  showStatus?: boolean
  status?: PresenceStatus
}

function sanitizeImageSrc(src?: string): string | null {
  if (!src) return null
  const trimmed = src.trim()
  if (!trimmed) return null

  if (typeof window === 'undefined') {
    return null
  }

  try {
    const url = new URL(trimmed, window.location.origin)
    const protocol = url.protocol.toLowerCase()
    if (protocol === 'http:' || protocol === 'https:') {
      return url.href
    }
  } catch {
    return null
  }

  return null
}

export function Avatar({ src, alt = '', size = 'md', userId = '', className, showStatus = false, status }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false)
  const initials = getInitials(alt || 'User')
  const safeSrc = sanitizeImageSrc(src)

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-24 h-24 text-4xl',
  }

  const statusSizeClasses = {
    sm: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border',
    md: 'w-3 h-3 -bottom-0.5 -right-0.5 border-2',
    lg: 'w-4 h-4 bottom-0 right-0 border-2',
    xl: 'w-5 h-5 bottom-0.5 right-0.5 border-2',
  }

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-online'
      case 'idle':
        return 'bg-idle'
      case 'dnd':
        return 'bg-dnd'
      case 'typing':
        return 'bg-emerald-500 animate-pulse'
      case 'recording_voice':
        return 'bg-dnd animate-pulse'
      case 'offline':
      default:
        return 'bg-offline'
    }
  }

  const StatusIndicator = showStatus && status ? (
    <span 
      className={cn(
        'absolute rounded-full border-card',
        statusSizeClasses[size],
        getStatusColor()
      )}
    >
      {status === 'recording_voice' && size !== 'sm' && (
        <Mic className="w-full h-full p-0.5 text-white" />
      )}
    </span>
  ) : null

  const isFillParent = className?.includes('w-full') || className?.includes('h-full')

  if (!safeSrc || imgError) {
    return (
      <div className={cn(
        'relative',
        isFillParent ? 'block w-full h-full' : 'inline-block'
      )}>
        <div
          className={cn(
            'rounded-full overflow-hidden flex items-center justify-center font-semibold text-white bg-emerald-700 ring-1 ring-border',
            isFillParent ? 'w-full h-full' : sizeClasses[size],
            className
          )}
        >
          {initials}
        </div>
        {StatusIndicator}
      </div>
    )
  }

  return (
    <div className={cn(
      'relative',
      isFillParent ? 'block w-full h-full' : 'inline-block'
    )}>
      <img
        src={safeSrc}
        alt={alt}
        className={cn(
          'rounded-full object-cover overflow-hidden ring-1 ring-border bg-graphite-100',
          isFillParent ? 'w-full h-full' : sizeClasses[size],
          className
        )}
        onError={() => setImgError(true)}
      />
      {StatusIndicator}
    </div>
  )
}
