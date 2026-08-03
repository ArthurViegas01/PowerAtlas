<script setup lang="ts">
import { computed, ref } from 'vue'

import BarTable, { type BarTableRow } from '@/components/shared/BarTable.vue'
import { countryRgb, DEFAULT_COUNTRY_RGB } from '@/lib/countryColors'
import { formatUsdParts } from '@/lib/format'
import { useComercioStore } from '@/stores/comercio'
import { useSelectionStore } from '@/stores/selection'
import { directionValue } from '@/types/comercio'

const selection = useSelectionStore()
const comercio = useComercioStore()

/** Whether the panel is expanded — collapses to just its header bar. */
const open = ref(true)

/** How many partners the table lists (matches the arrows the map draws). */
const TOP_PARTNERS = 15

/**
 * Same context as the legend's trade controls: the global view, arrows on,
 * nothing Brazilian drilled into and the dataset landed. A selected partner is
 * allowed so the ranking stays up (with its row highlighted) for switching.
 */
const showRanking = computed(
  () =>
    selection.tradeVisible &&
    !selection.demographicView &&
    !selection.selectedId &&
    !selection.selectedMunicipio &&
    comercio.partners.length > 0,
)

/** Ranking value: the flow summed over the directions currently shown. */
function rankValue(partner: { exp: number; imp: number }): number {
  return selection.tradeDirs.reduce((sum, d) => sum + directionValue(partner, d), 0)
}

/** Top partners by combined enabled flow — the same order the arrows use. */
const rows = computed<BarTableRow[]>(() =>
  [...comercio.partners]
    .filter((partner) => rankValue(partner) > 0)
    .sort((a, b) => rankValue(b) - rankValue(a))
    .slice(0, TOP_PARTNERS)
    .map((partner, index) => {
      const [r, g, b] = countryRgb(partner.iso) ?? DEFAULT_COUNTRY_RGB
      const value = rankValue(partner)
      const { currency, amount } = formatUsdParts(value)
      return {
        key: partner.iso,
        label: partner.name.toUpperCase(),
        rank: index + 1,
        value,
        display: amount,
        prefix: currency,
        color: `rgb(${r}, ${g}, ${b})`,
        selected: selection.selectedPartner?.iso === partner.iso,
      }
    }),
)

/** Which directions the ranking reflects, for the header note. */
const dirLabel = computed(() => {
  const dirs = selection.tradeDirs
  if (dirs.length > 1) return 'EXPORTA + IMPORTA'
  return dirs[0] === 'export' ? 'EXPORTAÇÕES' : 'IMPORTAÇÕES'
})

function onSelect(iso: string) {
  if (selection.selectedPartner?.iso === iso) {
    selection.clearTradePartner()
    return
  }
  const name = comercio.byIso.get(iso)?.name ?? iso
  selection.selectTradePartner({ iso, name })
}
</script>

<template>
  <div v-if="showRanking" class="ranking">
    <button
      class="ranking-toggle pa-data"
      type="button"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="chev">{{ open ? '▾' : '▸' }}</span>
      <span class="ranking-title">RANKING // COMÉRCIO {{ comercio.referenceYear }}</span>
    </button>

    <div v-if="open" class="ranking-body">
      <p class="ranking-note pa-label">POR {{ dirLabel }} · US$ FOB</p>
      <div class="rows-scroll">
        <BarTable :rows="rows" show-rank selectable @select="onSelect" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranking {
  position: absolute;
  left: 22px;
  top: 50%;
  z-index: 18;
  width: 260px;
  max-width: calc(100vw - 44px);
  transform: translateY(-50%);
  padding: 10px 12px;
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.ranking-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-text-dim);
  background: none;
  border: none;
  cursor: pointer;
}

.ranking-toggle:hover {
  color: var(--pa-series-official);
}

.chev {
  color: var(--pa-series-official);
}

.ranking-title {
  flex: 1;
  text-align: left;
}

.ranking-body {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--pa-border-faint);
}

.ranking-note {
  margin: 0 0 8px;
  color: var(--pa-text-faint);
}

.rows-scroll {
  max-height: 52vh;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .ranking {
    display: none;
  }
}
</style>
