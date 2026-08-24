import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { MobileNav } from './mobile-nav'
import { DemoModeBanner } from './mode-indicator'

/**
 * Desktop: fixed sidebar + sticky topbar, content scrolls independently.
 * Mobile: no sidebar, bottom tab bar, extra bottom padding so the last card is
 * never trapped under the nav.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-terminal-base">
      <Sidebar className="sticky top-0 hidden h-dvh lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <DemoModeBanner />
        <main className="flex-1 px-4 pt-5 pb-24 sm:px-6 lg:pb-10">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
