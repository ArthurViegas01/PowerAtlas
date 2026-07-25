/**
 * Shapes of the /api/v1/datasets endpoints (operator-imported datasets, stored
 * in the isolated `datasets` namespace). Column descriptors reuse the console's
 * DatasetColumn so an imported dataset renders exactly like a built-in one.
 */
import type { CellValue, DatasetColumn } from '@/types/dataset'

export interface ImportedDatasetMeta {
  id: string
  name: string
  source: string
  columns: DatasetColumn[]
  rowCount: number
  createdAt: string
}

export interface ImportedDatasetDetail extends ImportedDatasetMeta {
  rows: Record<string, CellValue>[]
}

/** Body of POST /api/v1/datasets/import. */
export interface ImportPayload {
  name: string
  source: string
  columns: DatasetColumn[]
  rows: Record<string, CellValue>[]
}
