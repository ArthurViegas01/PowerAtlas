/**
 * Turns a TabularDataset into a list of chart specs the console renders. Fully
 * generic and driven by column metadata, so it also covers the imported
 * datasets later: the first numeric column is the headline metric, the first
 * text column labels the rows, and correlation spans every numeric column.
 */
import { formatCell } from '@/lib/datasets'
import { correlationMatrix, extent, topN } from '@/lib/stats'
import type { CellValue, ColumnFormat, DatasetColumn, TabularDataset } from '@/types/dataset'

export interface BarSpec {
  kind: 'bar'
  title: string
  hint: string
  items: { label: string; value: number; display: string }[]
}
export interface HistogramSpec {
  kind: 'histogram'
  title: string
  hint: string
  values: number[]
  format: ColumnFormat
  allowLog: boolean
}
export interface ScatterSpec {
  kind: 'scatter'
  title: string
  hint: string
  points: { x: number; y: number; label: string }[]
  xLabel: string
  yLabel: string
  xFormat: ColumnFormat
  yFormat: ColumnFormat
  logX: boolean
  logY: boolean
}
export interface LineSpec {
  kind: 'line'
  title: string
  hint: string
  /** Cumulative share (0..1) at each rank fraction (0..1). */
  values: number[]
}
export interface HeatmapSpec {
  kind: 'heatmap'
  title: string
  hint: string
  keys: string[]
  matrix: number[][]
}

export type ChartSpec = BarSpec | HistogramSpec | ScatterSpec | LineSpec | HeatmapSpec

/** Numbers only, nulls dropped. */
function numbersOf(rows: Record<string, CellValue>[], key: string): number[] {
  const out: number[] = []
  for (const row of rows) {
    const v = row[key]
    if (typeof v === 'number') out.push(v)
  }
  return out
}

/** A column spans several orders of magnitude and is strictly positive. */
function isHeavyTailed(values: number[]): boolean {
  const positives = values.filter((v) => v > 0)
  const ext = extent(positives)
  return ext !== null && ext.min > 0 && ext.max / ext.min > 1000
}

/** Cumulative share of the total held by the top-k, over the rank fraction. */
function concentrationCurve(values: number[]): number[] {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => b - a)
  const total = sorted.reduce((s, v) => s + v, 0)
  if (total === 0) return []
  const out: number[] = [0]
  let acc = 0
  for (const v of sorted) {
    acc += v
    out.push(acc / total)
  }
  return out
}

export function chartsFor(dataset: TabularDataset): ChartSpec[] {
  const numeric = dataset.columns.filter((c) => c.numeric)
  const labelCol =
    dataset.columns.find((c) => !c.numeric && c.key !== 'codigo') ??
    dataset.columns.find((c) => !c.numeric)
  if (numeric.length === 0 || !labelCol) return []

  const primary = numeric[0]
  const secondary = numeric.length > 1 ? numeric[numeric.length - 1] : primary
  const specs: ChartSpec[] = []

  // Top-N bar by the headline metric.
  const ranked = topN(
    dataset.rows.filter((r) => typeof r[primary.key] === 'number'),
    (r) => r[primary.key] as number,
    12,
  )
  specs.push({
    kind: 'bar',
    title: `MAIORES · ${primary.label}`,
    hint: 'TOP 12',
    items: ranked.map((r) => ({
      label: String(r[labelCol.key] ?? ''),
      value: r[primary.key] as number,
      display: formatCell(primary, r[primary.key] ?? null),
    })),
  })

  // Distribution of the headline metric.
  const primaryValues = numbersOf(dataset.rows, primary.key)
  specs.push({
    kind: 'histogram',
    title: `DISTRIBUIÇÃO · ${primary.label}`,
    hint: `${primaryValues.length} REGISTROS`,
    values: primaryValues,
    format: primary.format,
    allowLog: isHeavyTailed(primaryValues),
  })

  // Relationship between the headline metric and another numeric column.
  if (secondary.key !== primary.key) {
    const points: { x: number; y: number; label: string }[] = []
    for (const row of dataset.rows) {
      const x = row[primary.key]
      const y = row[secondary.key]
      if (typeof x === 'number' && typeof y === 'number') {
        points.push({ x, y, label: String(row[labelCol.key] ?? '') })
      }
    }
    specs.push({
      kind: 'scatter',
      title: `${primary.label} × ${secondary.label}`,
      hint: 'RELAÇÃO',
      points,
      xLabel: primary.label,
      yLabel: secondary.label,
      xFormat: primary.format,
      yFormat: secondary.format,
      logX: isHeavyTailed(points.map((p) => p.x)),
      logY: isHeavyTailed(points.map((p) => p.y)),
    })
  }

  // Concentration curve (how top-heavy the headline metric is).
  const curve = concentrationCurve(primaryValues)
  if (curve.length > 2) {
    specs.push({
      kind: 'line',
      title: `CONCENTRAÇÃO · ${primary.label}`,
      hint: 'SHARE ACUMULADO',
      values: curve,
    })
  }

  // Correlation across every numeric column. Correlation needs index-aligned
  // series, so restrict to the rows where every numeric column is present.
  if (numeric.length > 1) {
    const complete = dataset.rows.filter((row) =>
      numeric.every((c: DatasetColumn) => typeof row[c.key] === 'number'),
    )
    const series = numeric.map((c: DatasetColumn) => ({
      key: c.label,
      values: complete.map((row) => row[c.key] as number),
    }))
    specs.push({
      kind: 'heatmap',
      title: 'CORRELAÇÃO',
      hint: `${complete.length} REGISTROS`,
      keys: numeric.map((c) => c.label),
      matrix: correlationMatrix(series),
    })
  }

  return specs
}
