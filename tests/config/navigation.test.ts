import { describe, expect, it } from 'vitest'
import {
  MOBILE_PRIMARY,
  MOBILE_SECONDARY,
  NAV_GROUPS,
  NAV_ITEMS,
  isNavItemActive,
} from '@/lib/config/navigation'

describe('navigation', () => {
  it('covers the full 13-route sitemap plus the dynamic position detail route', () => {
    // Position Detail is reached from Positions and has no nav entry of its own.
    expect(NAV_ITEMS).toHaveLength(13)
  })

  it('has unique hrefs and labels', () => {
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length)
    expect(new Set(NAV_ITEMS.map((i) => i.label)).size).toBe(NAV_ITEMS.length)
  })

  it('assigns every item to a rendered group', () => {
    const groups = new Set(NAV_GROUPS.map((g) => g.key))
    for (const item of NAV_ITEMS) expect(groups.has(item.group)).toBe(true)
  })

  it('leaves exactly one slot for "More" in the five-item mobile bar', () => {
    expect(MOBILE_PRIMARY).toHaveLength(4)
    expect(MOBILE_PRIMARY.map((i) => i.href)).toEqual(['/', '/positions', '/wallets', '/alerts'])
    expect(MOBILE_SECONDARY.length).toBe(NAV_ITEMS.length - MOBILE_PRIMARY.length)
  })

  it('gives every long label a short form for the mobile bar', () => {
    for (const item of NAV_ITEMS) {
      const rendered = item.shortLabel ?? item.label
      expect(rendered.length).toBeLessThanOrEqual(12)
    }
  })
})

describe('isNavItemActive', () => {
  it('matches Overview only on the root path', () => {
    expect(isNavItemActive('/', '/')).toBe(true)
    expect(isNavItemActive('/', '/positions')).toBe(false)
  })

  it('keeps the parent highlighted on a detail route', () => {
    expect(isNavItemActive('/positions', '/positions/abc123')).toBe(true)
    expect(isNavItemActive('/positions', '/positions')).toBe(true)
  })

  it('does not match a sibling with a shared prefix', () => {
    expect(isNavItemActive('/log', '/login')).toBe(false)
    expect(isNavItemActive('/fees', '/fees-archive')).toBe(false)
  })
})
