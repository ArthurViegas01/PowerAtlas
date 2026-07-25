<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import DataTable from '@/components/dashboard/DataTable.vue'
import KpiTile from '@/components/dashboard/KpiTile.vue'
import {
  buildDemografiaDataset,
  buildFiscalDataset,
  buildIndicatorsDataset,
  buildRankingsDataset,
} from '@/lib/datasets'
import { downloadText, toCsv, toJson } from '@/lib/csv'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useIndicatorsStore } from '@/stores/indicators'
import { useRankingsStore } from '@/stores/rankings'
import type { TabularDataset } from '@/types/dataset'

/**
 * Data console: a tabular/analytical view over every dataset the app manages.
 * Reuses the client-side stores (no re-fetch): IBGE indicators, the demographic
 * and fiscal municipal sets, and the fictional rankings. KPIs + a sortable,
 * searchable table + CSV/JSON export. Charts arrive in the next stage.
 */
const rankings = useRankingsStore()
const indicators = useIndicatorsStore()
const demografia = useDemografiaStore()
const fiscal = useFiscalStore()

onMounted(() => {
  void rankings.load()
  void indicators.loadUf()
  void demografia.load()
  void fiscal.load()
})

const nameByCodigo = computed(
  () => new Map(demografia.municipios.map((m) => [m.codigo, m.name])),
)

const datasets = computed<TabularDataset[]>(() => [
  buildIndicatorsDataset(indicators.ufFile),
  buildDemografiaDataset(demografia.municipios, demografia.censusYear, demografia.gdpYear),
  buildFiscalDataset(fiscal.byCodigo, fiscal.referenceYear, nameByCodigo.value),
  buildRankingsDataset(rankings.data?.regions ?? []),
])

const activeId = ref('indicators')
const active = computed(
  () => datasets.value.find((d) => d.id === activeId.value) ?? datasets.value[0],
)

// indicators store loads a 3 KB file at boot and exposes no loading flag; the
// two big municipal sets are what a spinner would be waiting on.
const loading = computed(() => rankings.loading || demografia.loading || fiscal.loading)

function exportCsv() {
  downloadText(`poweratlas-${active.value.id}.csv`, 'text/csv', toCsv(active.value.columns, active.value.rows))
}

function exportJson() {
  downloadText(
    `poweratlas-${active.value.id}.json`,
    'application/json',
    toJson(active.value.columns, active.value.rows),
  )
}
</script>

<template>
  <div class="console">
    <header class="console-header">
      <div class="brand">
        <p class="brand-name pa-data">POWERATLAS</p>
        <p class="pa-label">CONSOLE DE DADOS // OBSERVABILIDADE</p>
      </div>
      <RouterLink to="/" class="nav-link pa-data">◄ VOLTAR AO MAPA</RouterLink>
    </header>

    <main class="console-body">
      <nav class="dataset-tabs" aria-label="Conjuntos de dados">
        <button
          v-for="ds in datasets"
          :key="ds.id"
          class="ds-tab pa-data"
          :class="{ 'ds-tab--active': ds.id === activeId, 'ds-tab--fictional': ds.fictional }"
          type="button"
          @click="activeId = ds.id"
        >
          {{ ds.label }}
        </button>
      </nav>

      <section v-if="active" class="dataset-panel">
        <div class="panel-head">
          <div>
            <h1 class="panel-title pa-data">{{ active.label }}</h1>
            <p class="panel-desc">{{ active.description }}</p>
            <p class="pa-label panel-source">{{ active.source }}</p>
          </div>
          <div class="panel-actions">
            <button class="action pa-data" type="button" @click="exportCsv">EXPORTAR CSV</button>
            <button class="action pa-data" type="button" @click="exportJson">EXPORTAR JSON</button>
          </div>
        </div>

        <p v-if="active.fictional" class="fictional-note pa-data">
          ⚠ DADOS SIMULADOS · ENTIDADES FICTÍCIAS · NÃO FACTUAIS
        </p>

        <div class="kpi-row">
          <KpiTile v-for="(k, i) in active.kpis" :key="i" :kpi="k" />
        </div>

        <p v-if="loading && active.rows.length === 0" class="loading pa-data">
          CARREGANDO DATASET<span class="pa-blink">▌</span>
        </p>
        <DataTable v-else :dataset="active" />
      </section>
    </main>

    <footer class="disclaimer pa-data" role="note">
      ⚠ {{ rankings.disclaimer || 'PROTÓTIPO · DADOS SIMULADOS · ENTIDADES FICTÍCIAS' }}
    </footer>
  </div>
</template>

<style scoped>
.console {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(10, 26, 34, 0.5), transparent 60%),
    var(--pa-bg-void);
  color: var(--pa-text-primary);
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 24px 12px;
  border-bottom: 1px solid var(--pa-border-faint);
  background: linear-gradient(to bottom, rgba(3, 6, 8, 0.9), transparent);
}

.brand-name {
  margin: 0;
  font-size: var(--pa-text-xl);
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 16px rgba(61, 225, 255, 0.45);
}

.brand :nth-child(2) {
  margin: 2px 0 0;
}

.nav-link {
  padding: 6px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-series-official);
  text-decoration: none;
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
}

.nav-link:hover {
  box-shadow: var(--pa-glow-cyan);
}

.console-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 24px;
  overflow-y: auto;
}

.dataset-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ds-tab {
  padding: 7px 14px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-text-dim);
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
  transition: color var(--pa-dur-fast) ease, border-color var(--pa-dur-fast) ease;
}

.ds-tab:hover {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.ds-tab--active {
  color: var(--pa-bg-void);
  background: var(--pa-series-official);
  border-color: var(--pa-series-official);
}

.ds-tab--fictional.ds-tab--active {
  color: var(--pa-bg-void);
  background: var(--pa-series-hidden);
  border-color: var(--pa-series-hidden);
}

.ds-tab--fictional:not(.ds-tab--active) {
  color: var(--pa-series-hidden);
  border-color: color-mix(in srgb, var(--pa-series-hidden) 40%, transparent);
}

.dataset-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.panel-title {
  margin: 0;
  font-size: var(--pa-text-lg);
  letter-spacing: 0.12em;
  color: var(--pa-text-primary);
}

.panel-desc {
  margin: 4px 0 0;
  font-size: var(--pa-text-sm);
  color: var(--pa-text-dim);
}

.panel-source {
  margin: 6px 0 0;
  color: var(--pa-text-faint);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.action {
  padding: 6px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.action:hover {
  box-shadow: var(--pa-glow-cyan);
}

.fictional-note {
  margin: 0;
  padding: 6px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-hidden);
  border: 1px solid color-mix(in srgb, var(--pa-series-hidden) 35%, transparent);
  background: color-mix(in srgb, var(--pa-series-hidden) 6%, transparent);
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.loading {
  padding: 24px;
  text-align: center;
  color: var(--pa-text-dim);
}

.disclaimer {
  padding: 6px 24px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-series-hidden);
  border-top: 1px solid color-mix(in srgb, var(--pa-series-hidden) 30%, transparent);
  background: rgba(3, 6, 8, 0.72);
}

@media (max-width: 720px) {
  .console-body {
    padding: 14px 12px;
  }
}
</style>
