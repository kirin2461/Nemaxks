import React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        {
          // Variants
          'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80':
            variant === 'primary',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80':
            variant === 'secondary',
          'hover:bg-accent/10 text-foreground': variant === 'ghost',
          'bg-red-500 text-white hover:bg-red-600': variant === 'danger',

          // Sizes
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <div className="loading-spinner w-4 h-4" />}
      {children}
    </button>
  )
}
