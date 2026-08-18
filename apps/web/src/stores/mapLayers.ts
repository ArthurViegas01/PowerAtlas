import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { countryRgb, DEFAULT_COUNTRY_RGB } from '@/lib/countryColors'
import { HIDDEN_INFLUENCE_ENABLED, INFLUENCE_ARCS_ENABLED } from '@/lib/features'
import { collectionBounds, featureBounds } from '@/lib/geo'
import type {
  SubdivisaoCollection,
  SubdivisaoIndex,
  SubdivisaoInfo,
  BoundaryCollection,
  Bounds,
  MunicipioCollection,
  WorldCollection,
  WorldStateCollection,
} from '@/lib/geo'
import type { FiscalSegmentKey } from '@/lib/fiscalSegments'
import { ICON_COLOR, iconForVocacao, type SectorIconPlacement } from '@/lib/sectorIcons'
import type { DemografiaMetric, DemografiaMunicipio } from '@/types/demografia'
import type { FiscalMunicipio } from '@/types/fiscal'
import { directionValue, TRADE_ORIGIN, type TradeDirection } from '@/types/comercio'
import type { AmbientSignal, PowerDimension } from '@/types/power-entity'

import { useComercioStore } from './comercio'
import { useDemografiaStore } from './demografia'
import { useFiscalStore } from './fiscal'
import { usePartidosStore } from './partidos'
import { useRankingsStore } from './rankings'
import { useSelectionStore } from './selection'
import { useVocacaoStore } from './vocacao'

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

/**
 * One world trade arrow, Brazil -> partner country. The renderer supplies the
 * origin (TRADE_ORIGIN) and animates the marching stripes; this carries only
 * the target, the normalized width and how to color it. Default arcs color by
 * direction (cyan export / amber import); when a partner is exploded, each arc
 * is one of its sectors and carries the sector's palette slot.
 */
export interface TradeArcDatum {
  key: string
  /** Flow direction of this arc — exports run Brazil->partner, imports back. */
  direction: TradeDirection
  /** Origin end; defaults to TRADE_ORIGIN, offset into a lane when both dirs show.
   *  In the exploded per-sector view it is the specialist state's centroid. */
  source?: [number, number]
  /** Sigla of the specialist state the exploded sector arc originates from. */
  originUf?: string
  target: [number, number]
  /** 0..1 (√ of value / max) for the arc width. */
  weight: number
  /** Bright when true, dimmed for context when another partner is hovered. */
  focus: boolean
  /** National color for the default (per-partner) arcs. */
  colorRgb?: [number, number, number]
  /** Present only for exploded sector arcs — its palette slot and code. */
  sectorIndex?: number
  sectorCode?: string
}

/** A partner country highlighted on the world map (filled + labeled). */
export interface TradeHighlight {
  iso: string
  name: string
  coordinates: [number, number]
  /** National-identity color for the fill, label and arrow. */
  color: [number, number, number]
  /** The partner currently exploded into sectors (brighter fill + label). */
  selected: boolean
}

/** Plain-data model consumed by lib/deckLayers.ts (no deck.gl instances here). */
export interface MapLayerModel {
  ready: boolean
  states: BoundaryCollection | null
  national: BoundaryCollection | null
  /** "Em breve" backdrop (world minus Brazil). */
  world: WorldCollection | null
  /** Admin-1 divisions of a few large countries (borders only, não mapeado). */
  worldStates: WorldStateCollection | null
  selectedId: string | null
  hoveredId: string | null
  hoveredWorldIso: string | null
  /** iso|name of the foreign province under the cursor (border highlight). */
  hoveredWorldStateKey: string | null
  dataRegionIds: string[]
  columns: ColumnDatum[]
  arcs: ArcDatum[]
  labels: LabelDatum[]
  /** Municipal mesh of the selected state (all 27 UFs), or null. */
  municipios: MunicipioCollection | null
  selectedMunicipioCodigo: string | null
  hoveredMunicipioCodigo: string | null
  /** Bairro mesh of the drilled município — the deepest zoom level. */
  subdivisoes: SubdivisaoCollection | null
  selectedSubdivisaoCodigo: string | null
  hoveredSubdivisaoCodigo: string | null
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
  /** World trade arrows (Visão Global): Brazil -> partner countries. */
  trade: {
    /** Arrows should render (global context + toggle on + data loaded). */
    active: boolean
    /** Whether the animated arrows draw (colors/labels stay regardless). */
    arrowsVisible: boolean
    direction: TradeDirection
    /** One arc per top partner, or one per sector when a partner is exploded. */
    arcs: TradeArcDatum[]
    /** True while showing a single partner's sectors (colors by sector). */
    exploded: boolean
    /** Partner countries to fill + label in their national colors. */
    highlights: TradeHighlight[]
  }
  /** True in the global idle context: hide state siglas, show the BRASIL tag. */
  globalIdle: boolean
  /**
   * Camada política: quando ativa, os municípios do país inteiro são pintados
   * pela cor do partido do prefeito eleito (byCodigo: IBGE 7 díg -> sigla).
   */
  political: {
    active: boolean
    byCodigo: Map<string, string>
  }
  /** Low-poly 3D sector objects: one per UF vocation (world view) or per top
   *  município vocation (demographic view cropped to a state). */
  sectorIcons: SectorIconPlacement[]
}

