import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
        'transition-all duration-150 ease-standard active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          // Variants (design.md §6.1)
          'bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand':
            variant === 'primary',
          'bg-secondary text-secondary-foreground hover:bg-graphite-200':
            variant === 'secondary',
          'border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200':
            variant === 'outline',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground':
            variant === 'ghost',
          'bg-destructive text-destructive-foreground hover:bg-[hsl(0_72%_38%)]':
            variant === 'danger',
          'text-primary underline-offset-4 hover:underline h-auto p-0':
            variant === 'link',

          // Sizes
          'h-8 px-3 text-xs': size === 'sm',
          'h-10 px-4': size === 'md',
          'h-12 px-6 text-base': size === 'lg',
          'h-10 w-10': size === 'icon',
        },
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
