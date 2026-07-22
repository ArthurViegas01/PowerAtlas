import { describe, expect, it } from 'vitest'

import { over, overVoid, type RGBA } from '@/lib/palette'

describe('palette compositing', () => {
  it('over() blends by the foreground alpha and returns an opaque color', () => {
    const bg: RGBA = [0, 0, 0, 255]
    expect(over([255, 255, 255, 255], bg)).toEqual([255, 255, 255, 255])
    expect(over([255, 255, 255, 0], bg)).toEqual([0, 0, 0, 255])
    // 50% white over black ≈ mid gray, always opaque.
    const half = over([255, 255, 255, 128], bg)
    expect(half[0]).toBeGreaterThan(120)
    expect(half[0]).toBeLessThan(136)
    expect(half[3]).toBe(255)
  })

  it('overVoid() keeps the perceived color but makes the pixel opaque', () => {
    const result = overVoid([61, 225, 255, 42])
    expect(result[3]).toBe(255)
    // A faint cyan over the near-black void stays a dark cyan-ish tone.
    expect(result[0]).toBeLessThan(61)
    expect(result[2]).toBeGreaterThan(result[0])
  })
})
