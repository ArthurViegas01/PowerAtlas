/**
 * Phase 2 data source: loads the dataset from the FastAPI backend (F3).
 *
 * Same public signature as `mockDataLoader.loadRegionPowerData`, so the two are
 * interchangeable behind `services/dataSource.ts`. The base URL comes from
 * `VITE_API_URL`; the endpoint mirrors the aggregated shape the mock loader
 * builds locally (`GET /api/v1/power-data`).
 */
import type { RegionPowerData } from '@/types/power-entity'

const POWER_DATA_PATH = '/api/v1/power-data'

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${POWER_DATA_PATH}`
}

export async function loadRegionPowerData(): Promise<RegionPowerData> {
  const baseUrl = import.meta.env.VITE_API_URL
  if (!baseUrl) throw new Error('VITE_API_URL is not set; cannot reach the API.')

  const response = await fetch(endpoint(baseUrl), {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as RegionPowerData
}
