<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import HudFrame from '@/components/hud/HudFrame.vue'
import HudHeader from '@/components/hud/HudHeader.vue'
import HudPanel from '@/components/hud/HudPanel.vue'
import MonitoringPanel from '@/components/hud/MonitoringPanel.vue'
import ScanlineOverlay from '@/components/hud/ScanlineOverlay.vue'
import MapCompass from '@/components/map/MapCompass.vue'
import MapLegend from '@/components/map/MapLegend.vue'
import MapScanEffect from '@/components/map/MapScanEffect.vue'
import MapTooltip from '@/components/map/MapTooltip.vue'
import MapView from '@/components/map/MapView.vue'
import RankingColumn from '@/components/rankings/RankingColumn.vue'
import IndicatorGrid from '@/components/shared/IndicatorGrid.vue'
import { HIDDEN_INFLUENCE_ENABLED } from '@/lib/features'
import { useIndicatorsStore } from '@/stores/indicators'
import { useMapLayersStore } from '@/stores/mapLayers'
import { useRankingsStore } from '@/stores/rankings'
import { useSelectionStore } from '@/stores/selection'

const selection = useSelectionStore()
const rankings = useRankingsStore()
const mapLayers = useMapLayersStore()
const indicators = useIndicatorsStore()

const region = computed(() => rankings.regionById(selection.selectedId))
const regionIndicators = computed(() => indicators.forRegion(selection.selectedId))
const municipioIndicators = computed(() =>
  indicators.forMunicipio(selection.selectedId, selection.selectedMunicipio?.codigo ?? null),
)
const booting = computed(() => !rankings.ready || !mapLayers.layerModel.ready)
const bootError = computed(() => rankings.error ?? mapLayers.error)

const panelTitle = computed(() =>
  (
    selection.selectedMunicipio?.name ??
    selection.selectedName ??
    selection.lockedWorld?.name ??
    selection.selectedId ??
    ''
  ).toUpperCase(),
)

const panelSubtitle = computed(() => {
  if (selection.selectedMunicipio)
    return `MUNICÍPIO · ${selection.selectedMunicipio.codigo} · ${selection.selectedId}`
  if (selection.lockedWorld) return 'REGIÃO NÃO MAPEADA · COBERTURA FUTURA'
  if (!region.value) return 'SEM COBERTURA NESTA FASE'
  const updated = new Date(region.value.updatedAt).toLocaleDateString('pt-BR')
  return `ATUALIZADO ${updated} · STATUS: SIMULAÇÃO`
})

function selectNational() {
  selection.select('BR', 'Brasil')
}

function reload() {
  window.location.reload()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Step out one level at a time: municipality -> state -> national.
  if (selection.selectedMunicipio) selection.clearMunicipio()
  else selection.goHome()
}

/** Deep link: /?region=SP preselects a region once data is ready. */
function applyDeepLink() {
  const regionId = new URLSearchParams(window.location.search)
    .get('region')
    ?.trim()
    .toUpperCase()
  if (!regionId || selection.hasSelection) return
  const known = rankings.regionById(regionId)
  const feature = mapLayers.states?.features.find(
    (candidate) => candidate.properties.UF === regionId,
  )
  const name = known?.name ?? feature?.properties.name
  if (name) selection.select(regionId, name)
}

watch(booting, (isBooting) => {
  if (!isBooting) applyDeepLink()
})

// Municipal indicators ride along with the state's municipal mesh: prefetch
// on state selection so the drill-down panel opens already populated.
watch(
  () => selection.selectedId,
  (regionId) => {
    if (regionId) void indicators.loadMunicipios(regionId)
  },
)

