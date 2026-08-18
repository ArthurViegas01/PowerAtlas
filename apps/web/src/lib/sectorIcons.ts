/**
 * Low-poly, wireframe sector "objects" planted over the map: a silo for the
 * agro, a factory for the indústria, a cluster of towers for serviços, a civic
 * block for administração, a heap for mining, a tank for oil. They are built as
 * 3D edge lists (not meshes) so they render through the same PathLayer the walls,
 * crests and flow rails already use, wearing the project's holographic glow with
 * no lighting or mesh-format fuss.
 *
 * Each archetype is authored once in a local unit frame: footprint within
 * ~[-0.5, 0.5] on the ground (x east, y north) and height 0..1 up (z). A
 * placement scales that frame to meters at a lon/lat anchor and converts the
 * ground offsets to degrees, so the same icon serves a state (big, at the UF
 * centroid) or a município (small, on its centroid).
 */
import type { VocacaoSectorKey } from '@/types/vocacao'

export type MeshKey = 'silo' | 'factory' | 'towers' | 'civic' | 'mine' | 'tank'

/** A single edge in the local unit frame: two [x, y, z] endpoints. */
type Edge = [[number, number, number], [number, number, number]]

// ── primitive edge builders ─────────────────────────────────────────────────

/** The 12 edges of an axis-aligned box centered at (cx, cy), z from z0 to z1. */
function box(cx: number, cy: number, hw: number, hd: number, z0: number, z1: number): Edge[] {
  const xs = [cx - hw, cx + hw]
  const ys = [cy - hd, cy + hd]
  const corner = (i: number, z: number): [number, number, number] => [
    xs[i & 1],
    ys[(i >> 1) & 1],
    z,
  ]
  // Bottom ring, top ring, four verticals. Order: 00,10,11,01.
  const idx = [0, 1, 3, 2]
  const edges: Edge[] = []
  for (let k = 0; k < 4; k++) {
    const a = idx[k]
    const b = idx[(k + 1) % 4]
    edges.push([corner(a, z0), corner(b, z0)])
    edges.push([corner(a, z1), corner(b, z1)])
  }
  for (let k = 0; k < 4; k++) edges.push([corner(idx[k], z0), corner(idx[k], z1)])
  return edges
}

/** Vertices of a regular n-gon of radius r centered at (cx, cy) at height z. */
function ringVerts(n: number, cx: number, cy: number, r: number, z: number): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z])
  }
  return out
}

/** A bare vertical line (used for civic columns). */
function pillar(cx: number, cy: number, z0: number, z1: number): Edge {
  return [
    [cx, cy, z0],
    [cx, cy, z1],
  ]
}

/**
 * Stack of rings, the workhorse for the detailed shapes. `levels` is a list of
 * [radius, z]; each ring is drawn and joined vertex-to-vertex to the next, so a
 * cylinder, a dome (shrinking radius), a tapered spire (last radius 0 = apex) or
 * a terraced pit (alternating radius at stepped heights) all fall out of the same
 * primitive. A radius near 0 collapses to a single apex point.
 */
function stack(n: number, cx: number, cy: number, levels: [number, number][]): Edge[] {
  const rings = levels.map(([r, z]) =>
    r < 1e-4 ? [[cx, cy, z] as [number, number, number]] : ringVerts(n, cx, cy, r, z),
  )
  const edges: Edge[] = []
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) edges.push([ring[i], ring[(i + 1) % ring.length]])
  }
  for (let j = 0; j < rings.length - 1; j++) {
    const a = rings[j]
    const b = rings[j + 1]
    const m = Math.max(a.length, b.length)
    for (let i = 0; i < m; i++) edges.push([a[i % a.length], b[i % b.length]])
  }
  return edges
}

/** A gabled (pitched) roof over a rectangular footprint, ridge running along x. */
function gable(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  zEave: number,
  zRidge: number,
): Edge[] {
  const yc = (y0 + y1) / 2
  const ridgeA: [number, number, number] = [x0, yc, zRidge]
  const ridgeB: [number, number, number] = [x1, yc, zRidge]
  return [
    [ridgeA, ridgeB],
    [[x0, y0, zEave], ridgeA],
    [[x0, y1, zEave], ridgeA],
    [[x1, y0, zEave], ridgeB],
    [[x1, y1, zEave], ridgeB],
  ]
}

