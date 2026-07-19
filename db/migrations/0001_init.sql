-- PowerAtlas F4 - initial schema (Postgres + PostGIS).
--
-- Persists the exact power-entity contract the API serves. PostGIS holds the
-- point geometries (state capitals, ambient signals) in EPSG:4326. Ordering
-- columns (`ord`) preserve the display order the mock JSON arrays imply, so
-- the DB payload stays byte-compatible with the F3 mock loader.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE regions (
    id           text PRIMARY KEY,                    -- 'BR' or UF sigla
    name         text NOT NULL,
    kind         text NOT NULL CHECK (kind IN ('country', 'state')),
    capital_name text NOT NULL,
    capital_geom geometry(Point, 4326) NOT NULL,      -- [lon, lat]
    updated_at   timestamptz NOT NULL
);

CREATE TABLE entities (
    id         text PRIMARY KEY,
    region_id  text NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    dimension  text NOT NULL CHECK (dimension IN ('official', 'hidden')),
    ord        int  NOT NULL,                         -- order within region+dimension
    name       text NOT NULL,
    kind       text NOT NULL CHECK (kind IN (
                   'office', 'institution', 'organization',
                   'faction', 'movement', 'economic-bloc')),
    score      int  NOT NULL CHECK (score BETWEEN 0 AND 100),
    delta      int  NOT NULL,
    confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    status     text NOT NULL CHECK (status IN ('draft', 'published')),
    note       text,
    UNIQUE (region_id, dimension, ord)
);

CREATE INDEX entities_region_dim_idx ON entities (region_id, dimension, ord);

-- Sources are shared across entities (same src-* id reused), hence a separate
-- table plus an ordered many-to-many join.
CREATE TABLE sources (
    id           text PRIMARY KEY,
    label        text NOT NULL,
    url          text,
    published_at text,
    note         text
);

CREATE TABLE entity_sources (
    entity_id text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    source_id text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    ord       int  NOT NULL,
    PRIMARY KEY (entity_id, source_id)
);

CREATE TABLE influence_links (
    id          text PRIMARY KEY,
    ord         int  NOT NULL,
    from_region text NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    to_region   text NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    strength    double precision NOT NULL CHECK (strength BETWEEN 0 AND 1),
    dimension   text NOT NULL CHECK (dimension IN ('official', 'hidden')),
    label       text
);

CREATE TABLE ambient_signals (
    id     serial PRIMARY KEY,
    ord    int  NOT NULL,
    geom   geometry(Point, 4326) NOT NULL,            -- [lon, lat]
    weight double precision NOT NULL CHECK (weight BETWEEN 0 AND 1)
);
