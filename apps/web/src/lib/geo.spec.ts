import { describe, expect, it } from 'vitest'

import { featureBounds } from '@/lib/geo'
import type { BoundaryFeature } from '@/lib/geo'

function multiPolygon(polygons: [number, number][][][]): BoundaryFeature {
  return {
    type: 'Feature',
    properties: { codarea: '32', UF: 'ES', name: 'Espírito Santo' },
    geometry: { type: 'MultiPolygon', coordinates: polygons },
  } as BoundaryFeature
}

/** A closed square ring centered at (lon, lat). */
function square(lon: number, lat: number, half: number): [number, number][][] {
  return [
    [
      [lon - half, lat - half],
      [lon + half, lat - half],
      [lon + half, lat + half],
      [lon - half, lat + half],
      [lon - half, lat - half],
    ],
  ]
}

describe('featureBounds', () => {
  it('frames a plain polygon by its full extent', () => {
    const feature = multiPolygon([square(-40, -20, 2)])
    expect(featureBounds(feature)).toEqual([
      [-42, -22],
      [-38, -18],
    ])
  })

  it('ignores oceanic specks far from the mainland (Trindade case)', () => {
    // Mainland at -40 plus a tiny island ~11 degrees offshore.
    const feature = multiPolygon([square(-40, -20, 2), square(-29, -20.5, 0.05)])
    expect(featureBounds(feature)).toEqual([
      [-42, -22],
      [-38, -18],
    ])
  })

  it('keeps coastal islands near the mainland (Florianópolis case)', () => {
    const feature = multiPolygon([square(-49, -27, 2), square(-46.7, -27, 0.2)])
    const [[, ,], [east]] = featureBounds(feature)
    expect(east).toBeCloseTo(-46.5)
  })
})
