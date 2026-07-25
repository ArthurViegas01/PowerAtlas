<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import DataTable from '@/components/dashboard/DataTable.vue'
import ImportDialog from '@/components/dashboard/ImportDialog.vue'
import KpiTile from '@/components/dashboard/KpiTile.vue'
import PipelinePanel from '@/components/dashboard/PipelinePanel.vue'
import BarChart from '@/components/dashboard/charts/BarChart.vue'
import ChartCard from '@/components/dashboard/charts/ChartCard.vue'
import CorrelationHeatmap from '@/components/dashboard/charts/CorrelationHeatmap.vue'
import Histogram from '@/components/dashboard/charts/Histogram.vue'
import LineChart from '@/components/dashboard/charts/LineChart.vue'
import ScatterPlot from '@/components/dashboard/charts/ScatterPlot.vue'
import {
  buildDemografiaDataset,
  buildFiscalDataset,
  buildImportedDataset,
  buildIndicatorsDataset,
  buildRankingsDataset,
} from '@/lib/datasets'
import { chartsFor } from '@/lib/datasetCharts'
import { downloadText, toCsv, toJson } from '@/lib/csv'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useImportedDatasetsStore } from '@/stores/importedDatasets'
import { useIndicatorsStore } from '@/stores/indicators'
import { useRankingsStore } from '@/stores/rankings'
import { useStatsStore } from '@/stores/stats'
import type { TabularDataset } from '@/types/dataset'

/**
 * Data console: a tabular/analytical view over every dataset the app manages.
 * Reuses the client-side stores (no re-fetch): IBGE indicators, the demographic
 * and fiscal municipal sets, the fictional rankings, plus the pipeline/backend
 * overview and operator-imported datasets. KPIs, SVG charts, a sortable table
 * and CSV/JSON export.
 */
const rankings = useRankingsStore()
const indicators = useIndicatorsStore()
const demografia = useDemografiaStore()
const fiscal = useFiscalStore()
const stats = useStatsStore()
const imported = useImportedDatasetsStore()

onMounted(() => {
  void rankings.load()
  void indicators.loadUf()
  void demografia.load()
  void fiscal.load()
  void stats.load()
  void imported.loadList()
})

/** 'pipeline' is a backend-observability view, not a TabularDataset. */
const isPipeline = computed(() => activeId.value === 'pipeline')

const nameByCodigo = computed(
  () => new Map(demografia.municipios.map((m) => [m.codigo, m.name])),
)

const builtinDatasets = computed<TabularDataset[]>(() => [
  buildIndicatorsDataset(indicators.ufFile),
  buildDemografiaDataset(demografia.municipios, demografia.censusYear, demografia.gdpYear),
  buildFiscalDataset(fiscal.byCodigo, fiscal.referenceYear, nameByCodigo.value),
  buildRankingsDataset(rankings.data?.regions ?? []),
])

const activeId = ref('indicators')
const showImport = ref(false)

/** Whether the active id is an imported dataset. */
const activeIsImported = computed(() => imported.list.some((d) => d.id === activeId.value))

/** The active dataset, or undefined for the pipeline view or a not-yet-loaded import. */
const active = computed<TabularDataset | undefined>(() => {
  if (isPipeline.value) return undefined
  const builtin = builtinDatasets.value.find((d) => d.id === activeId.value)
  if (builtin) return builtin
  const detail = imported.detailById.get(activeId.value)
  return detail ? buildImportedDataset(detail) : undefined
})

// Fetch an imported dataset's rows the first time it is selected.
watch(activeId, (id) => {
  if (imported.list.some((d) => d.id === id)) void imported.loadDetail(id)
})

function onImported(id: string) {
  showImport.value = false
  activeId.value = id
  void imported.loadDetail(id)
}

async function removeActive() {
  const id = activeId.value
  if (!activeIsImported.value) return
  await imported.remove(id)
  activeId.value = 'indicators'
}

// indicators store loads a 3 KB file at boot and exposes no loading flag; the
// two big municipal sets are what a spinner would be waiting on.
const loading = computed(
  () => rankings.loading || demografia.loading || fiscal.loading || imported.loading,
)

const charts = computed(() => (active.value ? chartsFor(active.value) : []))

function exportCsv() {
  if (!active.value) return
  downloadText(`poweratlas-${active.value.id}.csv`, 'text/csv', toCsv(active.value.columns, active.value.rows))
}

