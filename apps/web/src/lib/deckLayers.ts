import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import type { Color, Layer, PickingInfo } from '@deck.gl/core'
import { ArcLayer, ColumnLayer, GeoJsonLayer } from '@deck.gl/layers'

import type { BoundaryFeature } from '@/lib/geo'
import { paColor, shade, type RGBA } from '@/lib/palette'
import type { ArcDatum, ColumnDatum, MapLayerModel } from '@/stores/mapLayers'
import type { AmbientSignal, PowerDimension } from '@/types/power-entity'

export interface BuildLayersOptions {
  model: MapLayerModel
  onHover: (info: PickingInfo<BoundaryFeature>) => void
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
export function buildDeckLayers({ model, onHover }: BuildLayersOptions): Layer[] {
  if (!model.ready || !model.states || !model.national) return []

  const dataRegions = new Set(model.dataRegionIds)
  const layers: Layer[] = []

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
        if (!dataRegions.has(uf)) return paColor.faint(26)
        if (uf === model.selectedId) return paColor.official(110)
        if (uf === model.hoveredId) return paColor.official(72)
        return paColor.official(42)
      },
      getLineColor: (feature) =>
        feature.properties.UF === model.selectedId
          ? paColor.official(255)
          : paColor.official(88),
      getLineWidth: (feature) => (feature.properties.UF === model.selectedId ? 2 : 1),
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      onHover,
      updateTriggers: {
        getFillColor: [model.selectedId, model.hoveredId, model.dataRegionIds.join(',')],
        getLineColor: [model.selectedId],
        getLineWidth: [model.selectedId],
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

  for (const dimension of ['official', 'hidden'] as const) {
    layers.push(
      new ColumnLayer<ColumnDatum>({
        id: `power-columns-${dimension}`,
        data: model.columns.filter((column) => column.dimension === dimension),
        diskResolution: 6,
        radius: 17000,
        extruded: true,
        flatShading: true,
        getPosition: (d) => d.coordinates,
        getElevation: (d) => 30000 + d.score * 2600,
        getFillColor: (d) =>
          seriesColor(dimension, d.regionId === model.selectedId ? 245 : 175),
        updateTriggers: { getFillColor: [model.selectedId] },
      }),
    )
  }

  return layers
}
