import { defineStore } from 'pinia'

import type { AnalysisState } from '@/lib/analysisUrl'
import { useComercioStore } from '@/stores/comercio'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useMapLayersStore } from '@/stores/mapLayers'
import { useRankingsStore } from '@/stores/rankings'
import { useSelectionStore } from '@/stores/selection'

/**
 * Bridge between the serializable AnalysisState (lib/analysisUrl.ts) and the
 * live stores (IA-3). snapshot() reads the current analysis; apply() rebuilds
 * one by mirroring the SAME flows MapScreen and the command palette use, so
 * a URL replay cannot diverge from a click path.
 */
export const useAnalysisStore = defineStore('analysis', () => {
  const selection = useSelectionStore()
  const rankings = useRankingsStore()
  const comercio = useComercioStore()
  const demografia = useDemografiaStore()
  const fiscal = useFiscalStore()
  const mapLayers = useMapLayersStore()

  function snapshot(): AnalysisState {
    const state: AnalysisState = {}
    if (selection.selectedPartner) state.parceiro = selection.selectedPartner.iso
    else if (selection.selectedId) state.region = selection.selectedId
    if (selection.demographicView) {
      state.view = 'demografia'
      if (selection.demographicMetric === 'gdp') state.metric = 'gdp'
      if (selection.demographicUf) state.uf = selection.demographicUf
    }
    state.trade = [...selection.tradeDirs]
    state.setas = selection.tradeArrowsVisible
    if (selection.bearingOverride !== null) state.brg = selection.bearingOverride
    if (selection.pitchOverride !== null) state.pit = selection.pitchOverride
    return state
  }

  /** Applies only the fields present; an empty state is a no-op on purpose. */
  async function apply(state: AnalysisState) {
    if (state.brg !== undefined) selection.bearingOverride = state.brg
    if (state.pit !== undefined) selection.pitchOverride = state.pit
    if (state.trade?.length) selection.tradeDirs = [...state.trade]
    if (state.setas === false && selection.tradeArrowsVisible) selection.toggleTradeArrows()

    if (state.region) {
      await rankings.load()
      const region = rankings.regionById(state.region)
      if (region) {
        selection.exitDemographicView()
        selection.select(region.id, region.name)
      }
    } else if (state.parceiro) {
      await comercio.load()
      const partner = comercio.byIso.get(state.parceiro)
      if (partner) {
        selection.exitDemographicView()
        selection.selectTradePartner({ iso: partner.iso, name: partner.name })
        selection.requestCamera('global')
      }
    }

    if (state.view === 'demografia') {
      // Mirrors MapScreen.viewDemographic (the palette does the same).
      void demografia.load()
      void fiscal.load()
      void mapLayers.loadAllMunicipios()
      selection.enterDemographicView()
      if (state.metric === 'gdp') selection.setDemographicMetric('gdp')
      if (state.uf) selection.selectDemographicUf(state.uf)
    }
  }

  return { snapshot, apply }
})
