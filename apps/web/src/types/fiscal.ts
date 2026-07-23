/** Federal money flows of one município (values in whole BRL). */
export interface FiscalMunicipio {
  codigo: string
  /** Total federal tax collected in the município (Receita Federal). */
  arrecadacao: number
  /** Social-security (Previdência/INSS) share of `arrecadacao`. */
  previdencia: number
  /** Imposto de Renda share of `arrecadacao`. */
  ir: number
  /** IPI share of `arrecadacao`. */
  ipi: number
  /** Constitutional/legal transfers received from the União (Tesouro). */
  transferencias: number
  /** FPM share of `transferencias`. */
  fpm: number
  /** FUNDEB share of `transferencias`. */
  fundeb: number
  /** Parliamentary amendment money received by local favorecidos. */
  emendas: number
}

/** Compact wire format produced by scripts/build-fiscal.mjs. */
export interface FiscalFile {
  referenceYear: number
  sources: Record<string, string>
  municipios: [string, number, number, number, number, number, number, number, number][]
}
