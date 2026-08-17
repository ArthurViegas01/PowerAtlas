<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import HudPanel from '@/components/hud/HudPanel.vue'
import ConfidenceBadge from '@/components/rankings/ConfidenceBadge.vue'
import SourceCitationTag from '@/components/shared/SourceCitationTag.vue'
import DataProvenanceChip from '@/components/ui/DataProvenanceChip.vue'
import HudButton from '@/components/ui/HudButton.vue'
import HudInput from '@/components/ui/HudInput.vue'

/**
 * Living styleguide (ID-6): every token and component state on one lazy
 * route, so visual QA and documentation are the same artifact. On purpose it
 * is NOT linked from the production nav; reach it at /estilo. Token values
 * are read from the computed :root at mount, so this page cannot drift from
 * tokens.css.
 */

const COLOR_TOKENS = [
  '--pa-bg-void',
  '--pa-bg-deep',
  '--pa-bg-panel',
  '--pa-bg-inset',
  '--pa-series-official',
  '--pa-series-hidden',
  '--pa-demo-pop',
  '--pa-demo-gdp',
  '--pa-confidence-high',
  '--pa-confidence-medium',
  '--pa-confidence-low',
  '--pa-danger',
  '--pa-text-primary',
  '--pa-text-dim',
  '--pa-text-faint',
]

const SPACE_TOKENS = [
  '--pa-space-05',
  '--pa-space-1',
  '--pa-space-15',
  '--pa-space-2',
  '--pa-space-25',
  '--pa-space-3',
  '--pa-space-35',
  '--pa-space-4',
  '--pa-space-45',
  '--pa-space-5',
  '--pa-space-6',
  '--pa-space-8',
  '--pa-space-10',
]

const TYPE_TOKENS = [
  { token: '--pa-text-2xs', role: 'LABEL DE HUD / BOTOES' },
  { token: '--pa-text-xs', role: 'LISTAS DENSAS / CHIPS' },
  { token: '--pa-text-sm', role: 'READOUTS' },
  { token: '--pa-text-md', role: 'CORPO / VALORES' },
  { token: '--pa-text-lg', role: 'TITULO DE PAINEL' },
  { token: '--pa-text-xl', role: 'BRAND' },
]

const Z_TOKENS = [
  { token: '--pa-z-map-hint', who: 'hint de seleção' },
  { token: '--pa-z-map-overlay', who: 'chrome do mapa' },
  { token: '--pa-z-hud', who: 'instrumentos (relógio, compasso, monitoramento)' },
  { token: '--pa-z-panel', who: 'painel lateral, menus' },
  { token: '--pa-z-footer', who: 'disclaimer' },
  { token: '--pa-z-frame', who: 'moldura' },
  { token: '--pa-z-header', who: 'header' },
  { token: '--pa-z-scan-fx', who: 'varredura de clique' },
  { token: '--pa-z-scanline', who: 'textura CRT' },
  { token: '--pa-z-boot', who: 'overlay de boot' },
  { token: '--pa-z-modal', who: 'diálogos' },
  { token: '--pa-z-command', who: 'paleta Ctrl-K' },
  { token: '--pa-z-toast', who: 'reservado' },
]

const RADIUS_TOKENS = ['--pa-radius-none', '--pa-radius-sm', '--pa-radius-md', '--pa-radius-pill']
const CONTROL_TOKENS = ['--pa-control-h-sm', '--pa-control-h-md', '--pa-control-h-lg', '--pa-hit-min']
const ICON_TOKENS = ['--pa-icon-sm', '--pa-icon-md', '--pa-icon-lg']
const MOTION_TOKENS = ['--pa-dur-fast', '--pa-dur-med', '--pa-dur-slow', '--pa-ease-hud']

const resolved = ref<Record<string, string>>({})

onMounted(() => {
  const cs = getComputedStyle(document.documentElement)
  const out: Record<string, string> = {}
  for (const token of [
    ...COLOR_TOKENS,
    ...SPACE_TOKENS,
    ...TYPE_TOKENS.map((t) => t.token),
    ...Z_TOKENS.map((t) => t.token),
    ...RADIUS_TOKENS,
    ...CONTROL_TOKENS,
    ...ICON_TOKENS,
    ...MOTION_TOKENS,
  ]) {
    out[token] = cs.getPropertyValue(token).trim()
  }
  resolved.value = out
})

const demoInput = ref('')

const sampleSource = { id: 'sg-ibge', label: 'IBGE · Censo 2022', url: 'https://www.ibge.gov.br' }
</script>

