<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AnimatedCounter from '@/components/shared/AnimatedCounter.vue'
import SourceCitationTag from '@/components/shared/SourceCitationTag.vue'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/labels'
import { partyColorAny } from '@/lib/partyColors'
import type { PowerDimension, PowerEntity } from '@/types/power-entity'

import ConfidenceBadge from './ConfidenceBadge.vue'

const props = defineProps<{ entity: PowerEntity; rank: number; variant: PowerDimension }>()

/** The three-pillar decomposition, when the entity carries it. */
const pillars = computed(() => {
  const p = props.entity.power
  if (!p) return null
  return [
    { key: 'CAP', label: 'CAPITAL', value: p.capital },
    { key: 'AUT', label: 'AUTORIDADE', value: p.authority },
    { key: 'INF', label: 'INFLUÊNCIA', value: p.influence },
  ]
})

const partyChipColor = computed(() => {
  if (!props.entity.party) return ''
  const [r, g, b] = partyColorAny(props.entity.party)
  return `rgb(${r}, ${g}, ${b})`
})

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
      <span
        v-if="entity.party"
        class="party pa-data"
        :style="{ borderColor: partyChipColor, color: partyChipColor }"
      >
        {{ entity.party }}
      </span>
      <span v-if="isDraft" class="draft pa-data">{{ STATUS_LABEL.draft }}</span>
    </div>
    <p v-if="entity.role" class="role pa-label">{{ entity.role }}</p>
    <div class="row-bar">
      <div class="bar">
        <div class="fill" :style="{ width: barWidth }"></div>
      </div>
      <AnimatedCounter class="score" :value="entity.score" />
      <span class="delta pa-data" :class="{ up: entity.delta > 0, down: entity.delta < 0 }">
        {{ deltaLabel }}
      </span>
    </div>
    <div v-if="pillars" class="pillars" :title="`Capital ${pillars[0].value} · Autoridade ${pillars[1].value} · Influência ${pillars[2].value}`">
      <div v-for="p in pillars" :key="p.key" class="pillar">
        <span class="pillar-label pa-label">{{ p.key }}</span>
        <div class="pillar-track">
          <div class="pillar-fill" :style="{ width: `${p.value}%` }"></div>
        </div>
      </div>
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

.party {
  flex: none;
  padding: 0 5px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.06em;
  border: 1px solid currentColor;
  border-radius: 2px;
}

.role {
  margin: 2px 0 0 22px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.08em;
  color: var(--pa-text-dim);
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

/* Three-pillar decomposition: capital / autoridade / influência mini-bars. */
.pillars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px 8px;
  margin-top: 7px;
}

.pillar {
  display: flex;
  align-items: center;
  gap: 5px;
}

.pillar-label {
  min-width: 3ch;
  font-size: 9px;
  color: var(--pa-text-faint);
}

.pillar-track {
  flex: 1;
  height: 3px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}

.pillar-fill {
  height: 100%;
  background: color-mix(in srgb, currentColor 55%, transparent);
}

.item--official .pillars {
  color: var(--pa-series-official);
}

.item--hidden .pillars {
  color: var(--pa-series-hidden);
}
</style>
