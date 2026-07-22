<script setup lang="ts">
import { computed } from 'vue'

import { useSelectionStore } from '@/stores/selection'

const ROTATE_STEP_DEG = 15
const PITCH_STEP_DEG = 10

const selection = useSelectionStore()

const needleStyle = computed(() => ({
  transform: `rotate(${-selection.mapBearing}deg)`,
}))

const bearingLabel = computed(() => {
  const normalized = ((Math.round(selection.mapBearing) % 360) + 360) % 360
  return `${String(normalized).padStart(3, '0')}°`
})

const pitchLabel = computed(
  () => `${String(Math.round(selection.mapPitch)).padStart(2, '0')}°`,
)

const hasOverride = computed(
  () => selection.bearingOverride !== null || selection.pitchOverride !== null,
)
</script>

<template>
  <div class="compass" role="group" aria-label="Rotação do mapa">
    <button
      class="ctrl pa-data"
      type="button"
      title="Girar à esquerda (anti-horário)"
      aria-label="Girar o mapa 15 graus no sentido anti-horário"
      @click="selection.requestRotate(ROTATE_STEP_DEG)"
    >
      ◄
    </button>
    <button
      class="ctrl ctrl--needle"
      type="button"
      title="Alinhar ao norte"
      aria-label="Alinhar o mapa ao norte"
      @click="selection.requestNorth()"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" class="needle" :style="needleStyle">
        <path class="needle-n" d="M10 2.2 12.4 10 7.6 10Z" />
        <path class="needle-s" d="M7.6 10 12.4 10 10 17.8Z" />
      </svg>
    </button>
    <button
      class="ctrl pa-data"
      type="button"
      title="Girar à direita (horário)"
      aria-label="Girar o mapa 15 graus no sentido horário"
      @click="selection.requestRotate(-ROTATE_STEP_DEG)"
    >
      ►
    </button>
    <p class="readout pa-data">BRG {{ bearingLabel }}</p>

    <button
      class="ctrl pa-data"
      type="button"
      title="Menos inclinação (visão de cima)"
      aria-label="Inclinar o mapa 10 graus para a visão de cima"
      @click="selection.requestPitch(-PITCH_STEP_DEG)"
    >
      ▲
    </button>
    <button
      class="ctrl pa-data"
      type="button"
      title="Mais inclinação (visão rasante)"
      aria-label="Inclinar o mapa 10 graus para a visão rasante"
      @click="selection.requestPitch(PITCH_STEP_DEG)"
    >
      ▼
    </button>
    <p class="readout pa-data">PIT {{ pitchLabel }}</p>

    <button
      v-if="hasOverride"
      class="auto pa-data"
      type="button"
      title="Voltar ao enquadramento automático (rotação e inclinação)"
      @click="selection.requestAutoBearing()"
    >
      AUTO
    </button>
  </div>
</template>

<style scoped>
/* Horizontal control strip, centered right above the disclaimer footer. */
.compass {
  position: absolute;
  left: 50%;
  bottom: 52px;
  z-index: 18;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  transform: translateX(-50%);
  padding: 5px 10px;
  background: rgba(3, 6, 8, 0.6);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.ctrl {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: var(--pa-text-xs);
  color: var(--pa-series-official);
  background: rgba(3, 6, 8, 0.6);
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
  transition: box-shadow var(--pa-dur-fast) ease;
}

.ctrl:hover {
  box-shadow: var(--pa-glow-cyan);
}

.ctrl--needle {
  position: relative;
}

.needle {
  width: 20px;
  height: 20px;
  transition: transform 180ms linear;
}

.needle-n {
  fill: var(--pa-series-official);
}

.needle-s {
  fill: rgba(61, 225, 255, 0.22);
}

.readout {
  margin: 0 6px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.1em;
  color: var(--pa-text-dim);
}

.auto {
  padding: 3px 8px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-hidden);
  background: rgba(3, 6, 8, 0.6);
  border: 1px solid color-mix(in srgb, var(--pa-series-hidden) 35%, transparent);
  cursor: pointer;
  transition: box-shadow var(--pa-dur-fast) ease;
}

.auto:hover {
  box-shadow: var(--pa-glow-amber);
}

@media (prefers-reduced-motion: reduce) {
  .needle {
    transition: none;
  }
}

@media (max-width: 900px) {
  .compass {
    bottom: 12px; /* the disclaimer footer is hidden on mobile */
  }
}
</style>
