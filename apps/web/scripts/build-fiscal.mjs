/**
 * Fiscal dataset builder: real federal money flows per município.
 *
 * Sources (all public, no API key):
 * 1. Receita Federal — "Arrecadação por Município" (XLSX). The main file has
 *    three sheets: TOTAL (all federal collection), GPS (Previdência/INSS) and
 *    DARF (everything else). Two component files break DARF down further:
 *    "IR por município" and "IPI por município". Segments stored: previdência
 *    (GPS), IR, IPI; "demais tributos" = TOTAL − previdência − IR − IPI is
 *    derived on the front. Matched by normalized name+UF (no IBGE code).
 * 2. Tesouro Nacional (CKAN) — "Transferências Constitucionais para
 *    Municípios" (monthly CSVs, latin1, ';'): FPM, FUNDEB, ITR, CIDE etc.
 *    "outras transferências" = total − FPM − FUNDEB is derived on the front.
 * 3. Portal da Transparência — "Emendas Parlamentares" (bulk ZIP, latin1),
 *    file EmendasParlamentares_PorFavorecido.csv: money actually received
 *    by favorecidos, attributed to their município (name+UF matching) and
 *    filtered by payment date (Ano/Mês) within the reference year. The main
 *    file was tried first but ~96% of 2025 empenhos carry no município
 *    (MÚLTIPLO/Nacional/UF), so the favorecido file is the usable signal.
 *
 * Output: public/data/fiscal/municipios.json
 *   { referenceYear, sources, municipios: [[codigo, arrecadacao, previdencia,
 *     ir, ipi, transferencias, fpm, fundeb, emendas], ...] }
 * Values in whole BRL. Downloads are cached in scripts/.cache-fiscal.
 *
 * Usage: node scripts/build-fiscal.mjs [--year 2025]
 */
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as XLSX from 'xlsx'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CACHE = path.join(ROOT, 'scripts', '.cache-fiscal')
const OUT = path.join(ROOT, 'public', 'data', 'fiscal', 'municipios.json')
const DEMOGRAFIA = path.join(ROOT, 'public', 'data', 'demografia', 'municipios.json')
const STATES = path.join(ROOT, 'public', 'geo', 'brazil-states.geojson')

const YEAR = Number(process.argv[process.argv.indexOf('--year') + 1]) || 2025

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const RECEITA_BASE =
  'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/dados-abertos/receitadata/arrecadacao/' +
  'copy_of_arrecadacao-das-receitas-administradas-pela-rfb-por-municipio/'
// Main file: TOTAL sheet = federal collection; GPS sheet = social-security
// share (Previdência), DARF sheet = everything else.
const RECEITA_XLSX =
  RECEITA_BASE +
  `arrecadacao-das-receitas-administradas-pela-rfb/arrecadacao-da-receita-administrada-pela-rfb-por-municipio-${YEAR}.xlsx`
// Component files that break the collection down by tax. The dedicated
// previdenciária file's TOTAL sheet holds the REAL social-security take
// (~R$720bi): since 2021 most of it is paid via DARF, not GPS, so the main
// file's GPS sheet alone would understate it ~50x.
const PREVIDENCIA_XLSX =
  RECEITA_BASE +
  `arrecadacao-das-receitas-previdenciarias/arrecadacao-previdenciaria-por-municipio-${YEAR}.xlsx`
const IR_XLSX =
  RECEITA_BASE + `arrecadacao-do-imposto-de-renda/arrecadacao-bruta-anual-do-ir-por-municipio-${YEAR}.xlsx`
const IPI_XLSX =
  RECEITA_BASE + `arrecadacao-do-ipi/arrecadacao-bruta-anual-do-ipi-por-municipio-${YEAR}.xlsx`

const TESOURO_CKAN =
  'https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=transferencias-constitucionais-para-municipios'

const EMENDAS_ZIP = 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO'

