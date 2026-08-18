<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useCatalogStore } from '@/stores/catalog'

/**
 * CATÁLOGO view: the warehouse star schema (public/data/catalog.json) rendered
 * as dimension/fact tables with their columns, plus the cross-referencing keys.
 * Read-only documentation of what the project holds and how the tables join.
 */
const store = useCatalogStore()
onMounted(() => void store.load())

const dims = computed(() => store.catalog?.tables.filter((t) => t.kind === 'dimensao') ?? [])
const facts = computed(() => store.catalog?.tables.filter((t) => t.kind === 'fato') ?? [])
const relationships = computed(() => store.catalog?.relationships ?? [])
</script>

<template>
  <section class="catalog">
    <div class="panel-head">
      <div>
        <h1 class="panel-title pa-data">CATÁLOGO DO ARMAZÉM</h1>
        <p class="panel-desc">
          Modelo estrela (dimensão + fato) que alimenta o site e abre no Power BI.
          Fonte da verdade em <code>data/warehouse/</code>.
        </p>
        <p class="pa-label panel-source">CSV-FIRST · GERADO POR pnpm warehouse</p>
      </div>
    </div>

    <p v-if="store.loading && !store.catalog" class="loading pa-data">
      CARREGANDO CATÁLOGO<span class="pa-blink">▌</span>
    </p>
    <p v-else-if="store.error" class="loading pa-data">CATÁLOGO INDISPONÍVEL · {{ store.error }}</p>

    <template v-else-if="store.catalog">
      <div class="rel-block">
        <p class="pa-label block-label">CHAVES DE CRUZAMENTO</p>
        <ul class="rel-list">
          <li v-for="(r, i) in relationships" :key="i" class="rel pa-data">
            <span class="rel-from">{{ r.from }}</span>
            <span class="rel-col">.{{ r.fromCol }}</span>
            <span class="rel-arrow">→</span>
            <span class="rel-to">{{ r.to }}</span>
            <span class="rel-col">.{{ r.toCol }}</span>
          </li>
        </ul>
      </div>

      <div v-for="group in [{ label: 'DIMENSÕES', tables: dims }, { label: 'FATOS', tables: facts }]" :key="group.label" class="group">
        <p class="pa-label block-label">{{ group.label }}</p>
        <div class="tables-grid">
          <article v-for="t in group.tables" :key="t.name" class="table-card">
            <header class="table-head">
              <span class="table-name pa-data">{{ t.name }}</span>
              <span class="table-rows pa-label">{{ t.rowCount.toLocaleString('pt-BR') }} linhas</span>
            </header>
            <p class="table-grao">{{ t.grao }}</p>
            <p class="table-fonte pa-label">{{ t.fonte }}</p>
            <ul class="col-list">
              <li v-for="c in t.columns" :key="c.key" class="col pa-data">
                <span class="col-key">{{ c.key }}</span>
                <span class="col-unit">{{ c.unidade || c.tipo }}</span>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.catalog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
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

.panel-desc code {
  color: var(--pa-series-official);
}

.panel-source {
  margin: 6px 0 0;
  color: var(--pa-text-faint);
}

.block-label {
  margin: 0 0 8px;
  color: var(--pa-text-dim);
}

.rel-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rel {
  padding: 5px 10px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.06em;
  color: var(--pa-text-dim);
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-faint);
}

.rel-to {
  color: var(--pa-series-official);
}

.rel-col {
  color: var(--pa-text-faint);
}

.rel-arrow {
  margin: 0 6px;
  color: var(--pa-confidence-high);
}

.group {
  display: flex;
  flex-direction: column;
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.table-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-faint);
}

.table-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.table-name {
  font-size: var(--pa-text-sm);
  letter-spacing: 0.06em;
  color: var(--pa-series-official);
}

.table-rows {
  color: var(--pa-text-faint);
  white-space: nowrap;
}

.table-grao {
  margin: 0;
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
}

.table-fonte {
  margin: 0;
  color: var(--pa-text-faint);
}

.col-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.col {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--pa-text-2xs);
  padding: 2px 0;
  border-bottom: 1px solid var(--pa-border-faint);
}

.col-key {
  color: var(--pa-text-primary);
}

.col-unit {
  color: var(--pa-text-faint);
  white-space: nowrap;
}

.loading {
  padding: 24px;
  text-align: center;
  color: var(--pa-text-dim);
}
</style>
