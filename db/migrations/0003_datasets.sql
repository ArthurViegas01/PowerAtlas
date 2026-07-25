-- PowerAtlas data console - operator-imported datasets (isolated namespace).
--
-- Content-safety by construction: this is a SEPARATE namespace for data the
-- operator uploads through the data console. It has NO relationship to the
-- served power-entity tables (regions/entities/sources/...). Nothing here can
-- reach the public power-data payload, and the import endpoint only ever
-- writes here, so the parity of GET /api/v1/power-data is preserved and the
-- fictional-only rule (ARCHITECTURE.md section 5) is untouched.
--
-- Rows are stored as JSONB keyed by the column `key`, mirroring the web's
-- TabularDataset shape, so an imported CSV round-trips through the same
-- rendering (KPIs, charts, table, export) as the built-in datasets.

CREATE TABLE datasets (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    source     text NOT NULL DEFAULT 'IMPORTADO',
    -- Column descriptors: [{ key, label, numeric, format }, ...].
    columns    jsonb NOT NULL,
    row_count  integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dataset_rows (
    dataset_id uuid NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    ord        integer NOT NULL,             -- preserves the imported row order
    data       jsonb NOT NULL,               -- one row, keyed by column key
    PRIMARY KEY (dataset_id, ord)
);

CREATE INDEX dataset_rows_dataset_idx ON dataset_rows(dataset_id, ord);
