# Sistema de design "Tactical HUD"

Fonte de verdade textual da identidade visual do PowerAtlas. O arquivo
executavel e `apps/web/src/styles/tokens.css`: este documento registra o que
o CSS sozinho nao conta (principios, semantica das cores, regras de uso,
estado da migracao). Companions: `ARCHITECTURE.md` par. 2.3 (como os tokens
chegam a CSS, Tailwind e deck.gl sem divergir), `docs/map-layers.md` (o que
cada camada desenha) e `PLAN-IDENTIDADE.md` na raiz (plano das trilhas
ID/IA/PROD que originou este documento).

## 1. Principios

1. **Instrumento, nao decoracao.** Cada pixel serve leitura de dado. Glow e
   contido; nada brilha sem hierarquia que justifique.
2. **O escuro e o palco.** O void (`--pa-bg-void`) e o fundo de tudo;
   superficies sobem por borda + blur + glow sutil, nunca por sombra pesada.
3. **Ciano = oficial, ambar = oculto/influencia. Sempre.** A cor carrega
   semantica de dimensao de dado, nunca e escolha estetica (tabela na
   secao 3).
4. **O dado mostra a fonte.** Todo numero exibe origem e status de
   confianca (`ConfidenceBadge`, `SourceCitationTag`; o selo unificado de
   proveniencia chega na PROD-1).

## 2. Tokens

`tokens.css` tem tres consumidores, zero duplicacao: CSS de componente via
`var()`, utilitarias Tailwind via `@theme inline` em `main.css`, e o deck.gl
em runtime via `getComputedStyle` (`src/lib/palette.ts`). Nunca hardcode um
valor que exista como token.

Grupos (prefixo `--pa-`):

| Grupo | Tokens | Nota de uso |
| --- | --- | --- |
| Superficies | `bg-void`, `bg-deep`, `bg-panel`, `bg-inset` | painel sempre com borda ciano + blur |
| Estrutura | `border-cyan`, `border-cyan-strong`, `border-faint` | 1px sempre |
| Series | `series-official`, `series-hidden` | semantica travada (secao 3) |
| Demografia | `demo-pop`, `demo-gdp` | so no modo demografico |
| Confianca | `confidence-high/medium/low` | status de dado estimado |
| Alerta | `danger` | erro de sistema, nunca confianca |
| Texto | `text-primary`, `text-dim`, `text-faint` | |
| Tipografia | `font-data`, `font-label`, `text-2xs..xl` | papeis na secao 4 |
| Motion | `ease-hud`, `dur-fast/med/slow` | gated por reduced-motion |
| Glow | `glow-cyan`, `glow-amber` | hover e destaque |
| Espacamento | `space-05..10` | base 4px, meios-passos de 2px |
| Raio | `radius-none/sm/md/pill` | HUD e anguloso; pill so em chip/ping |
| Empilhamento | `z-map-hint..z-toast` | escada completa na secao 5 |
| Layout | `inset-edge`, `panel-width`, `rail-width` | |
| Controles | `control-h-sm/md/lg`, `hit-min` | md = ctrl do compasso |
| Icones | `icon-sm/md/lg` | 16 listas densas, 20 UI, 24 headers |
| Foco | `focus-ring` | via `.pa-focusable`, secao 6 |

Regras de espacamento:

- Escala base 4px com meios-passos de 2px (`05`=2, `15`=6, `25`=10,
  `35`=14, `45`=18) porque a densidade real do HUD anda em incrementos de
  2px. A escala default do Tailwind tambem e base 4px, entao `gap-4` numa
  template e `--pa-space-4` no CSS sao o mesmo valor: nao ha como divergir.
- Ancoras de posicao derivadas da geometria de vizinhos (ex.: `bottom: 52px`
  do compasso limpando o rodape, `top: 96px` abaixo do header, `left: 22px`
  do dock esquerdo) nao entram na escala: ficam literais com comentario
  `anchor`. Se a geometria do vizinho mudar, o valor muda junto.
- Ajustes finos herdados fora da escala (chips `1px 6px`, `3px 8px`,
  `5px 10px`) ficam literais com comentario e serao normalizados quando o
  componente ganhar versao canonica (ex.: HudIconButton para o compasso).
