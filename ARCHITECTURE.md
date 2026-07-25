# PowerAtlas — Architecture

> Interactive map ranking each Brazilian region's **official** power holders
> against its **hidden/real** influence holders, presented as a tactical-HUD
> interface. This document captures the Phase 1 architecture, the rationale
> for each choice, deviations from the initial plan, and what is deliberately
> deferred.

## 1. High-level topology

```
+----------------------------------------------------------------------+
|  apps/web  ·  Vite + Vue 3 + TypeScript (static build)               |
|                                                                      |
|  Pinia stores                                                        |
|    selection   <- click/hover state from deck.gl picking, view mode  |
|    rankings    <- services/dataSource (mock JSON or API, VITE_API_URL)|
|    mapLayers   <- plain deck.gl "layer model" + lazy municipal meshes |
|    indicators  <- IBGE population/area/density/PIB (static JSON)     |
|    demografia  <- centroid + pop + PIB of the 5.570 municipios       |
|    fiscal      <- federal collection, transfers and amendments       |
|    monitoring  <- ingested headlines from the API (F5b)              |
|                                                                      |
|  MapLibre GL JS (camera, minimal dark style)                         |
|    + deck.gl MapboxOverlay  ->  src/lib/deckLayers.ts (pure factory) |
|        world backdrop · state choropleth · municipal mesh            |
|        capital columns · demographic columns · fiscal bands + arcs   |
|        boundary relief walls · ambient heatmap · labels              |
|        (full stack and view modes: docs/map-layers.md)               |
|                                                                      |
|  GSAP choreography (panel stagger, counters, scan sweep)             |
|    all gated by useReducedMotion()                                   |
+----------------------------------------------------------------------+
     |                    |                          |
     v                    v                          v
 public/geo/*        public/data/*            apps/api (FastAPI)
 IBGE malhas +       IBGE indicators,         GET /api/v1/power-data
 Natural Earth       demografia, fiscal       GET /api/v1/monitoring/*
 (docs/data-sources.md)                              |
                                                     v
                                        Postgres + PostGIS + pgvector
                                        (db/migrations, raw asyncpg)
                                                     ^
                                                     |
                                        Celery worker + Redis (F5)
                                        RSS ingestion -> raw_documents

 src/data/mock/*.json  ·  fictional placeholder rankings (see §5)
```

The API is optional: without `VITE_API_URL` the web runs fully offline on the
bundled mock, and without `PA_DATABASE_URL` the API itself serves that same
mock. The payload is byte-identical along every path.

## 2. Key decisions

### 2.1 MapLibre GL JS + deck.gl, not MapLibre alone

The reference look (glowing arcs, volumetric column extrusions, ambient
density) needs instanced WebGL layers. MapLibre alone renders choropleths
fine but has no ArcLayer/ColumnLayer/HeatmapLayer equivalents at the needed
density. deck.gl rides on top via `MapboxOverlay` (`@deck.gl/mapbox`), which
implements MapLibre's `IControl` — one camera, two renderers. All
`@deck.gl/*` subpackages are released in lockstep and must stay on the same
minor.

### 2.2 GSAP, not anime.js

Timeline-based choreography (staggered panel entrances, counter tweens,
scan sweeps) with pause/kill semantics and no framework coupling. Motion is
a presentation concern: components call composables (`useGsapReveal`,
`useAnimatedCounter`) that no-op under `prefers-reduced-motion`.

### 2.3 Design tokens as CSS custom properties, consumed everywhere

`src/styles/tokens.css` is the single source of truth (backgrounds, cyan
"official" / amber "hidden" series colors, confidence colors, type scale,
easing/durations). Three consumers, zero duplication:

1. Hand-written component CSS uses `var(--pa-*)` directly.
2. Tailwind v4 maps them to utilities via `@theme inline` (see §3.1).
3. deck.gl reads them at runtime with `getComputedStyle`
   (`src/lib/palette.ts`), so WebGL layer colors cannot drift from the
   stylesheet.

### 2.4 IBGE malha territorial as the boundary source

For a product whose pitch depends on base-map credibility, Brazil boundaries
come from IBGE's official malhas API (public domain, authoritative),
not Natural Earth/geoBoundaries. Files are simplified with mapshaper to
budget (<200 KB national, <500 KB states) and re-fetchable via
`pnpm geo` (`apps/web/scripts/fetch-geo.mjs`). Provenance, exact endpoints,
date and commands: [docs/data-sources.md](docs/data-sources.md).

