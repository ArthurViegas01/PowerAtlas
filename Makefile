# PowerAtlas — common development commands.

.PHONY: help web-install web-dev web-build web-preview web-typecheck geo-refresh

help:
	@echo "PowerAtlas — make targets"
	@echo "  make web-install    Install workspace dependencies (pnpm)"
	@echo "  make web-dev        Start the Vite dev server (http://localhost:5173)"
	@echo "  make web-build      Type-check and build apps/web"
	@echo "  make web-preview    Serve the production build (http://localhost:4173)"
	@echo "  make web-typecheck  Run vue-tsc --noEmit"
	@echo "  make geo-refresh    Re-fetch + simplify IBGE boundary files"

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

geo-refresh:
	pnpm --filter @poweratlas/web geo
