import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PremiumBadgeProps {
  /** Название плана (отображается в тултипе и на значке) */
  planName?: string
  /** Тир подписки (vip / pro / basic ...) */
  tier?: string
  /** Показывать только если подписка активна */
  active?: boolean
  className?: string
}

export function PremiumBadge({ planName, tier, active = true, className }: PremiumBadgeProps) {
  if (!active) return null

  const label = planName || 'Premium'
  const isVip =
    tier?.toLowerCase() === 'vip' ||
    /vip/i.test(planName ?? '')

  return (
    <span
      title={`Подписка: ${label}`}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white shadow-soft',
        isVip
          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
          : 'bg-gradient-to-r from-indigo-500 to-violet-500',
        className
      )}
    >
      <Crown className="w-3 h-3" />
      {label}
    </span>
  )
}
