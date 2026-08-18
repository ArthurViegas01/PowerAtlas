import { describe, expect, it } from 'vitest'

import {
  buildAnalysisCsv,
  buildEntityRows,
  buildIndicatorRows,
  exportFileName,
  type RegionExportInput,
} from '@/lib/exportAnalysis'
import type { PowerRegion } from '@/types/power-entity'

const sp: RegionExportInput = {
  id: 'SP',
  name: 'São Paulo',
  indicators: { population: 44_411_238, areaKm2: 248_219, density: 178.9, gdpBrlThousands: 3_400_000_000 },
  region: {
    id: 'SP',
    name: 'São Paulo',
    kind: 'state',
    capital: { name: 'São Paulo', coordinates: [-46.6, -23.5] },
    updatedAt: '2026-01-01',
    official: [
      {
        id: 'sp-1',
        name: 'Chefia do Executivo Estadual',
        kind: 'institution',
        dimension: 'official',
        score: 72,
        delta: 1,
        confidence: 'high',
        status: 'published',
        sources: [],
      },
    ],
    hidden: [],
  } as unknown as PowerRegion,
}

const semDados: RegionExportInput = { id: 'AC', name: 'Acre', indicators: null, region: null }

describe('export da analise (PROD-6)', () => {
  it('monta uma linha de indicadores por regiao, com proveniencia REAL', () => {
    const rows = buildIndicatorRows([sp, semDados])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ regiao: 'SP', populacao: 44_411_238, proveniencia: 'REAL · IBGE' })
    expect(rows[1]).toMatchObject({ regiao: 'AC', populacao: null })
  })

  it('monta uma linha por entidade oficial, com proveniencia SIMULADO', () => {
    const rows = buildEntityRows([sp, semDados])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      regiao: 'SP',
      entidade: 'Chefia do Executivo Estadual',
      score: 72,
      proveniencia: 'SIMULADO',
    })
  })

  it('csv sai com os dois blocos separados por linha em branco', () => {
    const csv = buildAnalysisCsv([sp])
    expect(csv).toContain('regiao,nome,populacao')
    expect(csv).toContain('regiao,entidade,tipo')
    expect(csv.split('\r\n\r\n')).toHaveLength(2)
  })

  it('nome de arquivo slugado com a data', () => {
    const now = new Date('2026-08-18T12:00:00Z')
    expect(exportFileName('São Paulo · comparação', 'csv', now)).toBe(
      'poweratlas-sao-paulo-comparacao-2026-08-18.csv',
    )
    expect(exportFileName('///', 'json', now)).toBe('poweratlas-analise-2026-08-18.json')
  })
})
