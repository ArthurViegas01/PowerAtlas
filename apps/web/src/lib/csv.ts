import type { CellValue, DatasetColumn } from '@/types/dataset'

/** Quote a CSV field when it holds a delimiter, quote or newline (RFC 4180). */
function escapeCsv(value: CellValue): string {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Serialize a tabular dataset to CSV. Raw values only: the display formatters
 * (pt-BR currency, "N/D", …) are for the screen, not for a file another tool
 * will parse. Header is the column keys so a re-import round-trips.
 */
export function toCsv(columns: DatasetColumn[], rows: Record<string, CellValue>[]): string {
  const header = columns.map((c) => escapeCsv(c.key)).join(',')
  const body = rows.map((row) => columns.map((c) => escapeCsv(row[c.key] ?? null)).join(','))
  return [header, ...body].join('\r\n')
}

/** Serialize the rows to a pretty JSON array of objects (keys = column keys). */
export function toJson(columns: DatasetColumn[], rows: Record<string, CellValue>[]): string {
  const keys = columns.map((c) => c.key)
  const shaped = rows.map((row) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null])))
  return JSON.stringify(shaped, null, 2)
}

/** Trigger a client-side file download for a text blob. */
export function downloadText(filename: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
