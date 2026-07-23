<script setup lang="ts">
import { computed } from 'vue'

import { useSelectionStore } from '@/stores/selection'

const emit = defineEmits<{
  (event: 'select-national'): void
  (event: 'view-global'): void
  (event: 'view-demographic'): void
}>()

const selection = useSelectionStore()

const readout = computed(() => {
  if (selection.selectedId) {
    return `⌖ ${selection.selectedId} · ${(selection.selectedName ?? '').toUpperCase()}`
  }
  if (selection.lockedWorld) {
    return `⌖ ${selection.lockedWorld.name.toUpperCase()} · NÃO MAPEADO`
  }
  if (selection.hoveredId) {
    return `► ${selection.hoveredId} · ${(selection.hoveredName ?? '').toUpperCase()}`
  }
  if (selection.hoveredWorld) {
    return `► ${selection.hoveredWorld.name.toUpperCase()} · EM BREVE`
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

    <div class="flex items-center gap-4">
      <button class="national-btn pa-data" type="button" @click="emit('view-global')">
        VISÃO GLOBAL
      </button>
      <button
        class="national-btn pa-data"
        type="button"
        :disabled="selection.selectedId === 'BR' && !selection.demographicView"
        @click="emit('select-national')"
      >
        VISÃO NACIONAL [BR]
      </button>
      <button
        class="national-btn pa-data"
        :class="{ 'national-btn--active': selection.demographicView }"
        type="button"
        :aria-pressed="selection.demographicView"
        title="Alternar a visão demográfica"
        @click="emit('view-demographic')"
      >
        VISÃO DEMOGRÁFICA [BR]
      </button>
    </div>
  </header>
</template>

<style scoped>
.hud-header {
  position: absolute;
  left: 10px;
  right: 10px;
  z-index: 32;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 20px 10px;
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
  margin: 2px 0 0;
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

.national-btn {
  padding: 6px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
  transition: box-shadow var(--pa-dur-fast) ease, color var(--pa-dur-fast) ease;
}

.national-btn:hover:not(:disabled) {
  box-shadow: var(--pa-glow-cyan);
}

.national-btn:disabled {
  color: var(--pa-text-faint);
  border-color: var(--pa-border-faint);
  cursor: default;
}

/* Toggled-on state (demographic view active): stays clickable to exit. */
.national-btn--active {
  color: var(--pa-bg-void);
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

@media (max-width: 900px) {
  .readout {
    display: none;
  }
}
</style>
