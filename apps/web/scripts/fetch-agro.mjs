#!/usr/bin/env node
/**
 * Fine-grained agro vocation, straight from IBGE. Two municipal surveys:
 *
 *   PAM (5457)  Produção Agrícola Municipal: valor da produção (mil R$) das
 *               lavouras. We keep soja and café, the two crops that get their
 *               own 3D icons.
 *   PPM (3939)  Pesquisa da Pecuária Municipal: efetivo bovino (cabeças).
 *
 *   public/data/vocacao/agro-municipios.json
 *
 * Product/variable/period ids are RESOLVED FROM THE AGGREGATE METADATA by
 * name (never hardcoded): the script logs what it resolved, so a silent IBGE
 * recode cannot poison the payload. Values are absolute; the front decides
 * the dominant commodity by each município's share of the NATIONAL total of
 * that commodity (comparable across units: mil R$ vs cabeças), with a floor.
 * Context data only (like the other IBGE indicators), never power rankings.
 * Provenance: docs/data-sources.md. Run via `pnpm agro` (repo root).
 *
 * Output:
 *   { source, pam: { year }, ppm: { year },
 *     national: { soja, cafe, bovino },
 *     municipios: [[codigo, sojaMilReais, cafeMilReais, bovinoCabecas], ...] }
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { UF_BY_CODE } from './uf-codes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'data', 'vocacao', 'agro-municipios.json')

const BASE = 'https://servicodados.ibge.gov.br/api/v3/agregados'
const PAM = 5457
const PPM = 3939

async function fetchJson(u) {
  console.log(`[agro] GET ${u}`)
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

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

/** Resolve variable/category ids by name from the aggregate metadata. */
async function resolveMeta(agregado, variableNeedle, classNeedles) {
  const meta = await fetchJson(`${BASE}/${agregado}/metadados`)
  const year = String(meta.periodicidade?.fim ?? '').trim()
  if (!/^\d{4}$/.test(year)) throw new Error(`${agregado}: periodo final invalido (${year})`)
  const variable = (meta.variaveis ?? []).find((v) => norm(v.nome).includes(variableNeedle))
  if (!variable) throw new Error(`${agregado}: variavel "${variableNeedle}" nao achada`)
  const resolved = {}
  for (const [field, needle] of Object.entries(classNeedles)) {
    for (const cls of meta.classificacoes ?? []) {
      const hit = (cls.categorias ?? []).find((c) => norm(c.nome) === needle)
      if (hit) {
        resolved[field] = { classId: cls.id, catId: hit.id, nome: hit.nome }
        break
      }
    }
    if (!resolved[field]) throw new Error(`${agregado}: categoria "${needle}" nao achada`)
  }
  console.log(
    `[agro] ${agregado}: ano ${year}, variavel ${variable.id} (${variable.nome});`,
    Object.entries(resolved)
      .map(([f, r]) => `${f}=${r.catId} (${r.nome})`)
      .join('; '),
  )
  return { year, variableId: variable.id, resolved }
}

/** One N6[all] pull; returns Map codigo -> value for each requested field. */
async function pullMunicipal(agregado, year, variableId, fields) {
  const classParam = [...new Set(Object.values(fields).map((f) => f.classId))]
  if (classParam.length !== 1) throw new Error(`${agregado}: classificacoes mistas`)
  const cats = Object.values(fields)
    .map((f) => f.catId)
    .join(',')
  const u =
    `${BASE}/${agregado}/periodos/${year}/variaveis/${variableId}` +
    `?localidades=N6[all]&classificacao=${classParam[0]}[${cats}]`
  const payload = await fetchJson(u)
  const catToField = new Map(Object.entries(fields).map(([name, f]) => [String(f.catId), name]))
  const out = new Map()
  for (const variable of payload) {
    for (const resultado of variable.resultados ?? []) {
      const catId = String(Object.keys(resultado.classificacoes?.[0]?.categoria ?? {})[0] ?? '')
      const field = catToField.get(catId)
      if (!field) continue
      for (const series of resultado.series ?? []) {
        const id = String(series.localidade.id)
        if (id.length !== 7 || !UF_BY_CODE[id.slice(0, 2)]) continue
        const value = parseValue(series.serie[year])
        if (value == null || value <= 0) continue
        const target = out.get(id) ?? {}
        target[field] = value
        out.set(id, target)
      }
    }
  }
  return out
}

const pamMeta = await resolveMeta(PAM, 'valor da producao', {
  soja: 'soja (em grao)',
  cafe: 'cafe (em grao) total',
})
const ppmMeta = await resolveMeta(PPM, 'efetivo dos rebanhos', { bovino: 'bovino' })

const pam = await pullMunicipal(PAM, pamMeta.year, pamMeta.variableId, pamMeta.resolved)
const ppm = await pullMunicipal(PPM, ppmMeta.year, ppmMeta.variableId, ppmMeta.resolved)

const codigos = new Set([...pam.keys(), ...ppm.keys()])
const national = { soja: 0, cafe: 0, bovino: 0 }
const municipios = []
for (const codigo of [...codigos].sort()) {
  const soja = Math.round(pam.get(codigo)?.soja ?? 0)
  const cafe = Math.round(pam.get(codigo)?.cafe ?? 0)
  const bovino = Math.round(ppm.get(codigo)?.bovino ?? 0)
  if (soja + cafe + bovino === 0) continue
  national.soja += soja
  national.cafe += cafe
  national.bovino += bovino
  municipios.push([codigo, soja, cafe, bovino])
}

const top = (i) =>
  [...municipios]
    .sort((a, b) => b[i] - a[i])
    .slice(0, 3)
    .map((m) => `${m[0]}=${m[i].toLocaleString('en-US')}`)
    .join(' · ')
console.log(`[agro] municipios com dado: ${municipios.length}`)
console.log(`[agro] top soja (mil R$): ${top(1)}`)
console.log(`[agro] top cafe (mil R$): ${top(2)}`)
console.log(`[agro] top bovino (cabecas): ${top(3)}`)

const out = {
  source: `IBGE · PAM ${pamMeta.year} (valor da producao) + PPM ${ppmMeta.year} (efetivo bovino)`,
  pam: { year: Number(pamMeta.year) },
  ppm: { year: Number(ppmMeta.year) },
  national,
  municipios,
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out))
const kb = Math.round(JSON.stringify(out).length / 1024)
console.log(`[agro] escrito ${OUT} (${kb} KB)`)
