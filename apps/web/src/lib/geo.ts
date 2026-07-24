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

/** One vertical quad per boundary edge, as a closed ring of [lon, lat, z]. */
export type WallQuad = [number, number, number][]

const wallCache = new WeakMap<object, Map<string, WallQuad[]>>()

/**
 * Explicit wall geometry for the boundary relief layers. deck.gl 9 can't
 * draw an extrusion's side faces without also filling the top (`filled`
 * gates both models in SolidPolygonLayer), so the walls are built by hand:
 * a vertical quad standing on every boundary edge. `base` lets callers
 * stack bands of the same wall with different alphas (a cheap vertical
 * gradient). Cached per collection and band because the meshes are static
 * and buildDeckLayers runs on every interaction.
 */
export function boundaryWallQuads(
  collection: FeatureCollection<Polygon | MultiPolygon, unknown>,
  top: number,
  base = 0,
): WallQuad[] {
  let byBand = wallCache.get(collection)
  if (!byBand) {
    byBand = new Map()
    wallCache.set(collection, byBand)
  }
  const key = `${base}:${top}`
  const cached = byBand.get(key)
  if (cached) return cached

  const quads: WallQuad[] = []
  const walkRings = (coords: unknown): void => {
    if (!Array.isArray(coords) || coords.length === 0) return
    const first = coords[0] as unknown[]
    if (Array.isArray(first) && typeof first[0] === 'number') {
      // GeoJSON rings are closed (last point repeats the first), so
      // consecutive pairs already cover every edge.
      const ring = coords as [number, number][]
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i]
        const [x2, y2] = ring[i + 1]
        if (x1 === x2 && y1 === y2) continue
        quads.push([
          [x1, y1, base],
          [x2, y2, base],
          [x2, y2, top],
          [x1, y1, top],
          [x1, y1, base],
        ])
      }
      return
    }
    for (const child of coords) walkRings(child)
  }
  for (const feature of collection.features) walkRings(feature.geometry.coordinates)

  byBand.set(key, quads)
  return quads
}

/** One boundary ring lifted to the top of a wall, as [lon, lat, height]. */
export type CrestPath = [number, number, number][]

const crestCache = new WeakMap<object, Map<number, CrestPath[]>>()

/**
 * The top edges of the boundary walls (boundaryWallQuads) as 3D paths, so a
 * PathLayer can draw a bright crest line where the wall meets the sky.
 * Same caching rationale as the quads.
 */
export function boundaryCrestPaths(
  collection: FeatureCollection<Polygon | MultiPolygon, unknown>,
  height: number,
): CrestPath[] {
  let byHeight = crestCache.get(collection)
  if (!byHeight) {
    byHeight = new Map()
    crestCache.set(collection, byHeight)
  }
  const cached = byHeight.get(height)
  if (cached) return cached

  const paths: CrestPath[] = []
  const walkRings = (coords: unknown): void => {
    if (!Array.isArray(coords) || coords.length === 0) return
    const first = coords[0] as unknown[]
    if (Array.isArray(first) && typeof first[0] === 'number') {
      paths.push((coords as [number, number][]).map(([x, y]) => [x, y, height]))
      return
    }
    for (const child of coords) walkRings(child)
  }
  for (const feature of collection.features) walkRings(feature.geometry.coordinates)

  byHeight.set(height, paths)
  return paths
}

/** A município outline ring, tagged with its código for the click lift. */
export interface MunicipioRing {
  codigo: string
  ring: [number, number][]
}

const ringCache = new WeakMap<object, Map<string, MunicipioRing[]>>()

/**
 * Municipal outline rings whose código starts with `prefix` (the 2-digit UF
 * code), so the demographic click effect can lift just the selected state's
 * mesh. Cached per collection and prefix.
 */
export function municipalRingsByPrefix(
  collection: FeatureCollection<Polygon | MultiPolygon, { codigo: string }>,
  prefix: string,
): MunicipioRing[] {
  let byPrefix = ringCache.get(collection)
  if (!byPrefix) {
    byPrefix = new Map()
    ringCache.set(collection, byPrefix)
  }
  const cached = byPrefix.get(prefix)
  if (cached) return cached

  const out: MunicipioRing[] = []
  for (const feature of collection.features) {
    const codigo = feature.properties.codigo
    if (!codigo || !codigo.startsWith(prefix)) continue
    const walkRings = (coords: unknown): void => {
      if (!Array.isArray(coords) || coords.length === 0) return
      const first = coords[0] as unknown[]
      if (Array.isArray(first) && typeof first[0] === 'number') {
        out.push({ codigo, ring: coords as [number, number][] })
        return
      }
      for (const child of coords) walkRings(child)
    }
    walkRings(feature.geometry.coordinates)
  }
  byPrefix.set(prefix, out)
  return out
}

function boundsOf(coords: unknown): Bounds {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  walkPositions(coords, (lon, lat) => {
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

/**
 * How far (in degrees) a MultiPolygon part may sit from the largest part and
 * still count toward the framing bounds. Keeps coastal islands (Marajó,
 * Florianópolis, Ilhabela) while dropping oceanic specks: Trindade (ES,
 * ~10°), Fernando de Noronha (PE, ~2.4°) and Atol das Rocas (RN) would drag
 * the camera into the open sea.
 */
const MAINLAND_MARGIN_DEG = 1.5

export function featureBounds(feature: Feature<Polygon | MultiPolygon, unknown>): Bounds {
  const { geometry } = feature
  if (geometry.type !== 'MultiPolygon' || geometry.coordinates.length <= 1) {
    return boundsOf(geometry.coordinates)
  }
  const parts = geometry.coordinates.map((polygon) => boundsOf(polygon))
  let anchor = parts[0]
  let anchorSize = -Infinity
  for (const part of parts) {
    const size = (part[1][0] - part[0][0]) * (part[1][1] - part[0][1])
    if (size > anchorSize) {
      anchorSize = size
      anchor = part
    }
  }
  let [[west, south], [east, north]] = anchor
  for (const [[w, s], [e, n]] of parts) {
    const near =
      w <= anchor[1][0] + MAINLAND_MARGIN_DEG &&
      e >= anchor[0][0] - MAINLAND_MARGIN_DEG &&
      s <= anchor[1][1] + MAINLAND_MARGIN_DEG &&
      n >= anchor[0][1] - MAINLAND_MARGIN_DEG
    if (!near) continue
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
