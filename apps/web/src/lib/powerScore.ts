/**
 * PowerAtlas — escala de poder unificada (0-100).
 *
 * Um único índice que vale tanto para uma pessoa comum quanto para um
 * presidente, senador ou empresário, combinando três pilares:
 *
 *  - Capital (C):   dinheiro/patrimônio controlado, em escala logarítmica
 *                   (o dinheiro varia em ordens de grandeza).
 *  - Autoridade (A): poder formal do cargo (público) ou span de controle
 *                   (privado).
 *  - Influência (I): alcance/mobilização (rede, mídia, votos, base).
 *
 * `powerScore = round(wC·C + wA·A + wI·I)`, soma ponderada (não geométrica)
 * de propósito: um bilionário sem cargo (A=0) ainda pontua alto via C+I.
 *
 * Todos os índices são ESTIMATIVAS METODOLÓGICAS SIMULADAS — placeholders de
 * desenvolvimento, não medições. Ver docs/power-scale.md.
 */

/** Decomposição 0-100 de uma entidade nos três pilares. */
export interface PowerBreakdown {
  /** Capital econômico (dinheiro/patrimônio controlado). */
  capital: number
  /** Autoridade formal (cargo público ou controle corporativo). */
  authority: number
  /** Influência / alcance (rede, mídia, mobilização). */
  influence: number
}

/** Pesos dos três pilares na soma final (somam 1). */
export const POWER_WEIGHTS = { capital: 0.34, authority: 0.33, influence: 0.33 } as const

/**
 * Escala de referência do pilar Capital, em reais. Um patrimônio no PISO
 * pontua ~0; no TETO, ~100. A régua log entre eles cobre do jovem assalariado
 * ao bilionário.
 */
export const CAPITAL_FLOOR_BRL = 1e4 // R$ 10 mil
export const CAPITAL_CEIL_BRL = 1e11 // R$ 100 bilhões

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pilar Capital (0-100) a partir de um patrimônio/renda anual em reais, numa
 * régua logarítmica entre CAPITAL_FLOOR_BRL e CAPITAL_CEIL_BRL. Valores <= 0
 * (ou <= piso) caem em 0.
 */
export function capitalScore(valueBRL: number): number {
  if (!Number.isFinite(valueBRL) || valueBRL <= CAPITAL_FLOOR_BRL) return 0
  const t =
    (Math.log10(valueBRL) - Math.log10(CAPITAL_FLOOR_BRL)) /
    (Math.log10(CAPITAL_CEIL_BRL) - Math.log10(CAPITAL_FLOOR_BRL))
  return Math.round(clamp(t, 0, 1) * 100)
}

/**
 * Patamares de autoridade por cargo. Público e privado na mesma régua para o
 * índice ser comparável entre os setores. São âncoras de referência
 * (metodológicas), não uma hierarquia jurídica.
 */
export const AUTHORITY_TIER = {
  // Setor público
  presidencia: 100,
  vicePresidencia: 82,
  ministroStf: 85,
  presidenteCasaLegislativa: 84,
  ministroEstado: 78,
  governador: 75,
  senador: 70,
  deputadoFederal: 55,
  prefeitoCapital: 52,
  deputadoEstadual: 42,
  prefeito: 35,
  vereador: 18,
  // Setor privado (span de controle)
  controladorConglomerado: 80,
  ceoGrandeEmpresa: 68,
  donoMediaEmpresa: 40,
  donoPequenaEmpresa: 22,
  // Base
  cidadaoComum: 0,
} as const

export type AuthorityTier = keyof typeof AUTHORITY_TIER

/** Pilar Autoridade (0-100) para um patamar de cargo conhecido. */
export function authorityScore(tier: AuthorityTier): number {
  return AUTHORITY_TIER[tier]
}

/**
 * Índice de poder final (0-100) a partir da decomposição nos três pilares.
 * Cada pilar é presumido já em 0-100; a soma ponderada é arredondada e
 * limitada a [0, 100].
 */
export function powerScore({ capital, authority, influence }: PowerBreakdown): number {
  const raw =
    POWER_WEIGHTS.capital * clamp(capital, 0, 100) +
    POWER_WEIGHTS.authority * clamp(authority, 0, 100) +
    POWER_WEIGHTS.influence * clamp(influence, 0, 100)
  return Math.round(clamp(raw, 0, 100))
}