/** Normalize a name for cross-source matching: uppercase, no accents. */
function normalize(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

async function download(url, file, { binary = false } = {}) {
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
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(target, buffer)
  process.stdout.write(` ok (${(buffer.length / 1e6).toFixed(1)} MB)\n`)
  return target
}

/** Minimal ';' CSV line splitter with quote support (emendas file). */
function splitCsvLine(line) {
  const out = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ';') {
      out.push(field)
      field = ''
    } else field += char
  }
  out.push(field)
  return out
}

/** "1.234.567,89" | "1234567.89" -> number */
function parseBrl(raw) {
  if (!raw) return 0
  const text = String(raw).trim()
  if (!text) return 0
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

async function main() {
  await mkdir(CACHE, { recursive: true })
  await mkdir(path.dirname(OUT), { recursive: true })

  // --- reference: codigo <-> name+UF from our own demografia dataset -------
  const demografia = JSON.parse(await readFile(DEMOGRAFIA, 'utf8'))
  const states = JSON.parse(await readFile(STATES, 'utf8'))
  const ufByCodarea = new Map(
    states.features.map((f) => [f.properties.codarea, f.properties.UF]),
  )
  /** normalized "NAME|UF" -> codigo */
  const codigoByName = new Map()
  const fiscal = new Map() // codigo -> record
  for (const [codigo, name] of demografia.municipios) {
    const uf = ufByCodarea.get(String(codigo).slice(0, 2))
    codigoByName.set(`${normalize(name)}|${uf}`, String(codigo))
    fiscal.set(String(codigo), {
      arrecadacao: 0,
      previdencia: 0,
      ir: 0,
      ipi: 0,
      transferencias: 0,
      fpm: 0,
      fundeb: 0,
      emendas: 0,
    })
  }
  console.log(`referência: ${fiscal.size} municípios (demografia)`)

  // --- 1. Receita Federal: arrecadação por município e por tributo ---------
  console.log(`\n[1/3] Receita Federal ${YEAR} (arrecadação por tributo)`)
  const receitaFile = await download(RECEITA_XLSX, `receita-${YEAR}.xlsx`, { binary: true })
  const workbook = XLSX.read(await readFile(receitaFile), { type: 'buffer' })

  // Sheets shaped [MUNICÍPIO, UF, ARRECADAÇÃO]; sum one into `field`.
  const sumSheet = (wb, sheetName, field) => {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return 0
    let matched = 0
    for (const row of XLSX.utils.sheet_to_json(sheet, { header: 1 })) {
      if (!Array.isArray(row) || row.length < 3) continue
      const [name, uf, value] = row
      if (typeof name !== 'string' || typeof uf !== 'string' || uf.length !== 2) continue
      if (typeof value !== 'number') continue
      const codigo = codigoByName.get(`${normalize(name)}|${uf.toUpperCase()}`)
      if (!codigo) continue
      fiscal.get(codigo)[field] += value
      matched++
    }
    return matched
  }
  const totalMatched = sumSheet(workbook, 'TOTAL', 'arrecadacao')
  const prevFile = await download(PREVIDENCIA_XLSX, `previdencia-${YEAR}.xlsx`, { binary: true })
  const prevWb = XLSX.read(await readFile(prevFile), { type: 'buffer' })
  const prevMatched = sumSheet(prevWb, 'TOTAL', 'previdencia')
  console.log(`  TOTAL casados: ${totalMatched} · previdência casados: ${prevMatched}`)

  // IR and IPI component files: [ANO, UF(full name), "Município - UF", ...].
  // The IBGE-less rows key on the "- UF" suffix; values are R$, "(*)" = sigilo.
  const parseComponent = (buffer, field, valueCol) => {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets['Municípios'] ?? wb.Sheets[wb.SheetNames[0]]
    let matched = 0
    for (const row of XLSX.utils.sheet_to_json(sheet, { header: 1 })) {
      if (!Array.isArray(row) || row.length <= valueCol) continue
      const label = row[2]
      const value = row[valueCol]
      if (typeof label !== 'string' || typeof value !== 'number') continue
      const match = /^(.*) - ([A-Z]{2})$/.exec(label.trim())
      if (!match) continue
      const codigo = codigoByName.get(`${normalize(match[1])}|${match[2]}`)
      if (!codigo) continue
      fiscal.get(codigo)[field] += value
      matched++
    }
    return matched
  }
  const irFile = await download(IR_XLSX, `ir-${YEAR}.xlsx`, { binary: true })
  const ipiFile = await download(IPI_XLSX, `ipi-${YEAR}.xlsx`, { binary: true })
  const irMatched = parseComponent(await readFile(irFile), 'ir', 7) // col 7 = IR total (PF+PJ)
  const ipiMatched = parseComponent(await readFile(ipiFile), 'ipi', 3) // col 3 = IPI
  console.log(`  IR casados: ${irMatched} · IPI casados: ${ipiMatched}`)

  // --- 2. Tesouro: transferências constitucionais --------------------------
  console.log(`\n[2/3] Tesouro ${YEAR} (transferências constitucionais)`)
  const ckan = await (
    await fetch(TESOURO_CKAN, { headers: { 'User-Agent': UA } })
  ).json()
  // CKAN names and URL filenames disagree (URLs are off by one month in
  // stretches), so neither is trusted: every candidate file is downloaded
  // and the actual month read from its ANO/Mês columns, deduped.
  const candidates = ckan.result.resources.filter((resource) => {
    const url = resource.url ?? ''
    return (
      /transferenciamensalmunicipios/i.test(url) &&
      (url.includes(String(YEAR)) || (resource.name ?? '').includes(String(YEAR)))
    )
  })
  const seenMonths = new Set()
  let transfMissed = 0
  const transfMissedNames = new Set()
  for (const resource of candidates) {
    const file = await download(resource.url, `transf-${resource.id}.csv`)
    const text = (await readFile(file)).toString('latin1')
    const lines = text.split(/\r?\n/)
    const firstRow = lines[1]?.split(';')
    if (!firstRow || firstRow.length < 8) continue
    const ano = firstRow[2]?.trim()
    const mes = firstRow[3]?.trim()
    if (ano !== String(YEAR) || seenMonths.has(mes)) continue
    seenMonths.add(mes)
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = line.split(';')
      if (cols.length < 8) continue
      const [name, uf, , , d1, d2, d3, , categoria] = cols
      const codigo = codigoByName.get(`${normalize(name)}|${uf.trim().toUpperCase()}`)
      const total = parseBrl(d1) + parseBrl(d2) + parseBrl(d3)
      if (!codigo) {
        transfMissed += total
        transfMissedNames.add(`${name}|${uf}`)
        continue
      }
      const record = fiscal.get(codigo)
      record.transferencias += total
      const categoriaNorm = normalize(categoria ?? '')
      if (categoriaNorm === 'FPM') record.fpm += total
      else if (categoriaNorm === 'FUNDEB') record.fundeb += total
    }
  }
  console.log(`  meses ingeridos: ${[...seenMonths].sort((a, b) => a - b).join(', ')}`)
  console.log(
    `  nomes sem match: ${transfMissedNames.size} (R$ ${(transfMissed / 1e6).toFixed(1)} mi ignorados)`,
  )

  // --- 3. Portal da Transparência: emendas por favorecido ------------------
  console.log(`\n[3/3] Emendas parlamentares ${YEAR} (recebido por favorecido)`)
  const zipFile = await download(EMENDAS_ZIP, 'emendas.zip', { binary: true })
  // bsdtar ships with Windows 10+ and handles zip extraction.
  const emendasCsv = path.join(CACHE, 'EmendasParlamentares_PorFavorecido.csv')
  try {
    await stat(emendasCsv)
  } catch {
    const { execFileSync } = await import('node:child_process')
    execFileSync('tar', [
      '-xf',
      zipFile,
      '-C',
      CACHE,
      'EmendasParlamentares_PorFavorecido.csv',
    ])
  }
  let header = null
  let idxAnoMes = -1
  let idxUfFav = -1
  let idxMunFav = -1
  let idxValor = -1
  let emendasRows = 0
  let emendasMissed = 0
  const reader = createInterface({
    input: createReadStream(emendasCsv, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  for await (const line of reader) {
    if (!header) {
      header = splitCsvLine(line)
      idxAnoMes = header.indexOf('Ano/Mês')
      idxUfFav = header.indexOf('UF Favorecido')
      idxMunFav = header.indexOf('Município Favorecido')
      idxValor = header.indexOf('Valor Recebido')
      if ([idxAnoMes, idxUfFav, idxMunFav, idxValor].includes(-1))
        throw new Error(
          `cabeçalho inesperado em EmendasParlamentares_PorFavorecido.csv: ${header.join('|')}`,
        )
      continue
    }
    if (!line.includes(`"${YEAR}`)) continue // cheap pre-filter (Ano/Mês)
    const cols = splitCsvLine(line)
    if (!cols[idxAnoMes]?.startsWith(String(YEAR))) continue
    const uf = cols[idxUfFav]?.trim().toUpperCase()
    const name = cols[idxMunFav]
    if (!uf || uf.length !== 2 || !name) continue
    const codigo = codigoByName.get(`${normalize(name)}|${uf}`)
    const value = parseBrl(cols[idxValor])
    if (!codigo) {
      emendasMissed += value
      continue
    }
    fiscal.get(codigo).emendas += value
    emendasRows++
  }
  console.log(
    `  pagamentos de ${YEAR} agregados: ${emendasRows} ` +
      `(R$ ${(emendasMissed / 1e6).toFixed(1)} mi sem match ignorados)`,
  )

  // --- output ---------------------------------------------------------------
  // IR/IPI attribution is coarser than the DARF sheet, so a município's
  // IR+IPI can slightly exceed its TOTAL−GPS; clamp each component so the
  // front's "demais = arrecadacao − previdencia − ir − ipi" stays >= 0.
  const municipios = [...fiscal.entries()].map(([codigo, r]) => {
    const previdencia = Math.min(r.previdencia, r.arrecadacao)
    const darf = r.arrecadacao - previdencia
    const ir = Math.min(r.ir, darf)
    const ipi = Math.min(r.ipi, darf - ir)
    return [
      codigo,
      Math.round(r.arrecadacao),
      Math.round(previdencia),
      Math.round(ir),
      Math.round(ipi),
      Math.round(r.transferencias),
      Math.round(r.fpm),
      Math.round(r.fundeb),
      Math.round(r.emendas),
    ]
  })
  const totals = municipios.reduce(
    (acc, m) => {
      acc.arrecadacao += m[1]
      acc.previdencia += m[2]
      acc.ir += m[3]
      acc.ipi += m[4]
      acc.transferencias += m[5]
      acc.emendas += m[8]
      return acc
    },
    { arrecadacao: 0, previdencia: 0, ir: 0, ipi: 0, transferencias: 0, emendas: 0 },
  )
  const payload = {
    referenceYear: YEAR,
    sources: {
      arrecadacao: 'Receita Federal · Arrecadação por Município (TOTAL, GPS, IR, IPI)',
      transferencias: 'Tesouro Nacional · Transferências Constitucionais e Legais',
      emendas: 'Portal da Transparência · Emendas Parlamentares (recebido por favorecido)',
    },
    municipios,
  }
  await writeFile(OUT, JSON.stringify(payload))
  const bi = (v) => (v / 1e9).toFixed(1)
  console.log(
    `\ntotais ${YEAR}: arrecadação R$ ${bi(totals.arrecadacao)} bi ` +
      `(previd. ${bi(totals.previdencia)} · IR ${bi(totals.ir)} · IPI ${bi(totals.ipi)}) · ` +
      `transferências R$ ${bi(totals.transferencias)} bi · emendas R$ ${bi(totals.emendas)} bi`,
  )
  console.log(`gravado: ${OUT} (${municipios.length} municípios)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
