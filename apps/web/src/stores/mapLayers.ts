import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { HIDDEN_INFLUENCE_ENABLED, INFLUENCE_ARCS_ENABLED } from '@/lib/features'
import { collectionBounds, featureBounds } from '@/lib/geo'
import type {
  BoundaryCollection,
  Bounds,
  MunicipioCollection,
  WorldCollection,
} from '@/lib/geo'
import type { FiscalSegmentKey } from '@/lib/fiscalSegments'
import type { DemografiaMetric, DemografiaMunicipio } from '@/types/demografia'
import type { FiscalMunicipio } from '@/types/fiscal'
import type { AmbientSignal, PowerDimension } from '@/types/power-entity'

import { useDemografiaStore } from './demografia'
import { useFiscalStore } from './fiscal'
import { useRankingsStore } from './rankings'
import { useSelectionStore } from './selection'

export interface ColumnDatum {
  regionId: string
  dimension: PowerDimension
  /** Top entity score of that dimension — drives extrusion height. */
  score: number
  coordinates: [number, number]
}

export interface LabelDatum {
  regionId: string
  text: string
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
  /** "Em breve" backdrop (world minus Brazil). */
  world: WorldCollection | null
  selectedId: string | null
  hoveredId: string | null
  hoveredWorldIso: string | null
  dataRegionIds: string[]
  columns: ColumnDatum[]
  arcs: ArcDatum[]
  labels: LabelDatum[]
  /** Municipal mesh of the selected state (all 27 UFs), or null. */
  municipios: MunicipioCollection | null
  selectedMunicipioCodigo: string | null
  hoveredMunicipioCodigo: string | null
  heatmapPoints: AmbientSignal[]
  heatmapVisible: boolean
  /** Merged municipal outlines of every loaded UF mesh (context lines). */
  municipalBorders: MunicipioCollection | null
  /** Demographic view: per-município columns replace the influence layers. */
  demographic: {
    active: boolean
    metric: DemografiaMetric
    munis: DemografiaMunicipio[]
    hoveredCodigo: string | null
    /** Município of the open city card (focused flow arcs). */
    selectedCodigo: string | null
    /** State the camera is cropped on (click selects; Esc clears). */
    uf: string | null
    /** Fiscal overlay: real federal flows per município (PIB metric only). */
    fiscal: {
      /** Per-segment visibility (previdencia, ir, … / fpm, fundeb, …). */
      segments: Record<FiscalSegmentKey, boolean>
      byCodigo: Map<string, FiscalMunicipio> | null
    }
  }
}

/** Twin columns straddle the capital: official west, hidden east. */
const COLUMN_LON_OFFSET = 0.32

