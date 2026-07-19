import { vi } from 'vitest'

/**
 * jsdom ships no matchMedia. Install a controllable stub so
 * `useReducedMotion` can be exercised end to end. Tests flip the flag with
 * `setReducedMotion(true|false)` before instantiating the composable.
 */
let reduced = false
const listeners = new Set<(e: MediaQueryListEvent) => void>()

export function setReducedMotion(value: boolean): void {
  reduced = value
  const event = { matches: value } as MediaQueryListEvent
  for (const listener of listeners) listener(event)
}

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: reduced,
  media: query,
  onchange: null,
  addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
  removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
  removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  dispatchEvent: () => true,
}))

// Reset to "motion allowed" before each test file's cases.
setReducedMotion(false)
