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

  return { partners, referenceYear, currency, source, totals, loading, error, byIso, ranked, load }
})
