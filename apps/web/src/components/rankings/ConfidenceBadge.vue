<script setup lang="ts">
import { CONFIDENCE_LABEL } from '@/lib/labels'
import type { ConfidenceLevel } from '@/types/power-entity'

defineProps<{ level: ConfidenceLevel }>()
</script>

<template>
  <span
    class="badge pa-data"
    :class="`badge--${level}`"
    :title="`Nível de confiança simulado: ${CONFIDENCE_LABEL[level]}`"
  >
    <i class="dot"></i>
    CONF {{ CONFIDENCE_LABEL[level] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.08em;
  border: 1px solid;
  border-radius: 2px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

.badge--high {
  color: var(--pa-confidence-high);
  border-color: color-mix(in srgb, var(--pa-confidence-high) 45%, transparent);
}

.badge--medium {
  color: var(--pa-confidence-medium);
  border-color: color-mix(in srgb, var(--pa-confidence-medium) 45%, transparent);
}

.badge--low {
  color: var(--pa-confidence-low);
  border-color: color-mix(in srgb, var(--pa-confidence-low) 45%, transparent);
}
</style>
