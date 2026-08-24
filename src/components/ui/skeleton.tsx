import { cn } from '@/lib/utils/cn'

/**
 * A skeleton means "loading", never "empty" and never "zero". Anything that has
 * finished loading with no data renders <EmptyState /> instead.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-terminal-raised', className)}
      aria-hidden
      {...props}
    />
  )
}
