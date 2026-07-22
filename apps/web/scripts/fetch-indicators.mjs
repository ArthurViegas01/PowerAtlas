#!/usr/bin/env node
/**
 * Fetch real public indicators from the IBGE Agregados API (v3) and write the
 * static JSON files the app serves:
 *
 *   public/data/indicators/uf.json               BR + 27 UFs, keyed by sigla
 *   public/data/indicators/municipios/{UF}.json  one per UF, keyed by 7-digit
 *                                                IBGE municipality code
 *
 * Indicators (factual, straight from IBGE):
 *   population       Censo 2022               agregado 4714, variavel 93 (pessoas)
 *   areaKm2          Censo 2022               agregado 4714, variavel 6318 (km2)
 *   density          Censo 2022               agregado 4714, variavel 614 (hab/km2)
 *   gdpBrlThousands  PIB dos Municipios 2023  agregado 5938, variavel 37 (mil R$)
 *
 * This dataset is context only: it feeds panels/tooltips and never the power
 * rankings (those stay fictional until the F5/F6 pipeline + review workflow,
 * ARCHITECTURE.md section 5). Provenance: docs/data-sources.md. Run via
 * `pnpm indicators` (repo root).
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { UF_BY_CODE } from './uf-codes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'data', 'indicators')

const BASE = 'https://servicodados.ibge.gov.br/api/v3/agregados'
const CENSUS_YEAR = 2022
const GDP_YEAR = 2023
const CENSUS = {
  agregado: 4714,
  periodo: String(CENSUS_YEAR),
  vars: { 93: 'population', 6318: 'areaKm2', 614: 'density' },
}
const GDP = { agregado: 5938, periodo: String(GDP_YEAR), vars: { 37: 'gdpBrlThousands' } }

const specUrl = ({ agregado, periodo, vars }, localidades) =>
  `${BASE}/${agregado}/periodos/${periodo}/variaveis/${Object.keys(vars).join('|')}` +
  `?localidades=${localidades}`

async function fetchJson(url) {
  console.log(`[ind] GET ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IBGE request failed: ${res.status} ${res.statusText} (${url})`)
  return res.json()
}

/** '1581196' -> 1581196; '23,86'/'23.86' -> 23.86; '...', '-', 'X' -> null. */
function parseValue(raw) {
  if (raw == null) return null
  const num = Number(String(raw).replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

/**
 * Flatten one agregados response into `into`, a Map keyed by IBGE locality id
 * ('1' = Brasil, 2 digits = UF, 7 digits = municipality) whose values collect
 * the indicator fields of that locality.
 */
function collect(payload, spec, into) {
  for (const variable of payload) {
    const field = spec.vars[String(variable.id)]
    if (!field) continue
    const resultados = variable.resultados ?? []
    if (resultados.length !== 1) {
      throw new Error(`Variable ${variable.id}: expected 1 resultado, got ${resultados.length}`)
    }
    for (const series of resultados[0].series) {
      const id = String(series.localidade.id)
      const target = into.get(id) ?? {}
      target[field] = parseValue(series.serie[spec.periodo])
      into.set(id, target)
    }
  }
}

const byLocality = new Map()
for (const spec of [CENSUS, GDP]) {
  collect(await fetchJson(specUrl(spec, 'N1[all]|N3[all]')), spec, byLocality)
  collect(await fetchJson(specUrl(spec, 'N6[all]')), spec, byLocality)
}

// ---- uf.json: BR + 27 UFs, keyed by sigla (the region.id join key)
const regions = {}
const br = byLocality.get('1')
if (!br) throw new Error('Missing Brasil (N1) in the IBGE payload')
regions.BR = br
for (const [code, [sigla]] of Object.entries(UF_BY_CODE)) {
  const entry = byLocality.get(String(code))
  if (!entry) throw new Error(`Missing UF ${sigla} (${code}) in the IBGE payload`)
  regions[sigla] = entry
}
// Parse sanity: Censo 2022 counted ~203 million people.
if (!(regions.BR.population > 150e6 && regions.BR.population < 250e6)) {
  throw new Error(`BR population looks wrong: ${regions.BR.population}`)
}

// ---- municipios/{UF}.json: keyed by 7-digit code (UF = first 2 digits)
const municipiosByUf = new Map()
let munTotal = 0
for (const [id, entry] of byLocality) {
  if (id.length !== 7) continue
  const sigla = UF_BY_CODE[id.slice(0, 2)]?.[0]
  if (!sigla) throw new Error(`Municipality ${id} has an unknown UF prefix`)
  let bucket = municipiosByUf.get(sigla)
  if (!bucket) municipiosByUf.set(sigla, (bucket = {}))
  bucket[id] = entry
  munTotal += 1
}
if (munTotal < 5500) throw new Error(`Only ${munTotal} municipalities collected`)
if (municipiosByUf.size !== 27) throw new Error(`Expected 27 UFs, got ${municipiosByUf.size}`)

mkdirSync(join(OUT, 'municipios'), { recursive: true })
const meta = { censusYear: CENSUS_YEAR, gdpYear: GDP_YEAR }
const kb = (file) => Math.round(statSync(file).size / 1024)

const ufFile = join(OUT, 'uf.json')
writeFileSync(ufFile, JSON.stringify({ ...meta, regions }))
console.log(`[ind] ${ufFile}: ${Object.keys(regions).length} regions (${kb(ufFile)} KB)`)

for (const [sigla, municipios] of [...municipiosByUf].sort()) {
  const file = join(OUT, 'municipios', `${sigla}.json`)
  writeFileSync(file, JSON.stringify({ ...meta, municipios }))
  console.log(`[ind] ${file}: ${Object.keys(municipios).length} municipios (${kb(file)} KB)`)
}
console.log(`[ind] done: ${munTotal} municipalities across ${municipiosByUf.size} UFs.`)
