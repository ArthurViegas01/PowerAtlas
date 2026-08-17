# PowerAtlas — Plano de Identidade Visual, IA e Produto

> **Para quem vai implementar (Claude Code):** este arquivo é o briefing de
> execução. Ele NÃO muda comportamento sozinho — descreve *o que* construir,
> *em que ordem* e *como verificar*. Leia junto: `PLAN.md`, `ARCHITECTURE.md`,
> `docs/map-layers.md`, `docs/power-scale.md`. Siga as convenções da seção 2 do
> `PLAN.md` (commits pt-BR, branch por fase, merge `--no-ff`, regra de conteúdo
> inegociável, gotchas de Windows). Coloque este arquivo na raiz do repo, ao
> lado de `PLAN.md`.
>
> **Estado de partida:** v0.13.0+ (console de dados, warehouse, F5a/F5b
> entregues, F5c pausada). App Vue 3 + TS + Pinia + MapLibre/deck.gl, tokens em
> `apps/web/src/styles/tokens.css`, duas rotas (`/`, `/dados`).
>
> **Decisões do Arthur que guiam este plano:**
> - Identidade: **formalizar o HUD tático atual num design system próprio** —
>   não migrar para outro visual. Documentar tokens, componentes e regras do que
>   já existe, preencher as lacunas.
> - Escopo: **identidade + reorganização da IA + roadmap de produto**.
> - Público: analistas/pesquisadores, jornalistas, público geral curioso, uso
>   pessoal/portfólio e (futuro) clientes pagantes (SaaS).
> - Tarefas centrais: explorar o mapa, comparar entidades, buscar entidade,
>   ver rankings, entender a metodologia, salvar/exportar análises, ver evolução
>   no tempo.
> - Escala de influência (0–100): **uma camada entre várias**, não o centro.
> - Dados: **misto real + simulado, marcado claramente**.
> - Navegação: **aberto a reestruturar**.

---

## 0. Diagnóstico rápido (por que este plano existe)

O que já está forte e **não deve ser tocado**: a linguagem HUD (void escuro,
ciano/âmbar, monoespaçado, brackets de canto, scanline, glow contido), os
tokens centralizados consumidos por CSS + Tailwind + deck.gl sem divergir, o
rigor de proveniência de dados, o gating de `prefers-reduced-motion`, a regra de
conteúdo fictício.

O que falta para virar **produto usável** (não só protótipo bonito):

1. **O design system existe de fato, mas não está formalizado.** Há tokens de
   cor, tipo e motion — mas não há escala de **espaçamento**, **raio**,
   **elevação/z-index**, **larguras de layout** nem **tamanhos de controle**.
   Cada componente reinventa `padding: 12px 16px`, `left: 10px`, `z-index: 32`.
   Não há um catálogo vivo dos componentes nem regras escritas de uso das cores.
2. **A IA mistura modelos mentais.** "Visão Global", "Visão Nacional", "Visão
   Demográfica" e "Console de Dados" são botões irmãos no header, mas são coisas
   diferentes: as três primeiras são *lentes de dado sobre o mesmo globo*; a
   última é *outra ferramenta*. Não há busca, não há comparação, não há como
   salvar/compartilhar uma análise além do deep-link `?region=`.
3. **A camada de confiança do dado é a alma do produto e está subutilizada.**
   Com dados mistos (real + simulado), *o rótulo de origem e status de cada
   número é feature, não rodapé*. Isso é o que separa "protótipo com dados
   simulados" de "ferramenta de análise em que jornalista/analista confia".

Este plano ataca os três, nesta ordem de dependência: **Trilha ID** (design
system) → **Trilha IA** (navegação/estrutura) → **Trilha PROD** (features de
produto). São intercaláveis com a trilha backend (F5c/F6) — não bloqueiam.

---

## Trilha ID — Formalizar o Design System "Tactical HUD"

**Objetivo:** transformar o visual atual, hoje implícito no CSS dos componentes,
num sistema documentado, com escalas completas e um catálogo vivo — para que
qualquer tela nova (comparação, busca, onboarding, SaaS) nasça consistente sem
adivinhação.

