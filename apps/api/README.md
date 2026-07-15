# PowerAtlas API — Phase 2 (not started)

Placeholder for the FastAPI backend. See the "Deferred to Phase 2" section of
[ARCHITECTURE.md](../../ARCHITECTURE.md).

Planned shape (mirrors ZapAgent house conventions): FastAPI with a `src/`
layout, `pyproject.toml` (ruff / mypy / pytest), serving the exact JSON
contract the Phase 1 mock data already uses — see
`apps/web/src/types/power-entity.ts`. Swapping the frontend from
`mockDataLoader.ts` to a real `apiClient.ts` is designed to be a near no-op.
