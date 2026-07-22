# Database migrations (F4)

Plain-SQL migrations for PostgreSQL + PostGIS, applied in filename order and
tracked in a `schema_migrations` table (no ORM, no Alembic). The runtime access
layer is raw asyncpg, mirroring the Encaixe house pattern.

- `0001_init.sql` — regions, entities, sources, entity_sources, influence_links,
  ambient_signals; PostGIS point geometries (EPSG:4326) for capitals and ambient
  signals; `ord` columns preserve the mock array order so the DB payload stays
  byte-compatible with the F3 mock loader.

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
