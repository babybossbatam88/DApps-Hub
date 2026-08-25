import Link from 'next/link'
import { ModeIndicator } from './mode-indicator'
import { ChainStatusPill } from './chain-status-pill'
import { ThemeToggle } from './theme-toggle'

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-terminal-border bg-terminal-base/90 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
        <div className="grid size-7 shrink-0 place-items-center rounded-md bg-signal-neutral/15 text-signal-neutral">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
            <path
              d="M2 12.5 6 7l3 3.2L14 3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="truncate text-[13px] font-semibold sm:hidden">LP Command</span>
        <span className="hidden truncate text-[13px] font-semibold sm:inline lg:hidden">
          LP Command Center
        </span>
      </div>

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <ChainStatusPill />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* An RPC outage matters just as much on a phone, so the status travels
            to mobile in a compact form rather than being dropped. */}
        <ChainStatusPill compact className="lg:hidden" />
        <Link
          href="/data-sources"
          className="hidden text-[11px] text-terminal-faint hover:text-terminal-muted sm:inline"
        >
          Data sources
        </Link>
        <ThemeToggle />
        <ModeIndicator compact />
      </div>
    </header>
  )
}
