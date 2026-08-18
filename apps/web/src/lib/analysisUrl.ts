import type { LocationQuery } from 'vue-router'

import type { TradeDirection } from '@/types/comercio'

/**
 * Serializable analysis state (IA-3): everything needed to rebuild the map
 * screen from a URL. Pure module: building a state from the stores and
 * applying one back is the analysis store's job.
 */
export interface AnalysisState {
  /** BR or a UF (rankings region id). */
  region?: string
  /** Trade partner ISO3, opens the partner panel in the global context. */
  parceiro?: string
  /** Non-default lenses (IA-1b): demographic columns or the global trade view. */
  view?: 'demografia' | 'comercio'
  metric?: 'population' | 'gdp'
  /** UF crop inside the demographic view. */
  uf?: string
  /** Trade directions shown, in activation order. */
  trade?: TradeDirection[]
  /** Animated trade arrows visible. */
  setas?: boolean
  /** Manual bearing override in degrees. */
  brg?: number
  /** Manual pitch override in degrees. */
  pit?: number
  /** Power-scale choropleth on (PROD-3). */
  escala?: boolean
}

const UF_RE = /^[A-Z]{2}$/
const ISO_RE = /^[A-Z]{3}$/

/** State -> query params. Defaults are omitted so clean URLs stay clean. */
export function toQuery(state: AnalysisState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.region) query.region = state.region
  if (state.parceiro) query.parceiro = state.parceiro
  if (state.view) query.view = state.view
  if (state.view === 'demografia' && state.metric === 'gdp') query.metric = 'gdp'
  if (state.view === 'demografia' && state.uf) query.uf = state.uf
  if (state.trade && state.trade.join(',') !== 'export') query.trade = state.trade.join(',')
  if (state.setas === false) query.setas = '0'
  if (state.brg !== undefined) query.brg = String(Math.round(state.brg))
  if (state.pit !== undefined) query.pit = String(Math.round(state.pit))
  if (state.escala) query.escala = '1'
  return query
}

const first = (value: LocationQuery[string]): string | null => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && raw !== '' ? raw : null
}

/** Query params -> validated state; junk params are dropped, never thrown. */
export function fromQuery(query: LocationQuery): AnalysisState {
  const state: AnalysisState = {}
  const region = first(query.region)?.toUpperCase()
  if (region && (region === 'BR' || UF_RE.test(region))) state.region = region
  const parceiro = first(query.parceiro)?.toUpperCase()
  if (parceiro && ISO_RE.test(parceiro)) state.parceiro = parceiro
  const view = first(query.view)
  if (view === 'demografia') {
    state.view = 'demografia'
    if (first(query.metric) === 'gdp') state.metric = 'gdp'
    const uf = first(query.uf)?.toUpperCase()
    if (uf && UF_RE.test(uf)) state.uf = uf
  } else if (view === 'comercio') {
    state.view = 'comercio'
  }
  const trade = first(query.trade)
  if (trade) {
    const dirs = trade
      .split(',')
      .filter((dir): dir is TradeDirection => dir === 'export' || dir === 'import')
    if (dirs.length) state.trade = [...new Set(dirs)]
  }
  if (first(query.setas) === '0') state.setas = false
  const brg = Number(first(query.brg))
  if (first(query.brg) !== null && Number.isFinite(brg)) {
    state.brg = ((Math.round(brg) % 360) + 360) % 360
  }
  const pit = Number(first(query.pit))
  if (first(query.pit) !== null && Number.isFinite(pit)) {
    state.pit = Math.min(85, Math.max(0, Math.round(pit)))
  }
  if (first(query.escala) === '1') state.escala = true
  return state
}
