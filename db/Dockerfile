# PowerAtlas database image (F5a): PostGIS + pgvector in one Postgres.
#
# The postgis/postgis base already configures the PGDG apt repo, so the
# matching pgvector package is one install away. Keep the Postgres major in
# sync between the base tag and the package name.
FROM postgis/postgis:16-3.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*
