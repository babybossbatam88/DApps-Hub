import { describe, expect, it } from 'vitest'
import {
  annualisationConfidence,
  classifyFreshness,
  formatAge,
  formatDuration,
} from '@/lib/utils/time'

const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()

describe('classifyFreshness', () => {
  it('classifies by age', () => {
    expect(classifyFreshness(at(12_000), NOW)).toBe('live')
    expect(classifyFreshness(at(2 * 60_000), NOW)).toBe('delayed')
    expect(classifyFreshness(at(15 * 60_000), NOW)).toBe('stale')
  })

  it('reports an error state ahead of any age calculation', () => {
    expect(classifyFreshness(at(1_000), NOW, undefined, true)).toBe('error')
  })

  it('returns unknown for a missing or unparseable timestamp', () => {
    expect(classifyFreshness(null, NOW)).toBe('unknown')
    expect(classifyFreshness(undefined, NOW)).toBe('unknown')
    expect(classifyFreshness('not a date', NOW)).toBe('unknown')
  })

  it('treats a far-future timestamp as clock skew, not as fresh data', () => {
    expect(classifyFreshness(new Date(NOW + 120_000).toISOString(), NOW)).toBe('unknown')
  })

  it('tolerates small forward skew', () => {
    expect(classifyFreshness(new Date(NOW + 5_000).toISOString(), NOW)).toBe('live')
  })

  it('honours custom thresholds', () => {
    expect(classifyFreshness(at(30_000), NOW, { liveMs: 10_000, delayedMs: 20_000 })).toBe('stale')
  })

  it('accepts a Date as well as a string', () => {
    expect(classifyFreshness(new Date(NOW - 5_000), NOW)).toBe('live')
  })
})

describe('formatAge', () => {
  it('scales units with age', () => {
    expect(formatAge(at(12_000), NOW)).toBe('12 sec ago')
    expect(formatAge(at(2 * 60_000), NOW)).toBe('2 min ago')
    expect(formatAge(at(3 * 3_600_000), NOW)).toBe('3 hr ago')
    expect(formatAge(at(5 * 86_400_000), NOW)).toBe('5 d ago')
  })

  it('says "never" rather than "0 sec ago" when there is no timestamp', () => {
    expect(formatAge(null, NOW)).toBe('never')
  })

  it('clamps a future timestamp to zero instead of showing negative age', () => {
    expect(formatAge(new Date(NOW + 10_000).toISOString(), NOW)).toBe('0 sec ago')
  })
})

describe('formatDuration', () => {
  it('formats position age', () => {
    expect(formatDuration(NOW - 42 * 86_400_000, NOW)).toBe('42 d')
    expect(formatDuration(NOW - 3 * 3_600_000, NOW)).toBe('3 hr')
    expect(formatDuration(NOW - 20 * 60_000, NOW)).toBe('20 min')
  })
})

describe('annualisationConfidence', () => {
  it('labels short observation windows as untrustworthy', () => {
    // Annualising six hours of fees is close to meaningless; the label is what
    // stops a 4000% APR from being read as a forecast.
    expect(annualisationConfidence(6 * 3_600_000)).toBe('very-low')
    expect(annualisationConfidence(23.9 * 3_600_000)).toBe('very-low')
  })

  it('applies the documented boundaries', () => {
    expect(annualisationConfidence(1 * 86_400_000)).toBe('low')
    expect(annualisationConfidence(6.9 * 86_400_000)).toBe('low')
    expect(annualisationConfidence(7 * 86_400_000)).toBe('medium')
    expect(annualisationConfidence(29.9 * 86_400_000)).toBe('medium')
    expect(annualisationConfidence(30 * 86_400_000)).toBe('higher')
    expect(annualisationConfidence(400 * 86_400_000)).toBe('higher')
  })
})
