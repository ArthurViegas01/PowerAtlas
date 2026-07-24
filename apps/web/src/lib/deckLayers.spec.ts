import { describe, expect, it } from 'vitest'

import { buildDeckLayers } from '@/lib/deckLayers'
import { defaultFiscalSegments, type FiscalSegmentKey } from '@/lib/fiscalSegments'
import type { MapLayerModel } from '@/stores/mapLayers'
import type { FiscalMunicipio } from '@/types/fiscal'

const emptyFc = { type: 'FeatureCollection', features: [] } as unknown as MapLayerModel['states']

/** All fiscal segments off (default off-state for the base test model). */
function noSegments(): Record<FiscalSegmentKey, boolean> {
  const s = defaultFiscalSegments()
  for (const key of Object.keys(s) as FiscalSegmentKey[]) s[key] = false
  return s
}

/** A fiscal record with sensible defaults; override what a test needs. */
function fiscalRecord(codigo: string, over: Partial<FiscalMunicipio> = {}): FiscalMunicipio {
  return {
    codigo,
    arrecadacao: 0,
    previdencia: 0,
    ir: 0,
    ipi: 0,
    transferencias: 0,
    fpm: 0,
    fundeb: 0,
    emendas: 0,
    ...over,
  }
}

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
    municipalBorders: null,
    demographic: {
      active: false,
      metric: 'population',
      munis: [],
      hoveredCodigo: null,
      selectedCodigo: null,
      uf: null,
      fiscal: { segments: noSegments(), byCodigo: null },
    },
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

