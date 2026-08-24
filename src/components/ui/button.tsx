import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-signal-neutral text-white hover:bg-signal-neutral/85',
        secondary:
          'border border-terminal-border-strong bg-terminal-raised text-terminal-fg hover:bg-terminal-overlay',
        ghost: 'text-terminal-muted hover:bg-terminal-raised hover:text-terminal-fg',
        danger: 'bg-signal-negative/15 text-signal-negative hover:bg-signal-negative/25',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
        lg: 'h-11 px-6',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export { buttonVariants }

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
