/** pt-BR HUD readout formatters for the IBGE indicator values. */

/** Stands in for values IBGE suppressed or that failed to load. */
export const NOT_AVAILABLE = 'N/D'

const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const oneDecimalFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const compactFmt = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const gdpFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatInt(value: number | null): string {
  return value == null ? NOT_AVAILABLE : intFmt.format(value)
}

export function formatAreaKm2(value: number | null): string {
  return value == null ? NOT_AVAILABLE : `${intFmt.format(value)} km²`
}

export function formatDensity(value: number | null): string {
  return value == null ? NOT_AVAILABLE : `${oneDecimalFmt.format(value)} hab/km²`
}

/** `value` arrives in thousands of BRL (IBGE publishes PIB in "mil reais"). */
export function formatGdpThousands(value: number | null): string {
  return value == null ? NOT_AVAILABLE : gdpFmt.format(value * 1000)
}

/** Compact population readout for tight spots (tooltip): "44,4 mi hab". */
export function formatPeopleCompact(value: number | null): string {
  return value == null ? NOT_AVAILABLE : `${compactFmt.format(value)} hab`
}
