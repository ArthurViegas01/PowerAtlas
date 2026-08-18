<script setup lang="ts">
import { useComercioStore } from '@/stores/comercio'
import { useSelectionStore } from '@/stores/selection'

/**
 * Annual timeline of the trade lens (PROD-4 pilot): year chips sweep the
 * Comex series and reanimate the world arrows with that year's totals.
 * ATUAL returns to the reference year, the only one carrying the per-sector
 * detail (the series is totals-only, and the label says so). Lives in the
 * left dock, only under the trade lens with the series loaded.
 */
const comercio = useComercioStore()
const selection = useSelectionStore()
</script>

<template>
  <div
    v-if="selection.lens === 'trade' && comercio.serieLoaded"
    class="scrubber"
    role="group"
    aria-label="Linha do tempo do comércio exterior"
  >
    <p class="scrubber-title pa-label">LINHA DO TEMPO // COMÉRCIO</p>
    <div class="scrubber-row">
      <button
        v-for="(year, index) in comercio.serieYears"
        :key="year"
        class="year pa-data pa-focusable"
        :class="{ 'year--on': comercio.activeYearIndex === index }"
        type="button"
        :aria-pressed="comercio.activeYearIndex === index"
        :title="`Totais de ${year} nas setas`"
        @click="comercio.setActiveYearIndex(comercio.activeYearIndex === index ? null : index)"
      >
        {{ year }}
      </button>
      <button
        class="year pa-data pa-focusable"
        :class="{ 'year--on': comercio.activeYearIndex === null }"
        type="button"
        :aria-pressed="comercio.activeYearIndex === null"
        :title="`Ano de referência ${comercio.referenceYear ?? ''} com o detalhe setorial`"
        @click="comercio.setActiveYearIndex(null)"
      >
        ATUAL
      </button>
    </div>
    <p class="scrubber-note pa-label">
      SÉRIE ANUAL · SÓ TOTAIS POR PARCEIRO · SETORES NO ANO ATUAL
    </p>
  </div>
</template>

<style scoped>
.scrubber {
  padding: var(--pa-space-25) var(--pa-space-3);
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.scrubber-title {
  margin: 0 0 var(--pa-space-15);
}

.scrubber-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pa-space-15);
}

.year {
  padding: 1px 6px; /* chip fine-tune, off the spacing scale */
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.08em;
  color: var(--pa-text-dim);
  background: transparent;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
  transition: color var(--pa-dur-fast) ease, box-shadow var(--pa-dur-fast) ease;
}

.year:hover {
  color: var(--pa-text-primary);
  box-shadow: var(--pa-glow-cyan);
}

.year--on {
  color: var(--pa-bg-void);
  background: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.scrubber-note {
  margin: var(--pa-space-15) 0 0;
  color: var(--pa-text-faint);
}
</style>