/** Twin columns straddle the capital: official west, hidden east. */
const COLUMN_LON_OFFSET = 0.32

export const useMapLayersStore = defineStore('mapLayers', () => {
  const selection = useSelectionStore()
  const rankings = useRankingsStore()
  const demografia = useDemografiaStore()
  const fiscal = useFiscalStore()
  const comercio = useComercioStore()
  const vocacao = useVocacaoStore()
  const partidos = usePartidosStore()

  const states = shallowRef<BoundaryCollection | null>(null)
  const national = shallowRef<BoundaryCollection | null>(null)
  const world = shallowRef<WorldCollection | null>(null)
  const worldStates = shallowRef<WorldStateCollection | null>(null)
  const municipiosByUf = shallowRef<Map<string, MunicipioCollection>>(new Map())
  // Non-reactive: UFs already fetched (successes and 404s) so we never retry.
  const municipioAttempts = new Set<string>()
  const subdivisoesByMunicipio = shallowRef<Map<string, SubdivisaoCollection>>(new Map())
  const subdivisaoIndex = shallowRef<SubdivisaoIndex | null>(null)
  const subdivisaoAttempts = new Set<string>()
  let subdivisaoIndexAttempted = false
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

  /** How many partners the default (unexploded) view draws arrows/highlights for. */
  const TRADE_TOP_PARTNERS = 20

  /**
   * Half-extent (degrees) of every world country, from its mainland bounds.
   * Scales the exploded sector fan to the country's size so a small partner
   * (Espanha) keeps every arrow on its own territory instead of spraying past
   * it, while a large one (China) spreads its sectors across the landmass.
   */
  const worldRadius = computed(() => {
    const radii = new Map<string, number>()
    for (const feature of world.value?.features ?? []) {
      const [[w, s], [e, n]] = featureBounds(feature)
      radii.set(feature.properties.iso, 0.5 * Math.max(e - w, n - s))
    }
    return radii
  })

  /** Lateral separation (degrees) of the export/import lanes when both show. */
  const TRADE_LANE_DEG = 1.6

  /**
   * The federal capital. Exports leave the producing state (soja -> MT), but
   * imports enter the country through Brasília, so an exploded import arc lands
   * on the capital instead of spraying across the states that happen to book it.
   */
  const BRASILIA: [number, number] = [-47.8825, -15.7942]

  const trade = computed(() => {
    // Arrows belong to the global context: no Brazilian region drilled into,
    // the demographic view off, and the legend toggle on.
    const active =
      selection.tradeVisible &&
      !selection.demographicView &&
      !selection.selectedId &&
      !selection.selectedMunicipio &&
      comercio.partners.length > 0
    const dirs = selection.tradeDirs
    const both = dirs.length > 1
    // Primary direction: drives the exploded sectors and any single-value fallback.
    const primary: TradeDirection = dirs.includes('export') ? 'export' : 'import'
    if (!active)
      return {
        active: false,
        arrowsVisible: selection.tradeArrowsVisible,
        direction: primary,
        arcs: [] as TradeArcDatum[],
        exploded: false,
        highlights: [] as TradeHighlight[],
      }

    const hoveredIso = selection.hoveredWorld?.iso ?? null
    const selectedIso = selection.selectedPartner?.iso ?? null
    const selected = selectedIso ? (comercio.byIso.get(selectedIso) ?? null) : null
    const rgbOf = (iso: string): [number, number, number] => countryRgb(iso) ?? DEFAULT_COUNTRY_RGB
    const arcs: TradeArcDatum[] = []

    if (selected) {
      // Explode the partner into per-sector arcs (primary direction only, to
      // keep a small country readable), fanned around its centroid. The fan
      // width is capped at the country's own radius so endpoints stay on it.
      const sectors = selected.sectors
        .map((sector, index) => ({ sector, index }))
        .filter(({ sector }) => directionValue(sector, primary) > 0)
      const maxValue = sectors.reduce((max, { sector }) => Math.max(max, directionValue(sector, primary)), 1)
      const [tx, ty] = selected.coordinates
      const dx = tx - TRADE_ORIGIN[0]
      const dy = ty - TRADE_ORIGIN[1]
      const len = Math.hypot(dx, dy) || 1
      const px = -dy / len
      const py = dx / len
      const n = sectors.length
      const fanWidth = Math.min(Math.max(worldRadius.value.get(selected.iso) ?? 3, 0.6), 8)
      const step = n > 1 ? fanWidth / (n - 1) : 0
      sectors.forEach(({ sector, index }, k) => {
        const offset = (k - (n - 1) / 2) * step
        // The Brazilian end depends on the flow's sense. Exports leave the state
        // that produces the commodity (soja -> MT, minério -> PA, aeronaves ->
        // SP), tying the specialist state to the world buyer. Imports come back
        // into the country through Brasília, the capital. Export falls back to
        // TRADE_ORIGIN (the map center) until uf.json loads or when the pair has
        // no booked origin UF.
        const origin =
          primary === 'export' ? vocacao.originUf(selected.iso, sector.code, 'export') : null
        const source: [number, number] | undefined =
          primary === 'export' ? origin?.coordinates : BRASILIA
        arcs.push({
          key: `${selected.iso}:${sector.code}`,
          direction: primary,
          source,
          originUf: primary === 'export' ? origin?.uf : 'DF',
          target: [tx + px * offset, ty + py * offset],
          weight: Math.sqrt(directionValue(sector, primary) / maxValue),
          focus: true,
          sectorIndex: index,
          sectorCode: sector.code,
        })
      })
      const highlights: TradeHighlight[] = [
        {
          iso: selected.iso,
          name: selected.name,
          coordinates: selected.coordinates,
          color: rgbOf(selected.iso),
          selected: true,
        },
      ]
      return {
        active: true,
        arrowsVisible: selection.tradeArrowsVisible,
        direction: primary,
        arcs,
        exploded: true,
        highlights,
      }
    }

    // Default: top partners ranked by their combined enabled flow, each in its
    // national color. With both directions on, every partner gets two arcs in
    // opposite senses, offset into parallel lanes so they don't overlap.
    const rankValue = (partner: (typeof comercio.partners)[number]) =>
      dirs.reduce((sum, d) => sum + directionValue(partner, d), 0)
    const ranked = [...comercio.partners]
      .filter((partner) => rankValue(partner) > 0)
      .sort((a, b) => rankValue(b) - rankValue(a))
      .slice(0, TRADE_TOP_PARTNERS)
    const maxByDir: Record<TradeDirection, number> = {
      export: Math.max(1, ...ranked.map((p) => p.exp)),
      import: Math.max(1, ...ranked.map((p) => p.imp)),
    }
    const highlights: TradeHighlight[] = []
    for (const partner of ranked) {
      const color = rgbOf(partner.iso)
      const focus = !hoveredIso || partner.iso === hoveredIso
      const [tx, ty] = partner.coordinates
      const dx = tx - TRADE_ORIGIN[0]
      const dy = ty - TRADE_ORIGIN[1]
      const len = Math.hypot(dx, dy) || 1
      const px = -dy / len
      const py = dx / len
      // Export leaves the production origin: the state behind this partner's
      // biggest export sector (soja -> MT, minério -> PA), so the arrow visibly
      // departs from where the goods come from. Import returns to Brasília. Only
      // the partner (target) end is lane-offset, so the two arrows to the same
      // country stay separated while each Brazilian end keeps its true anchor.
      // Skip the aggregated "Outros" bucket (ZZ): it has no single HS chapter,
      // so no origin state — use the biggest real sector instead.
      const topExport = partner.sectors.reduce<{ code: string; exp: number } | null>(
        (best, sector) =>
          sector.code !== 'ZZ' && sector.exp > (best?.exp ?? 0) ? sector : best,
        null,
      )
      const exportOrigin =
        (topExport ? vocacao.originUf(partner.iso, topExport.code, 'export') : null)?.coordinates ??
        TRADE_ORIGIN
      for (const d of dirs) {
        const value = directionValue(partner, d)
        if (value <= 0) continue
        const lane = both ? (d === 'export' ? TRADE_LANE_DEG : -TRADE_LANE_DEG) : 0
        arcs.push({
          key: `${partner.iso}:${d}`,
          direction: d,
          source: d === 'export' ? exportOrigin : BRASILIA,
          originUf: d === 'export' ? undefined : 'DF',
          target: [tx + px * lane, ty + py * lane],
          weight: Math.sqrt(value / maxByDir[d]),
          focus,
          colorRgb: color,
        })
      }
      highlights.push({
        iso: partner.iso,
        name: partner.name,
        coordinates: partner.coordinates,
        color,
        selected: false,
      })
    }
    return {
      active: true,
      arrowsVisible: selection.tradeArrowsVisible,
      direction: primary,
      arcs,
      exploded: false,
      highlights,
    }
  })

  // 3D sector objects. State view: one icon per UF at ~90 km. Demographic view
  // cropped to a state: the top municípios by VAB, at ~26 km, so the drill-down
  // reads its own vocation without crowding 5.570 icons onto the map.
  const STATE_ICON_M = 90000
  const MUNI_ICON_M = 26000
  const MUNI_ICONS_MAX = 40

  const sectorIcons = computed<SectorIconPlacement[]>(() => {
    // Demographic view: only once cropped to a single state (else 5.570 icons).
    if (selection.demographicView) {
      const sigla = selection.demographicUf
      if (!sigla) return []
      const prefix = states.value?.features.find((f) => f.properties.UF === sigla)
        ?.properties.codarea
      if (!prefix) return []
      const ranked = demografia.municipios
        .filter((m) => m.codigo.startsWith(prefix))
        .map((m) => ({ m, vab: vocacao.municipioBy.get(m.codigo)?.vabTotal ?? 0 }))
        .sort((a, b) => b.vab - a.vab)
        .slice(0, MUNI_ICONS_MAX)
      const out: SectorIconPlacement[] = []
      for (const { m } of ranked) {
        const dominant = vocacao.dominantFor(m.codigo)
        if (!dominant) continue
        const mesh = iconForVocacao(dominant.key)
        out.push({ position: m.coordinates, mesh, color: ICON_COLOR[mesh], scale: MUNI_ICON_M })
      }
      return out
    }
    // World view (nothing drilled, no demographic): one icon per UF vocation.
    if (!selection.selectedId && !selection.selectedMunicipio) {
      return vocacao.ufIcons.map((icon) => ({
        position: icon.coordinates,
        mesh: icon.mesh,
        color: icon.color,
        scale: STATE_ICON_M,
      }))
    }
    return []
  })

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
    worldStates: worldStates.value,
    selectedId: selection.selectedId,
    hoveredId: selection.hoveredId,
    hoveredWorldIso: selection.hoveredWorld?.iso ?? null,
    hoveredWorldStateKey: selection.hoveredWorldState
      ? `${selection.hoveredWorldState.iso}|${selection.hoveredWorldState.name}`
      : null,
    dataRegionIds: rankings.dataRegionIds,
    columns: columns.value,
    arcs: arcs.value,
    labels: labels.value,
    municipios: selection.selectedId
      ? (municipiosByUf.value.get(selection.selectedId) ?? null)
      : null,
    selectedMunicipioCodigo: selection.selectedMunicipio?.codigo ?? null,
    hoveredMunicipioCodigo: selection.hoveredMunicipio?.codigo ?? null,
    subdivisoes: selection.drilledMunicipioCodigo
      ? (subdivisoesByMunicipio.value.get(selection.drilledMunicipioCodigo) ?? null)
      : null,
    selectedSubdivisaoCodigo: selection.selectedSubdivisao?.codigo ?? null,
    hoveredSubdivisaoCodigo: selection.hoveredSubdivisao?.codigo ?? null,
    heatmapPoints: rankings.ambientSignals,
    // The ambient cyan glow steps aside for the trade arrows (and Brazil's
    // green identity) whenever they are showing.
    heatmapVisible:
      !selection.hasSelection && !selection.demographicView && !selection.tradeVisible,
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
    trade: trade.value,
    globalIdle:
      !selection.selectedId && !selection.selectedMunicipio && !selection.demographicView,
    political: {
      // Colore os municípios pelo partido. Vale no contexto nacional E com um
      // estado selecionado (as cores dos municípios seguem no drill-down); só o
      // modo demográfico, que tem sua própria paleta, a desliga.
      active:
        selection.partisanVisible &&
        !selection.demographicView &&
        partidos.byCodigo.size > 0,
      byCodigo: partidos.byCodigo,
    },
    sectorIcons: sectorIcons.value,
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
      const [statesFc, nationalFc, worldFc, worldStatesFc] = await Promise.all([
        fetchGeoFile<BoundaryCollection>('brazil-states.geojson'),
        fetchGeoFile<BoundaryCollection>('brazil-national.geojson'),
        fetchGeoFile<WorldCollection>('world-countries.geojson'),
        // Admin-1 borders of a few big countries; a missing file is non-fatal
        // (the backdrop simply loses its province lines), so it never blocks boot.
        fetchGeoFile<WorldStateCollection>('world-states.geojson').catch(() => null),
      ])
      states.value = statesFc
      national.value = nationalFc
      world.value = worldFc
      worldStates.value = worldStatesFc
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

  /**
   * The bairro coverage index: which municípios carry an official IBGE bairro
   * division (895 of the 5.570) and how many bairros each has. Fetched once,
   * on the first drill-down, so the app can tell "not loaded yet" apart from
   * "this município has no bairros" without firing a request that 404s.
   */
  async function loadSubdivisaoIndex() {
    if (subdivisaoIndexAttempted) return
    subdivisaoIndexAttempted = true
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}geo/subdivisoes/index.json`)
      if (!response.ok) return
      const text = await response.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        return // SPA fallback (HTML), not the index — keep attempted, no retry
      }
      if ((data as SubdivisaoIndex)?.municipios) subdivisaoIndex.value = data as SubdivisaoIndex
    } catch {
      subdivisaoIndexAttempted = false // network error: allow a later retry
    }
  }

  /**
   * Lazily fetch one município's bairro mesh (same attempt-cache contract as
   * loadMunicipios). Municípios the index reports as having no bairros are
   * settled without any request at all.
   */
  async function loadSubdivisoes(codigo: string) {
    if (subdivisaoAttempts.has(codigo)) return
    subdivisaoAttempts.add(codigo)
    await loadSubdivisaoIndex()
    // Absent from the index = IBGE never divided this município into bairros.
    if (subdivisaoIndex.value && !(codigo in subdivisaoIndex.value.municipios)) return
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}geo/subdivisoes/${codigo}.geojson`)
      if (!response.ok) return
      const text = await response.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        return // SPA fallback (HTML), not a mesh — keep as attempted, no retry
      }
      if ((data as SubdivisaoCollection)?.type !== 'FeatureCollection') return
      const next = new Map(subdivisoesByMunicipio.value)
      next.set(codigo, data as SubdivisaoCollection)
      subdivisoesByMunicipio.value = next
    } catch {
      subdivisaoAttempts.delete(codigo) // network error: allow a later retry
    }
  }

  /**
   * How a município is subdivided: the unit count and whether those units are
   * bairros or distritos. `null` while the index has not landed (so the UI
   * stays quiet instead of claiming "sem subdivisão" prematurely), and a zero
   * count when IBGE gives the município no division worth drilling into.
   */
  function subdivisaoInfoFor(codigo: string | null): SubdivisaoInfo | null {
    if (!codigo || !subdivisaoIndex.value) return null
    return subdivisaoIndex.value.municipios[codigo] ?? { count: 0, level: 'bairro' }
  }

  function subdivisaoBoundsFor(municipioCodigo: string, bairroCodigo: string): Bounds | null {
    const feature = subdivisoesByMunicipio.value
      .get(municipioCodigo)
      ?.features.find((candidate) => candidate.properties.codigo === bairroCodigo)
    return feature ? featureBounds(feature) : null
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
    worldStates,
    loading,
    error,
    layerModel,
    loadGeo,
    boundsFor,
    loadMunicipios,
    loadAllMunicipios,
    municipioBoundsFor,
    ufFromMunicipioCodigo,
    loadSubdivisoes,
    subdivisaoInfoFor,
    subdivisaoBoundsFor,
  }
})
