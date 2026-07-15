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

export function featureBounds(feature: BoundaryFeature): Bounds {
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
