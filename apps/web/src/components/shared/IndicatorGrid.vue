<script setup lang="ts">
import { computed } from 'vue'

import { formatAreaKm2, formatDensity, formatGdpThousands, formatInt } from '@/lib/format'
import type { RegionIndicators } from '@/types/indicators'

const props = defineProps<{ indicators: RegionIndicators; sourceLabel: string }>()

const cells = computed(() => [
  { label: 'POPULAÇÃO', value: formatInt(props.indicators.population) },
  { label: 'ÁREA', value: formatAreaKm2(props.indicators.areaKm2) },
  { label: 'DENSIDADE', value: formatDensity(props.indicators.density) },
  { label: 'PIB', value: formatGdpThousands(props.indicators.gdpBrlThousands) },
])
</script>

<template>
  <section class="indicators" data-reveal aria-label="Indicadores oficiais">
    <p class="pa-label indicators-source">{{ sourceLabel }}</p>
    <dl class="indicators-grid">
      <div v-for="cell in cells" :key="cell.label" class="cell">
        <dt class="pa-label">{{ cell.label }}</dt>
        <dd class="pa-data value">{{ cell.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.indicators {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid var(--pa-border-faint);
  background: rgba(61, 225, 255, 0.03);
}

.indicators-source {
  margin: 0 0 8px;
  letter-spacing: 0.14em;
}

.indicators-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  margin: 0;
}

.cell dt {
  margin: 0;
}

.cell dd {
  margin: 2px 0 0;
  font-size: var(--pa-text-sm);
  color: var(--pa-text-primary);
}
</style>