/** A sawtooth factory roof: `teeth` risers + slopes spanning x0..x1, depth ±d. */
function sawtooth(
  x0: number,
  x1: number,
  d: number,
  teeth: number,
  zEave: number,
  zPeak: number,
): Edge[] {
  const w = (x1 - x0) / teeth
  const edges: Edge[] = []
  for (let i = 0; i < teeth; i++) {
    const xa = x0 + i * w
    const xb = xa + w
    for (const y of [d, -d]) {
      edges.push([
        [xa, y, zEave],
        [xa, y, zPeak],
      ])
      edges.push([
        [xa, y, zPeak],
        [xb, y, zEave],
      ])
    }
    edges.push([
      [xa, d, zPeak],
      [xa, -d, zPeak],
    ])
  }
  return edges
}

// ── archetypes ──────────────────────────────────────────────────────────────

const ARCHETYPES: Record<MeshKey, Edge[]> = {
  // Agro: a farm complex — two ribbed silos with domed caps and a gabled barn.
  silo: [
    // Tall silo with a domed roof.
    ...stack(10, -0.24, 0.04, [
      [0.12, 0],
      [0.12, 0.5],
      [0.115, 0.55],
      [0.085, 0.62],
      [0, 0.67],
    ]),
    // Short silo.
    ...stack(10, -0.05, 0.13, [
      [0.095, 0],
      [0.095, 0.36],
      [0.09, 0.41],
      [0.06, 0.48],
      [0, 0.52],
    ]),
    // Barn: walls plus a pitched roof.
    ...box(0.2, -0.05, 0.16, 0.12, 0, 0.2),
    ...gable(0.04, 0.36, -0.17, 0.07, 0.2, 0.36),
  ],
  // Indústria: a hall with a sawtooth roof, two chimneys and a side annex.
  factory: [
    ...box(-0.06, 0, 0.3, 0.2, 0, 0.32),
    // Three sawtooth teeth across the roof (glazed north faces stylized as slopes).
    ...sawtooth(-0.34, 0.24, 0.2, 3, 0.32, 0.46),
    // Chimneys.
    ...stack(6, 0.22, 0.09, [
      [0.032, 0],
      [0.032, 0.72],
    ]),
    ...stack(6, 0.29, -0.04, [
      [0.026, 0],
      [0.026, 0.6],
    ]),
    // Side annex.
    ...box(0.3, 0.13, 0.075, 0.08, 0, 0.17),
  ],
  // Serviços/comércio: a skyline — five towers, setbacks and a rooftop antenna.
  towers: [
    ...box(-0.33, 0.02, 0.09, 0.12, 0, 0.5),
    ...box(-0.13, 0.03, 0.1, 0.12, 0, 0.78),
    ...box(-0.13, 0.03, 0.06, 0.08, 0.78, 0.9),
    ...box(0.08, 0, 0.11, 0.13, 0, 1.0),
    pillar(0.08, 0, 1.0, 1.16),
    ...box(0.29, -0.02, 0.08, 0.11, 0, 0.62),
    ...box(0.18, 0.15, 0.06, 0.08, 0, 0.4),
  ],
  // Administração pública: a stepped, colonnaded capitol with a pediment and dome.
  civic: [
    // Three stepped base courses.
    ...box(0, 0, 0.5, 0.32, 0, 0.05),
    ...box(0, 0, 0.46, 0.29, 0.05, 0.1),
    ...box(0, 0, 0.42, 0.26, 0.1, 0.14),
    // A front row of six columns.
    ...[-0.35, -0.21, -0.07, 0.07, 0.21, 0.35].flatMap((x): Edge[] =>
      stack(6, x, 0.2, [
        [0.03, 0.14],
        [0.03, 0.6],
      ]),
    ),
    // Entablature over the columns.
    ...box(0, 0.2, 0.42, 0.08, 0.6, 0.68),
    // Pediment on the front face.
    [
      [-0.42, 0.28, 0.68],
      [0, 0.28, 0.84],
    ],
    [
      [0.42, 0.28, 0.68],
      [0, 0.28, 0.84],
    ],
    [
      [-0.42, 0.28, 0.68],
      [0.42, 0.28, 0.68],
    ],
    // Drum and dome set back over the block.
    ...stack(12, 0, -0.06, [
      [0.15, 0.14],
      [0.15, 0.5],
    ]),
    ...stack(12, 0, -0.06, [
      [0.15, 0.5],
      [0.13, 0.58],
      [0.09, 0.66],
      [0, 0.72],
    ]),
  ],
  // Mineração: a terraced open-pit / stepped quarry.
  mine: stack(8, 0, 0, [
    [0.5, 0],
    [0.5, 0.14],
    [0.38, 0.14],
    [0.38, 0.28],
    [0.27, 0.28],
    [0.27, 0.42],
    [0.15, 0.42],
    [0.15, 0.54],
    [0, 0.6],
  ]),
  // Petróleo: a tank farm — two cylindrical tanks with domed roofs and a pipe.
  tank: [
    ...stack(12, -0.1, 0.05, [
      [0.28, 0],
      [0.28, 0.48],
      [0.26, 0.54],
      [0.18, 0.61],
      [0, 0.66],
    ]),
    ...stack(12, 0.28, -0.08, [
      [0.16, 0],
      [0.16, 0.32],
      [0.14, 0.37],
      [0.09, 0.43],
      [0, 0.46],
    ]),
    // Connecting pipe between the two tanks.
    [
      [0.16, 0.03, 0.12],
      [0.2, -0.05, 0.12],
    ],
  ],
}

