/**
 * Camada política: partido do prefeito eleito por município (TSE 2024).
 * Arquivo estático em public/data/political/municipios-partidos.json, gerado
 * por scripts/fetch-partidos.mjs.
 */
export interface PartidosFile {
  generatedAt: string
  /** Ano da eleição de referência (prefeito eleito). */
  referenceYear: number
  /** Código IBGE de 7 dígitos -> sigla do partido do prefeito eleito. */
  byCodigo: Record<string, string>
}
