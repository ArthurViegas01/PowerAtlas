import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMonitoringStore } from '@/stores/monitoring'

const loadMonitoringDocuments = vi.hoisted(() => vi.fn())

vi.mock('@/services/dataSource', () => ({
  usingApi: true,
  loadMonitoringDocuments,
}))

describe('monitoring store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadMonitoringDocuments.mockReset()
  })

  it('loads documents once and caches the attempt', async () => {
    loadMonitoringDocuments.mockResolvedValue([
      {
        id: 1,
        sourceId: 'agencia-brasil',
        sourceName: 'Agência Brasil (EBC)',
        title: 'Manchete',
        url: 'https://example.org/1',
        publishedAt: '2026-07-22T10:00:00Z',
      },
    ])
    const store = useMonitoringStore()
    await store.load()
    await store.load()
    expect(loadMonitoringDocuments).toHaveBeenCalledTimes(1)
    expect(store.documents).toHaveLength(1)
  })

  it('swallows API failures and keeps the list empty', async () => {
    loadMonitoringDocuments.mockRejectedValue(new Error('down'))
    const store = useMonitoringStore()
    await store.load()
    expect(store.documents).toEqual([])
    expect(store.attempted).toBe(true)
  })
})
