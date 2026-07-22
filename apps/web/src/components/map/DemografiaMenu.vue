<script setup lang="ts">
import { computed } from 'vue'

import { useDemografiaStore } from '@/stores/demografia'
import { useSelectionStore } from '@/stores/selection'
import type { DemografiaMetric } from '@/types/demografia'

/**
 * Side menu of the demographic view: metric switch (population / PIB),
 * provenance note and the exit action. Only rendered while the view is on.
 */
const selection = useSelectionStore()
const demografia = useDemografiaStore()

const metrics: { id: DemografiaMetric; label: string; hint: string }[] = [
  { id: 'population', label: 'POPULAÇÃO', hint: 'CENSO 2022' },
  { id: 'gdp', label: 'PIB', hint: 'PIB MUNICÍPIOS 2023' },
]

const sourceLabel = computed(() =>
  demografia.censusYear
    ? `IBGE · CENSO ${demografia.censusYear} · PIB ${demografia.gdpYear}`
    : 'IBGE',
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
