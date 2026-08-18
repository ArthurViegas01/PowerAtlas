import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { ICON_COLOR, iconForChapter, type MeshKey } from '@/lib/sectorIcons'
import type { TradeDirection } from '@/types/comercio'
import type {
  AgroMunicipio,
  AgroMunicipiosFile,
  AgroNational,
  ComercioUfFile,
  MunicipioVocacao,
  SectorOriginUf,
  VocacaoMunicipiosFile,
  VocacaoSectorKey,
  VocacaoShares,
  VocacaoSpecialty,
} from '@/types/vocacao'

/** A state's dominant export vocation, as a placeable 3D icon. */
export interface UfIcon {
  uf: string
  coordinates: [number, number]
  chapter: string
  mesh: MeshKey
  color: [number, number, number]
}

/** Location quotient at/above which a município counts as specialized. */
const LQ_THRESHOLD = 1.3
const SECTOR_KEYS: VocacaoSectorKey[] = ['agro', 'ind', 'serv', 'adm']

/**
 * Economic vocation: which sectors each state (foreign-trade, HS chapters) and
 * município (VAB activities) specializes in. Two small static files, loaded on
 * demand and cached for the session. Powers the state-targeting trade arrows and
 * the 3D sector objects. Failed loads stay retryable; success is remembered.
 */
