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
const brlFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const usdFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
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

/** One decimal place, no unit ("1,4"). */
export function formatDecimal(value: number | null): string {
  return value == null ? NOT_AVAILABLE : oneDecimalFmt.format(value)
}

/** Compact BRL for values already in whole reais ("R$ 2,8 tri"). */
export function formatBrl(value: number | null): string {
  return value == null ? NOT_AVAILABLE : brlFmt.format(value)
}

/** Compact count ("5,57 mil", "1,2 mi") for headline tiles. */
export function formatCompact(value: number | null): string {
  return value == null ? NOT_AVAILABLE : compactFmt.format(value)
}

/** Compact USD for whole-dollar trade values ("US$ 34,8 bi"). */
export function formatUsd(value: number | null): string {
  return value == null ? NOT_AVAILABLE : usdFmt.format(value)
}

/**
 * Compact USD split into its currency symbol and the amount ("US$" + "34,8
 * bi"), so a table can pin the symbol left and right-align the number.
 */
export function formatUsdParts(value: number | null): { currency: string; amount: string } {
  if (value == null) return { currency: '', amount: NOT_AVAILABLE }
  const parts = usdFmt.formatToParts(value)
  const currency = parts.find((part) => part.type === 'currency')?.value ?? ''
  const amount = parts
    .filter((part) => part.type !== 'currency')
    .map((part) => part.value)
    .join('')
    .trim()
  return { currency, amount }
}
