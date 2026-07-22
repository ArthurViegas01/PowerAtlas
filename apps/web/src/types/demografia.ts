/** Metric driving the demographic-view columns. */
export type DemografiaMetric = 'population' | 'gdp'

/** One município in the demographic view (from data/demografia/municipios.json). */
export interface DemografiaMunicipio {
  codigo: string
  name: string
  coordinates: [number, number]
  population: number
  /** PIB a preços correntes, em milhares de R$ (IBGE). */
  gdpBrlThousands: number
}

/** Raw file shape: tuples keep the 5.570-entry payload compact. */
export interface DemografiaFile {
  censusYear: number
  gdpYear: number
  municipios: [string, string, number, number, number, number][]
}
