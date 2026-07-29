#!/usr/bin/env node
/**
 * Fetch the IBGE intramunicipal meshes (Censo 2022) plus the census
 * aggregates published at those levels, and produce one file per município:
 *
 *   public/geo/subdivisoes/{codigo}.geojson  (props {codigo, name, population,
 *                                             households, areaKm2, density})
 *   public/geo/subdivisoes/index.json        ({censusYear, municipios:
 *                                             {codigo: {count, level}}})
 *
 * Two levels, in order of preference per município:
 *
 *   1. **bairro** — the finer cut, but IBGE only draws it for 895 of the
 *      5.570 municípios.
 *   2. **distrito** — the fallback where no bairros exist. Every município
 *      has at least one distrito, but in 3.332 of them that single distrito
 *      IS the município: an identical polygon, nothing to drill into. So the
 *      fallback only covers municípios with 2 or more distritos.
 *
 * Municípios left with neither keep the drill-down stopping at the município,
 * and the UI says so. The index carries the level per município because
 * bairro and distrito are different divisions and the panel must not pass one
 * off as the other.
 *
 * Neither level is served by the malhas v3 API (asking a município for
 * `intrarregiao` answers HTTP 400), so both come from geoftp shapefiles,
 * which mapshaper reads straight out of their zips.
 *
 * Run via `pnpm subdivisoes` (repo root) so mapshaper (a devDependency) is on
 * PATH. `--pilot` limits the output to the 27 capitals. `--level=bairro` or
 * `--level=distrito` rebuilds just one level (both by default). Raw downloads
 * are cached in scripts/.cache (gitignored); the distrito mesh alone is
 * 226 MB, so the cache is worth keeping. Provenance: docs/data-sources.md.
 */
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const OUT = join(HERE, '..', 'public', 'geo', 'subdivisoes')

const CENSUS_YEAR = 2022

const GEOFTP =
  'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/' +
  'malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022'
const CENSO_FTP =
  'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios'

/**
 * Per level: where the mesh and the aggregates live, which fields carry the
 * code and the name, and how hard to simplify. Distritos tile the whole
 * município (rural area included), so they take the same 20% as the bairros
 * without turning to mush.
 */
const LEVELS = {
  bairro: {
    meshUrl: `${GEOFTP}/bairros/shp/BR/BR_bairros_CD2022.zip`,
    meshFile: 'ibge-bairros-raw.zip',
    aggregatesUrl: `${CENSO_FTP}/Agregados_por_Bairro_csv/Agregados_por_bairros_basico_BR_20260520.zip`,
    aggregatesFile: 'ibge-bairros-basico.zip',
    aggregatesCsv: 'Agregados_por_bairros_basico_BR.csv',
    codeField: 'CD_BAIRRO',
    nameField: 'NM_BAIRRO',
    simplify: '20%',
  },
  distrito: {
    meshUrl: `${GEOFTP}/distritos/shp/BR/BR_distritos_CD2022.zip`,
    meshFile: 'ibge-distritos-raw.zip',
    aggregatesUrl: `${CENSO_FTP}/Agregados_por_Distrito_csv/Agregados_por_distritos_basico_BR_20260520.zip`,
    aggregatesFile: 'ibge-distritos-basico.zip',
    aggregatesCsv: 'Agregados_por_distritos_basico_BR.csv',
    codeField: 'CD_DIST',
    nameField: 'NM_DIST',
    simplify: '20%',
  },
}

const BUDGET_KB = 400

/** The 27 capitals — `--pilot` ships only these. */
const CAPITAIS = [
  '1100205', '1200401', '1302603', '1400100', '1501402', '1600303', '1721000',
  '2111300', '2211001', '2304400', '2408102', '2507507', '2611606', '2704302',
  '2800308', '2927408', '3106200', '3205309', '3304557', '3550308', '4106902',
  '4205407', '4314902', '5002704', '5103403', '5208707', '5300108',
]

const PILOT = process.argv.includes('--pilot')
const ONLY = process.argv.find((arg) => arg.startsWith('--level='))?.split('=')[1] ?? null
if (ONLY && !(ONLY in LEVELS)) throw new Error(`--level inválido: ${ONLY}`)

