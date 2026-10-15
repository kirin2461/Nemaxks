import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-1.5 text-foreground">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'input-field',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/10',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-1.5 text-foreground">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'input-field resize-none min-h-[96px] py-2',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/10',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