export const useMapLayersStore = defineStore('mapLayers', () => {
  const selection = useSelectionStore()
  const rankings = useRankingsStore()
  const demografia = useDemografiaStore()
  const fiscal = useFiscalStore()

  const states = shallowRef<BoundaryCollection | null>(null)
  const national = shallowRef<BoundaryCollection | null>(null)
  const world = shallowRef<WorldCollection | null>(null)
  const municipiosByUf = shallowRef<Map<string, MunicipioCollection>>(new Map())
  // Non-reactive: UFs already fetched (successes and 404s) so we never retry.
  const municipioAttempts = new Set<string>()
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
        // Solo column sits on the capital; twins straddle it once the
        // hidden dimension unlocks.
        coordinates: [HIDDEN_INFLUENCE_ENABLED ? lon - COLUMN_LON_OFFSET : lon, lat],
      })
      if (HIDDEN_INFLUENCE_ENABLED) {
        out.push({
          regionId: region.id,
          dimension: 'hidden',
          score: top(region.hidden),
          coordinates: [lon + COLUMN_LON_OFFSET, lat],
        })
      }
    }
    return out
  })

  const arcs = computed<ArcDatum[]>(() => {
    if (!INFLUENCE_ARCS_ENABLED) return []
    const capitals = new Map<string, [number, number]>()
    for (const region of rankings.data?.regions ?? []) {
      capitals.set(region.id, region.capital.coordinates)
    }
    return rankings.links.flatMap((link) => {
      if (!HIDDEN_INFLUENCE_ENABLED && link.dimension === 'hidden') return []
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

  const labels = computed<LabelDatum[]>(() =>
    (rankings.data?.regions ?? [])
      .filter((region) => region.kind === 'state')
      .map((region) => ({
        regionId: region.id,
        text: region.id,
        coordinates: region.capital.coordinates,
      })),
  )

  /**
   * All loaded municipal meshes merged into one collection: context outlines
   * for both the influence and the demographic views. Fills in progressively
   * while loadAllMunicipios streams the 27 UF meshes in.
   */
  const municipalBorders = computed<MunicipioCollection | null>(() => {
    const collections = [...municipiosByUf.value.values()]
    if (collections.length === 0) return null
    return {
      type: 'FeatureCollection',
      features: collections.flatMap((collection) => collection.features),
    } as MunicipioCollection
  })

  const layerModel = computed<MapLayerModel>(() => ({
    ready: states.value !== null && national.value !== null,
    states: states.value,
    national: national.value,
    world: world.value,
    selectedId: selection.selectedId,
    hoveredId: selection.hoveredId,
    hoveredWorldIso: selection.hoveredWorld?.iso ?? null,
    dataRegionIds: rankings.dataRegionIds,
    columns: columns.value,
    arcs: arcs.value,
    labels: labels.value,
    municipios: selection.selectedId
      ? (municipiosByUf.value.get(selection.selectedId) ?? null)
      : null,
    selectedMunicipioCodigo: selection.selectedMunicipio?.codigo ?? null,
    hoveredMunicipioCodigo: selection.hoveredMunicipio?.codigo ?? null,
    heatmapPoints: rankings.ambientSignals,
    heatmapVisible: !selection.hasSelection && !selection.demographicView,
    municipalBorders: municipalBorders.value,
    demographic: {
      active: selection.demographicView,
      metric: selection.demographicMetric,
      munis: selection.demographicView ? demografia.municipios : [],
      hoveredCodigo: selection.hoveredDemografia?.codigo ?? null,
      selectedCodigo: selection.selectedDemografia?.codigo ?? null,
      uf: selection.demographicUf,
      fiscal: {
        segments: selection.fiscalSegments,
        byCodigo: fiscal.byCodigo.size > 0 ? fiscal.byCodigo : null,
      },
    },
  }))

  async function fetchGeoFile<T>(file: string): Promise<T> {
    const response = await fetch(`${import.meta.env.BASE_URL}geo/${file}`)
    if (!response.ok) throw new Error(`Falha ao carregar ${file}: HTTP ${response.status}`)
    return (await response.json()) as T
  }

  async function loadGeo() {
    if (loading.value || (states.value && national.value)) return
    loading.value = true
    error.value = null
    try {
      const [statesFc, nationalFc, worldFc] = await Promise.all([
        fetchGeoFile<BoundaryCollection>('brazil-states.geojson'),
        fetchGeoFile<BoundaryCollection>('brazil-national.geojson'),
        fetchGeoFile<WorldCollection>('world-countries.geojson'),
      ])
      states.value = statesFc
      national.value = nationalFc
      world.value = worldFc
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  function boundsFor(regionId: string): Bounds | null {
    return boundsByRegion.value.get(regionId) ?? null
  }

  /**
   * Lazily fetch a state's municipal mesh (pilot: only SP has a file). A
   * missing file is a silent no-op: under SPA hosting (dev preview, Netlify) a
   * missing path falls back to index.html with a 200, so we also reject any
   * response that is not a FeatureCollection. Only genuine network errors are
   * left retryable; "no mesh for this UF" is remembered so we never re-fetch.
   */
  async function loadMunicipios(uf: string) {
    if (uf === 'BR' || municipioAttempts.has(uf)) return
    municipioAttempts.add(uf)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}geo/municipios/${uf}.geojson`)
      if (!response.ok) return
      const text = await response.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        return // SPA fallback (HTML), not a mesh — keep as attempted, no retry
      }
      if ((data as MunicipioCollection)?.type !== 'FeatureCollection') return
      const next = new Map(municipiosByUf.value)
      next.set(uf, data as MunicipioCollection)
      municipiosByUf.value = next
    } catch {
      municipioAttempts.delete(uf) // network error: allow a later retry
    }
  }

  /**
   * Fetch every UF's municipal mesh (demographic-view outlines). Meshes load
   * one by one and appear as they land; already-loaded UFs are no-ops thanks
   * to loadMunicipios' attempt cache.
   */
  async function loadAllMunicipios() {
    const ufs = states.value?.features.map((feature) => feature.properties.UF) ?? []
    await Promise.allSettled(ufs.map((uf) => loadMunicipios(uf)))
  }

  /** UF sigla for a 7-digit IBGE municipality code (first 2 digits = state). */
  function ufFromMunicipioCodigo(codigo: string): string | null {
    const feature = states.value?.features.find(
      (candidate) => candidate.properties.codarea === codigo.slice(0, 2),
    )
    return feature?.properties.UF ?? null
  }

  function municipioBoundsFor(uf: string, codigo: string): Bounds | null {
    const feature = municipiosByUf.value.get(uf)?.features.find((f) => f.properties.codigo === codigo)
    return feature ? featureBounds(feature) : null
  }

  return {
    states,
    national,
    world,
    loading,
    error,
    layerModel,
    loadGeo,
    boundsFor,
    loadMunicipios,
    loadAllMunicipios,
    municipioBoundsFor,
    ufFromMunicipioCodigo,
  }
})
