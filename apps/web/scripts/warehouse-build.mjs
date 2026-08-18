/**
 * Build the CSV data warehouse (offline, no network) from the committed web
 * payloads. Emits a star-schema set of canonical CSVs plus a data dictionary
 * under `data/warehouse/`, so the same data that feeds the site can be opened
 * and cross-referenced in Power BI / Excel by shared keys (codigo_ibge,
 * uf_sigla, iso, capitulo_ncm).
 *
 * This is the CSV-first source of truth. `compile-web.mjs` does the reverse
 * (warehouse CSV -> the compact JSON the browser bundle consumes).
 *
 * Reads (all committed):
 *   public/data/demografia/municipios.json   -> dim_municipio, fato_demografia
 *   public/data/fiscal/municipios.json        -> fato_fiscal
 *   public/data/indicators/uf.json            -> fato_indicadores_uf
 *   public/data/comercio/mundo.json           -> dim_pais, dim_setor, fato_comercio*
 * Plus a static UF -> macro-region table (net-new; not present elsewhere).
 *
 * Run: `pnpm warehouse` (root) or `node scripts/warehouse-build.mjs`.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { UF_BY_CODE } from './uf-codes.mjs'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const webRoot = join(scriptsDir, '..')
const repoRoot = join(webRoot, '..', '..')
const DATA_DIR = join(webRoot, 'public', 'data')
const OUT_DIR = join(repoRoot, 'data', 'warehouse')

const readJson = (rel) => JSON.parse(readFileSync(join(DATA_DIR, rel), 'utf8'))

/** Macro-região IBGE por sigla (tabela estática: não existe em nenhum outro lugar). */
const REGIAO_BY_UF = {
  RO: 'Norte', AC: 'Norte', AM: 'Norte', RR: 'Norte', PA: 'Norte', AP: 'Norte', TO: 'Norte',
  MA: 'Nordeste', PI: 'Nordeste', CE: 'Nordeste', RN: 'Nordeste', PB: 'Nordeste',
  PE: 'Nordeste', AL: 'Nordeste', SE: 'Nordeste', BA: 'Nordeste',
  MG: 'Sudeste', ES: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', SC: 'Sul', RS: 'Sul',
  MS: 'Centro-Oeste', MT: 'Centro-Oeste', GO: 'Centro-Oeste', DF: 'Centro-Oeste',
}

/** codigo 2 dígitos -> sigla, para keyar os municípios. */
const SIGLA_BY_CODE = Object.fromEntries(
  Object.entries(UF_BY_CODE).map(([code, [sigla]]) => [String(code), sigla]),
)
const ufOf = (codigo) => SIGLA_BY_CODE[String(codigo).slice(0, 2)] ?? ''

// -- CSV (RFC 4180, mesma semântica de src/lib/csv.ts) -----------------------

