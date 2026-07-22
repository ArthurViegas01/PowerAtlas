/**
 * Build the demographic-view dataset (offline — no network).
 *
 * Joins the committed municipal meshes (public/geo/municipios/{UF}.geojson)
 * with the committed IBGE indicators (public/data/indicators/municipios/
 * {UF}.json) into one compact file for the "visão demográfica": a centroid
 * plus population and GDP per município, as tuples to keep the payload small.
 *
 * Output: public/data/demografia/municipios.json
 *   { censusYear, gdpYear, municipios: [[codigo, name, lon, lat, population,
 *     gdpBrlThousands], ...] }
 *
 * Run: `pnpm demografia` (root) or `node scripts/build-demografia.mjs`.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const GEO_DIR = join(root, 'public', 'geo', 'municipios')
const IND_DIR = join(root, 'public', 'data', 'indicators', 'municipios')
const OUT_FILE = join(root, 'public', 'data', 'demografia', 'municipios.json')

/**
 * Approximate centroid: vertex average of the largest ring. Columns only need
 * a plausible anchor inside the município; exact geodesic centroids would not
 * change what the eye sees at national zoom.
 */
function centroid(geometry) {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
  let ring = polygons[0][0]
  for (const polygon of polygons) {
    if (polygon[0].length > ring.length) ring = polygon[0]
  }
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x
    lat += y
  }
  const n = ring.length
  return [Number((lon / n).toFixed(4)), Number((lat / n).toFixed(4))]
}

const ufs = readdirSync(GEO_DIR)
  .filter((f) => f.endsWith('.geojson'))
  .map((f) => f.replace('.geojson', ''))
  .sort()

let censusYear = null
let gdpYear = null
const municipios = []
let missingIndicators = 0

for (const uf of ufs) {
  const mesh = JSON.parse(readFileSync(join(GEO_DIR, `${uf}.geojson`), 'utf8'))
  const indicators = JSON.parse(readFileSync(join(IND_DIR, `${uf}.json`), 'utf8'))
  censusYear ??= indicators.censusYear
  gdpYear ??= indicators.gdpYear
  for (const feature of mesh.features) {
    const { codigo, name } = feature.properties
    const data = indicators.municipios[codigo]
    if (!data) {
      missingIndicators += 1
      continue
    }
    const [lon, lat] = centroid(feature.geometry)
    municipios.push([
      codigo,
      name,
      lon,
      lat,
      data.population ?? 0,
      data.gdpBrlThousands ?? 0,
    ])
  }
}

municipios.sort((a, b) => a[0].localeCompare(b[0]))

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify({ censusYear, gdpYear, municipios }))

const kb = Math.round(Buffer.byteLength(JSON.stringify({ censusYear, gdpYear, municipios })) / 1024)
console.log(
  `demografia: ${municipios.length} municípios (${ufs.length} UFs) -> ${OUT_FILE} (${kb} KB)` +
    (missingIndicators ? ` · ${missingIndicators} sem indicadores (pulados)` : ''),
)
