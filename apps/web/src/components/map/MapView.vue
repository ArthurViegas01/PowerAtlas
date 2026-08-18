<script setup lang="ts">
import type { PickingInfo } from '@deck.gl/core'
import { MapboxOverlay } from '@deck.gl/mapbox'
import maplibregl from 'maplibre-gl'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'

import { useReducedMotion } from '@/composables/useReducedMotion'
import { countryColorAny } from '@/lib/countryColors'
import { buildDeckLayers } from '@/lib/deckLayers'
import { featureBounds } from '@/lib/geo'
import type {
  SubdivisaoFeature,
  Bounds,
  BoundaryFeature,
  MunicipioFeature,
  WorldFeature,
  WorldStateFeature,
} from '@/lib/geo'
import { baseMapStyle } from '@/lib/mapStyle'
import { useComercioStore } from '@/stores/comercio'
import { useDemografiaStore } from '@/stores/demografia'
import { useMapLayersStore } from '@/stores/mapLayers'
import { useSelectionStore, type SubdivisaoRef } from '@/stores/selection'
import type { DemografiaMunicipio } from '@/types/demografia'

const emit = defineEmits<{ (event: 'region-selected', regionId: string): void }>()

const container = ref<HTMLDivElement | null>(null)
const selection = useSelectionStore()
const mapLayers = useMapLayersStore()
const demografia = useDemografiaStore()
const comercio = useComercioStore()
const reduced = useReducedMotion()

let map: maplibregl.Map | null = null
let overlay: MapboxOverlay | null = null
const mapReady = ref(false)

// Slow sine (~4s period) driving the national crest glow, plus a sawtooth
// (~2.2s period) carrying the fiscal flow packets along their route. Driven
// by rAF throttled to ~30fps: smooth enough for the moving packets, cheap
// enough to rebuild layers (deck.gl diffs, so only the packet layer reuploads).
const pulse = ref(1)
// Continuous time in "loop units" (1 per FLOW_LOOP_MS). deckLayers derives
// each arc's stripe positions from it, scaled by that arc's flow speed.
const flowTime = ref(0)
const FLOW_LOOP_MS = 4200
let rafId: number | undefined
let lastTick = 0

// Click ripple across the demographic columns: epicenter + start time, read
// each frame by the layer builder. Cleared once the wave has decayed.
const ripple = ref<{ epicenter: [number, number]; start: number } | null>(null)
const RIPPLE_LIFETIME_MS = 3400
function triggerRipple(event: maplibregl.MapMouseEvent) {
  if (reduced.value) return
  ripple.value = { epicenter: [event.lngLat.lng, event.lngLat.lat], start: performance.now() }
}

// Click ripples on the ocean grid: a click over open sea drops a wavefront that
// the shader expands and fades. Kept to the few most recent (fixed shader
// slots); the ambient breathing wave is stateless, so it needs nothing here.
const oceanRipples = ref<{ epicenter: [number, number]; start: number }[]>([])
const OCEAN_RIPPLE_LIFETIME_MS = 3000
const MAX_OCEAN_RIPPLES = 16
// Cursor position as screen UV (0–1, y up) driving the grid's mouse bulge.
const oceanMouse = ref<[number, number] | null>(null)
function spawnOceanRipple(event: maplibregl.MapMouseEvent) {
  if (reduced.value) return
  const next = { epicenter: [event.lngLat.lng, event.lngLat.lat] as [number, number], start: performance.now() }
  oceanRipples.value = [...oceanRipples.value, next].slice(-MAX_OCEAN_RIPPLES)
}

// Ambient rain: every so often a drop lands at a random point in view and its
// ring propagates outward on its own, so the open sea is alive even when the
// user isn't clicking. The interval is jittered so the drops feel natural
// instead of metronomic; reduced motion silences them.
let nextOceanDropAt = 0
function spawnRandomOceanDrop(now: number) {
  if (reduced.value || !map) return
  if (now < nextOceanDropAt) return
  nextOceanDropAt = now + 350 + Math.random() * 650 // next drop in ~0.35–1.0s
  const bounds = map.getBounds()
  const lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest())
  const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth())
  const next = { epicenter: [lng, lat] as [number, number], start: now }
  oceanRipples.value = [...oceanRipples.value, next].slice(-MAX_OCEAN_RIPPLES)
}

