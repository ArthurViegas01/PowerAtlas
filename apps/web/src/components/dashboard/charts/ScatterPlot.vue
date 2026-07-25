<script setup lang="ts">
import { computed } from 'vue'

import { formatCell } from '@/lib/datasets'
import { extent } from '@/lib/stats'
import type { ColumnFormat } from '@/types/dataset'

/**
 * SVG scatter of two numeric columns. Marks are small squares (the SVG scales
 * non-uniformly), so distortion never matters. Log axes for heavy-tailed
 * metrics; the set is capped to keep the DOM light.
 */
const props = defineProps<{
  points: { x: number; y: number; label: string }[]
  xLabel: string
  yLabel: string
  xFormat: ColumnFormat
  yFormat: ColumnFormat
  logX?: boolean
  logY?: boolean
}>()

const MAX_POINTS = 1600

/** Even sample down to MAX_POINTS so 5.570 municípios do not flood the DOM. */
const sampled = computed(() => {
  const pts = props.points
  if (pts.length <= MAX_POINTS) return pts
  const step = pts.length / MAX_POINTS
  const out: typeof pts = []
  for (let i = 0; i < pts.length; i += step) out.push(pts[Math.floor(i)])
  return out
})

function axis(values: number[], log: boolean) {
  const usable = log ? values.filter((v) => v > 0) : values
  const ext = extent(usable)
  if (!ext) return null
  const lo = log ? Math.log10(ext.min) : ext.min
  const hi = log ? Math.log10(ext.max) : ext.max
  return { lo, hi, span: hi - lo || 1, raw: ext }
}

const xAxis = computed(() => axis(sampled.value.map((p) => p.x), !!props.logX))
const yAxis = computed(() => axis(sampled.value.map((p) => p.y), !!props.logY))

const marks = computed(() => {
  const ax = xAxis.value
  const ay = yAxis.value
  if (!ax || !ay) return []
  return sampled.value
    .filter((p) => (props.logX ? p.x > 0 : true) && (props.logY ? p.y > 0 : true))
    .map((p) => {
      const sx = props.logX ? Math.log10(p.x) : p.x
      const sy = props.logY ? Math.log10(p.y) : p.y
      return {
        cx: ((sx - ax.lo) / ax.span) * 100,
        cy: 100 - ((sy - ay.lo) / ay.span) * 100,
        point: p,
      }
    })
})

const xCol = computed(() => ({ key: '', label: '', numeric: true, format: props.xFormat }))
const yCol = computed(() => ({ key: '', label: '', numeric: true, format: props.yFormat }))
</script>

<template>
  <div class="scatter">
    <svg class="scatter-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
         :aria-label="`Dispersão ${xLabel} contra ${yLabel}`">
      <rect
        v-for="(m, i) in marks"
        :key="i"
        class="dot"
        :x="m.cx - 0.8"
        :y="m.cy - 0.8"
        width="1.6"
        height="1.6"
      >
        <title>{{ m.point.label }} · {{ formatCell(xCol, m.point.x) }} / {{ formatCell(yCol, m.point.y) }}</title>
      </rect>
    </svg>
    <div class="scatter-axes pa-label">
      <span>X: {{ xLabel }}{{ logX ? ' (LOG)' : '' }}</span>
      <span>Y: {{ yLabel }}{{ logY ? ' (LOG)' : '' }}</span>
    </div>
  </div>
</template>

<style scoped>
.scatter {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scatter-svg {
  width: 100%;
  height: 160px;
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-faint);
}

.dot {
  fill: var(--pa-series-official);
  opacity: 0.5;
}

.scatter-axes {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
</style>
