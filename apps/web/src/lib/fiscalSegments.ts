import type { RGBA } from '@/lib/palette'
import type { FiscalMunicipio } from '@/types/fiscal'

/**
 * Fiscal flow broken into stackable segments. Outflow (money leaving to
 * Brasília) is split by tax, inflow (money coming back) by transfer type.
 * Each segment carries its own distinct color — warm hues for outflow, cool
 * for inflow — so stacked bands never blur together. Column bands, the panel
 * swatches and the toggles all read from this one list.
 */
export type FiscalGroup = 'outflow' | 'inflow'

export type FiscalSegmentKey =
  | 'previdencia'
  | 'ir'
  | 'ipi'
  | 'demais'
  | 'fpm'
  | 'fundeb'
  | 'outras'
  | 'emendas'

export interface FiscalSegmentDef {
  key: FiscalSegmentKey
  label: string
  hint: string
  group: FiscalGroup
  /** Distinct band color [r, g, b]. */
  rgb: [number, number, number]
}

export const FISCAL_SEGMENTS: FiscalSegmentDef[] = [
  // Outflow — warm hues.
  { key: 'previdencia', label: 'PREVIDÊNCIA', hint: 'INSS', group: 'outflow', rgb: [255, 199, 64] },
  { key: 'ir', label: 'IMPOSTO DE RENDA', hint: 'IR', group: 'outflow', rgb: [255, 130, 52] },
  { key: 'ipi', label: 'IPI', hint: 'INDUSTRIALIZADOS', group: 'outflow', rgb: [255, 74, 94] },
  { key: 'demais', label: 'DEMAIS TRIBUTOS', hint: 'COFINS, CSLL, PIS…', group: 'outflow', rgb: [190, 225, 60] },
  // Inflow — cool hues.
  { key: 'fpm', label: 'FPM', hint: 'FUNDO DE PARTICIPAÇÃO', group: 'inflow', rgb: [61, 225, 255] },
  { key: 'fundeb', label: 'FUNDEB', hint: 'EDUCAÇÃO', group: 'inflow', rgb: [79, 224, 138] },
  { key: 'outras', label: 'OUTRAS TRANSFER.', hint: 'ITR, CIDE, IOF-OURO…', group: 'inflow', rgb: [91, 140, 255] },
  { key: 'emendas', label: 'EMENDAS', hint: 'PARLAMENTARES', group: 'inflow', rgb: [183, 139, 250] },
]

export const OUTFLOW_SEGMENTS = FISCAL_SEGMENTS.filter((s) => s.group === 'outflow')
export const INFLOW_SEGMENTS = FISCAL_SEGMENTS.filter((s) => s.group === 'inflow')

/** All segments visible by default. */
export function defaultFiscalSegments(): Record<FiscalSegmentKey, boolean> {
  return Object.fromEntries(FISCAL_SEGMENTS.map((s) => [s.key, true])) as Record<
    FiscalSegmentKey,
    boolean
  >
}

/** R$ value of one segment for a município (derived slices clamped >= 0). */
export function segmentValue(flows: FiscalMunicipio, key: FiscalSegmentKey): number {
  switch (key) {
    case 'previdencia':
      return flows.previdencia
    case 'ir':
      return flows.ir
    case 'ipi':
      return flows.ipi
    case 'demais':
      return Math.max(0, flows.arrecadacao - flows.previdencia - flows.ir - flows.ipi)
    case 'fpm':
      return flows.fpm
    case 'fundeb':
      return flows.fundeb
    case 'outras':
      return Math.max(0, flows.transferencias - flows.fpm - flows.fundeb)
    case 'emendas':
      return flows.emendas
  }
}

/** Band color for a segment at a given alpha. */
export function segmentColor(def: FiscalSegmentDef, alpha: number): RGBA {
  return [def.rgb[0], def.rgb[1], def.rgb[2], alpha]
}
