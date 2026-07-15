import type { ConfidenceLevel, EntityKind, ReviewStatus } from '@/types/power-entity'

export const KIND_LABEL: Record<EntityKind, string> = {
  office: 'CARGO',
  institution: 'INSTITUIÇÃO',
  organization: 'ORGANIZAÇÃO',
  faction: 'FACÇÃO',
  movement: 'MOVIMENTO',
  'economic-bloc': 'BLOCO ECON.',
}

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'ALTA',
  medium: 'MÉDIA',
  low: 'BAIXA',
}

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'EM REVISÃO',
  published: 'PUBLICADO',
}