// Horizon fade: darkens the far edge of the map as the camera tilts, so the
// distant clutter recedes instead of competing with the foreground. Purely
// cosmetic, driven by pitch (flat view = invisible).
const horizonFadeOpacity = computed(() => {
  const t = Math.min(1, Math.max(0, (selection.mapPitch - 38) / 30))
  return t * 0.8
})

// Country name labels for the trade view live as an HTML overlay (not a deck
// TextLayer): crisp at any zoom, upright, and drawn above the horizon fade so
// tilting never clips them. Brazil's tag is gold over its green territory.
//
// The reactive list only holds WHICH labels exist (rebuilt on data change);
// their screen positions are written imperatively straight to the DOM on every
// map 'render'/'move', the way maplibre's own markers track the camera — so
// dragging never leaves them lagging behind a Vue reactivity tick.
interface TradeLabel {
  key: string
  text: string
  color: string
  lon: number
  lat: number
  selected: boolean
  /** 'brasil' = the gold home tag, 'name' = a top-50 partner, 'sigla' = the rest. */
  kind: 'brasil' | 'name' | 'sigla'
}
const tradeLabels = ref<TradeLabel[]>([])
const labelsContainer = ref<HTMLDivElement | null>(null)
const BRASIL_LABEL_RGB: [number, number, number] = [235, 200, 75]

/** Center of a country's mainland bounds — the fallback label anchor. */
function labelCentroid(feature: WorldFeature): [number, number] {
  const [[w, s], [e, n]] = featureBounds(feature)
  return [(w + e) / 2, (s + n) / 2]
}

