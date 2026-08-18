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

export type MeshKey =
  | 'silo'
  | 'factory'
  | 'towers'
  | 'civic'
  | 'mine'
  | 'tank'
  | 'soy'
  | 'cattle'
  | 'coffee'
  | 'tree'

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
  // Soja: a crop row — three plants, each a stem with two leaf whorls and a
  // pod cluster low on the stalk.
  soy: [-0.3, 0.0, 0.3].flatMap((cx, i): Edge[] => {
    const h = [0.56, 0.46, 0.52][i]
    const cy = [0.06, -0.08, 0.02][i]
    const edges: Edge[] = [pillar(cx, cy, 0, h)]
    for (const [tier, z] of [[0, h * 0.5], [1, h * 0.82]] as const) {
      for (let k = 0; k < 3; k++) {
        const a = ((k + tier * 0.5) / 3) * Math.PI * 2
        const tip: [number, number, number] = [
          cx + Math.cos(a) * 0.13,
          cy + Math.sin(a) * 0.13,
          z + 0.05,
        ]
        edges.push([[cx, cy, z], tip])
        // A short leaf midrib past the tip keeps the whorl readable.
        edges.push([tip, [tip[0] + Math.cos(a) * 0.04, tip[1] + Math.sin(a) * 0.04, z + 0.03]])
      }
    }
    // Pod cluster: a small ringed pouch low on the stem.
    edges.push(
      ...stack(4, cx + 0.045, cy, [
        [0.028, h * 0.22],
        [0.028, h * 0.34],
      ]),
    )
    return edges
  }),
  // Pecuária: a low-poly zebu — body, legs, head with horns and the hump.
  cattle: [
    // Body slab on four legs.
    ...box(0, 0, 0.26, 0.12, 0.26, 0.5),
    pillar(-0.2, 0.09, 0, 0.26),
    pillar(-0.2, -0.09, 0, 0.26),
    pillar(0.18, 0.09, 0, 0.26),
    pillar(0.18, -0.09, 0, 0.26),
    // Head and muzzle, forward of the body.
    ...box(0.34, 0, 0.08, 0.07, 0.36, 0.56),
    ...box(0.45, 0, 0.035, 0.045, 0.34, 0.44),
    // Horns sweeping up and out from the head top.
    [
      [0.3, 0.07, 0.56],
      [0.26, 0.16, 0.66],
    ],
    [
      [0.3, -0.07, 0.56],
      [0.26, -0.16, 0.66],
    ],
    // The zebu hump over the shoulders.
    ...stack(6, 0.1, 0, [
      [0.07, 0.5],
      [0.055, 0.58],
      [0, 0.63],
    ]),
    // Tail down the back.
    [
      [-0.26, 0, 0.48],
      [-0.31, 0, 0.24],
    ],
  ],
  // Café: two bushy shrubs — bulged canopies over short trunks, with berry
  // rings dotted on the larger crown.
  coffee: [
    pillar(-0.1, 0.02, 0, 0.16),
    ...stack(8, -0.1, 0.02, [
      [0.15, 0.16],
      [0.2, 0.3],
      [0.17, 0.44],
      [0.09, 0.54],
      [0, 0.58],
    ]),
    // Berry clusters on the crown.
    ...stack(3, -0.26, 0.06, [
      [0.02, 0.3],
      [0.02, 0.34],
    ]),
    ...stack(3, 0.05, -0.1, [
      [0.02, 0.36],
      [0.02, 0.4],
    ]),
    // Smaller companion bush.
    pillar(0.26, -0.04, 0, 0.1),
    ...stack(8, 0.26, -0.04, [
      [0.1, 0.1],
      [0.13, 0.2],
      [0.1, 0.3],
      [0, 0.36],
    ]),
  ],
  // Floresta (Amazônia Legal): a samaúma — buttressed trunk under a broad,
  // flat emergent crown.
  tree: [
    // Columnar bole (true verticals), tapering only at the crown joint.
    ...stack(6, 0, 0, [
      [0.045, 0],
      [0.045, 0.5],
      [0.04, 0.55],
    ]),
    // Buttress roots flaring from the trunk base.
    [
      [0.04, 0, 0.16],
      [0.16, 0.03, 0],
    ],
    [
      [-0.04, 0.02, 0.16],
      [-0.15, 0.09, 0],
    ],
    [
      [0.0, -0.045, 0.16],
      [0.05, -0.17, 0],
    ],
    [
      [-0.02, -0.03, 0.16],
      [-0.13, -0.1, 0],
    ],
    // Broad umbrella crown.
    ...stack(10, 0, 0, [
      [0.3, 0.55],
      [0.34, 0.63],
      [0.25, 0.72],
      [0.12, 0.78],
      [0, 0.81],
    ]),
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
  soy: [190, 232, 90], // yellow-green (lavoura de soja)
  cattle: [235, 190, 140], // tan (rebanho)
  coffee: [225, 105, 85], // cherry (café)
  tree: [60, 210, 150], // emerald (floresta)
}

// ── sector -> archetype maps ────────────────────────────────────────────────

// HS chapters that read as agropecuária (grain, meat, coffee, sugar, cotton...).
const AGRO_CHAPTERS = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '12', '14', '15', '17', '18', '20', '21', '22', '23', '24', '52',
])
const MINE_CHAPTERS = new Set(['25', '26'])
const OIL_CHAPTERS = new Set(['27'])

/** Icon for a state's dominant export sector (HS chapter). Commodity chapters
 *  with an icon of their own come first; the broad sets catch the rest. */
export function iconForChapter(chapter: string): MeshKey {
  if (chapter === '12') return 'soy' // oleaginosas (soja em grão)
  if (chapter === '09') return 'coffee' // café
  if (chapter === '02') return 'cattle' // carnes
  if (chapter === '44') return 'tree' // madeira
  if (AGRO_CHAPTERS.has(chapter)) return 'silo'
  if (MINE_CHAPTERS.has(chapter)) return 'mine'
  if (OIL_CHAPTERS.has(chapter)) return 'tank'
  return 'factory'
}

/**
 * Fine agro commodity of a município (PAM/PPM): each figure is normalized by
 * its own NATIONAL total (mil R$ vs cabeças become comparable shares); the
 * biggest share wins if it clears the floor, else null (generic silo).
 */
export const AGRO_SHARE_FLOOR = 0.0005 // 0.05% of the national commodity

export function pickAgroCommodity(
  agro: { soja: number; cafe: number; bovino: number } | undefined,
  national: { soja: number; cafe: number; bovino: number },
): MeshKey | null {
  if (!agro) return null
  const shares: [MeshKey, number][] = [
    ['soy', national.soja > 0 ? agro.soja / national.soja : 0],
    ['coffee', national.cafe > 0 ? agro.cafe / national.cafe : 0],
    ['cattle', national.bovino > 0 ? agro.bovino / national.bovino : 0],
  ]
  shares.sort((a, b) => b[1] - a[1])
  return shares[0][1] >= AGRO_SHARE_FLOOR ? shares[0][0] : null
}

/** UFs fully inside the Amazônia Legal; MA joins west of the 44°W meridian. */
const AMAZONIA_UF_PREFIX = new Set(['11', '12', '13', '14', '15', '16', '17', '51'])

export function isAmazoniaLegal(codigo: string, lon: number): boolean {
  const prefix = codigo.slice(0, 2)
  if (AMAZONIA_UF_PREFIX.has(prefix)) return true
  return prefix === '21' && lon < -44
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
