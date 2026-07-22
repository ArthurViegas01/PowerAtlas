<script setup lang="ts">
import type { PickingInfo } from '@deck.gl/core'
import { MapboxOverlay } from '@deck.gl/mapbox'
import maplibregl from 'maplibre-gl'
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'

import { useReducedMotion } from '@/composables/useReducedMotion'
import { buildDeckLayers } from '@/lib/deckLayers'
import type { Bounds, BoundaryFeature, MunicipioFeature, WorldFeature } from '@/lib/geo'
import { baseMapStyle } from '@/lib/mapStyle'
import { useMapLayersStore } from '@/stores/mapLayers'
import { useSelectionStore } from '@/stores/selection'
import type { DemografiaMunicipio } from '@/types/demografia'

const emit = defineEmits<{ (event: 'region-selected', regionId: string): void }>()

const container = ref<HTMLDivElement | null>(null)
const selection = useSelectionStore()
const mapLayers = useMapLayersStore()
const reduced = useReducedMotion()

let map: maplibregl.Map | null = null
let overlay: MapboxOverlay | null = null
const mapReady = ref(false)

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

function handleClick(event: maplibregl.MapMouseEvent) {
  if (!overlay) return
  // Demographic view: a state click crops the camera to it (picking only the
  // choropleth, so clicks land "through" the columns); anything else no-ops.
  if (selection.demographicView) {
    const info = overlay.pickObject({
      x: event.point.x,
      y: event.point.y,
      radius: 4,
      layerIds: ['states-choropleth'],
    })
    if (info?.layer?.id === 'states-choropleth') {
      const { UF } = (info as PickingInfo<BoundaryFeature>).object!.properties
      selection.selectDemographicUf(UF)
    }
    return
  }
  const point = { x: event.point.x, y: event.point.y }
  const info = overlay.pickObject({
    ...point,
    radius: 4,
    layerIds: ['municipios', 'states-choropleth', 'world-countries'],
  })
  if (info?.layer?.id === 'municipios') {
    const { codigo, name } = (info as PickingInfo<MunicipioFeature>).object!.properties
    selection.selectMunicipio(codigo, name, point)
  } else if (info?.layer?.id === 'states-choropleth') {
    const { UF, name } = (info as PickingInfo<BoundaryFeature>).object!.properties
    selection.select(UF, name, point)
    emit('region-selected', UF)
  } else if (info?.layer?.id === 'world-countries') {
    const { iso, name } = (info as PickingInfo<WorldFeature>).object!.properties
    selection.lockWorld({ iso, name }, point)
  } else {
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

onMounted(() => {
  if (!container.value) return
  map = new maplibregl.Map({
    container: container.value,
    style: baseMapStyle,
    center: NATIONAL_CAMERA.center,
    zoom: NATIONAL_CAMERA.zoom,
    pitch: NATIONAL_CAMERA.pitch,
    bearing: NATIONAL_CAMERA.bearing,
    minZoom: 1.5,
    maxZoom: 9,
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
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  overlay = null
})

watchEffect(() => {
  if (!mapReady.value || !overlay) return
  overlay.setProps({
    layers: buildDeckLayers({
      model: mapLayers.layerModel,
      onHoverState: handleStateHover,
      onHoverMunicipio: handleMunicipioHover,
      onHoverWorld: handleWorldHover,
      onHoverDemografia: handleDemografiaHover,
    }),
  })
})

// One place decides the cursor: avoids the hover handlers fighting.
watchEffect(() => {
  if (!mapReady.value || !map) return
  map.getCanvas().style.cursor =
    selection.hoveredId || selection.hoveredMunicipio || selection.hoveredWorld
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
</style>
