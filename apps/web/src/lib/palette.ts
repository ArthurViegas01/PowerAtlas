/**
 * Runtime bridge between the CSS design tokens (styles/tokens.css) and
 * deck.gl, which needs RGBA arrays. Base colors are read once from the
 * computed style of <html> and cached, so WebGL colors can never drift from
 * the stylesheet. Fallbacks mirror tokens.css for non-browser contexts.
 */

export type RGBA = [number, number, number, number]

const cache = new Map<string, RGBA>()

function parseHex(raw: string): RGBA | null {
  if (!raw.startsWith('#')) return null
  let hex = raw.slice(1)
  if (hex.length === 3)
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  if (hex.length !== 6) return null
  const value = Number.parseInt(hex, 16)
  if (Number.isNaN(value)) return null
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255]
}

function readToken(varName: string, fallback: RGBA): RGBA {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return parseHex(raw) ?? fallback
}

export function tokenColor(varName: string, alpha: number, fallback: RGBA): RGBA {
  let base = cache.get(varName)
  if (!base) {
    base = readToken(varName, fallback)
    cache.set(varName, base)
  }
  return [base[0], base[1], base[2], alpha]
}

export const paColor = {
  official: (alpha = 255): RGBA => tokenColor('--pa-series-official', alpha, [61, 225, 255, 255]),
  hidden: (alpha = 255): RGBA => tokenColor('--pa-series-hidden', alpha, [255, 179, 71, 255]),
  faint: (alpha = 255): RGBA => tokenColor('--pa-text-faint', alpha, [61, 88, 101, 255]),
  void: (): RGBA => tokenColor('--pa-bg-void', 255, [3, 6, 8, 255]),
  demoPop: (alpha = 255): RGBA => tokenColor('--pa-demo-pop', alpha, [59, 130, 246, 255]),
  demoGdp: (alpha = 255): RGBA => tokenColor('--pa-demo-gdp', alpha, [34, 139, 34, 255]),
}

/** Alpha-composite `fg` over an opaque `bg` (opaque result). */
export function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3] / 255
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
    255,
  ]
}

/**
 * Composite over the void background. Looks identical to drawing the
 * translucent color on the flat void, but the pixel becomes OPAQUE — which
 * is what lets the land fills occlude the scan band running behind the
 * (transparent) map canvases.
 */
export function overVoid(fg: RGBA): RGBA {
  return over(fg, paColor.void())
}

/** Scale a color toward black, keeping a given alpha — used for ramps. */
export function shade(color: RGBA, factor: number, alpha: number): RGBA {
  return [
    Math.round(color[0] * factor),
    Math.round(color[1] * factor),
    Math.round(color[2] * factor),
    alpha,
  ]
}
