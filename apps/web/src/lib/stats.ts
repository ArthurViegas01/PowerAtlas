/**
 * Small, dependency-free statistics used by the data console charts. Pure
 * functions over number arrays, covered by stats.spec.ts. Nulls are the
 * caller's job to strip before calling (the dataset columns are `number | null`).
 */

export interface HistogramBin {
  /** Left edge (inclusive). In log mode this is the raw value, not its log. */
  x0: number
  /** Right edge (exclusive, except the last bin which is inclusive). */
  x1: number
  count: number
}

export interface Extent {
  min: number
  max: number
}

/** Min/max of a list, or null when empty. */
export function extent(values: number[]): Extent | null {
  if (values.length === 0) return null
  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}

/**
 * Quantile of a list (0..1) via linear interpolation between order
 * statistics. Sorts a copy, so the caller's array is untouched.
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base])
}

/**
 * Pearson correlation of two equal-length series. Returns 0 for degenerate
 * input (length < 2 or a series with no variance) so a heatmap cell stays
 * neutral instead of NaN.
 */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

/**
 * Bin values into a histogram. `log` bins on log10 of the values (only the
 * strictly positive ones), which is what makes the fiscal/PIB distributions
 * legible (a handful of giant municípios otherwise crush everything into the
 * first linear bin). Bin edges are still returned in raw value space.
 */
export function histogram(values: number[], binCount = 24, log = false): HistogramBin[] {
  const usable = log ? values.filter((v) => v > 0) : values
  const ext = extent(usable)
  if (!ext || binCount < 1) return []
  const lo = log ? Math.log10(ext.min) : ext.min
  const hi = log ? Math.log10(ext.max) : ext.max
  if (lo === hi) {
    return [{ x0: ext.min, x1: ext.max, count: usable.length }]
  }
  const step = (hi - lo) / binCount
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const e0 = lo + i * step
    const e1 = lo + (i + 1) * step
    return { x0: log ? 10 ** e0 : e0, x1: log ? 10 ** e1 : e1, count: 0 }
  })
  for (const v of usable) {
    const scaled = log ? Math.log10(v) : v
    let idx = Math.floor((scaled - lo) / step)
    if (idx < 0) idx = 0
    if (idx >= binCount) idx = binCount - 1
    bins[idx].count++
  }
  return bins
}

/** The `n` largest items by a value accessor (descending). */
export function topN<T>(items: T[], value: (item: T) => number, n: number): T[] {
  return [...items].sort((a, b) => value(b) - value(a)).slice(0, n)
}

/**
 * Correlation matrix for a set of named numeric series (rows aligned by index).
 * Diagonal is 1. Used by the console's correlation heatmap.
 */
export function correlationMatrix(series: { key: string; values: number[] }[]): number[][] {
  return series.map((a) => series.map((b) => (a.key === b.key ? 1 : pearson(a.values, b.values))))
}
