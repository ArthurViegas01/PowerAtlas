import { defineStore } from 'pinia'
import { ref } from 'vue'

/** A named analysis: the query string is the whole payload (IA-3). */
export interface SavedView {
  id: string
  name: string
  /** URLSearchParams-style string, e.g. "region=SP&view=demografia". */
  query: string
  savedAt: string
}

const STORAGE_KEY = 'pa-saved-views'

/**
 * Named analyses persisted in localStorage (IA-3). The embryo of the SaaS
 * seam (PROD-7): with accounts, this store syncs to the backend and nothing
 * else changes. Surfaced today as a palette group.
 */
export const useSavedViewsStore = defineStore('savedViews', () => {
  const views = ref<SavedView[]>(read())

  function read(): SavedView[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (view): view is SavedView =>
          typeof view === 'object' &&
          view !== null &&
          typeof (view as SavedView).id === 'string' &&
          typeof (view as SavedView).name === 'string' &&
          typeof (view as SavedView).query === 'string',
      )
    } catch {
      return []
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views.value))
  }

  function save(name: string, query: string): SavedView {
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: name.trim(),
      query,
      savedAt: new Date().toISOString(),
    }
    views.value = [view, ...views.value]
    persist()
    return view
  }

  function remove(id: string) {
    views.value = views.value.filter((view) => view.id !== id)
    persist()
  }

  return { views, save, remove }
})
