import type { SubdivisaoLevel } from '@/lib/geo'
import type {
  ConfidenceLevel,
  EntityClass,
  EntityKind,
  ReviewStatus,
} from '@/types/power-entity'

/** Bairro or distrito: the panel must say which division it is showing. */
export const SUBDIVISAO_LABEL: Record<SubdivisaoLevel, string> = {
  bairro: 'BAIRRO',
  distrito: 'DISTRITO',
}

/** Plural, for the "N bairros / N distritos" line on the município panel. */
export const SUBDIVISAO_LABEL_PLURAL: Record<SubdivisaoLevel, string> = {
  bairro: 'bairros',
  distrito: 'distritos',
}

export const KIND_LABEL: Record<EntityKind, string> = {
  office: 'CARGO',
  institution: 'INSTITUIÇÃO',
  organization: 'ORGANIZAÇÃO',
  faction: 'FACÇÃO',
  movement: 'MOVIMENTO',
  'economic-bloc': 'BLOCO ECON.',
  person: 'PESSOA',
}

export const ENTITY_CLASS_LABEL: Record<EntityClass, string> = {
  group: 'GRUPO',
  individual: 'INDIVÍDUO',
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
