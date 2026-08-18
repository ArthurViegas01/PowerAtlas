<script setup lang="ts">
import { computed } from 'vue'

import { useComercioStore } from '@/stores/comercio'
import { useSelectionStore, type MapLens } from '@/stores/selection'

import LensSwitch from '@/components/ui/LensSwitch.vue'

const emit = defineEmits<{
  (event: 'set-lens', lens: MapLens): void
}>()

const selection = useSelectionStore()
const comercio = useComercioStore()

const readout = computed(() => {
  if (selection.selectedId) {
    return `⌖ ${selection.selectedId} · ${(selection.selectedName ?? '').toUpperCase()}`
  }
  if (selection.selectedPartner) {
    return `⌖ ${selection.selectedPartner.name.toUpperCase()} · PARCEIRO COMERCIAL`
  }
  if (selection.lockedWorld) {
    return `⌖ ${selection.lockedWorld.name.toUpperCase()} · NÃO MAPEADO`
  }
  if (selection.hoveredId) {
    return `► ${selection.hoveredId} · ${(selection.hoveredName ?? '').toUpperCase()}`
  }
  if (selection.hoveredWorld) {
    // With the trade arrows on, a partner country reads as a trade partner
    // instead of the "em breve" backdrop.
    const isPartner =
      selection.tradeVisible &&
      !selection.demographicView &&
      comercio.byIso.get(selection.hoveredWorld.iso)
    return `► ${selection.hoveredWorld.name.toUpperCase()} · ${isPartner ? 'COMÉRCIO EXTERIOR' : 'EM BREVE'}`
  }
  return 'AGUARDANDO SELEÇÃO'
})
</script>

<template>
  <header class="hud-header" role="banner">
    <div class="brand">
      <p class="brand-name pa-data">POWERATLAS</p>
      <p class="pa-label">MATRIZ DE INFLUÊNCIA // BRASIL</p>
    </div>

    <p class="readout pa-data" aria-live="polite">{{ readout }}</p>

    <!-- The old view buttons became a lens selector (IA-1b); destinations
         like the data console live on the nav rail now. -->
    <LensSwitch @change="emit('set-lens', $event)" />
  </header>
</template>

<style scoped>
.hud-header {
  position: absolute;
  left: var(--pa-inset-edge);
  right: var(--pa-inset-edge);
  z-index: var(--pa-z-header);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-45);
  padding: var(--pa-space-3) var(--pa-space-5) var(--pa-space-25);
  border-bottom: 1px solid var(--pa-border-faint);
  background: linear-gradient(to bottom, rgba(3, 6, 8, 0.88), rgba(3, 6, 8, 0.35) 75%, transparent);
}

.brand-name {
  margin: 0;
  font-size: var(--pa-text-xl);
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 16px rgba(61, 225, 255, 0.45);
}

.brand :nth-child(2) {
  margin: var(--pa-space-05) 0 0;
}

/* Dead-centered on the header (not flex-distributed), clipped politely
   before it can reach the brand or the view buttons. */
.readout {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: 30vw;
  margin: 0;
  font-size: var(--pa-text-sm);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
  text-shadow: 0 0 10px rgba(61, 225, 255, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .readout {
    display: none;
  }
}
</style>
