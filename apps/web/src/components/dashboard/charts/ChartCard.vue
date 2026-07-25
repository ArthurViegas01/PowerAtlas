<script setup lang="ts">
/** Shared chrome for a console chart: title, hint and a slot for the SVG/CSS. */
defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <figure class="chart-card">
    <figcaption class="chart-head">
      <span class="pa-data chart-title">{{ title }}</span>
      <span v-if="hint" class="pa-label chart-hint">{{ hint }}</span>
    </figcaption>
    <div class="chart-body">
      <slot />
    </div>
  </figure>
</template>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-faint);
}

.chart-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.chart-title {
  font-size: var(--pa-text-xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
}

.chart-hint {
  margin: 0;
  white-space: nowrap;
  color: var(--pa-text-faint);
}

.chart-body {
  min-height: 0;
}
</style>
