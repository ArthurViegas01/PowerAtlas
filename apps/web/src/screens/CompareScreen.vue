<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import HudPanel from '@/components/hud/HudPanel.vue'
import PowerScaleFormula from '@/components/map/PowerScaleFormula.vue'
import RankingColumn from '@/components/rankings/RankingColumn.vue'
import IndicatorGrid from '@/components/shared/IndicatorGrid.vue'
import HudButton from '@/components/ui/HudButton.vue'
import HudInput from '@/components/ui/HudInput.vue'
import { normalize } from '@/lib/paletteIndex'
import { useCompareStore } from '@/stores/compare'
import { useIndicatorsStore } from '@/stores/indicators'
import { useRankingsStore } from '@/stores/rankings'

/**
 * Side-by-side comparison (PROD-2): up to four pinned regions with the same
 * indicators (IBGE) and the official influence ranking per column. Deep link:
 * /comparar?ids=SP,RS seeds the tray; the tray keeps the URL in step, so the
 * comparison itself is shareable. Column data reuses the exact components
 * the map panel renders, so the two screens cannot drift.
 */
const compare = useCompareStore()
const rankings = useRankingsStore()
const indicators = useIndicatorsStore()
const route = useRoute()
const router = useRouter()

const addQuery = ref('')

// Captured at setup on purpose: the immediate URL mirror below rewrites the
// query right away, so the deep-link seed must be read before that happens.
const seedIds = (() => {
  const raw = route.query.ids
  return ((Array.isArray(raw) ? raw[0] : raw) ?? '').split(',').filter(Boolean)
})()

onMounted(async () => {
  await Promise.all([rankings.load(), indicators.loadUf()])
  if (compare.count === 0) {
    for (const id of seedIds) {
      const region = rankings.regionById(id.trim().toUpperCase())
      if (region) compare.add({ id: region.id, name: region.name })
    }
  }
})

// The URL mirrors the tray (replace: pin/unpin is not browser history).
// Immediate: arriving with pins already in the tray must also stamp the URL.
watch(
  () => compare.items.map((item) => item.id).join(','),
  (ids) => {
    void router.replace({ query: ids ? { ids } : {} })
  },
  { immediate: true },
)

const columns = computed(() =>
  compare.items.map((item) => ({
    item,
    region: rankings.regionById(item.id),
    indicators: indicators.forRegion(item.id),
  })),
)

/** Regions still pinnable, filtered by the add box. */
const addable = computed(() => {
  if (compare.full) return []
  const q = normalize(addQuery.value)
  return [...rankings.regionsById.values()]
    .filter((region) => !compare.has(region.id))
    .filter(
      (region) =>
        !q || normalize(region.name).includes(q) || normalize(region.id).startsWith(q),
    )
    .sort((a, b) =>
      a.id === 'BR' ? -1 : b.id === 'BR' ? 1 : a.name.localeCompare(b.name, 'pt-BR'),
    )
    .slice(0, 8)
})

function pin(id: string, name: string) {
  compare.add({ id, name })
  addQuery.value = ''
}
</script>

