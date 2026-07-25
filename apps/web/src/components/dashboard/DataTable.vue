<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { formatCell } from '@/lib/datasets'
import { formatInt } from '@/lib/format'
import type { CellValue, TabularDataset } from '@/types/dataset'

/**
 * Sortable, searchable, paginated table over a TabularDataset. Only the current
 * page is rendered (datasets reach 5.570 rows), so filtering/sorting run over
 * the full array but the DOM stays small.
 */
const props = withDefaults(defineProps<{ dataset: TabularDataset; pageSize?: number }>(), {
  pageSize: 50,
})

const search = ref('')
const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')
const page = ref(0)

/** Reset paging whenever the query or sort changes. */
watch([search, sortKey, sortDir], () => {
  page.value = 0
})

// Switching datasets clears the query and sort: the same DataTable instance is
// reused across datasets, and a stale query (or a sortKey naming a column the
// new dataset lacks) would silently hide every row.
watch(
  () => props.dataset.id,
  () => {
    search.value = ''
    sortKey.value = null
    sortDir.value = 'desc'
    page.value = 0
  },
)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.dataset.rows
  return props.dataset.rows.filter((row) =>
    props.dataset.columns.some((col) => {
      const value = row[col.key]
      return value != null && String(value).toLowerCase().includes(query)
    }),
  )
})

const sorted = computed(() => {
  const key = sortKey.value
  if (!key) return filtered.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  const col = props.dataset.columns.find((c) => c.key === key)
  const numeric = col?.numeric ?? false
  return [...filtered.value].sort((a, b) => compare(a[key], b[key], numeric) * dir)
})

function compare(a: CellValue, b: CellValue, numeric: boolean): number {
  // Nulls always sink to the bottom, regardless of direction flip below.
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (numeric) return (Number(a) - Number(b)) as number
  return String(a).localeCompare(String(b), 'pt-BR')
}

const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / props.pageSize)))
const paged = computed(() =>
  sorted.value.slice(page.value * props.pageSize, (page.value + 1) * props.pageSize),
)

function toggleSort(key: string) {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = 'desc'
  } else if (sortDir.value === 'desc') {
    sortDir.value = 'asc'
  } else {
    sortKey.value = null
  }
}

function sortMark(key: string): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'desc' ? '▼' : '▲'
}
</script>

<template>
  <div class="table-card">
    <div class="table-toolbar">
      <input
        v-model="search"
        class="pa-data table-search"
        type="search"
        placeholder="BUSCAR…"
        aria-label="Buscar na tabela"
      />
      <p class="pa-label table-count">
        {{ formatInt(filtered.length) }} / {{ formatInt(dataset.rows.length) }} REGISTROS
      </p>
    </div>

    <div class="table-scroll">
      <table class="pa-data data-table">
        <thead>
          <tr>
            <th
              v-for="col in dataset.columns"
              :key="col.key"
              :class="{ 'is-num': col.numeric, 'is-sorted': sortKey === col.key }"
              @click="toggleSort(col.key)"
            >
              <span>{{ col.label }}</span>
              <span class="sort-mark">{{ sortMark(col.key) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in paged" :key="i">
            <td
              v-for="col in dataset.columns"
              :key="col.key"
              :class="{ 'is-num': col.numeric }"
            >
              {{ formatCell(col, row[col.key] ?? null) }}
            </td>
          </tr>
          <tr v-if="paged.length === 0">
            <td :colspan="dataset.columns.length" class="table-empty">SEM REGISTROS</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pageCount > 1" class="table-pager">
      <button
        class="pager-btn pa-data"
        type="button"
        :disabled="page === 0"
        @click="page = Math.max(0, page - 1)"
      >
        ◄
      </button>
      <span class="pa-label">PÁG {{ page + 1 }} / {{ pageCount }}</span>
      <button
        class="pager-btn pa-data"
        type="button"
        :disabled="page >= pageCount - 1"
        @click="page = Math.min(pageCount - 1, page + 1)"
      >
        ►
      </button>
    </div>
  </div>
</template>

<style scoped>
.table-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-faint);
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--pa-border-faint);
}

.table-search {
  flex: 1;
  max-width: 320px;
  padding: 6px 10px;
  font-size: var(--pa-text-xs);
  letter-spacing: 0.1em;
  color: var(--pa-text-primary);
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-cyan);
}

.table-search:focus {
  outline: none;
  box-shadow: var(--pa-glow-cyan);
}

.table-count {
  margin: 0;
  white-space: nowrap;
}

.table-scroll {
  overflow: auto;
  max-height: 52vh;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--pa-text-xs);
}

.data-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
  letter-spacing: 0.1em;
  color: var(--pa-text-dim);
  background: var(--pa-bg-deep);
  border-bottom: 1px solid var(--pa-border-cyan);
  cursor: pointer;
  user-select: none;
}

.data-table th.is-sorted {
  color: var(--pa-series-official);
}

.data-table th.is-num,
.data-table td.is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sort-mark {
  margin-left: 6px;
  font-size: 0.8em;
}

.data-table td {
  padding: 6px 12px;
  white-space: nowrap;
  color: var(--pa-text-primary);
  border-bottom: 1px solid var(--pa-border-faint);
}

.data-table tbody tr:hover td {
  background: var(--pa-bg-inset);
}

.table-empty {
  padding: 24px;
  text-align: center;
  color: var(--pa-text-faint);
}

.table-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px;
  border-top: 1px solid var(--pa-border-faint);
}

.pager-btn {
  padding: 4px 12px;
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.pager-btn:disabled {
  color: var(--pa-text-faint);
  border-color: var(--pa-border-faint);
  cursor: default;
}
</style>
