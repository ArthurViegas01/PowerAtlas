# Data sources

> Onde cada dado nasce. O **armazém CSV-first** que consolida os datasets
> factuais em modelo estrela (fonte da verdade, compilada para os payloads do
> site e aberta no Power BI) está em [warehouse.md](warehouse.md). Fluxo:
> fetch/build (upstream) → `data/warehouse/*.csv` → `pnpm compile-web` →
> `public/data/**`.

## Brazil boundaries (`apps/web/public/geo/*.geojson`)

**Source:** IBGE — API de Malhas Territoriais v3 (official, public).
Docs: <https://servicodados.ibge.gov.br/api/docs/malhas?versao=3>

**Endpoint used (downloaded 2026-07-15):**

```
https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=maxima&intrarregiao=UF
```

**Why `qualidade=maxima` (deviation from the plan's `intermediaria`):**
measured on 2026-07-15, the whole-country meshes this API serves are small —
national outline: minima 12 KB / intermediaria 22 KB / maxima 64 KB; the
27-state mesh at maxima is ≈ 1.0 MB raw. `intermediaria` is too coarse to
look credible at state-level zoom, and `maxima` still fits the size budgets
after simplification.

**Processing** (`apps/web/scripts/fetch-geo.mjs`, re-run with `pnpm geo`):

1. Download the state mesh (27 UFs; `codarea` = 2-digit IBGE geocode).
2. `mapshaper -simplify 30% keep-shapes -clean -o precision=0.0001
   format=geojson` → `public/geo/brazil-states.geojson`
   (**300 KB**, budget 500 KB).
3. National outline **dissolved from the simplified states**
   (`mapshaper -dissolve`) so both files share exactly coincident borders →
   `public/geo/brazil-national.geojson` (**80 KB**, budget 200 KB). No
   separate national download.
4. Properties normalized to `{ codarea, UF, name }`; `UF` (sigla) is the
   join key to mock data `region.id`.

**Attribution:** the map UI credits "Malhas territoriais: IBGE".

## Municipal boundaries (`apps/web/public/geo/municipios/{UF}.geojson`)

**Coverage: all 27 UFs.** Per-state municipal meshes, loaded on demand when a
state is selected (the app never loads all 5,570 municipalities at once).
Same IBGE Malhas v3 API, plus the Localidades API for names.

**Endpoints used (SP downloaded 2026-07-19; remaining 26 UFs 2026-07-21;
`{code}` = 2-digit IBGE UF geocode):**

```
malha:  https://servicodados.ibge.gov.br/api/v3/malhas/estados/{code}?formato=application/vnd.geo%2Bjson&qualidade=intermediaria&intrarregiao=municipio
nomes:  https://servicodados.ibge.gov.br/api/v1/localidades/estados/{code}/municipios
```

**Processing** (`apps/web/scripts/fetch-geo.mjs`, `pnpm geo`): the malha carries
only `codarea` (7-digit IBGE municipality code); names are joined in from the
Localidades API by that code. `mapshaper -simplify 25% keep-shapes -clean`,
properties normalized to `{ codigo, name }`. The UF list is derived from the
script's `UF_BY_CODE` table (nothing to extend by hand); pass
`--municipios-only` to rebuild only these files without re-downloading the
state/world meshes. Sizes: largest MG (853 municipalities, **569 KB**), then
SP (645, **347 KB**); every file is under the 900 KB budget and the 27 files
total **3.7 MB**, fetched one state at a time.

## Intramunicipal boundaries (`apps/web/public/geo/subdivisoes/{codigo}.geojson`)

**Coverage: 2,587 of the 5,570 municipalities (76.2% of the population),** in
two levels, because IBGE does not cut every city the same way:

| Level | Municipalities | Units | Why |
| --- | --- | --- | --- |
| `bairro` | 895 | 17,575 | The finer cut, wherever IBGE draws it |
| `distrito` | 1,692 | 5,110 | Fallback where no bairros exist |

The fallback is not universal on purpose. Every município has at least one
distrito, but in 3,332 of them that single distrito **is** the município: an
identical polygon with nothing to drill into. Only municípios with 2 or more
distritos get a file. That still leaves 2,983 municípios (23.8% of the
population) where the drill-down stops at the município, Brasília and São Luís
among them, and the panel says so instead of failing silently. São Paulo is
the headline case the fallback rescues: no bairros, but 96 distritos.

**Why not the Malhas API:** it stops at the município. Asking a município for
an intramunicipal cut answers HTTP 400 (`"Quando a malha for um município do
Brasil, o parâmetro intrarregiao NÃO aceita valores"`), so both levels come
from geoftp shapefiles instead.

**Sources (downloaded 2026-07-28),** where `{nivel}` is `bairros` or
`distritos` and `{Nivel}` is `Bairro` or `Distrito`:

```
malha:      https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/{nivel}/shp/BR/BR_{nivel}_CD2022.zip
agregados:  https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/Agregados_por_{Nivel}_csv/Agregados_por_{nivel}_basico_BR_20260520.zip
```

The bairro mesh is 26 MB zipped, the distrito one 226 MB. Both carry `CD_MUN`
(the same 7-digit code the municipal mesh uses, so the join is direct) plus
their own code and name field.

**Processing** (`apps/web/scripts/fetch-subdivisoes.mjs`, `pnpm subdivisoes`):
mapshaper reads each shapefile straight out of its zip, `-simplify 20%
keep-shapes -clean`, then `-split CD_MUN` writes one file per município.
Looser than the municipal 25% on purpose: bairro polygons are made of
street-level notches that heavier simplification turns to mush at the zoom the
drill-down flies to. Bairros run first, so a município that has them never
gets a distrito file. The wanted-município filter goes through a joined CSV
rather than an inline expression, because the distrito list runs past the
command-line length limit. Properties are rewritten to `{ codigo, name,
population, households, areaKm2, density }`. `--pilot` builds only the 27
capitals; `--level=bairro|distrito` rebuilds one level.

**Why the aggregates ride inside the GeoJSON:** one lazy fetch per city
instead of two. Median 8 KB (bairros) and 18 KB (distritos); largest Belo
Horizonte at **363 KB** (budget 400 KB), fetched one município at a time.
Total **53.6 MB** across 2,587 files. `index.json` maps each município to
`{count, level}`, so the app can tell "not loaded yet" from "this city has no
subdivision" without firing a request that 404s, **and** name the division
correctly instead of calling a distrito a bairro.

**The Censo 2022 figures are real**, and they reconcile: summing `v0001`
(resident population) over Rio de Janeiro's 162 bairros gives exactly
6,211,223, the município's Censo 2022 total. `v0002` is households and
`AREA_KM2` the area, from which density is precomputed.

**No PIB at this level.** The PIB dos Municípios does not break down below the
município, so the readouts show `N/D` for PIB and the fiscal overlay stays a
municipal layer. The UI says so explicitly rather than dividing a municipal
number by anything.

## World countries backdrop (`apps/web/public/geo/world-countries.geojson`)

**Source:** Natural Earth, 1:50m Cultural Vectors — Admin 0 Countries
(public domain), from the project's official GitHub mirror:

```
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
```

**Role:** dim, dashed "em breve" backdrop only — countries outside Brazil are
rendered as a not-yet-mapped zone and are not part of the product data. IBGE
remains the authoritative source for everything Brazil. Natural Earth's own
Brazil polygon is **removed** so the IBGE layers never fight it (small
gaps along land borders read as the national glow margin by design);
Antarctica is removed as visual clutter.

**Processing** (`pnpm geo`): `mapshaper -simplify 18% keep-shapes -clean`,
precision 0.01° (~1 km), properties slimmed to `{ iso, name }` where `iso` =
NE `ADM0_A3` and `name` prefers the `NAME_PT` Portuguese localization.

**Reconciled with the provinces** (`reconcileWorldCountries`, also runnable
standalone via `pnpm geo -- --reconcile-world` with no download): the backdrop
draws each country's fill/wall from this admin-0 mesh, but the province hover
comes from the denser admin-1 `world-states` mesh below. At different
resolutions their coastlines disagreed — the 3D wall stood in one place while
the hovered province outlined another shoreline. So for every country in
`world-states` (the ~30 with provinces drawn), its admin-0 polygon is replaced
by the **dissolved union of its own provinces**, at the same 0.0001° precision,
making the wall and the province outlines share identical vertices. Countries
without provinces keep their 50m outline (nothing to disagree with). Result:
**240 countries, ~354 KB** (budget 400 KB).

## Factual indicators (`apps/web/public/data/indicators/*.json`)

**Source:** IBGE, API de Agregados v3 (official, public).
Docs: <https://servicodados.ibge.gov.br/api/docs/agregados?versao=3>

**Endpoints used (downloaded 2026-07-21;** localidades **=
`N1[all]|N3[all]` for Brasil + UFs and `N6[all]` for municipalities):**

```
censo: https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93|6318|614?localidades=...
pib:   https://servicodados.ibge.gov.br/api/v3/agregados/5938/periodos/2023/variaveis/37?localidades=...
```

**Indicators:** população residente (Censo 2022, variável 93), área
territorial em km² (6318), densidade demográfica (614), PIB a preços
correntes em mil R$ (PIB dos Municípios, 2023, variável 37). Municipal GDP
per capita is deliberately absent: the agregados API does not publish it at
N6, and deriving it by mixing 2023 GDP with 2022 population would fabricate
a number IBGE does not publish.

**Processing** (`apps/web/scripts/fetch-indicators.mjs`, `pnpm indicators`):
values parsed to numbers (IBGE suppression markers become `null`), keyed by
UF sigla in `uf.json` (28 regions including BR, 3 KB) and by 7-digit IBGE
code in `municipios/{UF}.json` (5,570 municipalities across 27 files,
largest MG at 74 KB). The app loads `uf.json` at boot and the municipal
files on demand per selected state.

**Role:** factual context only (indicator blocks in the panels). The power
rankings remain fictional until the F5/F6 pipeline and review gate exist
(ARCHITECTURE.md §5).

## Demographic view dataset (`apps/web/public/data/demografia/municipios.json`)

**Source:** none of its own. This file is an **offline join** of two datasets
already committed above: the municipal meshes (`public/geo/municipios/*.geojson`)
and the municipal indicators (`public/data/indicators/municipios/*.json`).

**Processing** (`apps/web/scripts/build-demografia.mjs`, `pnpm demografia`):
for every município it derives an approximate centroid (vertex average of the
largest ring, which is precise enough to anchor a column at national zoom) and
pairs it with the Censo 2022 population and the 2023 PIB. Rows are stored as
tuples, not objects, to keep the payload small:

```
{ censusYear, gdpYear,
  municipios: [[codigo, name, lon, lat, population, gdpBrlThousands], ...] }
```

Result: 5,570 municípios, **312 KB**, fetched once when the demographic view
first opens. The script needs no network: re-run it after `pnpm geo` or
`pnpm indicators` changes either input.

## Fiscal flows (`apps/web/public/data/fiscal/municipios.json`)

Real federal money flows per município, powering the fiscal columns and the
animated flow arcs of the demographic view. Reference year **2025**.

**Sources (all public, all open data, no API key):**

1. **Receita Federal**, "Arrecadação das receitas administradas pela RFB por
   município" (XLSX). The main file's `TOTAL` sheet is the whole federal
   collection; three component files break it down by tax: the
   *previdenciária* file (INSS), the *IR* file and the *IPI* file.
2. **Tesouro Nacional** (CKAN, "Transferências Constitucionais para
   Municípios"): monthly CSVs (latin1, `;`) with FPM, FUNDEB, ITR, CIDE and
   the rest.
3. **Portal da Transparência**, "Emendas Parlamentares" (bulk ZIP, latin1),
   file `EmendasParlamentares_PorFavorecido.csv`: money actually *received*,
   attributed to the favorecido's município and filtered by payment date.

```
receita:  https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/dados-abertos/receitadata/arrecadacao/...
tesouro:  https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=transferencias-constitucionais-para-municipios
emendas:  https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO
```

**Processing** (`apps/web/scripts/build-fiscal.mjs`, `pnpm fiscal`; downloads
are cached in `apps/web/scripts/.cache-fiscal`, which is gitignored). Output
tuples in whole BRL:

```
{ referenceYear, sources,
  municipios: [[codigo, arrecadacao, previdencia, ir, ipi,
                transferencias, fpm, fundeb, emendas], ...] }
```

5,570 municípios, **422 KB**, loaded on demand alongside the demographic
dataset. 2025 totals for the committed file: arrecadação R$ 2,757.1 bi
(previdência 723.1, IR 914.6, IPI 86.3), transferências R$ 500.5 bi (FPM
170.1, FUNDEB 261.5) and emendas R$ 43.3 bi.

**Caveats worth knowing before trusting a single município's number:**

- **Matching is by normalized name + UF**, because none of the three sources
  publishes the IBGE code. Rows that fail to match are dropped and the script
  reports the ignored volume.
- **Collection is booked where the taxpayer pays**, not where the economic
  activity happened: headquarters concentrate collection in a few capitals
  (São Paulo alone books R$ 557 bi). This is a property of the source, not a
  bug in the join.
- **Previdência comes from the dedicated file, not the GPS sheet**: since 2021
  most of the social-security take is paid via DARF, so the main file's GPS
  sheet alone would understate it by roughly 50x.
- **Two segments are derived on the front, not stored**: "demais tributos"
  (arrecadação minus previdência, IR and IPI) and "outras transferências"
  (transferências minus FPM and FUNDEB). The builder clamps the components so
  neither derived slice can go negative.
- **Emendas use the favorecido file** because ~96% of 2025 empenhos in the main
  file carry no município (MÚLTIPLO / Nacional / UF), which makes the
  favorecido payments the only usable municipal signal.

**Role:** factual context, like the IBGE indicators. These are public figures
about territories, not claims about power holders, so the content-safety rule
(ARCHITECTURE.md section 5) is untouched.

## Foreign-trade flows (`apps/web/public/data/comercio/mundo.json`)

Real Brazilian exports/imports per partner country and economic sector,
powering the world trade arrows of the Visão Global (Brazil -> partner links,
one per partner by default, exploded into per-sector arrows when a country is
clicked). Reference year **2025**, values in whole **US$ FOB**.

**Source (public, open data, no API key):** Comex Stat / MDIC, "Base de dados
bruta" by NCM. Docs:
<https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/base-de-dados-bruta>

**Endpoints used (downloaded 2026-08-01):**

```
exp:     https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/EXP_2025.csv
imp:     https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/IMP_2025.csv
paises:  https://balanca.economia.gov.br/balanca/bd/tabelas/PAIS.csv
setores: https://balanca.economia.gov.br/balanca/bd/tabelas/NCM_SH.csv
```

The two annual files are NCM-detailed (`;`-separated, latin1, layout
`CO_ANO;CO_MES;CO_NCM;CO_UNID;CO_PAIS;SG_UF_NCM;CO_VIA;CO_URF;QT_ESTAT;`
`KG_LIQUIDO;VL_FOB`, `VL_FOB` in US$). `PAIS.csv` maps `CO_PAIS` to the ISO
alpha-3 code (`CO_PAIS_ISOA3`); `NCM_SH.csv` maps `CO_SH6` to the HS chapter
(`CO_SH2` + `NO_SH2_POR`), which is the "sector".

**Processing** (`apps/web/scripts/fetch-comercio.mjs`, `pnpm comercio`;
downloads cached in `apps/web/scripts/.cache-comercio`, gitignored): both files
are streamed line by line and `VL_FOB` is summed by partner (ISO) × sector (the
NCM's first two digits = HS chapter). Partners are joined to the world backdrop
by ISO alpha-3 and anchored at the country centroid (vertex average of the
largest ring, like `build-demografia.mjs`). Output tuples:

```
{ referenceYear, currency: 'USD', source, totals: { exp, imp },
  sectors: { <chapter>: <label> },
  partners: [[iso, name, lon, lat, exp, imp,
              [[chapter, exp, imp], ...]], ...] }
```

Each partner keeps its top 12 sectors; the rest fold into an "Outros" bucket
('ZZ') so the sector list reconciles to the partner total. **171 partners, 84
sectors, ~55 KB**, fetched once when the trade arrows first show.

**2025 totals for the committed file:** exportações **US$ 348.3 bi**,
importações **US$ 280.2 bi**. Country coverage is 99.3% (exp) / 99.7% (imp);
the remainder is trade booked to codes with no ISO ("não definido", consumo de
bordo) or to partners without a polygon in the 1:110m world mesh. A short
manual-centroid override (Singapura, Hong Kong) keeps a few notable small
partners on the map.

**Caveats worth knowing:**

- **Sector = HS chapter (2-digit).** "Soja e oleaginosas" is chapter 12, so
  soybean meal (ch. 23) and soy oil (ch. 15) count as separate sectors; the
  labels name the chapter, not a marketing "complexo soja".
- **balanca.economia.gov.br ships an incomplete TLS chain**, so the build
  script relaxes certificate verification for its own downloads only — never in
  the shipped app.

**Role:** factual context, like the IBGE indicators and the fiscal flows. These
are public figures about trade between countries, not claims about power
holders, so the content-safety rule (ARCHITECTURE.md section 5) is untouched.

## State trade vocation (`apps/web/public/data/comercio/uf.json`)

**Source:** none of its own. Same `pnpm comercio` run that builds `mundo.json`,
using the **`SG_UF_NCM`** column of the Comex files (the origin/destination UF of
the goods) that the partner aggregation ignores. One extra pass over the same
cached CSVs, so it costs no new download.

For each of the 27 UFs it keeps the top 10 sectors (the state's "vocação") and,
per sector, the top 6 partner countries, anchored at the UF centroid (largest
ring vertex average of `brazil-states.geojson`):

```
{ referenceYear, currency: 'USD', source, sectors: { <chapter>: <label> },
  ufs: [[uf, lon, lat, exp, imp,
         [[chapter, exp, imp, [[iso, exp, imp], ...]], ...]], ...] }
```

**27 UFs, ~44 KB.** Drives the state specialty labels and lets the world trade
arrows land on the state that specializes in a sector (soja → MT/PR, minério →
PA, aeronaves/máquinas → SP) instead of the map center. Export vocation is the
honest "what the state produces" signal; the file keeps both directions so the
front ranks by whichever arrow direction is active.

## Municipal vocation (`apps/web/public/data/vocacao/municipios.json`)

Each município's economic vocation, from the **valor adicionado bruto (VAB)** by
activity in the PIB dos Municípios. Powers the per-município specialty and the 3D
sector objects.

**Source (factual, IBGE Agregados v3, agregado 5938):** VAB agropecuária (513),
indústria (517), serviços exclusive adm. pública (6575), adm./defesa/educação/
saúde públicas (525) and VAB total (498), all in mil R$.

**Year — 2021, not 2023.** The headline PIB total is published through 2023, but
the VAB-*by-activity* split lags: 2022 and 2023 come back suppressed (`"..."`)
for every município. 2021 is the latest year with full 5.570/5.570 coverage.

**Processing** (`apps/web/scripts/fetch-vocacao.mjs`, `pnpm vocacao`): one
`N6[all]` call; shares are integer percent of the VAB total; the national
`baseline` (each sector's share of the whole country's VAB) rides along so the
front can compute a **location quotient** (`share ÷ baseline`), the honest way to
name a vocation. Dominant-by-absolute-VAB mislabels agribusiness towns (Sorriso
books more VAB in serviços than agro), but its agro location quotient is ~4.9, so
the QL correctly calls it agro-specialized, and a município can carry more than
one specialty.

```
{ referenceYear: 2021, source, sectors: { agro, ind, serv, adm },
  baseline: { agro, ind, serv, adm },       // national %; QL denominator
  municipios: [[codigo, vabTotalMilReais, agro%, ind%, serv%, adm%], ...] }
```

**5.569 municípios, ~164 KB.** National baseline: agro 7.7 · indústria 25.9 ·
serviços 50.7 · adm. pública 15.8 (%). **Granularity caveat:** VAB splits only
four ways, so it says "agro" but not soja-vs-boi, "indústria" but not
metalurgia-vs-têxtil. The finer split would need PAM/PPM (produção agrícola/
pecuária municipal) or a projection of the Comex UF sectors; the state `uf.json`
already carries that finer HS-chapter detail at UF level.

**Role:** factual context, like the other IBGE indicators. Not the power
rankings (ARCHITECTURE.md section 5).

## Rankings / entities (`apps/web/src/data/mock/*.json`)

Hand-written **fictional placeholder data for UI development only** — every
"hidden power" entity is invented (Greek-letter naming pattern), every score
is a dummy value, and official entries reference generic constitutional
offices without naming officeholders. See ARCHITECTURE.md §5. Not derived
from any real-world source.

## State capital coordinates

Hard-coded `[lon, lat]` pairs in the mock region files (~2–4 decimal
precision), used only as anchors for the deck.gl column/arc layers.

## Fine agro vocation (`public/data/vocacao/agro-municipios.json`)

Built by `pnpm agro` (`scripts/fetch-agro.mjs`) from two IBGE municipal
surveys, latest published year (resolved from the aggregate metadata at fetch
time, currently 2024):

- **PAM** (Producao Agricola Municipal, agregado 5457, variavel "Valor da
  producao", mil R$): soja (em grao) and cafe (em grao) total. Product ids
  are resolved BY NAME from the metadata, never hardcoded, so an IBGE recode
  fails loudly instead of poisoning the payload.
- **PPM** (Pesquisa da Pecuaria Municipal, agregado 3939, variavel "Efetivo
  dos rebanhos", cabecas): bovino.

The payload keeps absolute values plus the national totals. The front decides
a municipality's dominant commodity by its share of the NATIONAL total of
each commodity (mil R$ and cabecas become comparable, dimensionless), with a
floor (`AGRO_SHARE_FLOOR`); below it the generic silo stands. "Forest"
municipalities are NOT in this file: the Amazonia Legal rule is pure
geography (the 8 full member UFs plus Maranhao west of the 44W meridian,
decided by municipal centroid).

**Caveats:** value of production follows PRICES, so a price spike (cafe in
2024) inflates a crop's weight; herd head-counts are stocks, not slaughter
value. Both are honest, published figures; the icon only claims "this is the
municipality's strongest commodity presence nationally".

**Role:** factual context for the vocation icons. Not the power rankings
(ARCHITECTURE.md section 5).
