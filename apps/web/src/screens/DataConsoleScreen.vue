<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import AdminLoginDialog from '@/components/dashboard/AdminLoginDialog.vue'
import CatalogPanel from '@/components/dashboard/CatalogPanel.vue'
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
  buildComercioDataset,
  buildDemografiaDataset,
  buildFiscalDataset,
  buildImportedDataset,
  buildIndicadoresMunicipioDataset,
  buildIndicatorsDataset,
  buildRankingsDataset,
} from '@/lib/datasets'
import { chartsFor } from '@/lib/datasetCharts'
import { downloadText, toCsv, toJson } from '@/lib/csv'
import { useAdminStore } from '@/stores/admin'
import { useComercioStore } from '@/stores/comercio'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useImportedDatasetsStore } from '@/stores/importedDatasets'
import { useIndicatorsStore } from '@/stores/indicators'
import { useIndicatorsMunicipiosStore } from '@/stores/indicatorsMunicipios'
import { useRankingsStore } from '@/stores/rankings'
import { useStatsStore } from '@/stores/stats'
import type { TabularDataset } from '@/types/dataset'

/**
 * Data console: a tabular/analytical view over every dataset the app manages,
 * grouped by theme. Reuses the client-side stores (no re-fetch) for the factual
 * datasets — IBGE indicators (UF + município), demographic, fiscal, foreign
 * trade — plus the fictional rankings, the warehouse catalog, the backend
 * pipeline overview and operator-imported datasets. Every dataset renders the
 * same way: KPIs, SVG charts, a sortable table, CSV/JSON export.
 *
 * Only the logged-in admin can mutate: the import/remove tools appear once an
 * admin session exists, and the API rejects writes without a valid token.
 */
const rankings = useRankingsStore()
const indicators = useIndicatorsStore()
const indicatorsMunic = useIndicatorsMunicipiosStore()
const demografia = useDemografiaStore()
const fiscal = useFiscalStore()
const comercio = useComercioStore()
const stats = useStatsStore()
const imported = useImportedDatasetsStore()
const admin = useAdminStore()

onMounted(() => {
  void rankings.load()
  void indicators.loadUf()
  void demografia.load()
  void fiscal.load()
  void comercio.load()
  void stats.load()
  void imported.loadList()
})

const nameByCodigo = computed(
  () => new Map(demografia.municipios.map((m) => [m.codigo, m.name])),
)

// Themed groups of built-in datasets. Empty stores still yield a labelled tab
// (id/label are stable); the rows fill in once the store loads.
const groups = computed(() => [
  {
    label: 'TERRITORIAIS',
    datasets: [
      buildIndicatorsDataset(indicators.ufFile),
      buildIndicadoresMunicipioDataset(
        indicatorsMunic.municipios,
        nameByCodigo.value,
        indicatorsMunic.censusYear ?? demografia.censusYear,
        indicatorsMunic.gdpYear ?? demografia.gdpYear,
      ),
      buildDemografiaDataset(demografia.municipios, demografia.censusYear, demografia.gdpYear),
    ],
  },
  {
    label: 'ECONÔMICOS',
    datasets: [
      buildFiscalDataset(fiscal.byCodigo, fiscal.referenceYear, nameByCodigo.value),
      buildComercioDataset(comercio.partners, comercio.totals, comercio.referenceYear, comercio.source),
    ],
  },
  {
    label: 'SIMULADO',
    datasets: [buildRankingsDataset(rankings.data?.regions ?? [])],
  },
])

const builtinDatasets = computed<TabularDataset[]>(() => groups.value.flatMap((g) => g.datasets))

const activeId = ref('indicators')
const showImport = ref(false)
const showLogin = ref(false)

const isPipeline = computed(() => activeId.value === 'pipeline')
const isCatalog = computed(() => activeId.value === 'catalog')
const activeIsImported = computed(() => imported.list.some((d) => d.id === activeId.value))

