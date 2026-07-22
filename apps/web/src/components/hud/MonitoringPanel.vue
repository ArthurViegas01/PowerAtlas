<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useMonitoringStore } from '@/stores/monitoring'

/**
 * Left-side HUD module with the latest headlines ingested from the
 * allowlisted institutional feeds (F5b). Factual provenance only: headline,
 * agency, date, link out. Hidden entirely when there is nothing to show
 * (offline mock mode or empty database).
 */
const monitoring = useMonitoringStore()

/** Collapsed = title bar only; the operator brings it back with [+]. */
const collapsed = ref(false)

onMounted(() => void monitoring.load())

const rows = computed(() =>
  monitoring.documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    url: doc.url,
    source: doc.sourceName.toUpperCase(),
    date: doc.publishedAt
      ? new Date(doc.publishedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        })
      : null,
  })),
)
</script>

<template>
  <aside v-if="rows.length" class="monitoring" aria-label="Monitoramento de fontes">
    <header class="monitoring-head">
      <p class="pa-label monitoring-title">MONITORAMENTO // FONTES OFICIAIS</p>
      <button
        class="collapse pa-data"
        type="button"
        :title="collapsed ? 'Expandir painel' : 'Recolher painel'"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? '[+]' : '[–]' }}
      </button>
    </header>
    <template v-if="!collapsed">
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="row in rows" :key="row.id" class="doc">
          <p class="pa-label doc-meta">
            <span class="doc-source">{{ row.source }}</span>
            <span v-if="row.date"> · {{ row.date }}</span>
          </p>
          <a class="doc-title" :href="row.url" target="_blank" rel="noopener noreferrer">
            {{ row.title }}
          </a>
        </li>
      </ul>
      <p class="credit pa-label">FEEDS RSS PÚBLICOS · SEM ANÁLISE NESTA FASE</p>
    </template>
  </aside>
</template>

<style scoped>
.monitoring {
  position: absolute;
  left: 22px;
  top: 96px;
  z-index: 18;
  width: 264px;
  max-height: calc(100vh - 420px);
  overflow-y: auto;
  padding: 12px 14px;
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.monitoring-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
}

.monitoring-title {
  margin: 0;
  color: var(--pa-text-dim);
}

.collapse {
  flex: none;
  padding: 1px 5px;
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
  background: none;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.collapse:hover {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.doc-meta {
  margin: 0 0 2px;
  letter-spacing: 0.1em;
}

.doc-source {
  color: var(--pa-series-official);
}

.doc-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: var(--pa-text-2xs);
  line-height: 1.45;
  color: var(--pa-text-primary);
  text-decoration: none;
}

.doc-title:hover {
  color: var(--pa-series-official);
  text-shadow: 0 0 8px rgba(61, 225, 255, 0.4);
}

.credit {
  margin: 10px 0 0;
  color: var(--pa-text-faint);
}

@media (max-width: 900px) {
  .monitoring {
    display: none;
  }
}
</style>