const escapeCsv = (value) => {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Escreve uma tabela do warehouse. `meta.columns` é [{ key, ... }]; `rows` são
 * objetos keyados pela `key`. Retorna a seção de dicionário da tabela.
 */
function writeTable(meta, rows) {
  const keys = meta.columns.map((c) => c.key)
  const header = keys.map(escapeCsv).join(',')
  const body = rows.map((row) => keys.map((k) => escapeCsv(row[k] ?? null)).join(','))
  const csv = [header, ...body].join('\r\n') + '\r\n'
  writeFileSync(join(OUT_DIR, `${meta.name}.csv`), csv)
  console.log(`  ${meta.name}.csv  (${rows.length} linhas)`)
  return { ...meta, rowCount: rows.length }
}

// -- Fontes ------------------------------------------------------------------

const demografia = readJson('demografia/municipios.json')
const fiscal = readJson('fiscal/municipios.json')
const indicators = readJson('indicators/uf.json')
const comercio = readJson('comercio/mundo.json')

// Área/densidade por município vêm do fetch bruto do IBGE por UF (não estão no
// demografia.json, que só carrega pop+PIB). Junta pela chave codigo.
const MUNI_IND_DIR = join(DATA_DIR, 'indicators', 'municipios')
const muniIndByCodigo = new Map()
for (const f of readdirSync(MUNI_IND_DIR).filter((n) => n.endsWith('.json'))) {
  const file = JSON.parse(readFileSync(join(MUNI_IND_DIR, f), 'utf8'))
  for (const [codigo, r] of Object.entries(file.municipios)) muniIndByCodigo.set(codigo, r)
}

mkdirSync(OUT_DIR, { recursive: true })
console.log(`warehouse -> ${OUT_DIR}`)

// Escalares não-tabulares (rótulos de fonte, totais, anos). Ficam fora dos CSVs
// (não são linhas de dados) mas são necessários para o compile-web reconstruir
// o payload do site byte-a-byte. Fonte da verdade da proveniência.
const meta = {
  demografia: { censusYear: demografia.censusYear, gdpYear: demografia.gdpYear },
  fiscal: { referenceYear: fiscal.referenceYear, sources: fiscal.sources },
  indicators: { censusYear: indicators.censusYear, gdpYear: indicators.gdpYear },
  comercio: {
    referenceYear: comercio.referenceYear,
    currency: comercio.currency,
    source: comercio.source,
    totals: comercio.totals,
  },
}
writeFileSync(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')

const sections = []

// -- dim_uf (27 UFs + BR) ----------------------------------------------------

sections.push(
  writeTable(
    {
      name: 'dim_uf',
      grao: 'Uma linha por UF (27) mais a linha agregada BR.',
      fonte: 'IBGE (siglas/códigos) + classificação estática de macro-região.',
      columns: [
        { key: 'uf_sigla', tipo: 'texto', unidade: '', desc: 'Sigla da UF. CHAVE (PK).' },
        { key: 'uf_codigo', tipo: 'texto', unidade: '', desc: 'Geocódigo IBGE de 2 dígitos (vazio para BR).' },
        { key: 'uf_nome', tipo: 'texto', unidade: '', desc: 'Nome da unidade federativa.' },
        { key: 'regiao', tipo: 'texto', unidade: '', desc: 'Macro-região IBGE (Norte/Nordeste/Sudeste/Sul/Centro-Oeste; "Brasil" para BR).' },
      ],
    },
    [
      { uf_sigla: 'BR', uf_codigo: '', uf_nome: 'Brasil', regiao: 'Brasil' },
      ...Object.entries(UF_BY_CODE).map(([code, [sigla, nome]]) => ({
        uf_sigla: sigla,
        uf_codigo: String(code),
        uf_nome: nome,
        regiao: REGIAO_BY_UF[sigla] ?? '',
      })),
    ],
  ),
)

// -- dim_municipio (espinha de join) -----------------------------------------

sections.push(
  writeTable(
    {
      name: 'dim_municipio',
      grao: 'Uma linha por município.',
      fonte: 'IBGE · malha territorial + Censo 2022 (centroide aproximado).',
      columns: [
        { key: 'codigo_ibge', tipo: 'texto', unidade: '', desc: 'Geocódigo IBGE de 7 dígitos. CHAVE (PK).' },
        { key: 'nome', tipo: 'texto', unidade: '', desc: 'Nome do município.' },
        { key: 'uf_sigla', tipo: 'texto', unidade: '', desc: 'Sigla da UF. FK -> dim_uf.uf_sigla.' },
        { key: 'uf_codigo', tipo: 'texto', unidade: '', desc: 'Geocódigo IBGE de 2 dígitos da UF.' },
        { key: 'lon', tipo: 'decimal', unidade: 'graus', desc: 'Longitude do centroide.' },
        { key: 'lat', tipo: 'decimal', unidade: 'graus', desc: 'Latitude do centroide.' },
      ],
    },
    demografia.municipios.map(([codigo, name, lon, lat]) => ({
      codigo_ibge: codigo,
      nome: name,
      uf_sigla: ufOf(codigo),
      uf_codigo: String(codigo).slice(0, 2),
      lon,
      lat,
    })),
  ),
)

// -- fato_demografia_municipio -----------------------------------------------

sections.push(
  writeTable(
    {
      name: 'fato_demografia_municipio',
      grao: 'Uma linha por município.',
      fonte: 'IBGE · Censo 2022 (população/área/densidade) e PIB dos Municípios 2023.',
      columns: [
        { key: 'codigo_ibge', tipo: 'texto', unidade: '', desc: 'FK -> dim_municipio.codigo_ibge.' },
        { key: 'ano_censo', tipo: 'inteiro', unidade: 'ano', desc: 'Ano de referência da população.' },
        { key: 'ano_pib', tipo: 'inteiro', unidade: 'ano', desc: 'Ano de referência do PIB.' },
        { key: 'populacao', tipo: 'inteiro', unidade: 'habitantes', desc: 'População residente.' },
        { key: 'area_km2', tipo: 'decimal', unidade: 'km²', desc: 'Área territorial.' },
        { key: 'densidade', tipo: 'decimal', unidade: 'hab/km²', desc: 'Densidade demográfica.' },
        { key: 'pib_mil_brl', tipo: 'inteiro', unidade: 'R$ mil', desc: 'PIB a preços correntes, em milhares de reais.' },
      ],
    },
    demografia.municipios.map(([codigo, , , , population, gdp]) => {
      const ind = muniIndByCodigo.get(codigo)
      return {
        codigo_ibge: codigo,
        ano_censo: demografia.censusYear,
        ano_pib: demografia.gdpYear,
        populacao: population,
        area_km2: ind?.areaKm2 ?? null,
        densidade: ind?.density ?? null,
        pib_mil_brl: gdp,
      }
    }),
  ),
)

// -- fato_fiscal_municipio ---------------------------------------------------

sections.push(
  writeTable(
    {
      name: 'fato_fiscal_municipio',
      grao: 'Uma linha por município.',
      fonte: 'Receita Federal (arrecadação) · Tesouro Nacional (transferências) · Portal da Transparência (emendas).',
      columns: [
        { key: 'codigo_ibge', tipo: 'texto', unidade: '', desc: 'FK -> dim_municipio.codigo_ibge.' },
        { key: 'ano', tipo: 'inteiro', unidade: 'ano', desc: 'Ano de referência.' },
        { key: 'arrecadacao', tipo: 'inteiro', unidade: 'R$', desc: 'Arrecadação federal total no município.' },
        { key: 'previdencia', tipo: 'inteiro', unidade: 'R$', desc: 'Arrecadação previdenciária (GPS).' },
        { key: 'ir', tipo: 'inteiro', unidade: 'R$', desc: 'Imposto de Renda.' },
        { key: 'ipi', tipo: 'inteiro', unidade: 'R$', desc: 'Imposto sobre Produtos Industrializados.' },
        { key: 'transferencias', tipo: 'inteiro', unidade: 'R$', desc: 'Transferências constitucionais e legais (total).' },
        { key: 'fpm', tipo: 'inteiro', unidade: 'R$', desc: 'Fundo de Participação dos Municípios.' },
        { key: 'fundeb', tipo: 'inteiro', unidade: 'R$', desc: 'FUNDEB.' },
        { key: 'emendas', tipo: 'inteiro', unidade: 'R$', desc: 'Emendas parlamentares recebidas.' },
      ],
      notas: [
        'demais = arrecadacao - previdencia - ir - ipi (derivado no front; não armazenado).',
        'outras = transferencias - fpm - fundeb (derivado no front; não armazenado).',
        'Componentes-base apenas, para que um valor nunca contradiga o próprio total.',
      ],
    },
    fiscal.municipios.map(
      ([codigo, arrecadacao, previdencia, ir, ipi, transferencias, fpm, fundeb, emendas]) => ({
        codigo_ibge: codigo,
        ano: fiscal.referenceYear,
        arrecadacao,
        previdencia,
        ir,
        ipi,
        transferencias,
        fpm,
        fundeb,
        emendas,
      }),
    ),
  ),
)

// -- fato_indicadores_uf -----------------------------------------------------

sections.push(
  writeTable(
    {
      name: 'fato_indicadores_uf',
      grao: 'Uma linha por região (BR + 27 UFs).',
      fonte: 'IBGE · Censo 2022 (população/área/densidade) e PIB 2023.',
      columns: [
        { key: 'regiao_id', tipo: 'texto', unidade: '', desc: 'FK -> dim_uf.uf_sigla (BR ou sigla).' },
        { key: 'ano_censo', tipo: 'inteiro', unidade: 'ano', desc: 'Ano do Censo.' },
        { key: 'ano_pib', tipo: 'inteiro', unidade: 'ano', desc: 'Ano do PIB.' },
        { key: 'populacao', tipo: 'inteiro', unidade: 'habitantes', desc: 'População residente.' },
        { key: 'area_km2', tipo: 'decimal', unidade: 'km²', desc: 'Área territorial.' },
        { key: 'densidade', tipo: 'decimal', unidade: 'hab/km²', desc: 'Densidade demográfica.' },
        { key: 'pib_mil_brl', tipo: 'inteiro', unidade: 'R$ mil', desc: 'PIB em milhares de reais.' },
      ],
    },
    Object.entries(indicators.regions).map(([id, r]) => ({
      regiao_id: id,
      ano_censo: indicators.censusYear,
      ano_pib: indicators.gdpYear,
      populacao: r.population,
      area_km2: r.areaKm2,
      densidade: r.density,
      pib_mil_brl: r.gdpBrlThousands,
    })),
  ),
)

// -- dim_pais / dim_setor_comercio -------------------------------------------

sections.push(
  writeTable(
    {
      name: 'dim_pais',
      grao: 'Um parceiro comercial (país) por linha.',
      fonte: 'Comex Stat / MDIC.',
      columns: [
        { key: 'iso', tipo: 'texto', unidade: '', desc: 'Código ISO do país. CHAVE (PK).' },
        { key: 'nome', tipo: 'texto', unidade: '', desc: 'Nome do país.' },
        { key: 'lon', tipo: 'decimal', unidade: 'graus', desc: 'Longitude aproximada.' },
        { key: 'lat', tipo: 'decimal', unidade: 'graus', desc: 'Latitude aproximada.' },
      ],
    },
    comercio.partners.map(([iso, name, lon, lat]) => ({ iso, nome: name, lon, lat })),
  ),
)

sections.push(
  writeTable(
    {
      name: 'dim_setor_comercio',
      grao: 'Um capítulo NCM (2 dígitos) por linha; "ZZ" agrega o restante.',
      fonte: 'Comex Stat / MDIC.',
      columns: [
        { key: 'capitulo_ncm', tipo: 'texto', unidade: '', desc: 'Capítulo NCM de 2 dígitos (ou "ZZ" = Outros). CHAVE (PK).' },
        { key: 'descricao', tipo: 'texto', unidade: '', desc: 'Descrição do capítulo.' },
      ],
    },
    Object.entries(comercio.sectors).map(([code, label]) => ({
      capitulo_ncm: code,
      descricao: label,
    })),
  ),
)

// -- fato_comercio_parceiro / _parceiro_setor --------------------------------

sections.push(
  writeTable(
    {
      name: 'fato_comercio_parceiro',
      grao: 'Uma linha por país parceiro.',
      fonte: 'Comex Stat / MDIC.',
      columns: [
        { key: 'iso', tipo: 'texto', unidade: '', desc: 'FK -> dim_pais.iso.' },
        { key: 'ano', tipo: 'inteiro', unidade: 'ano', desc: 'Ano de referência.' },
        { key: 'exp', tipo: 'inteiro', unidade: 'US$ FOB', desc: 'Exportações do Brasil para o país.' },
        { key: 'imp', tipo: 'inteiro', unidade: 'US$ FOB', desc: 'Importações do Brasil do país.' },
      ],
    },
    comercio.partners.map(([iso, , , , exp, imp]) => ({
      iso,
      ano: comercio.referenceYear,
      exp,
      imp,
    })),
  ),
)

const parceiroSetorRows = []
for (const [iso, , , , , , sectors] of comercio.partners) {
  for (const [capitulo, exp, imp] of sectors) {
    parceiroSetorRows.push({ iso, capitulo_ncm: capitulo, ano: comercio.referenceYear, exp, imp })
  }
}
sections.push(
  writeTable(
    {
      name: 'fato_comercio_parceiro_setor',
      grao: 'Uma linha por país × capítulo NCM (setores aninhados desaninhados).',
      fonte: 'Comex Stat / MDIC.',
      columns: [
        { key: 'iso', tipo: 'texto', unidade: '', desc: 'FK -> dim_pais.iso.' },
        { key: 'capitulo_ncm', tipo: 'texto', unidade: '', desc: 'FK -> dim_setor_comercio.capitulo_ncm.' },
        { key: 'ano', tipo: 'inteiro', unidade: 'ano', desc: 'Ano de referência.' },
        { key: 'exp', tipo: 'inteiro', unidade: 'US$ FOB', desc: 'Exportações do setor para o país.' },
        { key: 'imp', tipo: 'inteiro', unidade: 'US$ FOB', desc: 'Importações do setor do país.' },
      ],
    },
    parceiroSetorRows,
  ),
)

// Relações (chaves estrangeiras) do modelo estrela. Alimentam o dicionário, o
// catálogo do console e as relações a criar no Power BI.
const RELATIONSHIPS = [
  { from: 'fato_demografia_municipio', fromCol: 'codigo_ibge', to: 'dim_municipio', toCol: 'codigo_ibge' },
  { from: 'fato_fiscal_municipio', fromCol: 'codigo_ibge', to: 'dim_municipio', toCol: 'codigo_ibge' },
  { from: 'dim_municipio', fromCol: 'uf_sigla', to: 'dim_uf', toCol: 'uf_sigla' },
  { from: 'fato_indicadores_uf', fromCol: 'regiao_id', to: 'dim_uf', toCol: 'uf_sigla' },
  { from: 'fato_comercio_parceiro', fromCol: 'iso', to: 'dim_pais', toCol: 'iso' },
  { from: 'fato_comercio_parceiro_setor', fromCol: 'iso', to: 'dim_pais', toCol: 'iso' },
  { from: 'fato_comercio_parceiro_setor', fromCol: 'capitulo_ncm', to: 'dim_setor_comercio', toCol: 'capitulo_ncm' },
]

// -- DICIONARIO.md -----------------------------------------------------------

function dictionary(sections) {
  const lines = [
    '# Dicionário de dados: `data/warehouse/`',
    '',
    'Armazém CSV-first do PowerAtlas em modelo estrela (dimensão + fato). Fonte da',
    'verdade dos dados factuais: você edita/versiona os CSVs aqui, o site é compilado',
    'a partir deles (`pnpm compile-web`) e o Power BI abre esta pasta direto.',
    '',
    '**Gerado por `apps/web/scripts/warehouse-build.mjs` (`pnpm warehouse`). Não editar à mão.**',
    '',
    '## Chaves de cruzamento (relações no Power BI)',
    '',
    '| De (fato) | Coluna | Para (dimensão) | Coluna |',
    '| --- | --- | --- | --- |',
    ...RELATIONSHIPS.map((r) => `| ${r.from} | ${r.fromCol} | ${r.to} | ${r.toCol} |`),
    '',
    '## Tabelas',
    '',
  ]
  for (const s of sections) {
    lines.push(`### \`${s.name}.csv\` (${s.rowCount} linhas)`)
    lines.push('')
    lines.push(`- **Grão:** ${s.grao}`)
    lines.push(`- **Fonte:** ${s.fonte}`)
    lines.push('')
    lines.push('| Coluna | Tipo | Unidade | Descrição |')
    lines.push('| --- | --- | --- | --- |')
    for (const c of s.columns) {
      lines.push(`| \`${c.key}\` | ${c.tipo} | ${c.unidade || '-'} | ${c.desc} |`)
    }
    lines.push('')
    if (s.notas) {
      lines.push('Notas:')
      for (const n of s.notas) lines.push(`- ${n}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

writeFileSync(join(OUT_DIR, 'DICIONARIO.md'), dictionary(sections))
console.log(`  DICIONARIO.md  (${sections.length} tabelas)`)

// -- catalog.json (esquema legível pela máquina; o compile-web publica em
//    public/data para o console renderizar a visão CATÁLOGO) -----------------
const catalog = {
  generatedFrom: 'warehouse-build.mjs',
  tables: sections.map((s) => ({
    name: s.name,
    kind: s.name.startsWith('dim_') ? 'dimensao' : 'fato',
    grao: s.grao,
    fonte: s.fonte,
    rowCount: s.rowCount,
    columns: s.columns.map((c) => ({ key: c.key, tipo: c.tipo, unidade: c.unidade, desc: c.desc })),
    notas: s.notas ?? [],
  })),
  relationships: RELATIONSHIPS,
}
writeFileSync(join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log('  catalog.json')

const total = sections.reduce((n, s) => n + s.rowCount, 0)
console.log(`ok: ${sections.length} tabelas, ${total} linhas`)
