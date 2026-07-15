# PowerAtlas API — F3 (planned, not started)

Placeholder for the FastAPI backend. See the "Deferred to future phases"
section of [ARCHITECTURE.md](../../ARCHITECTURE.md) and the root `PLAN.md`
(local) for the F3 scope.

Planned shape (mirrors ZapAgent house conventions): FastAPI with a `src/`
layout, `pyproject.toml` (ruff / mypy / pytest), serving the exact JSON
contract the Phase 1 mock data already uses — see
`apps/web/src/types/power-entity.ts`. Swapping the frontend from
`mockDataLoader.ts` to a real `apiClient.ts` is designed to be a near no-op.
