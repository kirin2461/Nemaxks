import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  showCount?: boolean
  count?: number
  onRate?: (rating: number) => void
  className?: string
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  showCount = false,
  count = 0,
  onRate,
  className,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0)

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const handleClick = (starIndex: number) => {
    if (interactive && onRate) {
      onRate(starIndex)
    }
  }

  const displayRating = hoverRating || rating

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex">
        {Array.from({ length: maxRating }).map((_, index) => {
          const starIndex = index + 1
          const isFilled = starIndex <= displayRating
          const isHalf = starIndex - 0.5 <= displayRating && starIndex > displayRating

          return (
            <button
              key={index}
              type="button"
              disabled={!interactive}
              onClick={() => handleClick(starIndex)}
              onMouseEnter={() => interactive && setHoverRating(starIndex)}
              onMouseLeave={() => interactive && setHoverRating(0)}
              className={cn(
                'transition-colors',
                interactive && 'cursor-pointer hover:scale-110',
                !interactive && 'cursor-default'
              )}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  isFilled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground',
                  isHalf && 'fill-yellow-400/50'
                )}
              />
            </button>
          )
        })}
      </div>
      {showCount && (
        <span className="text-sm text-muted-foreground ml-1">
          ({rating.toFixed(1)} / {count})
        </span>
      )}
    </div>
  )
}
