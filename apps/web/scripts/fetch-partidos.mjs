#!/usr/bin/env node
/**
 * Camada política: partido do PREFEITO ELEITO em 2024, por município, direto do
 * TSE (dados abertos, factual).
 *
 *   public/data/political/municipios-partidos.json
 *     { generatedAt, referenceYear: 2024, byCodigo: { "<ibge7>": "SIGLA" } }
 *
 * Fonte:
 *   - Candidatos 2024 (consulta_cand): uma linha por candidatura, com o cargo
 *     (DS_CARGO), a situação final de totalização (DS_SIT_TOT_TURNO), a sigla do
 *     partido (SG_PARTIDO) e o código TSE do município (SG_UE). Filtra
 *     DS_CARGO = "Prefeito" e DS_SIT_TOT_TURNO começando com "ELEITO" — um
 *     vencedor por município.
 *   - Correspondência código TSE -> código IBGE (betafcc/Municipios-Brasileiros-TSE).
 *
 * O ZIP do TSE (~64 MB) traz um CSV por UF, em ISO-8859-1, separado por ";" e
 * com campos entre aspas. A extração usa `unzip` (Linux/macOS) ou
 * `Expand-Archive` (Windows). Rode da raiz do app: `node scripts/fetch-partidos.mjs`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'data', 'political', 'municipios-partidos.json')

const CAND_ZIP_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip'
const TSE_IBGE_URL =
  'https://raw.githubusercontent.com/betafcc/Municipios-Brasileiros-TSE/master/municipios_brasileiros_tse.json'
const YEAR = 2024

/** Download to a Buffer. */
async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Extract a .zip into `dest` using whatever unzip the platform has. */
function unzip(zipPath, dest) {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${dest}' -Force`],
      { stdio: 'ignore' },
    )
  } else {
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', dest], { stdio: 'ignore' })
  }
}

/** Split a TSE CSV line (";"-separated, each field wrapped in double quotes). */
function splitCsvLine(line) {
  return line.split(';').map((cell) => cell.replace(/^"|"$/g, ''))
}

async function main() {
  console.log('Baixando correspondência TSE -> IBGE…')
  const tseIbge = JSON.parse((await download(TSE_IBGE_URL)).toString('utf8'))
  /** codigo_tse (número) -> codigo_ibge (7 díg, string). */
  const ibgeByTse = new Map()
  for (const row of tseIbge) {
    ibgeByTse.set(Number(row.codigo_tse), String(row.codigo_ibge))
  }
  console.log(`  ${ibgeByTse.size} municípios mapeados.`)

  console.log('Baixando candidatos 2024 do TSE (~64 MB)…')
  const zipBuf = await download(CAND_ZIP_URL)
  const work = mkdtempSync(join(tmpdir(), 'tse-cand-'))
  const zipPath = join(work, 'consulta_cand_2024.zip')
  writeFileSync(zipPath, zipBuf)
  console.log('Extraindo…')
  unzip(zipPath, work)

  const csvs = readdirSync(work).filter(
    (f) => /^consulta_cand_2024_[A-Z]{2}\.csv$/i.test(f) && !/_BR\.csv$/i.test(f),
  )
  if (csvs.length === 0) throw new Error('Nenhum CSV consulta_cand_2024_<UF>.csv encontrado no ZIP.')

  const byCodigo = {}
  let elected = 0
  let unmapped = 0
  for (const file of csvs) {
    const text = readFileSync(join(work, file), 'latin1')
    const lines = text.split(/\r?\n/)
    const header = splitCsvLine(lines[0])
    const idx = (name) => header.indexOf(name)
    const iCargo = idx('DS_CARGO')
    const iSit = idx('DS_SIT_TOT_TURNO')
    const iParty = idx('SG_PARTIDO')
    const iUe = idx('SG_UE')
    if ([iCargo, iSit, iParty, iUe].some((i) => i < 0)) {
      throw new Error(`Colunas esperadas ausentes em ${file}.`)
    }
    for (let l = 1; l < lines.length; l++) {
      if (!lines[l]) continue
      const cols = splitCsvLine(lines[l])
      if (cols[iCargo]?.toUpperCase() !== 'PREFEITO') continue
      // "ELEITO" — exclui "NÃO ELEITO" (não começa com ELEITO) e "#NULO".
      if (!cols[iSit]?.toUpperCase().startsWith('ELEITO')) continue
      const ibge = ibgeByTse.get(Number(cols[iUe]))
      if (!ibge) {
        unmapped++
        continue
      }
      byCodigo[ibge] = cols[iParty]
      elected++
    }
  }
  rmSync(work, { recursive: true, force: true })

  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true })
  const payload = { generatedAt: new Date().toISOString(), referenceYear: YEAR, byCodigo }
  writeFileSync(OUT, JSON.stringify(payload))
  console.log(
    `OK: ${elected} prefeitos eleitos mapeados (${unmapped} sem código IBGE) -> ${OUT}`,
  )
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
