import { Layer, project32, type DefaultProps, type LayerProps } from '@deck.gl/core'
import { Geometry, Model } from '@luma.gl/engine'

/**
 * Animated holographic grid over the ocean, inspired by React Bits'
 * "Ripple Grid" (https://reactbits.dev/backgrounds/ripple-grid) but rebuilt to
 * live ON the sea, not on the screen.
 *
 * It draws a tessellated quad on the sea plane (a shallow negative elevation) in
 * lng/lat space, so it is projected through the same tilted camera as the land
 * and stays glued to the ocean. Drawn FIRST in the layer stack, the opaque land
 * fills (overVoid) paint over it and crop it to open sea for free.
 *
 * The grid pattern is computed in WEB-MERCATOR METERS, so the cells are square
 * across the whole map (no lng/lat rectangles), anchored to the ground (they do
 * not swim when panning), and subdivide into finer and finer cells as the
 * camera zooms in (scale-invariant octaves keyed to `viewport.zoom`). A radial
 * ripple warp fakes the reference's 3D barrel volume, and three ripple sources
 * feed it: a continuous ambient wave from the view center, a bulge that rides
 * the mouse, and up to four transient click fronts.
 */

// Rectangle the mesh spans. Deliberately spills WELL PAST the world (±180 lon,
// ±85 lat) so that on a zoomed-out, tilted view the sea grid still fills the
// foreground and sides instead of ending in a black void. There is no land out
// there to mask it, so the ocean simply reads as continuing past the map edge.
// Tessellation is dense enough that the Mercator-meters varying interpolates
// across each cell with negligible error.
const GRID_BOUNDS = { minLon: -260, maxLon: 260, minLat: -85, maxLat: 85 }
const NX = 360
const NY = 220
// Sea-plane elevation (m): just below ground so land at z=0 occludes the grid.
const GRID_Z = -200
// Zoom at which the base cell size applies; higher zoom subdivides from here.
const ZOOM_REF = 3.7
// Mercator span (m) divided by the cell count to get the base cell size, so a
// `gridSize` of ~10 yields ~10 major cells across the world at ZOOM_REF.
const WORLD_SPAN_M = 20_000_000
const MAX_RIPPLES = 4

const R_EARTH = 6378137
const D2R = Math.PI / 180

/** Web-Mercator meters for a lng/lat (matches the vertex shader's formula). */
function mercMeters(lng: number, lat: number): [number, number] {
  const clamped = Math.max(-85, Math.min(85, lat))
  return [lng * D2R * R_EARTH, Math.log(Math.tan(Math.PI / 4 + (clamped * D2R) / 2)) * R_EARTH]
}

/** One active click ripple: where it started (lng/lat) and its age (seconds). */
export interface OceanRipple {
  epicenter: [number, number]
  elapsed: number
}

const uniformBlock = /* glsl */ `\
layout(std140) uniform oceanGridUniforms {
  float time;
  float zoom;
  float viewRadius;
  float baseCell;
  float lineWidth;
  float rippleIntensity;
  float rippleSpeed;
  float ambientFreq;
  float glow;
  float fadeDistance;
  float vignette;
  float opacity;
  float mouseActive;
  float mouseRadius;
  float mouseStrength;
  vec3 color;
  vec2 center;
  vec2 mouse;
  vec4 ripple0;
  vec4 ripple1;
  vec4 ripple2;
  vec4 ripple3;
} oceanGrid;
`

type OceanGridUniforms = {
  time: number
  zoom: number
  viewRadius: number
  baseCell: number
  lineWidth: number
  rippleIntensity: number
  rippleSpeed: number
  ambientFreq: number
  glow: number
  fadeDistance: number
  vignette: number
  opacity: number
  mouseActive: number
  mouseRadius: number
  mouseStrength: number
  color: [number, number, number]
  center: [number, number]
  mouse: [number, number]
  ripple0: [number, number, number, number]
  ripple1: [number, number, number, number]
  ripple2: [number, number, number, number]
  ripple3: [number, number, number, number]
}

