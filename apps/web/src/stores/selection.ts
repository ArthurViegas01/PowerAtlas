import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { defaultFiscalSegments, type FiscalSegmentKey } from '@/lib/fiscalSegments'
import type { SubdivisaoLevel } from '@/lib/geo'
import type { TradeDirection } from '@/types/comercio'

export interface ScreenPoint {
  x: number
  y: number
}

/** A country from the "em breve" world backdrop (not yet mapped). */
export interface WorldRegionRef {
  iso: string
  name: string
  /** Set when `name` is a province: the pt-BR country it belongs to. */
  country?: string
}

/** A foreign province under the cursor (admin-1 border of a big country). */
export interface WorldStateRef {
  iso: string
  /** Province / state name. */
  name: string
  country: string
}

export type CameraTarget = 'national' | 'global'

/** Data lens over the globe (IA-1b): the old "views" as what they really are. */
export type MapLens = 'influence' | 'trade' | 'demographic'

export type RotateKind = 'by' | 'north' | 'auto'

export type DemografiaMetric = 'population' | 'gdp'

/** Município under the cursor in the demographic view (feeds the tooltip). */
export interface DemografiaHover {
  codigo: string
  name: string
  population: number
  gdpBrlThousands: number
}

/**
 * A bairro or distrito under the cursor or open in the panel. Carries the
 * whole Censo 2022 readout so the panel never has to look back into the mesh.
 * No PIB: the PIB dos Municípios has no breakdown below the município.
 */