> Nota sobre o Lumni: o Lumni é útil como **referência de rigor** (como um design
> system se documenta: princípios → tokens → regras → componentes → estados).
> A *linguagem visual* continua sendo a HUD tática do PowerAtlas. Não copie
> cores/tipos do Lumni.

### ID-1 · Princípios e naming do sistema

Escreva `docs/design-system.md` (fonte de verdade textual) abrindo com o nome e
3–4 princípios que já estão implícitos no produto. Sugestão de princípios:

- **Instrumento, não decoração.** Cada pixel serve leitura de dado. Glow é
  contido; nada brilha sem hierarquia justificar.
- **O escuro é o palco.** O void (`--pa-bg-void`) é o fundo; superfícies sobem
  por borda + blur + glow sutil, nunca por sombra pesada.
- **Ciano = oficial, Âmbar = oculto/influência. Sempre.** A cor carrega
  semântica de dimensão — nunca é escolha estética.
- **O dado mostra a fonte.** Todo número exibe origem e status de confiança.

### ID-2 · Completar os tokens (`apps/web/src/styles/tokens.css`)

Hoje só existem cor/tipo/motion/glow. Adicione as escalas ausentes **sem quebrar
os tokens atuais** (só acrescentar). Base 4px, coerente com a densidade atual:

```css
:root {
  /* espaçamento (base 4px) — trocar os magic numbers dos componentes por estes */
  --pa-space-1: 4px;   --pa-space-2: 8px;   --pa-space-3: 12px;
  --pa-space-4: 16px;  --pa-space-5: 20px;  --pa-space-6: 24px;
  --pa-space-8: 32px;  --pa-space-10: 40px;

  /* raio — HUD é anguloso; raio pequeno, nunca pill (exceto badge/tag) */
  --pa-radius-none: 0;   --pa-radius-sm: 2px;  --pa-radius-md: 4px;
  --pa-radius-pill: 999px;

  /* elevação / z-index — hoje espalhados (header=32 etc.); centralizar */
  --pa-z-map: 0;        --pa-z-overlay: 10;   --pa-z-panel: 20;
  --pa-z-header: 30;    --pa-z-menu: 40;      --pa-z-modal: 50;
  --pa-z-command: 60;   --pa-z-toast: 70;

  /* layout */
  --pa-panel-width: 360px;      /* painel lateral direito */
  --pa-rail-width: 56px;        /* nova barra de navegação (Trilha IA) */
  --pa-inset-edge: 10px;        /* respiro do HUD contra a borda da tela */

  /* controles — padronizar botões/inputs (hoje cada um define o seu) */
  --pa-control-h-sm: 26px;  --pa-control-h-md: 32px;  --pa-control-h-lg: 40px;
  --pa-hit-min: 44px;       /* alvo mínimo de toque no mobile */

  /* foco de teclado — HOJE NÃO EXISTE; obrigatório para acessibilidade */
  --pa-focus-ring: 0 0 0 2px var(--pa-bg-void), 0 0 0 4px var(--pa-series-official);
}
```

Depois faça um passe de refactor trocando os literais pelos tokens (comece por
`HudHeader.vue`, `HudPanel.vue`, `MapCompass.vue`, `MonitoringPanel.vue`). Não é
mudança visual — é dívida técnica que impede o resto do plano de ser
consistente. Verifique pixel-a-pixel via screenshot antes/depois.

### ID-3 · Regras de cor escritas (semântica travada)

No `docs/design-system.md`, tabele e **congele** o significado de cada série (o
código já usa, mas ninguém escreveu a regra):

| Token | Papel | Regra de uso |
|---|---|---|
| `--pa-series-official` (ciano) | Poder **oficial** / seleção / ação primária | Uma cor de acento por contexto. Ações neutras. |
| `--pa-series-hidden` (âmbar) | Influência **oculta/real** | Reservado. Nunca usar âmbar por estética — só para a dimensão oculta e para o Console (que é "outra ferramenta"). |
| `--pa-demo-pop` / `--pa-demo-gdp` | Visão demográfica (pop/PIB) | Só dentro do modo demográfico; não vaza para a UI de influência. |
| `--pa-confidence-high/medium/low` | **Status do dado** | Sempre que houver número estimado. Verde=alto, amarelo=médio, vermelho=baixo. |
| `--pa-danger` | Erro/alerta do sistema | Nunca confundir com confidence-low. |

