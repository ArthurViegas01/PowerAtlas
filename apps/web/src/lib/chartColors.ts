import { tokenColor } from '@/lib/palette'

/**
 * Chart colors. Solid series colors come straight from CSS `var(--pa-*)` in
 * the component styles; this module only handles the data-driven ramp the
 * correlation heatmap needs, interpolated in JS from the same tokens (via
 * palette.tokenColor) so it cannot drift from the stylesheet.
 */

/**
 * Diverging color for a correlation value in [-1, 1]: cyan for positive, amber
 * for negative, fading to near-transparent at zero. Returns an rgba() string.
 */
export function correlationColor(r: number): string {
  const t = Math.max(-1, Math.min(1, r))
  const base = t >= 0 ? tokenColor('--pa-series-official', 255, [61, 225, 255, 255]) : tokenColor('--pa-series-hidden', 255, [255, 179, 71, 255])
  const alpha = 0.1 + 0.82 * Math.abs(t)
  return `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alpha.toFixed(3)})`
}