const oceanGridUniforms = {
  name: 'oceanGrid',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    time: 'f32',
    zoom: 'f32',
    viewRadius: 'f32',
    baseCell: 'f32',
    lineWidth: 'f32',
    rippleIntensity: 'f32',
    rippleSpeed: 'f32',
    ambientFreq: 'f32',
    glow: 'f32',
    fadeDistance: 'f32',
    vignette: 'f32',
    opacity: 'f32',
    mouseActive: 'f32',
    mouseRadius: 'f32',
    mouseStrength: 'f32',
    color: 'vec3<f32>',
    center: 'vec2<f32>',
    mouse: 'vec2<f32>',
    ripple0: 'vec4<f32>',
    ripple1: 'vec4<f32>',
    ripple2: 'vec4<f32>',
    ripple3: 'vec4<f32>',
  },
} as const

const vs = /* glsl */ `\
#version 300 es
#define SHADER_NAME ocean-grid-vertex-shader
in vec3 positions;
out vec2 vMerc;
// Prefixed to avoid clashing with PI/other constants the deck.gl project module
// already defines in the assembled shader.
const float OG_R = 6378137.0;
const float OG_PI = 3.141592653589793;
void main(void) {
  float lng = positions.x;
  float lat = clamp(positions.y, -85.0, 85.0);
  vMerc = vec2(radians(lng) * OG_R, log(tan(OG_PI / 4.0 + radians(lat) / 2.0)) * OG_R);
  gl_Position = project_position_to_clipspace(positions, vec3(0.0), vec3(0.0));
}
`

