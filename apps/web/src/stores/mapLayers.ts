import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { collectionBounds, featureBounds } from '@/lib/geo'
import type { BoundaryCollection, Bounds } from '@/lib/geo'
import type { AmbientSignal, PowerDimension } from '@/types/power-entity'

import { useRankingsStore } from './rankings'
import { useSelectionStore } from './selection'

export interface ColumnDatum {
  regionId: string
  dimension: PowerDimension
  /** Top entity score of that dimension — drives extrusion height. */
  score: number
  coordinates: [number, number]
}

export interface ArcDatum {
  id: string
  source: [number, number]
  target: [number, number]
  strength: number
  dimension: PowerDimension
  /** Arcs touching the selected region stay bright; others dim. */
  active: boolean
}

/** Plain-data model consumed by lib/deckLayers.ts (no deck.gl instances here). */
export interface MapLayerModel {
  ready: boolean
  states: BoundaryCollection | null
  national: BoundaryCollection | null
  selectedId: string | null
  hoveredId: string | null
  dataRegionIds: string[]
  columns: ColumnDatum[]
  arcs: ArcDatum[]
  heatmapPoints: AmbientSignal[]
  heatmapVisible: boolean
}

/** Twin columns straddle the capital: official west, hidden east. */
const COLUMN_LON_OFFSET = 0.32

export const useMapLayersStore = defineStore('mapLayers', () => {
  const selection = useSelectionStore()
  const rankings = useRankingsStore()

  const states = shallowRef<BoundaryCollection | null>(null)
  const national = shallowRef<BoundaryCollection | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const boundsByRegion = computed(() => {
    const byRegion = new Map<string, Bounds>()
    if (national.value) byRegion.set('BR', collectionBounds(national.value))
    for (const feature of states.value?.features ?? []) {
      byRegion.set(feature.properties.UF, featureBounds(feature))
    }
    return byRegion
  })

  const columns = computed<ColumnDatum[]>(() => {
    const out: ColumnDatum[] = []
    for (const region of rankings.data?.regions ?? []) {
      const [lon, lat] = region.capital.coordinates
      const top = (scores: { score: number }[]) =>
        scores.reduce((max, entity) => Math.max(max, entity.score), 0)
      out.push({
        regionId: region.id,
        dimension: 'official',
        score: top(region.official),
        coordinates: [lon - COLUMN_LON_OFFSET, lat],
      })
      out.push({
        regionId: region.id,
        dimension: 'hidden',
        score: top(region.hidden),
        coordinates: [lon + COLUMN_LON_OFFSET, lat],
      })
    }
    return out
  })

  const arcs = computed<ArcDatum[]>(() => {
    const capitals = new Map<string, [number, number]>()
    for (const region of rankings.data?.regions ?? []) {
      capitals.set(region.id, region.capital.coordinates)
    }
    return rankings.links.flatMap((link) => {
      const source = capitals.get(link.from)
      const target = capitals.get(link.to)
      if (!source || !target) return []
      const active =
        !selection.selectedId ||
        link.from === selection.selectedId ||
        link.to === selection.selectedId
      return [
        {
          id: link.id,
          source,
          target,
          strength: link.strength,
          dimension: link.dimension,
          active,
        },
      ]
    })
  })

  const layerModel = computed<MapLayerModel>(() => ({
    ready: states.value !== null && national.value !== null,
    states: states.value,
    national: national.value,
    selectedId: selection.selectedId,
    hoveredId: selection.hoveredId,
    dataRegionIds: rankings.dataRegionIds,
    columns: columns.value,
    arcs: arcs.value,
    heatmapPoints: rankings.ambientSignals,
    heatmapVisible: !selection.hasSelection,
  }))

  async function fetchBoundary(file: string): Promise<BoundaryCollection> {
    const response = await fetch(`${import.meta.env.BASE_URL}geo/${file}`)
    if (!response.ok) throw new Error(`Falha ao carregar ${file}: HTTP ${response.status}`)
    return (await response.json()) as BoundaryCollection
  }

  async function loadGeo() {
    if (loading.value || (states.value && national.value)) return
    loading.value = true
    error.value = null
    try {
      const [statesFc, nationalFc] = await Promise.all([
        fetchBoundary('brazil-states.geojson'),
        fetchBoundary('brazil-national.geojson'),
      ])
      states.value = statesFc
      national.value = nationalFc
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  function boundsFor(regionId: string): Bounds | null {
    return boundsByRegion.value.get(regionId) ?? null
  }

  return { states, national, loading, error, layerModel, loadGeo, boundsFor }
})
