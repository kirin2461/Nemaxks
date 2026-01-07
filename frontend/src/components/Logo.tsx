import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showText?: boolean
}

export function Logo({ size = 'md', className, showText = false }: LogoProps) {
  const { theme } = useStore()

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  }

  const getThemeClass = () => {
    switch (theme) {
      case 'dark':
        return 'logo-dark'
      case 'light':
        return 'logo-light'
      case 'cosmic':
        return 'logo-cosmic'
      case 'nebula-winter':
        return 'logo-nebula'
      case 'glass':
        return 'logo-glass'
      case 'midnight-ocean':
        return 'logo-ocean'
      case 'forest-night':
        return 'logo-forest'
      case 'sunset-glow':
        return 'logo-sunset'
      case 'neon-tokyo':
        return 'logo-neon'
      case 'arctic-aurora':
        return 'logo-aurora'
      default:
        return 'logo-dark'
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'relative rounded-xl overflow-hidden',
        sizeClasses[size],
        getThemeClass()
      )}>
        <img
          src="/logos/nemaks_neon_cyberpunk_logo.png"
          alt="Nemaks"
          className="w-full h-full object-cover logo-image"
        />
        <div className="logo-overlay absolute inset-0" />
      </div>
      {showText && (
        <span className={cn('font-bold gradient-text', textSizeClasses[size])}>
          Nemaks
        </span>
      )}
    </div>
  )
}
