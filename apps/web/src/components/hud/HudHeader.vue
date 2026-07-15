<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useSelectionStore } from '@/stores/selection'

const emit = defineEmits<{ (event: 'select-national'): void }>()

const selection = useSelectionStore()

const clock = ref('--:--:--Z')
let timer: number | undefined

function tick() {
  clock.value = `${new Date().toISOString().slice(11, 19)}Z`
}

onMounted(() => {
  tick()
  timer = window.setInterval(tick, 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))

const readout = computed(() => {
  if (selection.selectedId) {
    return `⌖ ${selection.selectedId} · ${(selection.selectedName ?? '').toUpperCase()}`
  }
  if (selection.hoveredId) {
    return `► ${selection.hoveredId} · ${(selection.hoveredName ?? '').toUpperCase()}`
  }
  return 'AGUARDANDO SELEÇÃO'
})
</script>

<template>
  <header class="hud-header" role="banner">
    <div class="brand">
      <p class="brand-name pa-data">POWERATLAS</p>
      <p class="pa-label">MATRIZ DE PODER // BRASIL</p>
    </div>

    <p class="readout pa-data" aria-live="polite">{{ readout }}</p>

    <div class="flex items-center gap-4">
      <button
        class="national-btn pa-data"
        type="button"
        :disabled="selection.selectedId === 'BR'"
        @click="emit('select-national')"
      >
        VISÃO NACIONAL [BR]
      </button>
      <div class="text-right">
        <p class="clock pa-data">{{ clock }}</p>
        <p class="pa-label">SIMULAÇÃO · v0.1</p>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hud-header {
  position: absolute;
  top: 10px;
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

.readout {
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

.clock {
  margin: 0;
  font-size: var(--pa-text-sm);
  color: var(--pa-text-primary);
}

@media (max-width: 900px) {
  .readout {
    display: none;
  }
}
</style>
