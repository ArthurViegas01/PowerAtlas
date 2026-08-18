import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { PartidosFile } from '@/types/partidos'

/**
 * Partido do prefeito eleito por município (TSE 2024), para a camada política
 * do mapa e os agregados do card nacional. Um arquivo estático, carregado sob
 * demanda quando a camada é ligada e cacheado para a sessão. Falha de carga
 * fica retryável; sucesso é lembrado.
 */
export const usePartidosStore = defineStore('partidos', () => {
  const byCodigo = shallowRef<Map<string, string>>(new Map())
  const referenceYear = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const ready = computed(() => byCodigo.value.size > 0)

  /** Município count per party sigla — feeds the national "dominant party" tally. */
  const countBySigla = computed(() => {
    const counts = new Map<string, number>()
    for (const sigla of byCodigo.value.values()) {
      counts.set(sigla, (counts.get(sigla) ?? 0) + 1)
    }
    return counts
  })

  /** Parties ranked by how many municípios they govern (most first). */
  const ranking = computed(() =>
    [...countBySigla.value.entries()]
      .map(([sigla, count]) => ({ sigla, count }))
      .sort((a, b) => b.count - a.count),
  )

  function partyOf(codigo: string | null): string | null {
    return codigo ? (byCodigo.value.get(codigo) ?? null) : null
  }

  async function load() {
    if (loading.value || ready.value) return
    loading.value = true
    error.value = null
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/political/municipios-partidos.json`,
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      let file: PartidosFile
      try {
        file = JSON.parse(text) as PartidosFile
      } catch {
        // SPA hosting can answer a missing path with index.html (200) — treat a
        // non-JSON body as "no dataset yet" instead of crashing the layer.
        return
      }
      if (!file?.byCodigo) return
      referenceYear.value = file.referenceYear ?? null
      byCodigo.value = new Map(Object.entries(file.byCodigo))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return {
    byCodigo,
    referenceYear,
    loading,
    error,
    ready,
    countBySigla,
    ranking,
    partyOf,
    load,
  }
})
