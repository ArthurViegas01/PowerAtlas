# Data sources

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

## World countries backdrop (`apps/web/public/geo/world-countries.geojson`)

**Source:** Natural Earth, 1:110m Cultural Vectors — Admin 0 Countries
(public domain). Downloaded 2026-07-15 from the project's official GitHub
mirror:

```
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
```

**Role:** dim, dashed "em breve" backdrop only — countries outside Brazil are
rendered as a not-yet-mapped zone and are not part of the product data. IBGE
remains the authoritative source for everything Brazil. Natural Earth's own
Brazil polygon is **removed** so the IBGE layers never fight it (small
gaps along land borders read as the national glow margin by design);
Antarctica is removed as visual clutter.

**Processing** (same `pnpm geo` script): coordinate precision trimmed to
0.01° (~1 km — the 110m mesh is already coarse), properties slimmed to
`{ iso, name }` where `iso` = NE `ADM0_A3` and `name` prefers the
`NAME_PT` Portuguese localization. Result: 175 countries, **155 KB**
(budget 400 KB).

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

## Rankings / entities (`apps/web/src/data/mock/*.json`)

Hand-written **fictional placeholder data for UI development only** — every
"hidden power" entity is invented (Greek-letter naming pattern), every score
is a dummy value, and official entries reference generic constitutional
offices without naming officeholders. See ARCHITECTURE.md §5. Not derived
from any real-world source.

## State capital coordinates

Hard-coded `[lon, lat]` pairs in the mock region files (~2–4 decimal
precision), used only as anchors for the deck.gl column/arc layers.
