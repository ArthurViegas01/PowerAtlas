import { describe, expect, it } from 'vitest'

import { parseCsvDataset, toCsv } from './csv'

describe('toCsv', () => {
  it('quotes fields with commas, quotes and newlines', () => {
    const cols = [
      { key: 'a', label: 'A', numeric: true, format: 'int' as const },
      { key: 'b', label: 'B', numeric: false, format: 'text' as const },
    ]
    const csv = toCsv(cols, [
      { a: 1, b: 'x,y' },
      { a: null, b: 'quote"q' },
    ])
    expect(csv).toBe('a,b\r\n1,"x,y"\r\n,"quote""q"')
  })
})

describe('parseCsvDataset', () => {
  it('infers numeric columns and coerces values', () => {
    const { columns, rows } = parseCsvDataset('cidade,pop,area\nAlfa,100,1.5\nBeta,200,2.0')
    expect(columns.map((c) => [c.key, c.numeric, c.format])).toEqual([
      ['cidade', false, 'text'],
      ['pop', true, 'int'],
      ['area', true, 'decimal'],
    ])
    expect(rows[0]).toEqual({ cidade: 'Alfa', pop: 100, area: 1.5 })
  })

  it('treats empty numeric cells as null and honors quoted commas', () => {
    const { columns, rows } = parseCsvDataset('nome,valor\n"Santos, SP",10\nVazio,')
    expect(columns[0].numeric).toBe(false)
    expect(rows[0]).toEqual({ nome: 'Santos, SP', valor: 10 })
    expect(rows[1]).toEqual({ nome: 'Vazio', valor: null })
  })

  it('round-trips through toCsv', () => {
    const parsed = parseCsvDataset('a,b\n1,x\n2,y')
    const csv = toCsv(parsed.columns, parsed.rows)
    expect(parseCsvDataset(csv).rows).toEqual(parsed.rows)
  })
})
