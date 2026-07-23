<script setup lang="ts">
import { computed } from 'vue'

import { INFLOW_SEGMENTS, OUTFLOW_SEGMENTS, segmentColor } from '@/lib/fiscalSegments'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useSelectionStore } from '@/stores/selection'
import type { DemografiaMetric } from '@/types/demografia'

/** CSS rgb() string for a segment's swatch (band alpha ignored). */
function swatch(def: (typeof OUTFLOW_SEGMENTS)[number]): string {
  const [r, g, b] = segmentColor(def, 255)
  return `rgb(${r} ${g} ${b})`
}

/**
 * Side menu of the demographic view: metric switch (population / PIB),
 * fiscal flow toggles, provenance note and the exit action. Only rendered
 * while the view is on.
 */
const selection = useSelectionStore()
const demografia = useDemografiaStore()
const fiscal = useFiscalStore()

const metrics: { id: DemografiaMetric; label: string; hint: string }[] = [
  { id: 'population', label: 'POPULAÇÃO', hint: 'CENSO 2022' },
  { id: 'gdp', label: 'PIB', hint: 'PIB MUNICÍPIOS 2023' },
]

const sourceLabel = computed(() =>
  demografia.censusYear
    ? `IBGE · CENSO ${demografia.censusYear} · PIB ${demografia.gdpYear}`
    : 'IBGE',
)

/** Fiscal toggles only act on the PIB metric (flows are R$ against R$). */
const fiscalAvailable = computed(
  () => selection.demographicMetric === 'gdp' && fiscal.byCodigo.size > 0,
)

/** The two segmented flow groups shown as collapsible toggle lists. */
const groups = computed(() =>
  (
    [
      { group: 'outflow', title: 'FLUXO DE SAÍDA', hint: 'ARRECADAÇÃO FEDERAL', segments: OUTFLOW_SEGMENTS },
      { group: 'inflow', title: 'FLUXO DE RETORNO', hint: 'REPASSES + EMENDAS', segments: INFLOW_SEGMENTS },
    ] as const
  ).map((g) => ({
    ...g,
    keys: g.segments.map((s) => s.key),
    allOn: g.segments.every((s) => selection.fiscalSegments[s.key]),
    anyOn: g.segments.some((s) => selection.fiscalSegments[s.key]),
  })),
)
</script>

<template>
  <aside v-if="selection.demographicView" class="demo-menu" aria-label="Métrica demográfica">
    <p class="pa-label demo-title">VISÃO DEMOGRÁFICA // MÉTRICA</p>

    <div class="flex flex-col gap-2" role="radiogroup" aria-label="Métrica das colunas">
      <button
        v-for="metric in metrics"
        :key="metric.id"
        class="metric-btn pa-data"
        :class="{
          'metric-btn--active': selection.demographicMetric === metric.id,
          'metric-btn--pop': metric.id === 'population',
          'metric-btn--gdp': metric.id === 'gdp',
        }"
        type="button"
        role="radio"
        :aria-checked="selection.demographicMetric === metric.id"
        @click="selection.setDemographicMetric(metric.id)"
      >
        <span class="metric-mark"></span>
        <span class="metric-label">{{ metric.label }}</span>
        <span class="pa-label metric-hint">{{ metric.hint }}</span>
      </button>
    </div>

    <template v-if="selection.demographicMetric === 'gdp'">
      <p class="pa-label demo-title demo-flows-title">FLUXO FISCAL // {{ fiscal.referenceYear ?? '…' }}</p>
      <template v-if="fiscalAvailable">
        <div v-for="g in groups" :key="g.group" class="flow-group">
          <button
            class="flow-head pa-data"
            type="button"
            role="switch"
            :aria-checked="g.allOn"
            :title="g.allOn ? 'Ocultar grupo' : 'Mostrar grupo'"
            @click="selection.setFiscalGroup([...g.keys], !g.allOn)"
          >
            <span class="flow-head-mark" :class="{ on: g.anyOn }"></span>
            <span class="flow-head-title">{{ g.title }}</span>
            <span class="pa-label metric-hint">{{ g.hint }}</span>
          </button>
          <button
            v-for="s in g.segments"
            :key="s.key"
            class="seg-btn pa-data"
            :class="{ 'seg-btn--off': !selection.fiscalSegments[s.key] }"
            type="button"
            role="switch"
            :aria-checked="selection.fiscalSegments[s.key]"
            @click="selection.toggleFiscalSegment(s.key)"
          >
            <span class="seg-swatch" :style="{ background: swatch(s) }"></span>
            <span class="seg-label">{{ s.label }}</span>
            <span class="pa-label metric-hint">{{ s.hint }}</span>
          </button>
        </div>
      </template>
      <p v-else-if="fiscal.loading" class="pa-label demo-note">CARREGANDO FLUXOS FISCAIS…</p>
      <p v-else-if="fiscal.error" class="pa-label demo-note demo-error">
        FALHA NOS FLUXOS: {{ fiscal.error }}
      </p>
    </template>

    <div v-if="selection.demographicUf" class="demo-crop">
      <p class="pa-label demo-crop-label">RECORTE: {{ selection.demographicUf }}</p>
      <button
        class="demo-crop-clear pa-data"
        type="button"
        title="Voltar ao Brasil inteiro (Esc)"
        @click="selection.selectDemographicUf(null)"
      >
        [X]
      </button>
    </div>

    <p v-if="demografia.loading" class="pa-label demo-note">CARREGANDO MUNICÍPIOS…</p>
    <p v-else-if="demografia.error" class="pa-label demo-note demo-error">
      FALHA AO CARREGAR: {{ demografia.error }}
    </p>
    <p v-else class="pa-label demo-note">
      {{ demografia.municipios.length }} MUNICÍPIOS · ALTURA ∝ √VALOR
    </p>

    <p class="pa-label demo-source">{{ sourceLabel }}</p>
  </aside>
