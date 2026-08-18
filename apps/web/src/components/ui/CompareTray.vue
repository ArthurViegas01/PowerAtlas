<script setup lang="ts">
import { RouterLink } from 'vue-router'

import HudButton from '@/components/ui/HudButton.vue'
import { MAX_COMPARE, useCompareStore } from '@/stores/compare'

/**
 * Comparison tray (PROD-2): the pinned regions, rendered inside MapScreen's
 * left dock whenever something is pinned. Chips unpin; the button opens the
 * side-by-side screen.
 */
const compare = useCompareStore()
</script>

<template>
  <div v-if="compare.count" class="tray" data-reveal>
    <p class="tray-title pa-label">COMPARAÇÃO · {{ compare.count }}/{{ MAX_COMPARE }}</p>
    <div class="tray-row">
      <button
        v-for="item in compare.items"
        :key="item.id"
        class="tray-chip pa-data pa-focusable"
        type="button"
        :title="`Remover ${item.name} da comparação`"
        @click="compare.remove(item.id)"
      >
        {{ item.id }} ✕
      </button>
      <HudButton :tag="RouterLink" to="/comparar" title="Abrir a comparação lado a lado">
        COMPARAR ►
      </HudButton>
    </div>
  </div>
</template>

<style scoped>
.tray {
  padding: var(--pa-space-25) var(--pa-space-3);
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.tray-title {
  margin: 0 0 var(--pa-space-15);
}

.tray-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pa-space-15);
}

.tray-chip {
  padding: 1px 6px; /* chip fine-tune, off the spacing scale */
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.08em;
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.tray-chip:hover {
  box-shadow: var(--pa-glow-cyan);
}
</style>
