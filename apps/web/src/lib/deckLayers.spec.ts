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
    heatmapPoints: [],
    heatmapVisible: false,
    ...overrides,
  }
}

const noop = () => {}

function build(m: MapLayerModel) {
  return buildDeckLayers({ model: m, onHoverState: noop, onHoverWorld: noop })
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
})
