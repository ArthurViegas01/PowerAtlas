import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import type { Color, Layer, PickingInfo } from '@deck.gl/core'
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions'
import {
  ArcLayer,
  ColumnLayer,
  GeoJsonLayer,
  PathLayer,
  SolidPolygonLayer,
  TextLayer,
} from '@deck.gl/layers'

import {
  boundaryCrestPaths,
  boundaryWallQuads,
  municipalRingsByPrefix,
  type BoundaryFeature,
  type CrestPath,
  type MunicipioFeature,
  type MunicipioProps,
  type MunicipioRing,
  type WallQuad,
  type WorldFeature,
  type WorldProps,
} from '@/lib/geo'
import {
  INFLOW_SEGMENTS,
  OUTFLOW_SEGMENTS,
  segmentColor,
  segmentValue,
  type FiscalSegmentDef,
} from '@/lib/fiscalSegments'
import { over, overVoid, paColor, shade, type RGBA } from '@/lib/palette'
import type { ArcDatum, ColumnDatum, LabelDatum, MapLayerModel } from '@/stores/mapLayers'
import type { DemografiaMunicipio } from '@/types/demografia'
import type { FiscalMunicipio } from '@/types/fiscal'
import type { AmbientSignal, PowerDimension } from '@/types/power-entity'

export interface BuildLayersOptions {
  model: MapLayerModel
  onHoverState: (info: PickingInfo<BoundaryFeature>) => void
  onHoverMunicipio: (info: PickingInfo<MunicipioFeature>) => void
  onHoverWorld: (info: PickingInfo<WorldFeature>) => void
  onHoverDemografia: (info: PickingInfo<DemografiaMunicipio>) => void
  /** Hover on a município footprint (demographic view's borders layer). */
  onHoverDemografiaBase: (info: PickingInfo<MunicipioFeature>) => void
  /** 0..1 breathing phase for the national crest glow (1 = full, default). */
  pulse?: number
  /** Continuous time (in loop units) driving the fiscal flow stripes. */
  flowTime?: number
  /**
   * Active click ripple across the demographic columns: a bounce wave
   * expanding from `epicenter` (lon/lat), `elapsed` seconds after the click.
   * Null when no ripple is playing.
   */
  ripple?: { epicenter: [number, number]; elapsed: number } | null
}

function seriesColor(dimension: PowerDimension, alpha: number): RGBA {
  return dimension === 'official' ? paColor.official(alpha) : paColor.hidden(alpha)
}

/** One stacked column segment: a band from `position.z` up by `height`. */
interface FiscalBand {
  /** Owner município (lets the click lift/ripple find its state). */
  codigo: string
  position: [number, number, number]
  height: number
  color: RGBA
}

// Demographic click feedback. The clicked state's columns float above the
// rest, and a bounce wave ripples out from the click point: each column
// rises as the wavefront reaches it and settles back once it passes.
// Persistent lift of the selected state (the raised platform). Off for now:
// only the transient ripple bounce plays. Flip to re-enable the lift and its
// mesh platform.
const STATE_LIFT_ENABLED = false
const STATE_LIFT_M = 42000 // persistent lift of the selected state
const RIPPLE_AMP_M = 34000 // peak bounce height at the wavefront
const RIPPLE_SPEED_DEG = 3.6 // wavefront expansion, degrees per second
const RIPPLE_WIDTH_DEG = 0.7 // gaussian half-width of the wavefront
const RIPPLE_DURATION_S = 3.4 // total life of the ripple

/**
 * Vertical offset (m) applied to a column: the persistent state lift (when
 * enabled) plus the transient bounce wave. Both are confined to the selected
 * state (código prefix match), so clicking one state never disturbs its
 * neighbors. Shared by the green base, the segment bands and the flow arcs so
 * they move as one.
 */
function columnLift(
  lon: number,
  lat: number,
  codigo: string,
  liftedPrefix: string | null,
  ripple: { epicenter: [number, number]; elapsed: number } | null | undefined,
): number {
  if (!liftedPrefix || !codigo.startsWith(liftedPrefix)) return 0
  let z = STATE_LIFT_ENABLED ? STATE_LIFT_M : 0
  if (ripple) {
    const dx = (lon - ripple.epicenter[0]) * Math.cos((lat * Math.PI) / 180)
    const dy = lat - ripple.epicenter[1]
    const dist = Math.hypot(dx, dy)
    const front = ripple.elapsed * RIPPLE_SPEED_DEG
    const fade = Math.max(0, 1 - ripple.elapsed / RIPPLE_DURATION_S)
    const bump = Math.exp(-(((dist - front) / RIPPLE_WIDTH_DEG) ** 2))
    z += RIPPLE_AMP_M * fade * bump
  }
  return z
}

