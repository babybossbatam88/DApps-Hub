import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Bell,
  Coins,
  Database,
  FlaskConical,
  Landmark,
  Layers,
  LayoutDashboard,
  Scale,
  ScrollText,
  Settings,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  /** Shorter label for the mobile bottom bar. */
  shortLabel?: string
  icon: LucideIcon
  description: string
  group: 'positions' | 'analysis' | 'data' | 'system'
  /** Shown in the mobile bottom nav (max 5, including "More"). */
  primaryMobile?: boolean
}

/**
 * The 14-page sitemap, defined once. Desktop sidebar, mobile bottom bar, the
 * "More" sheet, and breadcrumbs all read from this list, so a new page cannot
 * be added to one navigation surface and forgotten in another.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'Portfolio KPIs, LP vs HODL, and range risk at a glance',
    group: 'positions',
    primaryMobile: true,
  },
  {
    href: '/positions',
    label: 'Positions',
    icon: Layers,
    description: 'Every concentrated-liquidity position with its range state',
    group: 'positions',
    primaryMobile: true,
  },
  {
    href: '/wallets',
    label: 'Wallets',
    icon: Wallet,
    description: 'Public EVM addresses tracked read-only',
    group: 'positions',
    primaryMobile: true,
  },
  {
    href: '/rebalance',
    label: 'Rebalance Center',
    shortLabel: 'Rebalance',
    icon: Target,
    description: 'Recommendations with reasoning and estimated cost',
    group: 'analysis',
  },
  {
    href: '/fees',
    label: 'Fees',
    icon: Coins,
    description: 'Uncollected, collected, lifetime fees and fee APR',
    group: 'analysis',
  },
  {
    href: '/hodl',
    label: 'HODL Benchmark',
    shortLabel: 'HODL',
    icon: Scale,
    description: 'What the deposited tokens would be worth today',
    group: 'analysis',
  },
  {
    href: '/performance',
    label: 'Performance',
    icon: TrendingUp,
    description: '30 / 90 / 365 day returns against the benchmark',
    group: 'analysis',
  },
  {
    href: '/simulations',
    label: 'Simulations',
    icon: FlaskConical,
    description: 'Range and price scenario lab — estimates, not forecasts',
    group: 'analysis',
  },
  {
    href: '/log',
    label: 'Transaction Log',
    shortLabel: 'Log',
    icon: ScrollText,
    description: 'Every lifecycle event with gas cost and reasoning',
    group: 'analysis',
  },
  {
    href: '/binance',
    label: 'Binance',
    icon: Landmark,
    description: 'Market data and optional read-only account access',
    group: 'data',
  },
  {
    href: '/data-sources',
    label: 'Data Sources',
    shortLabel: 'Sources',
    icon: Database,
    description: 'RPC, database, and market-data health',
    group: 'data',
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: Bell,
    description: 'Range, fee, and sync-failure alerting',
    group: 'system',
    primaryMobile: true,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Thresholds, display preferences, and mode',
    group: 'system',
  },
]

export const NAV_GROUPS: Array<{ key: NavItem['group']; label: string }> = [
  { key: 'positions', label: 'Portfolio' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'data', label: 'Data' },
  { key: 'system', label: 'System' },
]

export const MOBILE_PRIMARY = NAV_ITEMS.filter((item) => item.primaryMobile)
export const MOBILE_SECONDARY = NAV_ITEMS.filter((item) => !item.primaryMobile)

export const ACTIVITY_ICON = Activity

/**
 * Active-route matching. `/` matches only itself; every other item matches its
 * own subtree so `/positions/123` still highlights "Positions".
 */
export function isNavItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === '/') return pathname === '/'
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`)
}
