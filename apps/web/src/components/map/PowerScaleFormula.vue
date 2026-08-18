<script setup lang="ts">
import { POWER_WEIGHTS } from '@/lib/powerScore'

const w = POWER_WEIGHTS
</script>

<template>
  <div class="scale-card" data-reveal>
    <p class="pa-label scale-title">ESCALA DE PODER · 0–100</p>
    <p class="scale-formula pa-data">
      <span class="pa-term">PODER</span>
      <span class="pa-eq">=</span>
      <span class="pa-cap">{{ w.capital }}·CAP</span>
      <span class="pa-op">+</span>
      <span class="pa-aut">{{ w.authority }}·AUT</span>
      <span class="pa-op">+</span>
      <span class="pa-inf">{{ w.influence }}·INF</span>
    </p>
    <ul class="scale-legend m-0 list-none p-0">
      <li><span class="dot dot--cap"></span>CAP · capital (patrimônio, escala log)</li>
      <li><span class="dot dot--aut"></span>AUT · autoridade (cargo / controle)</li>
      <li><span class="dot dot--inf"></span>INF · influência (alcance, mobilização)</li>
    </ul>
    <p class="scale-note pa-label">ÍNDICE METODOLÓGICO SIMULADO</p>
  </div>
</template>

<style scoped>
/* Static card on purpose: whoever places it (MapScreen's .scale-slot, the
   compare screen's footer) owns the positioning. */
.scale-card {
  width: 260px;
  padding: 10px 12px;
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.scale-title {
  margin: 0 0 7px;
  color: var(--pa-text-dim);
}

.scale-formula {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px;
  margin: 0 0 9px;
  font-size: var(--pa-text-sm);
  letter-spacing: 0.02em;
}

.pa-term {
  color: var(--pa-text-primary);
  font-weight: 600;
}

.pa-eq,
.pa-op {
  color: var(--pa-text-faint);
}

.pa-cap {
  color: var(--pa-demo-gdp);
}

.pa-aut {
  color: var(--pa-series-official);
}

.pa-inf {
  color: var(--pa-series-hidden);
}

.scale-legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.04em;
  color: var(--pa-text-dim);
}

.scale-legend li {
  display: flex;
  align-items: center;
  gap: 7px;
}

.dot {
  width: 8px;
  height: 8px;
  flex: none;
}

.dot--cap {
  background: var(--pa-demo-gdp);
}

.dot--aut {
  background: var(--pa-series-official);
}

.dot--inf {
  background: var(--pa-series-hidden);
}

.scale-note {
  margin: 8px 0 0;
  color: var(--pa-text-faint);
}
</style>
