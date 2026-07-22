#!/usr/bin/env node
/**
 * Fetch the Brazil state mesh from the IBGE malhas API (v3) plus the Natural
 * Earth world countries backdrop, and produce the GeoJSON files the map
 * consumes:
 *
 *   public/geo/brazil-states.geojson    (27 UFs, `UF` property = join key)
 *   public/geo/brazil-national.geojson  (country outline, UF="BR")
 *   public/geo/world-countries.geojson  (NE 110m, minus Brazil/Antarctica,
 *                                        props {iso, name} — "em breve" layer)
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

import { UF_BY_CODE } from './uf-codes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const OUT = join(HERE, '..', 'public', 'geo')

const QUALIDADE = 'maxima'
const BASE_MALHAS = 'https://servicodados.ibge.gov.br/api/v3/malhas'
const BASE = `${BASE_MALHAS}/paises/BR`
const STATES_URL = `${BASE}?formato=application/vnd.geo%2Bjson&qualidade=${QUALIDADE}&intrarregiao=UF`

// Per-state municipal meshes. Loaded on demand by the app when a state is
// selected, so each file lives on its own under public/geo/municipios/
// {UF}.geojson. Covers all 27 UFs (derived from UF_BY_CODE below). The malha
// carries only `codarea` (7-digit IBGE code); names come from the localidades
// API and are joined in by code.
const MUN_QUALIDADE = 'intermediaria'
const MUN_SIMPLIFY = '25%'
const municipioMalhaUrl = (code) =>
  `${BASE_MALHAS}/estados/${code}?formato=application/vnd.geo%2Bjson&qualidade=${MUN_QUALIDADE}&intrarregiao=municipio`
const municipioNamesUrl = (code) =>
  `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/municipios`

// Natural Earth 1:110m admin-0 countries (public domain) — dim world
// backdrop only; IBGE stays the authoritative source for Brazil itself.
const WORLD_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

// keep-shapes prevents small polygons (islands) from collapsing entirely.
const SIMPLIFY = '30%'
const BUDGET_KB = { national: 200, states: 500, world: 400, municipios: 900 }

// [sigla, code] for every UF: the municipal pipeline covers the whole country.
// (UF_BY_CODE lives in uf-codes.mjs, shared with fetch-indicators.mjs.)
const MUNICIPIOS = Object.entries(UF_BY_CODE).map(([code, [uf]]) => [uf, Number(code)])

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

function simplify(inFile, outFile, percent = SIMPLIFY) {
  mapshaper(`"${inFile}" -simplify ${percent} keep-shapes -clean -o precision=0.0001 format=geojson "${outFile}"`)
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

/**
 * Slim the Natural Earth file down to the "coming soon" backdrop: drop
 * Brazil (the IBGE layers own it) and Antarctica (visual clutter), and strip
 * properties to { iso, name } — name prefers the Portuguese localization.
 */
function decorateWorld(file) {
  const fc = JSON.parse(readFileSync(file, 'utf8'))
  fc.features = fc.features.flatMap((feature) => {
    const props = feature.properties ?? {}
    const iso = props.ADM0_A3 ?? props.adm0_a3
    if (!iso || iso === 'BRA' || iso === 'ATA') return []
    const name = props.NAME_PT ?? props.name_pt ?? props.NAME ?? props.ADMIN ?? iso
    feature.properties = { iso, name }
    return [feature]
  })
  if (fc.features.length < 100) {
    throw new Error(`World file looks wrong: only ${fc.features.length} countries kept`)
  }
  writeFileSync(file, JSON.stringify(fc))
}

/** Fetch + simplify one state's municipal mesh, joining in municipality names. */
async function buildMunicipios([uf, code], outDir) {
  const rawMalha = join(CACHE, `ibge-mun-${uf}-raw.geojson`)
  const outFile = join(outDir, `${uf}.geojson`)
  await download(municipioMalhaUrl(code), rawMalha)

  console.log(`[geo] GET municipality names for ${uf}`)
  const res = await fetch(municipioNamesUrl(code))
  if (!res.ok) throw new Error(`IBGE names failed: ${res.status} ${res.statusText} (${uf})`)
  const nameByCode = new Map(JSON.parse(await res.text()).map((m) => [String(m.id), m.nome]))

  simplify(rawMalha, outFile, MUN_SIMPLIFY)

  const fc = JSON.parse(readFileSync(outFile, 'utf8'))
  for (const feature of fc.features) {
    const codigo = String(feature.properties?.codarea ?? '')
    const name = nameByCode.get(codigo)
    if (!name) throw new Error(`No name for municipality "${codigo}" in ${uf}`)
    feature.properties = { codigo, name }
  }
  writeFileSync(outFile, JSON.stringify(fc))
  report(outFile, BUDGET_KB.municipios)
}

function report(file, budgetKb) {
  const size = kb(file)
  const flag = size > budgetKb ? `  << OVER BUDGET (${budgetKb} KB) — lower SIMPLIFY` : ''
  console.log(`[geo] ${file}: ${size} KB${flag}`)
}

mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

// `--municipios-only` skips the state/world rebuild: useful when only the
// municipal coverage changes, so the other outputs do not churn.
const MUNICIPIOS_ONLY = process.argv.includes('--municipios-only')

if (!MUNICIPIOS_ONLY) {
  const rawStates = join(CACHE, 'ibge-states-raw.geojson')
  const rawWorld = join(CACHE, 'ne-world-raw.geojson')
  const outNational = join(OUT, 'brazil-national.geojson')
  const outStates = join(OUT, 'brazil-states.geojson')
  const outWorld = join(OUT, 'world-countries.geojson')

  await download(STATES_URL, rawStates)
  simplify(rawStates, outStates)
  dissolve(outStates, outNational)
  decorate(outStates)

  await download(WORLD_URL, rawWorld)
  // 110m is already coarse — just trim coordinate precision (~1 km).
  mapshaper(`"${rawWorld}" -o precision=0.01 format=geojson "${outWorld}"`)
  decorateWorld(outWorld)

  report(outStates, BUDGET_KB.states)
  report(outNational, BUDGET_KB.national)
  report(outWorld, BUDGET_KB.world)
}

const munOut = join(OUT, 'municipios')
mkdirSync(munOut, { recursive: true })
for (const entry of MUNICIPIOS) {
  await buildMunicipios(entry, munOut)
}

console.log('[geo] done.')
