import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import {
  deleteDataset,
  getDataset,
  importDataset,
  listDatasets,
} from '@/services/apiClient'
import { usingApi } from '@/services/dataSource'
import type {
  ImportedDatasetDetail,
  ImportedDatasetMeta,
  ImportPayload,
} from '@/types/importedDataset'

/**
 * Operator-imported datasets (data console). Backed by the API's isolated
 * `datasets` namespace; only reachable when a backend is configured. Details
 * (with rows) are fetched on demand and cached for the session.
 */
export const useImportedDatasetsStore = defineStore('importedDatasets', () => {
  const list = ref<ImportedDatasetMeta[]>([])
  const detailById = shallowRef<Map<string, ImportedDatasetDetail>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const attempted = ref(false)

  const available = usingApi

  async function loadList() {
    if (!available) return
    attempted.value = true
    try {
      list.value = await listDatasets()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  async function loadDetail(id: string): Promise<ImportedDatasetDetail | null> {
    if (detailById.value.has(id)) return detailById.value.get(id) ?? null
    loading.value = true
    try {
      const detail = await getDataset(id)
      const next = new Map(detailById.value)
      next.set(id, detail)
      detailById.value = next
      return detail
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return null
    } finally {
      loading.value = false
    }
  }

  async function importCsv(payload: ImportPayload): Promise<ImportedDatasetMeta> {
    error.value = null
    const meta = await importDataset(payload)
    await loadList()
    return meta
  }

  async function remove(id: string) {
    error.value = null
    await deleteDataset(id)
    const next = new Map(detailById.value)
    next.delete(id)
    detailById.value = next
    await loadList()
  }

  return {
    list,
    detailById,
    loading,
    error,
    attempted,
    available,
    loadList,
    loadDetail,
    importCsv,
    remove,
  }
})
