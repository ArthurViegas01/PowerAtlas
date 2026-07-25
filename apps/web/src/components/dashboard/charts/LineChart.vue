<script setup lang="ts">
import { computed } from 'vue'

/**
 * SVG line for a normalized 0..1 concentration curve. Draws the equality
 * diagonal as reference, so a curve bowing above it reads as concentration
 * (few municípios holding most of the metric).
 */
const props = defineProps<{ values: number[] }>()

const path = computed(() => {
  const n = props.values.length
  if (n < 2) return ''
  return props.values
    .map((v, i) => {
      const x = (i / (n - 1)) * 100
      const y = 100 - Math.max(0, Math.min(1, v)) * 100
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
})

/** Rank fraction (x, in %) where the curve first crosses 0.5 of the total. */
const halfAt = computed(() => {
  const n = props.values.length
  if (n < 2) return null
  const idx = props.values.findIndex((v) => v >= 0.5)
  if (idx < 0) return null
  const pct = (idx / (n - 1)) * 100
  // One decimal below 10% so extreme concentration does not round to "0%".
  const text = pct < 10 ? pct.toFixed(1) : String(Math.round(pct))
  return text.replace('.', ',')
})
</script>

<template>
  <div class="line">
    <svg class="line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
         aria-label="Curva de concentração">
      <line class="equality" x1="0" y1="100" x2="100" y2="0" />
      <path class="curve" :d="path" />
    </svg>
    <p class="pa-label line-caption">
      <template v-if="halfAt !== null">TOP {{ halfAt }}% CONCENTRAM METADE DO TOTAL</template>
      <template v-else>SEM DADOS</template>
    </p>
  </div>
</template>

<style scoped>
.line {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.line-svg {
  width: 100%;
  height: 140px;
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-faint);
}

.equality {
  stroke: var(--pa-text-faint);
  stroke-width: 0.4;
  stroke-dasharray: 2 2;
  opacity: 0.5;
}

.curve {
  fill: none;
  stroke: var(--pa-series-official);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
}

.line-caption {
  margin: 0;
}
</style>
