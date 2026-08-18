import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useOnboardingStore } from '@/stores/onboarding'

describe('onboarding store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts not dismissed on a fresh browser', () => {
    const store = useOnboardingStore()
    expect(store.dismissed).toBe(false)
    expect(store.isOpen).toBe(false)
  })

  it('dismiss closes, marks and persists', () => {
    const store = useOnboardingStore()
    store.open()
    expect(store.isOpen).toBe(true)
    store.dismiss()
    expect(store.isOpen).toBe(false)
    expect(store.dismissed).toBe(true)
    expect(localStorage.getItem('pa-onboarding')).toBe('dismissed')
  })

  it('rehydrates the dismissal from localStorage', () => {
    localStorage.setItem('pa-onboarding', 'dismissed')
    setActivePinia(createPinia())
    expect(useOnboardingStore().dismissed).toBe(true)
  })

  it('can reopen after a dismiss without clearing the flag', () => {
    const store = useOnboardingStore()
    store.dismiss()
    store.open()
    expect(store.isOpen).toBe(true)
    expect(store.dismissed).toBe(true)
  })
})
