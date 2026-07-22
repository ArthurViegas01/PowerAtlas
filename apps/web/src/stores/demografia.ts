import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { DemografiaFile, DemografiaMunicipio } from '@/types/demografia'

/**
 * Demographic-view dataset: centroid + population + PIB for all 5.570
 * municípios, loaded on demand the first time the view opens (~310 KB).
 * Failed loads stay retryable; success is cached for the session.
 */
export const useDemografiaStore = defineStore('demografia', () => {
  const municipios = shallowRef<DemografiaMunicipio[]>([])
  const censusYear = ref<number | null>(null)
  const gdpYear = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    if (loading.value || municipios.value.length > 0) return
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/demografia/municipios.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as DemografiaFile
      censusYear.value = file.censusYear
      gdpYear.value = file.gdpYear
      municipios.value = file.municipios.map(
        ([codigo, name, lon, lat, population, gdpBrlThousands]) => ({
          codigo,
          name,
          coordinates: [lon, lat] as [number, number],
          population,
          gdpBrlThousands,
        }),
      )
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return { municipios, censusYear, gdpYear, loading, error, load }
})