/** Identity color of each archetype (matches the sector palette family). */
export const ICON_COLOR: Record<MeshKey, [number, number, number]> = {
  silo: [120, 220, 120], // green (agro)
  factory: [255, 179, 71], // amber (indústria)
  towers: [61, 225, 255], // cyan (serviços)
  civic: [150, 170, 185], // slate (adm. pública)
  mine: [240, 140, 90], // orange (mineração)
  tank: [183, 139, 250], // violet (petróleo)
}

// ── sector -> archetype maps ────────────────────────────────────────────────

// HS chapters that read as agropecuária (grain, meat, coffee, sugar, cotton...).
const AGRO_CHAPTERS = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '12', '14', '15', '17', '18', '20', '21', '22', '23', '24', '52',
])
const MINE_CHAPTERS = new Set(['25', '26'])
const OIL_CHAPTERS = new Set(['27'])

/** Icon for a state's dominant export sector (HS chapter). */
export function iconForChapter(chapter: string): MeshKey {
  if (AGRO_CHAPTERS.has(chapter)) return 'silo'
  if (MINE_CHAPTERS.has(chapter)) return 'mine'
  if (OIL_CHAPTERS.has(chapter)) return 'tank'
  return 'factory'
}

/** Icon for a município's dominant VAB activity. */
export function iconForVocacao(key: VocacaoSectorKey): MeshKey {
  switch (key) {
    case 'agro':
      return 'silo'
    case 'ind':
      return 'factory'
    case 'adm':
      return 'civic'
    case 'serv':
    default:
      return 'towers'
  }
}

// ── placement ───────────────────────────────────────────────────────────────

/** One planted icon: where, which archetype, its glow color and its size (m). */
export interface SectorIconPlacement {
  position: [number, number]
  mesh: MeshKey
  color: [number, number, number]
  /** Height of the icon's unit frame, in meters. */
  scale: number
}

/**
 * One wireframe edge as a LineLayer segment. LineLayer (not PathLayer) is used
 * on purpose: PathLayer extrudes each segment into a ribbon perpendicular to its
 * *ground* direction, so a purely vertical edge (same lon/lat, only z changes)
 * has no ground direction and is dropped — the icons would show their horizontal
 * rings and sloped edges but lose all their vertical "height" lines. LineLayer
 * draws the segment straight between its two projected endpoints, verticals
 * included.
 */
export interface IconSegment {
  source: [number, number, number]
  target: [number, number, number]
  color: [number, number, number, number]
}

const M_PER_DEG_LAT = 110540

/**
 * Expand placements into LineLayer segments: each local edge is scaled to meters
 * and its ground offsets converted to degrees at the anchor's latitude, so the
 * icon stands upright on the map at the right size.
 */
export function sectorIconSegments(placements: SectorIconPlacement[], alpha = 235): IconSegment[] {
  const out: IconSegment[] = []
  for (const { position, mesh, color, scale } of placements) {
    const [lon, lat] = position
    const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180) || 111320
    const rgba: [number, number, number, number] = [color[0], color[1], color[2], alpha]
    const project = ([x, y, z]: [number, number, number]): [number, number, number] => [
      lon + (x * scale) / mPerDegLon,
      lat + (y * scale) / M_PER_DEG_LAT,
      z * scale,
    ]
    for (const [a, b] of ARCHETYPES[mesh]) {
      out.push({ source: project(a), target: project(b), color: rgba })
    }
  }
  return out
}
