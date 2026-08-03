<script lang="ts">
/** One row of a BarTable. `value` drives the bar; `display` is what's shown. */
export interface BarTableRow {
  /** Stable key and the payload emitted on select. */
  key: string
  label: string
  /** Bar magnitude, compared against `max` (or the largest row). */
  value: number
  /** The amount, right-aligned in the value column. */
  display: string
  /** Optional unit/currency pinned to the left of the value column ("US$"). */
  prefix?: string
  /** Swatch and bar color (any CSS color string). */
  color: string
  /** Optional leading rank number (needs `showRank`). */
  rank?: number
  /** Highlights the row (e.g. the partner currently open). */
  selected?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    rows: BarTableRow[]
    /** Show the leading rank column. */
    showRank?: boolean
    /** Rows become buttons that emit `select`. */
    selectable?: boolean
    /**
     * Reference for the bar's 100%. Defaults to the largest row value (so the
     * top row fills the track). Pass a total to make bars read as share.
     */
    max?: number
  }>(),
  { showRank: false, selectable: false, max: undefined },
)

const emit = defineEmits<{ (event: 'select', key: string): void }>()

const maxValue = computed(() => props.max ?? Math.max(1, ...props.rows.map((row) => row.value)))

function pct(value: number): number {
  return Math.max(0, Math.min(100, (value / maxValue.value) * 100))
}
</script>

<template>
  <!-- One grid for the whole table; each row is a subgrid spanning every
       column, so swatch / bar / value line up across all rows regardless of
       label length. -->
  <div class="bar-table" :class="{ 'bar-table--rank': showRank }" role="table">
    <component
      :is="selectable ? 'button' : 'div'"
      v-for="row in rows"
      :key="row.key"
      class="bt-row"
      :class="{ 'bt-row--sel': row.selected, 'bt-row--btn': selectable }"
      role="row"
      :type="selectable ? 'button' : undefined"
      @click="selectable && emit('select', row.key)"
    >
      <span v-if="showRank" class="bt-rank pa-data">{{ row.rank }}</span>
      <span class="bt-dot" :style="{ background: row.color }"></span>
      <span class="bt-label pa-data">{{ row.label }}</span>
      <span class="bt-bar">
        <span class="bt-fill" :style="{ width: pct(row.value) + '%', background: row.color }"></span>
      </span>
      <span class="bt-value pa-data">
        <span v-if="row.prefix" class="bt-cur">{{ row.prefix }}</span>
        <span class="bt-num">{{ row.display }}</span>
      </span>
    </component>
  </div>
</template>

<style scoped>
.bar-table {
  display: grid;
  /* Fixed bar track so every value starts at the same x, hugging the bar. */
  grid-template-columns: 10px minmax(0, 1fr) 72px max-content;
  column-gap: 9px;
  row-gap: 1px;
  align-items: center;
}

.bar-table--rank {
  grid-template-columns: 1.4rem 10px minmax(0, 1fr) 72px max-content;
}

/* Each row re-uses the parent's tracks so its cells stay column-aligned. */
.bt-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  padding: 3px 4px;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: none;
}

.bt-row--btn {
  cursor: pointer;
}

.bt-row--btn:hover {
  background: color-mix(in srgb, var(--pa-series-official) 6%, transparent);
}

.bt-row--sel {
  background: color-mix(in srgb, var(--pa-series-official) 12%, transparent);
}

.bt-rank {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-faint);
  text-align: right;
}

.bt-dot {
  width: 10px;
  height: 10px;
  flex: none;
}

.bt-label {
  min-width: 0;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.04em;
  color: var(--pa-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bt-row--sel .bt-label {
  color: var(--pa-series-official);
}

.bt-bar {
  height: 5px;
  background: rgba(61, 88, 101, 0.2);
  overflow: hidden;
}

.bt-fill {
  display: block;
  height: 100%;
  opacity: 0.85;
}

/* Currency pinned left, amount right-aligned, so the "US$" column lines up on
   the left while the numbers align on the right. */
.bt-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
  white-space: nowrap;
}

.bt-cur {
  color: var(--pa-text-faint);
}

.bt-num {
  margin-left: auto;
  text-align: right;
}
</style>