function exportJson() {
  if (!active.value) return
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
          v-for="ds in builtinDatasets"
          :key="ds.id"
          class="ds-tab pa-data"
          :class="{ 'ds-tab--active': ds.id === activeId, 'ds-tab--fictional': ds.fictional }"
          type="button"
          @click="activeId = ds.id"
        >
          {{ ds.label }}
        </button>
        <button
          v-for="ds in imported.list"
          :key="ds.id"
          class="ds-tab ds-tab--imported pa-data"
          :class="{ 'ds-tab--active': ds.id === activeId }"
          type="button"
          @click="activeId = ds.id"
        >
          {{ ds.name.toUpperCase() }}
        </button>
        <button
          v-if="stats.data?.writesAllowed"
          class="ds-tab ds-tab--action pa-data"
          type="button"
          @click="showImport = true"
        >
          + IMPORTAR
        </button>
        <button
          v-if="stats.available"
          class="ds-tab ds-tab--pipeline pa-data"
          :class="{ 'ds-tab--active': isPipeline }"
          type="button"
          @click="activeId = 'pipeline'"
        >
          PIPELINE + BANCO
        </button>
      </nav>

      <PipelinePanel v-if="isPipeline" />

      <section v-else-if="active" class="dataset-panel">
        <div class="panel-head">
          <div>
            <h1 class="panel-title pa-data">{{ active.label }}</h1>
            <p class="panel-desc">{{ active.description }}</p>
            <p class="pa-label panel-source">{{ active.source }}</p>
          </div>
          <div class="panel-actions">
            <button class="action pa-data" type="button" @click="exportCsv">EXPORTAR CSV</button>
            <button class="action pa-data" type="button" @click="exportJson">EXPORTAR JSON</button>
            <button
              v-if="activeIsImported"
              class="action action-danger pa-data"
              type="button"
              @click="removeActive"
            >
              REMOVER
            </button>
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
        <template v-else>
          <div v-if="charts.length" class="charts-grid">
            <ChartCard
              v-for="(spec, i) in charts"
              :key="`${active.id}-${i}`"
              :title="spec.title"
              :hint="spec.hint"
              :class="{ 'chart-wide': spec.kind === 'heatmap' }"
            >
              <BarChart v-if="spec.kind === 'bar'" :items="spec.items" />
              <Histogram
                v-else-if="spec.kind === 'histogram'"
                :values="spec.values"
                :format="spec.format"
                :allow-log="spec.allowLog"
              />
              <ScatterPlot
                v-else-if="spec.kind === 'scatter'"
                :points="spec.points"
                :x-label="spec.xLabel"
                :y-label="spec.yLabel"
                :x-format="spec.xFormat"
                :y-format="spec.yFormat"
                :log-x="spec.logX"
                :log-y="spec.logY"
              />
              <LineChart v-else-if="spec.kind === 'line'" :values="spec.values" />
              <CorrelationHeatmap
                v-else-if="spec.kind === 'heatmap'"
                :keys="spec.keys"
                :matrix="spec.matrix"
              />
            </ChartCard>
          </div>
          <DataTable :dataset="active" />
        </template>
      </section>

      <p v-else class="loading pa-data">
        CARREGANDO DATASET<span class="pa-blink">▌</span>
      </p>
    </main>

    <ImportDialog v-if="showImport" @close="showImport = false" @imported="onImported" />

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

.ds-tab--imported {
  color: var(--pa-confidence-high);
  border-color: color-mix(in srgb, var(--pa-confidence-high) 40%, transparent);
}

.ds-tab--imported.ds-tab--active {
  color: var(--pa-bg-void);
  background: var(--pa-confidence-high);
  border-color: var(--pa-confidence-high);
}

.ds-tab--action {
  color: var(--pa-text-dim);
  border-style: dashed;
}

.ds-tab--action:hover {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.ds-tab--pipeline {
  margin-left: auto;
}

.action-danger {
  color: var(--pa-danger);
  border-color: color-mix(in srgb, var(--pa-danger) 40%, transparent);
}

.action-danger:hover {
  box-shadow: 0 0 12px color-mix(in srgb, var(--pa-danger) 40%, transparent);
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

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}

.charts-grid .chart-wide {
  grid-column: 1 / -1;
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
