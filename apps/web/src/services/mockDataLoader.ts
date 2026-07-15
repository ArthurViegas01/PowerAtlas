/**
 * Phase 1 data source: loads the fictional mock dataset from
 * `src/data/mock/*.json` with a small artificial latency.
 *
 * This module is the future API seam — a Phase 2 `apiClient.ts` will expose
 * the same `loadRegionPowerData(): Promise<RegionPowerData>` signature
 * backed by FastAPI instead of local JSON.
 */
import type {
  AmbientSignal,
  InfluenceLink,
  PowerRegion,
  RegionPowerData,
} from '@/types/power-entity'

const SIMULATED_LATENCY_MS = 350

export const MOCK_DISCLAIMER =
  'PROTÓTIPO · DADOS SIMULADOS · ENTIDADES DE "PODER OCULTO" SÃO FICTÍCIAS'

const moduleLoaders = import.meta.glob<unknown>('../data/mock/*.json', {
  import: 'default',
})

interface InfluenceNetwork {
  links: InfluenceLink[]
  ambientSignals: AmbientSignal[]
}

function fail(path: string, reason: string): never {
  throw new Error(`Malformed mock data file "${path}": ${reason}`)
}

function assertRegion(value: unknown, path: string): PowerRegion {
  const region = value as PowerRegion
  if (typeof region?.id !== 'string' || typeof region?.name !== 'string')
    fail(path, 'missing id/name')
  if (!Array.isArray(region.official) || !Array.isArray(region.hidden))
    fail(path, 'missing official/hidden entity arrays')
  if (!Array.isArray(region.capital?.coordinates))
    fail(path, 'missing capital coordinates')
  return region
}

function assertNetwork(value: unknown, path: string): InfluenceNetwork {
  const network = value as InfluenceNetwork
  if (!Array.isArray(network?.links) || !Array.isArray(network?.ambientSignals))
    fail(path, 'missing links/ambientSignals arrays')
  return network
}

export async function loadRegionPowerData(): Promise<RegionPowerData> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS))

  const regions: PowerRegion[] = []
  let network: InfluenceNetwork = { links: [], ambientSignals: [] }

  for (const [path, load] of Object.entries(moduleLoaders)) {
    const data = await load()
    if (path.endsWith('influence-network.json')) {
      network = assertNetwork(data, path)
    } else {
      regions.push(assertRegion(data, path))
    }
  }

  // Country first, then states alphabetically — stable panel/legend order.
  regions.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'country' ? -1 : 1,
  )

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    disclaimer: MOCK_DISCLAIMER,
    regions,
    links: network.links,
    ambientSignals: network.ambientSignals,
  }
}
