<script setup lang="ts">
import { computed, onMounted } from 'vue'

import BarChart from '@/components/dashboard/charts/BarChart.vue'
import ChartCard from '@/components/dashboard/charts/ChartCard.vue'
import KpiTile from '@/components/dashboard/KpiTile.vue'
import { formatInt } from '@/lib/format'
import { useMonitoringStore } from '@/stores/monitoring'
import { useStatsStore } from '@/stores/stats'
import type { DatasetKpi } from '@/types/dataset'

/**
 * Backend observability: counts of the served content tables and the F5
 * pipeline staging (ingested documents by source and by day), plus the latest
 * ingested headlines. Read-only; hides itself when no database is connected.
 */
const stats = useStatsStore()
const monitoring = useMonitoringStore()

onMounted(() => {
  void stats.load()
  void monitoring.load(12)
})

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
}

function dateTime(iso: string | null): string {
  if (!iso) return 'N/D'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'N/D' : dateTimeFmt.format(d)
}

const pipeline = computed(() => stats.data?.pipeline ?? null)
const content = computed(() => stats.data?.content ?? null)

const lastCollection = computed(() => {
  const times = (pipeline.value?.sources ?? [])
    .map((s) => s.lastPublished)
    .filter((t): t is string => t !== null)
    .sort()
  return times.length ? times[times.length - 1] : null
})

const pipelineKpis = computed<DatasetKpi[]>(() => {
  const p = pipeline.value
  if (!p) return []
  return [
    { label: 'DOCUMENTOS', value: p.documents, display: formatInt(p.documents), hint: 'INGERIDOS' },
    { label: 'FONTES', value: p.sources.length, display: formatInt(p.sources.length), hint: 'ALLOWLIST' },
    {
      label: 'CANDIDATOS',
      value: p.candidates,
      display: formatInt(p.candidates),
      hint: 'SCORING (F5C)',
    },
    { label: 'ÚLTIMA COLETA', value: 0, display: dateTime(lastCollection.value), hint: 'PUBLICAÇÃO' },
  ]
})

const contentKpis = computed<DatasetKpi[]>(() => {
  const c = content.value
  if (!c) return []
  return [
    { label: 'REGIÕES', value: c.regions, display: formatInt(c.regions), hint: 'SERVIDAS' },
    { label: 'ENTIDADES', value: c.entities, display: formatInt(c.entities), hint: 'FICTÍCIAS' },
    { label: 'SINAIS', value: c.ambientSignals, display: formatInt(c.ambientSignals), hint: 'AMBIENTE' },
    { label: 'LINKS', value: c.influenceLinks, display: formatInt(c.influenceLinks), hint: 'INFLUÊNCIA' },
  ]
})

const bySource = computed(() =>
  (pipeline.value?.sources ?? []).map((s) => ({
    label: s.name,
    value: s.documents,
    display: formatInt(s.documents),
  })),
)

const byDay = computed(() =>
  (pipeline.value?.documentsByDay ?? []).map((d) => ({
    label: shortDate(d.day),
    value: d.count,
    display: formatInt(d.count),
  })),
)
</script>

<template>
  <section class="pipeline">
    <div class="panel-head">
      <div>
        <h1 class="panel-title pa-data">PIPELINE + BANCO</h1>
        <p class="panel-desc">
          Observabilidade do backend: conteúdo servido e ingestão de fontes públicas (F5).
        </p>
        <p class="pa-label panel-source">API · RAW_DOCUMENTS · INGEST_SOURCES</p>
      </div>
    </div>

    <p v-if="stats.loading && !stats.data" class="state pa-data">
      CONSULTANDO O BANCO<span class="pa-blink">▌</span>
    </p>

    <p v-else-if="!stats.available" class="state pa-data">
      SEM BACKEND · DEFINA VITE_API_URL E SUBA O DOCKER COMPOSE
    </p>

    <p v-else-if="!stats.data || !stats.data.database" class="state pa-data">
      SEM BANCO CONECTADO · SUBA O STACK (docker compose up)
    </p>

    <template v-else>
      <p class="pa-label section-label">PIPELINE DE INGESTÃO</p>
      <div class="kpi-row">
        <KpiTile v-for="(k, i) in pipelineKpis" :key="`p-${i}`" :kpi="k" />
      </div>

      <div class="charts-grid">
        <ChartCard title="DOCUMENTOS POR FONTE" :hint="`${bySource.length} FONTES`">
          <BarChart :items="bySource" />
        </ChartCard>
        <ChartCard title="DOCUMENTOS POR DIA" :hint="`${byDay.length} DIAS`">
          <BarChart :items="byDay" color-var="--pa-series-hidden" />
        </ChartCard>
      </div>

      <p class="pa-label section-label">CONTEÚDO SERVIDO</p>
      <div class="kpi-row">
        <KpiTile v-for="(k, i) in contentKpis" :key="`c-${i}`" :kpi="k" />
      </div>

      <p class="pa-label section-label">ÚLTIMAS MANCHETES</p>
      <ul class="headlines">
        <li v-for="doc in monitoring.documents" :key="doc.id" class="headline">
          <span class="pa-label headline-source">{{ doc.sourceName }}</span>
          <span class="headline-title">{{ doc.title }}</span>
          <span class="pa-label headline-date">{{ dateTime(doc.publishedAt ?? null) }}</span>
        </li>
        <li v-if="monitoring.documents.length === 0" class="headline-empty pa-label">
          SEM MANCHETES INGERIDAS
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.pipeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.state {
  padding: 20px;
  text-align: center;
  color: var(--pa-text-dim);
  border: 1px dashed var(--pa-border-faint);
}

.section-label {
  margin: 4px 0 0;
  color: var(--pa-series-official);
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

.headlines {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-faint);
}

.headline {
  display: grid;
  grid-template-columns: minmax(120px, 160px) 1fr auto;
  gap: 12px;
  align-items: baseline;
  padding: 7px 12px;
  border-bottom: 1px solid var(--pa-border-faint);
}

.headline:last-child {
  border-bottom: none;
}

.headline-source {
  margin: 0;
  color: var(--pa-series-hidden);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.headline-title {
  font-size: var(--pa-text-sm);
  color: var(--pa-text-primary);
}

.headline-date {
  margin: 0;
  white-space: nowrap;
}

.headline-empty {
  padding: 16px;
  text-align: center;
}

@media (max-width: 720px) {
  .headline {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
