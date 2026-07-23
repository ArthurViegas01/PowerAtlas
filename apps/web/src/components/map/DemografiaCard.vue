<script setup lang="ts">
import { computed } from 'vue'

import DecryptedText from '@/components/shared/DecryptedText.vue'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useMapLayersStore } from '@/stores/mapLayers'
import { useSelectionStore } from '@/stores/selection'

/**
 * Left-side info card for the demographic view, two levels deep: cropping a
 * state opens its aggregate card (population, PIB, ranks among the 27 UFs);
 * clicking a município inside the crop swaps it for the city card. Occupies
 * the slot MonitoringPanel leaves free while the view is on.
 */
const selection = useSelectionStore()
const demografia = useDemografiaStore()
const mapLayers = useMapLayersStore()
const fiscal = useFiscalStore()

const municipio = computed(() =>
  selection.demographicView ? selection.selectedDemografia : null,
)

/** Cropped state feature — drives the state card while no city is picked. */
const stateFeature = computed(() => {
  if (!selection.demographicView || municipio.value || !selection.demographicUf) return null
  return (
    mapLayers.states?.features.find(
      (feature) => feature.properties.UF === selection.demographicUf,
    ) ?? null
  )
})

const municipioUf = computed(() =>
  municipio.value ? mapLayers.ufFromMunicipioCodigo(municipio.value.codigo) : null,
)

/** Per-state totals keyed by the 2-digit IBGE state code. */
const stateAggregates = computed(() => {
  const byState = new Map<
    string,
    { population: number; gdpBrlThousands: number; count: number }
  >()
  for (const current of demografia.municipios) {
    const key = current.codigo.slice(0, 2)
    const aggregate = byState.get(key) ?? { population: 0, gdpBrlThousands: 0, count: 0 }
    aggregate.population += current.population
    aggregate.gdpBrlThousands += current.gdpBrlThousands
    aggregate.count += 1
    byState.set(key, aggregate)
  }
  return byState
})

/** National positions by population and by PIB (1 = largest). */
const municipioRanks = computed(() => {
  const current = municipio.value
  if (!current || demografia.municipios.length === 0) return null
  let population = 1
  let gdp = 1
  for (const other of demografia.municipios) {
    if (other.population > current.population) population += 1
    if (other.gdpBrlThousands > current.gdpBrlThousands) gdp += 1
  }
  return { population, gdp, total: demografia.municipios.length }
})

/** The cropped state's positions among the 27 UFs. */
const stateRanks = computed(() => {
  const feature = stateFeature.value
  if (!feature) return null
  const mine = stateAggregates.value.get(feature.properties.codarea)
  if (!mine) return null
  let population = 1
  let gdp = 1
  for (const [codarea, aggregate] of stateAggregates.value) {
    if (codarea === feature.properties.codarea) continue
    if (aggregate.population > mine.population) population += 1
    if (aggregate.gdpBrlThousands > mine.gdpBrlThousands) gdp += 1
  }
  return { population, gdp, total: stateAggregates.value.size }
})

const integer = new Intl.NumberFormat('pt-BR')
const currencyCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const title = computed(() =>
  (municipio.value?.name ?? stateFeature.value?.properties.name ?? '').toUpperCase(),
)

const subtitle = computed(() => {
  if (municipio.value) {
    const uf = municipioUf.value ? ` · ${municipioUf.value}` : ''
    return `MUNICÍPIO · ${municipio.value.codigo}${uf}`
  }
  const feature = stateFeature.value
  if (!feature) return ''
  return `ESTADO · ${feature.properties.codarea} · ${feature.properties.UF}`
})

interface CardRow {
  label: string
  value: string
  note?: string
}

/** Real federal flows aggregated for one município or a whole state. */
function fiscalRows(codigos: string[]): CardRow[] {
  if (fiscal.byCodigo.size === 0) return []
  let arrecadacao = 0
  let transferencias = 0
  let emendas = 0
  let found = false
  for (const codigo of codigos) {
    const flows = fiscal.byCodigo.get(codigo)
    if (!flows) continue
    found = true
    arrecadacao += flows.arrecadacao
    transferencias += flows.transferencias
    emendas += flows.emendas
  }
  if (!found) return []
  const year = fiscal.referenceYear ? `FISCAL ${fiscal.referenceYear}` : undefined
  const saldo = transferencias + emendas - arrecadacao
  return [
    { label: 'ARRECADAÇÃO FEDERAL', value: currencyCompact.format(arrecadacao), note: year },
    { label: 'REPASSES DA UNIÃO', value: currencyCompact.format(transferencias) },
    { label: 'EMENDAS RECEBIDAS', value: currencyCompact.format(emendas) },
    {
      label: 'SALDO COM A UNIÃO',
      value: `${saldo >= 0 ? '+' : ''}${currencyCompact.format(saldo)}`,
    },
  ]
}