/** Stable signature of an enabled-segment list (for memo + updateTriggers). */
function outflowKey(segments: FiscalSegmentDef[]): string {
  return segments.map((s) => s.key).join(',')
}

// Segment-band geometry is heavy (~40k instances) and independent of the
// per-frame animation, so it is memoized by (metric + enabled segments +
// dataset). The cache returns the SAME arrays when nothing relevant changed,
// letting deck.gl skip re-upload while the flow arcs animate above.
let fiscalBandCache: {
  sig: string
  outflow: FiscalBand[]
  inflow: FiscalBand[]
} | null = null

function fiscalBands(
  demo: MapLayerModel['demographic'],
  fiscalBy: Map<string, FiscalMunicipio> | null,
  enabledOutflow: FiscalSegmentDef[],
  enabledInflow: FiscalSegmentDef[],
  elevationOf: (d: DemografiaMunicipio) => number,
  tipShare: (d: DemografiaMunicipio) => number,
  greenHeight: (d: DemografiaMunicipio) => number,
  inflowSum: (codigo: string) => number,
  inflowElevationOf: (codigo: string) => number,
  inflowCenter: (d: DemografiaMunicipio) => [number, number],
): { outflow: FiscalBand[]; inflow: FiscalBand[] } {
  const sig = [
    demo.metric,
    outflowKey(enabledOutflow),
    outflowKey(enabledInflow),
    demo.munis.length,
    fiscalBy?.size ?? 0,
  ].join('|')
  if (fiscalBandCache && fiscalBandCache.sig === sig) return fiscalBandCache

  const outflow: FiscalBand[] = []
  const inflow: FiscalBand[] = []
  for (const d of demo.munis) {
    const flows = fiscalBy?.get(d.codigo)
    if (!flows) continue
    // Amber outflow bands stacked from the green top upward.
    if (enabledOutflow.length > 0) {
      const tipHeight = elevationOf(d) * tipShare(d)
      const total = enabledOutflow.reduce((sum, s) => sum + segmentValue(flows, s.key), 0)
      if (tipHeight > 0 && total > 0) {
        let z = greenHeight(d)
        for (const s of enabledOutflow) {
          const value = segmentValue(flows, s.key)
          if (value <= 0) continue
          const height = tipHeight * (value / total)
          outflow.push({ codigo: d.codigo, position: [d.coordinates[0], d.coordinates[1], z], height, color: segmentColor(s, 235) })
          z += height
        }
      }
    }
    // Cyan inflow bands stacked from the ground up on the twin column.
    if (enabledInflow.length > 0) {
      const total = inflowSum(d.codigo)
      const columnHeight = inflowElevationOf(d.codigo)
      if (total > 0 && columnHeight > 0) {
        const [cx, cy] = inflowCenter(d)
        let z = 0
        for (const s of enabledInflow) {
          const value = segmentValue(flows, s.key)
          if (value <= 0) continue
          const height = columnHeight * (value / total)
          inflow.push({ codigo: d.codigo, position: [cx, cy, z], height, color: segmentColor(s, 235) })
          z += height
        }
      }
    }
  }
  fiscalBandCache = { sig, outflow, inflow }
  return fiscalBandCache
}

// Boundary relief walls, in meters. Low next to the score/demographic
// columns (15km-180km) on purpose: they should read as parapets along the
// borders, not as terrain.
const STATE_WALL_ELEVATION = 3000
const NATIONAL_WALL_ELEVATION = 5000

function heatmapRamp(): Color[] {
  const base = paColor.official(255)
  return [
    shade(base, 0.18, 30),
    shade(base, 0.34, 70),
    shade(base, 0.52, 115),
    shade(base, 0.75, 165),
    shade(base, 1, 215),
  ]
}

/**
 * Pure factory: MapLayerModel (plain data from the mapLayers store) in,
 * deck.gl layer instances out. MapView feeds the result to MapboxOverlay.
 */
