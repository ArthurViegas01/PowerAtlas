# PowerAtlas — Architecture

> Interactive map ranking each Brazilian region's **official** power holders
> against its **hidden/real** influence holders, presented as a tactical-HUD
> interface. This document captures the Phase 1 architecture, the rationale
> for each choice, deviations from the initial plan, and what is deliberately
> deferred.

## 1. High-level topology (Phase 1 — frontend only)

```
+----------------------------------------------------------------------+
|  apps/web — Vite + Vue 3 + TypeScript (static build, no backend)     |
|                                                                      |
|  Pinia stores                                                        |
|    selection   <- click/hover state from deck.gl picking             |
|    rankings    <- services/mockDataLoader  (Phase 2: apiClient)      |
|    mapLayers   <- derives a plain deck.gl "layer model" from both    |
|                                                                      |
|  MapLibre GL JS (camera, minimal dark style)                         |
|    + deck.gl MapboxOverlay                                           |
|        GeoJsonLayer   state choropleth + national outline + picking  |
|        ColumnLayer    3D twin extrusions at state capitals           |
|        ArcLayer       cross-region influence links                   |
|        HeatmapLayer   ambient activity while nothing is selected     |
|                                                                      |
|  GSAP choreography (panel stagger, counters, scan sweep)             |
|    all gated by useReducedMotion()                                   |
+----------------------------------------------------------------------+
        |                                        |
        v                                        v
  public/geo/*.geojson                    src/data/mock/*.json
  IBGE malhas, simplified                 fictional placeholder data
  (docs/data-sources.md)                  (see §5 content-safety)
```

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

### 2.5 Mock data is shaped as the future API contract

`src/types/power-entity.ts` (PowerRegion, PowerEntity, SourceCitation,
ConfidenceLevel, ReviewStatus) is the exact JSON shape the Phase 2 FastAPI
will serve. `services/mockDataLoader.ts` has the same async signature a
future `apiClient.ts` will have, so the swap is a one-file change.
`status`/`confidence`/`sources` exist on every entity *now* because the
Phase 2 review workflow (draft → single-admin approval → published) needs
them; the UI already renders draft entities distinctly to prove the seam.

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

## 6. Deferred to Phase 2+ (noted, deliberately not designed here)

- **FastAPI backend** (Python — chosen over Node to deepen FastAPI skills
  and for the NLP ecosystem), mirroring ZapAgent's `src/` +
  `pyproject.toml` (ruff/mypy/pytest) conventions, serving the §4 contract.
- **PostgreSQL + PostGIS** for regions/entities/scores.
- **Celery + Redis + pgvector**: news scraping → embedding → LLM scoring
  pipeline for the "hidden power" indices.
- **Review workflow**: draft/published gate, single admin approver, every
  AI-derived score requires a source citation before publish.
- **docker-compose.yml / infra Terraform** — nothing to containerize until
  the API and Postgres exist.
- **Full data coverage**: all 27 UFs + richer national layer (mock covers
  BR + 5 sample states on purpose).