onMounted(() => {
  void rankings.load()
  void mapLayers.loadGeo()
  void indicators.loadUf()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-shell">
    <MapView />
    <MapTooltip />
    <MapScanEffect />
    <ScanlineOverlay />
    <HudFrame />
    <HudHeader
      @select-national="selectNational"
      @view-global="selection.requestCamera('global')"
    />

    <transition name="pa-fade">
      <div v-if="!selection.hasPanel && !booting" class="idle-hint">
        <p class="pa-data idle-line">
          ▸ SELECIONE UM ESTADO NO MAPA<span class="pa-blink">_</span>
        </p>
        <button class="idle-national pa-data" type="button" @click="selectNational">
          OU ABRIR VISÃO NACIONAL [BR]
        </button>
      </div>
    </transition>

    <transition name="pa-panel" mode="out-in">
      <aside
        v-if="selection.hasPanel"
        :key="selection.selectedId ?? selection.lockedWorld?.iso ?? 'none'"
        class="panel-slot"
      >
        <HudPanel :title="panelTitle" :subtitle="panelSubtitle">
          <template #actions>
            <button
              class="close pa-data"
              type="button"
              aria-label="Fechar painel (Esc)"
              @click="selection.closePanels()"
            >
              [X]
            </button>
          </template>

          <div v-if="selection.selectedMunicipio" class="no-data" data-reveal>
            <p class="no-data-title pa-data">◫ MUNICÍPIO</p>
            <IndicatorGrid
              v-if="municipioIndicators"
              :indicators="municipioIndicators"
              :source-label="indicators.sourceLabel"
            />
            <p class="no-data-sub">
              Ranking de influência municipal ainda não disponível: os índices por
              município chegam com o pipeline de dados das próximas fases.
            </p>
            <button
              class="back-home pa-data"
              type="button"
              @click="selection.clearMunicipio()"
            >
              ◄ VOLTAR AO ESTADO
            </button>
          </div>

          <div v-else-if="region" class="region-body">
            <IndicatorGrid
              v-if="regionIndicators"
              :indicators="regionIndicators"
              :source-label="indicators.sourceLabel"
            />
            <div class="columns">
              <RankingColumn variant="official" :entities="region.official" />
              <RankingColumn
                v-if="HIDDEN_INFLUENCE_ENABLED"
                variant="hidden"
                :entities="region.hidden"
              />
              <div v-else class="hidden-soon" data-reveal>
                <header class="hidden-soon-head">
                  <span class="hidden-soon-mark"></span>
                  <h3 class="hidden-soon-title pa-data">INFLUÊNCIA OCULTA</h3>
                </header>
                <p class="pa-label hidden-soon-tag">MÓDULO BLOQUEADO · EM BREVE</p>
                <p class="hidden-soon-copy">
                  O ranking de influência oculta entra em fases futuras, depois do
                  pipeline de dados com fontes citadas e do gate de revisão humana.
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="selection.lockedWorld" class="no-data" data-reveal>
            <p class="no-data-title pa-data">◫ ÁREA BLOQUEADA — NÃO MAPEADA</p>
            <p class="no-data-sub">
              Esta região ainda não foi mapeada pela matriz. A cobertura
              internacional entra em fases futuras — o foco atual do PowerAtlas é o
              Brasil.
            </p>
            <button class="back-home pa-data" type="button" @click="selection.goHome()">
              ◄ VOLTAR AO BRASIL
            </button>
          </div>

          <div v-else class="no-data" data-reveal>
            <p class="no-data-title pa-data">SEM DADOS PARA ESTA REGIÃO</p>
            <p class="no-data-sub">
              Esta região ainda não tem matriz de influência carregada. O recorte
              nacional e os 27 estados já trazem dados simulados; a cobertura
              real chega com o pipeline de dados das próximas fases.
            </p>
          </div>
        </HudPanel>
      </aside>
    </transition>

    <MapLegend />
    <MapCompass />
    <MonitoringPanel />

    <footer class="disclaimer pa-data" role="note">
      ⚠ {{ rankings.disclaimer || 'PROTÓTIPO · DADOS SIMULADOS · ENTIDADES FICTÍCIAS' }}
    </footer>

    <!-- explicit duration: timer-based removal even if the tab is hidden
         and transitionend never fires -->
    <transition name="pa-fade" :duration="450">
      <div v-if="booting" class="boot" aria-live="polite">
        <template v-if="!bootError">
          <p class="boot-line pa-data">
            INICIALIZANDO MATRIZ DE INFLUÊNCIA<span class="pa-blink">▌</span>
          </p>
          <p class="pa-label">CARREGANDO MALHAS IBGE + DATASET SIMULADO…</p>
        </template>
        <template v-else>
          <p class="boot-line boot-error pa-data">FALHA DE INICIALIZAÇÃO</p>
          <p class="pa-label">{{ bootError }}</p>
          <button class="retry pa-data" type="button" @click="reload">
            TENTAR NOVAMENTE
          </button>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.app-shell {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--pa-bg-void);
}

.panel-slot {
  position: absolute;
  top: 84px;
  right: 24px;
  bottom: 64px;
  z-index: 20;
  display: flex;
  width: min(520px, 44vw);
}

.panel-slot > * {
  flex: 1;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.idle-hint {
  position: absolute;
  left: 50%;
  bottom: 100px;
  z-index: 15;
  transform: translateX(-50%);
  text-align: center;
}

.idle-line {
  margin: 0;
  font-size: var(--pa-text-sm);
  letter-spacing: 0.14em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 12px rgba(61, 225, 255, 0.4);
}

.idle-national {
  margin-top: 10px;
  padding: 6px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
  background: rgba(3, 6, 8, 0.6);
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

.idle-national:hover {
  box-shadow: var(--pa-glow-cyan);
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

.no-data-title {
  margin: 12px 0 6px;
  font-size: var(--pa-text-md);
  letter-spacing: 0.12em;
  color: var(--pa-series-hidden);
}

/* Locked second column while the hidden dimension is "em breve". */
.hidden-soon {
  min-width: 0;
  padding: 10px 12px;
  border: 1px dashed color-mix(in srgb, var(--pa-series-hidden) 45%, transparent);
  background: color-mix(in srgb, var(--pa-series-hidden) 4%, transparent);
}

.hidden-soon-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--pa-series-hidden) 30%, transparent);
}

.hidden-soon-mark {
  width: 8px;
  height: 8px;
  flex: none;
  border: 1px dashed var(--pa-series-hidden);
}

.hidden-soon-title {
  flex: 1;
  margin: 0;
  font-size: var(--pa-text-xs);
  font-weight: 600;
  letter-spacing: 0.16em;
  color: color-mix(in srgb, var(--pa-series-hidden) 75%, transparent);
}

.hidden-soon-tag {
  margin: 5px 0 4px;
}

.hidden-soon-copy {
  margin: 8px 0 0;
  font-size: var(--pa-text-2xs);
  line-height: 1.5;
  color: var(--pa-text-dim);
}

.no-data-sub {
  margin: 0;
  max-width: 46ch;
  font-size: var(--pa-text-sm);
  line-height: 1.5;
  color: var(--pa-text-dim);
}

.back-home {
  margin-top: 14px;
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

.disclaimer {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 25;
  transform: translateX(-50%);
  padding: 4px 12px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  white-space: nowrap;
  color: var(--pa-series-hidden);
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid color-mix(in srgb, var(--pa-series-hidden) 35%, transparent);
}

.boot {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: grid;
  place-content: center;
  gap: 10px;
  text-align: center;
  background: color-mix(in srgb, var(--pa-bg-void) 88%, transparent);
}

.boot-line {
  margin: 0;
  font-size: var(--pa-text-lg);
  letter-spacing: 0.18em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 14px rgba(61, 225, 255, 0.45);
}

.boot-error {
  color: var(--pa-danger);
  text-shadow: none;
}

.retry {
  justify-self: center;
  margin-top: 6px;
  padding: 6px 14px;
  font-size: var(--pa-text-xs);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
}

@media (max-width: 900px) {
  .panel-slot {
    top: auto;
    right: 12px;
    bottom: 52px;
    left: 12px;
    width: auto;
    max-height: 58vh;
  }

  .columns {
    grid-template-columns: 1fr;
  }

  .disclaimer {
    display: none;
  }
}
</style>
