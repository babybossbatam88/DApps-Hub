'use client'

import { useSyncExternalStore } from 'react'

/**
 * A single shared clock for every freshness badge on the page.
 *
 * Two things this solves. First, hydration: the server has no meaningful "now"
 * for a client-relative age, so `getServerSnapshot` returns `null` and callers
 * render a neutral placeholder until hydration completes. Second, cost: a
 * dashboard can show dozens of freshness badges, and one shared interval is
 * better than dozens of independent timers drifting against each other.
 */

const TICK_MS = 5_000

let current = Date.now()
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (timer === null) {
    timer = setInterval(() => {
      current = Date.now()
      for (const l of listeners) l()
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

// Must return a cached value: returning Date.now() on every call would make
// React see a new snapshot on each render and loop forever.
function getSnapshot(): number {
  return current
}

function getServerSnapshot(): null {
  return null
}

/** Current time in ms on the client; `null` during SSR and hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
