/**
 * Compile the browser payloads from the CSV warehouse (the reverse of
 * warehouse-build.mjs). Reads `data/warehouse/*.csv` + `meta.json` and writes
 * the compact JSON the web bundle consumes under `public/data/**`, in the exact
 * shape the stores parse today (positional tuples, nested trade sectors,
 * censusYear/gdpYear, ...).
 *
 * The warehouse is the CSV-first source of truth; this makes `public/data/**`
 * a reproducible build artifact of it. `--check` regenerates in memory and
 * diffs byte-for-byte against the committed files (proves the site payload is
 * untouched), exiting non-zero on any drift.
 *
 * Scope: the four served/analytical datasets (demografia, fiscal, indicators/uf,
 * comercio). The raw per-município IBGE fetch (public/data/indicators/
 * municipios/{UF}.json) and the geo meshes stay upstream inputs, not warehouse
 * outputs; the fictional rankings (src/data/mock) stay out by design.
 *
 * Run: `pnpm compile-web` (write) or `pnpm compile-web:check` (parity).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const webRoot = join(scriptsDir, '..')
const repoRoot = join(webRoot, '..', '..')
const DATA_DIR = join(webRoot, 'public', 'data')
const WH_DIR = join(repoRoot, 'data', 'warehouse')

const CHECK = process.argv.includes('--check')

// -- CSV parse (RFC 4180) ----------------------------------------------------

/** Parse CSV text into a matrix of string cells. */
function parseGrid(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c !== ''))
}

/** Read a warehouse CSV into an array of objects keyed by the header row. */
function readCsv(name) {
  const grid = parseGrid(readFileSync(join(WH_DIR, `${name}.csv`), 'utf8'))
  const header = grid[0]
  return grid.slice(1).map((cells) => {
    const obj = {}
    header.forEach((key, i) => {
      obj[key] = cells[i] ?? ''
    })
    return obj
  })
}

/** '' -> null, otherwise a JS number (integers and decimals round-trip). */
const num = (v) => (v === '' || v == null ? null : Number(v))

const meta = JSON.parse(readFileSync(join(WH_DIR, 'meta.json'), 'utf8'))

// -- Builders (must reproduce the committed JSON exactly) ---------------------

function buildDemografia() {
  const dim = readCsv('dim_municipio')
  const facts = new Map(readCsv('fato_demografia_municipio').map((r) => [r.codigo_ibge, r]))
  const municipios = dim.map((m) => {
    const f = facts.get(m.codigo_ibge)
    return [m.codigo_ibge, m.nome, num(m.lon), num(m.lat), num(f.populacao), num(f.pib_mil_brl)]
  })
  return JSON.stringify({
    censusYear: meta.demografia.censusYear,
    gdpYear: meta.demografia.gdpYear,
    municipios,
  })
}

function buildFiscal() {
  const municipios = readCsv('fato_fiscal_municipio').map((r) => [
    r.codigo_ibge,
    num(r.arrecadacao),
    num(r.previdencia),
    num(r.ir),
    num(r.ipi),
    num(r.transferencias),
    num(r.fpm),
    num(r.fundeb),
    num(r.emendas),
  ])
  return JSON.stringify({
    referenceYear: meta.fiscal.referenceYear,
    sources: meta.fiscal.sources,
    municipios,
  })
}

function buildIndicatorsUf() {
  const regions = {}
  for (const r of readCsv('fato_indicadores_uf')) {
    regions[r.regiao_id] = {
      population: num(r.populacao),
      density: num(r.densidade),
      areaKm2: num(r.area_km2),
      gdpBrlThousands: num(r.pib_mil_brl),
    }
  }
  return JSON.stringify({
    censusYear: meta.indicators.censusYear,
    gdpYear: meta.indicators.gdpYear,
    regions,
  })
}

