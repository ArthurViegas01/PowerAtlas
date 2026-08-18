<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useResizableWidth } from '@/composables/useResizableWidth'
import { DEFAULT_PARTY_RGB, LEGEND_PARTIES, partyColorAny } from '@/lib/partyColors'
import { ICON_COLOR, type MeshKey } from '@/lib/sectorIcons'
import { useComercioStore } from '@/stores/comercio'
import { usePartidosStore } from '@/stores/partidos'
import { useSelectionStore } from '@/stores/selection'

const selection = useSelectionStore()
const comercio = useComercioStore()
const partidos = usePartidosStore()

/**
 * The 3D sector objects show in the world view (one per UF vocation) and in the
 * demographic view cropped to a state (per município). Both keep nothing
 * Brazilian drilled in the influence view, so this legend rides along there.
 */
const showVocacao = computed(
  () => !selection.selectedId && !selection.selectedMunicipio,
)

const rgb = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`

/** Wireframe glyph + label for each sector archetype (matches lib/sectorIcons). */
const vocacaoItems: { key: MeshKey; label: string; d: string }[] = [
  { key: 'silo', label: 'AGRO · SILO', d: 'M6 15 L6 7 L14 7 L14 15 M6 7 L10 2 L14 7' },
  { key: 'factory', label: 'INDÚSTRIA · FÁBRICA', d: 'M3 15 L3 8 L13 8 L13 15 M11 8 L11 4 L13 4 L13 8' },
  { key: 'towers', label: 'SERVIÇOS · TORRES', d: 'M3 15 L3 7 L6 7 L6 15 M8 15 L8 3 L11 3 L11 15 M13 15 L13 9 L16 9 L16 15' },
  { key: 'civic', label: 'ADM. PÚBLICA · CÍVICO', d: 'M3 15 L3 12 L17 12 L17 15 M5 12 L5 6 M9 12 L9 6 M13 12 L13 6 M3 6 L17 6 M3 6 L10 2 L17 6' },
  { key: 'mine', label: 'MINÉRIO · PILHA', d: 'M3 15 L10 3 L17 15 Z M6.5 9 L13.5 9' },
  { key: 'tank', label: 'PETRÓLEO · TANQUE', d: 'M4 15 L4 8 L16 8 L16 15 M4 8 Q10 4 16 8' },
]

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

/**
 * The party choropleth control stays available at national AND state level
 * (the colors persist into the drill-down, so the key must too); it only steps
 * aside for the demographic view and the deepest município drill. Toggling it on
 * lazily loads the dataset (a no-op once cached).
 */
const showPartisan = computed(
  () => !selection.demographicView && !selection.selectedMunicipio,
)

function togglePartisan() {
  if (!selection.partisanVisible) void partidos.load()
  selection.togglePartisan()
}

const partyRgbCss = (sigla: string) => {
  const [r, g, b] = partyColorAny(sigla)
  return `rgb(${r}, ${g}, ${b})`
}
const otherRgbCss = `rgb(${DEFAULT_PARTY_RGB[0]}, ${DEFAULT_PARTY_RGB[1]}, ${DEFAULT_PARTY_RGB[2]})`
const legendParties = LEGEND_PARTIES

/** User-adjustable card width, dragged from the right edge and remembered. */
const { width, startResize } = useResizableWidth('pa-legend-width', {
  min: 170,
  max: 480,
  default: 210,
})

/** Collapsed state (title-only), remembered across sessions. */
const collapsed = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem('pa-legend-collapsed') === '1',
)
watch(collapsed, (value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pa-legend-collapsed', value ? '1' : '0')
  }
})
</script>

<template>
  <div class="legend" :class="{ 'legend--collapsed': collapsed }" :style="collapsed ? undefined : { width: `${width}px` }">
    <button
      class="legend-title-btn"
      type="button"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >
      <span class="legend-chev">{{ collapsed ? '▸' : '▾' }}</span>
      <span class="pa-label legend-title">LEGENDA // CAMADAS</span>
    </button>

    <template v-if="!collapsed">
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

    <div v-if="showPartisan" class="partisan">
      <button
        class="trade-toggle pa-data"
        type="button"
        :aria-pressed="selection.partisanVisible"
        @click="togglePartisan()"
      >
        <span class="chk">{{ selection.partisanVisible ? '[x]' : '[ ]' }}</span>
        PARTIDOS · PREFEITO {{ partidos.referenceYear ?? '2024' }}
      </button>
      <ul v-if="selection.partisanVisible" class="party-list m-0 list-none p-0">
        <li v-for="sigla in legendParties" :key="sigla" class="flex items-center gap-2">
          <span class="swatch" :style="{ background: partyRgbCss(sigla) }"></span>
          <span class="row-label pa-data">{{ sigla }}</span>
        </li>
        <li class="flex items-center gap-2">
          <span class="swatch" :style="{ background: otherRgbCss }"></span>
          <span class="row-label pa-data">OUTROS / SEM DADO</span>
        </li>
      </ul>
    </div>

    <div v-if="showVocacao" class="vocacao">
      <p class="pa-label vocacao-title">VOCAÇÃO // SETORES</p>
      <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
        <li v-for="item in vocacaoItems" :key="item.key" class="flex items-center gap-2">
          <svg class="voc-glyph" viewBox="0 0 20 17" aria-hidden="true">
            <path :d="item.d" :style="{ stroke: rgb(ICON_COLOR[item.key]) }" />
          </svg>
          <span class="row-label pa-data">{{ item.label }}</span>
        </li>
      </ul>
      <p class="vocacao-note pa-label">
        {{
          selection.demographicView
            ? 'MUNICÍPIO · VAB IBGE 2021 (QUOCIENTE LOCACIONAL)'
            : 'ESTADO · EXPORTAÇÃO DOMINANTE (COMEX)'
        }}
      </p>
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
    </template>
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

/* Title doubles as the collapse toggle. */
.legend-title-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  margin-bottom: 8px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.legend--collapsed .legend-title-btn {
  margin-bottom: 0;
}

.legend-chev {
  font-size: var(--pa-text-2xs);
  color: var(--pa-series-official);
}

.legend-title {
  margin: 0;
  color: var(--pa-text-dim);
}

.legend-title-btn:hover .legend-title {
  color: var(--pa-series-official);
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

/* Party choropleth control: a toggle plus a swatch per major party. */
.partisan {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--pa-border-faint);
}

.party-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px 10px;
  margin-top: 8px;
}

/* Sector vocation legend: a wireframe glyph per archetype, in its icon color. */
.vocacao {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--pa-border-faint);
}

.vocacao-title {
  margin: 0 0 8px;
  color: var(--pa-text-dim);
}

.voc-glyph {
  width: 18px;
  height: 15px;
  flex: none;
  overflow: visible;
}

.voc-glyph path {
  fill: none;
  stroke-width: 1.2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.vocacao-note {
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
