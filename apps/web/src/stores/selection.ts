import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface ScreenPoint {
  x: number
  y: number
}

/** Which region the operator is inspecting, plus hover/ping UI state. */
export const useSelectionStore = defineStore('selection', () => {
  const selectedId = ref<string | null>(null)
  const selectedName = ref<string | null>(null)
  const hoveredId = ref<string | null>(null)
  const hoveredName = ref<string | null>(null)
  /** Screen position of the last selection click — anchors the scan ping. */
  const lastPing = ref<ScreenPoint | null>(null)
  /** Monotonic counter; MapScanEffect watches it to replay the sweep. */
  const pingSeq = ref(0)

  const hasSelection = computed(() => selectedId.value !== null)

  function select(id: string, name: string, point?: ScreenPoint) {
    if (selectedId.value === id) return
    selectedId.value = id
    selectedName.value = name
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  function clear() {
    selectedId.value = null
    selectedName.value = null
  }

  function setHovered(id: string | null, name: string | null = null) {
    hoveredId.value = id
    hoveredName.value = name
  }

  return {
    selectedId,
    selectedName,
    hoveredId,
    hoveredName,
    lastPing,
    pingSeq,
    hasSelection,
    select,
    clear,
    setHovered,
  }
})
