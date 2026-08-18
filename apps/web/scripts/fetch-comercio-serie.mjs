#!/usr/bin/env node
/**
 * Annual foreign-trade SERIES per partner country (PROD-4 timeline pilot):
 * total exports/imports (US$ FOB) per ISO per year, NO sector split. Sibling
 * of fetch-comercio.mjs on purpose: the timeline only needs totals, so this
 * stays a lean streaming sum over the same cached raw base (the full builder
 * keeps owning the sector-detailed reference year).
 *
 * Output: public/data/comercio/serie.json
 *   { source, currency: 'USD', years: [y0..yN],
 *     partners: [[iso, [expY0..expYN], [impY0..impYN]], ...] }
 *
 * Usage: node scripts/fetch-comercio-serie.mjs [--from 2021] [--to 2025]
 * Downloads cache in scripts/.cache-comercio (shared with fetch-comercio).
 */
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Same rationale as fetch-comercio.mjs: build-time downloader for public
// open data behind an incomplete certificate chain; never ships to the app.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CACHE = path.join(ROOT, 'scripts', '.cache-comercio')
const OUT = path.join(ROOT, 'public', 'data', 'comercio', 'serie.json')
const BASE = 'https://balanca.economia.gov.br/balanca/bd'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? Number(process.argv[i + 1]) : fallback
}
const FROM = arg('--from', 2021)
const TO = arg('--to', 2025)

async function download(url, file) {
  await mkdir(CACHE, { recursive: true })
  const target = path.join(CACHE, file)
  const exists = await stat(target).then((s) => s.size > 0, () => false)
  if (exists) {
    console.log(`[serie] cache hit: ${file}`)
    return target
  }
  console.log(`[serie] GET ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText} (${url})`)
  const { writeFile: wf } = await import('node:fs/promises')
  const buffer = Buffer.from(await res.arrayBuffer())
  await wf(target, buffer)
  console.log(`[serie] salvo ${file} (${Math.round(buffer.length / 1048576)} MB)`)
  return target
}

/** Stream one NCM csv summing VL_FOB (last column) per CO_PAIS (5th column). */
async function sumByCountry(file) {
  const totals = new Map()
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let first = true
  for await (const line of rl) {
    if (first) {
      first = false
      continue
    }
    const cols = line.split(';')
    if (cols.length < 11) continue
    const pais = cols[4].replaceAll('"', '')
    const fob = Number(cols[10].replaceAll('"', ''))
    if (!Number.isFinite(fob)) continue
    totals.set(pais, (totals.get(pais) ?? 0) + fob)
  }
  return totals
}

/** CO_PAIS -> ISO alpha-3 from the cached correlation table. */
async function paisToIso() {
  const file = await download(`${BASE}/tabelas/PAIS.csv`, 'PAIS.csv')
  const text = await readFile(file, 'latin1')
  const map = new Map()
  const lines = text.split(/\r?\n/)
  const header = lines[0].split(';').map((c) => c.replaceAll('"', ''))
  const iPais = header.indexOf('CO_PAIS')
  const iIso = header.indexOf('CO_PAIS_ISOA3')
  if (iPais < 0 || iIso < 0) throw new Error('PAIS.csv sem CO_PAIS/CO_PAIS_ISOA3')
  for (const line of lines.slice(1)) {
    const cols = line.split(';').map((c) => c.replaceAll('"', ''))
    const iso = cols[iIso]
    if (cols[iPais] && iso && iso.length === 3) map.set(cols[iPais], iso)
  }
  return map
}

const iso = await paisToIso()
const years = []
for (let y = FROM; y <= TO; y++) years.push(y)

/** iso -> number[] aligned with `years` (missing years stay 0). */
const exp = new Map()
const imp = new Map()
const put = (store, isoCode, yearIndex, value) => {
  const row = store.get(isoCode) ?? new Array(years.length).fill(0)
  row[yearIndex] += value
  store.set(isoCode, row)
}

for (const [index, year] of years.entries()) {
  const expFile = await download(`${BASE}/comexstat-bd/ncm/EXP_${year}.csv`, `EXP_${year}.csv`)
  const impFile = await download(`${BASE}/comexstat-bd/ncm/IMP_${year}.csv`, `IMP_${year}.csv`)
  console.log(`[serie] somando ${year}...`)
  const [expTotals, impTotals] = [await sumByCountry(expFile), await sumByCountry(impFile)]
  for (const [pais, value] of expTotals) {
    const code = iso.get(pais)
    if (code) put(exp, code, index, Math.round(value))
  }
  for (const [pais, value] of impTotals) {
    const code = iso.get(pais)
    if (code) put(imp, code, index, Math.round(value))
  }
  const bi = (v) => (v / 1e9).toFixed(1)
  const expSum = [...expTotals.values()].reduce((a, b) => a + b, 0)
  const impSum = [...impTotals.values()].reduce((a, b) => a + b, 0)
  console.log(`[serie] ${year}: exp US$ ${bi(expSum)} bi · imp US$ ${bi(impSum)} bi`)
}

const isos = [...new Set([...exp.keys(), ...imp.keys()])].sort()
const partners = isos
  .map((code) => [
    code,
    exp.get(code) ?? new Array(years.length).fill(0),
    imp.get(code) ?? new Array(years.length).fill(0),
  ])
  .filter(([, e, i]) => e.some((v) => v > 0) || i.some((v) => v > 0))

const out = {
  source: 'Comex Stat / MDIC · Base de dados bruta (NCM)',
  currency: 'USD',
  years,
  partners,
}
await writeFile(OUT, JSON.stringify(out))
console.log(`[serie] escrito ${OUT} (${Math.round(JSON.stringify(out).length / 1024)} KB, ${partners.length} parceiros, ${years.length} anos)`)
