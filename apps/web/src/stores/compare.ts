import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** A pinned region in the comparison tray (PROD-2). */
export interface CompareItem {
  id: string
  name: string
}

export const MAX_COMPARE = 4

/**
 * Comparison tray (PROD-2): up to four regions pinned from the map panel,
 * the palette or the /comparar screen itself. Session-scoped on purpose;
 * a comparison is shareable through /comparar?ids=SP,RS instead.
 */
export const useCompareStore = defineStore('compare', () => {
  const items = ref<CompareItem[]>([])

  const count = computed(() => items.value.length)
  const full = computed(() => items.value.length >= MAX_COMPARE)

  function has(id: string): boolean {
    return items.value.some((item) => item.id === id)
  }

  /** Returns false when the tray is full or the region is already pinned. */
  function add(item: CompareItem): boolean {
    if (has(item.id) || full.value) return false
    items.value = [...items.value, item]
    return true
  }

  function remove(id: string) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function toggle(item: CompareItem): boolean {
    if (has(item.id)) {
      remove(item.id)
      return false
    }
    return add(item)
  }

  function clear() {
    items.value = []
  }

  return { items, count, full, has, add, remove, toggle, clear }
})
