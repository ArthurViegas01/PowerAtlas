import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Open/closed state of the command palette (IA-2). A store instead of local
 * component state so any surface (header, onboarding, future rail) can open
 * it without prop-drilling.
 */
export const usePaletteStore = defineStore('palette', () => {
  const isOpen = ref(false)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  return { isOpen, open, close, toggle }
})
