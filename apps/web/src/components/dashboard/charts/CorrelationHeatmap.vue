<script setup lang="ts">
import { correlationColor } from '@/lib/chartColors'

/**
 * Correlation matrix as a colored grid: cyan for positive, amber for negative,
 * fading to neutral near zero (correlationColor reads the same tokens). Cell
 * text is the coefficient; row/column labels frame it.
 */
defineProps<{ keys: string[]; matrix: number[][] }>()

function fmt(value: number): string {
  return value.toFixed(2)
}
</script>

<template>
  <div class="heatmap" :style="{ '--n': keys.length }">
    <span class="corner"></span>
    <span v-for="(k, i) in keys" :key="`col-${i}`" class="pa-label col-head" :title="k">{{ k }}</span>

    <template v-for="(row, r) in matrix" :key="`row-${r}`">
      <span class="pa-label row-head" :title="keys[r]">{{ keys[r] }}</span>
      <span
        v-for="(value, c) in row"
        :key="`cell-${r}-${c}`"
        class="cell pa-data"
        :style="{ background: correlationColor(value) }"
        :title="`${keys[r]} × ${keys[c]}: ${fmt(value)}`"
      >
        {{ fmt(value) }}
      </span>
    </template>
  </div>
</template>

<style scoped>
.heatmap {
  display: grid;
  grid-template-columns: minmax(70px, auto) repeat(var(--n), minmax(38px, 1fr));
  gap: 2px;
  align-items: stretch;
  overflow-x: auto;
}

.corner {
  min-width: 70px;
}

.col-head {
  padding: 4px 2px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  align-self: end;
}

.row-head {
  padding: 0 6px;
  align-self: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-primary);
}
</style>