const kb = (file) => Math.round(statSync(file).size / 1024)

async function download(url, file) {
  const target = join(CACHE, file)
  try {
    statSync(target)
    console.log(`[subdiv] cache hit ${file} (${kb(target)} KB)`)
    return target
  } catch {
    /* not cached yet */
  }
  console.log(`[subdiv] GET ${url}`)
  const res = await fetch(url, { headers: { accept: '*/*' } })
  if (!res.ok) throw new Error(`IBGE request failed: ${res.status} ${res.statusText} (${url})`)
  writeFileSync(target, Buffer.from(await res.arrayBuffer()))
  console.log(`[subdiv] saved ${file} (${kb(target)} KB)`)
  return target
}

/** "4,1082002" -> 4.1082002; "" and "." (IBGE's suppressed marker) -> null. */
function parseNumber(raw) {
  if (raw == null) return null
  const text = String(raw).trim().replace(/^"|"$/g, '')
  if (!text || text === '.') return null
  const value = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text)
  return Number.isFinite(value) ? value : null
}

const unquote = (raw) => String(raw ?? '').trim().replace(/^"|"$/g, '')

/**
 * Census aggregates keyed by the subdivision code (the same key the mesh
 * carries), plus how many subdivisions each município has. Latin-1 like the
 * other IBGE CSV downloads, ';'-separated, comma decimals. v0001 is the
 * resident population: summing it over one município's bairros reproduces
 * that município's Censo 2022 total exactly.
 */
function readAggregates(file, codeField) {
  const lines = readFileSync(file, 'latin1').split(/\r?\n/)
  const header = lines[0].split(';').map(unquote)
  const at = (name) => {
    const index = header.indexOf(name)
    if (index === -1) throw new Error(`Coluna "${name}" ausente em ${file}`)
    return index
  }
  const iCode = at(codeField)
  const iMun = at('CD_MUN')
  const iArea = at('AREA_KM2')
  const iPopulation = at('v0001')
  const iHouseholds = at('v0002')

  const byCode = new Map()
  const countByMunicipio = new Map()
  for (const line of lines.slice(1)) {
    if (!line) continue
    const cols = line.split(';')
    const code = unquote(cols[iCode])
    if (!code) continue
    byCode.set(code, {
      population: parseNumber(cols[iPopulation]),
      households: parseNumber(cols[iHouseholds]),
      areaKm2: parseNumber(cols[iArea]),
    })
    const municipio = unquote(cols[iMun])
    countByMunicipio.set(municipio, (countByMunicipio.get(municipio) ?? 0) + 1)
  }
  return { byCode, countByMunicipio }
}

function mapshaper(args) {
  console.log(`[subdiv] mapshaper ${args.slice(0, 160)}${args.length > 160 ? '…' : ''}`)
  execSync(`mapshaper ${args}`, { stdio: 'inherit' })
}

/**
 * Split one level's mesh into per-município files under `tmp`, keeping only
 * the municípios in `wanted`. The filter goes through a joined CSV rather
 * than an inline expression: the distrito list runs to thousands of codes,
 * well past the command-line length limit.
 */
function splitMesh(level, config, meshZip, wanted, tmp) {
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const keepCsv = join(CACHE, `keep-${level}.csv`)
  writeFileSync(keepCsv, `CD_MUN,keep\n${[...wanted].map((code) => `${code},1`).join('\n')}\n`)
  mapshaper(
    `"${meshZip}" -filter "${config.codeField} != ''" ` +
      `-join "${keepCsv}" keys=CD_MUN,CD_MUN string-fields=CD_MUN,keep ` +
      `-filter "keep == '1'" ` +
      `-filter-fields CD_MUN,${config.codeField},${config.nameField} ` +
      `-simplify ${config.simplify} keep-shapes -clean -split CD_MUN ` +
      `-o precision=0.00001 format=geojson "${tmp}"`,
  )
}

