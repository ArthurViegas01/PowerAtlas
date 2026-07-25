import { defineStore } from 'pinia'
import { ref } from 'vue'

import { loadStats, usingApi } from '@/services/dataSource'
import type { StatsResponse } from '@/types/stats'

/**
 * Database + pipeline stats for the data console's overview panel. Null in
 * offline mock mode or on API failure, so the panel hides itself and the
 * console never breaks over a backend hiccup. Loaded once per session.
 */
export const useStatsStore = defineStore('stats', () => {
  const data = ref<StatsResponse | null>(null)
  const loading = ref(false)
  const attempted = ref(false)

  /** True only when a backend is configured (VITE_API_URL). */
  const available = usingApi

  async function load() {
    if (attempted.value || !available) return
    attempted.value = true
    loading.value = true
    try {
      data.value = await loadStats()
    } catch {
      data.value = null
    } finally {
      loading.value = false
    }
  }

  return { data, loading, attempted, available, load }
})
