#!/usr/bin/env node
/**
 * Fetch the Brazil state mesh from the IBGE malhas API (v3) and produce the
 * simplified GeoJSON files the map consumes:
 *
 *   public/geo/brazil-states.geojson    (27 UFs, `UF` property = join key)
 *   public/geo/brazil-national.geojson  (country outline, UF="BR")
 *
 * The national outline is NOT downloaded separately: it is dissolved from the
 * already-simplified state polygons so both files share exactly coincident
 * borders (no double-line artifacts where the layers overlap). `maxima` is
 * the source quality because the whole-country meshes this API serves are
 * small (states at maxima ~1 MB raw); simplification brings them under the
 * size budgets.
 *
 * Run via `pnpm geo` (repo root) or `pnpm run geo` in apps/web so that
 * mapshaper (a devDependency) is on PATH. Raw downloads are cached in
 * scripts/.cache (gitignored). Provenance: docs/data-sources.md.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const OUT = join(HERE, '..', 'public', 'geo')

const QUALIDADE = 'maxima'
const BASE = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR'
const STATES_URL = `${BASE}?formato=application/vnd.geo%2Bjson&qualidade=${QUALIDADE}&intrarregiao=UF`

// keep-shapes prevents small polygons (islands) from collapsing entirely.
const SIMPLIFY = '30%'
const BUDGET_KB = { national: 200, states: 500 }

// IBGE 2-digit UF geocode -> [sigla, name]
const UF_BY_CODE = {
  11: ['RO', 'Rondônia'],
  12: ['AC', 'Acre'],
  13: ['AM', 'Amazonas'],
  14: ['RR', 'Roraima'],
  15: ['PA', 'Pará'],
  16: ['AP', 'Amapá'],
  17: ['TO', 'Tocantins'],
  21: ['MA', 'Maranhão'],
  22: ['PI', 'Piauí'],
  23: ['CE', 'Ceará'],
  24: ['RN', 'Rio Grande do Norte'],
  25: ['PB', 'Paraíba'],
  26: ['PE', 'Pernambuco'],
  27: ['AL', 'Alagoas'],
  28: ['SE', 'Sergipe'],
  29: ['BA', 'Bahia'],
  31: ['MG', 'Minas Gerais'],
  32: ['ES', 'Espírito Santo'],
  33: ['RJ', 'Rio de Janeiro'],
  35: ['SP', 'São Paulo'],
  41: ['PR', 'Paraná'],
  42: ['SC', 'Santa Catarina'],
  43: ['RS', 'Rio Grande do Sul'],
  50: ['MS', 'Mato Grosso do Sul'],
  51: ['MT', 'Mato Grosso'],
  52: ['GO', 'Goiás'],
  53: ['DF', 'Distrito Federal'],
}

const kb = (file) => Math.round(statSync(file).size / 1024)

async function download(url, file) {
  console.log(`[geo] GET ${url}`)
  const res = await fetch(url, { headers: { accept: 'application/vnd.geo+json' } })
  if (!res.ok) throw new Error(`IBGE request failed: ${res.status} ${res.statusText} (${url})`)
  const text = await res.text()
  if (!text.trimStart().startsWith('{')) throw new Error(`Unexpected non-JSON response from ${url}`)
  writeFileSync(file, text)
  console.log(`[geo] saved raw ${file} (${kb(file)} KB)`)
}

function mapshaper(args) {
  const cmd = `mapshaper ${args}`
  console.log(`[geo] ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

function simplify(inFile, outFile) {
  mapshaper(`"${inFile}" -simplify ${SIMPLIFY} keep-shapes -clean -o precision=0.0001 format=geojson "${outFile}"`)
}

function dissolve(inFile, outFile) {
  // -each gives the dissolved feature attributes; without any, mapshaper
  // emits a bare GeometryCollection instead of a FeatureCollection.
  mapshaper(
    `"${inFile}" -dissolve -each "UF='BR',name='Brasil',codarea='BR'" -o precision=0.0001 format=geojson "${outFile}"`,
  )
}

/** Normalize state properties: `UF` is the join key to mock data `region.id`. */
function decorate(file) {
  const fc = JSON.parse(readFileSync(file, 'utf8'))
  for (const feature of fc.features) {
    const code = String(feature.properties?.codarea ?? '')
    const entry = UF_BY_CODE[code]
    if (!entry) throw new Error(`Unknown codarea "${code}" in ${file}`)
    feature.properties = { codarea: code, UF: entry[0], name: entry[1] }
  }
  writeFileSync(file, JSON.stringify(fc))
}

function report(file, budgetKb) {
  const size = kb(file)
  const flag = size > budgetKb ? `  << OVER BUDGET (${budgetKb} KB) — lower SIMPLIFY` : ''
  console.log(`[geo] ${file}: ${size} KB${flag}`)
}

mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

const rawStates = join(CACHE, 'ibge-states-raw.geojson')
const outNational = join(OUT, 'brazil-national.geojson')
const outStates = join(OUT, 'brazil-states.geojson')

await download(STATES_URL, rawStates)
simplify(rawStates, outStates)
dissolve(outStates, outNational)
decorate(outStates)
report(outStates, BUDGET_KB.states)
report(outNational, BUDGET_KB.national)
console.log('[geo] done.')
