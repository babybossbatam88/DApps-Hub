'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { MOBILE_PRIMARY, MOBILE_SECONDARY, isNavItemActive } from '@/lib/config/navigation'

/**
 * Mobile bottom navigation: Overview · Positions · Alerts · Wallets · More.
 *
 * This is a native-app pattern, not a shrunken desktop sidebar — thumb-reachable,
 * fixed, and safe-area aware so it clears the iOS home indicator.
 */
export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = MOBILE_SECONDARY.some((item) => isNavItemActive(item.href, pathname))

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute right-0 bottom-0 left-0 rounded-t-2xl border-t border-terminal-border bg-terminal-surface pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-terminal-faint uppercase">
                All sections
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-terminal-muted hover:bg-terminal-raised"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-1.5 px-3 pt-1 pb-5">
              {MOBILE_SECONDARY.map((item) => {
                const Icon = item.icon
                const active = isNavItemActive(item.href, pathname)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border px-3 py-3 text-[13px]',
                        active
                          ? 'border-signal-neutral/30 bg-signal-neutral/10 text-terminal-fg'
                          : 'border-terminal-border bg-terminal-raised/50 text-terminal-muted',
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-terminal-faint" />
                      <span className="truncate">{item.shortLabel ?? item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Primary mobile"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-terminal-border bg-terminal-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_PRIMARY.map((item) => {
            const Icon = item.icon
            const active = isNavItemActive(item.href, pathname)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                    active ? 'text-signal-neutral' : 'text-terminal-faint',
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span>{item.shortLabel ?? item.label}</span>
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={cn(
                'flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                moreActive || moreOpen ? 'text-signal-neutral' : 'text-terminal-faint',
              )}
            >
              <MoreHorizontal className="size-[18px]" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
