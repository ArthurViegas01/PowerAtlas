import type { StyleSpecification } from 'maplibre-gl'

/**
 * Minimal void-dark base style. The map is intentionally empty — every
 * visible element (boundaries, columns, arcs, heatmap) is a deck.gl layer,
 * so the HUD owns the whole look.
 */
export const baseMapStyle: StyleSpecification = {
  version: 8,
  name: 'poweratlas-void',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#030608' },
    },
  ],
}