export function buildDeckLayers({
  model,
  onHoverState,
  onHoverMunicipio,
  onHoverWorld,
  onHoverDemografia,
  onHoverDemografiaBase,
  pulse = 1,
  flowTime = 0,
  ripple = null,
}: BuildLayersOptions): Layer[] {
  if (!model.ready || !model.states || !model.national) return []

  const dataRegions = new Set(model.dataRegionIds)
  const demo = model.demographic
  const layers: Layer[] = []

  // Area fills are precomposited over the void so the pixels are OPAQUE:
  // visually identical (they always sat on the flat void), but this is what
  // hides the scan band running behind the transparent map canvases.
  const fills = {
    world: overVoid(paColor.faint(36)),
    worldHover: overVoid(paColor.faint(72)),
    stateNoData: overVoid(paColor.faint(26)),
    stateSelected: overVoid(paColor.official(110)),
    stateHovered: overVoid(paColor.official(72)),
    state: overVoid(paColor.official(42)),
    stateDemo: overVoid(paColor.faint(22)),
    stateDemoCropped: overVoid(paColor.official(30)),
  }
  // Municípios draw on top of the SELECTED state, so their translucent fills
  // composite over that state color instead of the raw void.
  const municipioFills = {
    selected: over(paColor.official(120), fills.stateSelected),
    hovered: over(paColor.official(58), fills.stateSelected),
    base: over(paColor.official(18), fills.stateSelected),
  }

  // Demographic series color: darker blue for population, forest green for
  // PIB (tokens --pa-demo-*). Columns, municipal outlines, state lines and
  // the national border all follow it while the view is on.
  const demoBase = demo.metric === 'population' ? paColor.demoPop(255) : paColor.demoGdp(255)
  const demoCroppedFill = overVoid(shade(demoBase, 1, 34))

  // "Em breve" backdrop: dim fill + dashed borders, like an unfinished
  // game region. Sits under everything Brazil-related.
  if (model.world) {
    layers.push(
      new GeoJsonLayer<WorldProps, PathStyleExtensionProps<WorldFeature>>({
        id: 'world-countries',
        data: model.world,
        pickable: !demo.active,
        stroked: true,
        filled: true,
        getFillColor: (feature) =>
          feature.properties.iso === model.hoveredWorldIso
            ? fills.worldHover
            : fills.world,
        getLineColor: paColor.faint(160),
        getLineWidth: 0.9,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 0.6,
        extensions: [new PathStyleExtension({ dash: true })],
        getDashArray: [5, 4],
        onHover: (info) => onHoverWorld(info as PickingInfo<WorldFeature>),
        updateTriggers: { getFillColor: [model.hoveredWorldIso] },
      }),
    )
  }

  if (model.heatmapVisible && model.heatmapPoints.length > 0) {
    layers.push(
      new HeatmapLayer<AmbientSignal>({
        id: 'ambient-heatmap',
        data: model.heatmapPoints,
        getPosition: (d) => d.coordinates,
        getWeight: (d) => d.weight,
        radiusPixels: 70,
        intensity: 1.1,
        threshold: 0.03,
        colorRange: heatmapRamp(),
      }),
    )
  }

  layers.push(
    new GeoJsonLayer<BoundaryFeature['properties']>({
      id: 'states-choropleth',
      data: model.states,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (feature) => {
        const uf = feature.properties.UF
        // Demographic view: faint base under the columns; the cropped state
        // gets a touch more presence, tinted by the metric color.
        if (demo.active) return uf === demo.uf ? demoCroppedFill : fills.stateDemo
        if (!dataRegions.has(uf)) return fills.stateNoData
        if (uf === model.selectedId) return fills.stateSelected
        if (uf === model.hoveredId) return fills.stateHovered
        return fills.state
      },
      getLineColor: (feature) => {
        const uf = feature.properties.UF
        const highlighted = demo.active ? uf === demo.uf : uf === model.selectedId
        if (demo.active) return shade(demoBase, 1, highlighted ? 255 : 120)
        return highlighted ? paColor.official(255) : paColor.official(88)
      },
      getLineWidth: (feature) => {
        const uf = feature.properties.UF
        const highlighted = demo.active ? uf === demo.uf : uf === model.selectedId
        return highlighted ? 2 : 1
      },
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      onHover: (info) => onHoverState(info as PickingInfo<BoundaryFeature>),
      updateTriggers: {
        getFillColor: [
          model.selectedId,
          model.hoveredId,
          model.dataRegionIds.join(','),
          demo.active,
          demo.uf,
          demo.metric,
        ],
        getLineColor: [model.selectedId, demo.active, demo.uf, demo.metric],
        getLineWidth: [model.selectedId, demo.active, demo.uf],
      },
    }),
  )

  layers.push(
    new GeoJsonLayer<BoundaryFeature['properties']>({
      id: 'national-outline',
      data: model.national,
      pickable: false,
      stroked: true,
      filled: false,
      // The country border also wears the metric color in the demographic view.
      getLineColor: demo.active ? shade(demoBase, 1, 210) : paColor.official(210),
      getLineWidth: 1.8,
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1.5,
      updateTriggers: { getLineColor: [demo.active, demo.metric] },
    }),
  )

  // Municipal drill-down (all 27 UFs). Only present once the selected state's
  // mesh has loaded; the selected municipality brightens, the hovered one
  // lights up under the tooltip.
  if (model.municipios) {
    layers.push(
      new GeoJsonLayer<MunicipioProps>({
        id: 'municipios',
        data: model.municipios,
        pickable: true,
        stroked: true,
        filled: true,
        getFillColor: (feature) => {
          const codigo = feature.properties.codigo
          if (codigo === model.selectedMunicipioCodigo) return municipioFills.selected
          if (codigo === model.hoveredMunicipioCodigo) return municipioFills.hovered
          return municipioFills.base
        },
        getLineColor: paColor.official(130),
        getLineWidth: (feature) =>
          feature.properties.codigo === model.selectedMunicipioCodigo ? 2 : 0.6,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 0.5,
        onHover: (info) => onHoverMunicipio(info as PickingInfo<MunicipioFeature>),
        updateTriggers: {
          getFillColor: [model.selectedMunicipioCodigo, model.hoveredMunicipioCodigo],
          getLineWidth: [model.selectedMunicipioCodigo],
        },
      }),
    )
  }

  // Country-wide municipal outlines: faint context lines in every view.
  // The demographic view tints them with the metric color and makes them
  // pickable, so footprint hovers highlight and clicks reach the city card.
  if (model.municipalBorders) {
    layers.push(
      new GeoJsonLayer<MunicipioProps>({
        id: 'municipal-borders',
        data: model.municipalBorders,
        pickable: demo.active,
        stroked: true,
        filled: demo.active,
        getFillColor: (feature) =>
          demo.active && feature.properties.codigo === demo.hoveredCodigo
            ? shade(demoBase, 1, 46)
            : [0, 0, 0, 0],
        getLineColor: demo.active ? shade(demoBase, 0.9, 60) : paColor.official(38),
        getLineWidth: 0.5,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 0.3,
        onHover: (info) => onHoverDemografiaBase(info as PickingInfo<MunicipioFeature>),
        updateTriggers: {
          getFillColor: [demo.active, demo.metric, demo.hoveredCodigo],
          getLineColor: [demo.active, demo.metric],
        },
      }),
    )
  }

  // Empty while INFLUENCE_ARCS_ENABLED is off (mock links carry no meaning).
  if (model.arcs.length > 0) {
    layers.push(
      new ArcLayer<ArcDatum>({
        id: 'influence-arcs',
        data: model.arcs,
        getSourcePosition: (d) => d.source,
        getTargetPosition: (d) => d.target,
        getSourceColor: (d) => seriesColor(d.dimension, d.active ? 235 : 55),
        getTargetColor: (d) => seriesColor(d.dimension, d.active ? 150 : 35),
        getWidth: (d) => 1 + d.strength * (d.active ? 3.2 : 1.4),
        widthUnits: 'pixels',
        getHeight: 0.5,
        greatCircle: false,
        updateTriggers: {
          getSourceColor: [model.selectedId],
          getTargetColor: [model.selectedId],
          getWidth: [model.selectedId],
        },
      }),
    )
  }

  // State siglas at each capital. Drawn above the fills; the selected state's
  // label brightens. Billboarded so it stays readable through the map tilt.
  if (model.labels.length > 0) {
    layers.push(
      new TextLayer<LabelDatum>({
        id: 'state-labels',
        data: model.labels,
        pickable: false,
        billboard: true,
        getPosition: (d) => d.coordinates,
        getText: (d) => d.text,
        getSize: (d) => (d.regionId === model.selectedId ? 15 : 12),
        sizeUnits: 'pixels',
        getColor: (d) =>
          d.regionId === model.selectedId ? paColor.official(255) : paColor.official(150),
        getPixelOffset: [0, -22],
        fontFamily: '"Fira Code", monospace',
        fontWeight: 600,
        fontSettings: { sdf: true },
        outlineWidth: 3,
        outlineColor: [3, 8, 14, 220],
        characterSet: 'auto',
        updateTriggers: {
          getColor: [model.selectedId],
          getSize: [model.selectedId],
        },
      }),
    )
  }


  // Demographic view: one column per município, height ∝ √metric (linear
  // would make everything but the SP/RJ metros invisible).
  if (demo.active && demo.munis.length > 0) {
    const metricValue = (d: DemografiaMunicipio) =>
      demo.metric === 'population' ? d.population : d.gdpBrlThousands
    let max = 0
    for (const municipio of demo.munis) max = Math.max(max, metricValue(municipio))
    const base = demoBase
    const elevationOf = (d: DemografiaMunicipio) =>
      max ? 1500 + Math.sqrt(metricValue(d) / max) * 180000 : 0

    // Click feedback: lift the selected state and ripple a bounce from the
    // click. `liftedPrefix` is the 2-digit IBGE code of the cropped state.
    const liftedPrefix = demo.uf
      ? (model.states?.features.find((f) => f.properties.UF === demo.uf)?.properties.codarea ??
        null)
      : null
    const lift = (lon: number, lat: number, codigo: string) =>
      columnLift(lon, lat, codigo, liftedPrefix, ripple)
    // updateTrigger token: advances each frame while a ripple plays, then
    // settles to a constant so lifted columns stop re-uploading.
    const liftTrigger = [liftedPrefix, ripple ? ripple.elapsed : -1]

    // Fiscal overlay: only meaningful on the PIB metric (R$ against R$).
    const fiscalBy = demo.metric === 'gdp' ? demo.fiscal.byCodigo : null
    const seg = demo.fiscal.segments
    const enabledOutflow = fiscalBy ? OUTFLOW_SEGMENTS.filter((s) => seg[s.key]) : []
    const enabledInflow = fiscalBy ? INFLOW_SEGMENTS.filter((s) => seg[s.key]) : []
    const outflowOn = enabledOutflow.length > 0
    const inflowOn = enabledInflow.length > 0

    // Sum of the ENABLED outflow segments for a município (R$ leaving).
    const outflowSum = (codigo: string) => {
      const flows = fiscalBy?.get(codigo)
      if (!flows) return 0
      let sum = 0
      for (const s of enabledOutflow) sum += segmentValue(flows, s.key)
      return sum
    }
    // Fraction of local PIB that leaves (capped: HQ-heavy municípios book
    // more federal collection than their own PIB).
    const tipShare = (d: DemografiaMunicipio) => {
      if (!outflowOn || d.gdpBrlThousands <= 0) return 0
      return Math.min(0.9, outflowSum(d.codigo) / (d.gdpBrlThousands * 1000))
    }
    const greenHeight = (d: DemografiaMunicipio) => elevationOf(d) * (1 - tipShare(d))

    // Twin (inflow) column geometry. Scale uses the full return flow across
    // all municípios so toggling segments doesn't rescale the whole map.
    const COLUMN_RADIUS = 2400
    let maxInflow = 0
    if (fiscalBy) {
      for (const flows of fiscalBy.values()) {
        maxInflow = Math.max(maxInflow, flows.transferencias + flows.emendas)
      }
    }
    const inflowSum = (codigo: string) => {
      const flows = fiscalBy?.get(codigo)
      if (!flows) return 0
      let sum = 0
      for (const s of enabledInflow) sum += segmentValue(flows, s.key)
      return sum
    }
    const inflowElevationOf = (codigo: string) => {
      const value = inflowSum(codigo)
      return value > 0 && maxInflow ? 1200 + Math.sqrt(value / 1000 / maxInflow) * 180000 : 0
    }
    const glueOffset = (lat: number) =>
      (2 * COLUMN_RADIUS) / (111320 * Math.cos((lat * Math.PI) / 180))
    const inflowCenter = (d: DemografiaMunicipio): [number, number] => [
      d.coordinates[0] + glueOffset(d.coordinates[1]),
      d.coordinates[1],
    ]

    // Selected state's municipal mesh, raised to the lift height so the
    // columns sit on a solid platform instead of floating. It holds a steady
    // lift (no ripple) — the columns are what pop off it as the wave passes.
    if (STATE_LIFT_ENABLED && liftedPrefix && model.municipalBorders) {
      layers.push(
        new PathLayer<MunicipioRing>({
          id: 'demografia-state-mesh',
          data: municipalRingsByPrefix(model.municipalBorders, liftedPrefix),
          pickable: false,
          widthUnits: 'pixels',
          getWidth: 1,
          widthMinPixels: 0.6,
          getPath: (d) =>
            d.ring.map(([lon, lat]): [number, number, number] => [lon, lat, STATE_LIFT_M]),
          getColor: shade(demoBase, 1, 120),
          updateTriggers: { getPath: [liftedPrefix] },
        }),
      )
    }

    // Main column: PIB base, green, shortened to leave room for the amber
    // outflow bands stacked on its top. Pickable target for hover/click.
    layers.push(
      new ColumnLayer<DemografiaMunicipio>({
        id: 'demografia-columns',
        data: demo.munis,
        pickable: true,
        diskResolution: 6,
        radius: COLUMN_RADIUS,
        extruded: true,
        flatShading: true,
        getPosition: (d) => [d.coordinates[0], d.coordinates[1], lift(d.coordinates[0], d.coordinates[1], d.codigo)],
        getElevation: greenHeight,
        getFillColor: (d) => {
          if (d.codigo === demo.hoveredCodigo) return shade(base, 1, 255)
          const t = max ? Math.sqrt(metricValue(d) / max) : 0
          // High floor (0.75): the darker series colors would sink small
          // municípios into the void with a lower ramp.
          return shade(base, 0.75 + 0.25 * t, 150 + Math.round(105 * t))
        },
        onHover: (info) => onHoverDemografia(info as PickingInfo<DemografiaMunicipio>),
        updateTriggers: {
          getPosition: liftTrigger,
          getElevation: [demo.metric, outflowKey(enabledOutflow)],
          getFillColor: [demo.metric, demo.hoveredCodigo],
        },
      }),
    )

    // Stacked segment bands: amber outflow on top of the green column, cyan
    // inflow on the glued twin. Geometry is memoized by (metric + enabled
    // segments) so the ~40k instances aren't rebuilt on every animation
    // frame — only when the toggles or metric change.
    if (outflowOn || inflowOn) {
      const bands = fiscalBands(
        demo,
        fiscalBy,
        enabledOutflow,
        enabledInflow,
        elevationOf,
        tipShare,
        greenHeight,
        inflowSum,
        inflowElevationOf,
        inflowCenter,
      )
      const bandLayer = (id: string, data: FiscalBand[]) =>
        new ColumnLayer<FiscalBand>({
          id,
          data,
          pickable: false,
          diskResolution: 6,
          radius: COLUMN_RADIUS,
          extruded: true,
          flatShading: true,
          getPosition: (d) => [
            d.position[0],
            d.position[1],
            d.position[2] + lift(d.position[0], d.position[1], d.codigo),
          ],
          getElevation: (d) => d.height,
          getFillColor: (d) => d.color,
          updateTriggers: { getPosition: liftTrigger },
        })
      if (bands.outflow.length > 0)
        layers.push(bandLayer('demografia-outflow-segments', bands.outflow))
      if (bands.inflow.length > 0)
        layers.push(bandLayer('demografia-inflow-segments', bands.inflow))
    }

    // Flow arcs with marching stripes (like Bootstrap's animated progress
    // bars): a faint continuous rail shows the route; bright stripes scroll
    // along it in the flow direction. Outflow arcs climb from the column top
    // to Brasília; inflow arcs leave Brasília toward the twin return column.
    // Top movers plus the hovered/carded município.
    const BRASILIA: [number, number] = [-47.8825, -15.7942]
    if (outflowOn || inflowOn) {
      const focus = new Set(
        [demo.hoveredCodigo, demo.selectedCodigo].filter((c): c is string => c !== null),
      )
      const topFlows = (value: (codigo: string) => number) => {
        const ranked = demo.munis
          .filter((d) => value(d.codigo) > 0)
          .sort((a, b) => value(b.codigo) - value(a.codigo))
        const maxValue = ranked.length ? value(ranked[0].codigo) : 0
        // Keep the 14 biggest movers nationally AND the top município of
        // every state (codigo prefix = 2-digit UF code), so small states
        // like AC or MS still get a flow instead of only the Sudeste.
        const perStateTop = new Set<string>()
        const seenState = new Set<string>()
        for (const d of ranked) {
          const uf = d.codigo.slice(0, 2)
          if (seenState.has(uf)) continue
          seenState.add(uf)
          perStateTop.add(d.codigo)
        }
        return {
          maxValue,
          munis: ranked.filter(
            (d, i) => i < 14 || perStateTop.has(d.codigo) || focus.has(d.codigo),
          ),
        }
      }

      type ArcPath = [number, number, number][]
      interface FlowPath {
        path: ArcPath
        color: RGBA
        width: number
      }
      const rails: FlowPath[] = []
      const stripes: FlowPath[] = []
      // Parabolic arc: linear in lon/lat, height bumps in the middle so it
      // lifts off the ground like the old ArcLayer.
      const sampleArc = (
        ax: number,
        ay: number,
        az: number,
        bx: number,
        by: number,
        bz: number,
        bump: number,
        u: number,
      ): [number, number, number] => [
        ax + (bx - ax) * u,
        ay + (by - ay) * u,
        az * (1 - u) + bz * u + bump * 4 * u * (1 - u),
      ]
      const RAIL_SAMPLES = 26
      const STRIPE_COUNT = 4 // stripes traveling the arc at once
      const STRIPE_LEN = 0.16 // dash length as a fraction of the arc
      const STRIPE_SEG = 5 // sub-samples per stripe (keeps the curve smooth)
      const emitArc = (
        ax: number,
        ay: number,
        az: number,
        bx: number,
        by: number,
        bz: number,
        rgb: RGBA,
        weight: number,
      ) => {
        const bump = Math.hypot(bx - ax, by - ay) * 111000 * 0.32
        const at = (u: number) => sampleArc(ax, ay, az, bx, by, bz, bump, u)
        const width = 1.4 + 2.6 * weight
        // Continuous faint rail.
        const rail: ArcPath = []
        for (let i = 0; i <= RAIL_SAMPLES; i++) rail.push(at(i / RAIL_SAMPLES))
        rails.push({ path: rail, color: [rgb[0], rgb[1], rgb[2], 48], width: Math.max(1, width * 0.7) })
        // Stripes travel source -> target. Each head runs 0 -> 1+LEN so the
        // body emerges from the base (clamped at 0) and slides into the
        // destination (clamped at 1) instead of blinking in/out. Speed scales
        // with the flow amount: more money, faster stripes.
        const speed = 0.28 + 1.1 * weight
        for (let s = 0; s < STRIPE_COUNT; s++) {
          const phase = ((flowTime * speed + s / STRIPE_COUNT) % 1 + 1) % 1
          const head = phase * (1 + STRIPE_LEN)
          const start = Math.max(0, head - STRIPE_LEN)
          const end = Math.min(1, head)
          if (end - start < 1e-3) continue
          const seg: ArcPath = []
          for (let j = 0; j <= STRIPE_SEG; j++) seg.push(at(start + ((end - start) * j) / STRIPE_SEG))
          stripes.push({ path: seg, color: [rgb[0], rgb[1], rgb[2], 240], width })
        }
      }
      const amber = paColor.hidden(255)
      const cyan = paColor.official(255)
      if (outflowOn) {
        const { maxValue, munis } = topFlows(outflowSum)
        for (const d of munis) {
          const weight = Math.sqrt(maxValue ? outflowSum(d.codigo) / maxValue : 0)
          // City column top (the amber tip, lifted with the column) -> Brasília.
          const cz = elevationOf(d) + lift(d.coordinates[0], d.coordinates[1], d.codigo)
          emitArc(d.coordinates[0], d.coordinates[1], cz, BRASILIA[0], BRASILIA[1], 0, amber, weight)
        }
      }
      if (inflowOn) {
        const { maxValue, munis } = topFlows(inflowSum)
        for (const d of munis) {
          const weight = Math.sqrt(maxValue ? inflowSum(d.codigo) / maxValue : 0)
          const [tx, ty] = inflowCenter(d)
          // Brasília -> top of the twin return column (lifted with the column).
          const cz = inflowElevationOf(d.codigo) + lift(tx, ty, d.codigo)
          emitArc(BRASILIA[0], BRASILIA[1], 0, tx, ty, cz, cyan, weight)
        }
      }
      // Rail first (drawn under), stripes on top. Both rebuilt each frame;
      // the stripe geometry is what scrolls with flowPhase.
      const flowPathLayer = (id: string, data: FlowPath[]) =>
        new PathLayer<FlowPath>({
          id,
          data,
          pickable: false,
          widthUnits: 'pixels',
          capRounded: true,
          jointRounded: true,
          getPath: (d) => d.path,
          getColor: (d) => d.color,
          getWidth: (d) => d.width,
        })
      if (rails.length > 0) layers.push(flowPathLayer('fiscal-flow-rails', rails))
      if (stripes.length > 0) layers.push(flowPathLayer('fiscal-flow-stripes', stripes))
    }
  }

  // Score columns: slim hexagonal prisms, same footprint as the demographic
  // columns, so they read as markers, not landmasses. Hidden entirely during
  // the municipal drill-down — that close, a 100 km column would bury the
  // município — and in the demographic view, which has its own columns.
  if (!model.selectedMunicipioCodigo && !demo.active) {
    for (const dimension of ['official', 'hidden'] as const) {
      layers.push(
        new ColumnLayer<ColumnDatum>({
          id: `power-columns-${dimension}`,
          data: model.columns.filter((column) => column.dimension === dimension),
          diskResolution: 6,
          radius: 2400,
          extruded: true,
          flatShading: true,
          getPosition: (d) => d.coordinates,
          getElevation: (d) => 15000 + d.score * 1600,
          getFillColor: (d) =>
            seriesColor(dimension, d.regionId === model.selectedId ? 245 : 175),
          updateTriggers: { getFillColor: [model.selectedId] },
        }),
      )
    }
  }

  // Boundary relief: translucent walls tracing the state borders and the
  // national outline, one vertical quad per boundary edge (boundaryWallQuads
  // explains why the geometry is explicit). Unlit (material:false) so the
  // walls keep the flat holographic look regardless of face orientation.
  // Pushed last so everything behind a wall is already drawn and the wall
  // blends over it instead of depth-clipping it.
  const wallBase = demo.active ? demoBase : paColor.official(255)
  layers.push(
    new SolidPolygonLayer<WallQuad>({
      id: 'state-walls',
      data: boundaryWallQuads(model.states, STATE_WALL_ELEVATION),
      getPolygon: (d) => d,
      pickable: false,
      _full3d: true,
      material: false,
      getFillColor: shade(wallBase, 1, 34),
      updateTriggers: { getFillColor: [demo.active, demo.metric] },
    }),
    new SolidPolygonLayer<WallQuad>({
      id: 'national-wall',
      data: boundaryWallQuads(model.national, NATIONAL_WALL_ELEVATION),
      getPolygon: (d) => d,
      pickable: false,
      _full3d: true,
      material: false,
      getFillColor: shade(wallBase, 1, 80),
      updateTriggers: { getFillColor: [demo.active, demo.metric] },
    }),
    // Neon crest where each wall meets the sky: a subtle line on the state
    // parapets, a brighter one crowning the national border. The national
    // crest breathes with the pulse phase (a slow hologram shimmer).
    new PathLayer<CrestPath>({
      id: 'state-wall-crests',
      data: boundaryCrestPaths(model.states, STATE_WALL_ELEVATION),
      getPath: (d) => d,
      pickable: false,
      getColor: shade(wallBase, 1, 90),
      getWidth: 1,
      widthUnits: 'pixels',
      widthMinPixels: 0.6,
      updateTriggers: { getColor: [demo.active, demo.metric] },
    }),
    new PathLayer<CrestPath>({
      id: 'national-wall-crest',
      data: boundaryCrestPaths(model.national, NATIONAL_WALL_ELEVATION),
      getPath: (d) => d,
      pickable: false,
      getColor: shade(wallBase, 1, Math.round(90 + 165 * pulse)),
      getWidth: 1.2 + pulse,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      updateTriggers: {
        getColor: [demo.active, demo.metric, pulse],
        getWidth: [pulse],
      },
    }),
  )

  return layers
}
