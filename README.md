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

## Stack (Phase 1)

- Vue 3 + TypeScript + Vite, Pinia for state
- MapLibre GL JS base map + deck.gl overlay (choropleth, 3D columns at state
  capitals, influence arcs, ambient heatmap)
- GSAP for HUD choreography — all motion gated behind `prefers-reduced-motion`
- Tailwind CSS v4 layered over hand-written design tokens
  (`apps/web/src/styles/tokens.css`)
- Self-hosted Fira Code / Fira Sans (no font CDN)
- Boundaries: IBGE malha territorial, simplified — see `docs/data-sources.md`

## Getting started

Requires Node >= 22 and pnpm >= 10 (`npm i -g pnpm`).

```sh
pnpm install
pnpm dev        # Vite dev server on http://localhost:5173
pnpm build      # vue-tsc type-check + production build
pnpm preview    # serve the production build on http://localhost:4173
pnpm geo        # re-fetch + simplify IBGE boundaries (needs network)
```

Equivalent `make web-*` targets exist in the Makefile for machines with GNU
make installed.

Dev tip: `http://localhost:5173/?region=SP` deep-links straight into a
region's ranking panel (any UF sigla or `BR`).

## Repository layout

```
apps/web/            Phase 1 frontend (Vite + Vue 3 + TS)
apps/api/            Phase 2 stub — FastAPI backend (not started)
db/migrations/       Phase 2 stub — Postgres/PostGIS (not started)
infra/               deferred — Terraform (not started)
docs/data-sources.md boundary data provenance
ARCHITECTURE.md      topology, decisions, deviations, deferred work
CLAUDE.md            operational notes (commands, gotchas)
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — topology + rationale + "Deferred to
  Phase 2" section
- [docs/data-sources.md](docs/data-sources.md) — where the map boundaries come
  from and how they were processed