The **world backdrop** (F2) is the one place Natural Earth *is* used: the
110m admin-0 mesh renders every other country as a dim, dashed
"não mapeado / em breve" zone — visible, hoverable and clickable (a locked
"área bloqueada" panel), but carrying no product data. Its Brazil polygon is
removed so it never fights the IBGE layers, and precision there is
irrelevant by construction. Coverage of new countries later means promoting
them out of this layer, not restyling it.

### 2.5 Factual IBGE indicators as static files, outside the power contract

Real public statistics (Censo 2022 population/area/density, PIB dos
Municípios 2023) ship as static JSON under `public/data/indicators/`,
generated by `scripts/fetch-indicators.mjs` (`pnpm indicators`): the same
pattern as the boundary meshes (script + committed output + provenance in
docs/data-sources.md). They are context data for panels and tooltips,
deliberately NOT added to the frozen power-entity contract (§4), so the API
and DB payloads stay byte-identical to the mock. The content-safety rule
(§5) is untouched: these are official statistics about territories, not
claims about power holders, and the UI labels the block with its source
("IBGE · CENSO 2022 · PIB 2023"). When F5 makes the API the data owner,
this can move behind an endpoint without changing the UI seam (the
indicators store mirrors the mapLayers lazy-load pattern).

### 2.6 Mock data is shaped as the future API contract

`src/types/power-entity.ts` (PowerRegion, PowerEntity, SourceCitation,
ConfidenceLevel, ReviewStatus) is the exact JSON shape the FastAPI backend
serves. The seam paid off in F3: `services/dataSource.ts` picks
`apiClient.ts` (same async signature as `mockDataLoader.ts`) when
`VITE_API_URL` is set, and nothing else in the app changed.
`status`/`confidence`/`sources` exist on every entity *now* because the
Phase 2 review workflow (draft → single-admin approval → published) needs
them; the UI already renders draft entities distinctly to prove the seam.

### 2.7 The demographic view is a separate read-only mode, not a layer toggle

Population/PIB columns per município and the influence HUD compete for the
same screen: both want the whole country, both want the camera, and both want
clicks. Rather than layering them, the demographic view is a **mode** on the
selection store (`demographicView`) that disables region selection entirely
and swaps the layer set, the legend and the side menu. Two consequences worth
knowing: Esc walks back through the mode's own levels before leaving it (city
card, UF crop, then the view), and the mode owns its palette (`--pa-demo-*`)
so nothing about it can be confused with the cyan/amber influence series.

Column heights use the **square root** of the metric. Linear heights make São
Paulo a needle and flatten the other 5,569 municípios into the ground plane.

### 2.8 Fiscal flows as a built dataset, matched by name

The fiscal overlay needs three federal sources (Receita Federal, Tesouro
Nacional, Portal da Transparência) that publish incompatible spreadsheets,
none of them keyed by IBGE code. `scripts/build-fiscal.mjs` does the join
**offline, once**, and commits a 422 KB tuple file: the same script + output +
provenance pattern as the meshes (§2.4) and the indicators (§2.5), for the
same reason (the browser must never do this work, and the numbers must be
reviewable in a diff).

Matching is by normalized name + UF because the sources give nothing better;
unmatched rows are dropped and the script reports the ignored volume. Two
segments ("demais tributos", "outras transferências") are **derived on the
front** from the stored components instead of being stored, so a value can
never contradict its own total. Like the IBGE indicators, this data sits
outside the frozen power-entity contract (§4) and is factual context about
territories, not a claim about power holders (§5). Caveats that matter when
reading a single município's number: docs/data-sources.md.

## 3. Deviations from the initial plan

### 3.1 Tailwind CSS v4 (CSS-first) instead of `tailwind.config.ts`

**Original plan:** `tailwind.config.ts` reading the token variable names
(the Tailwind v3 pattern).

**Decision:** Tailwind v4 does exactly this natively: `@theme inline` in
`src/styles/main.css` maps `--pa-*` custom properties to utility tokens, and
the first-party `@tailwindcss/vite` plugin replaces the PostCSS setup. Same
single-source-of-truth goal, one config file fewer, current major version.

### 3.2 GNU make unavailable on the primary dev machine

The house-convention `Makefile` exists, but this Windows machine has no
`make` on PATH, so the root `package.json` mirrors every target as a pnpm
script (`pnpm dev`, `pnpm build`, `pnpm geo`, …). Both stay in sync.

