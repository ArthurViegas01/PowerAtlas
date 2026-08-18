import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { directionValue, type ComercioFile, type TradeDirection, type TradePartner } from '@/types/comercio'

/**
 * Foreign-trade dataset: real Brazilian exports/imports per partner country
 * and sector (scripts/fetch-comercio.mjs, ~tens of KB). Loaded on demand the
 * first time the world trade arrows are shown; cached for the session. Failed
 * loads stay retryable; success is remembered.
 */
export const useComercioStore = defineStore('comercio', () => {
  const partners = shallowRef<TradePartner[]>([])
  const referenceYear = ref<number | null>(null)
  const currency = ref<string>('USD')
  const source = ref<string | null>(null)
  const totals = ref<{ exp: number; imp: number }>({ exp: 0, imp: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)

  const byIso = computed(() => new Map(partners.value.map((p) => [p.iso, p])))

  /** Partners ranked by flow in `direction`, biggest first (drops zero-flow). */
  function ranked(direction: TradeDirection): TradePartner[] {
    return partners.value
      .filter((p) => directionValue(p, direction) > 0)
      .sort((a, b) => directionValue(b, direction) - directionValue(a, direction))
  }

  // -- annual series (comercio/serie.json, PROD-4 timeline) -------------------
  const serieYears = ref<number[]>([])
  const serieByIso = shallowRef<Map<string, { exp: number[]; imp: number[] }>>(new Map())
  const loadingSerie = ref(false)
  const serieLoaded = computed(() => serieYears.value.length > 0)
  /** Index into serieYears; null = the reference year (full sector detail). */
  const activeYearIndex = ref<number | null>(null)
  const activeYear = computed(() =>
    activeYearIndex.value == null ? null : (serieYears.value[activeYearIndex.value] ?? null),
  )

  let seriePromise: Promise<void> | null = null

  /**
   * Idempotent AND flight-sharing: every awaiting caller resolves only when
   * the fetch lands. A bare in-flight guard would let the second caller (the
   * ?ano= URL replay, racing MapScreen's boot load) proceed with an empty
   * series and silently drop the year.
   */
  function loadSerie(): Promise<void> {
    if (serieLoaded.value) return Promise.resolve()
    if (!seriePromise) {
      loadingSerie.value = true
      seriePromise = (async () => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}data/comercio/serie.json`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const file = (await response.json()) as {
            years: number[]
            partners: [string, number[], number[]][]
          }
          serieYears.value = file.years
          const map = new Map<string, { exp: number[]; imp: number[] }>()
          for (const [iso, exp, imp] of file.partners) map.set(iso, { exp, imp })
          serieByIso.value = map
        } catch (cause) {
          error.value = cause instanceof Error ? cause.message : String(cause)
        } finally {
          loadingSerie.value = false
          seriePromise = null
        }
      })()
    }
    return seriePromise
  }

  function setActiveYearIndex(index: number | null) {
    activeYearIndex.value =
      index != null && index >= 0 && index < serieYears.value.length ? index : null
  }

  async function load() {
    if (loading.value || partners.value.length > 0) return
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/comercio/mundo.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as ComercioFile
      referenceYear.value = file.referenceYear
      currency.value = file.currency
      source.value = file.source
      totals.value = file.totals
      const labelOf = (code: string) => file.sectors[code] ?? code
      partners.value = file.partners.map(([iso, name, lon, lat, exp, imp, sectors]) => ({
        iso,
        name,
        coordinates: [lon, lat] as [number, number],
        exp,
        imp,
        sectors: sectors.map(([code, sExp, sImp]) => ({
          code,
          label: labelOf(code),
          exp: sExp,
          imp: sImp,
        })),
      }))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return {
    partners,
    referenceYear,
    currency,
    source,
    totals,
    loading,
    error,
    byIso,
    ranked,
    load,
    // annual series (PROD-4)
    serieYears,
    serieByIso,
    serieLoaded,
    activeYearIndex,
    activeYear,
    loadSerie,
    setActiveYearIndex,
  }
})
