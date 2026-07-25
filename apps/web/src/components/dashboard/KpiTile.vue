<script setup lang="ts">
import type { DatasetKpi } from '@/types/dataset'

/**
 * One headline number in the console's KPI row. The value arrives already
 * formatted (pt-BR currency/counts), so the tile just presents it; the raw
 * number stays on the KPI for charts and export.
 */
defineProps<{ kpi: DatasetKpi }>()
</script>

<template>
  <div class="kpi">
    <p class="pa-label kpi-label">{{ kpi.label }}</p>
    <p class="pa-data kpi-value">{{ kpi.display }}</p>
    <p v-if="kpi.hint" class="pa-label kpi-hint">{{ kpi.hint }}</p>
  </div>
</template>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-faint);
  border-left: 2px solid var(--pa-border-cyan-strong);
}

.kpi-label {
  margin: 0;
}

.kpi-value {
  margin: 0;
  font-size: var(--pa-text-xl);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 12px rgba(61, 225, 255, 0.28);
}

.kpi-hint {
  margin: 0;
  color: var(--pa-text-faint);
}
</style>