function build(
  m: MapLayerModel,
  pulse?: number,
  ripple?: { epicenter: [number, number]; elapsed: number } | null,
) {
  return buildDeckLayers({
    model: m,
    onHoverState: noop,
    onHoverMunicipio: noop,
    onHoverWorld: noop,
    onHoverDemografia: noop,
    onHoverDemografiaBase: noop,
    pulse,
    ripple,
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

  it('raises boundary walls for the states and the national outline', () => {
    // A triangle ring (closed, 4 points) should yield one wall quad per edge.
    const triangleFc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { codarea: '41', UF: 'PR', name: 'Paraná' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
          },
        },
      ],
    } as unknown as MapLayerModel['states']
    const layers = build(model({ states: triangleFc, national: triangleFc }))
    const quadsOf = (id: string) => {
      const wall = layers.find((l) => l.id === id)
      expect(wall).toBeDefined()
      const props = wall!.props as unknown as {
        pickable: boolean
        data: [number, number, number][][]
      }
      expect(props.pickable).toBe(false)
      expect(props.data).toHaveLength(3)
      // Each quad is a closed vertical ring (5 points), standing on the ground.
      expect(props.data[0]).toHaveLength(5)
      expect(props.data[0][0][2]).toBe(0)
      expect(props.data[0][2][2]).toBeGreaterThan(0)
      return props.data
    }
    const stateQuads = quadsOf('state-walls')
    // The national wall stands taller than the state walls.
    const nationalQuads = quadsOf('national-wall')
    expect(nationalQuads[0][2][2]).toBeGreaterThan(stateQuads[0][2][2])
    // Crest lines ride the top of each wall (one path per ring, z = height).
    const crest = layers.find((l) => l.id === 'national-wall-crest')
    expect(crest).toBeDefined()
    const crestPaths = (crest!.props as unknown as { data: [number, number, number][][] }).data
    expect(crestPaths).toHaveLength(1)
    expect(crestPaths[0][0][2]).toBe(nationalQuads[0][2][2])
    // Walls and crests come last so earlier layers blend under them
    // instead of clipping.
    const tail = layers.slice(-4).map((l) => l.id)
    expect(tail).toEqual([
      'state-walls',
      'national-wall',
      'state-wall-crests',
      'national-wall-crest',
    ])
  })

  it('breathes the national crest with the pulse phase', () => {
    const colorAt = (pulse: number) =>
      (build(model(), pulse).find((l) => l.id === 'national-wall-crest')!.props as unknown as {
        getColor: [number, number, number, number]
      }).getColor[3]
    expect(colorAt(1)).toBeGreaterThan(colorAt(0))
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
          selectedCodigo: null,
          uf: null,
          fiscal: { segments: noSegments(), byCodigo: null },
        },
      }),
    )
    expect(layers.find((l) => l.id === 'demografia-columns')).toBeDefined()
    expect(layers.find((l) => l.id === 'power-columns-official')).toBeUndefined()
    // States stay pickable: clicking one crops the demographic camera on it.
    const states = layers.find((l) => l.id === 'states-choropleth')
    expect((states!.props as { pickable: boolean }).pickable).toBe(true)
  })

  it('draws municipal outlines in both views once meshes load', () => {
    // Influence view: context lines only, not pickable.
    const influence = build(model({ municipalBorders: munFc }))
    const context = influence.find((l) => l.id === 'municipal-borders')
    expect(context).toBeDefined()
    expect((context!.props as { pickable: boolean }).pickable).toBe(false)
    // Demographic view: pickable so footprint clicks open the city card.
    const demographic = {
      active: true,
      metric: 'population' as const,
      munis: [],
      hoveredCodigo: null,
      selectedCodigo: null,
      uf: null,
      fiscal: { segments: noSegments(), byCodigo: null },
    }
    const layers = build(model({ municipalBorders: munFc, demographic }))
    const borders = layers.find((l) => l.id === 'municipal-borders')
    expect(borders).toBeDefined()
    expect((borders!.props as { pickable: boolean }).pickable).toBe(true)
    // Not loaded yet -> no layer, no crash.
    expect(
      build(model({ demographic })).find((l) => l.id === 'municipal-borders'),
    ).toBeUndefined()
  })

  const poa = {
    codigo: '4314902',
    name: 'Porto Alegre',
    coordinates: [-51.2, -30] as [number, number],
    population: 1_300_000,
    gdpBrlThousands: 90_000_000,
  }
  const poaFiscal = () =>
    new Map([
      [
        '4314902',
        fiscalRecord('4314902', {
          arrecadacao: 29_000_000_000,
          previdencia: 8_000_000_000,
          ir: 12_000_000_000,
          ipi: 1_000_000_000,
          transferencias: 1_200_000_000,
          fpm: 400_000_000,
          fundeb: 700_000_000,
          emendas: 400_000_000,
        }),
      ],
    ])

  it('raises segmented fiscal layers on the PIB metric when segments are on', () => {
    const demographic = (metric: 'gdp' | 'population') => ({
      active: true,
      metric,
      munis: [poa],
      hoveredCodigo: null,
      selectedCodigo: null,
      uf: null,
      fiscal: { segments: defaultFiscalSegments(), byCodigo: poaFiscal() },
    })
    const fiscalIds = [
      'demografia-outflow-segments',
      'demografia-inflow-segments',
      'fiscal-flow-rails',
      'fiscal-flow-stripes',
    ]
    const gdp = build(model({ demographic: demographic('gdp') }))
    for (const id of fiscalIds) expect(gdp.find((l) => l.id === id)).toBeDefined()
    // The outflow band layer carries one instance per enabled tax segment.
    const outflow = gdp.find((l) => l.id === 'demografia-outflow-segments')
    expect((outflow!.props as { data: unknown[] }).data.length).toBe(4)
    // Population metric: R$ flows against a people scale make no sense.
    const pop = build(model({ demographic: demographic('population') }))
    for (const id of fiscalIds) expect(pop.find((l) => l.id === id)).toBeUndefined()
  })

  it('drops a segment from the stack when its toggle is off', () => {
    const segments = defaultFiscalSegments()
    segments.ipi = false
    const layers = build(
      model({
        demographic: {
          active: true,
          metric: 'gdp',
          munis: [poa],
          hoveredCodigo: null,
          selectedCodigo: null,
          uf: null,
          fiscal: { segments, byCodigo: poaFiscal() },
        },
      }),
    )
    const outflow = layers.find((l) => l.id === 'demografia-outflow-segments')
    // previdência + IR + demais remain; IPI is gone.
    expect((outflow!.props as { data: unknown[] }).data.length).toBe(3)
  })

  it('draws a rail plus several marching stripes per flow route', () => {
    const segments = noSegments()
    segments.previdencia = true
    segments.ir = true
    segments.ipi = true
    segments.demais = true
    const layers = build(
      model({
        demographic: {
          active: true,
          metric: 'gdp',
          munis: [poa],
          hoveredCodigo: null,
          selectedCodigo: null,
          uf: null,
          fiscal: { segments, byCodigo: poaFiscal() },
        },
      }),
    )
    // One route -> one rail path and several stripe segments over it.
    const rails = layers.find((l) => l.id === 'fiscal-flow-rails')
    const stripes = layers.find((l) => l.id === 'fiscal-flow-stripes')
    expect((rails!.props as { data: unknown[] }).data).toHaveLength(1)
    expect((stripes!.props as { data: unknown[] }).data.length).toBeGreaterThan(1)
  })

  it('gives every state a flow, not just the top movers', () => {
    // 20 huge SP municípios + one small AC município. Without the per-state
    // rule, AC (below the top 14) would get no arc.
    const munis = Array.from({ length: 20 }, (_, i) => ({
      codigo: `35${String(i).padStart(5, '0')}`,
      name: `SP ${i}`,
      coordinates: [-47 - i * 0.1, -22] as [number, number],
      population: 1_000_000,
      gdpBrlThousands: 50_000_000,
    }))
    const acre = {
      codigo: '1200013',
      name: 'Acrelândia',
      coordinates: [-67, -10] as [number, number],
      population: 15_000,
      gdpBrlThousands: 300_000,
    }
    const byCodigo = new Map(
      [...munis, acre].map((m) => [
        m.codigo,
        fiscalRecord(m.codigo, { arrecadacao: m.gdpBrlThousands * 200, ir: m.gdpBrlThousands * 200 }),
      ]),
    )
    const segments = noSegments()
    segments.ir = true
    const rails = build(
      model({
        demographic: {
          active: true,
          metric: 'gdp',
          munis: [...munis, acre],
          hoveredCodigo: null,
          selectedCodigo: null,
          uf: null,
          fiscal: { segments, byCodigo },
        },
      }),
    ).find((l) => l.id === 'fiscal-flow-rails')
    // 20 SP would fill the top-14; the per-state rule still keeps AC's arc,
    // so both states are represented (15 SP shown as top-14 + AC top = 15).
    const codigos = (rails!.props as { data: { path: number[][] }[] }).data.map(
      (d) => d.path,
    )
    expect(codigos.length).toBeGreaterThanOrEqual(15)
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
          selectedCodigo: null,
          uf: null,
          fiscal: { segments: noSegments(), byCodigo: null },
        },
      }),
    ).find((l) => l.id === 'demografia-columns')
    expect((layer!.props as { pickable: boolean }).pickable).toBe(true)
  })

  const statesFc = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { codarea: '35', UF: 'SP', name: 'São Paulo' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
      },
    ],
  } as unknown as MapLayerModel['states']
  const spMuni = {
    codigo: '3550308',
    name: 'São Paulo',
    coordinates: [-46.6, -23.5] as [number, number],
    population: 1_000_000,
    gdpBrlThousands: 1_000_000,
  }
  const demoModel = (uf: string | null) =>
    model({
      states: statesFc,
      demographic: {
        active: true,
        metric: 'population',
        munis: [spMuni],
        hoveredCodigo: null,
        selectedCodigo: null,
        uf,
        fiscal: { segments: noSegments(), byCodigo: null },
      },
    })
  const columnZ = (layers: ReturnType<typeof build>, datum: typeof spMuni) => {
    const layer = layers.find((l) => l.id === 'demografia-columns')!
    const getPos = (layer.props as unknown as { getPosition: (d: typeof spMuni) => number[] })
      .getPosition
    return getPos(datum)[2]
  }

  it('keeps columns grounded when no ripple plays (lift disabled)', () => {
    // Persistent state lift is off for now, so selecting a state alone does
    // not raise its columns — only a ripple does.
    expect(columnZ(build(demoModel(null)), spMuni)).toBe(0)
    expect(columnZ(build(demoModel('SP')), spMuni)).toBe(0)
  })

  it('bounces columns near the ripple epicenter, not far ones', () => {
    // Both municípios belong to SP (código prefix 35) and SP is cropped, so
    // both carry the base lift; only the near one gets the wavefront bump.
    const spFar = { ...spMuni, codigo: '3500000', coordinates: [-53, -20] as [number, number] }
    const layers = build(
      model({
        states: statesFc,
        demographic: {
          active: true,
          metric: 'population',
          munis: [spMuni, spFar],
          hoveredCodigo: null,
          selectedCodigo: null,
          uf: 'SP',
          fiscal: { segments: noSegments(), byCodigo: null },
        },
      }),
      undefined,
      { epicenter: [-46.6, -23.5], elapsed: 0 },
    )
    const near = columnZ(layers, spMuni)
    const far = columnZ(layers, spFar)
    expect(near).toBeGreaterThan(far) // near got the bump on top of the lift
  })

  it('does not ripple or lift columns of other states', () => {
    // SP cropped, but the ripple epicenter sits on an RJ município.
    const rjMuni = {
      codigo: '3300100',
      name: 'RJ',
      coordinates: [-43.2, -22.9] as [number, number],
      population: 100,
      gdpBrlThousands: 100,
    }
    const z = columnZ(
      build(
        model({
          states: statesFc,
          demographic: {
            active: true,
            metric: 'population',
            munis: [rjMuni],
            hoveredCodigo: null,
            selectedCodigo: null,
            uf: 'SP',
            fiscal: { segments: noSegments(), byCodigo: null },
          },
        }),
        undefined,
        { epicenter: [-43.2, -22.9], elapsed: 0 },
      ),
      rjMuni,
    )
    expect(z).toBe(0) // RJ column untouched by SP's click
  })
})
