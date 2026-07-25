<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatCell } from '@/lib/datasets'
import { histogram } from '@/lib/stats'
import type { ColumnFormat } from '@/types/dataset'

/** SVG histogram with an optional linear/log toggle for heavy-tailed metrics. */
const props = withDefaults(
  defineProps<{ values: number[]; format: ColumnFormat; allowLog?: boolean; binCount?: number }>(),
  { allowLog: false, binCount: 28 },
)

const useLog = ref(props.allowLog)
const bins = computed(() =>
  histogram(props.values, props.binCount, useLog.value && props.allowLog),
)
const maxCount = computed(() => Math.max(1, ...bins.value.map((b) => b.count)))

const barWidth = computed(() => 100 / Math.max(1, bins.value.length))
function barHeight(count: number): number {
  return (count / maxCount.value) * 100
}

const axisColumn = computed(() => ({ key: '', label: '', numeric: true, format: props.format }))
const loEdge = computed(() => (bins.value.length ? bins.value[0].x0 : null))
const hiEdge = computed(() => (bins.value.length ? bins.value[bins.value.length - 1].x1 : null))
</script>

<template>
  <div class="hist">
    <div class="hist-toolbar">
      <span class="pa-label">{{ useLog && allowLog ? 'ESCALA LOG' : 'ESCALA LINEAR' }}</span>
      <button
        v-if="allowLog"
        class="scale-btn pa-data"
        type="button"
        @click="useLog = !useLog"
      >
        {{ useLog ? 'LINEAR' : 'LOG' }}
      </button>
    </div>
    <svg class="hist-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
         :aria-label="`Histograma, ${values.length} valores`">
      <rect
        v-for="(b, i) in bins"
        :key="i"
        class="hist-bar"
        :x="i * barWidth"
        :y="100 - barHeight(b.count)"
        :width="barWidth * 0.86"
        :height="barHeight(b.count)"
      >
        <title>{{ b.count }} · {{ formatCell(axisColumn, b.x0) }} a {{ formatCell(axisColumn, b.x1) }}</title>
      </rect>
    </svg>
    <div class="hist-axis pa-label">
      <span>{{ loEdge == null ? '' : formatCell(axisColumn, loEdge) }}</span>
      <span>{{ hiEdge == null ? '' : formatCell(axisColumn, hiEdge) }}</span>
    </div>
  </div>
</template>

<style scoped>
.hist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hist-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scale-btn {
  padding: 2px 8px;
  font-size: var(--pa-text-2xs);
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.hist-svg {
  width: 100%;
  height: 120px;
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-faint);
}

.hist-bar {
  fill: var(--pa-series-official);
  opacity: 0.78;
  transition: opacity var(--pa-dur-fast) ease;
}

.hist-bar:hover {
  opacity: 1;
}

.hist-axis {
  display: flex;
  justify-content: space-between;
}
</style>
