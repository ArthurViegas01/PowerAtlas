#!/usr/bin/env node
/**
 * Fetch the Brazil state mesh from the IBGE malhas API (v3) plus the Natural
 * Earth world countries backdrop, and produce the GeoJSON files the map
 * consumes:
 *
 *   public/geo/brazil-states.geojson    (27 UFs, `UF` property = join key)
 *   public/geo/brazil-national.geojson  (country outline, UF="BR")
 *   public/geo/world-countries.geojson  (NE 50m, minus Brazil/Antarctica, props
 *                                        {iso, name}; province-covered countries
 *                                        get their outline from world-states so
 *                                        the walls match the hover — "em breve")
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
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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

// Natural Earth 1:50m admin-0 countries (public domain) — dim world
// backdrop only; IBGE stays the authoritative source for Brazil itself.
// 50m (vs the coarser 110m) has far more vertices per country, so the
// backdrop borders read as smooth curves instead of angular line segments.
const WORLD_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
// 50m is much denser than 110m: simplify lightly to keep the file within
// budget while preserving the smooth outlines.
const WORLD_SIMPLIFY = '18%'

// Natural Earth 1:10m admin-1 states/provinces (public domain). The whole
// American continent gets its internal divisions drawn (minus Brazil, which
// the IBGE layers already own), plus a few other large countries, so the world
// backdrop reads as detailed as Brazil where it matters. 10m is used (not 50m)
// because the reduced 50m file omits several countries entirely, Argentina
// among them. Keyed by ADM0_A3; the value is the pt-BR country name. Heavy raw
// download, but filtered to this set and simplified hard before it ships.
const WORLD_STATES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'
const WORLD_STATES_COUNTRIES = {
  // Américas (Brasil fica de fora — malha IBGE própria).
  CAN: 'Canadá',
  USA: 'Estados Unidos',
  MEX: 'México',
  GTM: 'Guatemala',
  BLZ: 'Belize',
  HND: 'Honduras',
  SLV: 'El Salvador',
  NIC: 'Nicarágua',
  CRI: 'Costa Rica',
  PAN: 'Panamá',
  CUB: 'Cuba',
  DOM: 'República Dominicana',
  HTI: 'Haiti',
  JAM: 'Jamaica',
  TTO: 'Trinidad e Tobago',
  BHS: 'Bahamas',
  ARG: 'Argentina',
  BOL: 'Bolívia',
  CHL: 'Chile',
  COL: 'Colômbia',
  ECU: 'Equador',
  GUY: 'Guiana',
  PRY: 'Paraguai',
  PER: 'Peru',
  SUR: 'Suriname',
  URY: 'Uruguai',
  VEN: 'Venezuela',
  // Outros grandes países fora das Américas.
  CHN: 'China',
  AUS: 'Austrália',
  RUS: 'Rússia',
}

// keep-shapes prevents small polygons (islands) from collapsing entirely.
const SIMPLIFY = '30%'
// Kept low on purpose: reconcileWorldCountries dissolves these provinces into the
// province-covered countries' outlines, so this density also sets the size of
// world-countries. At this level world-states lands ~500 KB and the reconciled
// world-countries stays under its 400 KB budget. Raise it and check BOTH reports.
const WORLD_STATES_SIMPLIFY = '4%'
const BUDGET_KB = { national: 200, states: 500, world: 400, worldStates: 1800, municipios: 900 }

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

/**
 * Natural Earth ships French Guiana as one of France's (FRA) polygons. On this
 * map it borders Amapá, so a click on it would fly the camera to Europe. Pull
 * that South-American polygon into its own GUF feature ("Guiana Francesa") so it
 * reads and behaves as a território of its own.
 */
function splitFrenchGuiana(file) {
  const fc = JSON.parse(readFileSync(file, 'utf8'))
  const fra = fc.features.find((f) => f.properties.iso === 'FRA')
  if (!fra || fra.geometry.type !== 'MultiPolygon') return
  const isGuiana = (poly) => {
    const ring = poly[0]
    const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length
    const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length
    return cx < -40 && cx > -60 && cy > 0 && cy < 12
  }
  const guf = fra.geometry.coordinates.filter(isGuiana)
  if (guf.length === 0) return
  fra.geometry.coordinates = fra.geometry.coordinates.filter((p) => !isGuiana(p))
  const idx = fc.features.indexOf(fra)
  fc.features.splice(idx + 1, 0, {
    type: 'Feature',
    properties: { iso: 'GUF', name: 'Guiana Francesa' },
    geometry: { type: 'MultiPolygon', coordinates: guf },
  })
  writeFileSync(file, JSON.stringify(fc))
}

/**
 * Slim the Natural Earth admin-1 file to the handful of big countries we draw
 * internal divisions for, and strip properties to { iso, name, country, code }:
 * `iso` is the country's ADM0_A3 (join key to world-countries), `name` the
 * province name, `country` the pt-BR country label, `code` the ISO 3166-2 tag.
 */
