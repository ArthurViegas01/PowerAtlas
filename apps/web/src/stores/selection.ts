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

export type RotateKind = 'by' | 'north' | 'auto'

/** Which region the operator is inspecting, plus hover/ping/camera UI state. */
export const useSelectionStore = defineStore('selection', () => {
  const selectedId = ref<string | null>(null)
  const selectedName = ref<string | null>(null)
  /** Municipality drilled into within the selected state (pilot: SP). */
  const selectedMunicipio = ref<{ codigo: string; name: string } | null>(null)
  const hoveredId = ref<string | null>(null)
  const hoveredName = ref<string | null>(null)
  /** Municipality hover on the drill-down layer (belongs to selectedId). */
  const hoveredMunicipio = ref<{ codigo: string; name: string } | null>(null)
  /** World-country hover on the backdrop layer. */
  const hoveredWorld = ref<WorldRegionRef | null>(null)
  /** Screen position of the last hover pick — anchors the map tooltip. */
  const hoverPoint = ref<ScreenPoint | null>(null)
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
  /** Live map bearing in degrees — mirrored from MapLibre for the compass. */
  const mapBearing = ref(0)
  /**
   * Bearing chosen by the operator (compass buttons or drag-rotate). While
   * set, camera flights keep it instead of the cinematic presets; `null`
   * returns framing to automatic.
   */
  const bearingOverride = ref<number | null>(null)
  /** Imperative rotation bus — MapView watches `seq` and applies `kind`. */
  const rotateRequest = ref<{ kind: RotateKind; delta: number; seq: number }>({
    kind: 'by',
    delta: 0,
    seq: 0,
  })

  const hasSelection = computed(() => selectedId.value !== null)
  const hasPanel = computed(() => selectedId.value !== null || lockedWorld.value !== null)

  function select(id: string, name: string, point?: ScreenPoint) {
    if (selectedId.value === id) return
    lockedWorld.value = null
    selectedMunicipio.value = null
    hoveredMunicipio.value = null // the old state's municipal layer is gone
    selectedId.value = id
    selectedName.value = name
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Drill into a municipality of the current state (keeps the state selected). */
  function selectMunicipio(codigo: string, name: string, point?: ScreenPoint) {
    if (selectedMunicipio.value?.codigo === codigo) return
    selectedMunicipio.value = { codigo, name }
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Leave the municipality view, back to the state's ranking. */
  function clearMunicipio() {
    selectedMunicipio.value = null
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
    selectedMunicipio.value = null
    hoveredMunicipio.value = null
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

  /** Rotate the camera by `delta` degrees (positive = counterclockwise). */
  function requestRotate(delta: number) {
    rotateRequest.value = { kind: 'by', delta, seq: rotateRequest.value.seq + 1 }
  }

  function requestNorth() {
    rotateRequest.value = { kind: 'north', delta: 0, seq: rotateRequest.value.seq + 1 }
  }

  /** Drop the manual bearing and ease back to the cinematic framing. */
  function requestAutoBearing() {
    rotateRequest.value = { kind: 'auto', delta: 0, seq: rotateRequest.value.seq + 1 }
  }

  function setMapBearing(bearing: number) {
    mapBearing.value = bearing
  }

  function setBearingOverride(bearing: number | null) {
    bearingOverride.value = bearing
  }

  function setHovered(id: string | null, name: string | null = null) {
    hoveredId.value = id
    hoveredName.value = name
  }

  function setHoveredMunicipio(municipio: { codigo: string; name: string } | null) {
    hoveredMunicipio.value = municipio
  }

  function setHoveredWorld(region: WorldRegionRef | null) {
    hoveredWorld.value = region
  }

  function setHoverPoint(point: ScreenPoint | null) {
    hoverPoint.value = point
  }

  return {
    selectedId,
    selectedName,
    selectedMunicipio,
    hoveredId,
    hoveredName,
    hoveredMunicipio,
    hoveredWorld,
    hoverPoint,
    lockedWorld,
    lastPing,
    pingSeq,
    cameraRequest,
    mapBearing,
    bearingOverride,
    rotateRequest,
    hasSelection,
    hasPanel,
    select,
    selectMunicipio,
    clearMunicipio,
    lockWorld,
    closePanels,
    goHome,
    requestCamera,
    requestRotate,
    requestNorth,
    requestAutoBearing,
    setMapBearing,
    setBearingOverride,
    setHovered,
    setHoveredMunicipio,
    setHoveredWorld,
    setHoverPoint,
  }
})
