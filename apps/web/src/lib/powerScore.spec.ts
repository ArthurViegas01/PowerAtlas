import { describe, expect, it } from 'vitest'

import {
  authorityScore,
  capitalScore,
  CAPITAL_CEIL_BRL,
  CAPITAL_FLOOR_BRL,
  powerScore,
} from '@/lib/powerScore'

describe('capitalScore', () => {
  it('floors ordinary money at 0 and caps the ceiling at 100', () => {
    expect(capitalScore(0)).toBe(0)
    expect(capitalScore(-5)).toBe(0)
    expect(capitalScore(CAPITAL_FLOOR_BRL)).toBe(0)
    expect(capitalScore(CAPITAL_CEIL_BRL)).toBe(100)
    expect(capitalScore(CAPITAL_CEIL_BRL * 10)).toBe(100)
  })

  it('is monotonic and log-scaled between the anchors', () => {
    // A billionaire scores high but below the R$100bi ceiling.
    const billionaire = capitalScore(1e9)
    expect(billionaire).toBeGreaterThan(70)
    expect(billionaire).toBeLessThan(100)
    // A modest saver sits low.
    expect(capitalScore(1e5)).toBeLessThan(20)
    // Each order of magnitude adds a roughly constant amount (log scale).
    expect(capitalScore(1e8)).toBeGreaterThan(capitalScore(1e7))
    expect(capitalScore(1e7)).toBeGreaterThan(capitalScore(1e6))
  })
})

describe('powerScore anchors', () => {
  it('an ordinary 25-year-old salaried person scores near the bottom', () => {
    const comum = powerScore({
      capital: capitalScore(60_000), // renda anual modesta
      authority: authorityScore('cidadaoComum'),
      influence: 2,
    })
    expect(comum).toBeLessThan(10)
  })

  it('a mayor lands mid-scale', () => {
    const prefeito = powerScore({
      capital: capitalScore(2_000_000),
      authority: authorityScore('prefeito'),
      influence: 40,
    })
    expect(prefeito).toBeGreaterThan(25)
    expect(prefeito).toBeLessThan(60)
  })

  it('the presidency scores near the top', () => {
    const presidente = powerScore({
      capital: capitalScore(5_000_000),
      authority: authorityScore('presidencia'),
      influence: 96,
    })
    expect(presidente).toBeGreaterThan(72)
  })

  it('a billionaire with no office still scores high via capital + influence', () => {
    const bilionario = powerScore({
      capital: capitalScore(5e10),
      authority: authorityScore('controladorConglomerado'),
      influence: 80,
    })
    expect(bilionario).toBeGreaterThan(80)
  })

  it('clamps out-of-range pillar inputs', () => {
    expect(powerScore({ capital: 200, authority: 200, influence: 200 })).toBe(100)
    expect(powerScore({ capital: -50, authority: -50, influence: -50 })).toBe(0)
  })
})
