/**
 * Adapts the app's in-memory datasets (IBGE indicators, demographic, fiscal,
 * the fictional rankings) to the common tabular shape the data console renders.
 * Pure functions over plain data pulled from the Pinia stores, so they stay
 * testable and never re-fetch. New sources (imported CSVs) plug in as more
 * TabularDataset builders.
 */
import {
  formatAreaKm2,
  formatBrl,
  formatDecimal,
  formatGdpThousands,
  formatInt,
  NOT_AVAILABLE,
} from '@/lib/format'
import type {
  CellValue,
  DatasetColumn,
  DatasetKpi,
  TabularDataset,
} from '@/types/dataset'
import type { DemografiaMunicipio } from '@/types/demografia'
import type { FiscalMunicipio } from '@/types/fiscal'
import type { RegionIndicators, UfIndicatorsFile } from '@/types/indicators'
import type { PowerRegion } from '@/types/power-entity'

/** 2-digit IBGE UF geocode -> sigla, to label the municipal datasets. */
const UF_BY_CODE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP',
  '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB',
  '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES',
  '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS',
  '51': 'MT', '52': 'GO', '53': 'DF',
}

function ufOf(codigo: string): string {
  return UF_BY_CODE[codigo.slice(0, 2)] ?? '--'
}

/** Render one cell for display (raw values stay untouched for export/stats). */
export function formatCell(column: DatasetColumn, value: CellValue): string {
  if (!column.numeric) return value == null ? '' : String(value)
  const num = typeof value === 'number' ? value : null
  switch (column.format) {
    case 'int':
      return formatInt(num)
    case 'decimal':
      return formatDecimal(num)
    case 'brlThousands':
      return formatGdpThousands(num)
    case 'brl':
      return formatBrl(num)
    case 'areaKm2':
      return formatAreaKm2(num)
    case 'density':
      return formatDecimal(num)
    default:
      return num == null ? NOT_AVAILABLE : String(num)
  }
}

/** Sum a numeric column, ignoring nulls. */
function sumColumn(rows: Record<string, CellValue>[], key: string): number {
  let total = 0
  for (const row of rows) {
    const value = row[key]
    if (typeof value === 'number') total += value
  }
  return total
}

/** Count rows whose column value is a real number (coverage). */
function coverage(rows: Record<string, CellValue>[], key: string): number {
  return rows.filter((row) => typeof row[key] === 'number').length
}

function kpi(label: string, value: number, display: string, hint?: string): DatasetKpi {
  return { label, value, display, hint }
}

// -- IBGE indicators (BR + 27 UFs) -------------------------------------------

export function buildIndicatorsDataset(file: UfIndicatorsFile | null): TabularDataset {
  const columns: DatasetColumn[] = [
    { key: 'id', label: 'REGIÃO', numeric: false, format: 'text' },
    { key: 'population', label: 'POPULAÇÃO', numeric: true, format: 'int' },
    { key: 'areaKm2', label: 'ÁREA', numeric: true, format: 'areaKm2' },
    { key: 'density', label: 'DENSIDADE', numeric: true, format: 'density' },
    { key: 'gdpBrlThousands', label: 'PIB', numeric: true, format: 'brlThousands' },
  ]
  const rows: Record<string, CellValue>[] = Object.entries(file?.regions ?? {}).map(
    ([id, ind]: [string, RegionIndicators]) => ({
      id,
      population: ind.population,
      areaKm2: ind.areaKm2,
      density: ind.density,
      gdpBrlThousands: ind.gdpBrlThousands,
    }),
  )
  const source = file ? `IBGE · CENSO ${file.censusYear} · PIB ${file.gdpYear}` : 'IBGE'
  return {
    id: 'indicators',
    label: 'INDICADORES IBGE',
    description: 'População, área, densidade e PIB por região (Brasil + 27 UFs).',
    source,
    fictional: false,
    columns,
    rows,
    kpis: [
      kpi('REGIÕES', rows.length, formatInt(rows.length)),
      kpi(
        'POPULAÇÃO BR',
        rows.find((r) => r.id === 'BR')?.population as number ?? 0,
        formatInt((rows.find((r) => r.id === 'BR')?.population as number) ?? null),
        'CENSO 2022',
      ),
      kpi(
        'PIB BR',
        (rows.find((r) => r.id === 'BR')?.gdpBrlThousands as number) ?? 0,
        formatGdpThousands((rows.find((r) => r.id === 'BR')?.gdpBrlThousands as number) ?? null),
        'PIB 2023',
      ),
    ],
  }
}

