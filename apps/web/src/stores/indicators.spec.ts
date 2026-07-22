import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useIndicatorsStore } from '@/stores/indicators'

const SP_CAPITAL = {
  population: 11_451_999,
  areaKm2: 1521.202,
  density: 7528.26,
  gdpBrlThousands: 1_066_825_105,
}
const UF_FILE = {
  censusYear: 2022,
  gdpYear: 2023,
  regions: {
    BR: { population: 203_080_756, areaKm2: 8_510_417.771, density: 23.86, gdpBrlThousands: 10_943_345_439 },
    SP: { population: 44_411_238, areaKm2: 248_219.485, density: 178.92, gdpBrlThousands: 3_444_814_033 },
  },
}
const SP_FILE = { censusYear: 2022, gdpYear: 2023, municipios: { '3550308': SP_CAPITAL } }

const jsonResponse = (body: unknown) =>
  ({ ok: true, text: async () => JSON.stringify(body) }) as Response
// SPA hosting serves index.html with HTTP 200 for missing files.
const htmlResponse = () => ({ ok: true, text: async () => '<!doctype html>' }) as Response

const fetchMock = vi.fn()

describe('indicators store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('loads the UF file once and resolves regions', async () => {
    fetchMock.mockResolvedValue(jsonResponse(UF_FILE))
    const store = useIndicatorsStore()
    expect(store.forRegion('SP')).toBeNull()
    await store.loadUf()
    await store.loadUf()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.forRegion('BR')?.population).toBe(203_080_756)
    expect(store.forRegion('SP')?.gdpBrlThousands).toBe(3_444_814_033)
    expect(store.forRegion('ZZ')).toBeNull()
    expect(store.forRegion(null)).toBeNull()
    expect(store.sourceLabel).toBe('IBGE · CENSO 2022 · PIB 2023')
  })

  it('loads municipal files on demand, never for BR, and caches attempts', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SP_FILE))
    const store = useIndicatorsStore()
    await store.loadMunicipios('BR')
    expect(fetchMock).not.toHaveBeenCalled()
    await store.loadMunicipios('SP')
    await store.loadMunicipios('SP')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.forMunicipio('SP', '3550308')?.population).toBe(11_451_999)
    expect(store.forMunicipio('SP', '0000000')).toBeNull()
    expect(store.forMunicipio(null, '3550308')).toBeNull()
  })

  it('treats an SPA fallback page as absent and does not retry', async () => {
    fetchMock.mockResolvedValue(htmlResponse())
    const store = useIndicatorsStore()
    await store.loadMunicipios('SP')
    await store.loadMunicipios('SP')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.forMunicipio('SP', '3550308')).toBeNull()
  })

  it('allows a retry after a network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const store = useIndicatorsStore()
    await store.loadMunicipios('SP')
    expect(store.forMunicipio('SP', '3550308')).toBeNull()
    fetchMock.mockResolvedValue(jsonResponse(SP_FILE))
    await store.loadMunicipios('SP')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.forMunicipio('SP', '3550308')?.population).toBe(11_451_999)
  })
})
