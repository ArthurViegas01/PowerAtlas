import { defineStore } from 'pinia'
import { ref } from 'vue'

import { loadMonitoringDocuments } from '@/services/dataSource'
import type { MonitoringDocument } from '@/types/monitoring'

/**
 * Latest headlines ingested from the allowlisted institutional feeds (F5b).
 * Empty in offline mock mode or on API failure — the panel hides itself, the
 * HUD never breaks over a monitoring hiccup.
 */
export const useMonitoringStore = defineStore('monitoring', () => {
  const documents = ref<MonitoringDocument[]>([])
  const attempted = ref(false)

  async function load(limit = 8) {
    if (attempted.value) return
    attempted.value = true
    try {
      documents.value = await loadMonitoringDocuments(limit)
    } catch {
      documents.value = []
    }
  }

  return { documents, attempted, load }
})
