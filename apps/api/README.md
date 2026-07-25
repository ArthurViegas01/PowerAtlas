# PowerAtlas API

Read-only FastAPI backend. It serves the exact data contract the Phase 1 mock
already uses (`apps/web/src/types/power-entity.ts`), plus the monitoring feed
of the F5 ingestion pipeline, and it hosts the Celery worker code that fills
that feed.

Reads are open and cover the power contract, the monitoring feed and a stats
overview. The only writes are the data console's dataset import/delete, gated
behind `PA_ALLOW_WRITES` and confined to an isolated `datasets` namespace that
can never affect the served power data. Real auth still arrives with the review
workflow (see the root `PLAN.md` and `ARCHITECTURE.md` section 6).

## Layout

```
src/
  main.py                       create_app() factory + / and /health
  core/config.py                typed settings (pydantic-settings, PA_ prefix)
  models/power_entity.py        Pydantic mirror of the TS contract
  models/monitoring.py          monitoring feed models
  data/loader.py                assembles RegionPowerData from the mock JSON
  data/repository.py            the same payload, read from PostGIS
  data/mock/*.json              the API's own copy of the fictional dataset
  db/pool.py                    asyncpg pool lifecycle (no ORM)
  api/v1/routers/power_data.py  GET /api/v1/power-data
  api/v1/routers/monitoring.py  GET /api/v1/monitoring/documents
  ingest/feeds.py               RSS/Atom parsing, HTML strip, content hashing
  ingest/service.py             fetch + dedup into raw_documents
  worker/celery_app.py          Celery app (json, acks_late, prefetch 1)
  worker/tasks.py               smoke task + pipeline_ingest
scripts/                        migrate.py, seed.py, ingest.py (CLI entry points)
tests/                          health, contract/parity, ingest, worker
```

The API owns its copy of the mock JSON under `src/data/mock` (synced manually
with the web). It is the fallback whenever no database is configured.

## Endpoints

- `GET /health` -> `{"status": "ok", "version": "...", "database": true|false}`
- `GET /api/v1/power-data` -> the full `RegionPowerData` envelope
  (`schemaVersion`, `generatedAt`, `disclaimer`, `regions`, `links`,
  `ambientSignals`), byte-compatible with what the web mock builds.
- `GET /api/v1/monitoring/documents?limit=20` -> latest ingested headlines
  (source, title, url, publication date), newest first. Database-only by
  design: with no pool it returns an empty list and the web hides the panel.
- `GET /api/v1/stats` -> counts of the served tables and the pipeline staging
  (documents by source and by day, candidates), plus `writesAllowed`. Feeds the
  data console's PIPELINE + BANCO panel. Database-only; empty envelope
  otherwise.
- `GET /api/v1/datasets`, `GET /api/v1/datasets/{id}` -> the operator-imported
  datasets (isolated `datasets` namespace). Reads are open.
- `POST /api/v1/datasets/import`, `DELETE /api/v1/datasets/{id}` -> **gated by
  `PA_ALLOW_WRITES`** (403 otherwise). Writes touch only the `datasets`
  namespace, never the served tables; the power-data parity test proves it.

## Running

The whole stack in one command, from the repository root:

```sh
docker compose up
```

That brings up PostGIS+pgvector, Redis, a one-shot migrate+seed, this API
(:8000, or `PA_API_PORT`), the Celery worker and the web HUD (:5173).

For host development (faster reload; needs Python >= 3.11), the pnpm scripts
mirror the Makefile `api-*` targets:

```sh
pnpm api-install   # create .venv and install (fastapi, uvicorn, celery, dev tools)
pnpm api-dev       # uvicorn --reload on http://localhost:8000 (mock mode)
pnpm api-test      # pytest (DB tests are opt-in: -m integration)
pnpm api-lint      # ruff + mypy
```

Then point the web at it: set `VITE_API_URL=http://localhost:8000` (see
`apps/web/.env.example`) and run `pnpm dev`. Without `VITE_API_URL` the web
stays fully offline on the bundled mock.

CORS defaults to the Vite dev (5173) and preview (4173) origins on both
`localhost` and `127.0.0.1`; override with `PA_CORS_ALLOWED_ORIGINS`. Every
setting lives in `core/config.py` and is documented in `.env.example`.

## Database (F4)

The API reads from PostgreSQL + PostGIS when `PA_DATABASE_URL` is set, and from
the bundled mock JSON otherwise. The payload is byte-identical either way; the
access layer is raw asyncpg (no ORM). From the repository root:

```sh
pnpm db-up        # start PostGIS (docker compose)
pnpm db-migrate   # apply db/migrations/*.sql (tracked in schema_migrations)
pnpm db-seed      # load apps/api/src/data/mock into the database (truncates!)
pnpm api-dev-db   # uvicorn against the database
```

DB-backed tests are opt-in (`pytest -m integration`) and need a migrated +
seeded database. Migration and seed scripts live in `scripts/`; the schema
lives in `db/migrations` (see its README).

## Pipeline (F5)

Celery + Redis drive the ingestion that feeds the monitoring panel. The worker
runs in compose; on Windows hosts Celery 5 needs `--pool=solo`, which is what
`pnpm worker-dev` uses.

```sh
pnpm redis-up         # start Redis only
pnpm worker-dev       # Celery worker on the host (pool=solo)
pnpm pipeline-ingest  # run one ingestion directly, no broker required
```

Sources are an **allowlist seeded into `ingest_sources`** (Agência Brasil,
Agência Câmara, Agência Senado), never hardcoded at the call site. Documents
are deduplicated by a sha256 of url + title + content, each feed is isolated so
one failure cannot abort the run, and the fetcher sends an honest User-Agent
with a delay between sources (`PA_INGEST_*`).

The pipeline never writes to the served tables: it targets staging only, and
`entity_candidates` is locked to `draft` by a database CHECK constraint. F5c
(embeddings + LLM scoring) is paused; see PLAN.md section 3.
