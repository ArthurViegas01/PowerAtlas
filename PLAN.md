# PowerAtlas — Plano de continuação (F3+)

> **Handoff para um chat novo.** Estado em 2026-07-19: F1, F2, compasso e F3
> released (`main` = **v0.4.0**, tags `v0.2.0`..`v0.4.0`); `develop` à frente
> com a F4 (Postgres + PostGIS). Este arquivo agora é **versionado** no repo — atualize
> a seção de estado quando uma fase fechar e enxugue o que já foi entregue.
> Leia junto: `ARCHITECTURE.md` (decisões + seção 6 "deferred"),
> `docs/data-sources.md`, `README.md` (status + QA checklist).

## 1. Estado atual

- **F1 (HUD Brasil, mock)**: `apps/web` completo — Vite + Vue 3 + TS + Pinia,
  MapLibre + deck.gl (choropleth de UFs, colunas 3D gêmeas por capital,
  arcos, heatmap ambiente), GSAP gated por reduced-motion, Tailwind v4 sobre
  tokens (`src/styles/tokens.css`), malhas IBGE (`pnpm geo`), dataset
  100% fictício em `apps/web/src/data/mock/`.
- **F2 (mapa-múndi "em breve")**: backdrop Natural Earth 110m
  (`public/geo/world-countries.geojson`, 175 países, nomes pt) como zona
  bloqueada — fill apagado + bordas tracejadas, hover/click com painel
  "área bloqueada", botão VISÃO GLOBAL, zoom mínimo 1.5.
- **Contrato de dados** (congelado): `apps/web/src/types/power-entity.ts` —
  é exatamente o shape que a futura API deve servir.
  `services/mockDataLoader.ts` é o seam (mesma assinatura do futuro
  `apiClient.ts`).
- **Compasso de rotação (trilha frontend, 2026-07-17)**: `MapCompass.vue`
  (girar ±15°, alinhar ao norte, readout BRG, botão AUTO) + bus de rotação
  no selection store. As câmeras cinematográficas (nacional -8 / estado -12
  / global 0) respeitam o bearing manual (`bearingOverride`) até o AUTO
  limpar; drag-rotate do usuário também vira override (`rotateend` com
  `originalEvent`). Em dev, `window.__paMap` expõe o mapa para depuração.
- **F3 (API FastAPI de leitura, 2026-07-19)**: `apps/api` (layout `src/`,
  pydantic-settings, ruff/mypy/pytest) serve `GET /api/v1/power-data` com o
  contrato `power-entity` byte-compatível com o `mockDataLoader` (mesma ordem
  de regiões e disclaimer). Modelos Pydantic espelham os tipos TS (camelCase
  via alias, `extra="forbid"`). A API tem cópia própria dos JSONs em
  `src/data/mock`. No web, `services/dataSource.ts` escolhe `apiClient` (fetch)
  quando `VITE_API_URL` está setado, ou o mock offline caso contrário. Sem
  banco/auth/escrita. Teste de contrato valida o payload contra os JSONs de
  origem.
- **F4 (Postgres + PostGIS, 2026-07-19)**: `db/migrations/0001_init.sql`
  (regions, entities, sources, entity_sources, influence_links,
  ambient_signals; geometrias PostGIS Point/4326 p/ capitais e sinais; colunas
  `ord` preservam a ordem dos arrays). Migrations SQL puras (sem ORM/Alembic),
  tracked em `schema_migrations`. Runner e seed em `apps/api/scripts/`
  (`migrate.py`, `seed.py`). **Camada de acesso: asyncpg puro** (espelha o
  runtime do ZapAgent). `strength`/`weight` são `double precision` (não `real`,
  que distorceria). A API lê do banco quando `PA_DATABASE_URL` está setado, ou
  do mock caso contrário; payload byte-idêntico. `docker-compose.yml`
  (postgres + api). Teste de paridade DB->fonte marcado `-m integration`.
- **Comandos**: `pnpm dev` (5173) · `pnpm build` (vue-tsc + vite) ·
  `pnpm preview` (4173) · `pnpm geo`. API: `pnpm api-install` · `pnpm api-dev`
  (uvicorn :8000) · `pnpm api-test` · `pnpm api-lint`. Banco:
  `pnpm db-up` · `pnpm db-migrate` · `pnpm db-seed` · `pnpm api-dev-db`
  (`make migrate` encadeia os três). Deep-link de QA: `/?region=SP`
  (qualquer UF ou BR); com API: `VITE_API_URL=http://localhost:8000 pnpm dev`.