export interface SubdivisaoRef {
  codigo: string
  name: string
  /** Which division this unit belongs to — the UI names it, never guesses. */
  level: SubdivisaoLevel
  population: number | null
  households: number | null
  areaKm2: number | null
  density: number | null
}

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
  /** Subdivision drilled into inside the current município (both views). */
  const selectedSubdivisao = ref<SubdivisaoRef | null>(null)
  const hoveredSubdivisao = ref<SubdivisaoRef | null>(null)
  /** World-country hover on the backdrop layer. */
  const hoveredWorld = ref<WorldRegionRef | null>(null)
  /** Foreign province hover (admin-1 layer over the big countries). */
  const hoveredWorldState = ref<WorldStateRef | null>(null)
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
  /** Live map pitch in degrees — mirrored from MapLibre for the compass. */
  const mapPitch = ref(45)
  /** Manual tilt; camera flights keep it until AUTO clears (like bearing). */
  const pitchOverride = ref<number | null>(null)
  /** Imperative tilt bus — MapView watches `seq` and tilts by `delta`. */
  const pitchRequest = ref<{ delta: number; seq: number }>({ delta: 0, seq: 0 })

  /**
   * Active data lens (IA-1b): influence is the default HUD, trade is the
   * global backdrop with the Comex arrows, demographic swaps in the
   * per-município columns.
   */
  const lens = ref<MapLens>('influence')
  /** Compat alias: the demographic consumers all read this boolean. */
  const demographicView = computed(() => lens.value === 'demographic')
  const demographicMetric = ref<DemografiaMetric>('population')
  const hoveredDemografia = ref<DemografiaHover | null>(null)
  /** State focused inside the demographic view (camera crop; Esc clears). */
  const demographicUf = ref<string | null>(null)
  /** Município clicked in the demographic view — opens the left city card. */
  const selectedDemografia = ref<DemografiaHover | null>(null)
  /**
   * Fiscal overlay (demographic view, PIB metric): which segments of the
   * money leaving to / returning from Brasília are shown. Keyed by segment
   * (previdencia, ir, ... / fpm, fundeb, ...); toggled in the right panel.
   */
  const fiscalSegments = ref<Record<FiscalSegmentKey, boolean>>(defaultFiscalSegments())

  /**
   * World trade arrows (Visão Global): the animated Brazil -> partner links
   * showing real exports/imports. Visible by default in the global context;
   * the legend toggles them and switches the direction shown.
   */
  const tradeVisible = ref(true)
  /**
   * Directions shown, in activation order. Both can be on at once (arrows in
   * each sense); at least one stays on. The order drives the stacked tables in
   * the partner panel — whichever was turned on later sits below.
   */
  const tradeDirs = ref<TradeDirection[]>(['export'])
  /**
   * Whether the animated Brazil -> partner arrows draw. Independent of
   * `tradeVisible`: the operator can keep the colored countries and labels but
   * silence the moving arrows.
   */
  const tradeArrowsVisible = ref(true)
  /** Partner country opened in the trade panel — explodes its sector arrows. */
  const selectedPartner = ref<WorldRegionRef | null>(null)

  /**
   * Camada política: pinta cada município pela cor do partido do prefeito
   * eleito. Contexto nacional (nada drilado, demográfico off). Off por padrão —
   * o operador liga na legenda.
   */
  const partisanVisible = ref(false)

  const hasSelection = computed(() => selectedId.value !== null)
  const hasPanel = computed(
    () =>
      selectedId.value !== null ||
      lockedWorld.value !== null ||
      selectedPartner.value !== null,
  )

  /**
   * Município the camera has drilled into, whichever view is active: the
   * drill-down panel in the influence HUD, the city card in the demographic
   * view. This is what the lazy subdivision mesh keys off.
   */
  const drilledMunicipioCodigo = computed(() =>
    demographicView.value
      ? (selectedDemografia.value?.codigo ?? null)
      : (selectedMunicipio.value?.codigo ?? null),
  )

  function select(id: string, name: string, point?: ScreenPoint) {
    if (selectedId.value === id) return
    if (lens.value === 'trade') lens.value = 'influence' // picking a region leaves the trade lens
    lockedWorld.value = null
    selectedPartner.value = null // leaving the global trade context
    selectedMunicipio.value = null
    hoveredMunicipio.value = null // the old state's municipal layer is gone
    clearSubdivisao()
    selectedId.value = id
    selectedName.value = name
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Drill into a municipality of the current state (keeps the state selected). */
  function selectMunicipio(codigo: string, name: string, point?: ScreenPoint) {
    if (selectedMunicipio.value?.codigo === codigo) return
    selectedMunicipio.value = { codigo, name }
    clearSubdivisao() // the previous município's subdivision layer is gone
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Leave the municipality view, back to the state's ranking. */
  function clearMunicipio() {
    selectedMunicipio.value = null
    clearSubdivisao()
  }

  /** Drill into a bairro or distrito of the open município (deepest level). */
  function selectSubdivisao(subdivisao: SubdivisaoRef, point?: ScreenPoint) {
    if (selectedSubdivisao.value?.codigo === subdivisao.codigo) return
    selectedSubdivisao.value = subdivisao
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Leave the subdivision, back to the município ([X] or Esc). */
  function clearSubdivisao() {
    selectedSubdivisao.value = null
    hoveredSubdivisao.value = null
  }

  function setHoveredSubdivisao(subdivisao: SubdivisaoRef | null) {
    hoveredSubdivisao.value = subdivisao
  }

  /** Click on a not-yet-mapped country: swap any open panel for the lock panel. */
  function lockWorld(region: WorldRegionRef, point?: ScreenPoint) {
    if (lockedWorld.value?.iso === region.iso) return
    selectedId.value = null
    selectedName.value = null
    selectedPartner.value = null
    lockedWorld.value = region
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /**
   * Click on a not-yet-mapped foreign province: like lockWorld, but the panel
   * names the province and carries its country. Reuses lockedWorld so the
   * "região não mapeada" panel and Esc/close flow work unchanged.
   */
  function lockWorldState(region: WorldStateRef, point?: ScreenPoint) {
    selectedId.value = null
    selectedName.value = null
    selectedPartner.value = null
    lockedWorld.value = { iso: region.iso, name: region.name, country: region.country }
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Toggle the world trade arrows on/off (legend switch). */
  function toggleTrade() {
    tradeVisible.value = !tradeVisible.value
    if (!tradeVisible.value) selectedPartner.value = null
  }

  /** Toggle just the animated arrows, keeping the colored countries/labels. */
  function toggleTradeArrows() {
    tradeArrowsVisible.value = !tradeArrowsVisible.value
  }

  /** Toggle the municipal party choropleth (legend switch). */
  function togglePartisan() {
    partisanVisible.value = !partisanVisible.value
  }

  /** Toggle one direction on/off, keeping at least one active. */
  function toggleTradeDirection(direction: TradeDirection) {
    const current = tradeDirs.value
    if (current.includes(direction)) {
      if (current.length === 1) return // never leave both off
      tradeDirs.value = current.filter((d) => d !== direction)
    } else {
      tradeDirs.value = [...current, direction]
    }
  }

  /**
   * Open the trade panel for a partner country: closes any Brazilian panel and
   * explodes that country's arrow into one per sector. Same self-check as the
   * other selectors so re-clicking the open partner is a no-op.
   */
  function selectTradePartner(region: WorldRegionRef, point?: ScreenPoint) {
    if (selectedPartner.value?.iso === region.iso) return
    lens.value = 'trade' // a partner panel IS the trade context
    selectedId.value = null
    selectedName.value = null
    selectedMunicipio.value = null
    hoveredMunicipio.value = null
    lockedWorld.value = null
    clearSubdivisao()
    selectedPartner.value = region
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Close the trade panel, back to all-partner arrows ([X] or Esc). */
  function clearTradePartner() {
    selectedPartner.value = null
  }

  /** Close any open panel without touching the camera (ocean click, [X]). */
  function closePanels() {
    selectedId.value = null
    selectedName.value = null
    selectedMunicipio.value = null
    hoveredMunicipio.value = null
    lockedWorld.value = null
    selectedPartner.value = null
    clearSubdivisao()
  }

  /** ESC / "voltar ao Brasil": close panels and recenter on the country. */
  function goHome() {
    if (lens.value === 'trade') lens.value = 'influence'
    closePanels()
    requestCamera('national')
  }

  function requestCamera(target: CameraTarget) {
    cameraRequest.value = { target, seq: cameraRequest.value.seq + 1 }
  }

  /** Open the demographic view: closes panels, reframes on the country. */
  function enterDemographicView() {
    if (demographicView.value) return
    closePanels()
    hoveredDemografia.value = null
    selectedDemografia.value = null
    lens.value = 'demographic'
    requestCamera('national')
  }

  /** Open the demographic city card (column or footprint click). */
  function selectDemografia(municipio: DemografiaHover, point?: ScreenPoint) {
    if (!demographicView.value) return
    if (selectedDemografia.value?.codigo !== municipio.codigo) clearSubdivisao()
    selectedDemografia.value = municipio
    lastPing.value = point ?? null
    pingSeq.value += 1
  }

  /** Close the demographic city card ([X] or Esc). */
  function clearDemografia() {
    selectedDemografia.value = null
    clearSubdivisao()
  }

  /** Back to the influence HUD (Esc or another lens). */
  function exitDemographicView() {
    if (!demographicView.value) return
    lens.value = 'influence'
    hoveredDemografia.value = null
    selectedDemografia.value = null
    demographicUf.value = null
    clearSubdivisao()
  }

  /**
   * Lens switch (IA-1b): each branch mirrors the old header action exactly.
   * Heavy demographic data loads stay with the callers (MapScreen, palette,
   * analysis replay), same as before.
   */
  function setLens(next: MapLens) {
    if (lens.value === next) return
    if (next === 'demographic') {
      enterDemographicView()
      return
    }
    exitDemographicView()
    lens.value = next
    if (next === 'trade') {
      closePanels()
      requestCamera('global')
    } else {
      requestCamera('national')
    }
  }

  /** Focus a state inside the demographic view (`null` = back to Brazil). */
  function selectDemographicUf(uf: string | null) {
    if (!demographicView.value || demographicUf.value === uf) return
    demographicUf.value = uf
    // The city card belongs to the previous crop, the state card takes over.
    selectedDemografia.value = null
    clearSubdivisao()
  }

  function setDemographicMetric(metric: DemografiaMetric) {
    demographicMetric.value = metric
  }

  function setHoveredDemografia(hover: DemografiaHover | null) {
    hoveredDemografia.value = hover
  }

  /** Toggle one fiscal segment (right-panel switch). */
  function toggleFiscalSegment(key: FiscalSegmentKey) {
    fiscalSegments.value = {
      ...fiscalSegments.value,
      [key]: !fiscalSegments.value[key],
    }
  }

  /** Turn a whole group (outflow/inflow) on or off at once. */
  function setFiscalGroup(keys: FiscalSegmentKey[], visible: boolean) {
    const next = { ...fiscalSegments.value }
    for (const key of keys) next[key] = visible
    fiscalSegments.value = next
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

  /** Tilt the camera by `delta` degrees (positive = more tilted). */
  function requestPitch(delta: number) {
    pitchRequest.value = { delta, seq: pitchRequest.value.seq + 1 }
  }

  function setMapPitch(pitch: number) {
    mapPitch.value = pitch
  }

  function setPitchOverride(pitch: number | null) {
    pitchOverride.value = pitch
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

  function setHoveredWorldState(region: WorldStateRef | null) {
    hoveredWorldState.value = region
  }

  function setHoverPoint(point: ScreenPoint | null) {
    hoverPoint.value = point
  }

  return {
    selectedId,
    selectedName,
    selectedMunicipio,
    selectedSubdivisao,
    hoveredSubdivisao,
    hoveredId,
    hoveredName,
    hoveredMunicipio,
    hoveredWorld,
    hoveredWorldState,
    hoverPoint,
    lockedWorld,
    lastPing,
    pingSeq,
    cameraRequest,
    mapBearing,
    bearingOverride,
    rotateRequest,
    lens,
    setLens,
    demographicView,
    demographicMetric,
    hoveredDemografia,
    demographicUf,
    selectedDemografia,
    fiscalSegments,
    tradeVisible,
    tradeDirs,
    tradeArrowsVisible,
    selectedPartner,
    partisanVisible,
    mapPitch,
    pitchOverride,
    pitchRequest,
    hasSelection,
    hasPanel,
    drilledMunicipioCodigo,
    select,
    selectMunicipio,
    clearMunicipio,
    selectSubdivisao,
    clearSubdivisao,
    setHoveredSubdivisao,
    lockWorld,
    lockWorldState,
    closePanels,
    goHome,
    requestCamera,
    enterDemographicView,
    exitDemographicView,
    selectDemographicUf,
    setDemographicMetric,
    setHoveredDemografia,
    selectDemografia,
    clearDemografia,
    toggleFiscalSegment,
    setFiscalGroup,
    toggleTrade,
    toggleTradeArrows,
    toggleTradeDirection,
    togglePartisan,
    selectTradePartner,
    clearTradePartner,
    requestPitch,
    setMapPitch,
    setPitchOverride,
    requestRotate,
    requestNorth,
    requestAutoBearing,
    setMapBearing,
    setBearingOverride,
    setHovered,
    setHoveredMunicipio,
    setHoveredWorld,
    setHoveredWorldState,
    setHoverPoint,
  }
})
