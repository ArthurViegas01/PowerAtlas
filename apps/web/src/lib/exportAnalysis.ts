import type { Map as MaplibreMap } from 'maplibre-gl'

import { toCsv, toJson } from '@/lib/csv'
import type { CellValue, DatasetColumn } from '@/types/dataset'
import type { RegionIndicators } from '@/types/indicators'
import type { PowerRegion } from '@/types/power-entity'

/**
 * Map/comparison export (PROD-6): pure row builders on top of the console's
 * CSV/JSON serializers, plus the PNG snapshot of the map stage. Raw values on
 * purpose (same rule as lib/csv.ts): formatters are for the screen.
 */

export interface RegionExportInput {
  id: string
  name: string
  indicators: RegionIndicators | null
  region: PowerRegion | null
}

const col = (key: string, label: string, numeric: boolean): DatasetColumn => ({
  key,
  label,
  numeric,
  format: numeric ? 'decimal' : 'text',
})

export const INDICATOR_COLUMNS: DatasetColumn[] = [
  col('regiao', 'Região', false),
  col('nome', 'Nome', false),
  col('populacao', 'População (Censo 2022)', true),
  col('area_km2', 'Área km²', true),
  col('densidade', 'Densidade hab/km²', true),
  col('pib_brl_mil', 'PIB (mil R$, 2023)', true),
  col('proveniencia', 'Proveniência', false),
]

export const ENTITY_COLUMNS: DatasetColumn[] = [
  col('regiao', 'Região', false),
  col('entidade', 'Entidade', false),
  col('tipo', 'Tipo', false),
  col('dimensao', 'Dimensão', false),
  col('score', 'Score 0-100', true),
  col('delta', 'Delta', true),
  col('confianca', 'Confiança', false),
  col('status', 'Status', false),
  col('proveniencia', 'Proveniência', false),
]

/** One row per region: the IBGE indicators, provenance stamped REAL. */
export function buildIndicatorRows(items: RegionExportInput[]): Record<string, CellValue>[] {
  return items.map((item) => ({
    regiao: item.id,
    nome: item.name,
    populacao: item.indicators?.population ?? null,
    area_km2: item.indicators?.areaKm2 ?? null,
    densidade: item.indicators?.density ?? null,
    pib_brl_mil: item.indicators?.gdpBrlThousands ?? null,
    proveniencia: 'REAL · IBGE',
  }))
}

/** One row per ranking entity, provenance stamped SIMULADO (fictional). */
export function buildEntityRows(items: RegionExportInput[]): Record<string, CellValue>[] {
  const rows: Record<string, CellValue>[] = []
  for (const item of items) {
    for (const entity of item.region?.official ?? []) {
      rows.push({
        regiao: item.id,
        entidade: entity.name,
        tipo: entity.kind,
        dimensao: entity.dimension,
        score: entity.score,
        delta: entity.delta,
        confianca: entity.confidence,
        status: entity.status,
        proveniencia: 'SIMULADO',
      })
    }
  }
  return rows
}

/** poweratlas-<base>-<yyyy-mm-dd>.<ext>, base slugged to [a-z0-9-]. */
export function exportFileName(base: string, ext: string, now = new Date()): string {
  const slug = base
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const stamp = now.toISOString().slice(0, 10)
  return `poweratlas-${slug || 'analise'}-${stamp}.${ext}`
}

/** CSV with the two blocks separated by a blank line (one file, no zip dep). */
export function buildAnalysisCsv(items: RegionExportInput[]): string {
  const indicadores = toCsv(INDICATOR_COLUMNS, buildIndicatorRows(items))
  const entidades = toCsv(ENTITY_COLUMNS, buildEntityRows(items))
  return `${indicadores}\r\n\r\n${entidades}`
}

export function buildAnalysisJson(items: RegionExportInput[]): string {
  return JSON.stringify(
    {
      geradoEm: new Date().toISOString(),
      proveniencia: {
        indicadores: 'REAL · IBGE (Censo 2022, PIB 2023)',
        entidades: 'SIMULADO · ranking ficticio de desenvolvimento',
      },
      indicadores: JSON.parse(toJson(INDICATOR_COLUMNS, buildIndicatorRows(items))) as unknown,
      entidades: JSON.parse(toJson(ENTITY_COLUMNS, buildEntityRows(items))) as unknown,
    },
    null,
    2,
  )
}

/** Client-side download of a binary blob (the text twin lives in lib/csv). */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Header/footer strips drawn straight onto the snapshot (no DOM capture). */
function drawBranding(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  subtitle: string,
): void {
  const dpr = Math.max(1, Math.round(width / 1280))
  const pad = 16 * dpr
  const strip = 44 * dpr
  ctx.fillStyle = 'rgba(3, 6, 8, 0.82)'
  ctx.fillRect(0, 0, width, strip)
  ctx.fillRect(0, height - strip, width, strip)
  ctx.fillStyle = '#d7f3ff'
  ctx.font = `600 ${15 * dpr}px "Fira Code", ui-monospace, monospace`
  ctx.textBaseline = 'middle'
  ctx.fillText(`POWERATLAS · ${subtitle}`, pad, strip / 2)
  ctx.fillStyle = '#ffb347'
  ctx.font = `${11 * dpr}px "Fira Code", ui-monospace, monospace`
  ctx.fillText(
    'PROTOTIPO · RANKINGS FICTICIOS (SIMULADO) · INDICADORES REAIS COM SELO DE ORIGEM',
    pad,
    height - strip / 2,
  )
}

/**
 * PNG snapshot of the map stage (PROD-6): the maplibre canvas must be read
 * inside its own render event (preserveDrawingBuffer is off); the deck
 * overlay canvas is readable any time (luma 9 preserves by default). Both are
 * composited over the void, branding strips on top. The timeout fallback
 * covers hidden tabs, where the render event never fires; the capture then
 * degrades to whatever the buffers still hold instead of hanging.
 */
export function captureMapPng(map: MaplibreMap, subtitle: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (blob: Blob | null) => {
      if (!settled) {
        settled = true
        resolve(blob)
      }
    }
    const draw = () => {
      try {
        const base = map.getCanvas()
        const container = map.getContainer()
        const out = document.createElement('canvas')
        out.width = base.width
        out.height = base.height
        const ctx = out.getContext('2d')
        if (!ctx) {
          finish(null)
          return
        }
        ctx.fillStyle = '#030608'
        ctx.fillRect(0, 0, out.width, out.height)
        for (const canvas of container.querySelectorAll('canvas')) {
          ctx.drawImage(canvas, 0, 0, out.width, out.height)
        }
        drawBranding(ctx, out.width, out.height, subtitle)
        out.toBlob((blob) => finish(blob), 'image/png')
      } catch {
        finish(null)
      }
    }
    map.once('render', draw)
    map.triggerRepaint()
    window.setTimeout(() => {
      map.off('render', draw)
      draw()
    }, 900)
  })
}
