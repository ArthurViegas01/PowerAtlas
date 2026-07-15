<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AnimatedCounter from '@/components/shared/AnimatedCounter.vue'
import SourceCitationTag from '@/components/shared/SourceCitationTag.vue'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/labels'
import type { PowerDimension, PowerEntity } from '@/types/power-entity'

import ConfidenceBadge from './ConfidenceBadge.vue'

const props = defineProps<{ entity: PowerEntity; rank: number; variant: PowerDimension }>()

// Width starts at 0 and transitions to the score (CSS handles the tween;
// the reduced-motion media query zeroes the transition duration globally).
const barWidth = ref('0%')
onMounted(() => {
  requestAnimationFrame(() => {
    barWidth.value = `${Math.min(100, Math.max(0, props.entity.score))}%`
  })
})

const rankLabel = computed(() => String(props.rank).padStart(2, '0'))
const isDraft = computed(() => props.entity.status === 'draft')
const deltaLabel = computed(() => {
  if (props.entity.delta === 0) return '±0'
  return props.entity.delta > 0
    ? `▲${props.entity.delta}`
    : `▼${Math.abs(props.entity.delta)}`
})
</script>

<template>
  <li
    class="item"
    :class="[`item--${variant}`, { 'item--draft': isDraft }]"
    :title="entity.note"
    data-reveal
  >
    <div class="row-head">
      <span class="rank pa-data">{{ rankLabel }}</span>
      <span class="name">{{ entity.name }}</span>
      <span v-if="isDraft" class="draft pa-data">{{ STATUS_LABEL.draft }}</span>
    </div>
    <div class="row-bar">
      <div class="bar">
        <div class="fill" :style="{ width: barWidth }"></div>
      </div>
      <AnimatedCounter class="score" :value="entity.score" />
      <span class="delta pa-data" :class="{ up: entity.delta > 0, down: entity.delta < 0 }">
        {{ deltaLabel }}
      </span>
    </div>
    <div class="row-meta">
      <span class="pa-label">{{ KIND_LABEL[entity.kind] }}</span>
      <ConfidenceBadge :level="entity.confidence" />
      <SourceCitationTag
        v-for="source in entity.sources"
        :key="source.id"
        :source="source"
      />
    </div>
  </li>
</template>

<style scoped>
.item {
  padding: 8px 2px 10px;
  border-bottom: 1px solid var(--pa-border-faint);
}

.item:last-child {
  border-bottom: none;
}

.item--draft {
  opacity: 0.62;
}

.row-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.rank {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-faint);
}

.name {
  flex: 1;
  min-width: 0;
  font-size: var(--pa-text-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.draft {
  flex: none;
  padding: 0 4px;
  font-size: var(--pa-text-2xs);
  color: var(--pa-confidence-medium);
  border: 1px dashed currentColor;
}

.row-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.bar {
  flex: 1;
  height: 5px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.fill {
  width: 0;
  height: 100%;
  transition: width var(--pa-dur-slow) var(--pa-ease-hud);
}

.item--official .fill {
  background: linear-gradient(to right, rgba(61, 225, 255, 0.35), var(--pa-series-official));
  box-shadow: var(--pa-glow-cyan);
}

.item--hidden .fill {
  background: linear-gradient(to right, rgba(255, 179, 71, 0.35), var(--pa-series-hidden));
  box-shadow: var(--pa-glow-amber);
}

.score {
  min-width: 2.4ch;
  font-size: var(--pa-text-md);
  text-align: right;
}

.item--official .score {
  color: var(--pa-series-official);
}

.item--hidden .score {
  color: var(--pa-series-hidden);
}

.delta {
  min-width: 3ch;
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
}

.delta.up {
  color: var(--pa-confidence-high);
}

.delta.down {
  color: var(--pa-confidence-low);
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-top: 6px;
}
</style>