- **Trilha frontend (pós-v0.5.0, 2026-07-19)**: code-splitting do bundle
  (manualChunks para maplibre/deck/gsap; shell do app de ~2 MB para ~104 kB);
  mock dos **27 UFs** (todos abrem ranking, padrão fictício grego, algumas
  entidades em draft); testes **vitest** (14) nos stores e composables
  (`pnpm test`).
- **Polish frontend (pós-v0.6.0, 2026-07-19)**: labels de estado no mapa
  (siglas via `TextLayer`, teste do `buildDeckLayers`); copy do painel
  "sem dados" corrigida (27 estados, não 5). Auditoria: mobile já responsivo
  pelo breakpoint de 900px (painel vira bottom-sheet); reduced-motion já
  totalmente coberto (kill-switch CSS global em `main.css` + gating JS nos
  composables).
- **Pendências conhecidas da trilha frontend**: tooltip de hover mais rico no
  mapa (dirigido por picking do deck.gl; exige navegador visível para validar);
  municípios (drill-down sob demanda por UF; ver conversa de escopo).

## 2. Convenções obrigatórias (não pular)

**Commits** — `tipo(escopo): FN — descrição curta em pt-BR`; detalhes
técnicos entre parênteses; `+` junta itens. Ex.:
`feat(api): F3 — endpoint /api/v1/power-data (payload agregado) + CORS`.
Tipos: feat/fix/docs/chore; escopo = app (`api`, `web`); `docs:` sem escopo.
**Nunca** co-autoria de IA. Corpo só quando agrega (2–5 linhas).

**Git flow** — branch `feat/fN-slug` a partir da `develop`; merge de volta
com `--no-ff` ("Merge branch 'feat/fN-slug' into develop"). Release: commit
`docs: release vX.Y.0 — ...` na develop, depois na main
`git merge --no-ff develop -m "Release vX.Y.0 — <resumo> (merge develop)"`
+ tag anotada `vX.Y.0`. Fases numeradas pela ordem real de entrega
(F1 = HUD, F2 = mundo; próxima = F3).

**Gotchas do ambiente (Windows)**
- O Write tool trunca arquivos >~60 linhas neste mount (null bytes). Usar
  `cat > caminho << 'EOF' ... EOF` via bash — **um heredoc por chamada**
  (múltiplos na mesma chamada quebram o parse), `mkdir -p` antes (o `cat >`
  não cria pastas). Ao final: `grep -rlP '\x00' --exclude-dir=node_modules .`
  e reler os arquivos longos (`wc -l`/`tail`).
- GNU make fora do PATH — usar os scripts pnpm (o Makefile existe por
  convenção).
- Vite roda com `server.host: true` (bind IPv6-only quebrava clientes IPv4)
  e `optimizeDeps.include` para a família deck.gl/luma.gl — **não remover**
  (evita dupla inicialização do luma no dev). Contexto nos comentários do
  `apps/web/vite.config.ts`.
- deck.gl: os cinco subpacotes (`core`, `layers`, `aggregation-layers`,
  `extensions`, `mapbox`) sobem juntos, sempre no mesmo minor.
- QA pelo browser pane do Claude: a aba fica `hidden` e o Chrome suspende
  `requestAnimationFrame` — flyTo/easeTo congelam, transitions do Vue
  travam no meio (overlay de boot fica preso cobrindo cliques) e screenshot
  dá timeout. Nada disso é bug do app: validar interação via
  `window.__paMap.jumpTo(...)`/JS no console ou num navegador visível.

**Regra de conteúdo (inegociável)** — até o workflow de revisão (F6)
existir, toda entidade de "poder oculto" é fictícia (padrão letra grega),
cargos oficiais são genéricos sem nomear ocupantes, e o banner de dados
simulados permanece na UI. Detalhe: ARCHITECTURE.md §5.

## 3. Roadmap

### F3 — API FastAPI de leitura (ENTREGUE 2026-07-19; ver seção 1)

> Entregue em `feat/f3-api-fastapi` -> `develop`. Verificação abaixo passou
> (pytest/ruff/mypy verdes, build do web verde, HUD carregando da API via
> `VITE_API_URL`). A próxima fase recomendada é a **F4** (Postgres + PostGIS).
> As "decisões travadas" abaixo ficam como registro do que foi construído.

**Objetivo:** servir o contrato de `power-entity.ts` pela rede e trocar o
loader do web por um client HTTP — sem mudar nada de UI.

