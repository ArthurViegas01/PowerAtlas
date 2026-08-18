import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCompareStore } from '@/stores/compare'

describe('compare store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('pins up to four regions, without duplicates', () => {
    const store = useCompareStore()
    expect(store.add({ id: 'SP', name: 'São Paulo' })).toBe(true)
    expect(store.add({ id: 'SP', name: 'São Paulo' })).toBe(false)
    expect(store.add({ id: 'RS', name: 'Rio Grande do Sul' })).toBe(true)
    expect(store.add({ id: 'MG', name: 'Minas Gerais' })).toBe(true)
    expect(store.add({ id: 'BA', name: 'Bahia' })).toBe(true)
    expect(store.full).toBe(true)
    expect(store.add({ id: 'PR', name: 'Paraná' })).toBe(false)
    expect(store.count).toBe(4)
  })

  it('toggle pins and unpins', () => {
    const store = useCompareStore()
    expect(store.toggle({ id: 'SP', name: 'São Paulo' })).toBe(true)
    expect(store.has('SP')).toBe(true)
    expect(store.toggle({ id: 'SP', name: 'São Paulo' })).toBe(false)
    expect(store.has('SP')).toBe(false)
  })

  it('remove and clear', () => {
    const store = useCompareStore()
    store.add({ id: 'SP', name: 'São Paulo' })
    store.add({ id: 'RS', name: 'Rio Grande do Sul' })
    store.remove('SP')
    expect(store.items.map((i) => i.id)).toEqual(['RS'])
    store.clear()
    expect(store.count).toBe(0)
  })
})
