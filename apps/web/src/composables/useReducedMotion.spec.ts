import { describe, expect, it } from 'vitest'

import { useReducedMotion } from '@/composables/useReducedMotion'
import { setReducedMotion } from '../../test/setup'

describe('useReducedMotion', () => {
  it('reads the initial matchMedia state', () => {
    setReducedMotion(true)
    const reduced = useReducedMotion()
    expect(reduced.value).toBe(true)
    setReducedMotion(false)
  })

  it('reacts to media-query changes', () => {
    setReducedMotion(false)
    const reduced = useReducedMotion()
    expect(reduced.value).toBe(false)
    setReducedMotion(true)
    expect(reduced.value).toBe(true)
    setReducedMotion(false)
  })
})
