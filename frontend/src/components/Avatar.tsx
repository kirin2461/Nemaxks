import React from 'react'
import { cn, getInitials, generateAvatarColor } from '@/lib/utils'

interface AvatarProps {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  userId?: string
  className?: string
}

export function Avatar({ src, alt = '', size = 'md', userId = '', className }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false)
  const initials = getInitials(alt || 'User')
  const gradient = generateAvatarColor(userId)

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-24 h-24 text-4xl',
  }

  if (!src || imgError) {
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
      src={src}
      alt={alt}
      className={cn('rounded-full object-cover', sizeClasses[size], className)}
      onError={() => setImgError(true)}
    />
  )
}
