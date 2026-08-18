<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PowerScaleFormula from '@/components/map/PowerScaleFormula.vue'
import DataProvenanceChip from '@/components/ui/DataProvenanceChip.vue'
import HudButton from '@/components/ui/HudButton.vue'
import { AUTHORITY_TIER } from '@/lib/powerScore'

/**
 * Methodology and sources (/sobre, IA-1): takes the conceptual weight off
 * the map. Hosts the power-scale explanation, the two dimensions, the
 * mixed-data policy with the provenance seals, and the standing disclaimer.
 */
const AUTHORITY_SAMPLE: { label: string; tier: keyof typeof AUTHORITY_TIER }[] = [
  { label: 'PRESIDÊNCIA', tier: 'presidencia' },
  { label: 'GOVERNADOR', tier: 'governador' },
  { label: 'SENADOR', tier: 'senador' },
  { label: 'PREFEITO DE CAPITAL', tier: 'prefeitoCapital' },
  { label: 'CEO DE GRANDE EMPRESA', tier: 'ceoGrandeEmpresa' },
  { label: 'VEREADOR', tier: 'vereador' },
]
</script>

<template>
  <div class="about">
    <header class="about-head">
      <div>
        <h1 class="about-title pa-data">SOBRE // METODOLOGIA</h1>
        <p class="pa-label">O QUE O POWERATLAS MEDE, DE ONDE VÊM OS DADOS E O QUE AINDA É SIMULADO</p>
      </div>
      <HudButton :tag="RouterLink" to="/">◄ VOLTAR AO MAPA</HudButton>
    </header>

    <section class="about-section">
      <h2 class="about-h2 pa-label">A ESCALA DE PODER (0-100)</h2>
      <div class="about-split">
        <div>
          <p class="about-copy">
            Um índice único que vale para qualquer agente, de um cidadão comum a
            um presidente, combinando três pilares: <strong>Capital</strong>
            (patrimônio controlado, em régua logarítmica), <strong>Autoridade</strong>
            (poder formal do cargo público ou span de controle privado) e
            <strong>Influência</strong> (alcance e mobilização: rede, mídia,
            votos, base). A soma é ponderada de propósito: um bilionário sem
            cargo ainda pontua alto via capital e influência.
          </p>
          <p class="about-copy">
            Referência completa da régua em
            <code class="pa-data">docs/power-scale.md</code>. Alguns patamares
            de autoridade:
          </p>
          <ul class="about-tiers pa-data">
            <li v-for="row in AUTHORITY_SAMPLE" :key="row.tier">
              <span>{{ row.label }}</span>
              <span class="about-tier-value">{{ AUTHORITY_TIER[row.tier] }}</span>
            </li>
          </ul>
        </div>
        <PowerScaleFormula />
      </div>
    </section>

    <section class="about-section">
      <h2 class="about-h2 pa-label">AS DUAS DIMENSÕES DE INFLUÊNCIA</h2>
      <p class="about-copy">
        <strong class="about-official">OFICIAL (ciano)</strong>: a estrutura
        constitucional e corporativa visível de cada região. É a dimensão
        exibida hoje nos rankings.
      </p>
      <p class="about-copy">
        <strong class="about-hidden">OCULTA (âmbar)</strong>: a influência real
        que não aparece em organograma. Está bloqueada como "em breve": ela só
        entra quando o pipeline de dados públicos com fontes citadas passar por
        revisão humana, e mesmo então nomeando organizações, com toda alegação
        carregando a citação de origem.
      </p>
    </section>

    <section class="about-section">
      <h2 class="about-h2 pa-label">DADOS MISTOS, SEMPRE MARCADOS</h2>
      <p class="about-copy">
        Números reais e placeholders de desenvolvimento convivem no produto, e
        cada número diz de onde veio pelo selo de origem:
      </p>
      <div class="about-chips">
        <DataProvenanceChip state="real" label="IBGE · COMEX · TESOURO · TSE" />
        <DataProvenanceChip state="simulated" />
        <DataProvenanceChip state="review" />
      </div>
      <p class="about-copy">
        São reais hoje: população, área e PIB (IBGE), comércio exterior
        (Comex Stat/MDIC), fluxo fiscal de 2025 (Receita, Tesouro e Portal da
        Transparência) e partidos municipais (TSE 2024). São simulados: todos
        os rankings de influência e suas entidades, que seguem fictícias até o
        gate de revisão. EM REVISÃO fica reservado para os candidatos do
        pipeline.
      </p>
    </section>

    <footer class="about-foot">
      <p class="about-disclaimer pa-data">
        ⚠ PROTÓTIPO · DADOS SIMULADOS MARCADOS · ENTIDADES DE RANKING FICTÍCIAS
      </p>
      <p class="pa-label about-foot-note">
        FONTES E RESSALVAS COMPLETAS: DOCS/DATA-SOURCES.MD · DOCS/POWER-SCALE.MD
      </p>
    </footer>
  </div>
</template>

<style scoped>
.about {
  height: 100%;
  padding: var(--pa-space-6) var(--pa-space-8) var(--pa-space-10);
  overflow-y: auto;
  background: var(--pa-bg-void);
  scrollbar-width: thin;
  scrollbar-color: var(--pa-border-cyan) transparent;
}

.about-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pa-space-4);
  max-width: 880px;
  margin: 0 auto var(--pa-space-8);
}

.about-title {
  margin: 0 0 var(--pa-space-05);
  font-size: var(--pa-text-xl);
  letter-spacing: 0.18em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 16px rgba(61, 225, 255, 0.45);
}

.about-section {
  max-width: 880px;
  margin: 0 auto var(--pa-space-8);
  padding: var(--pa-space-4);
  border: 1px solid var(--pa-border-faint);
  background: rgba(61, 225, 255, 0.02);
}

.about-h2 {
  margin: 0 0 var(--pa-space-3);
  color: var(--pa-series-official);
}

.about-split {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--pa-space-6);
}

.about-split > div {
  flex: 1;
  min-width: 280px;
}

.about-copy {
  margin: 0 0 var(--pa-space-3);
  font-size: var(--pa-text-sm);
  line-height: 1.7;
  color: var(--pa-text-dim);
}

.about-copy strong {
  color: var(--pa-text-primary);
  font-weight: 600;
}

.about-copy code {
  font-size: var(--pa-text-xs);
  color: var(--pa-series-official);
}

.about-official {
  color: var(--pa-series-official) !important;
}

.about-hidden {
  color: var(--pa-series-hidden) !important;
}

.about-tiers {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--pa-text-xs);
  color: var(--pa-text-primary);
}

.about-tiers li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--pa-space-3);
  padding-bottom: var(--pa-space-05);
  border-bottom: 1px solid var(--pa-border-faint);
}

.about-tier-value {
  color: var(--pa-series-official);
}

.about-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pa-space-2);
  margin: 0 0 var(--pa-space-3);
}

.about-foot {
  max-width: 880px;
  margin: 0 auto;
}

.about-disclaimer {
  margin: 0 0 var(--pa-space-2);
  font-size: var(--pa-text-xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-hidden);
}

.about-foot-note {
  margin: 0;
  color: var(--pa-text-faint);
}
</style>
