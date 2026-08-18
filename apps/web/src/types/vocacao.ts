/**
 * Economic vocation datasets: which sectors a state or município specializes in.
 * Two independent sources joined under one feature:
 *
 *  - `comercio/uf.json`  — foreign-trade vocation per UF (HS chapters), from the
 *    SG_UF_NCM origin of the Comex flows. Fine sector detail (soja, minério,
 *    carnes, aço...) at state level; lets a partner's sector arrow originate from
 *    the state that specializes in it.
 *  - `vocacao/municipios.json` — VAB-by-activity vocation per município (four
 *    broad activities), with a national baseline so the front can compute a
 *    location quotient (the honest "vocação" metric).
 */
import type { TradeDirection } from '@/types/comercio'

// -- comercio/uf.json --------------------------------------------------------

/** One sector of a UF's trade: HS chapter, its exp/imp, and its top partners. */
export type UfSectorWire = [
  chapter: string,
  exp: number,
  imp: number,
  partners: [iso: string, exp: number, imp: number][],
]

/** One UF row: sigla, centroid lon/lat, totals, and its top sectors. */
export type UfRowWire = [
  uf: string,
  lon: number,
  lat: number,
  exp: number,
  imp: number,
  sectors: UfSectorWire[],
]

export interface ComercioUfFile {
  referenceYear: number
  currency: string
  source: string
  /** HS chapter code -> human label (shared with mundo.json). */
  sectors: Record<string, string>
  ufs: UfRowWire[]
}

/** The state that most specializes in a (partner, sector), for arrow origins. */
export interface SectorOriginUf {
  uf: string
  coordinates: [number, number]
  /** Flow of this (partner, sector) booked to this UF, in the queried direction. */
  value: number
}

// -- vocacao/municipios.json -------------------------------------------------

/** The four VAB activities the PIB dos Municípios splits into. */
export type VocacaoSectorKey = 'agro' | 'ind' | 'serv' | 'adm'

export interface VocacaoShares {
  agro: number
  ind: number
  serv: number
  adm: number
}

/** tuple: [codigo, vabTotal(milR$), agro%, ind%, serv%, adm%]. */
export type VocacaoMunicipioWire = [string, number, number, number, number, number]

export interface VocacaoMunicipiosFile {
  referenceYear: number
  source: string
  sectors: Record<VocacaoSectorKey, string>
  /** National share of each activity (%); the location-quotient denominator. */
  baseline: VocacaoShares
  municipios: VocacaoMunicipioWire[]
}

/** A município's vocation: VAB total, its activity shares, and the specialties. */
export interface MunicipioVocacao {
  codigo: string
  vabTotal: number
  shares: VocacaoShares
}

/** One specialty of a município: the activity and how far above the nation it is. */
export interface VocacaoSpecialty {
  key: VocacaoSectorKey
  share: number
  /** Location quotient = local share / national baseline (>1 = specialized). */
  lq: number
}

export type { TradeDirection }
