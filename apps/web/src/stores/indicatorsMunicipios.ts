import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { MunicipioIndicador, MunicipiosAllFile } from '@/types/indicators'

/**
 * Consolidated all-municipality indicators (área/densidade/população/PIB) for
 * the data console's "INDICADORES MUNICÍPIO" dataset. Loaded on demand the
 * first time that tab is opened (public/data/indicators/municipios-all.json,
 * compiled from the warehouse), cached for the session. Console-only: the map
 * never needs it, so it stays out of the initial load.
 */
export const useIndicatorsMunicipiosStore = defineStore('indicatorsMunicipios', () => {
  const municipios = shallowRef<MunicipioIndicador[]>([])
  const censusYear = ref<number | null>(null)
  const gdpYear = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    if (loading.value || municipios.value.length > 0) return
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/indicators/municipios-all.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as MunicipiosAllFile
      // Guard the SPA 200-fallback: a real payload has the `municipios` array.
      if (!Array.isArray(file.municipios)) throw new Error('payload inválido')
      censusYear.value = file.censusYear
      gdpYear.value = file.gdpYear
      municipios.value = file.municipios.map(([codigo, population, areaKm2, density, gdp]) => ({
        codigo,
        population,
        areaKm2,
        density,
        gdpBrlThousands: gdp,
      }))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return { municipios, censusYear, gdpYear, loading, error, load }
})