/** Rewrite one split file's properties with the census join and save it. */
function writeMunicipio(tmpFile, codigo, config, aggregates) {
  const fc = JSON.parse(readFileSync(tmpFile, 'utf8'))
  let missing = 0
  for (const feature of fc.features) {
    const code = String(feature.properties?.[config.codeField] ?? '')
    const data = aggregates.byCode.get(code)
    if (!data) missing += 1
    const population = data?.population ?? null
    const areaKm2 = data?.areaKm2 ?? null
    feature.properties = {
      codigo: code,
      name: String(feature.properties?.[config.nameField] ?? ''),
      population,
      households: data?.households ?? null,
      areaKm2: areaKm2 == null ? null : Number(areaKm2.toFixed(4)),
      density: population == null || !areaKm2 ? null : Number((population / areaKm2).toFixed(1)),
    }
  }
  const outFile = join(OUT, `${codigo}.geojson`)
  writeFileSync(outFile, JSON.stringify(fc))
  return { count: fc.features.length, size: kb(outFile), missing }
}

mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

const index = {}
const stats = {}
let biggest = { codigo: null, size: 0, level: null }
let missingAggregates = 0
let totalKb = 0

// Bairros first: where both exist, the finer cut wins and the distrito mesh
// never gets built for that município.
for (const level of ONLY ? [ONLY] : ['bairro', 'distrito']) {
  const config = LEVELS[level]
  const meshZip = await download(config.meshUrl, config.meshFile)
  const aggregatesZip = await download(config.aggregatesUrl, config.aggregatesFile)

  // bsdtar ships with Windows 10+ and handles zip extraction (same call the
  // fiscal pipeline makes). The meshes need no extraction: mapshaper reads
  // the shapefile straight out of its zip.
  const csvPath = join(CACHE, config.aggregatesCsv)
  try {
    statSync(csvPath)
  } catch {
    execFileSync('tar', ['-xf', aggregatesZip, '-C', CACHE, config.aggregatesCsv])
  }
  const aggregates = readAggregates(csvPath, config.codeField)

  // A distrito division is only worth drilling into when there are 2+ of
  // them; a lone distrito is the município's own outline redrawn.
  const minimum = level === 'distrito' ? 2 : 1
  let wanted = [...aggregates.countByMunicipio]
    .filter(([codigo, count]) => count >= minimum && !(codigo in index))
    .map(([codigo]) => codigo)
  if (PILOT) wanted = wanted.filter((codigo) => CAPITAIS.includes(codigo))
  console.log(`[subdiv] ${level}: ${wanted.length} municípios a gerar`)
  if (wanted.length === 0) continue

  const tmp = join(CACHE, `subdiv-split-${level}`)
  splitMesh(level, config, meshZip, new Set(wanted), tmp)

  let built = 0
  for (const file of readdirSync(tmp).sort()) {
    if (!file.endsWith('.json')) continue
    const codigo = file.replace(/\.json$/, '')
    const result = writeMunicipio(join(tmp, file), codigo, config, aggregates)
    index[codigo] = { count: result.count, level }
    missingAggregates += result.missing
    totalKb += result.size
    built += 1
    if (result.size > biggest.size) biggest = { codigo, size: result.size, level }
  }
  stats[level] = built
}

writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify({ censusYear: CENSUS_YEAR, municipios: index }),
)

const totalMunicipios = Object.keys(index).length
const totalUnits = Object.values(index).reduce((sum, entry) => sum + entry.count, 0)
console.log(
  `[subdiv] ${totalUnits} subdivisões em ${totalMunicipios} municípios ` +
    `(${Object.entries(stats).map(([level, n]) => `${n} por ${level}`).join(', ')}) -> ` +
    `${OUT} (${(totalKb / 1024).toFixed(1)} MB, maior ${biggest.codigo} com ${biggest.size} KB)` +
    (missingAggregates ? ` · ${missingAggregates} sem agregados (N/D)` : ''),
)
if (biggest.size > BUDGET_KB) {
  console.log(`[subdiv] << ACIMA DO ORÇAMENTO (${BUDGET_KB} KB) — baixe simplify`)
}
if (PILOT) console.log('[subdiv] piloto: apenas as capitais. Rode sem --pilot para o país todo.')
