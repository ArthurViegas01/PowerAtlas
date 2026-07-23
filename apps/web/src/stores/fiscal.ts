import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { FiscalFile, FiscalMunicipio } from '@/types/fiscal'

/**
 * Fiscal flow dataset: real federal collection, transfers and amendment
 * money per município (scripts/build-fiscal.mjs, ~300 KB). Loaded on demand
 * the first time the demographic view opens; cached for the session.
 */
export const useFiscalStore = defineStore('fiscal', () => {
  const byCodigo = shallowRef<Map<string, FiscalMunicipio>>(new Map())
  const referenceYear = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    if (loading.value || byCodigo.value.size > 0) return
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/fiscal/municipios.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as FiscalFile
      referenceYear.value = file.referenceYear
      byCodigo.value = new Map(
        file.municipios.map(
          ([codigo, arrecadacao, previdencia, ir, ipi, transferencias, fpm, fundeb, emendas]) => [
            codigo,
            { codigo, arrecadacao, previdencia, ir, ipi, transferencias, fpm, fundeb, emendas },
          ],
        ),
      )
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return { byCodigo, referenceYear, loading, error, load }
})
