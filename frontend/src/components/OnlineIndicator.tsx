import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

interface OnlineIndicatorProps {
  isOnline?: boolean
  lastSeen?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function OnlineIndicator({
  isOnline = false,
  lastSeen,
  size = 'md',
  showText = false,
  className
}: OnlineIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  const getLastSeenText = () => {
    if (isOnline) return 'в сети'
    if (!lastSeen) return 'был давно'
    try {
      return `был ${formatDistanceToNow(new Date(lastSeen), { addSuffix: false, locale: ru })} назад`
    } catch {
      return 'был давно'
    }
  }

  if (showText) {
    return (
      <span className={cn(
        'text-xs',
        isOnline ? 'text-green-500' : 'text-muted-foreground',
        className
      )}>
        {getLastSeenText()}
      </span>
    )
  }

  return (
    <div
      className={cn(
        'rounded-full',
        sizeClasses[size],
        isOnline 
          ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
          : 'bg-gray-400',
        className
      )}
      title={getLastSeenText()}
    />
  )
}
