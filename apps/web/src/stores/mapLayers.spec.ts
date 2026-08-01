import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMapLayersStore } from '@/stores/mapLayers'
import { useSelectionStore } from '@/stores/selection'

/** Rio has bairros, São Paulo does not (IBGE divides it into distritos). */
const INDEX = {
  censusYear: 2022,
  municipios: { '3304557': { count: 2, level: 'bairro' } },
}
const RIO_FC = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        codigo: '3304557018',
        name: 'Copacabana',
        population: 128_919,
        households: 84_715,
        areaKm2: 4.1082,
        density: 31_380.9,
      },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
    },
  ],
}

const jsonResponse = (body: unknown) =>
  ({ ok: true, text: async () => JSON.stringify(body) }) as Response
// SPA hosting serves index.html with HTTP 200 for missing files.
const htmlResponse = () => ({ ok: true, text: async () => '<!doctype html>' }) as Response

const fetchMock = vi.fn()

/** Route by path so a test can assert which files were actually requested. */
function routes(overrides: Record<string, () => Response> = {}) {
  fetchMock.mockImplementation((url: string) => {
    for (const [suffix, response] of Object.entries(overrides)) {
      if (url.endsWith(suffix)) return Promise.resolve(response())
    }
    if (url.endsWith('subdivisoes/index.json')) return Promise.resolve(jsonResponse(INDEX))
    if (url.endsWith('subdivisoes/3304557.geojson')) return Promise.resolve(jsonResponse(RIO_FC))
    return Promise.resolve(htmlResponse())
  })
}

const urls = () => fetchMock.mock.calls.map(([url]) => String(url))

describe('mapLayers store: subdivision drill-down', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('loads the mesh of a município that has bairros and exposes it once drilled', async () => {
    routes()
    const store = useMapLayersStore()
    const selection = useSelectionStore()
    await store.loadSubdivisoes('3304557')
    expect(urls().some((url) => url.endsWith('subdivisoes/3304557.geojson'))).toBe(true)

    // The model only surfaces the mesh while that município is the drilled one.
    expect(store.layerModel.subdivisoes).toBeNull()
    selection.select('RJ', 'Rio de Janeiro')
    selection.selectMunicipio('3304557', 'Rio de Janeiro')
    expect(store.layerModel.subdivisoes?.features).toHaveLength(1)
    expect(store.layerModel.subdivisoes?.features[0].properties.name).toBe('Copacabana')
  })

  it('never requests a mesh for a município the index leaves out', async () => {
    routes()
    const store = useMapLayersStore()
    await store.loadSubdivisoes('3550308') // São Paulo: absent from the index
    expect(urls()).toEqual(['/geo/subdivisoes/index.json'])
    expect(store.subdivisaoInfoFor('3550308')?.count).toBe(0)
    expect(store.subdivisaoInfoFor('3304557')?.count).toBe(2)
  })

  it('reports an unknown count until the index lands', () => {
    routes()
    const store = useMapLayersStore()
    expect(store.subdivisaoInfoFor('3304557')).toBeNull()
    expect(store.subdivisaoInfoFor(null)).toBeNull()
  })

  it('fetches the index once and caches mesh attempts', async () => {
    routes()
    const store = useMapLayersStore()
    await store.loadSubdivisoes('3304557')
    await store.loadSubdivisoes('3304557')
    expect(urls().filter((url) => url.endsWith('index.json'))).toHaveLength(1)
    expect(urls().filter((url) => url.endsWith('3304557.geojson'))).toHaveLength(1)
  })

  it('treats an SPA fallback page as absent and does not retry', async () => {
    routes({ 'subdivisoes/3304557.geojson': htmlResponse })
    const store = useMapLayersStore()
    const selection = useSelectionStore()
    await store.loadSubdivisoes('3304557')
    await store.loadSubdivisoes('3304557')
    expect(urls().filter((url) => url.endsWith('3304557.geojson'))).toHaveLength(1)
    selection.select('RJ', 'Rio de Janeiro')
    selection.selectMunicipio('3304557', 'Rio de Janeiro')
    expect(store.layerModel.subdivisoes).toBeNull()
  })

  it('retries the coverage index after a network error', async () => {
    routes()
    fetchMock.mockRejectedValueOnce(new Error('offline')) // the index request
    const store = useMapLayersStore()
    await store.loadSubdivisoes('3304557')
    // The index is gone, but the mesh itself still loaded (the gate only
    // skips a fetch when the index positively says "no bairros here").
    expect(store.subdivisaoInfoFor('3304557')).toBeNull()
    // The next drill-down retries the index instead of giving up on it.
    await store.loadSubdivisoes('4314902')
    expect(store.subdivisaoInfoFor('3304557')?.count).toBe(2)
  })

  it('allows a retry after a network error on the mesh itself', async () => {
    routes({
      'subdivisoes/3304557.geojson': () => {
        throw new Error('offline')
      },
    })
    const store = useMapLayersStore()
    const selection = useSelectionStore()
    await store.loadSubdivisoes('3304557')
    selection.select('RJ', 'Rio de Janeiro')
    selection.selectMunicipio('3304557', 'Rio de Janeiro')
    expect(store.layerModel.subdivisoes).toBeNull()

    routes() // back online
    await store.loadSubdivisoes('3304557')
    expect(store.layerModel.subdivisoes?.features).toHaveLength(1)
  })
})