### ID-4 · Escala tipográfica e iconografia

- **Tipo:** documentar a escala existente (`--pa-text-2xs`…`--pa-text-xl`) com
  papéis (label de HUD = `2xs` tracked +0.18em uppercase mono; readout = `sm`;
  título de painel = `lg`; brand = `xl`). Regra: **números sempre em `--pa-font-data`
  com `tabular-nums`** (já há `.pa-data`; garanta uso em todo lugar com número).
- **Ícones:** hoje é um mix de glyphs Unicode (`⌖`, `►`, `▲▼◄`) e SVGs soltos
  (setores em `lib/sectorIcons.ts`). **Decisão a tomar e registrar:** manter os
  glyphs Unicode como vocabulário de *readout/telemetria* (são parte da alma
  HUD) **e** adotar UM set de ícones de traço para affordances de UI
  (nav, ações, close). Recomendação: um set stroke geométrico 1.5–2px (ex.:
  Lucide, self-hosted como as fontes, sem CDN — coerente com o README). Padronizar
  tamanho: 16px em listas densas, 20px em UI, 24px em headers.

### ID-5 · Catálogo de componentes + estados faltantes

Inventarie os primitivos que já existem e complete seus estados. Componentes
atuais em `components/hud`, `components/rankings`, `components/shared`:

- `HudPanel` + `CornerBracket` (superfície canônica)
- `RankingBarItem` / `RankingBarList` / `RankingColumn`
- `ConfidenceBadge`, `SourceCitationTag`
- `KpiTile`, `BarTable`, `IndicatorGrid`, `AnimatedCounter`, `DecryptedText`
- Botões do header, `MapCompass`, `MonitoringPanel`

**Padronizar e completar:**

1. **Botão** — hoje `.national-btn` vive no `HudHeader`. Extrair um
   `components/ui/HudButton.vue` com variantes (`ghost` ciano / `ghost` âmbar /
   `solid`) e todos os estados: default, hover (`--pa-glow-*`), **focus-visible
   (`--pa-focus-ring` — hoje inexistente)**, active (scale 0.98), disabled.
2. **Input / campo de busca** — não existe ainda; a Trilha IA precisa. Criar
   `HudInput.vue` seguindo a mesma borda ciano + focus ring.
3. **Badge/Tag** — unificar `ConfidenceBadge` e `SourceCitationTag` sob um
   padrão de chip (pill é aceitável só aqui).
4. **Modal/Popover/Toast** — não existem; a Trilha PROD precisa (salvar análise,
   confirmar, feedback). Criar seguindo `--pa-z-modal/-toast` e o overlay
   escuro (void a 40%, sem blur — regra do ARCHITECTURE de superfície).

### ID-6 · Styleguide vivo (rota `/estilo`)

Criar terceira rota `screens/StyleGuideScreen.vue` (lazy, fora do bundle
principal, como o `/dados`) que renderiza cada token e cada componente em todos
os estados — um "Storybook caseiro" no mesmo espírito dos gráficos SVG à mão do
console. Serve como QA visual e como documentação executável. Não linkar no nav
de produção (ou esconder atrás de `?dev`).

**Verificação da Trilha ID:** `pnpm build` + `pnpm test` verdes; nenhum literal
de espaçamento/z-index sobrando nos componentes migrados; `/estilo` mostra todos
os estados incl. focus-visible; screenshots antes/depois provam zero regressão
visual nas telas existentes.

---

## Trilha IA — Reorganizar a navegação e a estrutura

**Objetivo:** resolver a mistura de modelos mentais e destravar busca,
comparação e "salvar análise". O mapa continua sendo a casa; muda como se navega
por ele.

### IA-1 · Novo modelo de navegação

Substituir os 4 botões-irmãos do header por uma estrutura de dois níveis:

```
+--------------------------------------------------------------+
| [rail]  HEADER: brand · readout · busca(Ctrl-K) · compartilhar|
|  M  |                                                         |
|  C  |                MAPA (canvas — a casa)                   |
|  D  |                                                         |
|  ?  |   painel lateral (contextual à seleção/lente)          |
+--------------------------------------------------------------+
```

