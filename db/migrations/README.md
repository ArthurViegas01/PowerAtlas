# Database migrations

Plain-SQL migrations for PostgreSQL + PostGIS, applied in filename order and
tracked in a `schema_migrations` table (no ORM, no Alembic). The runtime access
layer is raw asyncpg, mirroring the Encaixe house pattern.

- `0001_init.sql` (F4): regions, entities, sources, entity_sources,
  influence_links, ambient_signals; PostGIS point geometries (EPSG:4326) for
  capitals and ambient signals; `ord` columns preserve the mock array order so
  the DB payload stays byte-compatible with the F3 mock loader.
- `0002_pipeline.sql` (F5): staging schema for the ingestion and scoring
  pipeline. `ingest_sources` (the feed allowlist), `raw_documents` (deduped by
  a UNIQUE `content_hash`), `doc_chunks` (`vector(1024)` embeddings behind an
  HNSW index; the model and dimension are recorded in a comment in the
  migration), `scoring_runs` (model, prompt version, stats),
  `entity_candidates` and `candidate_citations`.

  **`entity_candidates` carries `CHECK (status = 'draft')`.** The pipeline
  cannot promote its own output: nothing reaches the served tables without the
  human review gate (F6). This is the content-safety rule of
  ARCHITECTURE.md section 5 expressed in the schema instead of in code.

- `0003_datasets.sql`: the data console's operator-imported datasets. `datasets`
  (metadata + column descriptors as jsonb) and `dataset_rows` (rows as jsonb,
  order preserved). A **separate namespace** with no relationship to the served
  power-entity tables: the import endpoint writes only here, so the power-data
  payload is never affected (docs/data-console.md).

pgvector plus PostGIS in one server needs a custom image, so the compose
`postgres` service builds `db/Dockerfile` (postgis/postgis:16-3.4 +
postgresql-16-pgvector) instead of pulling an image.

## Usage

From the repository root (starts PostGIS, applies migrations, seeds):

```sh
pnpm db-up        # docker compose up -d postgres
pnpm db-migrate   # apply migrations
pnpm db-seed      # load the fictional dataset from apps/api/src/data/mock
```

Then run the API against it: `pnpm api-dev-db` (or set
`PA_DATABASE_URL=postgresql://poweratlas:poweratlas_local_dev@localhost:5432/poweratlas`).
Without a database the API stays on the bundled mock. Equivalent `make db-*`
targets exist; `make migrate` chains up + migrate + seed.

The runner and seed scripts live in `apps/api/scripts/` (`migrate.py`,
`seed.py`); the schema lives here so it is versioned independently of the API.
