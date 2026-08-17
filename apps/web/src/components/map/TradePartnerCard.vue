<script setup lang="ts">
import { computed } from 'vue'

import BarTable, { type BarTableRow } from '@/components/shared/BarTable.vue'
import DataProvenanceChip from '@/components/ui/DataProvenanceChip.vue'
import { formatUsd, formatUsdParts } from '@/lib/format'
import { sectorCss } from '@/lib/tradeSectors'
import { useComercioStore } from '@/stores/comercio'
import { useSelectionStore } from '@/stores/selection'
import { directionValue, type TradeDirection } from '@/types/comercio'

const selection = useSelectionStore()
const comercio = useComercioStore()

const partner = computed(() =>
  selection.selectedPartner ? (comercio.byIso.get(selection.selectedPartner.iso) ?? null) : null,
)
/** Directions shown, in the order the user turned them on. */
const dirs = computed(() => selection.tradeDirs)

const saldo = computed(() => (partner.value ? partner.value.exp - partner.value.imp : 0))

/** Rank of this partner among all partners in `direction`. */
function rankFor(direction: TradeDirection): number | null {
  if (!partner.value) return null
  const index = comercio.ranked(direction).findIndex((p) => p.iso === partner.value!.iso)
  return index >= 0 ? index + 1 : null
}

function totalFor(direction: TradeDirection): number {
  return partner.value ? directionValue(partner.value, direction) : 0
}

/** Sectors of `direction` as BarTable rows, largest first; bars read as share
 *  of the direction's total, so `index` keeps the arc/swatch color. */
function sectorRows(direction: TradeDirection): BarTableRow[] {
  if (!partner.value) return []
  return partner.value.sectors
    .map((sector, index) => ({ ...sector, index, value: directionValue(sector, direction) }))
    .filter((sector) => sector.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((sector) => {
      const { currency, amount } = formatUsdParts(sector.value)
      return {
        key: sector.code,
        label: sector.label,
        value: sector.value,
        display: amount,
        prefix: currency,
        color: sectorCss(sector.index, sector.code),
      }
    })
}

const dirTitle = (d: TradeDirection) =>
  d === 'export' ? 'O QUE O BRASIL EXPORTA' : 'O QUE O BRASIL IMPORTA'
const dirRole = (d: TradeDirection) =>
  d === 'export' ? 'destino das exportações' : 'origem das importações'
</script>

<template>
  <div v-if="partner" class="trade-card" data-reveal>
    <p class="tag pa-label">COMÉRCIO BRASIL ↔ {{ partner.name.toUpperCase() }} · {{ comercio.referenceYear }}</p>

    <div class="summary">
      <button
        class="chip"
        type="button"
        :class="{ 'chip--on': dirs.includes('export') }"
        :aria-pressed="dirs.includes('export')"
        @click="selection.toggleTradeDirection('export')"
      >
        <span class="chip-k pa-label"><span class="dot dot--exp"></span>EXPORTA</span>
        <span class="chip-v pa-data">{{ formatUsd(partner.exp) }}</span>
      </button>
      <button
        class="chip"
        type="button"
        :class="{ 'chip--on': dirs.includes('import') }"
        :aria-pressed="dirs.includes('import')"
        @click="selection.toggleTradeDirection('import')"
      >
        <span class="chip-k pa-label"><span class="dot dot--imp"></span>IMPORTA</span>
        <span class="chip-v pa-data">{{ formatUsd(partner.imp) }}</span>
      </button>
    </div>
    <p class="saldo pa-data">
      SALDO {{ saldo >= 0 ? '+' : '-' }}{{ formatUsd(Math.abs(saldo)) }}
      <span class="saldo-note">({{ saldo >= 0 ? 'superávit p/ o Brasil' : 'déficit p/ o Brasil' }})</span>
    </p>

    <section v-for="direction in dirs" :key="direction" class="dir-section">
      <header class="dir-head" :class="`dir-head--${direction}`">
        <span class="dir-title pa-data">{{ dirTitle(direction) }}</span>
        <span class="dir-total pa-data">{{ formatUsd(totalFor(direction)) }}</span>
      </header>
      <p v-if="rankFor(direction)" class="dir-rank pa-label">
        {{ rankFor(direction) }}º {{ dirRole(direction) }} do Brasil
      </p>
      <BarTable :rows="sectorRows(direction)" :max="totalFor(direction)" />
    </section>

    <p class="src">
      <DataProvenanceChip state="real" :label="`${comercio.source} · ${comercio.referenceYear}`" />
      <span class="pa-label">VALORES FOB EM US$</span>
    </p>
    <button class="back-home pa-data" type="button" @click="selection.clearTradePartner()">
      ◄ VOLTAR ÀS SETAS DO MUNDO
    </button>
  </div>
</template>

<style scoped>
.trade-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag {
  margin: 10px 0 2px;
  color: var(--pa-text-dim);
}

.summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.chip {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 9px;
  font: inherit;
  text-align: left;
  background: rgba(3, 6, 8, 0.5);
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.chip:hover {
  border-color: var(--pa-border-cyan);
}

.chip--on {
  border-color: var(--pa-border-cyan);
  background: color-mix(in srgb, var(--pa-series-official) 8%, transparent);
}

.chip-k {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--pa-text-dim);
}

.chip-v {
  font-size: var(--pa-text-md);
  color: var(--pa-text-primary);
}

.dot {
  width: 9px;
  height: 9px;
  flex: none;
}

.dot--exp {
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

.dot--imp {
  background: var(--pa-series-hidden);
}

.saldo {
  margin: 0 0 2px;
  font-size: var(--pa-text-xs);
  letter-spacing: 0.08em;
  color: var(--pa-text-dim);
}

.saldo-note {
  color: var(--pa-text-faint);
}

/* One section per direction; the header rule is tinted by the direction. */
.dir-section {
  margin-top: 6px;
}

.dir-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--pa-border-faint);
}

.dir-head--export {
  border-color: color-mix(in srgb, var(--pa-series-official) 45%, transparent);
}

.dir-head--import {
  border-color: color-mix(in srgb, var(--pa-series-hidden) 45%, transparent);
}

.dir-title {
  font-size: var(--pa-text-xs);
  letter-spacing: 0.1em;
  color: var(--pa-text-primary);
}

.dir-total {
  font-size: var(--pa-text-xs);
  color: var(--pa-text-dim);
  white-space: nowrap;
}

.dir-rank {
  margin: 6px 0 8px;
  color: var(--pa-series-official);
}

.src {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pa-space-15);
  margin: 12px 0 0;
  color: var(--pa-text-faint);
  line-height: 1.5;
}

.back-home {
  margin-top: 10px;
  padding: 6px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.back-home:hover {
  box-shadow: var(--pa-glow-cyan);
}
</style>