- Codigo novo usa somente a escala. Excecao exige comentario no proprio CSS.
- Efeitos (text-shadow, raios de blur, geometria decorativa como a regua da
  moldura) nao sao espacamento e ficam no componente.

## 3. Cor: semantica travada

| Token | Papel | Regra de uso |
| --- | --- | --- |
| `--pa-series-official` (ciano) | Poder oficial, selecao, acao primaria | Uma cor de acento por contexto. Acoes neutras sao cianas. |
| `--pa-series-hidden` (ambar) | Influencia oculta/real e o Console de Dados | Reservado. Nunca usar ambar por estetica. |
| `--pa-demo-pop` / `--pa-demo-gdp` | Visao demografica (populacao/PIB) | So dentro do modo demografico; nao vaza para a UI de influencia. |
| `--pa-confidence-high/medium/low` | Status do dado (verde/amarelo/vermelho) | Sempre que houver numero estimado. |
| `--pa-danger` | Erro/alerta do sistema | Nunca confundir com `confidence-low`. |

Numeros sempre em `--pa-font-data` com `tabular-nums` (classe `.pa-data`).
Labels de HUD sempre `.pa-label` (2xs, tracking 0.18em, uppercase, mono).

O selo de proveniencia (`ui/DataProvenanceChip`, PROD-1) mapeia esses
papeis sem cor nova, porque proveniencia E status de dado: `REAL` usa
`confidence-high`, `EM REVISAO` usa `confidence-medium`, e `SIMULADO` usa
`series-hidden` com borda tracejada (a assinatura do mundo placeholder).

## 4. Tipografia e iconografia

Papeis da escala tipografica:

| Token | Papel |
| --- | --- |
| `--pa-text-2xs` | label de HUD (via `.pa-label`) e botoes |
| `--pa-text-xs` | listas densas, chips |
| `--pa-text-sm` | readouts (header, relogio) |
| `--pa-text-md` | corpo/valores em painel |
| `--pa-text-lg` | titulo de painel |
| `--pa-text-xl` | brand |

Iconografia (decisao ID-4, registrada em 2026-08-16):

- Os glyphs Unicode (`⌖`, `►`, `▲`, `▼`, `◄`, `[+]`, `[-]`) sao o
  vocabulario de readout/telemetria do HUD e ficam. Sao texto, nao icone.
- Affordances de UI novas (navegacao, fechar, acoes do rail da IA-1) usarao
  UM set de icones de traco geometrico 1.5 a 2px, self-hosted como as
  fontes, sem CDN. Recomendacao: Lucide. Adotar junto com o rail; nao ha
  consumidor antes disso.
- Tamanhos so via `--pa-icon-sm/md/lg` (16/20/24). A agulha do compasso ja
  consome `icon-md`.
- `CornerBracket` e as reguas da moldura sao assinatura visual da superficie
  HUD, nao icones.

## 5. Empilhamento (escada de z-index)

Os valores espelham a pilha real. A textura CRT e a vinheta ficam ACIMA do
header de proposito (sao a "tela" do instrumento). Renumerar so se a escada
inteira se mover junta.

| Token | Valor | Consumidores hoje |
| --- | --- | --- |
| `--pa-z-map-hint` | 15 | hint de selecao (MapScreen, pendente) |
| `--pa-z-map-overlay` | 16 | formula da escala (.scale-slot); chrome do MapView pendente |
| `--pa-z-hud` | 18 | relogio, compasso, monitoramento, tooltip, ficha demografica, dock esquerdo (MapScreen pendente) |
| `--pa-z-panel` | 20 | painel lateral (MapScreen pendente), menu demografico |
| `--pa-z-footer` | 25 | disclaimer (MapScreen, pendente) |
| `--pa-z-frame` | 30 | moldura fixa (HudFrame) |
| `--pa-z-header` | 32 | header |
| `--pa-z-scan-fx` | 35 | varredura de clique (MapScanEffect) |
| `--pa-z-scanline` | 40 | textura CRT + vinheta (ScanlineOverlay) |
| `--pa-z-boot` | 50 | overlay de boot (MapScreen, pendente) |
| `--pa-z-modal` | 60 | ImportDialog; AdminLoginDialog pendente |
| `--pa-z-command` | 70 | paleta Ctrl-K (`ui/CommandPalette`) |
| `--pa-z-toast` | 80 | reservado: toasts |

