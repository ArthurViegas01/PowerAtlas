/**
 * Shape of GET /api/v1/stats: row counts of the served content tables and
 * aggregates of the F5 pipeline staging. Mirrors src/models/stats.py
 * (camelCase). Provenance/volume only, never scores.
 */

export interface SourceStat {
  id: string
  name: string
  documents: number
  lastPublished: string | null
}

export interface DayCount {
  day: string
  count: number
}

export interface ContentStats {
  regions: number
  entities: number
  ambientSignals: number
  influenceLinks: number
}

export interface PipelineStats {
  documents: number
  candidates: number
  scoringRuns: number
  sources: SourceStat[]
  documentsByDay: DayCount[]
}

export interface StatsResponse {
  generatedAt: string
  database: boolean
  /** Whether an admin is configured (PA_ADMIN_PASSWORD): writes possible after login. */
  writesAllowed: boolean
  content: ContentStats
  pipeline: PipelineStats
}