function demographicRows(
  population: number,
  gdpBrlThousands: number,
): CardRow[] {
  const gdpBrl = gdpBrlThousands * 1000
  return [
    {
      label: 'POPULAÇÃO',
      value: integer.format(population),
      note: demografia.censusYear ? `CENSO ${demografia.censusYear}` : undefined,
    },
    {
      label: 'PIB',
      value: currencyCompact.format(gdpBrl),
      note: demografia.gdpYear ? `PREÇOS CORRENTES ${demografia.gdpYear}` : undefined,
    },
    {
      label: 'PIB PER CAPITA',
      value: population > 0 ? currency.format(gdpBrl / population) : '—',
    },
  ]
}

const rows = computed<CardRow[]>(() => {
  const current = municipio.value
  if (current) {
    const list = demographicRows(current.population, current.gdpBrlThousands)
    if (municipioRanks.value) {
      list.push(
        {
          label: 'RANK POPULAÇÃO',
          value: `#${integer.format(municipioRanks.value.population)}`,
          note: `DE ${integer.format(municipioRanks.value.total)}`,
        },
        {
          label: 'RANK PIB',
          value: `#${integer.format(municipioRanks.value.gdp)}`,
          note: `DE ${integer.format(municipioRanks.value.total)}`,
        },
      )
    }
    list.push(...fiscalRows([current.codigo]))
    return list
  }
  const feature = stateFeature.value
  if (!feature) return []
  const aggregate = stateAggregates.value.get(feature.properties.codarea)
  if (!aggregate) return []
  const list = demographicRows(aggregate.population, aggregate.gdpBrlThousands)
  list.push({ label: 'MUNICÍPIOS', value: integer.format(aggregate.count) })
  if (stateRanks.value) {
    list.push(
      {
        label: 'RANK POPULAÇÃO',
        value: `#${stateRanks.value.population}`,
        note: `DE ${stateRanks.value.total} UFS`,
      },
      {
        label: 'RANK PIB',
        value: `#${stateRanks.value.gdp}`,
        note: `DE ${stateRanks.value.total} UFS`,
      },
    )
  }
  const codarea = feature.properties.codarea
  list.push(
    ...fiscalRows(
      demografia.municipios
        .filter((m) => m.codigo.startsWith(codarea))
        .map((m) => m.codigo),
    ),
  )
  return list
})

const visible = computed(() => municipio.value !== null || stateFeature.value !== null)

/** Transition key: remounting restarts the decrypt animation per subject. */
const cardKey = computed(
  () => municipio.value?.codigo ?? `uf-${stateFeature.value?.properties.UF ?? ''}`,
)

/** City card steps back to the state card; the state card leaves the crop. */
function closeCard() {
  if (municipio.value) selection.clearDemografia()
  else selection.selectDemographicUf(null)
}
</script>

<template>
  <transition name="pa-panel">
    <aside
      v-if="visible"
      :key="cardKey"
      class="city-card"
      :aria-label="municipio ? 'Ficha do município' : 'Ficha do estado'"
    >
      <header class="head">
        <div class="head-text">
          <h2 class="name pa-data">
            <DecryptedText :text="title" />
          </h2>
          <p class="pa-label sub">
            <DecryptedText :text="subtitle" :delay="120" />
          </p>
        </div>
        <button
          class="close pa-data"
          type="button"
          aria-label="Fechar ficha (Esc)"
          @click="closeCard"
        >
          [X]
        </button>
      </header>

      <dl class="rows">
        <div v-for="(row, index) in rows" :key="row.label" class="row">
          <dt class="pa-label row-label">
            <DecryptedText :text="row.label" :delay="220 + index * 90" />
          </dt>
          <dd class="row-value">
            <span class="value pa-data">
              <DecryptedText :text="row.value" :delay="260 + index * 90" />
            </span>
            <span v-if="row.note" class="pa-label note">
              <DecryptedText :text="row.note" :delay="300 + index * 90" />
            </span>
          </dd>
        </div>
      </dl>
    </aside>
  </transition>
</template>

<style scoped>
.city-card {
  position: absolute;
  left: 22px;
  top: 96px;
  z-index: 18;
  width: 290px;
  padding: 12px 14px;
  background: rgba(3, 6, 8, 0.78);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--pa-border-faint);
}

.head-text {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: var(--pa-text-md);
  font-weight: 600;
  letter-spacing: 0.1em;
  line-height: 1.3;
  color: var(--pa-text-primary);
}

.sub {
  margin: 3px 0 0;
  letter-spacing: 0.1em;
}

.close {
  flex: none;
  padding: 2px 6px;
  font-size: var(--pa-text-xs);
  color: var(--pa-text-dim);
  background: none;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.close:hover {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.row-label {
  margin: 0;
  letter-spacing: 0.12em;
}

.row-value {
  margin: 0;
  text-align: right;
}

.value {
  font-size: var(--pa-text-sm);
  color: var(--pa-text-primary);
}

.note {
  display: block;
  margin-top: 1px;
  color: var(--pa-text-faint);
}

@media (max-width: 900px) {
  .city-card {
    display: none;
  }
}
</style>
