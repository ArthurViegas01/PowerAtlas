import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type {
  MunicipioIndicatorsFile,
  RegionIndicators,
  UfIndicatorsFile,
} from '@/types/indicators'

/**
 * Factual IBGE indicators (population, area, density, GDP) from the static
 * JSON under public/data/indicators (see scripts/fetch-indicators.mjs).
 * Context data only: the power rankings never come from here. The UF file is
 * loaded once at boot; municipal files load on demand per state, mirroring
 * the municipal-mesh pattern in mapLayers.
 */
export const useIndicatorsStore = defineStore('indicators', () => {
  const ufFile = shallowRef<UfIndicatorsFile | null>(null)
  const municipiosByUf = shallowRef<Map<string, MunicipioIndicatorsFile>>(new Map())
  // Non-reactive: fetches already attempted (successes and misses), no retry.
  let ufAttempted = false
  const municipioAttempts = new Set<string>()

  const sourceLabel = computed(() => {
    const meta = ufFile.value
    return meta ? `IBGE · CENSO ${meta.censusYear} · PIB ${meta.gdpYear}` : 'IBGE'
  })

  /**
   * Fetch a static data file, tolerating SPA hosting where a missing path
   * falls back to index.html with HTTP 200 (same guard as the municipal
   * meshes): anything that does not parse as JSON carrying the expected root
   * key is treated as absent. Network errors propagate so callers can allow
   * a retry.
   */
  async function fetchDataFile<T extends object>(file: string, rootKey: string): Promise<T | null> {
    const response = await fetch(`${import.meta.env.BASE_URL}data/indicators/${file}`)
    if (!response.ok) return null
    try {
      const data = JSON.parse(await response.text()) as T
      return data && typeof data === 'object' && rootKey in data ? data : null
    } catch {
      return null
    }
  }

  async function loadUf() {
    if (ufAttempted) return
    ufAttempted = true
    try {
      ufFile.value = await fetchDataFile<UfIndicatorsFile>('uf.json', 'regions')
    } catch {
      ufAttempted = false // network error: a later call may retry
    }
  }

  async function loadMunicipios(uf: string) {
    if (uf === 'BR' || municipioAttempts.has(uf)) return
    municipioAttempts.add(uf)
    try {
      const file = await fetchDataFile<MunicipioIndicatorsFile>(
        `municipios/${uf}.json`,
        'municipios',
      )
      if (!file) return
      const next = new Map(municipiosByUf.value)
      next.set(uf, file)
      municipiosByUf.value = next
    } catch {
      municipioAttempts.delete(uf) // network error: allow a later retry
    }
  }

  function forRegion(regionId: string | null): RegionIndicators | null {
    return regionId ? (ufFile.value?.regions[regionId] ?? null) : null
  }

  function forMunicipio(uf: string | null, codigo: string | null): RegionIndicators | null {
    if (!uf || !codigo) return null
    return municipiosByUf.value.get(uf)?.municipios[codigo] ?? null
  }

  return { ufFile, sourceLabel, loadUf, loadMunicipios, forRegion, forMunicipio }
})
