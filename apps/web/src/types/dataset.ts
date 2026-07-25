/**
 * A dataset flattened to a common tabular shape so the data console can render
 * KPIs, tables, charts and exports the same way for every source (IBGE
 * indicators, demographic, fiscal, the fictional rankings, and later the
 * imported datasets). Built from the existing Pinia stores in lib/datasets.ts.
 */

export type CellValue = string | number | null

/** How a numeric cell is rendered (raw value is always kept for export/stats). */
export type ColumnFormat =
  | 'text'
  | 'int'
  | 'decimal'
  | 'brlThousands'
  | 'brl'
  | 'areaKm2'
  | 'density'

export interface DatasetColumn {
  key: string
  label: string
  /** numeric columns are right-aligned, sortable by value, feed the charts. */
  numeric: boolean
  format: ColumnFormat
}

export interface TabularDataset {
  id: string
  label: string
  /** One-line description shown under the title. */
  description: string
  /** Provenance line, e.g. "IBGE · CENSO 2022 · PIB 2023". */
  source: string
  /** Fictional/simulated data (the rankings) carries the permanent banner. */
  fictional: boolean
  columns: DatasetColumn[]
  rows: Record<string, CellValue>[]
  /** Headline numbers for the KPI row (export uses columns/rows only). */
  kpis: DatasetKpi[]
}

/** A single headline number derived from a dataset, rendered as a KpiTile. */
export interface DatasetKpi {
  label: string
  /** Numeric value for the animated counter (0 when the KPI is textual). */
  value: number
  /** Pre-formatted string shown instead of the raw value. */
  display: string
  hint?: string
}