- **Rail vertical à esquerda** (`--pa-rail-width`, ícone + tooltip): destinos
  primários, não lentes.
  - **Mapa** (`/`) — a casa.
  - **Comparar** (`/comparar`) — bandeja de comparação (IA-3).
  - **Console de Dados** (`/dados`) — já existe.
  - **Metodologia / Sobre** (`/sobre`) — abriga a escala de influência
    (`PowerScaleFormula`), a explicação das dimensões e o disclaimer. Tira o
    peso conceitual do mapa e serve o público "curioso" e o jornalista.
- **As três "visões" viram LENTES**, não destinos. Dentro do Mapa, um seletor de
  lente (segmented control no header ou topo do painel de camadas):
  **Influência · Comércio · Demografia**. É o que elas de fato são — camadas de
  dado sobre o mesmo globo. Isso simplifica o `selection` store
  (`demographicView` vira um enum `lens: 'influence'|'trade'|'demographic'`).
- **Painel de Camadas** — unificar `MapLegend` + os toggles hoje dispersos
  (comércio exporta/importa, setas de fluxo, partidos, relevo) num único painel
  colapsável de camadas com a legenda embutida.

> Isto é uma *proposta* — o Arthur está aberto a reestruturar, não obrigado.
> Se preferir manter os destinos como estão, os ganhos abaixo (busca, comparar,
> salvar) ainda valem isoladamente; adote-os primeiro e reavalie o rail depois.

### IA-2 · Busca / paleta de comando (Ctrl-K) — **maior ganho isolado**

Um `CommandPalette.vue` (overlay `--pa-z-command`) que busca e navega para:
região (UF/BR), país (backdrop mundial), município, entidade de ranking,
dataset do console, e comandos ("trocar lente", "salvar análise"). Alimentado
pelos stores já existentes (`rankings`, `indicators`, `comercio`, `catalog`).
Resolve sozinho a tarefa "buscar entidade específica" e acelera todas as outras.
Deep-link continua valendo (`?region=`).

### IA-3 · Estado da análise na URL + salvar/compartilhar

Hoje só `?region=` é serializado. Ampliar para **um estado de análise completo**
na query string: `region`, `lens`, camadas ativas, câmera (bearing/pitch),
métrica demográfica, ano (quando houver timeline). Com isso:

- **Compartilhar** (botão no header) copia a URL que reconstrói a tela exata.
- **Salvar análise** persiste esse estado nomeado em `localStorage` (store novo
  `savedViews`), listado no rail. É o embrião do SaaS: quando houver conta, o
  mesmo store sincroniza com backend, sem mudar a UI.

**Verificação da Trilha IA:** navegar por rail e paleta sem tocar o mouse;
`lens` troca camadas/legenda/menu como antes; URL reconstrói a análise num reload
limpo; view salva reaparece; `pnpm test` cobre a serialização do estado.

---

## Trilha PROD — Features que fecham as tarefas do usuário

Cada item é uma fase mergeável sozinha, no padrão de branch/commit do `PLAN.md`.

### PROD-1 · Sistema de proveniência e estado do dado (fazer primeiro)

Com dados **mistos**, isto é identidade + confiança de produto ao mesmo tempo.
Tornar `SourceCitationTag` + `ConfidenceBadge` cidadãos de primeira classe e
adicionar um **selo de origem do dado** em três estados, num token/componente
único reutilizado em todo número:

- `REAL` (verde) — fonte oficial verificável (IBGE, Comex, Tesouro…). Mostra a
  fonte e a data.
- `SIMULADO` (âmbar tracejado) — placeholder de desenvolvimento.
- `EM REVISÃO` (amarelo) — candidato do pipeline, ainda não publicado (F6).

Um `DataProvenanceChip.vue` + uma legenda de confiança no painel de camadas.
Mantém a regra de conteúdo (§5) intacta e é exatamente o que o jornalista/analista
precisa para confiar. O banner global permanece.

### PROD-2 · Comparar (bandeja de comparação)

"Fixar" até 4 regiões/entidades (do mapa, do ranking ou da paleta) numa bandeja
e abrir `/comparar`: colunas lado a lado com os mesmos indicadores (pop, PIB,
fiscal, ranking de influência, breakdown C/A/I da escala). Reusa
`IndicatorGrid`, `RankingBarList`, `PowerScaleFormula`. Fecha "comparar
entidades/estados/países".

