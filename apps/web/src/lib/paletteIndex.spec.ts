import { describe, expect, it } from 'vitest'

import {
  GROUP_ORDER,
  normalize,
  rankEntries,
  scoreEntry,
  type PaletteEntry,
} from '@/lib/paletteIndex'

const entry = (over: Partial<PaletteEntry>): PaletteEntry => ({
  key: over.key ?? over.label ?? 'k',
  group: 'region',
  label: 'SÃO PAULO',
  action: { kind: 'region', id: 'SP', name: 'São Paulo' },
  ...over,
})

describe('normalize', () => {
  it('strips diacritics and case', () => {
    expect(normalize('São Paulo')).toBe('sao paulo')
    expect(normalize('  INFLUÊNCIA  ')).toBe('influencia')
  })
})

describe('scoreEntry', () => {
  const sp = entry({ keywords: ['SP'], sublabel: 'UF · SP' })

  it('ranks prefix, word-start, substring and keyword in that order', () => {
    expect(scoreEntry(sp, 'sao')).toBe(0)
    expect(scoreEntry(sp, 'pau')).toBe(1)
    expect(scoreEntry(sp, 'aul')).toBe(2)
    expect(scoreEntry(sp, 'sp')).toBe(3)
  })

  it('returns null when nothing matches', () => {
    expect(scoreEntry(sp, 'xyz')).toBeNull()
  })

  it('treats an empty query as a universal match', () => {
    expect(scoreEntry(sp, '')).toBe(0)
    expect(scoreEntry(sp, '   ')).toBe(0)
  })
})

describe('rankEntries', () => {
  const entries: PaletteEntry[] = [
    entry({ key: 'c1', group: 'command', label: 'VISÃO NACIONAL [BR]' }),
    entry({ key: 'c2', group: 'command', label: 'ALINHAR AO NORTE' }),
    entry({ key: 'r1', label: 'SÃO PAULO', keywords: ['SP'] }),
    entry({ key: 'r2', label: 'SANTA CATARINA', keywords: ['SC'] }),
    entry({ key: 'e1', group: 'entity', label: 'SANTUÁRIO ALFA', sublabel: 'SP · OFICIAL' }),
  ]

  it('keeps insertion order on an empty query', () => {
    const groups = rankEntries(entries, '')
    expect(groups[0].group).toBe('command')
    expect(groups[0].entries.map((e) => e.key)).toEqual(['c1', 'c2'])
  })

  it('breaks group ties by GROUP_ORDER and ranks inside each group', () => {
    const groups = rankEntries(entries, 'san')
    expect(groups.map((g) => g.group)).toEqual(
      GROUP_ORDER.filter((g) => groups.some((x) => x.group === g)),
    )
    const regions = groups.find((g) => g.group === 'region')
    expect(regions?.entries[0].key).toBe('r2')
  })

  it('puts the best-scoring group first, not the fixed order', () => {
    const withGlobal = [
      ...entries,
      entry({ key: 'c3', group: 'command', label: 'VISÃO GLOBAL' }),
    ]
    const groups = rankEntries(withGlobal, 'sao')
    expect(groups[0].group).toBe('region')
    expect(groups[groups.length - 1].group).toBe('command')
  })

  it('caps each group at perGroup entries', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      entry({ key: `r${i}`, label: `REGIÃO ${i}` }),
    )
    const groups = rankEntries(many, 'regi', 4)
    expect(groups[0].entries).toHaveLength(4)
  })

  it('drops groups with no match', () => {
    const groups = rankEntries(entries, 'norte')
    expect(groups).toHaveLength(1)
    expect(groups[0].group).toBe('command')
  })
})
