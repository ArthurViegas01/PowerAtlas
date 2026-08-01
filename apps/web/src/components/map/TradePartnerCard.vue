<script setup lang="ts">
import { computed } from 'vue'

import { formatUsd } from '@/lib/format'
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

/** Sectors of `direction`, largest first; `index` keeps the arc/swatch color. */
function sectorsFor(direction: TradeDirection) {
  if (!partner.value) return []
  return partner.value.sectors
    .map((sector, index) => ({ ...sector, index, value: directionValue(sector, direction) }))
    .filter((sector) => sector.value > 0)
    .sort((a, b) => b.value - a.value)
}

function pct(value: number, direction: TradeDirection): number {
  const total = totalFor(direction)
  return total ? Math.round((value / total) * 100) : 0
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
      <div class="chip" :class="{ 'chip--on': dirs.includes('export') }">
        <span class="chip-k pa-label"><span class="dot dot--exp"></span>EXPORTA</span>
        <span class="chip-v pa-data">{{ formatUsd(partner.exp) }}</span>
      </div>
      <div class="chip" :class="{ 'chip--on': dirs.includes('import') }">
        <span class="chip-k pa-label"><span class="dot dot--imp"></span>IMPORTA</span>
        <span class="chip-v pa-data">{{ formatUsd(partner.imp) }}</span>
      </div>
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
      <ul class="rows">
        <li v-for="sector in sectorsFor(direction)" :key="sector.code" class="row">
          <span class="sw" :style="{ background: sectorCss(sector.index, sector.code) }"></span>
          <span class="lbl pa-data">{{ sector.label }}</span>
          <span class="bar">
            <span
              class="fill"
              :style="{ width: pct(sector.value, direction) + '%', background: sectorCss(sector.index, sector.code) }"
            ></span>
          </span>
          <span class="val pa-data">{{ formatUsd(sector.value) }}</span>
        </li>
      </ul>
    </section>

    <p class="src pa-label">FONTE: {{ comercio.source }} · VALORES FOB EM US$</p>
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
  background: rgba(3, 6, 8, 0.5);
  border: 1px solid var(--pa-border-faint);
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

.rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: 10px minmax(80px, 1.1fr) 0.9fr auto;
  align-items: center;
  gap: 9px;
  padding: 2px 0;
}

.row:hover {
  background: color-mix(in srgb, var(--pa-series-official) 5%, transparent);
}

.sw {
  width: 10px;
  height: 10px;
  flex: none;
}

.lbl {
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.03em;
  color: var(--pa-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar {
  height: 5px;
  background: rgba(61, 88, 101, 0.2);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  opacity: 0.85;
}

.val {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
  white-space: nowrap;
  text-align: right;
}

.src {
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
