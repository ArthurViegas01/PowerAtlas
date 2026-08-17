import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSavedViewsStore } from '@/stores/savedViews'

describe('savedViews store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves, persists and removes named views', () => {
    const store = useSavedViewsStore()
    const view = store.save('SP demografia', 'region=SP&view=demografia')
    expect(store.views).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('pa-saved-views') ?? '[]')).toHaveLength(1)
    store.remove(view.id)
    expect(store.views).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('pa-saved-views') ?? '[]')).toHaveLength(0)
  })

  it('rehydrates from localStorage on init', () => {
    const stored = [
      { id: 'a', name: 'Guardada', query: 'region=RS', savedAt: '2026-08-17T00:00:00Z' },
    ]
    localStorage.setItem('pa-saved-views', JSON.stringify(stored))
    setActivePinia(createPinia())
    const store = useSavedViewsStore()
    expect(store.views).toHaveLength(1)
    expect(store.views[0].name).toBe('Guardada')
  })

  it('survives corrupted storage', () => {
    localStorage.setItem('pa-saved-views', '{nao é json')
    setActivePinia(createPinia())
    expect(useSavedViewsStore().views).toEqual([])
    localStorage.setItem('pa-saved-views', JSON.stringify([{ solto: true }, null, 'x']))
    setActivePinia(createPinia())
    expect(useSavedViewsStore().views).toEqual([])
  })
})
