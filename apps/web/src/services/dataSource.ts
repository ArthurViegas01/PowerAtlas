/**
 * Selects the active data source at build time.
 *
 * `VITE_API_URL` set   -> real FastAPI backend (`apiClient`).
 * `VITE_API_URL` unset -> bundled fictional mock (`mockDataLoader`), so the app
 *                         still runs fully offline with no backend.
 *
 * Consumers import `loadRegionPowerData` from here and never touch either
 * concrete loader directly.
 */
import {
  loadMonitoringDocuments as loadMonitoringFromApi,
  loadRegionPowerData as loadFromApi,
} from '@/services/apiClient'
import { loadRegionPowerData as loadFromMock } from '@/services/mockDataLoader'
import type { MonitoringDocument } from '@/types/monitoring'

export const usingApi = Boolean(import.meta.env.VITE_API_URL)

export const loadRegionPowerData = usingApi ? loadFromApi : loadFromMock

/** Offline mock has no ingested feed — the monitoring panel simply hides. */
export const loadMonitoringDocuments: (limit?: number) => Promise<MonitoringDocument[]> =
  usingApi ? loadMonitoringFromApi : async () => []
