# Data console (/dados)

A second screen next to the map HUD, for seeing and controlling the data the
project manages instead of the geography. Reached from the map header
("CONSOLE DE DADOS") or directly at `/dados`. Companion to
[data-sources.md](data-sources.md) (where each dataset comes from) and
[map-layers.md](map-layers.md) (the other screen).

## What it shows

The dataset selector groups the tabs by theme (TERRITORIAIS · ECONÔMICOS ·
SIMULADO · IMPORTADOS · SISTEMA) over a KPI row, a set of SVG charts and a
sortable, searchable, paginated table. Every dataset renders the same way, so a
new source (including an imported CSV) gets the full treatment for free.

| Group | Dataset | Source | Notes |
| --- | --- | --- | --- |
| TERRITORIAIS | INDICADORES IBGE | `indicators` store (uf.json) | 28 regions: population, area, density, PIB |
| TERRITORIAIS | INDICADORES MUNICÍPIO | `indicatorsMunicipios` store (municipios-all.json) | 5.570 municípios: population, area, density, PIB (lazy) |
| TERRITORIAIS | DEMOGRAFIA | `demografia` store | 5.570 municípios: centroid, population, PIB |
| ECONÔMICOS | FLUXO FISCAL | `fiscal` store | 5.570 municípios: federal collection, transfers, amendments |
| ECONÔMICOS | COMÉRCIO EXTERIOR | `comercio` store | Exports/imports per partner country (US$ FOB) |
| SIMULADO | RANKINGS (FICTÍCIO) | `rankings` store | The fictional influence entities, clearly banner-flagged |
| IMPORTADOS | (imported) | `datasets` API | Operator-uploaded CSVs, isolated namespace |
| SISTEMA | CATÁLOGO | `catalog` store (catalog.json) | The warehouse star schema: tables, columns, join keys |
| SISTEMA | PIPELINE + BANCO | `stats` + `monitoring` (API) | Backend observability, only when a backend is connected |

The factual datasets are read straight from the Pinia stores the map already
populates: the console never re-fetches them. The município-level indicators, the
catalog and the imported/pipeline datasets are loaded on demand from
`public/data` (compiled from the warehouse) or the API.

`INDICADORES MUNICÍPIO`, `COMÉRCIO` and `CATÁLOGO` are compiled from the CSV
warehouse (`pnpm compile-web`, see [warehouse.md](warehouse.md)): the console and
Power BI read the same source.

## Charts

`lib/datasetCharts.ts` derives a chart set from a dataset's column metadata
(the first numeric column is the headline metric, the first text column labels
rows), so the same engine drives the built-in and the imported datasets:

- **Bar**: top 12 by the headline metric.
- **Histogram**: distribution, with an automatic linear/log toggle for
  heavy-tailed metrics (fiscal, PIB).
- **Scatter**: the headline metric against another numeric column, log axes
  when heavy-tailed, sampled to keep the DOM light.
- **Line**: concentration curve (e.g. "top 0,1% dos municípios concentram
  metade da arrecadação").
- **Correlation heatmap**: Pearson across every numeric column.

All charts are hand-rolled SVG/CSS (no charting library), colored from the
`--pa-*` tokens, with `<title>` tooltips and entry animation gated by
`prefers-reduced-motion`. The math lives in `lib/stats.ts` (tested).

## Pipeline + banco panel

Read-only observability of the backend, shown only when `VITE_API_URL` points
at an API with a database. Served-table counts (regions, entities, ambient
signals, links), pipeline counts (documents, sources, candidates), documents
by source and by day, and the latest ingested headlines. Fed by
`GET /api/v1/stats` and the existing monitoring feed. Provenance and volume
only, never scores.

## Import and export

**Export** is client-side for every dataset: the "EXPORTAR CSV / JSON" buttons
serialize the current dataset (`lib/csv.ts`) and download it. Raw values, so a
re-import round-trips.

**Import** (the "+ IMPORTAR" chip, shown only to a logged-in admin) opens a
dialog: pick a CSV, preview the inferred columns and first rows, name it,
confirm. The file is parsed in the browser (`parseCsvDataset`, which infers
per-column types) and posted to the API with the admin bearer token, which
stores it in the isolated `datasets` namespace. Imported datasets then appear as
chips and can be removed (also admin-only).

### Admin authentication (only the operator can alter data)

Writes require a real admin session. The API enables writes only when
`PA_ADMIN_PASSWORD` is set; the console's "ENTRAR (ADMIN)" login exchanges the
password for a stateless, expiring bearer token (`POST /api/v1/auth/login`),
stored in `sessionStorage`, and every import/delete then carries it. The API
rejects any write without a valid token (401), so the guarantee is server-side:
a public deploy with no admin password is read-only for everyone, and the login
UI only appears when a write-capable backend is connected. See
[../apps/api/README.md](../apps/api/README.md) and core/auth.py.

### Safety boundary (content-safety rule)

Import writes **only** to `datasets` / `dataset_rows` (migration 0003), a
namespace with no relationship to the served power-entity tables. It can never
reach the public power-data payload: an integration test asserts
`GET /api/v1/power-data` is byte-identical before and after an import. This keeps
the fictional-only rule of ARCHITECTURE.md section 5 intact.

## Routing

`vue-router` (history mode) with two routes: `/` (the map HUD, `MapScreen.vue`)
and `/dados` (`DataConsoleScreen.vue`, lazy-loaded into its own chunk). Pinia
stores live above the router, so map state survives a trip to the console and
back. Production hosting needs the SPA fallback (see `netlify.toml`) so a hard
reload on `/dados` resolves.
