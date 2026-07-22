<script setup lang="ts">
import { useSelectionStore } from '@/stores/selection'

const selection = useSelectionStore()
</script>

<template>
  <div class="legend">
    <p class="pa-label legend-title">LEGENDA // CAMADAS</p>

    <ul v-if="selection.demographicView" class="m-0 flex list-none flex-col gap-1.5 p-0">
      <li class="flex items-center gap-2">
        <span class="swatch swatch--metric"></span>
        <span class="row-label pa-data">COLUNA POR MUNICÍPIO · ALTURA ∝ √MÉTRICA</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--pop"></span>
        <span class="row-label pa-data">POPULAÇÃO (CENSO 2022)</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--gdp"></span>
        <span class="row-label pa-data">PIB (2023, PREÇOS CORRENTES)</span>
      </li>
    </ul>

    <ul v-else class="m-0 flex list-none flex-col gap-1.5 p-0">
      <li class="flex items-center gap-2">
        <span class="swatch swatch--official"></span>
        <span class="row-label pa-data">INFLUÊNCIA OFICIAL</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--hidden"></span>
        <span class="row-label pa-data">INFLUÊNCIA OCULTA · EM BREVE</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--intl"></span>
        <span class="row-label pa-data">INTERNACIONAL · EM BREVE</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--heat"></span>
        <span class="row-label pa-data">ATIVIDADE AMBIENTE · SIMULADA</span>
      </li>
    </ul>

    <p class="credit pa-label">
      {{ selection.demographicView ? 'DADOS: IBGE · MALHAS SIMPLIFICADAS' : 'MALHAS: IBGE · SIMPLIFICADAS' }}
    </p>
  </div>
</template>

<style scoped>
.legend {
  position: absolute;
  left: 22px;
  bottom: 16px; /* same height as the disclaimer footer */
  z-index: 18;
  padding: 12px 14px;
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.legend-title {
  margin: 0 0 8px;
  color: var(--pa-text-dim);
}

.row-label {
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.1em;
  color: var(--pa-text-dim);
}

.swatch {
  width: 14px;
  height: 8px;
  flex: none;
}

.swatch--official {
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

/* Locked dimension: dashed, no glow, like the international "em breve" row. */
.swatch--hidden {
  background: color-mix(in srgb, var(--pa-series-hidden) 14%, transparent);
  border: 1px dashed color-mix(in srgb, var(--pa-series-hidden) 55%, transparent);
}

.swatch--intl {
  background: rgba(61, 88, 101, 0.12);
  border: 1px dashed var(--pa-text-faint);
}

.swatch--heat {
  background: linear-gradient(to right, rgba(61, 225, 255, 0.1), rgba(61, 225, 255, 0.85));
}

.swatch--metric {
  background: linear-gradient(to right, rgba(127, 163, 180, 0.15), rgba(127, 163, 180, 0.7));
}

.swatch--pop {
  background: var(--pa-demo-pop);
}

.swatch--gdp {
  background: var(--pa-demo-gdp);
}

.credit {
  margin: 10px 0 0;
  color: var(--pa-text-faint);
}

@media (max-width: 900px) {
  .legend {
    display: none;
  }
}
</style>
