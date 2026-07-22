import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import type { Color, Layer, PickingInfo } from '@deck.gl/core'
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions'
import { ArcLayer, ColumnLayer, GeoJsonLayer, TextLayer } from '@deck.gl/layers'

import type {
  BoundaryFeature,
  MunicipioFeature,
  MunicipioProps,
  WorldFeature,
  WorldProps,
} from '@/lib/geo'
import { over, overVoid, paColor, shade, type RGBA } from '@/lib/palette'
import type { ArcDatum, ColumnDatum, LabelDatum, MapLayerModel } from '@/stores/mapLayers'
import type { DemografiaMunicipio } from '@/types/demografia'
import type { AmbientSignal, PowerDimension } from '@/types/power-entity'

export interface BuildLayersOptions {
  model: MapLayerModel
  onHoverState: (info: PickingInfo<BoundaryFeature>) => void
  onHoverMunicipio: (info: PickingInfo<MunicipioFeature>) => void
  onHoverWorld: (info: PickingInfo<WorldFeature>) => void
  onHoverDemografia: (info: PickingInfo<DemografiaMunicipio>) => void
}

function seriesColor(dimension: PowerDimension, alpha: number): RGBA {
  return dimension === 'official' ? paColor.official(alpha) : paColor.hidden(alpha)
}

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
        // gets a touch more presence.
        if (demo.active) return uf === demo.uf ? fills.stateDemoCropped : fills.stateDemo
        if (!dataRegions.has(uf)) return fills.stateNoData
        if (uf === model.selectedId) return fills.stateSelected
        if (uf === model.hoveredId) return fills.stateHovered
        return fills.state
      },
      getLineColor: (feature) => {
        const uf = feature.properties.UF
        const highlighted = demo.active ? uf === demo.uf : uf === model.selectedId
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
        ],
        getLineColor: [model.selectedId, demo.active, demo.uf],
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
      getLineColor: paColor.official(210),
      getLineWidth: 1.8,
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1.5,
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

  // Demographic view: municipal outlines as context under the columns —
  // faint on purpose, they only firm up as you tilt/zoom into a state.
  if (demo.active && demo.borders) {
    layers.push(
      new GeoJsonLayer<MunicipioProps>({
        id: 'demografia-borders',
        data: demo.borders,
        pickable: false,
        stroked: true,
        filled: false,
        getLineColor: paColor.official(46),
        getLineWidth: 0.5,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 0.3,
      }),
    )
  }

  // Demographic view: one column per município, height ∝ √metric (linear
  // would make everything but the SP/RJ metros invisible). Population reads
  // in the official cyan, PIB in the amber series.
  if (demo.active && demo.munis.length > 0) {
    const metricValue = (d: DemografiaMunicipio) =>
      demo.metric === 'population' ? d.population : d.gdpBrlThousands
    let max = 0
    for (const municipio of demo.munis) max = Math.max(max, metricValue(municipio))
    const base = demo.metric === 'population' ? paColor.official(255) : paColor.hidden(255)
    layers.push(
      new ColumnLayer<DemografiaMunicipio>({
        id: 'demografia-columns',
        data: demo.munis,
        pickable: true,
        diskResolution: 10,
        radius: 3200,
        extruded: true,
        flatShading: true,
        getPosition: (d) => d.coordinates,
        getElevation: (d) => (max ? 1500 + Math.sqrt(metricValue(d) / max) * 180000 : 0),
        getFillColor: (d) => {
          if (d.codigo === demo.hoveredCodigo) return shade(base, 1, 255)
          const t = max ? Math.sqrt(metricValue(d) / max) : 0
          return shade(base, 0.35 + 0.65 * t, 90 + Math.round(150 * t))
        },
        onHover: (info) => onHoverDemografia(info as PickingInfo<DemografiaMunicipio>),
        updateTriggers: {
          getElevation: [demo.metric],
          getFillColor: [demo.metric, demo.hoveredCodigo],
        },
      }),
    )
  }

  // Score columns: slim cylinders (not the old chunky hexagons) so they read
  // as markers, not landmasses. Hidden entirely during the municipal
  // drill-down — that close, a 100 km column would bury the município —
  // and in the demographic view, which has its own columns.
  if (!model.selectedMunicipioCodigo && !demo.active) {
    for (const dimension of ['official', 'hidden'] as const) {
      layers.push(
        new ColumnLayer<ColumnDatum>({
          id: `power-columns-${dimension}`,
          data: model.columns.filter((column) => column.dimension === dimension),
          diskResolution: 24,
          radius: 7500,
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

  return layers
}
