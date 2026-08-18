<script setup lang="ts">
import { computed } from 'vue'

import RankingBarList from '@/components/rankings/RankingBarList.vue'
import type { PowerEntity, PowerRegion } from '@/types/power-entity'

const props = defineProps<{ region: PowerRegion }>()

/** Split an entity list by class (default: group) and rank by score. */
function byClass(entities: PowerEntity[], cls: 'group' | 'individual'): PowerEntity[] {
  return entities
    .filter((entity) => (entity.entityClass ?? 'group') === cls)
    .sort((a, b) => b.score - a.score)
}

const officialGroups = computed(() => byClass(props.region.official, 'group'))
const officialIndividuals = computed(() => byClass(props.region.official, 'individual'))
const hiddenGroups = computed(() => byClass(props.region.hidden, 'group'))
</script>

<template>
  <div class="national-card">
    <!-- 1 · Grupo dominante oficial -->
    <section class="quad quad--official" data-reveal>
      <header class="quad-head">
        <span class="mark"></span>
        <h3 class="quad-title pa-data">GRUPO DOMINANTE OFICIAL</h3>
        <span class="count pa-data">{{ officialGroups.length.toString().padStart(2, '0') }}</span>
      </header>
      <p class="quad-sub pa-label">ESTRUTURA DO ESTADO · TOPO = DOMINANTE</p>
      <RankingBarList :entities="officialGroups" variant="official" />
    </section>

    <!-- 2 · Grupo dominante oculto -->
    <section class="quad quad--hidden" data-reveal>
      <header class="quad-head">
        <span class="mark"></span>
        <h3 class="quad-title pa-data">GRUPO DOMINANTE OCULTO</h3>
        <span class="count pa-data">{{ hiddenGroups.length.toString().padStart(2, '0') }}</span>
      </header>
      <p class="quad-sub pa-label">ORGANIZAÇÕES DE REGISTRO PÚBLICO · AGREGADO NACIONAL</p>
      <RankingBarList :entities="hiddenGroups" variant="hidden" />
      <p class="quad-note">
        Índices são estimativas metodológicas agregadas. Não imputam condutas a
        indivíduos nem controle município a município.
      </p>
    </section>

    <!-- 3 · Indivíduos mais poderosos oficiais -->
    <section class="quad quad--official" data-reveal>
      <header class="quad-head">
        <span class="mark"></span>
        <h3 class="quad-title pa-data">INDIVÍDUOS MAIS PODEROSOS OFICIAIS</h3>
        <span class="count pa-data">
          {{ officialIndividuals.length.toString().padStart(2, '0') }}
        </span>
      </header>
      <p class="quad-sub pa-label">CAPITAL · AUTORIDADE · INFLUÊNCIA (0-100)</p>
      <RankingBarList :entities="officialIndividuals" variant="official" />
    </section>

    <!-- 4 · Indivíduos ocultos — deliberadamente não nomeados -->
    <section class="quad quad--locked" data-reveal>
      <header class="quad-head">
        <span class="mark mark--dashed"></span>
        <h3 class="quad-title pa-data">INDIVÍDUOS OCULTOS</h3>
      </header>
      <p class="quad-sub pa-label">SEM ATRIBUIÇÃO A INDIVÍDUOS</p>
      <p class="quad-note">
        Indivíduos não são nomeados no eixo oculto: atribuir poder oculto ou
        conduta criminosa a uma pessoa real seria difamação. O lado oculto fica
        restrito a organizações de registro público, em agregado nacional.
      </p>
    </section>
  </div>
</template>

<style scoped>
.national-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quad {
  min-width: 0;
}

.quad-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid;
}

.quad--official .quad-head {
  border-color: color-mix(in srgb, var(--pa-series-official) 45%, transparent);
}

.quad--hidden .quad-head,
.quad--locked .quad-head {
  border-color: color-mix(in srgb, var(--pa-series-hidden) 45%, transparent);
}

.mark {
  width: 8px;
  height: 8px;
  flex: none;
}

.quad--official .mark {
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

.quad--hidden .mark {
  background: var(--pa-series-hidden);
  box-shadow: var(--pa-glow-amber);
}

.mark--dashed {
  border: 1px dashed var(--pa-series-hidden);
}

.quad-title {
  flex: 1;
  margin: 0;
  font-size: var(--pa-text-xs);
  font-weight: 600;
  letter-spacing: 0.14em;
}

.quad--official .quad-title {
  color: var(--pa-series-official);
}

.quad--hidden .quad-title,
.quad--locked .quad-title {
  color: var(--pa-series-hidden);
}

.count {
  font-size: var(--pa-text-2xs);
  color: var(--pa-text-dim);
}

.quad-sub {
  margin: 5px 0 4px;
}

.quad-note {
  margin: 8px 0 0;
  font-size: var(--pa-text-2xs);
  line-height: 1.5;
  color: var(--pa-text-dim);
}

.quad--locked {
  padding: 10px 12px;
  border: 1px dashed color-mix(in srgb, var(--pa-series-hidden) 45%, transparent);
  background: color-mix(in srgb, var(--pa-series-hidden) 4%, transparent);
}
</style>
