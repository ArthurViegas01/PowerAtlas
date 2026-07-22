import type { StyleSpecification } from 'maplibre-gl'

/**
 * Minimal TRANSPARENT base style. The map is intentionally empty — every
 * visible element (boundaries, columns, heatmap) is a deck.gl layer, so the
 * HUD owns the whole look. No background layer on purpose: the canvas stays
 * transparent, letting the scan band (ScanBand.vue, rendered behind the map)
 * show through the void while the opaque land fills occlude it.
 */
export const baseMapStyle: StyleSpecification = {
  version: 8,
  name: 'poweratlas-void',
  sources: {},
  layers: [],
}
