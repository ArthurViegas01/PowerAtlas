import { describe, expect, it } from 'vitest'

import {
  formatAreaKm2,
  formatDensity,
  formatGdpThousands,
  formatInt,
  formatPeopleCompact,
  NOT_AVAILABLE,
} from '@/lib/format'

// Intl emits non-breaking spaces; normalize so assertions stay readable.
const plain = (value: string) => value.replace(/[  ]/g, " ")

describe('format', () => {
  it('formats integers with pt-BR grouping', () => {
    expect(formatInt(203_080_756)).toBe('203.080.756')
    expect(formatInt(0)).toBe('0')
  })

  it('formats area and density with units', () => {
    expect(plain(formatAreaKm2(1521.202))).toBe('1.521 km²')
    expect(plain(formatDensity(23.86))).toBe('23,9 hab/km²')
  })

  it('formats GDP from thousands of BRL in compact currency', () => {
    const brazil2023 = plain(formatGdpThousands(10_943_345_439))
    expect(brazil2023).toContain('R$')
    expect(brazil2023).toContain('10,9')
  })

  it('formats compact population for the tooltip', () => {
    const compact = plain(formatPeopleCompact(44_411_238))
    expect(compact).toContain('44,4')
    expect(compact).toContain('hab')
  })

  it('falls back to N/D for suppressed values', () => {
    expect(formatInt(null)).toBe(NOT_AVAILABLE)
    expect(formatAreaKm2(null)).toBe(NOT_AVAILABLE)
    expect(formatDensity(null)).toBe(NOT_AVAILABLE)
    expect(formatGdpThousands(null)).toBe(NOT_AVAILABLE)
    expect(formatPeopleCompact(null)).toBe(NOT_AVAILABLE)
  })
})
