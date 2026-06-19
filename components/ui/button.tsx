import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-40 cursor-pointer',
  {
    variants: {
      variant: {
        // Primary — solid accent, flat, hover brightness
        default:
          'bg-[var(--accent)] text-white hover:brightness-110 active:brightness-95',
        // Secondary — 1px border, no fill
        secondary:
          'border border-[var(--border)] bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
        // Outline alias
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
        // Danger — for escalate
        destructive:
          'bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] hover:brightness-105',
        // Ghost — no border, subtle hover
        ghost:
          'bg-transparent text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]',
        // Link
        link:
          'bg-transparent text-[var(--accent)] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-8 px-3.5 py-0',
        sm:      'h-7 px-3 text-xs rounded-[6px]',
        lg:      'h-9 px-5',
        icon:    'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
