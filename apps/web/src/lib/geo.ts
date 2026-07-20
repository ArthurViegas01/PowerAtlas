import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

/** Properties written by scripts/fetch-geo.mjs onto every boundary feature. */
export interface BoundaryProps {
  codarea: string
  /** 'BR' for the national outline, otherwise the UF sigla. */
  UF: string
  name: string
}

export type BoundaryFeature = Feature<Polygon | MultiPolygon, BoundaryProps>
export type BoundaryCollection = FeatureCollection<Polygon | MultiPolygon, BoundaryProps>

/** Properties of the Natural Earth "coming soon" world backdrop. */
export interface WorldProps {
  /** ISO 3166-1 alpha-3-ish code (NE ADM0_A3). */
  iso: string
  /** Country name, Portuguese localization when available. */
  name: string
}

export type WorldFeature = Feature<Polygon | MultiPolygon, WorldProps>
export type WorldCollection = FeatureCollection<Polygon | MultiPolygon, WorldProps>

/** Municipal mesh properties (scripts/fetch-geo.mjs, municipios/{UF}.geojson). */
export interface MunicipioProps {
  /** 7-digit IBGE municipality code. */
  codigo: string
  name: string
}

export type MunicipioFeature = Feature<Polygon | MultiPolygon, MunicipioProps>
export type MunicipioCollection = FeatureCollection<Polygon | MultiPolygon, MunicipioProps>

/** [[west, south], [east, north]] — the shape maplibre's fitBounds accepts. */
export type Bounds = [[number, number], [number, number]]

function walkPositions(coords: unknown, visit: (lon: number, lat: number) => void): void {
  if (!Array.isArray(coords)) return
  if (typeof coords[0] === 'number') {
    visit(coords[0] as number, coords[1] as number)
    return
  }
  for (const child of coords) walkPositions(child, visit)
}

export function featureBounds(feature: Feature<Polygon | MultiPolygon, unknown>): Bounds {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  walkPositions(feature.geometry.coordinates, (lon, lat) => {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  })
  return [
    [west, south],
    [east, north],
  ]
}

export function collectionBounds(collection: BoundaryCollection): Bounds {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const feature of collection.features) {
    const [[w, s], [e, n]] = featureBounds(feature)
    if (w < west) west = w
    if (e > east) east = e
    if (s < south) south = s
    if (n > north) north = n
  }
  return [
    [west, south],
    [east, north],
  ]
}
