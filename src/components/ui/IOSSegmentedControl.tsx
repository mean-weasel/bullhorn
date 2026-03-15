'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SegmentOption<T extends string = string> {
  value: T
  label: string
  icon?: ReactNode
  count?: number
  hidden?: boolean
}

interface IOSSegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  showCounts?: boolean
  showLabelsOnMobile?: boolean
  className?: string
  disabled?: boolean
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function IOSSegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  showCounts = true,
  showLabelsOnMobile = false,
  className,
  disabled = false,
}: IOSSegmentedControlProps<T>) {
  const visibleOptions = options.filter((opt) => !opt.hidden)

  const sizeClasses = {
    sm: 'h-9 text-xs',
    md: 'h-11 text-sm',
    lg: 'h-13 text-base',
  }

  const paddingClasses = {
    sm: 'px-3 md:px-4',
    md: 'px-4 md:px-5',
    lg: 'px-5 md:px-6',
  }

  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  return (
    <div
      role="tablist"
      aria-label="Filter options"
      className={cn(
        'inline-flex gap-1 p-1.5 bg-card border-[3px] border-border rounded-lg',
        'shadow-sticker-sm',
        fullWidth && 'w-full',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {visibleOptions.map((option) => {
        const isActive = value === option.value

        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              'relative flex items-center justify-center gap-1.5',
              'rounded-md font-bold transition-all duration-200',
              'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50',
              sizeClasses[size],
              paddingClasses[size],
              fullWidth && 'flex-1',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sticker-hover'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {/* Icon */}
            {option.icon && (
              <span className={cn(iconSizeClasses[size], 'shrink-0')}>{option.icon}</span>
            )}

            {/* Label */}
            <span
              className={cn(
                'whitespace-nowrap',
                !showLabelsOnMobile && option.icon && 'hidden sm:inline'
              )}
            >
              {option.label}
            </span>

            {/* Count badge */}
            {showCounts && option.count !== undefined && (
              <span
                className={cn(
                  'bg-foreground/10 px-1.5 py-0.5 rounded-full',
                  size === 'sm' ? 'text-[10px]' : 'text-xs',
                  isActive && 'bg-primary-foreground/20'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
