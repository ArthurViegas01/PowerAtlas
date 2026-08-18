#!/usr/bin/env node
/**
 * Municipal economic vocation, straight from IBGE. The PIB dos Municípios breaks
 * each city's valor adicionado bruto (VAB) into four activities; their shares
 * are the "vocação" of the município (a city can have more than one, e.g. agro +
 * indústria), and the total gives the magnitude for sizing the 3D sector icons.
 *
 *   public/data/vocacao/municipios.json   keyed nothing; tuples per município
 *
 * Year note: the VAB *by activity* lags the headline PIB. The PIB total is
 * published through 2023, but the four-activity split only through 2021 (2022+
 * come back suppressed as "..." for every município), so the vocation uses 2021,
 * the latest year with full 5.570/5.570 coverage.
 *
 * Source (factual, IBGE Agregados v3, agregado 5938, período 2021):
 *   513   VAB agropecuária                              (Mil Reais)
 *   517   VAB indústria                                 (Mil Reais)
 *   6575  VAB serviços (exclusive administração pública) (Mil Reais)
 *   525   VAB administração, defesa, educação e saúde públicas (Mil Reais)
 *   498   VAB total                                     (Mil Reais)  [check]
 *
 * VAB is not the same as PIB (PIB = VAB + impostos líquidos), so it splits the
 * productive side without the tax wedge. The four sector VABs sum to the total,
 * which is the natural denominator for the shares. This dataset is context only
 * (like the other IBGE indicators), never the power rankings. Provenance:
 * docs/data-sources.md. Run via `pnpm vocacao` (repo root).
 *
 * Output (values rounded; shares are integer percent 0..100 of VAB total):
 *   { referenceYear, source,
 *     sectors: { agro, ind, serv, adm },
 *     municipios: [[codigo, vabTotalMilReais, agro%, ind%, serv%, adm%], ...] }
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { UF_BY_CODE } from './uf-codes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'data', 'vocacao', 'municipios.json')

const BASE = 'https://servicodados.ibge.gov.br/api/v3/agregados'
const AGREGADO = 5938
// Latest year with the full VAB-by-activity split at município level (2022+ are
// not published yet — they return "..." for every município). See header note.
const YEAR = 2021
const PERIODO = String(YEAR)

// VAB variable id -> the short sector key the front uses.
const VARS = {
  513: 'agro',
  517: 'ind',
  6575: 'serv',
  525: 'adm',
  498: 'total',
}

const SECTOR_LABELS = {
  agro: 'Agropecuária',
  ind: 'Indústria',
  serv: 'Serviços',
  adm: 'Adm. pública',
}

const url = (localidades) =>
  `${BASE}/${AGREGADO}/periodos/${PERIODO}/variaveis/${Object.keys(VARS).join('|')}` +
  `?localidades=${localidades}`

async function fetchJson(u) {
  console.log(`[voc] GET ${u}`)
  const res = await fetch(u)
  if (!res.ok) throw new Error(`IBGE request failed: ${res.status} ${res.statusText} (${u})`)
  return res.json()
}

/** '1581196' -> 1581196; '...', '-', 'X' (suppressed) -> null. */
function parseValue(raw) {
  if (raw == null) return null
  const num = Number(String(raw).replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

// Collect VAB fields per município (7-digit locality id).
const byCodigo = new Map()
const payload = await fetchJson(url('N6[all]'))
for (const variable of payload) {
  const field = VARS[String(variable.id)]
  if (!field) continue
  const resultados = variable.resultados ?? []
  if (resultados.length !== 1) {
    throw new Error(`Variable ${variable.id}: expected 1 resultado, got ${resultados.length}`)
  }
  for (const series of resultados[0].series) {
    const id = String(series.localidade.id)
    if (id.length !== 7) continue
    const target = byCodigo.get(id) ?? {}
    target[field] = parseValue(series.serie[PERIODO])
    byCodigo.set(id, target)
  }
}

// Build the tuples. Shares are integer percent of VAB total; the four should sum
// to ~100 (rounding drift of a point or two is expected and harmless). National
// raw sector sums are accumulated in parallel so the payload can carry the
// baseline shares — the denominator of a location quotient, the honest way to
// call a município's vocation: Sorriso books more VAB in serviços than in agro,
// yet its agro share dwarfs the national average, so it is agro-specialized.
const municipios = []
const nation = { agro: 0, ind: 0, serv: 0, adm: 0 }
let dropped = 0
for (const [codigo, v] of byCodigo) {
  if (!UF_BY_CODE[codigo.slice(0, 2)]) continue
  // Prefer the reported total; fall back to the sum of parts if IBGE suppressed
  // it (never divide by a null).
  const parts = (v.agro ?? 0) + (v.ind ?? 0) + (v.serv ?? 0) + (v.adm ?? 0)
  const total = v.total != null && v.total > 0 ? v.total : parts
  if (!(total > 0)) {
    dropped += 1
    continue
  }
  nation.agro += v.agro ?? 0
  nation.ind += v.ind ?? 0
  nation.serv += v.serv ?? 0
  nation.adm += v.adm ?? 0
  const pct = (x) => Math.round(((x ?? 0) / total) * 100)
  municipios.push([codigo, Math.round(total), pct(v.agro), pct(v.ind), pct(v.serv), pct(v.adm)])
}
municipios.sort((a, b) => b[1] - a[1])

// National baseline: each sector's share of the whole country's VAB. A
// município is "specialized" in a sector when its own share / this baseline
// (the location quotient) is well above 1.
const nationTotal = nation.agro + nation.ind + nation.serv + nation.adm
const baseline = {
  agro: Math.round((nation.agro / nationTotal) * 1000) / 10,
  ind: Math.round((nation.ind / nationTotal) * 1000) / 10,
  serv: Math.round((nation.serv / nationTotal) * 1000) / 10,
  adm: Math.round((nation.adm / nationTotal) * 1000) / 10,
}

if (municipios.length < 5500) {
  throw new Error(`Only ${municipios.length} municipalities collected (expected ~5570)`)
}

const out = {
  referenceYear: YEAR,
  source: 'IBGE · PIB dos Municípios · VAB por atividade',
  sectors: SECTOR_LABELS,
  baseline,
  municipios,
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out))

const kb = Math.round(statSync(OUT).size / 1024)
// Quick vocation tally: how many municípios lead in each sector.
const lead = { agro: 0, ind: 0, serv: 0, adm: 0 }
const keys = ['agro', 'ind', 'serv', 'adm']
for (const m of municipios) {
  const shares = [m[2], m[3], m[4], m[5]]
  lead[keys[shares.indexOf(Math.max(...shares))]] += 1
}
console.log(`[voc] ${OUT}: ${municipios.length} municípios (${kb} KB), ${dropped} sem VAB`)
console.log(
  `[voc] setor dominante: agro ${lead.agro} · indústria ${lead.ind} · ` +
    `serviços ${lead.serv} · adm. pública ${lead.adm}`,
)
