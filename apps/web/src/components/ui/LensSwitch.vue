<script setup lang="ts">
import { useSelectionStore, type MapLens } from '@/stores/selection'

/**
 * Segmented lens control (IA-1b): the old "views" as what they really are,
 * data lenses over the same globe. Emits instead of switching directly so
 * MapScreen can kick the heavy demographic loads exactly as before.
 */
const emit = defineEmits<{ (event: 'change', lens: MapLens): void }>()

const selection = useSelectionStore()

const LENSES: { id: MapLens; label: string; title: string }[] = [
  { id: 'influence', label: 'INFLUÊNCIA', title: 'Lente de influência: rankings por região' },
  { id: 'trade', label: 'COMÉRCIO', title: 'Lente de comércio exterior: mundo e parceiros' },
  { id: 'demographic', label: 'DEMOGRAFIA', title: 'Lente demográfica: colunas por município' },
]
</script>

<template>
  <div class="lens" role="radiogroup" aria-label="Lente de dados do mapa">
    <button
      v-for="item in LENSES"
      :key="item.id"
      class="seg pa-data pa-focusable"
      :class="{ 'seg--active': selection.lens === item.id }"
      type="button"
      role="radio"
      :aria-checked="selection.lens === item.id"
      :title="item.title"
      @click="emit('change', item.id)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.lens {
  display: flex;
}

.seg {
  padding: var(--pa-space-15) var(--pa-space-3);
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-text-dim);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  border-left-width: 0;
  cursor: pointer;
  transition:
    box-shadow var(--pa-dur-fast) ease,
    color var(--pa-dur-fast) ease;
}

.seg:first-child {
  border-left-width: 1px;
}

.seg:hover {
  color: var(--pa-text-primary);
  box-shadow: var(--pa-glow-cyan);
}

/* Active segment: solid, same language as HudButton's toggled-on state. */
.seg--active {
  color: var(--pa-bg-void);
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}
</style>
