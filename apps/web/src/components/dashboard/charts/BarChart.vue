<script setup lang="ts">
import { computed } from 'vue'

/** Horizontal top-N bars (CSS tracks, not SVG, so labels stay crisp). */
const props = withDefaults(
  defineProps<{
    items: { label: string; value: number; display: string }[]
    colorVar?: string
  }>(),
  { colorVar: '--pa-series-official' },
)

const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
function width(value: number): string {
  return `${Math.max(1, (value / max.value) * 100)}%`
}
</script>

<template>
  <ul class="bars">
    <li v-for="(item, i) in items" :key="i" class="bar-row">
      <span class="bar-label" :title="item.label">{{ item.label }}</span>
      <span class="bar-track">
        <span
          class="bar-fill"
          :style="{ width: width(item.value), background: `var(${colorVar})` }"
        ></span>
      </span>
      <span class="pa-data bar-value">{{ item.display }}</span>
    </li>
  </ul>
</template>

<style scoped>
.bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(80px, 130px) 1fr auto;
  align-items: center;
  gap: 10px;
}

.bar-label {
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.04em;
  color: var(--pa-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  height: 12px;
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-faint);
}

.bar-fill {
  display: block;
  height: 100%;
  transform-origin: left;
  animation: bar-grow var(--pa-dur-med) var(--pa-ease-hud);
}

@keyframes bar-grow {
  from {
    transform: scaleX(0);
  }
}

.bar-value {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-primary);
  white-space: nowrap;
}
</style>