## 4. Data contract (Phase 1 == Phase 2)

- **PowerRegion** — `id` (`"BR"` or UF sigla, joins to the GeoJSON `UF`
  property), `name`, `kind` (`country|state`), `capital` (name +
  `[lon, lat]`, drives ColumnLayer), `updatedAt`, `official[]`, `hidden[]`.
- **PowerEntity** — `id`, `name`, `kind` (office/institution/organization/
  faction/movement/economic-bloc), `dimension` (`official|hidden`), `score`
  0–100, `delta`, `confidence` (`high|medium|low`), `status`
  (`draft|published`), `sources[]`, `note`.
- **SourceCitation** — `id`, `label`, optional `url`/`publishedAt`/`note`.
- **InfluenceLink** — directed region-to-region link with `strength` 0–1 and
  `dimension` (drives ArcLayer).
- **AmbientSignal** — `[lon, lat]` + weight (drives HeatmapLayer).

## 5. Content-safety constraint (why the mock data is fictional)

The product will eventually rank real, named people and organizations
(including political parties and criminal factions) by "hidden power". That
is only credible — and only safe to publish — when every AI-generated claim
carries a visible source and passed human review. Phase 1 has neither
pipeline nor review gate, therefore **the placeholder dataset uses fictional
generic entities only** ("Instituição Federal Alpha" pattern) and official
entries reference generic constitutional offices ("Chefia do Executivo
Estadual") without naming or scoring any real officeholder. The UI carries a
permanent simulated-data banner. This rule holds until the Phase 2 review
workflow exists.

## 6. Deferred to future phases (F5+) — noted, deliberately not designed here

**Shipped in F3:** the **read-only FastAPI backend** (`apps/api`) serves the
§4 contract over HTTP (`GET /api/v1/power-data`), mirroring Encaixe's `src/`
+ `pyproject.toml` (ruff/mypy/pytest) conventions. Python was chosen over Node
to deepen FastAPI skills and for the NLP ecosystem the scoring pipeline will
need. The web selects it via `VITE_API_URL` and falls back to the bundled mock
otherwise.

**Shipped in F4:** **PostgreSQL + PostGIS** persistence. Plain-SQL migrations
in `db/migrations` (tracked in `schema_migrations`, no ORM/Alembic), PostGIS
point geometries (EPSG:4326) for capitals and ambient signals, a seed from the
fictional dataset, and `docker-compose.yml` (postgres + api). The **data-access
decision**, recorded at the start of the phase, is **raw asyncpg** (pool +
`conn.fetch`), mirroring the Encaixe runtime rather than an ORM; `real` columns
would drift, so weights/strengths are `double precision` to keep the payload
byte-identical to the mock. The API reads from the DB when `PA_DATABASE_URL` is
set and from the mock JSON otherwise, so unit tests and offline dev need no
Postgres (DB tests are opt-in, `-m integration`).

**Shipped in F5a/F5b:** the **pipeline infrastructure**. Celery + Redis
(`src/worker/`), a custom database image carrying PostGIS *and* pgvector
(`db/Dockerfile`), migration `0002_pipeline.sql` (ingest allowlist, deduped
`raw_documents`, `doc_chunks` with an HNSW index, `scoring_runs`,
`entity_candidates`, `candidate_citations`), and RSS ingestion from
allowlisted institutional feeds (`src/ingest/`, `pnpm pipeline-ingest`),
surfaced by the monitoring endpoint and the HUD's MONITORAMENTO panel.

The safety property is enforced **in the database**, not just in code:
`entity_candidates` carries `CHECK (status = 'draft')`, so the pipeline
physically cannot write into the served tables. A parity test asserts the
`power-data` payload is byte-identical before and after a pipeline run.

Still deferred:

- **F5c: embeddings + LLM scoring** (`doc_chunks` -> `entity_candidates` with
  mandatory citations). **Paused deliberately** to avoid AI API costs; free
  local alternatives (fastembed/ONNX embeddings, a heuristic "scoring v0" with
  no LLM) are noted in PLAN.md section 3 for whenever it resumes.
- **Review workflow (F6)**: draft/published gate, single admin approver, every
  AI-derived score requires a source citation before publish.
- **Writes + auth**: the API is read-only; no mutation endpoints or auth yet.
- **infra Terraform**: deferred; `docker-compose.yml` covers local infra.
- **Municipal rankings**: the municipal panel is factual-only until the
  pipeline can produce scored entities.
