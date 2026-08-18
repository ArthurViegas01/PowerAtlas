/**
 * Phase 2 data source: loads the dataset from the FastAPI backend (F3).
 *
 * Same public signature as `mockDataLoader.loadRegionPowerData`, so the two are
 * interchangeable behind `services/dataSource.ts`. The base URL comes from
 * `VITE_API_URL`; the endpoint mirrors the aggregated shape the mock loader
 * builds locally (`GET /api/v1/power-data`).
 */
import type {
  ImportedDatasetDetail,
  ImportedDatasetMeta,
  ImportPayload,
} from '@/types/importedDataset'
import type { MonitoringDocument } from '@/types/monitoring'
import type { RegionPowerData } from '@/types/power-entity'
import type { StatsResponse } from '@/types/stats'

const POWER_DATA_PATH = '/api/v1/power-data'
const MONITORING_PATH = '/api/v1/monitoring/documents'
const STATS_PATH = '/api/v1/stats'
const DATASETS_PATH = '/api/v1/datasets'
const LOGIN_PATH = '/api/v1/auth/login'

/**
 * In-memory admin session token, set by the admin store after login and sent as
 * a bearer on the write endpoints. Kept here (not in the store) so the low-level
 * fetch helpers can read it without a Vue dependency.
 */
let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

function authHeaders(): Record<string, string> {
  return authToken ? { authorization: `Bearer ${authToken}` } : {}
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

function apiBase(): string {
  const baseUrl = import.meta.env.VITE_API_URL
  if (!baseUrl) throw new Error('VITE_API_URL is not set; cannot reach the API.')
  return baseUrl
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(endpoint(apiBase(), path), {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

/** Turn an API error body ({detail: ...}) into a readable Error. */
async function apiError(response: Response): Promise<Error> {
  let detail = `${response.status} ${response.statusText}`
  try {
    const body = (await response.json()) as { detail?: string }
    if (body.detail) detail = body.detail
  } catch {
    /* non-JSON body */
  }
  return new Error(detail)
}

export async function loadRegionPowerData(): Promise<RegionPowerData> {
  return fetchJson<RegionPowerData>(POWER_DATA_PATH)
}

export async function loadMonitoringDocuments(limit = 8): Promise<MonitoringDocument[]> {
  const payload = await fetchJson<{ documents: MonitoringDocument[] }>(
    `${MONITORING_PATH}?limit=${limit}`,
  )
  return payload.documents
}

export async function loadStats(): Promise<StatsResponse> {
  return fetchJson<StatsResponse>(STATS_PATH)
}

export async function listDatasets(): Promise<ImportedDatasetMeta[]> {
  const payload = await fetchJson<{ datasets: ImportedDatasetMeta[] }>(DATASETS_PATH)
  return payload.datasets
}

export async function getDataset(id: string): Promise<ImportedDatasetDetail> {
  return fetchJson<ImportedDatasetDetail>(`${DATASETS_PATH}/${id}`)
}

/** Exchange the admin password for a session token (see apps/api auth). */
export async function login(password: string): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch(endpoint(apiBase(), LOGIN_PATH), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw await apiError(response)
  return (await response.json()) as { token: string; expiresAt: number }
}

export async function importDataset(payload: ImportPayload): Promise<ImportedDatasetMeta> {
  const response = await fetch(endpoint(apiBase(), `${DATASETS_PATH}/import`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await apiError(response)
  return (await response.json()) as ImportedDatasetMeta
}

export async function deleteDataset(id: string): Promise<void> {
  const response = await fetch(endpoint(apiBase(), `${DATASETS_PATH}/${id}`), {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!response.ok) throw await apiError(response)
}
