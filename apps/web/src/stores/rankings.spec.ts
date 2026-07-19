import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the data source seam so the store is tested in isolation from the mock
// loader / API client (and from import.meta.env / import.meta.glob).
const { loadMock, FIXTURE } = vi.hoisted(() => {
  const fixture = {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    disclaimer: 'SIMULADO',
    regions: [
      {
        id: 'BR', name: 'Brasil', kind: 'country',
        capital: { name: 'Brasília', coordinates: [-47.9, -15.8] },
        updatedAt: '2026-01-01T00:00:00Z', official: [], hidden: [],
      },
      {
        id: 'SP', name: 'São Paulo', kind: 'state',
        capital: { name: 'São Paulo', coordinates: [-46.6, -23.5] },
        updatedAt: '2026-01-01T00:00:00Z', official: [], hidden: [],
      },
    ],
    links: [{ id: 'l1', from: 'BR', to: 'SP', strength: 0.5, dimension: 'official' }],
    ambientSignals: [{ coordinates: [-46.6, -23.5], weight: 1 }],
  }
  return { loadMock: vi.fn(async () => fixture), FIXTURE: fixture }
})

vi.mock('@/services/dataSource', () => ({ loadRegionPowerData: loadMock }))

import { useRankingsStore } from '@/stores/rankings'

describe('rankings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadMock.mockClear()
    loadMock.mockResolvedValue(FIXTURE)
  })

  it('loads data and derives region lookups', async () => {
    const r = useRankingsStore()
    expect(r.ready).toBe(false)
    await r.load()
    expect(r.ready).toBe(true)
    expect(r.dataRegionIds).toEqual(['BR', 'SP'])
    expect(r.regionById('SP')?.name).toBe('São Paulo')
    expect(r.regionById('ZZ')).toBeNull()
    expect(r.regionById(null)).toBeNull()
    expect(r.links).toHaveLength(1)
    expect(r.ambientSignals).toHaveLength(1)
    expect(r.disclaimer).toBe('SIMULADO')
  })

  it('load() only fetches once', async () => {
    const r = useRankingsStore()
    await r.load()
    await r.load()
    expect(loadMock).toHaveBeenCalledTimes(1)
  })

  it('captures loader errors and stays not-ready', async () => {
    loadMock.mockRejectedValueOnce(new Error('boom'))
    const r = useRankingsStore()
    await r.load()
    expect(r.error).toBe('boom')
    expect(r.ready).toBe(false)
    expect(r.loading).toBe(false)
  })
})