/** The active dataset, or undefined for the special views / a pending import. */
const active = computed<TabularDataset | undefined>(() => {
  if (isPipeline.value || isCatalog.value) return undefined
  const builtin = builtinDatasets.value.find((d) => d.id === activeId.value)
  if (builtin) return builtin
  const detail = imported.detailById.get(activeId.value)
  return detail ? buildImportedDataset(detail) : undefined
})

// Lazy-load the heavier / on-demand datasets the first time they are selected.
watch(activeId, (id) => {
  if (id === 'indicadores-municipio') void indicatorsMunic.load()
  if (id === 'comercio') void comercio.load()
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

const loading = computed(
  () =>
    rankings.loading ||
    demografia.loading ||
    fiscal.loading ||
    comercio.loading ||
    indicatorsMunic.loading ||
    imported.loading,
)

const charts = computed(() => (active.value ? chartsFor(active.value) : []))

// Admin login offered only when a backend that can accept writes is reachable.
const canLogin = computed(() => admin.canAuthenticate && stats.data?.writesAllowed === true)

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
      <div class="header-actions">
        <template v-if="admin.isAdmin">
          <span class="admin-badge pa-data">ADMIN ✓</span>
          <button class="nav-link pa-data" type="button" @click="admin.logout()">SAIR</button>
        </template>
        <button
          v-else-if="canLogin"
          class="nav-link nav-link--admin pa-data"
          type="button"
          @click="showLogin = true"
        >
          ⌁ ENTRAR (ADMIN)
        </button>
        <RouterLink to="/" class="nav-link pa-data">◄ VOLTAR AO MAPA</RouterLink>
      </div>
    </header>

    <main class="console-body">
      <nav class="dataset-tabs" aria-label="Conjuntos de dados">
        <div v-for="group in groups" :key="group.label" class="tab-group">
          <span class="group-label pa-label">{{ group.label }}</span>
          <button
            v-for="ds in group.datasets"
            :key="ds.id"
            class="ds-tab pa-data"
            :class="{ 'ds-tab--active': ds.id === activeId, 'ds-tab--fictional': ds.fictional }"
            type="button"
            @click="activeId = ds.id"
          >
            {{ ds.label }}
          </button>
        </div>

        <div v-if="imported.list.length || admin.isAdmin" class="tab-group">
          <span class="group-label pa-label">IMPORTADOS</span>
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
            v-if="admin.isAdmin"
            class="ds-tab ds-tab--action pa-data"
            type="button"
            @click="showImport = true"
          >
            + IMPORTAR
          </button>
        </div>

        <div class="tab-group tab-group--end">
          <span class="group-label pa-label">SISTEMA</span>
          <button
            class="ds-tab ds-tab--catalog pa-data"
            :class="{ 'ds-tab--active': isCatalog }"
            type="button"
            @click="activeId = 'catalog'"
          >
            CATÁLOGO
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
        </div>
      </nav>

      <CatalogPanel v-if="isCatalog" />
      <PipelinePanel v-else-if="isPipeline" />

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
              v-if="activeIsImported && admin.isAdmin"
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
    <AdminLoginDialog
      v-if="showLogin"
      @close="showLogin = false"
      @authenticated="showLogin = false"
    />

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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-badge {
  padding: 4px 8px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-bg-void);
  background: var(--pa-confidence-high);
}

.nav-link {
  padding: 6px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-series-official);
  text-decoration: none;
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.nav-link:hover {
  box-shadow: var(--pa-glow-cyan);
}

.nav-link--admin {
  color: var(--pa-confidence-high);
  border-color: color-mix(in srgb, var(--pa-confidence-high) 50%, transparent);
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
  align-items: flex-end;
  gap: 8px 18px;
}

.tab-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.tab-group--end {
  margin-left: auto;
}

.group-label {
  align-self: center;
  margin-right: 2px;
  color: var(--pa-text-faint);
  letter-spacing: 0.16em;
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

.ds-tab--catalog {
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
