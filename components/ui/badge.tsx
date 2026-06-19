import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Tinted-bg pills with 1px border — NO glow, flat only
const badgeVariants = cva(
  'inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors',
  {
    variants: {
      variant: {
        // Default / accent
        default:
          'border-[var(--accent-border)] bg-[var(--accent-tint)] text-[var(--accent-text)]',
        // Status
        success:
          'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]',
        warning:
          'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]',
        destructive:
          'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]',
        // Neutral
        secondary:
          'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)]',
        outline:
          'border-[var(--border)] bg-transparent text-[var(--text-3)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