Notas:

- "Pendente" = o arquivo carrega trabalho em andamento nao commitado nesta
  data; migrar o literal quando aquele trabalho fechar, sem mudar o valor.
- `ScanBand.vue` (z 0) esta desmontado desde a v0.15.0: a faixa de scan
  virou o efeito local do `OceanGridLayer` em WebGL. O arquivo e candidato a
  remocao; nao recebeu token.

## 6. Componentes

Primitivos existentes e estados:

| Componente | Papel | Estados faltantes |
| --- | --- | --- |
| `ui/HudButton` | botao canonico do HUD | completo (esta fase) |
| `ui/DataProvenanceChip` | selo REAL/SIMULADO/EM REVISAO | completo (PROD-1); EM REVISAO sem consumidor ate a F6 |
| `ui/HudInput` | input canonico (busca) | completo (IA-2) |
| `ui/CommandPalette` | busca e comandos via Ctrl-K | completo (IA-2/IA-3); nucleo puro em `lib/paletteIndex.ts` |
| `ui/OnboardingOverlay` | boas-vindas em 4 passos (PROD-5) | completo; reabre por VER INTRODUCAO na paleta |
| `ui/CompareTray` | bandeja de comparacao no dock esquerdo (PROD-2) | completo; ate 4 regioes |
| `ui/NavRail` | rail vertical de destinos (IA-1a) | completo; icones stroke desenhados a mao; escondido no mobile |
| `ui/LensSwitch` | seletor segmentado de lente no header (IA-1b) | completo; segmento ativo na linguagem do HudButton ativo |
| `hud/HudPanel` + `CornerBracket` | superficie canonica | ok |
| `hud/HudFrame`, `HudClock`, `MonitoringPanel` | chrome do HUD | ok |
| `map/MapCompass` | controle de camera | normalizar chips no futuro HudIconButton |
| `rankings/RankingBarItem/List/Column` | rankings | focus-visible quando virarem alvo de teclado |
| `rankings/ConfidenceBadge`, `shared/SourceCitationTag` | proveniencia | familia de chip alinhada (radius-sm); fusao total so se a PROD-2 pedir |
| `shared/KpiTile`, `BarTable`, `IndicatorGrid`, `AnimatedCounter`, `DecryptedText` | leitura de dado | ok |
| `dashboard/*` (console) | segunda ferramenta, acento ambar | herdara HudInput/Modal/Toast |

### HudButton (`components/ui/HudButton.vue`)

- API: `tag` (default `button`; aceita `RouterLink` ou `'a'`), `accent`
  (`cyan` default, `amber` reservado para console/dimensao oculta),
  `active` (estado solido de toggle ligado). Demais atributos caem no
  elemento raiz (`type`, `disabled`, `to`, `title`, `aria-*`).
- Estados: default (ghost), hover (glow), focus-visible (anel), active
  (scale 0.98), disabled (texto e borda faint), ativo (fundo ciano solido).
- Largura pelo conteudo; altura natural de 29px (herdada do header). A
  normalizacao para `--pa-control-h-sm` (26px) acontece quando o styleguide
  `/estilo` (ID-6) permitir validar o ajuste visualmente.
- Uso como botao exige `type="button"` explicito no chamador.

### Foco de teclado

Todo elemento interativo do HUD recebe a classe `.pa-focusable`
(`main.css`): anel `--pa-focus-ring` somente em `:focus-visible`, para
clique de mouse nao acender nada. Aplicada em: HudButton, controles do
compasso, cabecalho do monitoramento. Componentes novos nascem com ela.

### Pendentes (fases seguintes do PLAN-IDENTIDADE)

- Affordance de busca no header (botao BUSCA): entra com o redesenho do
  header na IA-1; ate la a paleta abre so por Ctrl-K.
- Busca de municipios na paleta: espera o indice unico
  (`indicators/municipios-all.json`) fechar na outra frente.
- `Modal`/`Popover`/`Toast` (PROD): `--pa-z-modal`/`--pa-z-toast`, overlay
  void a 40% sem blur.
- `HudIconButton` (compasso): normaliza os chips fora da escala.

## 7. Estado da migracao (2026-08-16)

