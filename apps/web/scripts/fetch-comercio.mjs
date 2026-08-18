/**
 * Foreign-trade dataset builder: real Brazilian exports/imports per partner
 * country and economic sector, powering the world trade arrows on the map.
 * Reference year 2025.
 *
 * Source (public, open data, no API key): Comex Stat / MDIC — "Base de dados
 * bruta". Two annual NCM-detailed files plus two correlation tables:
 *   ncm/EXP_{year}.csv, ncm/IMP_{year}.csv
 *     layout: CO_ANO;CO_MES;CO_NCM;CO_UNID;CO_PAIS;SG_UF_NCM;CO_VIA;CO_URF;
 *             QT_ESTAT;KG_LIQUIDO;VL_FOB   (';'-sep, latin1, VL_FOB in US$ FOB)
 *   tabelas/PAIS.csv     CO_PAIS -> CO_PAIS_ISOA3 (ISO alpha-3) + NO_PAIS
 *   tabelas/NCM_SH.csv   CO_SH6  -> CO_SH2 + NO_SH2_POR (HS chapter = sector)
 *
 * The sector of a product is its HS chapter (the first two digits of the NCM),
 * which the front then labels. Values are aggregated by partner (ISO) × sector.
 * Partners are joined to the world backdrop by ISO alpha-3 and anchored at the
 * country centroid; partners without a polygon in the 1:110m mesh are dropped
 * (logged) except a small manual-centroid override for notable ones.
 *
 * Output: public/data/comercio/mundo.json
 *   { referenceYear, currency: 'USD', source, totals: { exp, imp },
 *     sectors: { <chapter>: <label> },
 *     partners: [[iso, name, lon, lat, exp, imp,
 *                 [[chapter, exp, imp], ...]], ...] }
 * Values in whole US$ FOB. Downloads are cached in scripts/.cache-comercio.
 *
 * Usage: node scripts/fetch-comercio.mjs [--year 2025]
 */
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// balanca.economia.gov.br serves an incomplete certificate chain. This is a
// build-time downloader for public government open data, never shipped to the
// app, so relaxing verification here is safe and confined to this process.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CACHE = path.join(ROOT, 'scripts', '.cache-comercio')
const OUT = path.join(ROOT, 'public', 'data', 'comercio', 'mundo.json')
const OUT_UF = path.join(ROOT, 'public', 'data', 'comercio', 'uf.json')
const WORLD = path.join(ROOT, 'public', 'geo', 'world-countries.geojson')
const STATES = path.join(ROOT, 'public', 'geo', 'brazil-states.geojson')

const YEAR = Number(process.argv[process.argv.indexOf('--year') + 1]) || 2025

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const BASE = 'https://balanca.economia.gov.br/balanca/bd'

/** How many sectors to keep per partner before bucketing the rest into "Outros". */
const TOP_SECTORS = 12
const OUTROS = 'ZZ'

/**
 * UF vocation (uf.json): how many sectors to keep per state (its "vocação"), and
 * how many partner countries to keep per (UF, sector) so the world arrows can
 * land on the state that specializes in that sector instead of the map center.
 */
const TOP_UF_SECTORS = 10
const TOP_UF_PARTNERS = 6

// Friendly short labels for the HS chapters that dominate Brazilian trade. Any
// chapter not listed falls back to the official NO_SH2_POR from NCM_SH.csv.
const SECTOR_LABELS = {
  '12': 'Soja e oleaginosas',
  '26': 'Minérios (ferro etc.)',
  '27': 'Petróleo e combustíveis',
  '02': 'Carnes',
  '17': 'Açúcares',
  '09': 'Café, chá e mate',
  '47': 'Celulose e papel',
  '10': 'Cereais (milho etc.)',
  '23': 'Farelos e rações',
  '72': 'Ferro e aço',
  '84': 'Máquinas e equipamentos',
  '85': 'Máquinas elétricas',
  '87': 'Veículos',
  '88': 'Aeronaves',
  '15': 'Óleos e gorduras',
  '29': 'Químicos orgânicos',
  '31': 'Adubos e fertilizantes',
  '39': 'Plásticos',
  '52': 'Algodão',
  '44': 'Madeira',
  '71': 'Pedras e metais preciosos',
  '76': 'Alumínio',
  '30': 'Produtos farmacêuticos',
  '99': 'Operações especiais',
  [OUTROS]: 'Outros',
}

