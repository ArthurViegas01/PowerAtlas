import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'pa-onboarding'

/**
 * First-visit onboarding state (PROD-5). Dismissal persists in localStorage
 * so the overlay never blocks the map again after the first dismiss; the
 * command palette can reopen it on demand (VER INTRODUCAO).
 */
export const useOnboardingStore = defineStore('onboarding', () => {
  function read(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dismissed'
    } catch {
      return true // storage-less contexts never nag
    }
  }

  const dismissed = ref(read())
  const isOpen = ref(false)

  function open() {
    isOpen.value = true
  }

  function dismiss() {
    isOpen.value = false
    dismissed.value = true
    try {
      localStorage.setItem(STORAGE_KEY, 'dismissed')
    } catch {
      // best effort: the session still stays dismissed via the ref
    }
  }

  return { dismissed, isOpen, open, dismiss }
})
