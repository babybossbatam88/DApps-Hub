'use client'

import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'lpcc:theme'

/**
 * Theme state, read from the DOM rather than held in React.
 *
 * The applied theme is set before first paint by an inline script in the root
 * layout, so the `<html>` element is the source of truth and React only
 * observes it. Holding a second copy in state would let the two disagree — and
 * the disagreement would show as a flash of the wrong theme on every load.
 */

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

// The server has no DOM and no stored preference. Null means "not yet known",
// which callers render neutrally rather than guessing.
function getServerSnapshot(): null {
  return null
}

/** Current theme; `null` during SSR and hydration. */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function applyTheme(next: Theme): void {
  const root = document.documentElement

  // Transitions are enabled only around the switch, so the page does not
  // visibly fade in on every load.
  root.classList.add('theme-transition')
  if (next === 'dark') root.dataset.theme = 'dark'
  else delete root.dataset.theme

  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Private mode: the choice simply does not persist.
  }

  for (const listener of listeners) listener()
  window.setTimeout(() => root.classList.remove('theme-transition'), 200)
}

export function toggleTheme(current: Theme | null): void {
  applyTheme(current === 'dark' ? 'light' : 'dark')
}
