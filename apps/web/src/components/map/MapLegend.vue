<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

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

/** User-adjustable card width, dragged from the right edge and remembered. */
const WIDTH_MIN = 170
const WIDTH_MAX = 480
const WIDTH_DEFAULT = 210
const STORAGE_KEY = 'pa-legend-width'

const width = ref(readStoredWidth())

function readStoredWidth(): number {
  if (typeof window === 'undefined') return WIDTH_DEFAULT
  const raw = Number(window.localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(raw) && raw > 0 ? clampWidth(raw) : WIDTH_DEFAULT
}

function clampWidth(value: number): number {
  return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(value)))
}

let dragStartX = 0
let dragStartWidth = 0

function onDragMove(event: PointerEvent) {
  width.value = clampWidth(dragStartWidth + (event.clientX - dragStartX))
}

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, String(width.value))
  }
}

function startResize(event: PointerEvent) {
  dragStartX = event.clientX
  dragStartWidth = width.value
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
})
</script>

<template>
  <div class="legend" :style="{ width: `${width}px` }">
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
      <button
        v-if="selection.tradeVisible"
        class="trade-toggle trade-toggle--sub pa-data"
        type="button"
        :aria-pressed="selection.tradeArrowsVisible"
        @click="selection.toggleTradeArrows()"
      >
        <span class="chk">{{ selection.tradeArrowsVisible ? '[x]' : '[ ]' }}</span>
        SETAS DE FLUXO
      </button>
    </div>

    <p class="credit pa-label">
      {{ selection.demographicView ? 'DADOS: IBGE · MALHAS SIMPLIFICADAS' : 'FONTE: IBGE · COMEX STAT/MDIC' }}
    </p>

    <!-- Drag the right edge to resize the card; width is remembered. -->
    <div
      class="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ajustar a largura da legenda"
      title="Arraste para ajustar a largura"
      @pointerdown.prevent="startResize"
    ></div>
  </div>
</template>

<style scoped>
/* Flows inside the left dock (MapScreen); relative so the resize handle can
   anchor to its right edge. Width is user-driven (inline style). */
.legend {
  position: relative;
  padding: 12px 14px;
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

/* Right-edge grip: an 8px hit area with a thin bar that lights up on hover. */
.resize-handle {
  position: absolute;
  top: 6px;
  bottom: 6px;
  right: -1px;
  width: 8px;
  cursor: ew-resize;
  touch-action: none;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 2px;
  background: var(--pa-border-faint);
  transition: background var(--pa-dur-fast) ease;
}

.resize-handle:hover::after {
  background: var(--pa-border-cyan-strong);
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

.trade-toggle--sub {
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
