<script setup lang="ts">
import type { PickingInfo } from '@deck.gl/core'
import { MapboxOverlay } from '@deck.gl/mapbox'
import maplibregl from 'maplibre-gl'
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'

import { useReducedMotion } from '@/composables/useReducedMotion'
import { buildDeckLayers } from '@/lib/deckLayers'
import type { BoundaryFeature } from '@/lib/geo'
import { baseMapStyle } from '@/lib/mapStyle'
import { useMapLayersStore } from '@/stores/mapLayers'
import { useSelectionStore } from '@/stores/selection'

const emit = defineEmits<{ (event: 'region-selected', regionId: string): void }>()

const container = ref<HTMLDivElement | null>(null)
const selection = useSelectionStore()
const mapLayers = useMapLayersStore()
const reduced = useReducedMotion()

let map: maplibregl.Map | null = null
let overlay: MapboxOverlay | null = null
const mapReady = ref(false)

const NATIONAL_CAMERA = {
  center: [-53.2, -14.6] as [number, number],
  zoom: 3.7,
  pitch: 45,
  bearing: -8,
}

function handleHover(info: PickingInfo<BoundaryFeature>) {
  const feature = info.object
  if (feature) {
    selection.setHovered(feature.properties.UF, feature.properties.name)
  } else {
    selection.setHovered(null)
  }
  if (map) map.getCanvas().style.cursor = feature ? 'pointer' : ''
}

function handleClick(event: maplibregl.MapMouseEvent) {
  if (!overlay) return
  const info = overlay.pickObject({
    x: event.point.x,
    y: event.point.y,
    radius: 4,
    layerIds: ['states-choropleth'],
  }) as PickingInfo<BoundaryFeature> | null
  const feature = info?.object
  if (feature) {
    const { UF, name } = feature.properties
    selection.select(UF, name, { x: event.point.x, y: event.point.y })
    emit('region-selected', UF)
  } else {
    selection.clear()
  }
}

function flyToRegion(regionId: string | null) {
  if (!map) return
  const duration = reduced.value ? 0 : 1400
  if (!regionId || regionId === 'BR') {
    map.flyTo({ ...NATIONAL_CAMERA, duration })
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
    pitch: 52,
    bearing: -12,
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
    minZoom: 3,
    maxZoom: 9,
    attributionControl: false,
  })
  map.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution: 'Malhas territoriais: IBGE',
    }),
    'bottom-right',
  )
  overlay = new MapboxOverlay({ interleaved: false, layers: [] })
  map.addControl(overlay as unknown as maplibregl.IControl)
  map.on('click', handleClick)
  map.on('load', () => {
    mapReady.value = true
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
    layers: buildDeckLayers({ model: mapLayers.layerModel, onHover: handleHover }),
  })
})

watch(
  () => selection.selectedId,
  (regionId) => flyToRegion(regionId),
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
  background: var(--pa-bg-void);
}

.map-root :deep(canvas) {
  outline: none;
}
</style>