Migrados por completo (espacamento + z + foco): `HudHeader`, `HudPanel`,
`MapCompass`, `MonitoringPanel`, `HudFrame`, `HudClock`. Migrados so no
z-index: `ScanlineOverlay`, `MapScanEffect`, `DemografiaMenu`,
`DemografiaCard`, `MapTooltip`, `ImportDialog`.

Verificacao desta fase: snapshot de `getComputedStyle` (38 propriedades por
elemento, header/botoes/moldura/relogio/compasso/scanlines/painel) antes e
depois do refactor, em `/` e `/?region=SP`: zero diferencas. Anel de foco
validado com Tab real no browser. `pnpm build` e `pnpm test` verdes.

PROD-1 (mesma data): `DataProvenanceChip` consumido por `IndicatorGrid`
(REAL, indicadores IBGE), `DemografiaMenu` (REAL, fonte da visao
demografica), `TradePartnerCard` (REAL, Comex + ano) e `RankingColumn`
(SIMULADO, entidades ficticias). O estado EM REVISAO fica sem consumidor
ate a F6. O banner global de dados simulados permanece; a regra de conteudo
nao muda.

IA-2 (2026-08-17): paleta Ctrl-K montada no `App.vue` acima do router.
Busca regioes (BR + 27 UFs), parceiros comerciais, entidades ficticias dos
rankings (grupo rotulado SIMULADO) e comandos; cada acao espelha um fluxo
existente do MapScreen/MapCompass via selection store, nada de logica nova
de camera. O listener global roda em fase de captura para o Esc fechar a
paleta antes da cascata de Esc do MapScreen. Nucleo de ranking puro e
testado em `lib/paletteIndex.ts` (normalize sem acentos, score por
prefixo/palavra/substring/keyword, cap por grupo).

IA-1a (2026-08-17): rail de navegacao + rota /sobre. `ui/NavRail` fixo a
esquerda em todas as rotas (destinos: mapa, comparar, dados, sobre;
`--pa-rail-width` finalmente consumido), telas de fluxo normal deslocam via
`.with-rail` no App e o palco do mapa desloca o proprio shell
(`inset-left`); a moldura e o efeito de varredura viraram absolutos para
compartilhar a origem do canvas. `/sobre` abriga a formula da escala, os
patamares de autoridade (importados de lib/powerScore, sem duplicar), as
duas dimensoes e a politica de dados mistos com os selos. Icones do rail:
quatro strokes desenhados a mao (a adocao de um set completo, decisao ID-4,
espera a contagem de icones crescer). Mobile esconde o rail; o header segue
como navegacao ate a IA-1b (lentes). Restante da IA-1: lentes no header
(IA-1b, refatora o selection store) e painel unico de camadas (IA-1c).

IA-1b (2026-08-17): as tres visoes viraram LENTES. O selection store ganhou
`lens: 'influence' | 'trade' | 'demographic'` com `demographicView` mantido
como alias computado (nenhum dos ~30 consumidores precisou mudar) e
`setLens` espelhando exatamente as acoes antigas do header; selecionar
regiao sai da lente de comercio, abrir parceiro entra nela, goHome volta a
influencia. O header trocou os tres botoes de visao e o link do console por
`ui/LensSwitch` (INFLUENCIA / COMERCIO / DEMOGRAFIA); destinos vivem no
rail. A URL aprendeu `view=comercio` (analysisUrl + stores analysis). A
paleta fala em lentes (LENTE INFLUENCIA/COMERCIO/DEMOGRAFIA, com os nomes
antigos como keywords de busca).

IA-1c (2026-08-18): o painel unico de camadas ja tinha nascido no proprio
MapLegend (titulo LEGENDA // CAMADAS, colapsavel com estado lembrado,
redimensionavel, toggles de comercio/direcoes/setas, choropleth de partidos
com lazy load, vocacao e legenda demografica); a fase fechou a metade
pendente da PROD-1: a chave de ORIGEM DO DADO embutida no painel, com os
tres selos de proveniencia decodificados e os tres pontos de confianca.
Com isso a Trilha IA-1 (rail + lentes + camadas) esta completa.

Vocacao no drill de influencia (2026-08-18, follow-up da trilha de
vocacao): os icones 3D municipais que so apareciam no recorte demografico
agora tambem aparecem ao selecionar um estado na lente influencia (mesmo
ranking por VAB e dominancia por quociente locacional, top 40, helper
compartilhado municipalIconsFor); o payload demografico carrega junto na
selecao do estado (cacheado). BR selecionado nao mostra (seriam 5.570).

