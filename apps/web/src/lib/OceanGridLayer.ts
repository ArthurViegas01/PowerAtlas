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
// The latitude range runs to ±88 (past Mercator's usual ±85 cutoff) so the sea
// keeps going above/below the northernmost/southernmost land toward the top and
// bottom of a tilted frame, well past where the minZoom floor lets the camera
// see. Tessellation is dense enough that the Mercator-meters varying
// interpolates across each cell with negligible error.
const GRID_BOUNDS = { minLon: -260, maxLon: 260, minLat: -88, maxLat: 88 }
const GRID_LAT_CLAMP = 88
const NX = 360
const NY = 260
// Sea-plane elevation (m): just below ground so land at z=0 occludes the grid.
const GRID_Z = -200
// Zoom at which the base cell size applies; higher zoom subdivides from here.
const ZOOM_REF = 3.7
// Mercator span (m) divided by the cell count to get the base cell size, so a
// `gridSize` of ~10 yields ~10 major cells across the world at ZOOM_REF.
const WORLD_SPAN_M = 20_000_000
const MAX_RIPPLES = 16

// ── Ripple drop ───────────────────────────────────────────────────────────
// A raindrop landing on the sea: several CONCENTRIC rings spreading slowly
// outward, brightest at the leading front and dimming toward the calm center,
// then fading out. Radii are in view-radius units (1 = half the screen width),
// so the rings keep the same on-screen size at any zoom.
const RIPPLE_MAX_R = 0.12 // radius the outermost ring reaches before fading
const RIPPLE_RING_SPACING = 0.024 // radial gap between concentric rings
const RIPPLE_DECAY = 0.07 // how fast inner rings dim toward the center
const RIPPLE_LIFE_S = 3.0 // seconds from drop to fully faded (matches MapView)

// ── Scan sweep ──────────────────────────────────────────────────────────────
// A screen-space band that travels top→bottom over the sea, brightening the
// grid seams as it passes — the OceanGrid twin of the HUD's ScanBand.vue. The
// phase is derived from `time` (loop units) so it shares the map's clock and
// freezes with it under reduced motion (`time` held at 0). The band runs from
// -0.15 to 1.15 of the screen height, so there is an off-screen pause between
// passes just like the CSS band's -20vh→115vh travel.
const SCAN_PERIOD_UNITS = 9000 / 4200 // ≈ 9s, matching ScanBand's 9s sweep
const SCAN_HALF_WIDTH = 0.05 // gaussian half-width, fraction of screen height
const SCAN_SEAM_BOOST = 1.15 // how hard the band lights the grid seams
const SCAN_FILL = 0.08 // faint wash so the band reads over open cells
const SCAN_TINT = 0.9 // how far seams shift toward the cyan scan color
// Cyan of the HUD scan (--pa-series-official), so the sweep matches ScanBand.
const SCAN_COLOR: [number, number, number] = [61, 225, 255]

const R_EARTH = 6378137
const D2R = Math.PI / 180