<template>
  <div class="sg">
    <header class="sg-head">
      <div>
        <h1 class="sg-title pa-data">TACTICAL HUD // STYLEGUIDE</h1>
        <p class="pa-label">TOKENS E COMPONENTES EM TODOS OS ESTADOS · DOCS/DESIGN-SYSTEM.MD</p>
      </div>
      <HudButton :tag="RouterLink" to="/">◄ VOLTAR AO MAPA</HudButton>
    </header>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">CORES</h2>
      <div class="sg-swatches">
        <div v-for="token in COLOR_TOKENS" :key="token" class="sg-swatch">
          <span class="sg-swatch-chip" :style="{ background: `var(${token})` }"></span>
          <span class="sg-token pa-data">{{ token }}</span>
          <span class="sg-value pa-data">{{ resolved[token] }}</span>
        </div>
      </div>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">TIPOGRAFIA</h2>
      <div v-for="row in TYPE_TOKENS" :key="row.token" class="sg-type-row">
        <span class="pa-data" :style="{ fontSize: `var(${row.token})` }">POWERATLAS 0123456789</span>
        <span class="sg-token pa-data">{{ row.token }} · {{ resolved[row.token] }}</span>
        <span class="sg-value pa-label">{{ row.role }}</span>
      </div>
      <p class="sg-note pa-label">NUMEROS SEMPRE EM .PA-DATA (TABULAR-NUMS); LABELS EM .PA-LABEL</p>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">ESPAÇAMENTO (BASE 4PX, MEIOS-PASSOS DE 2PX)</h2>
      <div v-for="token in SPACE_TOKENS" :key="token" class="sg-space-row">
        <span class="sg-token pa-data">{{ token }}</span>
        <span class="sg-space-bar" :style="{ width: `var(${token})` }"></span>
        <span class="sg-value pa-data">{{ resolved[token] }}</span>
      </div>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">RAIO · CONTROLES · ÍCONES</h2>
      <div class="sg-row">
        <div v-for="token in RADIUS_TOKENS" :key="token" class="sg-cell">
          <span class="sg-radius-box" :style="{ borderRadius: `var(${token})` }"></span>
          <span class="sg-token pa-data">{{ token }} · {{ resolved[token] }}</span>
        </div>
      </div>
      <div class="sg-row">
        <div v-for="token in CONTROL_TOKENS" :key="token" class="sg-cell">
          <span class="sg-control-box" :style="{ height: `var(${token})` }"></span>
          <span class="sg-token pa-data">{{ token }} · {{ resolved[token] }}</span>
        </div>
      </div>
      <div class="sg-row">
        <div v-for="token in ICON_TOKENS" :key="token" class="sg-cell">
          <span class="sg-icon-box" :style="{ width: `var(${token})`, height: `var(${token})` }"></span>
          <span class="sg-token pa-data">{{ token }} · {{ resolved[token] }}</span>
        </div>
      </div>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">EMPILHAMENTO (Z-INDEX)</h2>
      <table class="sg-table pa-data">
        <tbody>
          <tr v-for="row in Z_TOKENS" :key="row.token">
            <td class="sg-token">{{ row.token }}</td>
            <td class="sg-value">{{ resolved[row.token] }}</td>
            <td class="sg-who pa-label">{{ row.who }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">MOTION E GLOW</h2>
      <div class="sg-row">
        <span v-for="token in MOTION_TOKENS" :key="token" class="sg-token pa-data">
          {{ token }} · {{ resolved[token] }}
        </span>
      </div>
      <div class="sg-row">
        <span class="sg-glow-box" style="box-shadow: var(--pa-glow-cyan)">GLOW-CYAN</span>
        <span class="sg-glow-box sg-glow-box--amber" style="box-shadow: var(--pa-glow-amber)">GLOW-AMBER</span>
      </div>
      <p class="sg-note pa-label">TODA ANIMAÇÃO RESPEITA PREFERS-REDUCED-MOTION (KILL-SWITCH GLOBAL)</p>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">HUDBUTTON · ESTADOS</h2>
      <div class="sg-row">
        <HudButton type="button">DEFAULT</HudButton>
        <HudButton type="button" accent="amber">ACCENT AMBER</HudButton>
        <HudButton type="button" :active="true">ATIVO (TOGGLE ON)</HudButton>
        <HudButton type="button" disabled>DISABLED</HudButton>
        <HudButton type="button" style="box-shadow: var(--pa-focus-ring)">FOCUS-VISIBLE (SIMULADO)</HudButton>
      </div>
      <p class="sg-note pa-label">HOVER = GLOW · ACTIVE = SCALE 0.98 · FOCO REAL SO VIA TECLADO (TAB)</p>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">HUDINPUT</h2>
      <div class="sg-input-row">
        <HudInput v-model="demoInput" placeholder="Placeholder uppercase tracked" />
      </div>
      <p class="sg-note pa-label">MESMA BORDA CIANO + ANEL DE FOCO DO SISTEMA (.PA-FOCUSABLE)</p>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">CHIPS DE PROVENIÊNCIA E CONFIANÇA</h2>
      <div class="sg-row">
        <DataProvenanceChip state="real" label="IBGE · CENSO 2022" />
        <DataProvenanceChip state="simulated" />
        <DataProvenanceChip state="review" />
      </div>
      <div class="sg-row">
        <ConfidenceBadge level="high" />
        <ConfidenceBadge level="medium" />
        <ConfidenceBadge level="low" />
        <SourceCitationTag :source="sampleSource" />
      </div>
    </section>

    <section class="sg-section">
      <h2 class="sg-h2 pa-label">HUDPANEL (SUPERFÍCIE CANÔNICA)</h2>
      <div class="sg-panel-slot">
        <HudPanel title="PAINEL DE EXEMPLO" subtitle="SUBTITULO · BRACKETS DE CANTO · BLUR">
          <p class="sg-panel-copy">
            Corpo do painel com scroll fino. Superfícies sobem por borda, blur e
            glow contido; o void é o palco.
          </p>
        </HudPanel>
      </div>
    </section>

    <footer class="sg-foot pa-label">
      ROTA /ESTILO · FORA DO NAV DE PRODUÇÃO · FONTE DE VERDADE: TOKENS.CSS + DOCS/DESIGN-SYSTEM.MD
    </footer>
  </div>
</template>

<style scoped>
.sg {
  height: 100%;
  padding: var(--pa-space-6) var(--pa-space-8) var(--pa-space-10);
  overflow-y: auto;
  background: var(--pa-bg-void);
  scrollbar-width: thin;
  scrollbar-color: var(--pa-border-cyan) transparent;
}

.sg-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pa-space-4);
  max-width: 960px;
  margin: 0 auto var(--pa-space-8);
}

