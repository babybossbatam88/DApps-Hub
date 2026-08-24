/** Freshness buckets rendered by <DataFreshness />. */
export type FreshnessLevel = 'live' | 'delayed' | 'stale' | 'error' | 'unknown'

export interface FreshnessThresholds {
  /** Below this age (ms) a value is "Live". */
  liveMs: number
  /** Below this age (ms) a value is "Delayed"; above it, "Stale". */
  delayedMs: number
}

export const DEFAULT_FRESHNESS: FreshnessThresholds = {
  liveMs: 60_000,
  delayedMs: 5 * 60_000,
}

/**
 * Classify how fresh an observation is. Pure: `now` is injected so this is
 * testable and so server and client agree.
 */
export function classifyFreshness(
  observedAt: string | Date | null | undefined,
  now: number,
  thresholds: FreshnessThresholds = DEFAULT_FRESHNESS,
  hasError = false,
): FreshnessLevel {
  if (hasError) return 'error'
  if (!observedAt) return 'unknown'
  const ts = observedAt instanceof Date ? observedAt.getTime() : Date.parse(observedAt)
  if (Number.isNaN(ts)) return 'unknown'
  const age = now - ts
  // A timestamp from the future means clock skew, not freshness.
  if (age < -30_000) return 'unknown'
  if (age <= thresholds.liveMs) return 'live'
  if (age <= thresholds.delayedMs) return 'delayed'
  return 'stale'
}

/** "12 sec ago", "2 min ago", "3 hr ago", "5 d ago". */
export function formatAge(
  observedAt: string | Date | null | undefined,
  now: number,
): string {
  if (!observedAt) return 'never'
  const ts = observedAt instanceof Date ? observedAt.getTime() : Date.parse(observedAt)
  if (Number.isNaN(ts)) return 'unknown'
  const seconds = Math.max(0, Math.round((now - ts) / 1000))
  if (seconds < 60) return `${seconds} sec ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} d ago`
}

/** Position age, e.g. "42 d" or "3 hr". */
export function formatDuration(fromMs: number, toMs: number): string {
  const ms = Math.max(0, toMs - fromMs)
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days} d`
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours} hr`
  const minutes = Math.floor(ms / 60_000)
  return `${minutes} min`
}

/**
 * Confidence label for an annualised figure derived from a short observation
 * window. Annualising six hours of fees is close to meaningless, and the UI is
 * required to say so.
 */
export function annualisationConfidence(
  windowMs: number,
): 'very-low' | 'low' | 'medium' | 'higher' {
  const days = windowMs / 86_400_000
  if (days < 1) return 'very-low'
  if (days < 7) return 'low'
  if (days < 30) return 'medium'
  return 'higher'
}