function rebuildTradeLabels() {
  const model = mapLayers.layerModel
  const out: TradeLabel[] = []
  // Country labels belong to the world (global) context only.
  if (model.globalIdle && model.world) {
    const [r, g, b] = BRASIL_LABEL_RGB
    out.push({
      key: 'BR',
      text: 'BRASIL',
      color: `rgb(${r}, ${g}, ${b})`,
      lon: -52.5,
      lat: -10.5,
      selected: false,
      kind: 'brasil',
    })

    // Top 50 partners by combined flow get their full name in front; every
    // other country shows only its ISO sigla.
    const top50 = new Set(
      [...comercio.partners]
        .map((p) => ({ iso: p.iso, value: p.exp + p.imp }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 50)
        .map((p) => p.iso),
    )
    const selectedIso = model.trade.highlights.find((h) => h.selected)?.iso ?? null
    for (const feature of model.world.features) {
      const iso = feature.properties.iso
      if (iso === 'BRA') continue
      const partner = comercio.byIso.get(iso)
      const [lon, lat] = partner ? partner.coordinates : labelCentroid(feature)
      const [cr, cg, cb] = countryColorAny(iso)
      const named = top50.has(iso)
      out.push({
        key: iso,
        text: named ? (partner?.name ?? feature.properties.name).toUpperCase() : iso,
        color: `rgb(${cr}, ${cg}, ${cb})`,
        lon,
        lat,
        selected: iso === selectedIso,
        kind: named ? 'name' : 'sigla',
      })
    }
  }
  tradeLabels.value = out
  // Position the freshly-rendered spans once Vue has committed them.
  void nextTick(positionTradeLabels)
}

/** Write each label's screen position straight to the DOM (no reactivity). */
function positionTradeLabels() {
  if (!map || !labelsContainer.value) return
  const width = map.getContainer().clientWidth
  const height = map.getContainer().clientHeight
  for (const node of Array.from(labelsContainer.value.children) as HTMLElement[]) {
    const lon = Number(node.dataset.lon)
    const lat = Number(node.dataset.lat)
    const point = map.project([lon, lat])
    if (point.x < -60 || point.x > width + 60 || point.y < -30 || point.y > height + 30) {
      node.style.display = 'none'
      continue
    }
    node.style.display = ''
    node.style.transform = `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`
  }
}

// North-up on open (BRG 000) — the old cinematic tilt (-8) read as "the map
// renders slightly rotated" rather than intentional.
const NATIONAL_CAMERA = {
  center: [-53.2, -14.6] as [number, number],
  zoom: 3.7,
  pitch: 45,
  bearing: 0,
}

/** Bearing presets per framing; a manual override beats them all. */
const CONTEXT_BEARING = {
  national: NATIONAL_CAMERA.bearing,
  region: 0,
  global: 0,
} as const

/** Pitch presets per framing; the tilt buttons override them until AUTO. */
const CONTEXT_PITCH = {
  national: NATIONAL_CAMERA.pitch,
  region: 52,
  global: 24,
} as const

/** Hard tilt range: MapLibre supports up to 85° (default caps at 60). */
const MAX_PITCH = 85

/**
 * Deepest zoom the map allows. Was 9 (município framing) until the subdivision
 * mesh landed; 12 is about as close as those polygons stay honest at the
 * simplification scripts/fetch-subdivisoes.mjs applies.
 */
const MAX_ZOOM = 12

/** Last framing applied — tells the AUTO reset which preset to ease back to. */
let cameraContext: keyof typeof CONTEXT_BEARING = 'national'

function cameraBearing(context: keyof typeof CONTEXT_BEARING): number {
  cameraContext = context
  return selection.bearingOverride ?? CONTEXT_BEARING[context]
}

function cameraPitch(preset: number): number {
  return selection.pitchOverride ?? preset
}

/** World minus Antarctica (filtered out of the backdrop file). */
const WORLD_BOUNDS: Bounds = [
  [-168, -56],
  [178, 74],
]

function handleStateHover(info: PickingInfo<BoundaryFeature>) {
  const feature = info.object
  if (feature) {
    selection.setHovered(feature.properties.UF, feature.properties.name)
    selection.setHoverPoint({ x: info.x, y: info.y })
  } else {
    selection.setHovered(null)
  }
}

function handleMunicipioHover(info: PickingInfo<MunicipioFeature>) {
  const feature = info.object
  if (feature) {
    selection.setHoveredMunicipio({
      codigo: feature.properties.codigo,
      name: feature.properties.name,
    })
    selection.setHoverPoint({ x: info.x, y: info.y })
  } else {
    selection.setHoveredMunicipio(null)
  }
}

/**
 * The mesh features carry the Censo readouts but not which division they
 * belong to — that is a property of the município, so it comes from the
 * coverage index.
 */
function subdivisaoRefFrom(feature: SubdivisaoFeature): SubdivisaoRef {
  const level =
    mapLayers.subdivisaoInfoFor(selection.drilledMunicipioCodigo)?.level ?? 'bairro'
  const { codigo, name, population, households, areaKm2, density } = feature.properties
  return { codigo, name, level, population, households, areaKm2, density }
}

function handleSubdivisaoHover(info: PickingInfo<SubdivisaoFeature>) {
  const feature = info.object
  if (feature) {
    selection.setHoveredSubdivisao(subdivisaoRefFrom(feature))
    selection.setHoverPoint({ x: info.x, y: info.y })
  } else {
    selection.setHoveredSubdivisao(null)
  }
}

/** codigo -> município lookup for footprint hovers/clicks (5.570 entries). */
const muniByCodigo = computed(
  () => new Map(demografia.municipios.map((municipio) => [municipio.codigo, municipio])),
)

/** Hover on a município footprint: same tooltip/highlight as its column. */
function handleDemografiaBaseHover(info: PickingInfo<MunicipioFeature>) {
  const codigo = info.object?.properties.codigo
  const municipio = codigo ? muniByCodigo.value.get(codigo) : undefined
  if (municipio) {
    selection.setHoveredDemografia({
      codigo: municipio.codigo,
      name: municipio.name,
      population: municipio.population,
      gdpBrlThousands: municipio.gdpBrlThousands,
    })
    selection.setHoverPoint({ x: info.x, y: info.y })
  } else {
    selection.setHoveredDemografia(null)
  }
}

function handleDemografiaHover(info: PickingInfo<DemografiaMunicipio>) {
  const municipio = info.object
  if (municipio) {
    selection.setHoveredDemografia({
      codigo: municipio.codigo,
      name: municipio.name,
      population: municipio.population,
      gdpBrlThousands: municipio.gdpBrlThousands,
    })
    selection.setHoverPoint({ x: info.x, y: info.y })
  } else {
    selection.setHoveredDemografia(null)
  }
}

function handleWorldHover(info: PickingInfo<WorldFeature>) {
  const feature = info.object
  selection.setHoveredWorld(
    feature ? { iso: feature.properties.iso, name: feature.properties.name } : null,
  )
  if (feature) selection.setHoverPoint({ x: info.x, y: info.y })
}

function handleWorldStateHover(info: PickingInfo<WorldStateFeature>) {
  const feature = info.object
  selection.setHoveredWorldState(
    feature
      ? {
          iso: feature.properties.iso,
          name: feature.properties.name,
          country: feature.properties.country,
        }
      : null,
  )
  if (feature) selection.setHoverPoint({ x: info.x, y: info.y })
}

/** Open a subdivision from a picking hit (same move in both views). */
function selectSubdivisaoFrom(info: PickingInfo<SubdivisaoFeature>, point: { x: number; y: number }) {
  selection.selectSubdivisao(subdivisaoRefFrom(info.object!), point)
}

function handleClick(event: maplibregl.MapMouseEvent) {
  if (!overlay) return
  // Demographic view, two-step focus: the first click (column, footprint or
  // ground) crops the camera on the clicked state and opens the state card;
  // inside the cropped state, a column/footprint click focuses the município
  // and opens its city card.
  if (selection.demographicView) {
    const point = { x: event.point.x, y: event.point.y }
    const info = overlay.pickObject({
      ...point,
      radius: 4,
      // 'bairros' first: once the camera is inside a city, its bairros own the
      // clicks that would otherwise land on the município footprint below.
      layerIds: ['subdivisoes', 'demografia-columns', 'municipal-borders', 'states-choropleth'],
    })
    const openCityCard = (municipio: DemografiaMunicipio) => {
      selection.selectDemografia(
        {
          codigo: municipio.codigo,
          name: municipio.name,
          population: municipio.population,
          gdpBrlThousands: municipio.gdpBrlThousands,
        },
        point,
      )
      flyToDemografiaMunicipio(municipio.coordinates)
    }
    /** Card if the município sits in the cropped state, crop otherwise. */
    const focus = (codigo: string) => {
      const municipioUf = mapLayers.ufFromMunicipioCodigo(codigo)
      if (municipioUf && municipioUf !== selection.demographicUf) {
        selection.selectDemographicUf(municipioUf)
        triggerRipple(event)
        return
      }
      const municipio = muniByCodigo.value.get(codigo)
      if (municipio) openCityCard(municipio)
    }
    if (info?.layer?.id === 'subdivisoes') {
      selectSubdivisaoFrom(info as PickingInfo<SubdivisaoFeature>, point)
    } else if (info?.layer?.id === 'demografia-columns') {
      focus((info as PickingInfo<DemografiaMunicipio>).object!.codigo)
    } else if (info?.layer?.id === 'municipal-borders') {
      focus((info as PickingInfo<MunicipioFeature>).object!.properties.codigo)
    } else if (info?.layer?.id === 'states-choropleth') {
      const { UF } = (info as PickingInfo<BoundaryFeature>).object!.properties
      selection.selectDemographicUf(UF)
      triggerRipple(event)
    } else {
      // Missed every layer: the click landed on open sea.
      spawnOceanRipple(event)
    }
    return
  }
  const point = { x: event.point.x, y: event.point.y }
  const info = overlay.pickObject({
    ...point,
    radius: 4,
    // 'world-states' before 'world-countries': over the big countries the
    // province owns the click, but a trade partner still opens its trade panel.
    layerIds: ['subdivisoes', 'municipios', 'states-choropleth', 'world-states', 'world-countries'],
  })
  if (info?.layer?.id === 'subdivisoes') {
    selectSubdivisaoFrom(info as PickingInfo<SubdivisaoFeature>, point)
  } else if (info?.layer?.id === 'municipios') {
    const { codigo, name } = (info as PickingInfo<MunicipioFeature>).object!.properties
    selection.selectMunicipio(codigo, name, point)
  } else if (info?.layer?.id === 'states-choropleth') {
    const { UF, name } = (info as PickingInfo<BoundaryFeature>).object!.properties
    selection.select(UF, name, point)
    emit('region-selected', UF)
  } else if (info?.layer?.id === 'world-states') {
    const { iso, name, country } = (info as PickingInfo<WorldStateFeature>).object!.properties
    // Trade partner with arrows on still explodes into its sectors (country
    // panel); otherwise the province opens its own "não mapeada" lock panel.
    if (selection.tradeVisible && !selection.demographicView && comercio.byIso.get(iso)) {
      selection.selectTradePartner({ iso, name: country }, point)
    } else {
      selection.lockWorldState({ iso, name, country }, point)
    }
  } else if (info?.layer?.id === 'world-countries') {
    const { iso, name } = (info as PickingInfo<WorldFeature>).object!.properties
    // With the trade arrows on, a country with trade data opens its trade
    // panel (and explodes its sector arcs); otherwise it falls back to the
    // "região não mapeada" lock panel.
    if (selection.tradeVisible && !selection.demographicView && comercio.byIso.get(iso)) {
      selection.selectTradePartner({ iso, name }, point)
    } else {
      selection.lockWorld({ iso, name }, point)
    }
  } else {
    // Nothing under the cursor: the click hit open sea. Ripple the grid and
    // close any open panel.
    spawnOceanRipple(event)
    selection.closePanels()
  }
}

function flyToGlobal() {
  if (!map) return
  const duration = reduced.value ? 0 : 1600
  const camera = map.cameraForBounds(WORLD_BOUNDS, { padding: 56 })
  if (!camera) return
  map.flyTo({
    center: camera.center,
    zoom: camera.zoom,
    pitch: cameraPitch(CONTEXT_PITCH.global),
    bearing: cameraBearing('global'),
    duration,
  })
}

/**
 * Focus the clicked município: glide the camera to its centroid, nudged
 * right so it clears the city card on the left. Never zooms back out if the
 * operator is already closer than the preset.
 */
function flyToDemografiaMunicipio(coordinates: [number, number]) {
  if (!map) return
  map.flyTo({
    center: coordinates,
    zoom: Math.max(map.getZoom(), 7.2),
    offset: [150, 0],
    duration: reduced.value ? 0 : 1200,
  })
}

/** Crop the demographic view on one state (`null` = back to the country). */
function flyToDemografiaUf(uf: string | null) {
  if (!map) return
  if (!uf) {
    flyToRegion(null)
    return
  }
  const bounds = mapLayers.boundsFor(uf)
  if (!bounds) return
  const duration = reduced.value ? 0 : 1400
  const padding = {
    top: 96,
    bottom: 110,
    left: 90,
    right: 300, // keep the focused state clear of the metric menu
  }
  const camera = map.cameraForBounds(bounds, { padding, maxZoom: 7.5 })
  if (!camera) return
  map.flyTo({
    center: camera.center,
    zoom: camera.zoom,
    pitch: cameraPitch(CONTEXT_PITCH.region),
    bearing: cameraBearing('region'),
    duration,
  })
}

function flyToRegion(regionId: string | null) {
  if (!map) return
  const duration = reduced.value ? 0 : 1400
  if (!regionId || regionId === 'BR') {
    map.flyTo({
      ...NATIONAL_CAMERA,
      bearing: cameraBearing('national'),
      pitch: cameraPitch(CONTEXT_PITCH.national),
      duration,
    })
    return
  }
  const bounds = mapLayers.boundsFor(regionId)
  if (!bounds) return
  const padding = {
    top: 96,
    bottom: 110,
    left: 90,
    // keep the focused state clear of the right-side ranking panel
    right: Math.min(map.getContainer().clientWidth * 0.45, 580),
  }
  const camera = map.cameraForBounds(bounds, { padding, maxZoom: 7.5 })
  if (!camera) return
  map.flyTo({
    center: camera.center,
    zoom: camera.zoom,
    pitch: cameraPitch(CONTEXT_PITCH.region),
    bearing: cameraBearing('region'),
    duration,
  })
}

function flyToMunicipio(uf: string, codigo: string) {
  if (!map) return
  const bounds = mapLayers.municipioBoundsFor(uf, codigo)
  if (!bounds) return
  const duration = reduced.value ? 0 : 1200
  const padding = {
    top: 80,
    bottom: 90,
    left: 80,
    right: Math.min(map.getContainer().clientWidth * 0.45, 580),
  }
  const camera = map.cameraForBounds(bounds, { padding, maxZoom: 9 })
  if (!camera) return
  map.flyTo({
    center: camera.center,
    zoom: camera.zoom,
    pitch: cameraPitch(50),
    bearing: cameraBearing('region'),
    duration,
  })
}

/**
 * Close in on one bairro. Same framing as the município flight, just deeper:
 * bairros are small enough that fitting their bounds usually pins the camera
 * at MAX_ZOOM.
 */
function flyToSubdivisao(municipioCodigo: string, subdivisaoCodigo: string) {
  if (!map) return
  const bounds = mapLayers.subdivisaoBoundsFor(municipioCodigo, subdivisaoCodigo)
  if (!bounds) return
  const padding = {
    top: 80,
    bottom: 90,
    left: 80,
    right: Math.min(map.getContainer().clientWidth * 0.45, 580),
  }
  const camera = map.cameraForBounds(bounds, { padding, maxZoom: MAX_ZOOM })
  if (!camera) return
  map.flyTo({
    center: camera.center,
    zoom: camera.zoom,
    pitch: cameraPitch(50),
    bearing: cameraBearing('region'),
    duration: reduced.value ? 0 : 1100,
  })
}

onMounted(() => {
  if (!container.value) return
  map = new maplibregl.Map({
    container: container.value,
    style: baseMapStyle,
    center: NATIONAL_CAMERA.center,
    zoom: NATIONAL_CAMERA.zoom,
    pitch: NATIONAL_CAMERA.pitch,
    bearing: NATIONAL_CAMERA.bearing,
    // Floor the zoom-out so the world can't shrink to a tiny rectangle floating
    // in the void — that broke the immersion. At 2.2 the extended ocean grid
    // still fills the frame.
    minZoom: 2.2,
    maxZoom: MAX_ZOOM,
    maxPitch: MAX_PITCH,
    // deck.gl draws layers on world copy 0 only — don't render wrapped
    // copies of the base map that our layers would never cover.
    renderWorldCopies: false,
    attributionControl: false,
  })
  // No AttributionControl on purpose: the "(i)" toggle cluttered the corner
  // and the IBGE credit already lives permanently in the legend.
  if (import.meta.env.DEV) {
    ;(window as unknown as { __paMap?: maplibregl.Map }).__paMap = map
  }
  overlay = new MapboxOverlay({ interleaved: false, layers: [] })
  map.addControl(overlay as unknown as maplibregl.IControl)
  map.on('click', handleClick)
  // Cursor feeds the ocean grid's mouse bulge (screen UV, y up).
  map.on('mousemove', (event) => {
    if (!map) return
    const w = map.getContainer().clientWidth
    const h = map.getContainer().clientHeight
    oceanMouse.value = [event.point.x / w, 1 - event.point.y / h]
  })
  map.on('mouseout', () => {
    oceanMouse.value = null
  })
  // Country labels track the camera imperatively, in sync with the map's own
  // frames — no reactivity round-trip, so a drag never leaves them lagging.
  map.on('render', positionTradeLabels)
  map.on('move', positionTradeLabels)
  map.on('load', () => {
    mapReady.value = true
  })
  selection.setMapBearing(map.getBearing())
  map.on('rotate', () => {
    if (map) selection.setMapBearing(map.getBearing())
  })
  selection.setMapPitch(map.getPitch())
  map.on('pitch', () => {
    if (map) selection.setMapPitch(map.getPitch())
  })
  // Only user gestures (drag/keyboard) carry originalEvent — programmatic
  // flights must not be mistaken for a manual bearing/tilt choice.
  map.on('rotateend', (event) => {
    if (map && event.originalEvent) selection.setBearingOverride(map.getBearing())
  })
  map.on('pitchend', (event) => {
    if (map && event.originalEvent) selection.setPitchOverride(map.getPitch())
  })
  const animate = (now: number) => {
    rafId = requestAnimationFrame(animate)
    if (now - lastTick < 33) return // throttle to ~30fps
    lastTick = now
    // Reduced motion: hold the crest at full glow and the packets frozen
    // (they still form a dotted arc, just not moving).
    pulse.value = reduced.value ? 1 : 0.5 + 0.5 * Math.sin(now / 640)
    flowTime.value = reduced.value ? 0 : now / FLOW_LOOP_MS
    spawnRandomOceanDrop(now)
  }
  rafId = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  if (rafId !== undefined) cancelAnimationFrame(rafId)
  map?.remove()
  map = null
  overlay = null
})

watchEffect(() => {
  if (!mapReady.value || !overlay) return
  // Reading flowTime/pulse keeps this effect re-running each animation frame,
  // which is also when the ripple's elapsed time advances.
  const frame = flowTime.value
  void frame
  let rippleArg: { epicenter: [number, number]; elapsed: number } | null = null
  if (ripple.value) {
    const elapsedMs = performance.now() - ripple.value.start
    if (elapsedMs <= RIPPLE_LIFETIME_MS) {
      rippleArg = { epicenter: ripple.value.epicenter, elapsed: elapsedMs / 1000 }
    } else {
      ripple.value = null // decayed: let columns settle
    }
  }
  // Ocean grid ripples: drop the decayed ones, hand the rest their elapsed time.
  const nowMs = performance.now()
  const liveOcean = oceanRipples.value.filter((r) => nowMs - r.start <= OCEAN_RIPPLE_LIFETIME_MS)
  if (liveOcean.length !== oceanRipples.value.length) oceanRipples.value = liveOcean
  const oceanRippleArg = liveOcean.map((r) => ({
    epicenter: r.epicenter,
    elapsed: (nowMs - r.start) / 1000,
  }))
  overlay.setProps({
    layers: buildDeckLayers({
      model: mapLayers.layerModel,
      onHoverState: handleStateHover,
      onHoverMunicipio: handleMunicipioHover,
      onHoverSubdivisao: handleSubdivisaoHover,
      onHoverWorld: handleWorldHover,
      onHoverWorldState: handleWorldStateHover,
      onHoverDemografia: handleDemografiaHover,
      onHoverDemografiaBase: handleDemografiaBaseHover,
      pulse: pulse.value,
      flowTime: flowTime.value,
      zoom: map?.getZoom() ?? 3,
      ripple: rippleArg,
      oceanRipples: oceanRippleArg,
      oceanMouse: oceanMouse.value,
    }),
  })
})

// Rebuild the label set (which countries, colors) only when it actually
// changes — a signature keeps hovers from churning it — and let the per-frame
// positioning place the spans.
watch(
  () => {
    const model = mapLayers.layerModel
    const selectedIso = model.trade.highlights.find((h) => h.selected)?.iso ?? ''
    // Rebuild when the context flips, the world/partner data lands, or the
    // exploded partner changes (its label brightens).
    return `${model.globalIdle}|${model.world?.features.length ?? 0}|${comercio.partners.length}|${selectedIso}`
  },
  () => rebuildTradeLabels(),
  { immediate: true },
)

// One place decides the cursor: avoids the hover handlers fighting.
watchEffect(() => {
  if (!mapReady.value || !map) return
  map.getCanvas().style.cursor =
    selection.hoveredId ||
    selection.hoveredMunicipio ||
    selection.hoveredSubdivisao ||
    selection.hoveredWorld ||
    selection.hoveredWorldState ||
    selection.hoveredDemografia
      ? 'pointer'
      : ''
})

watch(
  () => selection.selectedId,
  (regionId) => {
    if (regionId) {
      void mapLayers.loadMunicipios(regionId)
      flyToRegion(regionId)
    }
  },
)

// Drill into / out of a municipality within the selected state.
watch(
  () => selection.selectedMunicipio?.codigo ?? null,
  (codigo) => {
    if (!selection.selectedId) return
    if (codigo) flyToMunicipio(selection.selectedId, codigo)
    else flyToRegion(selection.selectedId)
  },
)

// The subdivision mesh rides behind the município drill-down, either view.
watch(
  () => selection.drilledMunicipioCodigo,
  (codigo) => {
    if (codigo) void mapLayers.loadSubdivisoes(codigo)
  },
)

// Drill into / out of a bairro. Leaving one reframes on its município rather
// than holding the close-up on a bairro that is no longer selected.
watch(
  () => selection.selectedSubdivisao?.codigo ?? null,
  (codigo) => {
    const municipio = selection.drilledMunicipioCodigo
    if (!municipio) return
    if (codigo) {
      flyToSubdivisao(municipio, codigo)
    } else if (selection.demographicView) {
      const coordinates = muniByCodigo.value.get(municipio)?.coordinates
      if (coordinates) flyToDemografiaMunicipio(coordinates)
    } else if (selection.selectedId) {
      flyToMunicipio(selection.selectedId, municipio)
    }
  },
)

watch(
  () => selection.cameraRequest.seq,
  () => {
    if (selection.cameraRequest.target === 'global') flyToGlobal()
    else flyToRegion(null)
  },
)

watch(
  () => selection.rotateRequest.seq,
  () => {
    if (!map) return
    const { kind, delta } = selection.rotateRequest
    const duration = reduced.value ? 0 : 280
    if (kind === 'by') {
      const target = map.getBearing() + delta
      selection.setBearingOverride(target)
      map.easeTo({ bearing: target, duration })
    } else if (kind === 'north') {
      selection.setBearingOverride(0)
      map.easeTo({ bearing: 0, duration })
    } else {
      // AUTO: both manual bearing and manual tilt go back to the presets.
      selection.setBearingOverride(null)
      selection.setPitchOverride(null)
      map.easeTo({
        bearing: CONTEXT_BEARING[cameraContext],
        pitch: CONTEXT_PITCH[cameraContext],
        duration: reduced.value ? 0 : 600,
      })
    }
  },
)

// Tilt buttons: relative steps, clamped to MapLibre's supported range.
watch(
  () => selection.pitchRequest.seq,
  () => {
    if (!map) return
    const target = Math.min(
      MAX_PITCH,
      Math.max(0, map.getPitch() + selection.pitchRequest.delta),
    )
    selection.setPitchOverride(target)
    map.easeTo({ pitch: target, duration: reduced.value ? 0 : 280 })
  },
)

// Demographic view: crop the camera on the picked state (Esc clears -> BR).
watch(
  () => selection.demographicUf,
  (uf) => {
    if (selection.demographicView) flyToDemografiaUf(uf)
  },
)
</script>

<template>
  <div
    ref="container"
    class="map-root"
    role="application"
    aria-label="Mapa do Brasil — selecione um estado"
  ></div>
  <div class="horizon-fade" :style="{ opacity: horizonFadeOpacity }" aria-hidden="true"></div>
  <div ref="labelsContainer" class="country-labels" aria-hidden="true">
    <span
      v-for="label in tradeLabels"
      :key="label.key"
      class="clabel"
      :class="{
        'clabel--sel': label.selected,
        'clabel--br': label.kind === 'brasil',
        'clabel--sigla': label.kind === 'sigla',
      }"
      :style="{ color: label.color }"
      :data-lon="label.lon"
      :data-lat="label.lat"
      >{{ label.text }}</span
    >
  </div>
