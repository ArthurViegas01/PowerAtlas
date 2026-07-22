import { describe, expect, it } from 'vitest'

import { buildDeckLayers } from '@/lib/deckLayers'
import type { MapLayerModel } from '@/stores/mapLayers'

const emptyFc = { type: 'FeatureCollection', features: [] } as unknown as MapLayerModel['states']

function model(overrides: Partial<MapLayerModel> = {}): MapLayerModel {
  return {
    ready: true,
    states: emptyFc,
    national: emptyFc,
    world: null,
    selectedId: 'SP',
    hoveredId: null,
    hoveredWorldIso: null,
    dataRegionIds: ['SP', 'RJ'],
    columns: [],
    arcs: [],
    labels: [
      { regionId: 'SP', text: 'SP', coordinates: [-46.6, -23.5] },
      { regionId: 'RJ', text: 'RJ', coordinates: [-43.2, -22.9] },
    ],
    municipios: null,
    selectedMunicipioCodigo: null,
    hoveredMunicipioCodigo: null,
    heatmapPoints: [],
    heatmapVisible: false,
    ...overrides,
  }
}

const munFc = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { codigo: '3550308', name: 'São Paulo' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
    },
  ],
} as unknown as MapLayerModel['municipios']

const noop = () => {}

function build(m: MapLayerModel) {
  return buildDeckLayers({
    model: m,
    onHoverState: noop,
    onHoverMunicipio: noop,
    onHoverWorld: noop,
  })
}

describe('buildDeckLayers', () => {
  it('returns nothing until the geometry is ready', () => {
    expect(build(model({ ready: false }))).toEqual([])
  })

  it('emits a state-labels layer with one entry per state', () => {
    const labels = build(model()).find((l) => l.id === 'state-labels')
    expect(labels).toBeDefined()
    expect((labels!.props as { data: unknown[] }).data).toHaveLength(2)
  })

  it('omits the labels layer when there are no labels', () => {
    const layers = build(model({ labels: [] }))
    expect(layers.find((l) => l.id === 'state-labels')).toBeUndefined()
  })

  it('adds the municipios layer only when a municipal mesh is loaded', () => {
    expect(build(model()).find((l) => l.id === 'municipios')).toBeUndefined()
    const withMun = build(model({ municipios: munFc, selectedMunicipioCodigo: '3550308' }))
    expect(withMun.find((l) => l.id === 'municipios')).toBeDefined()
  })

  it('makes the municipios layer pickable so hover/click reach the tooltip', () => {
    const layer = build(model({ municipios: munFc })).find((l) => l.id === 'municipios')
    expect((layer!.props as { pickable: boolean }).pickable).toBe(true)
  })
})