**Decisões travadas**
- Python + FastAPI (objetivo de aprendizado do Arthur; ecossistema NLP
  serve a F5). Espelhar convenções do ZapAgent: `apps/api` com layout
  `src/`, `pyproject.toml` com ruff + mypy + pytest. Antes de escrever,
  olhar `../ZapAgent/apps/api` para copiar o esqueleto exato
  (nomes de pastas, config das tools).
- A API é dona da sua cópia dos dados: os JSONs mock são copiados para
  dentro de `apps/api` (ex.: `src/<pacote>/data/`). Sync manual com os do
  web é aceitável — a F4 substitui isso por banco.
- Um endpoint agregado espelhando o loader atual (menor atrito):
  `GET /api/v1/power-data` → `RegionPowerData` completo
  (schemaVersion, generatedAt, disclaimer, regions, links, ambientSignals).
  Extra: `GET /health`.
- Modelos Pydantic espelhando os tipos TS campo a campo (mesmos nomes,
  camelCase via alias) — o payload deve ser byte-compatível com o que o
  mockDataLoader monta hoje.
- CORS para http://localhost:5173 e :4173.
- No web: `services/apiClient.ts` com a mesma assinatura
  (`loadRegionPowerData(): Promise<RegionPowerData>`); seleção por
  `VITE_API_URL` (setada → API; ausente → mock). `.env.example` documenta.
- Scripts: raiz ganha `pnpm api-dev` (uvicorn --reload) etc. no
  package.json + alvos `api-*` no Makefile.

**Verificação F3**
1. `pytest` + `ruff check` + `mypy` verdes na api.
2. Teste de contrato: payload do endpoint validado contra um golden gerado
   dos mesmos JSONs (garante paridade com o mockDataLoader).
3. `uvicorn` + `pnpm dev` com `VITE_API_URL` → HUD idêntico ao mock
   (clicar SP, MG sem dados, BR), rede mostrando o fetch na API.
4. Sem `VITE_API_URL` → segue 100% offline no mock.

**Fora de escopo da F3:** Docker, banco, auth, escrita.

### F4 — Postgres + PostGIS + persistência (ENTREGUE 2026-07-19; ver seção 1)

> Entregue em `feat/f4-postgres-postgis` -> `develop`. Decisão travada:
> **asyncpg puro** (sem ORM), espelhando o runtime do ZapAgent. Migrations SQL
> em `db/migrations/` (0001: regions, entities, sources, entity_sources,
> influence_links, ambient_signals), seed dos JSONs, API lendo do banco,
> `docker-compose.yml` (api + postgres/postgis), `make migrate`. Verificação:
> unit sem banco + `-m integration` com banco (paridade byte a byte),
> ruff/mypy verdes, smoke HTTP lendo do PostGIS. Próxima recomendada: **F5**.

### F5 — Pipeline de ingestão e scoring (intenção, não desenhar ainda)

Celery + Redis; scraping de fontes de notícia BR; embeddings pgvector;
scoring via LLM com citação de fonte obrigatória; tudo entra como `draft`.

### F6 — Workflow de revisão (gate de conteúdo real)

Draft → published com aprovador único (admin). Só depois disso entidades
reais nomeadas podem aparecer no produto. Os campos
`status`/`confidence`/`sources` já existem no contrato por causa disso.

### Trilha frontend paralela (intercalável, sem número de fase)

- [x] Mock dos 27 estados (entidades fictícias novas no mesmo padrão).
- [x] Code-splitting do bundle: manualChunks p/ maplibre e deck.gl.
- [x] Testes: vitest nos stores/composables (selection, rankings, counter).
- [ ] Tooltips mais ricos, labels de estados, refinamento mobile.
- [ ] Exercitar `prefers-reduced-motion` de ponta a ponta (item 5 do QA).

## 4. Verificação padrão de toda fase

`pnpm build` verde; QA checklist do README (7 itens); varredura de null
bytes; na api: pytest/ruff/mypy. Commits pequenos no padrão, branch por
fase, merge --no-ff na develop; release na main com tag quando fechar um
conjunto coeso.

## 5. Como retomar num chat novo

Prompt sugerido: *"Leia o PLAN.md na raiz do PowerAtlas e o
ARCHITECTURE.md. Vamos implementar a F3 (API FastAPI) conforme o plano —
comece pelo esqueleto espelhando o ZapAgent."* O dev server sobe com
`pnpm dev`; QA rápido via `/?region=SP`.