</template>

<style scoped>
.map-root {
  position: absolute;
  inset: 0;
  /* Transparent on purpose: the void background lives on .app-shell and the
     scan band (ScanBand.vue) slides between it and the map canvases. */
  background: transparent;
}

.map-root :deep(canvas) {
  outline: none;
}

.horizon-fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* rgb(3 6 8) mirrors --pa-bg-void; the gradient needs alpha stops, which
     the hex token can't express. */
  background: linear-gradient(
    to bottom,
    rgba(3, 6, 8, 0.95) 0%,
    rgba(3, 6, 8, 0.5) 12%,
    rgba(3, 6, 8, 0) 34%
  );
  transition: opacity 300ms ease;
}

/* HTML overlay for the trade country names — above the horizon fade so a tilt
   never clips them, and crisper than a deck TextLayer. */
.country-labels {
  position: absolute;
  inset: 0;
  z-index: 16;
  pointer-events: none;
  overflow: hidden;
}

.clabel {
  position: absolute;
  top: 0;
  left: 0;
  /* Parked off-screen until positionTradeLabels writes the real transform, so
     a freshly added label never flashes at the top-left corner. */
  transform: translate(-9999px, -9999px);
  font-family: 'Fira Code', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
  text-shadow:
    0 0 2px rgba(3, 6, 8, 0.95),
    0 0 4px rgba(3, 6, 8, 0.95),
    0 1px 2px rgba(3, 6, 8, 0.95);
  will-change: transform;
}

.clabel--sel {
  font-size: 11px;
}

/* The non-top-50 countries: just their sigla, smaller and dimmer so the named
   partners still stand out. */
.clabel--sigla {
  font-size: 8px;
  letter-spacing: 0.05em;
  opacity: 0.62;
}

.clabel--br {
  font-size: 13px;
  letter-spacing: 0.16em;
}
</style>
