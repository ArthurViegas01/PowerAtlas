import type { CellValue, DatasetColumn } from '@/types/dataset'

export interface ParsedCsv {
  columns: DatasetColumn[]
  rows: Record<string, CellValue>[]
}

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

/**
 * Parse CSV text into fields. Handles quoted fields, escaped quotes and commas
 * or newlines inside quotes (RFC 4180). Returns a matrix of string cells.
 */
function parseCsvGrid(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const char = src[i]
    if (quoted) {
      if (char === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  // Flush the last field/row unless the input ended on a clean newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Detect whether every non-empty cell in a column is a number. */
function detectNumeric(cells: string[]): { numeric: boolean; allInteger: boolean } {
  let sawValue = false
  let allInteger = true
  for (const cell of cells) {
    const trimmed = cell.trim()
    if (trimmed === '') continue
    sawValue = true
    const normalized = trimmed.replace(/\s/g, '')
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return { numeric: false, allInteger: false }
    if (normalized.includes('.')) allInteger = false
  }
  return { numeric: sawValue, allInteger }
}

/**
 * Parse a CSV file into a console-ready dataset: the first line is the header
 * (column keys), and each column's type is inferred from its values (numeric
 * when every non-empty cell is a number). Empty numeric cells become null.
 */
export function parseCsvDataset(text: string): ParsedCsv {
  const grid = parseCsvGrid(text).filter((r) => r.some((c) => c.trim() !== ''))
  if (grid.length === 0) return { columns: [], rows: [] }
  const header = grid[0].map((h, i) => h.trim() || `coluna_${i + 1}`)
  const body = grid.slice(1)

  const columns: DatasetColumn[] = header.map((key, col) => {
    const cells = body.map((r) => r[col] ?? '')
    const { numeric, allInteger } = detectNumeric(cells)
    return {
      key,
      label: key.toUpperCase(),
      numeric,
      format: numeric ? (allInteger ? 'int' : 'decimal') : 'text',
    }
  })

  const rows: Record<string, CellValue>[] = body.map((cells) => {
    const row: Record<string, CellValue> = {}
    columns.forEach((column, col) => {
      const raw = (cells[col] ?? '').trim()
      if (column.numeric) {
        row[column.key] = raw === '' ? null : Number(raw.replace(/\s/g, ''))
      } else {
        row[column.key] = raw
      }
    })
    return row
  })

  return { columns, rows }
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
