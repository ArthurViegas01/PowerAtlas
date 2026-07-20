# PowerAtlas

Interactive power-mapping HUD for Brazil: for each region (national + states),
an **official power** ranking (constitutional offices) rendered side by side
with a **hidden / real influence** ranking (institutions, organizations,
factions), on top of a tactical-HUD map interface (dark, cyan/amber,
scanlines, corner brackets, monospace readouts).

> **Phase 1 status: UI prototype with simulated data.** Every "hidden power"
> entity in this repository is **fictional** (e.g. "Instituição Federal
> Alpha") and every score is a placeholder. Nothing here is a claim about any
> real person or organization. The real data pipeline — with visible sources
> and mandatory human review before anything is published — is Phase 2+.
> The UI keeps a permanent "simulated data" banner for this reason.

## Status

**F1 — Brazil HUD over mock data: shipped 2026-07-15.** Full HUD shell,
MapLibre + deck.gl layers (state choropleth, twin capital columns, influence
arcs, ambient heatmap), GSAP choreography with reduced-motion gating, IBGE
boundary pipeline, fictional dataset.

**F2 — "coming soon" world backdrop: shipped 2026-07-15 (v0.2.0).** Natural
Earth world layer rendered as a locked, not-yet-mapped zone (dim fill +
dashed borders), global view button and the "área bloqueada" panel.

**v0.3.0 (frontend track).** Map rotation compass (`MapCompass.vue`: turn
±15°, snap to north, bearing readout, AUTO button, manual-bearing override
of the cinematic cameras) plus static deploy on Netlify (`netlify.toml`).

**F3 — read-only FastAPI backend: shipped (v0.4.0).** `apps/api` serves the exact
`power-entity` contract over HTTP (`GET /api/v1/power-data`); the web swaps
its mock loader for the API when `VITE_API_URL` is set and stays fully
offline on the bundled mock otherwise. Details:
[apps/api/README.md](apps/api/README.md).

**F4 — Postgres + PostGIS persistence: shipped (v0.5.0).** SQL migrations in
`db/migrations`, PostGIS point geometries for capitals and ambient signals,
a seed from the fictional dataset, and the API reading from the database via
raw asyncpg (`docker compose up postgres`). The payload is byte-identical
whether served from the DB or the mock. No auth or writes yet.

**Frontend track: v0.6.0.** Bundle code-splitting (app shell ~104 kB, heavy
WebGL libs in their own chunks), fictional rankings for all 27 UFs (every
state opens a panel), and a vitest suite over the Pinia stores and motion
composables (`pnpm test`).

**Polish: v0.7.0.** State sigla labels on the map (deck.gl `TextLayer`),
corrected empty-region copy, plus an audit confirming the mobile layout and
the `prefers-reduced-motion` gating (global CSS kill-switch + JS composables)
were already solid.

Deviations from the original plans: [ARCHITECTURE.md](ARCHITECTURE.md) §3
and [docs/data-sources.md](docs/data-sources.md). Next phases (scoring
pipeline, review workflow): ARCHITECTURE.md §6.

## Stack (Phase 1)

- Vue 3 + TypeScript + Vite, Pinia for state
- MapLibre GL JS base map + deck.gl overlay (choropleth, 3D columns at state
  capitals, influence arcs, ambient heatmap)
- GSAP for HUD choreography — all motion gated behind `prefers-reduced-motion`
- Tailwind CSS v4 layered over hand-written design tokens
  (`apps/web/src/styles/tokens.css`)
- Self-hosted Fira Code / Fira Sans (no font CDN)
- Boundaries: IBGE malha territorial, simplified — see `docs/data-sources.md`
- World backdrop: Natural Earth 110m rendered as a dim, dashed
  "em breve" zone — the whole globe is visible, but only Brazil is mapped
  for now

## Getting started

Requires Node >= 22 and pnpm >= 10 (`npm i -g pnpm`).

```sh
pnpm install
pnpm dev        # Vite dev server on http://localhost:5173
pnpm build      # vue-tsc type-check + production build
pnpm preview    # serve the production build on http://localhost:4173
pnpm test       # vitest (stores + composables)
pnpm geo        # re-fetch + simplify IBGE boundaries (needs network)
```

Equivalent `make web-*` targets exist in the Makefile for machines with GNU
make installed.

### API (F3/F4)

Requires Python >= 3.11 (and Docker for the F4 database). From the repository
root:

```sh
pnpm api-install    # create apps/api/.venv and install deps
pnpm api-dev        # uvicorn --reload on http://localhost:8000 (mock mode)
pnpm api-test       # pytest (DB tests are opt-in: -m integration)
pnpm api-lint       # ruff + mypy

# F4 database (PostGIS via Docker):
pnpm db-up          # start postgres
pnpm db-migrate     # apply SQL migrations
pnpm db-seed        # seed from the fictional dataset
pnpm api-dev-db     # uvicorn against the database
```

Point the web at it with `VITE_API_URL=http://localhost:8000`
(`apps/web/.env.example`); leave it unset to run offline on the mock.
More: [apps/api/README.md](apps/api/README.md).

Dev tip: `http://localhost:5173/?region=SP` deep-links straight into a
region's ranking panel (any UF sigla or `BR`).

### Development notes

- deck.gl subpackages (`core`, `layers`, `aggregation-layers`, `mapbox`) are
  released in lockstep — always upgrade them to the same minor together, or
  picking/rendering breaks subtly.
- Vite binds all interfaces (`server.host: true`); rationale in the comment
  in `apps/web/vite.config.ts` (IPv6-only localhost binding breaks IPv4
  clients).
- Adding or editing mock data? The fictional-entities-only content-safety
  rule (ARCHITECTURE.md §5) is non-negotiable in this phase.

### Manual QA checklist

1. `pnpm build` green (vue-tsc + vite).
2. Dev server: full-viewport HUD, national outline + 27 states render, no
   console errors.
3. Click São Paulo: scan effect fires, both ranking columns stagger in,
   counters tween, confidence badges and source tags render.
4. Click any state (all 27 UFs now carry a fictional ranking): both columns
   render; drafts show as "EM REVISÃO". The "sem dados" panel remains the
   graceful fallback for a region that has no entry at all.
5. Emulate `prefers-reduced-motion: reduce`: stagger/scan/scanline disabled.
6. `pnpm preview`: click-through matches dev (catches `public/geo`
   asset-path issues).
7. Zoom out (or "VISÃO GLOBAL"): dim dashed world appears; hovering a
   country reads "EM BREVE"; clicking one opens the "área bloqueada" panel.

## Repository layout

```
apps/web/            Phase 1 frontend (Vite + Vue 3 + TS)
apps/api/            F3/F4 backend — FastAPI over PostGIS (power-data endpoint)
db/migrations/       F4 — Postgres/PostGIS SQL migrations + seed
infra/               deferred — Terraform (not started)
docs/data-sources.md boundary data provenance
ARCHITECTURE.md      topology, decisions, deviations, deferred work
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — topology + rationale + "Deferred to
  Phase 2" section
- [docs/data-sources.md](docs/data-sources.md) — where the map boundaries come
  from and how they were processed
