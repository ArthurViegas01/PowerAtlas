import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface ScreenPoint {
  x: number
  y: number
}

/** A country from the "em breve" world backdrop (not yet mapped). */
export interface WorldRegionRef {
  iso: string
  name: string
}

export type CameraTarget = 'national' | 'global'

/** Which region the operator is inspecting, plus hover/ping/camera UI state. */
export const useSelectionStore = defineStore('selection', () => {
  const selectedId = ref<string | null>(null)
  const selectedName = ref<string | null>(null)
  const hoveredId = ref<string | null>(null)
  const hoveredName = ref<string | null>(null)
  /** World-country hover on the backdrop layer. */
  const hoveredWorld = ref<WorldRegionRef | null>(null)
  /** World country clicked — opens the "região não mapeada" panel. */
  const lockedWorld = ref<WorldRegionRef | null>(null)
  /** Screen position of the last selection click — anchors the scan ping. */
  const lastPing = ref<ScreenPoint | null>(null)
  /** Monotonic counter; MapScanEffect watches it to replay the sweep. */
  const pingSeq = ref(0)
  /** Imperative camera bus — MapView watches `seq` and flies to `target`. */
  const cameraRequest = ref<{ target: CameraTarget; seq: number }>({
    target: 'national',
    seq: 0,
  })

  const hasSelection = computed(() => selectedId.value !== null)
  const hasPanel = computed(() => selectedId.value !== null || lockedWorld.value !== null)

  function select(id: string, name: string, point?: ScreenPoint) {
    if (selectedId.value === id) return
    lockedWorld.value = null
    selectedId.value = id
    selectedName.value = name
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Click on a not-yet-mapped country: swap any open panel for the lock panel. */
  function lockWorld(region: WorldRegionRef, point?: ScreenPoint) {
    if (lockedWorld.value?.iso === region.iso) return
    selectedId.value = null
    selectedName.value = null
    lockedWorld.value = region
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Close any open panel without touching the camera (ocean click, [X]). */
  function closePanels() {
    selectedId.value = null
    selectedName.value = null
    lockedWorld.value = null
  }

  /** ESC / "voltar ao Brasil": close panels and recenter on the country. */
  function goHome() {
    closePanels()
    requestCamera('national')
  }

  function requestCamera(target: CameraTarget) {
    cameraRequest.value = { target, seq: cameraRequest.value.seq + 1 }
  }

  function setHovered(id: string | null, name: string | null = null) {
    hoveredId.value = id
    hoveredName.value = name
  }

  function setHoveredWorld(region: WorldRegionRef | null) {
    hoveredWorld.value = region
  }

  return {
    selectedId,
    selectedName,
    hoveredId,
    hoveredName,
    hoveredWorld,
    lockedWorld,
    lastPing,
    pingSeq,
    cameraRequest,
    hasSelection,
    hasPanel,
    select,
    lockWorld,
    closePanels,
    goHome,
    requestCamera,
    setHovered,
    setHoveredWorld,
  }
})
