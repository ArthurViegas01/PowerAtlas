# PowerAtlas API (F3)

Read-only FastAPI backend that serves the exact data contract the Phase 1 mock
already uses (`apps/web/src/types/power-entity.ts`). Swapping the frontend from
`mockDataLoader.ts` to the real backend is a one-file change on the web side
(`services/dataSource.ts`, selected by `VITE_API_URL`).

Scope is deliberately narrow: no database, no auth, no writes. Those arrive in
later phases (see the root `PLAN.md` and `ARCHITECTURE.md` section 6).

## Layout

```
src/
  main.py                     create_app() factory + /health
  core/config.py              typed settings (pydantic-settings, PA_ prefix)
  models/power_entity.py      Pydantic mirror of the TS contract
  data/loader.py              assembles RegionPowerData from the mock JSON
  data/mock/*.json            the API's own copy of the fictional dataset
  api/v1/routers/power_data.py  GET /api/v1/power-data
tests/                        health + contract/parity tests
```

The API owns its copy of the mock JSON under `src/data/mock` (synced manually
with the web until F4 introduces a database).

## Endpoints

- `GET /health` -> `{"status": "ok", "version": "..."}`
- `GET /api/v1/power-data` -> the full `RegionPowerData` envelope
  (`schemaVersion`, `generatedAt`, `disclaimer`, `regions`, `links`,
  `ambientSignals`), byte-compatible with what the web mock builds.

## Running

From the repository root (pnpm scripts mirror the Makefile `api-*` targets):

```sh
pnpm api-install   # create .venv and install (fastapi, uvicorn, dev tools)
pnpm api-dev       # uvicorn --reload on http://localhost:8000
pnpm api-test      # pytest
pnpm api-lint      # ruff + mypy
```

Then point the web at it: set `VITE_API_URL=http://localhost:8000` (see
`apps/web/.env.example`) and run `pnpm dev`. Without `VITE_API_URL` the web
stays fully offline on the bundled mock.

CORS defaults to the Vite dev (5173) and preview (4173) origins on both
`localhost` and `127.0.0.1`; override with `PA_CORS_ALLOWED_ORIGINS`.

## Database (F4)

The API reads from PostgreSQL + PostGIS when `PA_DATABASE_URL` is set, and from
the bundled mock JSON otherwise. The payload is byte-identical either way; the
access layer is raw asyncpg (no ORM). From the repository root:

```sh
pnpm db-up        # start PostGIS (docker compose)
pnpm db-migrate   # apply db/migrations/*.sql (tracked in schema_migrations)
pnpm db-seed      # load apps/api/src/data/mock into the database
pnpm api-dev-db   # uvicorn against the database
```

`GET /health` reports `"database": true/false`. DB-backed tests are opt-in
(`pytest -m integration`) and need a migrated + seeded database. Migration and
seed scripts live in `scripts/`; the schema lives in `db/migrations`.