export const useVocacaoStore = defineStore('vocacao', () => {
  // -- state vocation (comercio/uf.json) -------------------------------------
  const ufSectorLabels = ref<Record<string, string>>({})
  const ufReferenceYear = ref<number | null>(null)
  /**
   * Best origin UF per (partner iso, HS chapter), per direction: the state that
   * books the most of that sector's flow with that partner. Non-reactive body,
   * swapped as a whole so the trade model recomputes once when it loads.
   */
  const originIndex = shallowRef<Map<string, { export?: SectorOriginUf; import?: SectorOriginUf }>>(
    new Map(),
  )
  /** One 3D icon per UF, keyed to its dominant export sector, for the state view. */
  const ufIcons = shallowRef<UfIcon[]>([])

  // -- municipal vocation (vocacao/municipios.json) --------------------------
  const municipioBy = shallowRef<Map<string, MunicipioVocacao>>(new Map())
  const baseline = ref<VocacaoShares | null>(null)
  const vocacaoSectorLabels = ref<Record<VocacaoSectorKey, string> | null>(null)
  const municipioReferenceYear = ref<number | null>(null)

  const loadingUf = ref(false)
  const loadingMun = ref(false)
  const error = ref<string | null>(null)

  const ufLoaded = computed(() => originIndex.value.size > 0)
  const municipiosLoaded = computed(() => municipioBy.value.size > 0)

  /** Lookup key for the origin index. */
  const key = (iso: string, chapter: string) => `${iso}|${chapter}`

  /**
   * The state a partner's sector arrow should originate from, or null when the
   * dataset is not loaded or the pair has no booked origin UF. Falls back to the
   * combined direction if the queried one is empty.
   */
  function originUf(iso: string, chapter: string, direction: TradeDirection): SectorOriginUf | null {
    const entry = originIndex.value.get(key(iso, chapter))
    if (!entry) return null
    return entry[direction] ?? entry.export ?? entry.import ?? null
  }

  async function loadUf() {
    if (loadingUf.value || ufLoaded.value) return
    loadingUf.value = true
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/comercio/uf.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as ComercioUfFile
      ufSectorLabels.value = file.sectors
      ufReferenceYear.value = file.referenceYear
      // Invert ufs -> best origin UF per (partner, sector, direction). Each UF
      // sector lists its top partners; keep, per partner+sector, the UF with the
      // largest flow in each direction.
      const index = new Map<string, { export?: SectorOriginUf; import?: SectorOriginUf }>()
      const icons: UfIcon[] = []
      for (const [uf, lon, lat, , , sectors] of file.ufs) {
        const coordinates: [number, number] = [lon, lat]
        // The state's dominant export sector drives its 3D icon.
        let topChapter: string | null = null
        let topExp = 0
        for (const [chapter, exp, , partners] of sectors) {
          if (exp > topExp) {
            topExp = exp
            topChapter = chapter
          }
          for (const [iso, pExp, pImp] of partners) {
            const k = key(iso, chapter)
            const entry = index.get(k) ?? {}
            if (pExp > 0 && pExp > (entry.export?.value ?? 0)) {
              entry.export = { uf, coordinates, value: pExp }
            }
            if (pImp > 0 && pImp > (entry.import?.value ?? 0)) {
              entry.import = { uf, coordinates, value: pImp }
            }
            index.set(k, entry)
          }
        }
        if (topChapter) {
          const mesh = iconForChapter(topChapter)
          icons.push({ uf, coordinates, chapter: topChapter, mesh, color: ICON_COLOR[mesh] })
        }
      }
      originIndex.value = index
      ufIcons.value = icons
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loadingUf.value = false
    }
  }

  async function loadMunicipios() {
    if (loadingMun.value || municipiosLoaded.value) return
    loadingMun.value = true
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/vocacao/municipios.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as VocacaoMunicipiosFile
      baseline.value = file.baseline
      vocacaoSectorLabels.value = file.sectors
      municipioReferenceYear.value = file.referenceYear
      const map = new Map<string, MunicipioVocacao>()
      for (const [codigo, vabTotal, agro, ind, serv, adm] of file.municipios) {
        map.set(codigo, { codigo, vabTotal, shares: { agro, ind, serv, adm } })
      }
      municipioBy.value = map
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loadingMun.value = false
    }
  }

  /** Load both vocation datasets. */
  // -- fine agro vocation (vocacao/agro-municipios.json) ----------------------
  const agroBy = shallowRef<Map<string, AgroMunicipio>>(new Map())
  const agroNational = ref<AgroNational>({ soja: 0, cafe: 0, bovino: 0 })
  const agroSource = ref<string | null>(null)
  const loadingAgro = ref(false)
  const agroLoaded = computed(() => agroBy.value.size > 0)

  async function loadAgro() {
    if (loadingAgro.value || agroLoaded.value) return
    loadingAgro.value = true
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/vocacao/agro-municipios.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const file = (await response.json()) as AgroMunicipiosFile
      agroNational.value = file.national
      agroSource.value = file.source
      const map = new Map<string, AgroMunicipio>()
      for (const [codigo, soja, cafe, bovino] of file.municipios) {
        map.set(codigo, { codigo, soja, cafe, bovino })
      }
      agroBy.value = map
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loadingAgro.value = false
    }
  }

  async function load() {
    await Promise.all([loadUf(), loadMunicipios(), loadAgro()])
  }

  /**
   * A município's specialties, strongest first: activities whose local VAB share
   * beats the national baseline by at least LQ_THRESHOLD. Empty when the city has
   * no marked vocation (a balanced economy) or the dataset is not loaded.
   */
  function specialtiesFor(codigo: string): VocacaoSpecialty[] {
    const voc = municipioBy.value.get(codigo)
    const base = baseline.value
    if (!voc || !base) return []
    const out: VocacaoSpecialty[] = []
    for (const k of SECTOR_KEYS) {
      const share = voc.shares[k]
      const denom = base[k]
      if (denom <= 0) continue
      const lq = share / denom
      if (lq >= LQ_THRESHOLD) out.push({ key: k, share, lq })
    }
    return out.sort((a, b) => b.lq - a.lq)
  }

  /** The single dominant vocation of a município (top location quotient), or null. */
  function dominantFor(codigo: string): VocacaoSpecialty | null {
    return specialtiesFor(codigo)[0] ?? null
  }

  return {
    // state vocation
    ufSectorLabels,
    ufReferenceYear,
    ufLoaded,
    ufIcons,
    originUf,
    loadUf,
    // municipal vocation
    municipioBy,
    baseline,
    vocacaoSectorLabels,
    municipioReferenceYear,
    municipiosLoaded,
    specialtiesFor,
    dominantFor,
    // fine agro vocation
    agroBy,
    agroNational,
    agroSource,
    agroLoaded,
    loadAgro,
    // shared
    error,
    load,
    loadMunicipios,
  }
})
