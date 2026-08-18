import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { WarehouseCatalog } from '@/types/catalog'

/**
 * The warehouse schema (public/data/catalog.json) behind the data console's
 * CATÁLOGO view: dimension/fact tables, columns and cross-referencing keys.
 * Loaded on demand the first time the catalog is opened, cached for the session.
 */
export const useCatalogStore = defineStore('catalog', () => {
  const catalog = shallowRef<WarehouseCatalog | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    if (loading.value || catalog.value) return
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/catalog.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as WarehouseCatalog
      if (!Array.isArray(file.tables)) throw new Error('catálogo inválido')
      catalog.value = file
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return { catalog, loading, error, load }
})
