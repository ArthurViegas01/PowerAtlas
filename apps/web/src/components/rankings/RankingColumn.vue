<script setup lang="ts">
import type { PowerDimension, PowerEntity } from '@/types/power-entity'

import RankingBarList from './RankingBarList.vue'

defineProps<{ variant: PowerDimension; entities: PowerEntity[] }>()
</script>

<template>
  <div class="column" :class="`column--${variant}`" data-reveal>
    <header class="head">
      <span class="mark"></span>
      <h3 class="title pa-data">
        {{ variant === 'official' ? 'PODER OFICIAL' : 'PODER OCULTO' }}
      </h3>
      <span class="count pa-data">{{ entities.length.toString().padStart(2, '0') }}</span>
    </header>
    <p class="sub pa-label">
      {{ variant === 'official' ? 'ESTRUTURA CONSTITUCIONAL' : 'INFLUÊNCIA REAL · MOCK FICTÍCIO' }}
    </p>
    <RankingBarList :entities="entities" :variant="variant" />
  </div>
</template>

<style scoped>
.column {
  min-width: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid;
}

.column--official .head {
  border-color: color-mix(in srgb, var(--pa-series-official) 45%, transparent);
}

.column--hidden .head {
  border-color: color-mix(in srgb, var(--pa-series-hidden) 45%, transparent);
}

.mark {
  width: 8px;
  height: 8px;
  flex: none;
}

.column--official .mark {
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

.column--hidden .mark {
  background: var(--pa-series-hidden);
  box-shadow: var(--pa-glow-amber);
}

.title {
  flex: 1;
  margin: 0;
  font-size: var(--pa-text-xs);
  font-weight: 600;
  letter-spacing: 0.16em;
}

.column--official .title {
  color: var(--pa-series-official);
}

.column--hidden .title {
  color: var(--pa-series-hidden);
}

.count {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
}

.sub {
  margin: 5px 0 4px;
}
</style>