// -- Demographic (5.570 municípios) ------------------------------------------

export function buildDemografiaDataset(
  municipios: DemografiaMunicipio[],
  censusYear: number | null,
  gdpYear: number | null,
): TabularDataset {
  const columns: DatasetColumn[] = [
    { key: 'codigo', label: 'CÓD IBGE', numeric: false, format: 'text' },
    { key: 'name', label: 'MUNICÍPIO', numeric: false, format: 'text' },
    { key: 'uf', label: 'UF', numeric: false, format: 'text' },
    { key: 'population', label: 'POPULAÇÃO', numeric: true, format: 'int' },
    { key: 'gdpBrlThousands', label: 'PIB', numeric: true, format: 'brlThousands' },
  ]
  const rows: Record<string, CellValue>[] = municipios.map((m) => ({
    codigo: m.codigo,
    name: m.name,
    uf: ufOf(m.codigo),
    population: m.population,
    gdpBrlThousands: m.gdpBrlThousands,
  }))
  const totalPop = sumColumn(rows, 'population')
  const totalGdp = sumColumn(rows, 'gdpBrlThousands')
  const source =
    censusYear && gdpYear ? `IBGE · CENSO ${censusYear} · PIB ${gdpYear}` : 'IBGE'
  return {
    id: 'demografia',
    label: 'DEMOGRAFIA',
    description: 'Centroide, população e PIB dos 5.570 municípios.',
    source,
    fictional: false,
    columns,
    rows,
    kpis: [
      kpi('MUNICÍPIOS', rows.length, formatInt(rows.length)),
      kpi('POPULAÇÃO TOTAL', totalPop, formatInt(totalPop), 'CENSO 2022'),
      kpi('PIB TOTAL', totalGdp, formatGdpThousands(totalGdp), 'PIB 2023'),
    ],
  }
}

// -- Fiscal flows (5.570 municípios, real 2025) ------------------------------

