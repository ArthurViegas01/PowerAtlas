/** Which side of the trade the world arrows show. */
export type TradeDirection = 'export' | 'import'

/**
 * Where the world trade arrows radiate from — roughly Brazil's centroid, so
 * links fan out symmetrically instead of leaning off Brasília. Shared by the
 * arc model (fan geometry) and the renderer (arc origin) so they never drift.
 */
export const TRADE_ORIGIN: [number, number] = [-51, -12.5]

/** One sector (HS chapter) of a partner's trade, in whole US$ FOB. */
export interface TradeSector {
  /** HS chapter code (2-digit) or 'ZZ' for the aggregated "Outros" bucket. */
  code: string
  label: string
  exp: number
  imp: number
}

/**
 * One partner country's trade with Brazil (data/comercio/mundo.json), anchored
 * at the country centroid so an arrow can point Brazil -> partner. Values are
 * whole US$ FOB; `sectors` is sorted by combined flow, largest first.
 */
export interface TradePartner {
  iso: string
  name: string
  coordinates: [number, number]
  /** Total Brazilian exports to this partner. */
  exp: number
  /** Total Brazilian imports from this partner. */
  imp: number
  sectors: TradeSector[]
}

/** Compact wire format produced by scripts/fetch-comercio.mjs. */
export interface ComercioFile {
  referenceYear: number
  currency: string
  source: string
  totals: { exp: number; imp: number }
  /** HS chapter code -> human label (incl. 'ZZ' -> "Outros"). */
  sectors: Record<string, string>
  partners: [string, string, number, number, number, number, [string, number, number][]][]
}

/** The value of a partner (or sector) in the active direction. */
export function directionValue(
  entry: { exp: number; imp: number },
  direction: TradeDirection,
): number {
  return direction === 'export' ? entry.exp : entry.imp
}
