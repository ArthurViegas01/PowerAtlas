import type { RGBA } from '@/lib/palette'

/**
 * Categorical palette for the exploded sector arrows (and the matching panel
 * swatches), tuned to read on the dark void. Sectors are drawn in the order
 * they appear in a partner's list (largest flow first), so the same index maps
 * to the same color on the map and in the panel. The "Outros" bucket ('ZZ')
 * always takes the muted slate at the end, never a vivid hue.
 */
const SECTOR_RGB: [number, number, number][] = [
  [61, 225, 255], // cyan
  [255, 179, 71], // amber
  [130, 220, 120], // green
  [183, 139, 250], // violet
  [255, 110, 130], // rose
  [120, 170, 255], // blue
  [255, 215, 90], // gold
  [90, 220, 200], // teal
  [240, 140, 90], // orange
  [200, 160, 255], // lilac
  [150, 230, 80], // lime
  [255, 150, 200], // pink
]
const OUTROS_RGB: [number, number, number] = [150, 170, 185] // slate

function rgbFor(index: number, code: string): [number, number, number] {
  if (code === 'ZZ') return OUTROS_RGB
  return SECTOR_RGB[index % SECTOR_RGB.length]
}

/** Sector color as a deck.gl RGBA at `alpha`. */
export function sectorColor(index: number, code: string, alpha = 255): RGBA {
  const [r, g, b] = rgbFor(index, code)
  return [r, g, b, alpha]
}

/** Sector color as a CSS `rgb(...)` string for the panel swatches. */
export function sectorCss(index: number, code: string): string {
  const [r, g, b] = rgbFor(index, code)
  return `rgb(${r}, ${g}, ${b})`
}