const fs = /* glsl */ `\
#version 300 es
#define SHADER_NAME ocean-grid-fragment-shader
#define ZOOM_REF ${ZOOM_REF.toFixed(1)}
precision highp float;
in vec2 vMerc;
out vec4 fragColor;

// Grid intensity for an already-scaled coordinate (lines on integer cells).
float gridAt(vec2 g, float width) {
  vec2 gf = fract(g);
  vec2 d = min(gf, 1.0 - gf);
  vec2 aa = d / max(fwidth(g), vec2(1e-5));
  return 1.0 - smoothstep(0.0, width, min(aa.x, aa.y));
}

// Soft light bleeding out of the seams into the tile faces: a light source
// behind the grid shining through the cracks, so the cells read as lit panels.
float glowField(vec2 g, float width) {
  vec2 gf = fract(g);
  vec2 d = min(gf, 1.0 - gf);
  return exp(-min(d.x, d.y) / max(width, 1e-4));
}

void main(void) {
  // Static, view-relative falloff for a soft edge vignette (not animated, so
  // nothing appears to "emanate" from the screen center).
  float dist = length((vMerc - oceanGrid.center) / oceanGrid.viewRadius);

  // ── Ocean swell: directional waves rolling across the whole sea ───────────
  // Built from ABSOLUTE world position (not the screen), so the motion reads as
  // water moving over the map rather than a ripple bursting from the center.
  // Wavelength tracks the cell size so the swell rides the grid.
  float ws = oceanGrid.baseCell;
  vec2 wp = vMerc / ws;
  float t = oceanGrid.time * oceanGrid.rippleSpeed;
  float wA = sin(wp.x * 1.3 + t);
  float wB = sin(wp.y * 1.1 - t * 0.8);
  float wC = sin((wp.x + wp.y) * 0.7 + t * 1.3);
  float wD = sin((wp.x - wp.y) * 0.9 - t * 0.6);
  float swell = (wA + wB + wC + wD) * 0.25;              // -1..1
  float crest = smoothstep(0.25, 1.0, swell);            // bright wave crests

  // Gentle undulation of the grid so the lines breathe like a water surface.
  vec2 warp = vMerc + vec2(wA + wC, wB - wD) * ws * oceanGrid.rippleIntensity * 0.5;
  float shine = crest * 0.5;

  // Click ripples: expanding wave fronts pinned to the clicked sea point.
  vec4 rs[4] = vec4[4](oceanGrid.ripple0, oceanGrid.ripple1, oceanGrid.ripple2, oceanGrid.ripple3);
  float cellPreview = oceanGrid.baseCell / exp2(floor(oceanGrid.zoom - ZOOM_REF));
  for (int i = 0; i < 4; i++) {
    vec4 r = rs[i];
    if (r.w < 0.5) continue;
    vec2 dr = vMerc - r.xy;
    float d = length(dr) / oceanGrid.viewRadius;
    float front = r.z * 0.6;
    float fade = max(0.0, 1.0 - r.z / 3.4);
    float bump = exp(-pow((d - front) / 0.1, 2.0)) * fade;
    warp += normalize(dr + 1.0) * bump * cellPreview * oceanGrid.rippleIntensity * 6.0;
    shine += bump;
  }

  // ── Zoom subdivision: scale-invariant octaves, finer lines always present ─
  float level = oceanGrid.zoom - ZOOM_REF;
  float scale = exp2(floor(level));
  float cellM = oceanGrid.baseCell / scale;
  float f = fract(level);
  float gA = gridAt(warp / cellM, oceanGrid.lineWidth);
  float gB = gridAt(warp / (cellM * 0.5), oceanGrid.lineWidth);
  float gI = gridAt(warp / (cellM * 0.25), oceanGrid.lineWidth * 0.9);
  // The finer octave never fully fades, so far-out cells stay subdivided.
  float seams = max(gA, max(gB * (0.35 + 0.65 * f), gI * 0.4));

  // Relief: a TIGHT glow hugging the seams (light through the cracks) that
  // falls off to dark tile centers, so the cells read as raised panels instead
  // of solid glowing blocks. One octave only — overlapping halos were what
  // flooded the cells. A gentle backlight lifts the tiles near the view center.
  float halo = glowField(warp / cellM, 0.08);
  float backlight = 1.0 - smoothstep(0.0, oceanGrid.fadeDistance, dist);
  float waveBright = swell * 0.5 + 0.5;

  // Wave crests brighten the seams as they pass, like light rippling on water.
  float lit = clamp(
      seams * (0.6 + 0.4 * waveBright)
    + halo * oceanGrid.glow * (0.2 + 0.6 * backlight)
    + shine * 0.3,
    0.0, 1.0);

  float vig = 1.0 - smoothstep(oceanGrid.fadeDistance * 0.5, oceanGrid.fadeDistance, dist);
  vig = mix(1.0, vig, oceanGrid.vignette);

  float alpha = lit * vig * oceanGrid.opacity;
  if (alpha < 0.003) discard;
  fragColor = vec4(oceanGrid.color, alpha);
}
`

export type OceanGridLayerProps = {
  /** Continuous animation clock (loop units), same source as the flow stripes. */
  time?: number
  /** Approx major cells across the world at ZOOM_REF (bigger = denser). */
  gridSizeDeg?: number
  /** Active click ripples in lng/lat (max 4 used). */
  ripples?: OceanRipple[]
  /** Cursor position as screen UV (0–1, y up); null when off the map. */
  mouse?: [number, number] | null
  /** Line color in 0–255 RGB. Defaults to the official cyan series color. */
  color?: [number, number, number]
  /** Master grid opacity. */
  opacity?: number
} & LayerProps

const defaultProps: DefaultProps<OceanGridLayerProps> = {
  time: 0,
  gridSizeDeg: 52,
  ripples: [],
  mouse: null,
  color: [46, 104, 240],
  opacity: 0.55,
}