### PROD-3 · Escala de influência como lente de primeira classe

A escala (0–100, `0.34·C + 0.33·A + 0.33·I`) hoje aparece só no card nacional.
Como o Arthur a quer como "uma camada entre várias", promovê-la a:
- Um **breakdown C/A/I visual** (três barras) em cada entidade que tenha score,
  com tooltip explicando cada pilar (linka para `/sobre`).
- Um **modo de colorir o mapa pela escala** quando a lente Influência estiver
  ativa (choropleth por score agregado), com legenda de rampa.
- Sempre acompanhada do selo de proveniência (PROD-1) — score simulado é
  marcado como tal.

### PROD-4 · Linha do tempo / evolução (depende de dado)

Componente `TimeScrubber.vue` no rodapé que varre um eixo temporal e reanima
colunas/rankings. **Só entra quando houver dado com dimensão temporal** (Comex
tem série anual; IBGE Censo é pontual; rankings de influência dependem do
pipeline F5c/F6). Implementar primeiro com a série de comércio exterior
(dado real, anual) como piloto; expandir conforme os datasets ganharem histórico.
Marcar claramente quando uma métrica não tem série (mostra só o ano corrente).

### PROD-5 · Onboarding / primeiro acesso

Público inclui "curioso" e "portfólio": um usuário novo cai num HUD denso sem
saber o que é. Um overlay de boas-vindas (dismissível, lembrado em `localStorage`)
em 3–4 passos: o que é o PowerAtlas, o que é a escala de influência, que os
dados são mistos (real + simulado, marcados), e como navegar (Ctrl-K). Reusa o
`DecryptedText` para manter o tom. Não bloquear o mapa depois do primeiro dismiss.

### PROD-6 · Exportar análise

Estender o export do console (CSV/JSON, já existe) para o mapa: exportar a região
selecionada / a comparação como CSV/JSON e como **imagem PNG** do estado atual do
HUD (snapshot do canvas + painel) para uso em reportagem/portfólio. Fecha
"salvar/exportar análises".

### PROD-7 (futuro, flag) · Fundações de SaaS

Não construir agora; **desenhar o seam**. Contas + sincronização das views
salvas + limites por plano. O `savedViews` store (IA-3) e o gate de admin já
existente (`ARCHITECTURE §2.11`) são os pontos de entrada. Manter atrás de flag
em `lib/features.ts`, como o `HIDDEN_INFLUENCE_ENABLED`.

---

## Ordem de execução recomendada

1. **ID-2** (tokens) e **ID-5/ID-1/ID-3** (botão+focus, princípios, regras de cor)
   — base de tudo, baixo risco.
2. **PROD-1** (proveniência) — pequeno, alto valor, e é meio-caminho da
   identidade de confiança.
3. **IA-2** (busca Ctrl-K) — maior ganho de usabilidade isolado.
4. **IA-3** (estado na URL + salvar/compartilhar).
5. **ID-6** (`/estilo`) — pode entrar em paralelo a qualquer momento.
6. **IA-1** (rail + lentes) — refactor maior; fazer depois que os componentes
   novos existirem.
7. **PROD-2, PROD-3, PROD-5, PROD-6** — features, em qualquer ordem.
8. **PROD-4** (timeline) quando o dado permitir; **PROD-7** só como seam.

## Convenções e verificação (reusar as do repo)

- Commits: `tipo(escopo): descrição curta em pt-BR` (ver `PLAN.md` §2). Sem
  co-autoria de IA.
- Branch por fase a partir de `develop`, merge `--no-ff`; release na `main` com
  tag quando fechar um conjunto coeso.
- Regra de conteúdo (§5 ARCHITECTURE) **inegociável**: entidades de poder oculto
  seguem fictícias; banner de dados simulados permanece; PROD-1 apenas *rotula*
  o que já é real vs. simulado — não promove nada a real.
- Toda fase: `pnpm build` + `pnpm test` verdes, checklist de QA do README,
  varredura de null bytes, e (se tocar UI) screenshot antes/depois provando
  ausência de regressão.
- Gotchas de Windows/Vite/deck.gl: ver `PLAN.md` §2 — não regredir
  `server.host`, `optimizeDeps`, versões lockstep do deck.gl.
