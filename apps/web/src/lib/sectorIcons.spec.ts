import { describe, expect, it } from 'vitest'

import {
  AGRO_SHARE_FLOOR,
  ICON_COLOR,
  iconForChapter,
  isAmazoniaLegal,
  pickAgroCommodity,
  sectorIconSegments,
  type MeshKey,
} from '@/lib/sectorIcons'

const NATIONAL = { soja: 100_000, cafe: 10_000, bovino: 1_000_000 }

describe('pickAgroCommodity', () => {
  it('vence quem tem a maior fatia NACIONAL da propria commodity', () => {
    // 1% da soja nacional vs 5% do cafe nacional: cafe vence mesmo valendo menos.
    expect(pickAgroCommodity({ soja: 1000, cafe: 500, bovino: 0 }, NATIONAL)).toBe('coffee')
    expect(pickAgroCommodity({ soja: 5000, cafe: 100, bovino: 0 }, NATIONAL)).toBe('soy')
    expect(pickAgroCommodity({ soja: 0, cafe: 0, bovino: 50_000 }, NATIONAL)).toBe('cattle')
  })

  it('abaixo do piso (ou sem dado) cai no silo generico', () => {
    const below = Math.floor(NATIONAL.soja * AGRO_SHARE_FLOOR * 0.5)
    expect(pickAgroCommodity({ soja: below, cafe: 0, bovino: 0 }, NATIONAL)).toBeNull()
    expect(pickAgroCommodity(undefined, NATIONAL)).toBeNull()
  })
})

describe('isAmazoniaLegal', () => {
  it('as oito UFs integrais entram, o resto nao', () => {
    expect(isAmazoniaLegal('5107925', -55.7)).toBe(true) // MT (Sorriso)
    expect(isAmazoniaLegal('1507300', -51.9)).toBe(true) // PA (Sao Felix)
    expect(isAmazoniaLegal('3550308', -46.6)).toBe(false) // SP
  })

  it('o MA divide no meridiano 44', () => {
    expect(isAmazoniaLegal('2105500', -45.2)).toBe(true) // oeste
    expect(isAmazoniaLegal('2111300', -43.2)).toBe(false) // Sao Luis, leste
  })
})

describe('iconForChapter (commodities finas)', () => {
  it('capitulos com icone proprio vem antes dos baldes', () => {
    expect(iconForChapter('12')).toBe('soy')
    expect(iconForChapter('09')).toBe('coffee')
    expect(iconForChapter('02')).toBe('cattle')
    expect(iconForChapter('44')).toBe('tree')
    expect(iconForChapter('10')).toBe('silo')
    expect(iconForChapter('26')).toBe('mine')
  })
})

describe('geometria dos arquetipos novos', () => {
  const NEW_MESHES: MeshKey[] = ['soy', 'cattle', 'coffee', 'tree']

  it('projetam segmentos finitos (sem NaN) e tem cor propria', () => {
    for (const mesh of NEW_MESHES) {
      const segments = sectorIconSegments([
        { position: [-55.7, -12.5], mesh, color: ICON_COLOR[mesh], scale: 26000 },
      ])
      expect(segments.length).toBeGreaterThan(20)
      for (const s of segments) {
        for (const v of [...s.source, ...s.target]) expect(Number.isFinite(v)).toBe(true)
      }
      expect(ICON_COLOR[mesh]).toHaveLength(3)
    }
  })

  it('todos tem arestas verticais (regra do LineLayer)', () => {
    for (const mesh of NEW_MESHES) {
      const segments = sectorIconSegments([
        { position: [-55.7, -12.5], mesh, color: ICON_COLOR[mesh], scale: 26000 },
      ])
      const verticals = segments.filter(
        (s) => s.source[0] === s.target[0] && s.source[1] === s.target[1] && s.source[2] !== s.target[2],
      )
      expect(verticals.length, `${mesh} sem arestas verticais`).toBeGreaterThan(0)
    }
  })
})
