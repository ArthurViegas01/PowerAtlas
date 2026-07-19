import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { loadRegionPowerData } from '@/services/dataSource'
import type { PowerRegion, RegionPowerData } from '@/types/power-entity'

/** Loaded dataset (mock by default, or the FastAPI backend when VITE_API_URL is set). */
export const useRankingsStore = defineStore('rankings', () => {
  const data = shallowRef<RegionPowerData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const regionsById = computed(() => {
    const byId = new Map<string, PowerRegion>()
    for (const region of data.value?.regions ?? []) byId.set(region.id, region)
    return byId
  })

  const dataRegionIds = computed(() => [...regionsById.value.keys()])
  const links = computed(() => data.value?.links ?? [])
  const ambientSignals = computed(() => data.value?.ambientSignals ?? [])
  const disclaimer = computed(() => data.value?.disclaimer ?? '')
  const ready = computed(() => data.value !== null)

  function regionById(id: string | null): PowerRegion | null {
    return id ? (regionsById.value.get(id) ?? null) : null
  }

  async function load() {
    if (loading.value || data.value) return
    loading.value = true
    error.value = null
    try {
      data.value = await loadRegionPowerData()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    ready,
    regionsById,
    dataRegionIds,
    links,
    ambientSignals,
    disclaimer,
    regionById,
    load,
  }
})