// Console-only consolidated municipal indicators (all 5.570 in one lazy file):
// codigo + população + área + densidade + PIB. Not used by the map; the data
// console's "INDICADORES MUNICÍPIO" dataset loads it on demand.
function buildIndicadoresMunicipio() {
  const rows = readCsv('fato_demografia_municipio')
  const municipios = rows.map((r) => [
    r.codigo_ibge,
    num(r.populacao),
    num(r.area_km2),
    num(r.densidade),
    num(r.pib_mil_brl),
  ])
  return JSON.stringify({
    censusYear: num(rows[0]?.ano_censo),
    gdpYear: num(rows[0]?.ano_pib),
    municipios,
  })
}

// Warehouse schema for the console's CATÁLOGO view (published verbatim from the
// machine-readable catalog the warehouse build emits).
function buildCatalog() {
  return readFileSync(join(WH_DIR, 'catalog.json'), 'utf8')
}

function buildComercio() {
  const paisByIso = new Map(readCsv('dim_pais').map((r) => [r.iso, r]))
  const sectors = {}
  for (const r of readCsv('dim_setor_comercio')) sectors[r.capitulo_ncm] = r.descricao

  // Group the flattened sector rows back under each partner, order preserved.
  const sectorsByIso = new Map()
  for (const r of readCsv('fato_comercio_parceiro_setor')) {
    if (!sectorsByIso.has(r.iso)) sectorsByIso.set(r.iso, [])
    sectorsByIso.get(r.iso).push([r.capitulo_ncm, num(r.exp), num(r.imp)])
  }

  const partners = readCsv('fato_comercio_parceiro').map((r) => {
    const p = paisByIso.get(r.iso)
    return [r.iso, p.nome, num(p.lon), num(p.lat), num(r.exp), num(r.imp), sectorsByIso.get(r.iso) ?? []]
  })

  return JSON.stringify({
    referenceYear: meta.comercio.referenceYear,
    currency: meta.comercio.currency,
    source: meta.comercio.source,
    totals: meta.comercio.totals,
    sectors,
    partners,
  })
}

const targets = [
  // parity: the served payloads the map + console already consume; --check
  // asserts byte-identity so the site is provably untouched.
  { out: 'demografia/municipios.json', build: buildDemografia, parity: true },
  { out: 'fiscal/municipios.json', build: buildFiscal, parity: true },
  { out: 'indicators/uf.json', build: buildIndicatorsUf, parity: true },
  { out: 'comercio/mundo.json', build: buildComercio, parity: true },
  // console-only artifacts (compiled from the warehouse; regenerated, then
  // committed). No pre-existing baseline to be byte-identical against.
  { out: 'indicators/municipios-all.json', build: buildIndicadoresMunicipio, parity: false },
  { out: 'catalog.json', build: buildCatalog, parity: false },
]

// -- Run ---------------------------------------------------------------------

let drift = 0
for (const t of targets) {
  const path = join(DATA_DIR, t.out)
  const next = t.build()
  if (CHECK) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (current === next) {
      console.log(`  ok    ${t.out} (${next.length} bytes)`)
    } else if (current === null) {
      // Not yet generated; only a drift for the parity set.
      console.log(`  ${t.parity ? 'FALTA' : 'novo '} ${t.out} (rode compile-web)`)
      if (t.parity) drift++
    } else {
      if (t.parity) drift++
      let i = 0
      while (i < next.length && i < current.length && next[i] === current[i]) i++
      const label = t.parity ? 'DIFF ' : 'muda '
      console.log(
        `  ${label} ${t.out}: commitado ${current.length}b vs compilado ${next.length}b, ` +
          `1ª divergência no byte ${i}\n        commit: …${JSON.stringify(current.slice(i, i + 40))}` +
          `\n        compil: …${JSON.stringify(next.slice(i, i + 40))}`,
      )
    }
  } else {
    writeFileSync(path, next)
    console.log(`  wrote ${t.out} (${next.length} bytes)`)
  }
}

if (CHECK) {
  if (drift) {
    console.error(`\nparidade FALHOU: ${drift} payload(s) servido(s) divergem do warehouse`)
    process.exit(1)
  }
  console.log('\nparidade OK: os payloads servidos batem byte-a-byte com o warehouse')
} else {
  console.log(`\ncompile-web: ${targets.length} payloads gerados a partir do warehouse`)
}