</template>

<style scoped>
.demo-menu {
  position: absolute;
  top: 96px;
  right: 24px;
  z-index: 20;
  width: 300px;
  padding: 14px 16px;
  background: rgba(3, 6, 8, 0.82);
  border: 1px solid var(--pa-border-cyan);
  backdrop-filter: blur(6px);
}

.demo-title {
  margin: 0 0 12px;
  color: var(--pa-text-dim);
}

.metric-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-text-dim);
  text-align: left;
  background: transparent;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
  transition: box-shadow var(--pa-dur-fast) ease, color var(--pa-dur-fast) ease;
}

.metric-btn:hover {
  color: var(--pa-text-primary);
}

/* Active state tinted by the series color of the metric itself. */
.metric-btn--active.metric-btn--pop {
  color: color-mix(in srgb, var(--pa-demo-pop) 70%, var(--pa-text-primary));
  border-color: color-mix(in srgb, var(--pa-demo-pop) 55%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--pa-demo-pop) 40%, transparent);
}

.metric-btn--active.metric-btn--gdp {
  color: color-mix(in srgb, var(--pa-demo-gdp) 55%, var(--pa-text-primary));
  border-color: color-mix(in srgb, var(--pa-demo-gdp) 60%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--pa-demo-gdp) 45%, transparent);
}

.demo-flows-title {
  margin-top: 14px;
}

.flow-group {
  margin-bottom: 8px;
}

.flow-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 2px;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.flow-head-mark {
  width: 9px;
  height: 9px;
  flex: none;
  border: 1px solid var(--pa-text-dim);
}

.flow-head-mark.on {
  background: var(--pa-text-dim);
}

.flow-head-title {
  flex: 1;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-text-dim);
}

.flow-head:hover .flow-head-title {
  color: var(--pa-text-primary);
}

/* Segment rows sit indented under their group header. */
.seg-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 6px 4px 14px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.seg-swatch {
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 1px;
}

.seg-label {
  flex: 1;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.1em;
  color: var(--pa-text-primary);
}

.seg-btn:hover .seg-label {
  text-shadow: 0 0 8px color-mix(in srgb, var(--pa-series-official) 40%, transparent);
}

/* Off segments dim their swatch and text. */
.seg-btn--off {
  opacity: 0.4;
}

.seg-btn--off .seg-swatch {
  filter: grayscale(1);
}

.metric-mark {
  width: 8px;
  height: 8px;
  flex: none;
  border: 1px solid currentcolor;
}

.metric-btn--active .metric-mark {
  background: currentcolor;
}

.metric-label {
  flex: 1;
}

.metric-hint {
  color: var(--pa-text-faint);
}

.demo-crop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding: 6px 8px;
  border: 1px solid var(--pa-border-cyan);
}

.demo-crop-label {
  margin: 0;
  color: var(--pa-series-official);
}

.demo-crop-clear {
  flex: none;
  padding: 1px 5px;
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
  background: none;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.demo-crop-clear:hover {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.demo-note {
  margin: 12px 0 0;
  color: var(--pa-text-dim);
}

.demo-error {
  color: var(--pa-danger);
}

.demo-source {
  margin: 4px 0 0;
  color: var(--pa-text-faint);
}

.demo-hint {
  margin: 10px 0 0;
  color: var(--pa-text-faint);
}

@media (max-width: 900px) {
  .demo-menu {
    top: auto;
    bottom: 52px;
    right: 12px;
    left: 12px;
    width: auto;
  }
}
</style>
