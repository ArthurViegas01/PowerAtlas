<script setup lang="ts">
import type { SourceCitation } from '@/types/power-entity'

defineProps<{ source: SourceCitation }>()
</script>

<template>
  <component
    :is="source.url ? 'a' : 'span'"
    class="src pa-data"
    :href="source.url"
    :title="source.note"
    :target="source.url ? '_blank' : undefined"
    :rel="source.url ? 'noopener' : undefined"
  >
    ◈ {{ source.label }}
  </component>
</template>

<style scoped>
.src {
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.04em;
  color: var(--pa-text-dim);
  text-decoration: none;
  border-bottom: 1px dotted var(--pa-border-cyan);
}

a.src:hover {
  color: var(--pa-series-official);
}
</style>
