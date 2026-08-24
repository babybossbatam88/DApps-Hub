'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { NAV_GROUPS, NAV_ITEMS, isNavItemActive } from '@/lib/config/navigation'

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-terminal-border bg-terminal-void',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-terminal-border px-4">
        <div className="grid size-7 place-items-center rounded-md bg-signal-neutral/15 text-signal-neutral">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
            <path d="M2 12.5 6 7l3 3.2L14 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold text-terminal-fg">LP Command</div>
          <div className="truncate text-[10px] tracking-[0.14em] text-terminal-faint uppercase">
            Center
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.key)
          if (items.length === 0) return null
          return (
            <div key={group.key} className="mb-4">
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-terminal-faint uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isNavItemActive(item.href, pathname)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={item.description}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                          active
                            ? 'bg-terminal-raised font-medium text-terminal-fg'
                            : 'text-terminal-muted hover:bg-terminal-surface hover:text-terminal-fg',
                        )}
                      >
                        <Icon
                          className={cn(
                            'size-4 shrink-0',
                            active ? 'text-signal-neutral' : 'text-terminal-faint',
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="border-t border-terminal-border px-4 py-3">
        <p className="text-[10px] leading-relaxed text-terminal-faint">
          Read-only. This application never requests keys or signs transactions.
        </p>
      </div>
    </nav>
  )
}