PROD-6 (2026-08-18): exportar a analise. `lib/exportAnalysis` monta CSV
(dois blocos: indicadores REAL · IBGE e entidades SIMULADO, cada linha com
a coluna de proveniencia) e JSON (com bloco de proveniencia explicito) por
cima dos serializadores do console; botoes no /comparar e comandos
contextuais na paleta (EXPORTAR REGIAO CSV/JSON com regiao selecionada,
EXPORTAR PNG DO MAPA na rota do mapa). O PNG compoe o canvas do maplibre
(lido dentro do proprio evento de render: preserveDrawingBuffer off) com o
canvas do deck (luma 9 preserva por default) sobre o void, com faixas de
branding e o disclaimer desenhadas na propria imagem; painel DOM fica fora
do snapshot por decisao (sem dependencia de html-to-image). Fallback com
timeout evita travar em abas ocultas.

PROD-3 (2026-08-18): a escala de poder como camada do mapa. Toggle
`powerScaleVisible` no selection (exclusivo com o choropleth partidario:
tintas concorrentes), estados pintados numa rampa ciano com piso pelo score
0-100 do agente oficial numero 1 da regiao (agregacao documentada e
simulada por natureza: o selo SIMULADO acompanha a legenda de rampa no
painel de camadas), `escala=1` na URL das analises e comando na paleta que
cai para a lente influencia ao ligar. Fill composto sobre o void como toda
area; testes no deckLayers (rampa, piso, uf sem score) e exclusividade no
selection.

PROD-2 (2026-08-17): comparacao lado a lado. Store `compare` (ate 4
regioes), bandeja no dock esquerdo do mapa (`ui/CompareTray`), botao
FIXAR/FIXADO no painel de regiao, comandos contextuais na paleta e a rota
lazy `/comparar` com colunas reusando exatamente IndicatorGrid e
RankingColumn (os selos da PROD-1 vem junto de graca). Deep link
`/comparar?ids=SP,RS` semeia a bandeja e a URL acompanha cada pin/unpin.
PowerScaleFormula virou card estatico (quem posiciona e o consumidor:
`.scale-slot` no MapScreen, rodape no comparar). Fiscal por UF ficou de
fora: nao ha agregado publicado por regiao; entra se o warehouse ganhar
esse fato.

PROD-5 (2026-08-17): onboarding de primeiro acesso
(`ui/OnboardingOverlay`, montado no App.vue e restrito a rota do mapa).
Quatro passos com DecryptedText no titulo e os selos da PROD-1
demonstrados ao vivo; dispensa lembrada em `localStorage`
(`stores/onboarding.ts`) e nunca volta a bloquear o mapa; Esc dispensa em
fase de captura (a paleta, montada antes, vence o Esc quando aberta via
stopImmediatePropagation); reabre pela paleta com VER INTRODUCAO.

ID-6 (2026-08-17): styleguide vivo em `/estilo`
(`screens/StyleGuideScreen.vue`, rota lazy fora do nav de producao). Le os
valores dos tokens do :root computado em runtime, entao a pagina nao
diverge do tokens.css; mostra cores, tipografia, espacamento, raio,
controles, icones, escada de z, motion/glow e os componentes ui/ em todos
os estados (o focus-visible aparece simulado; o real continua so por
teclado).

IA-3 (2026-08-17): estado da analise na URL e analises salvas. Serializador
puro em `lib/analysisUrl.ts` (region, parceiro, view demografica com
metrica e recorte, direcoes de comercio, setas, brg/pit dos overrides;
round-trip testado). O store `analysis` faz snapshot/apply espelhando os
mesmos fluxos da paleta; `useAnalysisSync` (chamado no App.vue) aplica a
query no boot e reescreve a URL via `router.replace` com debounce, entao a
barra de endereco e sempre um link compartilhavel. O deep-link antigo
`/?region=` continua valendo (mesmo parametro). Views salvas persistem em
`localStorage` (`stores/savedViews.ts`, semente do SaaS da PROD-7) e
aparecem na paleta como grupo proprio, com SALVAR ANALISE (o input vira
campo de nome), COPIAR LINK DA ANALISE e DEL para remover.
