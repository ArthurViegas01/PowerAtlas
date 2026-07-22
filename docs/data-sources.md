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

## Rankings / entities (`apps/web/src/data/mock/*.json`)

Hand-written **fictional placeholder data for UI development only** — every
"hidden power" entity is invented (Greek-letter naming pattern), every score
is a dummy value, and official entries reference generic constitutional
offices without naming officeholders. See ARCHITECTURE.md §5. Not derived
from any real-world source.

## State capital coordinates

Hard-coded `[lon, lat]` pairs in the mock region files (~2–4 decimal
precision), used only as anchors for the deck.gl column/arc layers.
