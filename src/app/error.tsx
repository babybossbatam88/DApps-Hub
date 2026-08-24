'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Errors are surfaced, not swallowed. A financial dashboard that silently
 * renders a partial view is worse than one that says it broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[lp-command-center] unhandled error', error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-terminal-base px-6 text-center">
      <p className="font-mono text-[11px] tracking-[0.2em] text-signal-negative uppercase">
        Something failed
      </p>
      <h1 className="text-xl font-semibold text-terminal-fg">This view could not be rendered</h1>
      <p className="max-w-lg text-sm text-terminal-muted">
        No figures are shown rather than partial ones. The underlying error was:
      </p>
      <code className="max-w-lg overflow-x-auto rounded-lg border border-terminal-border bg-terminal-void px-4 py-2 font-mono text-[12px] text-signal-negative">
        {error.message}
      </code>
      {error.digest ? (
        <p className="font-mono text-[11px] text-terminal-faint">digest {error.digest}</p>
      ) : null}
      <Button onClick={reset} variant="secondary">
        Try again
      </Button>
    </div>
  )
}
