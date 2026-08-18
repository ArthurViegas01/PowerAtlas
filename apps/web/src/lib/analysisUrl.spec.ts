import { describe, expect, it } from 'vitest'

import { fromQuery, toQuery, type AnalysisState } from '@/lib/analysisUrl'

describe('toQuery', () => {
  it('omits defaults so a clean state is an empty query', () => {
    expect(toQuery({})).toEqual({})
    expect(toQuery({ trade: ['export'], setas: true })).toEqual({})
  })

  it('serializes a full analysis', () => {
    const state: AnalysisState = {
      region: 'SP',
      view: 'demografia',
      metric: 'gdp',
      uf: 'SP',
      brg: 45.4,
      pit: 60,
    }
    expect(toQuery(state)).toEqual({
      region: 'SP',
      view: 'demografia',
      metric: 'gdp',
      uf: 'SP',
      brg: '45',
      pit: '60',
    })
  })

  it('only carries metric and uf inside the demographic view', () => {
    expect(toQuery({ metric: 'gdp', uf: 'SP' })).toEqual({})
  })
})

describe('fromQuery', () => {
  it('round-trips what toQuery wrote', () => {
    const state: AnalysisState = {
      region: 'RS',
      view: 'demografia',
      metric: 'gdp',
      uf: 'RS',
      trade: ['import', 'export'],
      setas: false,
      brg: 270,
      pit: 45,
    }
    expect(fromQuery(toQuery(state))).toEqual(state)
  })

  it('round-trips the trade lens', () => {
    expect(fromQuery(toQuery({ view: 'comercio' }))).toEqual({ view: 'comercio' })
  })

  it('round-trips the power-scale choropleth flag', () => {
    expect(fromQuery(toQuery({ escala: true }))).toEqual({ escala: true })
    expect(toQuery({ escala: undefined })).toEqual({})
  })

  it('drops junk instead of throwing', () => {
    expect(
      fromQuery({
        region: 'XYZ',
        parceiro: 'C',
        view: 'nada',
        metric: 'gdp',
        trade: 'sideways',
        brg: 'NaN',
        pit: '999',
      }),
    ).toEqual({ pit: 85 })
  })

  it('normalizes case, wraps bearing and clamps pitch', () => {
    const state = fromQuery({ region: 'sp', parceiro: 'chn', brg: '-90', pit: '-10' })
    expect(state).toEqual({ region: 'SP', parceiro: 'CHN', brg: 270, pit: 0 })
  })

  it('takes the first value of repeated params', () => {
    expect(fromQuery({ region: ['SP', 'RS'] })).toEqual({ region: 'SP' })
  })
})
