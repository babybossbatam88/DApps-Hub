'use client'

import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toggleTheme, useTheme } from '@/lib/utils/use-theme'

/**
 * Light is the default, and the system preference is deliberately not followed:
 * a stated preference should not be overridden by an OS setting the user may
 * have chosen for entirely different reasons.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => toggleTheme(theme)}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'grid size-8 place-items-center rounded-lg border border-terminal-border bg-terminal-surface text-terminal-muted',
        'hover:bg-terminal-raised hover:text-terminal-fg',
        className,
      )}
    >
      {/* Neutral placeholder until hydration knows which theme is applied,
          otherwise the icon flickers to the wrong one. */}
      {theme === null ? (
        <span className="size-4" aria-hidden />
      ) : isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  )
}
