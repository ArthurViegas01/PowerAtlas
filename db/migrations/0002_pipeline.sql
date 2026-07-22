-- PowerAtlas F5a - pipeline staging tables (ingest -> embed -> score).
--
-- Content-safety by construction: the F5 pipeline NEVER writes to the served
-- tables (regions/entities/...). Everything lands here as draft candidates;
-- promotion into `entities` only exists in F6 (human review). The `status`
-- CHECK below enforces draft-only at the database level until F6 relaxes it.

CREATE EXTENSION IF NOT EXISTS vector;

-- Allowlist of feeds the ingester may touch. Seeded (F5b), never hardcoded.
CREATE TABLE ingest_sources (
    id         text PRIMARY KEY,              -- slug, e.g. 'agencia-brasil'
    name       text NOT NULL,
    kind       text NOT NULL CHECK (kind IN ('rss', 'atom')),
    url        text NOT NULL UNIQUE,
    enabled    boolean NOT NULL DEFAULT true,
    fetched_at timestamptz                    -- last successful fetch
);

CREATE TABLE raw_documents (
    id           bigserial PRIMARY KEY,
    source_id    text NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
    url          text NOT NULL,
    title        text NOT NULL,
    published_at timestamptz,
    fetched_at   timestamptz NOT NULL DEFAULT now(),
    content      text NOT NULL,
    content_hash text NOT NULL UNIQUE         -- sha256; dedup across re-fetches
);

CREATE INDEX raw_documents_source_idx
    ON raw_documents (source_id, published_at DESC);

-- Chunked document text + embeddings. vector(1024) = voyage-3.5 output size;
-- if the model changes, bump the dimension here and record it in the row.
CREATE TABLE doc_chunks (
    id              bigserial PRIMARY KEY,
    document_id     bigint NOT NULL REFERENCES raw_documents(id) ON DELETE CASCADE,
    ord             int NOT NULL,
    text            text NOT NULL,
    embedding       vector(1024),
    embedding_model text,
    UNIQUE (document_id, ord)
);

CREATE INDEX doc_chunks_embedding_idx
    ON doc_chunks USING hnsw (embedding vector_cosine_ops);

-- One row per scoring execution (model + prompt version + stats), so every
-- candidate is traceable to the exact run that produced it.
CREATE TABLE scoring_runs (
    id             bigserial PRIMARY KEY,
    started_at     timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz,
    model          text NOT NULL,
    prompt_version text NOT NULL,
    stats          jsonb
);

-- LLM-scored ranking candidates. Shape mirrors `entities` (minus ord/delta,
-- which only make sense after review orders a published ranking).
CREATE TABLE entity_candidates (
    id         bigserial PRIMARY KEY,
    run_id     bigint NOT NULL REFERENCES scoring_runs(id) ON DELETE CASCADE,
    region_id  text NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    dimension  text NOT NULL CHECK (dimension IN ('official', 'hidden')),
    name       text NOT NULL,
    kind       text NOT NULL CHECK (kind IN (
                   'office', 'institution', 'organization',
                   'faction', 'movement', 'economic-bloc')),
    score      int  NOT NULL CHECK (score BETWEEN 0 AND 100),
    confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    status     text NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
    rationale  text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entity_candidates_region_idx
    ON entity_candidates (region_id, dimension);

-- Mandatory evidence: candidate -> source document + quoted excerpt. The
-- ">= 1 citation or discard" rule is enforced in pipeline code (and tested);
-- this table is where those citations live.
CREATE TABLE candidate_citations (
    id           bigserial PRIMARY KEY,
    candidate_id bigint NOT NULL REFERENCES entity_candidates(id) ON DELETE CASCADE,
    document_id  bigint NOT NULL REFERENCES raw_documents(id) ON DELETE CASCADE,
    ord          int  NOT NULL,
    excerpt      text NOT NULL,
    UNIQUE (candidate_id, ord)
);