// Notable partners absent from the 1:110m world mesh (too small for a polygon),
// given a manual centroid so their arrow still lands somewhere sensible.
const MANUAL_CENTROIDS = {
  SGP: [103.82, 1.35], // Singapura
  HKG: [114.15, 22.28], // Hong Kong (folded into China in the mesh)
}

/** Strip surrounding quotes and trim a Comex CSV field. */
function clean(field) {
  const t = field.trim()
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}

async function download(url, file) {
  const target = path.join(CACHE, file)
  try {
    await stat(target)
    return target // cached
  } catch {
    /* not cached yet */
  }
  process.stdout.write(`  baixando ${file}...`)
  const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } })
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`)
  // Stream to disk so the 100+ MB annual files never sit fully in memory.
  const { createWriteStream } = await import('node:fs')
  await new Promise((resolve, reject) => {
    const out = createWriteStream(target)
    Readable.fromWeb(response.body).pipe(out).on('finish', resolve).on('error', reject)
  })
  const { size } = await stat(target)
  process.stdout.write(` ok (${(size / 1e6).toFixed(1)} MB)\n`)
  return target
}

/**
 * Approximate centroid: vertex average of the largest ring — the same anchor
 * technique as build-demografia.mjs. Precise enough to point an arrow at a
 * country at world zoom.
 */
function centroid(geometry) {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
  let ring = polygons[0][0]
  for (const polygon of polygons) if (polygon[0].length > ring.length) ring = polygon[0]
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x
    lat += y
  }
  const n = ring.length
  return [Number((lon / n).toFixed(3)), Number((lat / n).toFixed(3))]
}

/**
 * Stream one EXP/IMP file, summing VL_FOB into two cubes at once (one pass over
 * the ~100 MB file): the partner cube acc[iso][chapter][dir] and the UF-of-origin
 * cube ufAcc[uf][chapter] = { exp, imp, partners: iso -> { exp, imp } }.
 */
async function ingest(file, dir, paisIso, acc, ufAcc, ufSet, stats) {
  const reader = createInterface({
    input: createReadStream(file, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let header = true
  for await (const line of reader) {
    if (header) {
      header = false
      continue
    }
    if (!line) continue
    const cols = line.split(';')
    if (cols.length < 11) continue
    const ncm = clean(cols[2])
    const coPais = clean(cols[4])
    const vlFob = Number(clean(cols[10]))
    if (!Number.isFinite(vlFob) || vlFob <= 0) continue
    stats.total += vlFob
    const iso = paisIso.get(coPais)
    if (!iso) {
      stats.noIso += vlFob
      continue
    }
    const chapter = ncm.slice(0, 2)
    let byChapter = acc.get(iso)
    if (!byChapter) {
      byChapter = new Map()
      acc.set(iso, byChapter)
    }
    let cell = byChapter.get(chapter)
    if (!cell) {
      cell = { exp: 0, imp: 0 }
      byChapter.set(chapter, cell)
    }
    cell[dir] += vlFob

    // UF-of-origin cube. Only the 27 real siglas are kept: Comex also emits
    // ND/EX/RE/CB/MN/ZN etc. for trade with no declared state (re-export,
    // consumo de bordo, ...), which has no polygon to anchor an arrow on.
    const uf = clean(cols[5])
    if (ufSet.has(uf)) {
      let byChapterUf = ufAcc.get(uf)
      if (!byChapterUf) {
        byChapterUf = new Map()
        ufAcc.set(uf, byChapterUf)
      }
      let ufCell = byChapterUf.get(chapter)
      if (!ufCell) {
        ufCell = { exp: 0, imp: 0, partners: new Map() }
        byChapterUf.set(chapter, ufCell)
      }
      ufCell[dir] += vlFob
      let pcell = ufCell.partners.get(iso)
      if (!pcell) {
        pcell = { exp: 0, imp: 0 }
        ufCell.partners.set(iso, pcell)
      }
      pcell[dir] += vlFob
    }
  }
}

async function main() {
  await mkdir(CACHE, { recursive: true })
  await mkdir(path.dirname(OUT), { recursive: true })

  // --- correlation tables ---------------------------------------------------
  console.log('[1/4] tabelas de correlação (PAIS, NCM_SH)')
  const paisFile = await download(`${BASE}/tabelas/PAIS.csv`, 'PAIS.csv')
  const shFile = await download(`${BASE}/tabelas/NCM_SH.csv`, 'NCM_SH.csv')

  // CO_PAIS -> ISO alpha-3 (skip codes with no ISO, e.g. "ZZZ" não definido).
  const paisIso = new Map()
  const paisName = new Map()
  {
    const lines = (await readFile(paisFile)).toString('latin1').split(/\r?\n/)
    const head = lines[0].split(';').map(clean)
    const iCo = head.indexOf('CO_PAIS')
    const iIso = head.indexOf('CO_PAIS_ISOA3')
    const iNome = head.indexOf('NO_PAIS')
    for (const line of lines.slice(1)) {
      if (!line) continue
      const cols = line.split(';').map(clean)
      const iso = cols[iIso]
      if (!iso || iso === 'ZZZ' || iso.length !== 3) continue
      paisIso.set(cols[iCo], iso)
      paisName.set(iso, cols[iNome])
    }
  }

  // CO_SH2 -> NO_SH2_POR (official HS chapter name; deduped).
  const officialSector = new Map()
  {
    const lines = (await readFile(shFile)).toString('latin1').split(/\r?\n/)
    const head = lines[0].split(';').map(clean)
    const iSh2 = head.indexOf('CO_SH2')
    const iNome = head.indexOf('NO_SH2_POR')
    for (const line of lines.slice(1)) {
      if (!line) continue
      const cols = line.split(';').map(clean)
      const sh2 = cols[iSh2]
      if (sh2 && !officialSector.has(sh2)) officialSector.set(sh2, cols[iNome])
    }
  }
  console.log(`  países com ISO: ${paisIso.size} · capítulos SH2: ${officialSector.size}`)

  // --- world centroids ------------------------------------------------------
  const world = JSON.parse(await readFile(WORLD, 'utf8'))
  const centroids = new Map() // iso -> [lon, lat]
  const worldName = new Map() // iso -> Portuguese name (matches the map)
  for (const feature of world.features) {
    centroids.set(feature.properties.iso, centroid(feature.geometry))
    worldName.set(feature.properties.iso, feature.properties.name)
  }
  for (const [iso, coord] of Object.entries(MANUAL_CENTROIDS)) {
    if (!centroids.has(iso)) centroids.set(iso, coord)
  }

  // --- UF centroids (state vocation anchors) --------------------------------
  // The state mesh carries {codarea, UF, name}; the UF sigla is the join key to
  // SG_UF_NCM in the Comex files. Same largest-ring centroid as the countries.
  const states = JSON.parse(await readFile(STATES, 'utf8'))
  const ufCentroid = new Map() // UF sigla -> [lon, lat]
  const ufName = new Map()
  for (const feature of states.features) {
    ufCentroid.set(feature.properties.UF, centroid(feature.geometry))
    ufName.set(feature.properties.UF, feature.properties.name)
  }
  const ufSet = new Set(ufCentroid.keys())

  // --- ingest the annual files ---------------------------------------------
  console.log(`\n[2/4] exportações ${YEAR}`)
  const expFile = await download(`${BASE}/comexstat-bd/ncm/EXP_${YEAR}.csv`, `EXP_${YEAR}.csv`)
  const acc = new Map()
  const ufAcc = new Map()
  const expStats = { total: 0, noIso: 0 }
  await ingest(expFile, 'exp', paisIso, acc, ufAcc, ufSet, expStats)

  console.log(`\n[3/4] importações ${YEAR}`)
  const impFile = await download(`${BASE}/comexstat-bd/ncm/IMP_${YEAR}.csv`, `IMP_${YEAR}.csv`)
  const impStats = { total: 0, noIso: 0 }
  await ingest(impFile, 'imp', paisIso, acc, ufAcc, ufSet, impStats)

  // --- assemble partners ----------------------------------------------------
  console.log('\n[4/4] agregando parceiros × setores')
  const usedSectors = new Set()
  const partners = []
  let droppedNoCentroid = 0
  for (const [iso, byChapter] of acc) {
    const coord = centroids.get(iso)
    let expTotal = 0
    let impTotal = 0
    for (const cell of byChapter.values()) {
      expTotal += cell.exp
      impTotal += cell.imp
    }
    if (!coord) {
      droppedNoCentroid += expTotal + impTotal
      continue
    }
    // Rank chapters by combined flow; keep the top N, fold the rest into Outros.
    const ranked = [...byChapter.entries()].sort(
      (a, b) => b[1].exp + b[1].imp - (a[1].exp + a[1].imp),
    )
    const sectors = []
    let restExp = 0
    let restImp = 0
    ranked.forEach(([chapter, cell], i) => {
      if (i < TOP_SECTORS) {
        sectors.push([chapter, Math.round(cell.exp), Math.round(cell.imp)])
        usedSectors.add(chapter)
      } else {
        restExp += cell.exp
        restImp += cell.imp
      }
    })
    if (restExp + restImp > 0) {
      sectors.push([OUTROS, Math.round(restExp), Math.round(restImp)])
      usedSectors.add(OUTROS)
    }
    partners.push([
      iso,
      worldName.get(iso) ?? paisName.get(iso) ?? iso,
      coord[0],
      coord[1],
      Math.round(expTotal),
      Math.round(impTotal),
      sectors,
    ])
  }
  partners.sort((a, b) => b[4] + b[5] - (a[4] + a[5]))

  // --- assemble UF vocation -------------------------------------------------
  // For each state: its total flow, its top sectors (the "vocação"), and for
  // each of those sectors the partner countries that trade it the most. The
  // front reads this to (a) label the state's specialties, (b) point a partner's
  // sector arrow at the states that specialize in it, (c) place the 3D icon.
  const ufs = []
  for (const [uf, byChapter] of ufAcc) {
    const coord = ufCentroid.get(uf)
    if (!coord) continue
    let expTotal = 0
    let impTotal = 0
    for (const cell of byChapter.values()) {
      expTotal += cell.exp
      impTotal += cell.imp
    }
    const rankedUf = [...byChapter.entries()].sort(
      (a, b) => b[1].exp + b[1].imp - (a[1].exp + a[1].imp),
    )
    const sectorsUf = []
    for (const [chapter, cell] of rankedUf.slice(0, TOP_UF_SECTORS)) {
      usedSectors.add(chapter)
      const topPartners = [...cell.partners.entries()]
        .sort((a, b) => b[1].exp + b[1].imp - (a[1].exp + a[1].imp))
        .slice(0, TOP_UF_PARTNERS)
        .map(([iso, v]) => [iso, Math.round(v.exp), Math.round(v.imp)])
      sectorsUf.push([chapter, Math.round(cell.exp), Math.round(cell.imp), topPartners])
    }
    ufs.push([uf, coord[0], coord[1], Math.round(expTotal), Math.round(impTotal), sectorsUf])
  }
  ufs.sort((a, b) => b[3] + b[4] - (a[3] + a[4]))

  const sectors = {}
  for (const chapter of [...usedSectors].sort()) {
    sectors[chapter] = SECTOR_LABELS[chapter] ?? officialSector.get(chapter) ?? `Cap. ${chapter}`
  }

  const payload = {
    referenceYear: YEAR,
    currency: 'USD',
    source: 'Comex Stat / MDIC · Base de dados bruta (NCM)',
    totals: { exp: Math.round(expStats.total), imp: Math.round(impStats.total) },
    sectors,
    partners,
  }
  await writeFile(OUT, JSON.stringify(payload))

  const ufPayload = {
    referenceYear: YEAR,
    currency: 'USD',
    source: 'Comex Stat / MDIC · Base de dados bruta (NCM) · origem por UF (SG_UF_NCM)',
    sectors,
    ufs,
  }
  await writeFile(OUT_UF, JSON.stringify(ufPayload))

  const bi = (v) => (v / 1e9).toFixed(1)
  const partnerExp = partners.reduce((s, p) => s + p[4], 0)
  const partnerImp = partners.reduce((s, p) => s + p[5], 0)
  const kb = Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024)
  console.log(
    `\ntotais ${YEAR}: exportações US$ ${bi(expStats.total)} bi · ` +
      `importações US$ ${bi(impStats.total)} bi`,
  )
  console.log(
    `cobertura por país: exp ${((partnerExp / expStats.total) * 100).toFixed(1)}% · ` +
      `imp ${((partnerImp / impStats.total) * 100).toFixed(1)}% ` +
      `(sem ISO: exp US$ ${bi(expStats.noIso)} + imp US$ ${bi(impStats.noIso)} bi; ` +
      `sem centroide: US$ ${bi(droppedNoCentroid)} bi)`,
  )
  console.log(`gravado: ${OUT} — ${partners.length} parceiros, ${Object.keys(sectors).length} setores (${kb} KB)`)
  const ufKb = Math.round(Buffer.byteLength(JSON.stringify(ufPayload)) / 1024)
  const ufTop = [...ufs]
    .slice(0, 5)
    .map((u) => `${u[0]}:${(sectors[u[5][0]?.[0]] ?? '—').split(/[ (]/)[0]}`)
    .join(' ')
  console.log(`gravado: ${OUT_UF} — ${ufs.length} UFs (${ufKb} KB) · top setor por UF: ${ufTop}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