<template>
  <div class="cmp">
    <header class="cmp-head">
      <div>
        <h1 class="cmp-title pa-data">COMPARAR // REGIÕES</h1>
        <p class="pa-label">ATÉ 4 COLUNAS · MESMOS INDICADORES · RANKING OFICIAL</p>
      </div>
      <HudButton :tag="RouterLink" to="/">◄ VOLTAR AO MAPA</HudButton>
    </header>

    <div v-if="compare.count" class="cmp-grid">
      <div v-for="col in columns" :key="col.item.id" class="cmp-col">
        <HudPanel
          :title="col.item.name.toUpperCase()"
          :subtitle="col.item.id === 'BR' ? 'PAÍS' : `UF · ${col.item.id}`"
        >
          <template #actions>
            <button
              class="cmp-close pa-data"
              type="button"
              :aria-label="`Remover ${col.item.name} da comparação`"
              @click="compare.remove(col.item.id)"
            >
              [X]
            </button>
          </template>
          <IndicatorGrid
            v-if="col.indicators"
            :indicators="col.indicators"
            :source-label="indicators.sourceLabel"
          />
          <RankingColumn
            v-if="col.region"
            variant="official"
            :entities="col.region.official"
          />
          <p v-else class="cmp-nodata pa-label">SEM MATRIZ PARA ESTA REGIÃO</p>
        </HudPanel>
      </div>

      <div v-if="!compare.full" class="cmp-add">
        <p class="pa-label cmp-add-title">ADICIONAR COLUNA</p>
        <HudInput v-model="addQuery" placeholder="Buscar UF ou Brasil" />
        <div class="cmp-add-list">
          <button
            v-for="region in addable"
            :key="region.id"
            class="cmp-add-item pa-data pa-focusable"
            type="button"
            @click="pin(region.id, region.name)"
          >
            <span>{{ region.name.toUpperCase() }}</span>
            <span class="cmp-add-id pa-label">{{ region.id }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-else class="cmp-empty">
      <p class="cmp-empty-line pa-data">NENHUMA REGIÃO FIXADA</p>
      <p class="cmp-empty-sub">
        Fixe até 4 regiões pelo botão FIXAR do painel no mapa, pela paleta
        (Ctrl-K) ou pela busca abaixo.
      </p>
      <div class="cmp-add cmp-add--center">
        <HudInput v-model="addQuery" placeholder="Buscar UF ou Brasil" />
        <div class="cmp-add-list">
          <button
            v-for="region in addable"
            :key="region.id"
            class="cmp-add-item pa-data pa-focusable"
            type="button"
            @click="pin(region.id, region.name)"
          >
            <span>{{ region.name.toUpperCase() }}</span>
            <span class="cmp-add-id pa-label">{{ region.id }}</span>
          </button>
        </div>
      </div>
    </div>

    <footer class="cmp-foot">
      <PowerScaleFormula />
      <p class="pa-label cmp-foot-note">
        RANKINGS SIMULADOS (ENTIDADES FICTÍCIAS) · INDICADORES REAIS COM SELO DE ORIGEM
      </p>
    </footer>
  </div>
</template>

<style scoped>
.cmp {
  height: 100%;
  padding: var(--pa-space-6) var(--pa-space-8) var(--pa-space-10);
  overflow-y: auto;
  background: var(--pa-bg-void);
  scrollbar-width: thin;
  scrollbar-color: var(--pa-border-cyan) transparent;
}

.cmp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pa-space-4);
  max-width: 1280px;
  margin: 0 auto var(--pa-space-6);
}

.cmp-title {
  margin: 0 0 var(--pa-space-05);
  font-size: var(--pa-text-xl);
  letter-spacing: 0.18em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 16px rgba(61, 225, 255, 0.45);
}

.cmp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--pa-space-4);
  max-width: 1280px;
  margin: 0 auto var(--pa-space-6);
  align-items: start;
}

.cmp-col {
  display: flex;
  min-width: 0;
}

.cmp-col > * {
  flex: 1;
}

.cmp-close {
  flex: none;
  padding: 2px 6px;
  font-size: var(--pa-text-xs);
  color: var(--pa-text-dim);
  background: none;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.cmp-close:hover {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.cmp-nodata {
  margin: var(--pa-space-3) 0 0;
}

.cmp-add {
  padding: var(--pa-space-4);
  border: 1px dashed var(--pa-border-cyan);
}

.cmp-add--center {
  max-width: 420px;
  margin: var(--pa-space-4) auto 0;
}

.cmp-add-title {
  margin: 0 0 var(--pa-space-3);
}

.cmp-add-list {
  display: flex;
  flex-direction: column;
  margin-top: var(--pa-space-2);
  max-height: 300px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--pa-border-cyan) transparent;
}

.cmp-add-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--pa-space-3);
  padding: var(--pa-space-15) var(--pa-space-2);
  font-size: var(--pa-text-xs);
  text-align: left;
  color: var(--pa-text-primary);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
}

.cmp-add-item:hover {
  background: color-mix(in srgb, var(--pa-series-official) 8%, transparent);
  border-color: var(--pa-border-cyan);
}

.cmp-empty {
  max-width: 560px;
  margin: 10vh auto 0;
  text-align: center;
}

.cmp-empty-line {
  margin: 0 0 var(--pa-space-2);
  font-size: var(--pa-text-lg);
  letter-spacing: 0.14em;
  color: var(--pa-text-primary);
}

.cmp-empty-sub {
  margin: 0;
  font-size: var(--pa-text-sm);
  line-height: 1.6;
  color: var(--pa-text-dim);
}

.cmp-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--pa-space-4);
  max-width: 1280px;
  margin: var(--pa-space-8) auto 0;
}

.cmp-foot-note {
  margin: var(--pa-space-2) 0 0;
  color: var(--pa-text-faint);
}
</style>
