# PowerAtlas — common development commands.

.PHONY: help web-install web-dev web-build web-preview web-typecheck web-test \
	geo-refresh subdivisoes indicators demografia fiscal \
	api-install api-dev api-test api-lint db-up db-down db-migrate db-seed migrate \
	redis-up worker-dev pipeline-ingest

help:
	@echo "PowerAtlas — make targets"
	@echo "  make web-install    Install workspace dependencies (pnpm)"
	@echo "  make web-dev        Start the Vite dev server (http://localhost:5173)"
	@echo "  make web-build      Type-check and build apps/web"
	@echo "  make web-preview    Serve the production build (http://localhost:4173)"
	@echo "  make web-typecheck  Run vue-tsc --noEmit"
	@echo "  make web-test       Run the web test suite (vitest)"
	@echo "  make geo-refresh    Re-fetch + simplify IBGE boundary files"
	@echo "  make subdivisoes    Rebuild the IBGE bairro/distrito meshes (network)"
	@echo "  make indicators     Re-fetch the IBGE factual indicators"
	@echo "  make demografia     Rebuild the demographic dataset (offline join)"
	@echo "  make fiscal         Rebuild the fiscal-flow dataset (needs network)"
	@echo "  make api-install    Create the API venv and install (F3)"
	@echo "  make api-dev        Start the FastAPI dev server (http://localhost:8000)"
	@echo "  make api-test       Run the API test suite (pytest)"
	@echo "  make api-lint       Lint + type-check the API (ruff + mypy)"
	@echo "  make db-up          Start PostGIS via docker compose"
	@echo "  make db-migrate     Apply SQL migrations (F4)"
	@echo "  make db-seed        Seed the database from the mock JSON"
	@echo "  make migrate        db-up + db-migrate + db-seed"
	@echo "  make redis-up       Start Redis via docker compose (F5)"
	@echo "  make worker-dev     Run the Celery worker on the host (pool=solo)"
	@echo "  make pipeline-ingest Run the RSS ingestion once, without a broker"

web-install:
	pnpm install

web-dev:
	pnpm --filter @poweratlas/web dev

web-build:
	pnpm --filter @poweratlas/web build

web-preview:
	pnpm --filter @poweratlas/web preview

web-typecheck:
	pnpm --filter @poweratlas/web typecheck

web-test:
	pnpm --filter @poweratlas/web test

geo-refresh:
	pnpm --filter @poweratlas/web geo

subdivisoes:
	pnpm --filter @poweratlas/web subdivisoes

indicators:
	pnpm --filter @poweratlas/web indicators

demografia:
	pnpm --filter @poweratlas/web demografia

fiscal:
	pnpm --filter @poweratlas/web fiscal

api-install:
	cd apps/api && py -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"

api-dev:
	cd apps/api && .venv/Scripts/python -m uvicorn src.main:app --reload --port 8000

api-test:
	cd apps/api && .venv/Scripts/python -m pytest -q

api-lint:
	cd apps/api && .venv/Scripts/python -m ruff check src tests scripts && .venv/Scripts/python -m mypy src scripts

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-migrate:
	cd apps/api && .venv/Scripts/python -m scripts.migrate

db-seed:
	cd apps/api && .venv/Scripts/python -m scripts.seed

migrate: db-up db-migrate db-seed

redis-up:
	docker compose up -d redis

worker-dev:
	cd apps/api && .venv/Scripts/python -m celery -A src.worker.celery_app worker --loglevel=INFO --pool=solo

pipeline-ingest:
	cd apps/api && .venv/Scripts/python -m scripts.ingest
