import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-terminal-border-strong bg-terminal-raised text-terminal-muted',
        positive: 'border-signal-positive/30 bg-signal-positive/10 text-signal-positive',
        negative: 'border-signal-negative/30 bg-signal-negative/10 text-signal-negative',
        warning: 'border-signal-warning/30 bg-signal-warning/10 text-signal-warning',
        info: 'border-signal-neutral/30 bg-signal-neutral/10 text-signal-neutral',
        outline: 'border-terminal-border text-terminal-faint',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
