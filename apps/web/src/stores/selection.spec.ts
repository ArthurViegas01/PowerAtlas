import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSelectionStore } from '@/stores/selection'

describe('selection store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('selects a region, opens the panel and pings once', () => {
    const s = useSelectionStore()
    expect(s.hasSelection).toBe(false)
    s.select('SP', 'São Paulo', { x: 1, y: 2 })
    expect(s.selectedId).toBe('SP')
    expect(s.selectedName).toBe('São Paulo')
    expect(s.hasSelection).toBe(true)
    expect(s.hasPanel).toBe(true)
    expect(s.pingSeq).toBe(1)
    expect(s.lastPing).toEqual({ x: 1, y: 2 })
  })

  it('re-selecting the same id is a no-op (no extra ping)', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.select('SP', 'São Paulo')
    expect(s.pingSeq).toBe(1)
  })

  it('locking a world country and selecting a region are mutually exclusive', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.lockWorld({ iso: 'ARG', name: 'Argentina' })
    expect(s.selectedId).toBeNull()
    expect(s.lockedWorld).toEqual({ iso: 'ARG', name: 'Argentina' })
    expect(s.hasPanel).toBe(true)
    s.select('RJ', 'Rio de Janeiro')
    expect(s.lockedWorld).toBeNull()
    expect(s.selectedId).toBe('RJ')
  })

  it('closePanels clears panels without moving the camera', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    const seq = s.cameraRequest.seq
    s.closePanels()
    expect(s.hasPanel).toBe(false)
    expect(s.cameraRequest.seq).toBe(seq)
  })

  it('goHome closes panels and requests the national camera', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.goHome()
    expect(s.hasSelection).toBe(false)
    expect(s.cameraRequest).toEqual({ target: 'national', seq: 1 })
  })

  it('rotation bus increments seq with the requested kind', () => {
    const s = useSelectionStore()
    s.requestRotate(15)
    expect(s.rotateRequest).toEqual({ kind: 'by', delta: 15, seq: 1 })
    s.requestNorth()
    expect(s.rotateRequest).toMatchObject({ kind: 'north', seq: 2 })
    s.requestAutoBearing()
    expect(s.rotateRequest).toMatchObject({ kind: 'auto', seq: 3 })
  })

  it('stores the bearing override and the live map bearing', () => {
    const s = useSelectionStore()
    s.setBearingOverride(42)
    expect(s.bearingOverride).toBe(42)
    s.setBearingOverride(null)
    expect(s.bearingOverride).toBeNull()
    s.setMapBearing(90)
    expect(s.mapBearing).toBe(90)
  })

  it('drills into a municipality while keeping the state selected', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    const pingAfterState = s.pingSeq
    s.selectMunicipio('3550308', 'São Paulo', { x: 5, y: 6 })
    expect(s.selectedId).toBe('SP')
    expect(s.selectedMunicipio).toEqual({ codigo: '3550308', name: 'São Paulo' })
    expect(s.pingSeq).toBe(pingAfterState + 1)
  })

  it('re-selecting the same municipality is a no-op', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.selectMunicipio('3550308', 'São Paulo')
    const ping = s.pingSeq
    s.selectMunicipio('3550308', 'São Paulo')
    expect(s.pingSeq).toBe(ping)
  })

  it('clearMunicipio leaves the state selected', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.selectMunicipio('3550308', 'São Paulo')
    s.clearMunicipio()
    expect(s.selectedMunicipio).toBeNull()
    expect(s.selectedId).toBe('SP')
  })

  it('selecting another state or closing panels drops the municipality', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.selectMunicipio('3550308', 'São Paulo')
    s.select('RJ', 'Rio de Janeiro')
    expect(s.selectedMunicipio).toBeNull()
    s.selectMunicipio('3304557', 'Rio de Janeiro')
    s.closePanels()
    expect(s.selectedMunicipio).toBeNull()
  })

  it('tracks municipality hover and the tooltip anchor point', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.setHoveredMunicipio({ codigo: '3550308', name: 'São Paulo' })
    s.setHoverPoint({ x: 10, y: 20 })
    expect(s.hoveredMunicipio?.codigo).toBe('3550308')
    expect(s.hoverPoint).toEqual({ x: 10, y: 20 })
    s.setHoveredMunicipio(null)
    expect(s.hoveredMunicipio).toBeNull()
  })

  it('drops the municipal hover when the state changes or panels close', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    s.setHoveredMunicipio({ codigo: '3550308', name: 'São Paulo' })
    s.select('RJ', 'Rio de Janeiro')
    expect(s.hoveredMunicipio).toBeNull()
    s.setHoveredMunicipio({ codigo: '3304557', name: 'Rio de Janeiro' })
    s.closePanels()
    expect(s.hoveredMunicipio).toBeNull()
  })

  it('entering the demographic view closes panels and reframes nationally', () => {
    const s = useSelectionStore()
    s.select('SP', 'São Paulo')
    const camerasBefore = s.cameraRequest.seq
    s.enterDemographicView()
    expect(s.demographicView).toBe(true)
    expect(s.hasPanel).toBe(false)
    expect(s.cameraRequest.seq).toBe(camerasBefore + 1)
    expect(s.cameraRequest.target).toBe('national')
    // Re-entering is a no-op (no extra camera flight).
    s.enterDemographicView()
    expect(s.cameraRequest.seq).toBe(camerasBefore + 1)
  })

  it('crops on a state inside the demographic view and clears on exit', () => {
    const s = useSelectionStore()
    s.selectDemographicUf('SP') // ignored: not in the demographic view
    expect(s.demographicUf).toBeNull()
    s.enterDemographicView()
    s.selectDemographicUf('SP')
    expect(s.demographicUf).toBe('SP')
    s.selectDemographicUf(null)
    expect(s.demographicUf).toBeNull()
    s.selectDemographicUf('RJ')
    s.exitDemographicView()
    expect(s.demographicUf).toBeNull()
  })

  it('queues tilt requests and tracks the manual pitch override', () => {
    const s = useSelectionStore()
    expect(s.pitchRequest.seq).toBe(0)
    s.requestPitch(10)
    s.requestPitch(-10)
    expect(s.pitchRequest.seq).toBe(2)
    expect(s.pitchRequest.delta).toBe(-10)
    s.setPitchOverride(65)
    expect(s.pitchOverride).toBe(65)
    s.setPitchOverride(null)
    expect(s.pitchOverride).toBeNull()
  })

  it('exiting the demographic view clears its hover state', () => {
    const s = useSelectionStore()
    s.enterDemographicView()
    s.setHoveredDemografia({
      codigo: '3550308',
      name: 'São Paulo',
      population: 11_451_999,
      gdpBrlThousands: 1_100_000_000,
    })
    s.setDemographicMetric('gdp')
    s.exitDemographicView()
    expect(s.demographicView).toBe(false)
    expect(s.hoveredDemografia).toBeNull()
    expect(s.demographicMetric).toBe('gdp') // metric choice survives the exit
  })
})
