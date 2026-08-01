<script setup lang="ts">
import { computed } from 'vue'

import { useComercioStore } from '@/stores/comercio'
import { useSelectionStore } from '@/stores/selection'

const selection = useSelectionStore()
const comercio = useComercioStore()

/**
 * The trade controls belong to the global context: no Brazilian region drilled
 * into and the demographic view off. They stay hidden until the dataset lands.
 */
const showTrade = computed(
  () =>
    !selection.demographicView &&
    !selection.selectedId &&
    !selection.selectedMunicipio &&
    comercio.partners.length > 0,
)
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

    <div v-if="showTrade" class="trade">
      <button
        class="trade-toggle pa-data"
        type="button"
        :aria-pressed="selection.tradeVisible"
        @click="selection.toggleTrade()"
      >
        <span class="chk">{{ selection.tradeVisible ? '[x]' : '[ ]' }}</span>
        COMÉRCIO EXTERIOR {{ comercio.referenceYear }}
      </button>
      <div v-if="selection.tradeVisible" class="trade-dir">
        <button
          class="dir pa-data"
          :class="{ 'dir--on': selection.tradeDirs.includes('export') }"
          type="button"
          @click="selection.toggleTradeDirection('export')"
        >
          ▸ EXPORTA
        </button>
        <button
          class="dir pa-data"
          :class="{ 'dir--on': selection.tradeDirs.includes('import') }"
          type="button"
          @click="selection.toggleTradeDirection('import')"
        >
          ◂ IMPORTA
        </button>
      </div>
      <p v-if="selection.tradeVisible" class="trade-hint pa-label">
        COR = IDENTIDADE DO PAÍS · CLIQUE PARA VER SETORES
      </p>
    </div>

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

/* Trade controls: a toggle plus the export/import direction switch. */
.trade {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--pa-border-faint);
}

.trade-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 0;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.1em;
  color: var(--pa-text-dim);
  background: none;
  border: none;
  cursor: pointer;
}

.trade-toggle:hover {
  color: var(--pa-series-official);
}

.trade-toggle .chk {
  color: var(--pa-series-official);
}

.trade-dir {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.dir {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.08em;
  color: var(--pa-text-dim);
  background: rgba(3, 6, 8, 0.5);
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.dir:hover {
  color: var(--pa-text-primary);
}

.dir--on {
  color: var(--pa-text-primary);
  border-color: var(--pa-border-cyan);
}

.swatch--exp {
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

.swatch--imp {
  background: var(--pa-series-hidden);
}

.trade-hint {
  margin: 8px 0 0;
  color: var(--pa-text-faint);
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
