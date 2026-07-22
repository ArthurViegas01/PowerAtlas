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
        :class="{ 'metric-btn--active': selection.demographicMetric === metric.id }"
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

    <p v-if="demografia.loading" class="pa-label demo-note">CARREGANDO MUNICÍPIOS…</p>
    <p v-else-if="demografia.error" class="pa-label demo-note demo-error">
      FALHA AO CARREGAR: {{ demografia.error }}
    </p>
    <p v-else class="pa-label demo-note">
      {{ demografia.municipios.length }} MUNICÍPIOS · ALTURA ∝ √VALOR
    </p>

    <p class="pa-label demo-source">{{ sourceLabel }}</p>

    <button
      class="exit-btn pa-data"
      type="button"
      @click="selection.exitDemographicView()"
    >
      ◄ SAIR DA VISÃO [ESC]
    </button>
  </aside>
</template>

<style scoped>
.demo-menu {
  position: absolute;
  top: 96px;
  right: 24px;
  z-index: 20;
  width: 250px;
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

.metric-btn--active {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
  box-shadow: var(--pa-glow-cyan);
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

.exit-btn {
  margin-top: 14px;
  width: 100%;
  padding: 7px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.exit-btn:hover {
  box-shadow: var(--pa-glow-cyan);
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
