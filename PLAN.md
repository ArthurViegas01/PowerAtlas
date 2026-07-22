# PowerAtlas — Plano de continuação (F3+)

> **Handoff para um chat novo.** Estado em 2026-07-22: F1–F4 + trilha
> frontend released (`origin/main` = **v0.9.0**, tags `v0.2.0`..`v0.9.0`);
> `develop` = `origin/develop`. Fase atual: **F5** (desenho na seção 3;
> etapas 1 e 2 de 3 entregues em 2026-07-22 — falta a F5c,
> embeddings + scoring). Este arquivo é
> **versionado** no repo — atualize a seção de estado quando uma fase fechar
> e enxugue o que já foi entregue.
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
  runtime do Encaixe). `strength`/`weight` são `double precision` (não `real`,
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
- **Municípios (pós-v0.7.0)**: drill-down municipal nos **27 UFs**.
  `fetch-geo.mjs` gera `public/geo/municipios/{UF}.geojson` (malha IBGE
  `estados/{code}?intrarregiao=municipio` + nomes da API de localidades, props
  `{codigo,name}`); lista de UFs derivada do `UF_BY_CODE` do próprio script e
  flag `--municipios-only` para regerar só essas malhas (2026-07-21; piloto SP
  em 2026-07-19). Todas sob o budget de 900 KB (maior: MG 569 KB; total
  3,7 MB, carregadas uma por vez). O `mapLayers` carrega a malha sob demanda
  ao selecionar o estado (404/fallback SPA tratados sem retry); camada
  `municipios` no `buildDeckLayers`; clique em município → `selectMunicipio`
  → câmera fecha no município + painel leve ("ranking em breve"); Esc sobe um
  nível (município → estado → nacional). Sem ranking municipal (isso depende
  da F5). Verificado: malhas íntegras (MG 853 / DF 1 / AC 22 features),
  build/typecheck/22 testes verdes.
- **Indicadores factuais IBGE (2026-07-21)**: primeiros dados reais do
  produto. `fetch-indicators.mjs` (`pnpm indicators`) busca na API de
  Agregados v3: população/área/densidade (Censo 2022, agregado 4714) e PIB
  a preços correntes (PIB dos Municípios 2023, agregado 5938, mil R$) para
  BR + 27 UFs (`public/data/indicators/uf.json`) e 5.570 municípios
  (`municipios/{UF}.json`, por código IBGE de 7 dígitos). Store
  `indicators` (uf.json no boot; arquivo municipal sob demanda junto com a
  malha, mesmo padrão anti-retry do mapLayers), `IndicatorGrid.vue` nos
  painéis de região e de município com label "IBGE · CENSO 2022 · PIB 2023",
  formatadores pt-BR em `lib/format.ts` (suprimidos viram "N/D"). Sem PIB
  per capita municipal: a API não publica em N6 e derivar (PIB 2023 / pop
  2022) inventaria número que o IBGE não publica. Fora do contrato
  power-entity (decisão em ARCHITECTURE.md §2.5); regra de conteúdo intacta.
  Verificado no browser: painel SP (44.411.238 hab, R$ 3,4 tri) e município
  de São Paulo (11.451.999 hab, R$ 1,1 tri), console limpo, 30 testes verdes.
- **Tooltip de hover no mapa (2026-07-21)**: `MapTooltip.vue` ancorado no
  cursor, alimentado pelo picking do deck.gl via selection store (novos
  `hoverPoint` e `hoveredMunicipio`; camada municipal ganhou `onHover` +
  realce de fill; cursor pointer também sobre município). Prioridade
  município > estado > país; mostra POP/PIB compactos dos indicadores IBGE
  (`formatPeopleCompact`), "EM BREVE" no backdrop mundial; pointer-events
  none e flip perto das bordas. Hover real de mouse exige navegador visível;
  validado via stores no browser pane (MG: 20,5 mi hab / R$ 972 bi;
  município de São Paulo: 11,5 mi hab / R$ 1,1 tri; Argentina: EM BREVE).
- **Rebrand "influência" + oculta em breve (2026-07-22)**: "poder" virou
  "influência" em todas as menções visíveis (título da aba, header, legenda,
  colunas do painel, boot, copy municipal). A dimensão de influência oculta
  ficou bloqueada como "em breve" atrás de `HIDDEN_INFLUENCE_ENABLED`
  (`lib/features.ts`): a segunda coluna do painel vira módulo bloqueado
  (borda tracejada âmbar), colunas âmbar e arcos `hidden` saem do mapa (a
  coluna oficial centraliza na capital), legenda com swatch tracejado sem
  glow. Disclaimer novo sincronizado web+API ("RANKINGS E ENTIDADES SÃO
  FICTÍCIOS"), constantes e teste de contrato atualizados (payload segue
  byte-idêntico). Identificadores de código (power-entity etc.) intactos.
- **F5a — infra do worker (2026-07-22, `feat/f5a-worker-infra`)**: Celery +
  Redis espelhando o Encaixe (`src/worker/celery_app.py` + task de smoke;
  json serializer, `acks_late`, prefetch 1), imagem própria do banco
  (`db/Dockerfile`: PostGIS + pgvector 0.8.5), migration
  `0002_pipeline.sql` (ingest_sources, raw_documents com dedup por hash,
  doc_chunks `vector(1024)` + índice HNSW, scoring_runs, entity_candidates
  com `CHECK (status = 'draft')` no banco, candidate_citations), compose
  ganha `redis` e `worker` (profile full), config
  `PA_REDIS_URL`/broker/backend, alvos `redis-up`/`worker-dev`. Verificado:
  7 unit + 2 integration (paridade) verdes, ruff/mypy verdes, migrations
  aplicadas em banco novo, round-trip real do smoke via Redis (SUCCESS no
  result backend).
- **F5b — ingestão RSS (2026-07-22, `feat/f5b-ingestao-rss`)**: módulo
  `src/ingest/` (feedparser + httpx; `FeedItem`, strip de HTML, hash
  sha256 url+título+conteúdo), `ingest_source`/`ingest_all` com UA honesto,
  timeout, delay entre fontes e isolamento de erro por feed; task Celery
  `pipeline_ingest` + CLI `pnpm pipeline-ingest` (roda direto, sem broker).
  Allowlist seedada (upsert antes do `--if-empty`): Agência Brasil, Agência
  Câmara e Agência Senado (URLs verificadas ao vivo em 2026-07-22 — a da
  Câmara é `noticias/rss/ultimas-noticias`, a do Senado `noticias/rss`).
  Config `PA_INGEST_*`. Verificado: 12 unit + 3 integration verdes (dedup
  em re-runs com respx), ruff/mypy verdes, E2E real com 45 docs dos 3 feeds
  no banco e dedup confirmado na segunda rodada (0 inserts; timeout
  transitório do Senado não derrubou a rodada — isolamento funcionou).
- **Pendências conhecidas da trilha frontend**: ranking por município
  (depende da F5); reativar a dimensão oculta (flip do flag) quando F5/F6
  existirem. (Tooltip de hover validado com mouse real em 2026-07-22.)

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
(F1 = HUD, F2 = mundo, F3 = API, F4 = banco; próxima = F5).

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
  `window.__paMap.jumpTo(...)`/JS no console ou num navegador visível. As
  stores Pinia são alcançáveis no console via
  `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s`.
- Dev server do Vite + checkouts de git: se um diretório novo de
  `public/` for deletado e recriado por um checkout/merge com o server no
  ar, o cache de arquivos públicos pode perder a subárvore (as URLs passam
  a responder o fallback SPA com 200). Reescrever os arquivos não resolve;
  tocar `apps/web/vite.config.ts` força o restart interno do Vite e
  recadastra tudo (sem matar o processo).

**Regra de conteúdo (inegociável)** — até o workflow de revisão (F6)
existir, toda entidade de "poder oculto" é fictícia (padrão letra grega),
cargos oficiais são genéricos sem nomear ocupantes, e o banner de dados
simulados permanece na UI. Detalhe: ARCHITECTURE.md §5.

## 3. Roadmap

### F3 — API FastAPI de leitura (ENTREGUE 2026-07-19; ver seção 1)

> Entregue em `feat/f3-api-fastapi` -> `develop` (v0.4.0). Decisões que
> ficaram: layout `src/` espelhando o Encaixe, modelos Pydantic camelCase
> via alias byte-compatíveis com o mock, endpoint agregado único
> `GET /api/v1/power-data`, CORS p/ 5173/4173, seleção no web por
> `VITE_API_URL` (ausente → mock offline). Verificação passou (pytest/ruff/
> mypy, teste de contrato contra os JSONs de origem, HUD idêntico com e sem
> API).

### F4 — Postgres + PostGIS + persistência (ENTREGUE 2026-07-19; ver seção 1)

> Entregue em `feat/f4-postgres-postgis` -> `develop`. Decisão travada:
> **asyncpg puro** (sem ORM), espelhando o runtime do Encaixe. Migrations SQL
> em `db/migrations/` (0001: regions, entities, sources, entity_sources,
> influence_links, ambient_signals), seed dos JSONs, API lendo do banco,
> `docker-compose.yml` (api + postgres/postgis), `make migrate`. Verificação:
> unit sem banco + `-m integration` com banco (paridade byte a byte),
> ruff/mypy verdes, smoke HTTP lendo do PostGIS. Próxima recomendada: **F5**.

### F5 — Pipeline de ingestão e scoring (DESENHADA 2026-07-22; implementar em 3 etapas)

**Objetivo:** primeiro pipeline de dados reais de influência — ingerir
notícias de fontes públicas BR, indexar com embeddings (pgvector) e gerar
rankings **candidatos** via LLM com citação de fonte obrigatória. Tudo cai
em tabelas de staging como `draft`; o payload público continua 100%
fictício até a F6.

**Princípio de segurança (deriva da regra de conteúdo, §2):** a F5 **não
escreve** nas tabelas servidas (`entities` etc.). Ela escreve em
`entity_candidates` + `candidate_citations`. Promoção candidata → `entities`
só existe na F6, com revisão humana. O teste de paridade garante: payload de
`GET /api/v1/power-data` byte-idêntico antes/depois de rodar o pipeline.

**Decisões travadas**
- Infra espelhando o Encaixe: Celery + Redis com `src/worker/celery_app.py`
  + `tasks.py` (json serializer, `task_acks_late=True`,
  `worker_prefetch_multiplier=1`); `docker-compose.yml` ganha serviços
  `redis` e `worker`. Gotcha: Celery 5 não suporta Windows — o worker roda
  no compose; se precisar rodar no host, `--pool=solo`.
- Banco: PostGIS + pgvector juntos exigem imagem própria — `db/Dockerfile`
  a partir de `postgis/postgis:16-3.4` instalando `postgresql-16-pgvector`
  (o compose troca `image:` por `build:`; volume `pgdata` preservado).
  Migration `0002_pipeline.sql`: `ingest_sources` (allowlist de feeds),
  `raw_documents` (dedup por `content_hash` UNIQUE), `doc_chunks`
  (`embedding vector(N)`; N e modelo registrados em comentário na
  migration), `scoring_runs` (modelo, versão do prompt, stats),
  `entity_candidates` (shape espelha `entities` + `rationale` + `run_id`,
  `status` sempre `draft`), `candidate_citations` (candidata → documento +
  trecho citado).
- Ingestão: **só RSS/Atom de fontes públicas institucionais** no piloto
  (Agência Brasil, Agência Câmara, Agência Senado) — allowlist vem do seed
  de `ingest_sources`, nunca hardcoded; User-Agent honesto + rate-limit;
  sem scraping de HTML nem paywall na F5.
- Embeddings: Voyage AI (mesmo provedor do Encaixe), modelo gravado por
  chunk; servem para recuperar contexto por região na hora do scoring
  (busca vetorial top-k nos `doc_chunks`).
- Scoring: Anthropic API, saída estruturada validada por Pydantic; prompt
  versionado em `src/scoring/`; **candidata sem >=1 citação (documento +
  trecho) é descartada no código** — coberto por teste. Score 0–100,
  `confidence` derivada da quantidade/concordância de evidência. Piloto:
  BR + 1–2 UFs (não as 27).
- Orquestração: tasks Celery encadeadas, disparo manual por CLI
  (`pnpm pipeline-ingest`, `pnpm pipeline-score`); Celery beat
  (agendamento) fica para depois.
- Config nova em pydantic-settings: `PA_REDIS_URL`, `PA_ANTHROPIC_API_KEY`,
  `PA_VOYAGE_API_KEY` (documentadas no `.env.example`); sem as chaves o
  pipeline fica indisponível e a API de leitura segue normal.

**Etapas de entrega (uma branch cada, mergeável sozinha)**
1. `feat/f5a-worker-infra` — redis + worker no compose, `celery_app`,
   imagem de banco com pgvector, migration 0002, task de smoke.
   **(ENTREGUE 2026-07-22; ver seção 1.)**
2. `feat/f5b-ingestao-rss` — fetch RSS → `raw_documents` (dedup), seed das
   fontes, testes com respx. **(ENTREGUE 2026-07-22; ver seção 1.)**
3. `feat/f5c-embeddings-scoring` — chunking + embeddings + scoring LLM →
   `entity_candidates` + citações.

**Fluxo de subida local (RESOLVIDO 2026-07-22, pedido do Arthur):**
`docker compose up` sobe o backend inteiro — postgres (PostGIS+pgvector),
redis, serviço one-shot `migrate` (migrations + seed `--if-empty`; o seed
completo truncaria as tabelas de staging via CASCADE, então só roda em banco
vazio), api :8000 e worker. O web fica fora do compose: `pnpm dev` (mock)
ou `VITE_API_URL=http://localhost:8000`. `PA_API_PORT` sobrescreve a porta
do host em colisão. Alvos granulares (`db-up`/`redis-up`/`api-dev-db`/
`worker-dev`) continuam valendo p/ dev no host. Documentado no README.

**Verificação F5**
1. pytest/ruff/mypy verdes; unit com HTTP mockado (respx) e embeddings
   fake — nada de rede em unit.
2. `-m integration` (docker: postgres + redis): ingest de fixture RSS →
   dedup OK; embedding gravado e consultável por similaridade; scoring com
   LLM mockado → candidatas com citação; candidata sem citação → rejeitada.
3. Paridade: payload byte-idêntico antes/depois do pipeline rodar.
4. E2E manual com chaves reais: `docker compose --profile full up`
   (+ redis/worker), ingest das fontes seed, scoring de 1 UF → drafts em
   `entity_candidates` com citações plausíveis (conferir via psql).

**Fora de escopo da F5:** promoção para `entities` e revisão (F6), qualquer
mudança de UI ou de payload, auth/escrita pública, admin UI, agendamento
automático, scraping HTML, cobertura das 27 UFs no scoring.

### F6 — Workflow de revisão (gate de conteúdo real)

Draft → published com aprovador único (admin). Só depois disso entidades
reais nomeadas podem aparecer no produto. Os campos
`status`/`confidence`/`sources` já existem no contrato por causa disso.

### Trilha frontend paralela (intercalável, sem número de fase)

- [x] Mock dos 27 estados (entidades fictícias novas no mesmo padrão).
- [x] Code-splitting do bundle: manualChunks p/ maplibre e deck.gl.
- [x] Testes: vitest nos stores/composables (selection, rankings, counter).
- [x] Tooltips (hover com indicadores IBGE, validado 2026-07-22), labels de
      estados (v0.7.0), mobile auditado (bottom-sheet no breakpoint 900px).
- [x] `prefers-reduced-motion` auditado ponta a ponta (kill-switch CSS
      global + gating JS; v0.7.0).

## 4. Verificação padrão de toda fase

`pnpm build` verde; QA checklist do README (7 itens); varredura de null
bytes; na api: pytest/ruff/mypy. Commits pequenos no padrão, branch por
fase, merge --no-ff na develop; release na main com tag quando fechar um
conjunto coeso.

## 5. Como retomar num chat novo

Prompt sugerido: *"Leia o PLAN.md na raiz do PowerAtlas e o
ARCHITECTURE.md. Vamos implementar a etapa F5a (worker + infra) conforme o
desenho da F5 — comece pelo compose (redis + worker) e pela imagem de banco
com pgvector, espelhando o worker do Encaixe."* O dev server sobe com
`pnpm dev`; QA rápido via `/?region=SP`.
