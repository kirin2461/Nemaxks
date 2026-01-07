import { cn } from '@/lib/utils'

interface OnlineStatusProps {
  status: 'online' | 'away' | 'offline' | 'dnd'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const statusConfig = {
  online: {
    color: 'bg-green-500',
    label: 'В сети',
  },
  away: {
    color: 'bg-yellow-500',
    label: 'Отошёл',
  },
  offline: {
    color: 'bg-gray-500',
    label: 'Не в сети',
  },
  dnd: {
    color: 'bg-red-500',
    label: 'Не беспокоить',
  },
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

export function OnlineStatus({ status, size = 'md', showLabel = false, className }: OnlineStatusProps) {
  const config = statusConfig[status] || statusConfig.offline

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full',
          sizeClasses[size],
          config.color,
          status === 'online' && 'animate-pulse'
        )}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">{config.label}</span>
      )}
    </div>
  )
}
