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
    demographic: { active: false, metric: 'population', munis: [], hoveredCodigo: null },
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
    onHoverDemografia: noop,
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

  it('hides the score columns during the municipal drill-down', () => {
    const column = {
      regionId: 'SP',
      dimension: 'official' as const,
      score: 72,
      coordinates: [-46.6, -23.5] as [number, number],
    }
    const national = build(model({ columns: [column] }))
    expect(national.find((l) => l.id === 'power-columns-official')).toBeDefined()
    const drilled = build(
      model({ columns: [column], municipios: munFc, selectedMunicipioCodigo: '3550308' }),
    )
    expect(drilled.find((l) => l.id === 'power-columns-official')).toBeUndefined()
  })

  it('omits the arcs layer while the arcs flag keeps the model empty', () => {
    expect(build(model()).find((l) => l.id === 'influence-arcs')).toBeUndefined()
  })

  it('swaps score columns for demografia columns in the demographic view', () => {
    const column = {
      regionId: 'SP',
      dimension: 'official' as const,
      score: 72,
      coordinates: [-46.6, -23.5] as [number, number],
    }
    const muni = {
      codigo: '3550308',
      name: 'São Paulo',
      coordinates: [-46.6, -23.5] as [number, number],
      population: 11_451_999,
      gdpBrlThousands: 1_100_000_000,
    }
    const layers = build(
      model({
        columns: [column],
        demographic: {
          active: true,
          metric: 'population',
          munis: [muni],
          hoveredCodigo: null,
        },
      }),
    )
    expect(layers.find((l) => l.id === 'demografia-columns')).toBeDefined()
    expect(layers.find((l) => l.id === 'power-columns-official')).toBeUndefined()
    const states = layers.find((l) => l.id === 'states-choropleth')
    expect((states!.props as { pickable: boolean }).pickable).toBe(false)
  })

  it('keeps the demografia layer pickable so hover reaches the tooltip', () => {
    const layer = build(
      model({
        demographic: {
          active: true,
          metric: 'gdp',
          munis: [
            {
              codigo: '3550308',
              name: 'São Paulo',
              coordinates: [-46.6, -23.5] as [number, number],
              population: 1,
              gdpBrlThousands: 1,
            },
          ],
          hoveredCodigo: null,
        },
      }),
    ).find((l) => l.id === 'demografia-columns')
    expect((layer!.props as { pickable: boolean }).pickable).toBe(true)
  })
})