function buildMesh(): { positions: Float32Array; indices: Uint32Array } {
  const { minLon, maxLon, minLat, maxLat } = GRID_BOUNDS
  const positions = new Float32Array(NX * NY * 3)
  let k = 0
  for (let j = 0; j < NY; j++) {
    const lat = minLat + ((maxLat - minLat) * j) / (NY - 1)
    for (let i = 0; i < NX; i++) {
      positions[k++] = minLon + ((maxLon - minLon) * i) / (NX - 1)
      positions[k++] = lat
      positions[k++] = GRID_Z
    }
  }
  const indices = new Uint32Array((NX - 1) * (NY - 1) * 6)
  let n = 0
  for (let j = 0; j < NY - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i
      const b = a + 1
      const c = a + NX
      const d = c + 1
      indices[n++] = a
      indices[n++] = b
      indices[n++] = c
      indices[n++] = b
      indices[n++] = d
      indices[n++] = c
    }
  }
  return { positions, indices }
}

export class OceanGridLayer extends Layer<OceanGridLayerProps> {
  static layerName = 'OceanGridLayer'
  static defaultProps = defaultProps

  declare state: { model: Model }

  getShaders() {
    return super.getShaders({ vs, fs, modules: [project32, oceanGridUniforms] })
  }

  initializeState() {
    const { positions, indices } = buildMesh()
    const model = new Model(this.context.device, {
      ...this.getShaders(),
      id: this.props.id,
      geometry: new Geometry({
        topology: 'triangle-list',
        attributes: { positions: { size: 3, value: positions } },
        indices: { size: 1, value: indices },
      }),
      vertexCount: indices.length,
      isInstanced: false,
      parameters: {
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
      },
    })
    this.setState({ model })
  }

  draw(): void {
    const { time, gridSizeDeg, ripples, mouse, color, opacity } = this.props
    const viewport = this.context.viewport
    const width = viewport.width || 1
    const height = viewport.height || 1
    const zoom = viewport.zoom ?? ZOOM_REF

    // View center in Mercator meters, and a view radius (meters) so the ripple
    // and vignette scale with the camera instead of the whole globe.
    const [centerLng, centerLat] = viewport.unproject([width / 2, height / 2]) as [number, number]
    const center = mercMeters(centerLng, centerLat)
    const metersPerPixel = (156543.03392 * Math.cos(centerLat * D2R)) / Math.pow(2, zoom)
    const viewRadius = Math.max(1000, metersPerPixel * width * 0.5)
    const baseCell = WORLD_SPAN_M / (gridSizeDeg ?? 10)

    // Ripples (lng/lat → Mercator meters); mouse (screen UV → unproject → merc).
    const slots: [number, number, number, number][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const list = ripples ?? []
    for (let i = 0; i < Math.min(list.length, MAX_RIPPLES); i++) {
      const [mx, my] = mercMeters(list[i].epicenter[0], list[i].epicenter[1])
      slots[i] = [mx, my, list[i].elapsed, 1]
    }
    let mouseMerc: [number, number] = [0, 0]
    if (mouse) {
      const px: [number, number] = [mouse[0] * width, (1 - mouse[1]) * height]
      const [mlng, mlat] = viewport.unproject(px) as [number, number]
      mouseMerc = mercMeters(mlng, mlat)
    }

    const uniforms: OceanGridUniforms = {
      time: time ?? 0,
      zoom,
      viewRadius,
      baseCell,
      lineWidth: 1.5,
      rippleIntensity: 0.08,
      rippleSpeed: 0.8,
      ambientFreq: 6,
      glow: 0.5,
      fadeDistance: 1.4,
      vignette: 0.5,
      opacity: opacity ?? 0.55,
      // Mouse distortion is off for now (kept plumbed for a later re-enable).
      mouseActive: 0,
      mouseRadius: 0.32,
      mouseStrength: 0,
      color: [(color?.[0] ?? 61) / 255, (color?.[1] ?? 225) / 255, (color?.[2] ?? 255) / 255],
      center,
      mouse: mouseMerc,
      ripple0: slots[0],
      ripple1: slots[1],
      ripple2: slots[2],
      ripple3: slots[3],
    }
    const { model } = this.state
    model.shaderInputs.setProps({ oceanGrid: uniforms })
    model.draw(this.context.renderPass)
  }
}