function decorateWorldStates(file) {
  const fc = JSON.parse(readFileSync(file, 'utf8'))
  const kept = {}
  fc.features = fc.features.flatMap((feature) => {
    const props = feature.properties ?? {}
    const iso = props.adm0_a3 ?? props.ADM0_A3
    const country = WORLD_STATES_COUNTRIES[iso]
    if (!country) return []
    const name =
      props.name ?? props.name_en ?? props.gn_name ?? props.woe_name ?? props.iso_3166_2 ?? iso
    feature.properties = {
      iso,
      name,
      country,
      code: props.iso_3166_2 ?? props.code_hasc ?? '',
    }
    kept[iso] = (kept[iso] ?? 0) + 1
    return [feature]
  })
  const missing = Object.keys(WORLD_STATES_COUNTRIES).filter((iso) => !kept[iso])
  if (missing.length) throw new Error(`World-states: no provinces for ${missing.join(', ')}`)
  console.log(`[geo] world-states kept: ${JSON.stringify(kept)}`)
  writeFileSync(file, JSON.stringify(fc))
}

/**
 * Make each province-covered country's outline match its provinces exactly.
 * The world backdrop draws the country fill/wall from the NE 50m admin-0 mesh,
 * but the hover highlight of a province comes from the denser NE 10m admin-1
 * mesh (world-states). At different resolutions their coastlines disagree, so
 * the wall sits in one place while the hovered province shows another territory.
 * Fix: for every country in WORLD_STATES_COUNTRIES, replace its admin-0 polygon
 * with the dissolved union of its own provinces (the same 10m geometry the hover
 * uses), so the wall and the province outlines are one and the same. Countries
 * without provinces keep their 50m outline (nothing to disagree with there).
 */
function reconcileWorldCountries() {
  const outWorld = join(OUT, 'world-countries.geojson')
  const outWorldStates = join(OUT, 'world-states.geojson')
  const dissolved = join(CACHE, 'world-states-dissolved.geojson')
  // Union each country's provinces into a single outline (interior province
  // borders drop out), keyed by iso. Keep the province precision (0.0001) so the
  // dissolved coastline vertices are IDENTICAL to the province ones — the whole
  // point is that the wall and the province hover trace the same line.
  mapshaper(
    `"${outWorldStates}" -dissolve iso -o precision=0.0001 format=geojson "${dissolved}"`,
  )
  const byIso = new Map()
  for (const feature of JSON.parse(readFileSync(dissolved, 'utf8')).features) {
    const iso = feature.properties?.iso
    if (iso) byIso.set(iso, feature.geometry)
  }
  const world = JSON.parse(readFileSync(outWorld, 'utf8'))
  let replaced = 0
  for (const feature of world.features) {
    const geometry = byIso.get(feature.properties.iso)
    if (geometry) {
      feature.geometry = geometry
      replaced += 1
    }
  }
  writeFileSync(outWorld, JSON.stringify(world))
  console.log(`[geo] reconciled ${replaced} country outlines from their admin-1 provinces`)
  report(outWorld, BUDGET_KB.world)
}

async function buildWorldStates() {
  const rawWorldStates = join(CACHE, 'ne-admin1-raw.geojson')
  const outWorldStates = join(OUT, 'world-states.geojson')
  // The admin-1 raw is ~40 MB; reuse the cached copy when present (it never
  // changes between runs) so re-tuning the country set does not re-download it.
  if (existsSync(rawWorldStates) && kb(rawWorldStates) > 10_000) {
    console.log(`[geo] reusing cached ${rawWorldStates} (${kb(rawWorldStates)} KB)`)
  } else {
    await download(WORLD_STATES_URL, rawWorldStates)
  }
  // Filter to the target countries BEFORE simplifying, so mapshaper only chews
  // through this set's provinces instead of the whole planet's.
  const filtered = join(CACHE, 'ne-admin1-filtered.geojson')
  writeFileSync(filtered, readFileSync(rawWorldStates, 'utf8'))
  decorateWorldStates(filtered)
  // mapshaper preserves feature properties through -simplify, so the clean
  // {iso,name,country,code} shape survives to the output as-is.
  simplify(filtered, outWorldStates, WORLD_STATES_SIMPLIFY)
  report(outWorldStates, BUDGET_KB.worldStates)
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
// `--world-states-only` builds just public/geo/world-states.geojson (the big
// countries' admin-1 divisions), leaving every other output untouched.
const WORLD_STATES_ONLY = process.argv.includes('--world-states-only')
// `--reconcile-world` re-derives the province-covered countries' outlines from
// the already-shipped world-states.geojson (no download), so the walls match
// the province hover. Runs against the committed public/geo files.
const RECONCILE_WORLD = process.argv.includes('--reconcile-world')

if (RECONCILE_WORLD) {
  reconcileWorldCountries()
  console.log('[geo] done (reconcile-world only).')
  process.exit(0)
}

if (WORLD_STATES_ONLY) {
  await buildWorldStates()
  reconcileWorldCountries()
  console.log('[geo] done (world-states only).')
  process.exit(0)
}

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
  // 50m is dense: simplify lightly (keep-shapes so islands survive) and trim
  // coordinate precision (~1 km) to land under the size budget.
  mapshaper(
    `"${rawWorld}" -simplify ${WORLD_SIMPLIFY} keep-shapes -clean -o precision=0.01 format=geojson "${outWorld}"`,
  )
  decorateWorld(outWorld)
  splitFrenchGuiana(outWorld)

  report(outStates, BUDGET_KB.states)
  report(outNational, BUDGET_KB.national)
  report(outWorld, BUDGET_KB.world)

  await buildWorldStates()
  // The province-covered countries take their outline from their own provinces
  // so the backdrop walls line up with the province hover.
  reconcileWorldCountries()
}

const munOut = join(OUT, 'municipios')
mkdirSync(munOut, { recursive: true })
for (const entry of MUNICIPIOS) {
  await buildMunicipios(entry, munOut)
}

console.log('[geo] done.')
