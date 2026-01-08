import React from 'react'
import { cn, getInitials, generateAvatarColor } from '@/lib/utils'

interface AvatarProps {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  userId?: string
  className?: string
}

function sanitizeImageSrc(src?: string): string | null {
  if (!src) return null
  const trimmed = src.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed, window.location.origin)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    // If URL construction fails, treat it as unsafe.
  // In non-browser environments (e.g. SSR), avoid using window and skip external images
  if (typeof window === 'undefined') {
    return null
  }

  try {
    // Use current origin as base so relative URLs resolve correctly
    const url = new URL(trimmed, window.location.origin)
    const protocol = url.protocol.toLowerCase()

    // Allow only http and https URLs (including same-origin relatives)
    if (protocol === 'http:' || protocol === 'https:') {
      // Return the normalized URL string instead of the original input
      return url.toString()
      // Return the canonical, fully-resolved URL instead of the raw input
      return url.href
    }
  } catch {
    // If URL construction fails, treat as invalid
    return null
  }

  return null
}

export function Avatar({ src, alt = '', size = 'md', userId = '', className }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false)
  const initials = getInitials(alt || 'User')
  const gradient = generateAvatarColor(userId)
  const safeSrc = sanitizeImageSrc(src)

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-24 h-24 text-4xl',
  }

  if (!safeSrc || imgError) {
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold text-white',
          `bg-gradient-to-br ${gradient}`,
          sizeClasses[size],
          className
        )}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      className={cn('rounded-full object-cover', sizeClasses[size], className)}
      onError={() => setImgError(true)}
    />
  )
}