/** Web-Mercator meters for a lng/lat (matches the vertex shader's formula). */
function mercMeters(lng: number, lat: number): [number, number] {
  const clamped = Math.max(-GRID_LAT_CLAMP, Math.min(GRID_LAT_CLAMP, lat))
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
  float scanPos;
  float scanWidth;
  float scanBoost;
  float scanFill;
  float scanTint;
  float screenH;
  vec3 color;
  vec3 scanColor;
  vec2 center;
  vec2 mouse;
  vec4 ripple0;
  vec4 ripple1;
  vec4 ripple2;
  vec4 ripple3;
  vec4 ripple4;
  vec4 ripple5;
  vec4 ripple6;
  vec4 ripple7;
  vec4 ripple8;
  vec4 ripple9;
  vec4 ripple10;
  vec4 ripple11;
  vec4 ripple12;
  vec4 ripple13;
  vec4 ripple14;
  vec4 ripple15;
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
  scanPos: number
  scanWidth: number
  scanBoost: number
  scanFill: number
  scanTint: number
  screenH: number
  color: [number, number, number]
  scanColor: [number, number, number]
  center: [number, number]
  mouse: [number, number]
  ripple0: [number, number, number, number]
  ripple1: [number, number, number, number]
  ripple2: [number, number, number, number]
  ripple3: [number, number, number, number]
  ripple4: [number, number, number, number]
  ripple5: [number, number, number, number]
  ripple6: [number, number, number, number]
  ripple7: [number, number, number, number]
  ripple8: [number, number, number, number]
  ripple9: [number, number, number, number]
  ripple10: [number, number, number, number]
  ripple11: [number, number, number, number]
  ripple12: [number, number, number, number]
  ripple13: [number, number, number, number]
  ripple14: [number, number, number, number]
  ripple15: [number, number, number, number]
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
    scanPos: 'f32',
    scanWidth: 'f32',
    scanBoost: 'f32',
    scanFill: 'f32',
    scanTint: 'f32',
    screenH: 'f32',
    color: 'vec3<f32>',
    scanColor: 'vec3<f32>',
    center: 'vec2<f32>',
    mouse: 'vec2<f32>',
    ripple0: 'vec4<f32>',
    ripple1: 'vec4<f32>',
    ripple2: 'vec4<f32>',
    ripple3: 'vec4<f32>',
    ripple4: 'vec4<f32>',
    ripple5: 'vec4<f32>',
    ripple6: 'vec4<f32>',
    ripple7: 'vec4<f32>',
    ripple8: 'vec4<f32>',
    ripple9: 'vec4<f32>',
    ripple10: 'vec4<f32>',
    ripple11: 'vec4<f32>',
    ripple12: 'vec4<f32>',
    ripple13: 'vec4<f32>',
    ripple14: 'vec4<f32>',
    ripple15: 'vec4<f32>',
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
  float lat = clamp(positions.y, -${GRID_LAT_CLAMP.toFixed(1)}, ${GRID_LAT_CLAMP.toFixed(1)});
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

  // Still water: the grid stays a SQUARE lattice, no global swell. ALL motion
  // comes from the ripple "drops" below, which both DISTORT the squares (warp)
  // and softly light the seams they cross (shine), like raindrops on the sea.
  vec2 warp = vMerc;
  float shine = 0.0;

  // Drops: several CONCENTRIC rings spreading slowly out from each drop point,
  // brightest at the leading front and dimming toward the calm center, then
  // fading. Each ring both bends the lattice radially and lights it, so the drop
  // reads like the real thing (many rings, soft), not one hard band.
  vec4 rs[16] = vec4[16](
    oceanGrid.ripple0, oceanGrid.ripple1, oceanGrid.ripple2, oceanGrid.ripple3,
    oceanGrid.ripple4, oceanGrid.ripple5, oceanGrid.ripple6, oceanGrid.ripple7,
    oceanGrid.ripple8, oceanGrid.ripple9, oceanGrid.ripple10, oceanGrid.ripple11,
    oceanGrid.ripple12, oceanGrid.ripple13, oceanGrid.ripple14, oceanGrid.ripple15);
  // Continuous (no floor) so the ring warp scales smoothly with zoom.
  float cellPreview = oceanGrid.baseCell / exp2(oceanGrid.zoom - ZOOM_REF);
  for (int i = 0; i < 16; i++) {
    vec4 r = rs[i];
    if (r.w < 0.5) continue;
    vec2 dr = vMerc - r.xy;
    float d = length(dr) / oceanGrid.viewRadius;
    float t01 = clamp(r.z / ${RIPPLE_LIFE_S.toFixed(2)}, 0.0, 1.0);
    // Ease-out temporal fade so the drop settles gently instead of snapping off.
    float fade = (1.0 - t01) * (1.0 - t01);
    float front = ${RIPPLE_MAX_R.toFixed(3)} * t01;      // leading ring radius
    // Concentric rings: a radial cosine that only exists inside the expanding
    // front and dims toward the center, so rings propagate outward over time.
    float inside = 1.0 - smoothstep(front, front + ${RIPPLE_RING_SPACING.toFixed(3)}, d);
    float toward = exp(-max(front - d, 0.0) / ${RIPPLE_DECAY.toFixed(3)});
    float rings = cos((front - d) / ${RIPPLE_RING_SPACING.toFixed(3)} * 6.2831853);
    float amp = rings * inside * toward * fade;
    // Radial push (outward from the drop) bends the lattice into clean rings;
    // |amp| glows along both the crests and troughs for the soft ripple sheen.
    vec2 dir = dr / max(length(dr), 1e-3);
    warp += dir * amp * cellPreview * oceanGrid.rippleIntensity * 4.5;
    shine += abs(amp);
  }

  // ── Zoom subdivision: seamless octave cross-fade ─────────────────────────
  // The coarse lattice is exactly a subset of the finer one (every other line),
  // so as the camera zooms into an octave (f: 0→1) only the NEW intermediate
  // lines fade in, and the coarse lines never pop out. At the octave boundary the
  // fine lines become the next coarse lines at identical intensity, so nothing
  // blinks when a subdivision level appears or disappears.
  float level = oceanGrid.zoom - ZOOM_REF;
  float f = fract(level);
  float cellCoarse = oceanGrid.baseCell / exp2(floor(level));
  float cellFine = cellCoarse * 0.5;
  float gCoarse = gridAt(warp / cellCoarse, oceanGrid.lineWidth);
  float gFine = gridAt(warp / cellFine, oceanGrid.lineWidth);
  // Lines in the fine grid but NOT the coarse one = the intermediate
  // subdivisions; only those fade in with f, so the transition is continuous.
  float intermediate = max(gFine - gCoarse, 0.0);
  float seams = max(gCoarse, intermediate * smoothstep(0.0, 1.0, f));

  // Relief: a TIGHT glow hugging the seams (light through the cracks) that
  // falls off to dark tile centers, so the cells read as raised panels instead
  // of solid glowing blocks. Cross-faded across the octave the same way as the
  // seams so the tile lighting doesn't pop at a zoom boundary either.
  float halo = mix(glowField(warp / cellCoarse, 0.08), glowField(warp / cellFine, 0.08), f);
  float backlight = 1.0 - smoothstep(0.0, oceanGrid.fadeDistance, dist);

  // Square lattice lit by: the seams, the soft tile relief, and the ripple
  // rings (shine) glowing softly along the seams they cross, so drops read with
  // a gentle sheen rather than bare bent lines.
  float lit = clamp(
      seams * 0.8
    + halo * oceanGrid.glow * (0.2 + 0.6 * backlight)
    + shine * seams * 0.9
    + shine * 0.18,
    0.0, 1.0);

  // ── Scan sweep: a screen-space band gliding top→bottom over the sea ───────
  // gl_FragCoord is bottom-origin, so distance-from-top = 1 - y/height. The
  // band lights the seams it crosses and washes a faint fill over open cells,
  // then the seams under it shift toward the cyan scan color. scanPos < -0.5
  // means the sweep is disabled (reduced motion holds the clock, and thus the
  // phase, at a sentinel).
  float scanMix = 0.0;
  if (oceanGrid.scanPos > -0.5) {
    float fromTop = 1.0 - gl_FragCoord.y / max(oceanGrid.screenH, 1.0);
    float sd = (fromTop - oceanGrid.scanPos) / max(oceanGrid.scanWidth, 1e-3);
    float band = exp(-sd * sd);
    lit = clamp(lit + seams * band * oceanGrid.scanBoost + band * oceanGrid.scanFill, 0.0, 1.0);
    scanMix = clamp(seams * band * oceanGrid.scanTint, 0.0, 1.0);
  }

  float vig = 1.0 - smoothstep(oceanGrid.fadeDistance * 0.5, oceanGrid.fadeDistance, dist);
  vig = mix(1.0, vig, oceanGrid.vignette);

  float alpha = lit * vig * oceanGrid.opacity;
  if (alpha < 0.003) discard;
  vec3 col = mix(oceanGrid.color, oceanGrid.scanColor, scanMix);
  fragColor = vec4(col, alpha);
}
`

export type OceanGridLayerProps = {
  /** Continuous animation clock (loop units), same source as the flow stripes. */
  time?: number
  /** Approx major cells across the world at ZOOM_REF (bigger = denser). */
  gridSizeDeg?: number
  /** Active ripple drops in lng/lat (up to MAX_RIPPLES used). */
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
  // Denser base lattice → smaller squares, so the zoomed-out sea reads as many
  // fine cells instead of a few big ones. The zoom cross-fade keeps subdividing
  // from here as the camera closes in.
  gridSizeDeg: 88,
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
    const zero: [number, number, number, number] = [0, 0, 0, 0]
    const slots: [number, number, number, number][] = Array.from(
      { length: MAX_RIPPLES },
      () => [...zero] as [number, number, number, number],
    )
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

    // Scan phase: `time` (loop units) folded into a 0..1 sweep, then remapped
    // to -0.15..1.15 so the band pauses off-screen between passes. When `time`
    // is 0 (reduced motion holds the clock), the sweep is disabled (-1).
    const t = time ?? 0
    const scanFrac = (((t / SCAN_PERIOD_UNITS) % 1) + 1) % 1 // 0..1, always positive
    const scanPos = t > 0 ? -0.15 + 1.3 * scanFrac : -1
    // Framebuffer height (device px) to normalize gl_FragCoord.y; fall back to
    // CSS height × dpr when the raw GL context is not reachable.
    const glCtx = (this.context.device as { gl?: WebGL2RenderingContext }).gl
    const screenH =
      glCtx?.drawingBufferHeight ??
      height * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

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
      // Reach the grid further toward the top/bottom of a tilted frame before it
      // vignettes out, and soften that falloff, so the sea fills the extended
      // mesh instead of dying into a black band at the edges.
      fadeDistance: 2.2,
      vignette: 0.3,
      opacity: opacity ?? 0.55,
      // Mouse distortion is off for now (kept plumbed for a later re-enable).
      mouseActive: 0,
      mouseRadius: 0.32,
      mouseStrength: 0,
      scanPos,
      scanWidth: SCAN_HALF_WIDTH,
      scanBoost: SCAN_SEAM_BOOST,
      scanFill: SCAN_FILL,
      scanTint: SCAN_TINT,
      screenH,
      color: [(color?.[0] ?? 61) / 255, (color?.[1] ?? 225) / 255, (color?.[2] ?? 255) / 255],
      scanColor: [SCAN_COLOR[0] / 255, SCAN_COLOR[1] / 255, SCAN_COLOR[2] / 255],
      center,
      mouse: mouseMerc,
      ripple0: slots[0],
      ripple1: slots[1],
      ripple2: slots[2],
      ripple3: slots[3],
      ripple4: slots[4],
      ripple5: slots[5],
      ripple6: slots[6],
      ripple7: slots[7],
      ripple8: slots[8],
      ripple9: slots[9],
      ripple10: slots[10],
      ripple11: slots[11],
      ripple12: slots[12],
      ripple13: slots[13],
      ripple14: slots[14],
      ripple15: slots[15],
    }
    const { model } = this.state
    model.shaderInputs.setProps({ oceanGrid: uniforms })
    model.draw(this.context.renderPass)
  }
}