export function buildFiscalDataset(
  byCodigo: Map<string, FiscalMunicipio>,
  referenceYear: number | null,
  nameByCodigo: Map<string, string>,
): TabularDataset {
  const columns: DatasetColumn[] = [
    { key: 'codigo', label: 'CÓD IBGE', numeric: false, format: 'text' },
    { key: 'name', label: 'MUNICÍPIO', numeric: false, format: 'text' },
    { key: 'uf', label: 'UF', numeric: false, format: 'text' },
    { key: 'arrecadacao', label: 'ARRECADAÇÃO', numeric: true, format: 'brl' },
    { key: 'previdencia', label: 'PREVIDÊNCIA', numeric: true, format: 'brl' },
    { key: 'ir', label: 'IR', numeric: true, format: 'brl' },
    { key: 'ipi', label: 'IPI', numeric: true, format: 'brl' },
    { key: 'demais', label: 'DEMAIS', numeric: true, format: 'brl' },
    { key: 'transferencias', label: 'TRANSFERÊNCIAS', numeric: true, format: 'brl' },
    { key: 'fpm', label: 'FPM', numeric: true, format: 'brl' },
    { key: 'fundeb', label: 'FUNDEB', numeric: true, format: 'brl' },
    { key: 'outras', label: 'OUTRAS TRANSF.', numeric: true, format: 'brl' },
    { key: 'emendas', label: 'EMENDAS', numeric: true, format: 'brl' },
  ]
  const rows: Record<string, CellValue>[] = [...byCodigo.values()].map((f) => ({
    codigo: f.codigo,
    name: nameByCodigo.get(f.codigo) ?? f.codigo,
    uf: ufOf(f.codigo),
    arrecadacao: f.arrecadacao,
    previdencia: f.previdencia,
    ir: f.ir,
    ipi: f.ipi,
    demais: Math.max(0, f.arrecadacao - f.previdencia - f.ir - f.ipi),
    transferencias: f.transferencias,
    fpm: f.fpm,
    fundeb: f.fundeb,
    outras: Math.max(0, f.transferencias - f.fpm - f.fundeb),
    emendas: f.emendas,
  }))
  const totalArr = sumColumn(rows, 'arrecadacao')
  const totalTransf = sumColumn(rows, 'transferencias')
  const totalEmendas = sumColumn(rows, 'emendas')
  return {
    id: 'fiscal',
    label: 'FLUXO FISCAL',
    description: 'Arrecadação federal, transferências e emendas por município.',
    source: referenceYear
      ? `RECEITA FEDERAL · TESOURO · TRANSPARÊNCIA · ${referenceYear}`
      : 'RECEITA FEDERAL · TESOURO · TRANSPARÊNCIA',
    fictional: false,
    columns,
    rows,
    kpis: [
      kpi('ARRECADAÇÃO', totalArr, formatBrl(totalArr), referenceYear ? `${referenceYear}` : ''),
      kpi('TRANSFERÊNCIAS', totalTransf, formatBrl(totalTransf), 'FPM · FUNDEB · OUTRAS'),
      kpi('EMENDAS', totalEmendas, formatBrl(totalEmendas), 'PARLAMENTARES'),
    ],
  }
}

// -- Rankings (fictional placeholder data) -----------------------------------

export function buildRankingsDataset(regions: PowerRegion[]): TabularDataset {
  const columns: DatasetColumn[] = [
    { key: 'regionId', label: 'REGIÃO', numeric: false, format: 'text' },
    { key: 'name', label: 'ENTIDADE', numeric: false, format: 'text' },
    { key: 'dimension', label: 'DIMENSÃO', numeric: false, format: 'text' },
    { key: 'kind', label: 'TIPO', numeric: false, format: 'text' },
    { key: 'score', label: 'ÍNDICE', numeric: true, format: 'int' },
    { key: 'delta', label: 'Δ', numeric: true, format: 'decimal' },
    { key: 'confidence', label: 'CONFIANÇA', numeric: false, format: 'text' },
    { key: 'status', label: 'STATUS', numeric: false, format: 'text' },
  ]
  const rows: Record<string, CellValue>[] = []
  for (const region of regions) {
    for (const entity of [...region.official, ...region.hidden]) {
      rows.push({
        regionId: region.id,
        name: entity.name,
        dimension: entity.dimension,
        kind: entity.kind,
        score: entity.score,
        delta: entity.delta,
        confidence: entity.confidence,
        status: entity.status,
      })
    }
  }
  return {
    id: 'rankings',
    label: 'RANKINGS (FICTÍCIO)',
    description: 'Entidades de influência simuladas. Dados fictícios, não factuais.',
    source: 'DADOS SIMULADOS · PROTÓTIPO',
    fictional: true,
    columns,
    rows,
    kpis: [
      kpi('ENTIDADES', rows.length, formatInt(rows.length)),
      kpi('REGIÕES', regions.length, formatInt(regions.length)),
      kpi(
        'EM REVISÃO',
        rows.filter((r) => r.status === 'draft').length,
        formatInt(rows.filter((r) => r.status === 'draft').length),
        'DRAFT',
      ),
    ],
  }
}

export { coverage, sumColumn }
