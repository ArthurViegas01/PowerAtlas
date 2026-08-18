/**
 * PowerAtlas data contract.
 *
 * This is the exact JSON shape the Phase 2 FastAPI backend will serve; the
 * Phase 1 mock files in `src/data/mock` already conform to it, so swapping
 * `services/mockDataLoader.ts` for a real `apiClient.ts` is a one-file
 * change. `status` / `confidence` / `sources` exist now because the future
 * review workflow (draft -> single-admin approval -> published) needs them.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type ReviewStatus = 'draft' | 'published'

export type PowerDimension = 'official' | 'hidden'

/**
 * The other axis of the national card: a collective actor (a party, an
 * institution, a documented organization) versus a single person (an office
 * holder, a businessperson). Cross with `dimension` to get the four sections.
 */
export type EntityClass = 'group' | 'individual'

export type EntityKind =
  | 'office'
  | 'institution'
  | 'organization'
  | 'faction'
  | 'movement'
  | 'economic-bloc'
  | 'person'

/**
 * Decomposition of `score` into the three pillars of the power scale
 * (0-100 each). See lib/powerScore.ts and docs/power-scale.md. When present,
 * `score` should equal `powerScore(power)`.
 */
export interface PowerBreakdown {
  capital: number
  authority: number
  influence: number
}

export interface SourceCitation {
  id: string
  label: string
  url?: string
  publishedAt?: string
  note?: string
}

export interface PowerEntity {
  id: string
  name: string
  kind: EntityKind
  dimension: PowerDimension
  /** 0-100 influence index. Phase 1: dummy placeholder values. */
  score: number
  /** Score change since the previous assessment cycle. */
  delta: number
  confidence: ConfidenceLevel
  status: ReviewStatus
  sources: SourceCitation[]
  note?: string
  /** Group vs individual — the second axis of the national 4-section card. */
  entityClass?: EntityClass
  /** The three-pillar decomposition behind `score`. */
  power?: PowerBreakdown
  /** Party sigla for an individual office holder (badge). */
  party?: string
  /** Human-readable role/title ("Senador", "Governador", "Empresário"). */
  role?: string
}

export interface RegionCapital {
  name: string
  /** [longitude, latitude] — anchors the deck.gl column/arc layers. */
  coordinates: [number, number]
}

export interface PowerRegion {
  /** 'BR' for the country, otherwise the UF sigla (joins GeoJSON `UF`). */
  id: string
  name: string
  kind: 'country' | 'state'
  capital: RegionCapital
  updatedAt: string
  official: PowerEntity[]
  hidden: PowerEntity[]
}

export interface InfluenceLink {
  id: string
  /** Region ids ('BR' or UF sigla). */
  from: string
  to: string
  /** 0-1 relative strength; drives arc width/opacity. */
  strength: number
  dimension: PowerDimension
  label?: string
}

export interface AmbientSignal {
  /** [longitude, latitude] */
  coordinates: [number, number]
  /** 0-1 heatmap weight. */
  weight: number
}

export interface RegionPowerData {
  schemaVersion: 1
  generatedAt: string
  /** Rendered permanently in the UI while data is simulated. */
  disclaimer: string
  regions: PowerRegion[]
  links: InfluenceLink[]
  ambientSignals: AmbientSignal[]
}