.sg-title {
  margin: 0 0 var(--pa-space-05);
  font-size: var(--pa-text-xl);
  letter-spacing: 0.18em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 16px rgba(61, 225, 255, 0.45);
}

.sg-section {
  max-width: 960px;
  margin: 0 auto var(--pa-space-8);
  padding: var(--pa-space-4);
  border: 1px solid var(--pa-border-faint);
  background: rgba(61, 225, 255, 0.02);
}

.sg-h2 {
  margin: 0 0 var(--pa-space-4);
  color: var(--pa-series-official);
}

.sg-swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--pa-space-2) var(--pa-space-4);
}

.sg-swatch {
  display: flex;
  align-items: center;
  gap: var(--pa-space-2);
}

.sg-swatch-chip {
  width: var(--pa-icon-lg);
  height: var(--pa-icon-lg);
  flex: none;
  border: 1px solid var(--pa-border-faint);
}

.sg-token {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-primary);
}

.sg-value {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-faint);
}

.sg-type-row {
  display: flex;
  align-items: baseline;
  gap: var(--pa-space-4);
  margin-bottom: var(--pa-space-2);
  color: var(--pa-text-primary);
}

.sg-space-row {
  display: flex;
  align-items: center;
  gap: var(--pa-space-3);
  margin-bottom: var(--pa-space-1);
}

.sg-space-row .sg-token {
  width: 140px;
  flex: none;
}

.sg-space-bar {
  height: var(--pa-space-2);
  flex: none;
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

.sg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pa-space-4);
  margin-bottom: var(--pa-space-3);
}

.sg-cell {
  display: flex;
  align-items: center;
  gap: var(--pa-space-2);
}

.sg-radius-box {
  width: var(--pa-icon-lg);
  height: var(--pa-icon-lg);
  border: 1px solid var(--pa-border-cyan);
}

.sg-control-box {
  width: var(--pa-space-10);
  border: 1px solid var(--pa-border-cyan);
  background: var(--pa-bg-inset);
}

.sg-icon-box {
  border: 1px dashed var(--pa-border-cyan);
}

.sg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--pa-text-2xs);
}

.sg-table td {
  padding: var(--pa-space-05) var(--pa-space-3) var(--pa-space-05) 0;
  border-bottom: 1px solid var(--pa-border-faint);
}

.sg-who {
  color: var(--pa-text-dim);
}

.sg-glow-box {
  padding: var(--pa-space-15) var(--pa-space-3);
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-series-official);
  border: 1px solid var(--pa-border-cyan);
}

.sg-glow-box--amber {
  color: var(--pa-series-hidden);
  border-color: color-mix(in srgb, var(--pa-series-hidden) 45%, transparent);
}

.sg-input-row {
  max-width: 420px;
}

.sg-note {
  margin: var(--pa-space-2) 0 0;
  color: var(--pa-text-faint);
}

.sg-panel-slot {
  max-width: 420px;
  height: 220px;
  display: flex;
}

.sg-panel-slot > * {
  flex: 1;
}

.sg-panel-copy {
  margin: 0;
  font-size: var(--pa-text-sm);
  line-height: 1.6;
  color: var(--pa-text-dim);
}

.sg-foot {
  max-width: 960px;
  margin: 0 auto;
  color: var(--pa-text-faint);
}
</style>
