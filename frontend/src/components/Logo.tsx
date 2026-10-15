import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showText?: boolean
}

/**
 * Premium Monochrome logo (design.md §8):
 * graphite-900 rounded square + thin white orbit ellipse tilted -24°
 * with a solid emerald-500 node. Flat, no glow, no animation
 * (hover = mark scales 1 → 1.06, 150ms).
 */
export function Logo({ size = 'md', className, showText = false }: LogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="Nebula"
        className={cn(
          'shrink-0 transition-transform duration-150 ease-standard hover:scale-[1.06]',
          sizeClasses[size]
        )}
      >
        {/* Graphite rounded square */}
        <rect width="64" height="64" rx="16" fill="hsl(224 14% 14%)" />
        {/* Orbit ring: thin white ellipse tilted -24° */}
        <ellipse
          cx="32"
          cy="32"
          rx="21"
          ry="9"
          fill="none"
          stroke="hsl(0 0% 100% / 0.9)"
          strokeWidth="2"
          transform="rotate(-24 32 32)"
        />
        {/* Emerald node on the ring */}
        <circle cx="50.2" cy="23.7" r="5" fill="hsl(160 84% 39%)" />
      </svg>
      {showText && (
        <span
          className={cn(
            'font-display font-extrabold tracking-[-0.02em] text-graphite-900',
            textSizeClasses[size]
          )}
        >
          Nebula
        </span>
      )}
    </div>
  )
}
