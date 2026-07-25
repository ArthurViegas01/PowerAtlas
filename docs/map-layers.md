# Map layers and view modes

How the map is actually assembled, which layer draws what, and what the two
view modes change. Companion to ARCHITECTURE.md (decisions and rationale) and
docs/data-sources.md (where the data comes from).

## The render pipeline

```
mapLayers store  ->  MapLayerModel (plain data, no deck.gl types)
                          |
                          v
       buildDeckLayers()  ->  Layer[]  ->  MapboxOverlay  ->  MapLibre canvas
       (src/lib/deckLayers.ts)              (@deck.gl/mapbox, one camera)
```

`buildDeckLayers` is a **pure factory**: model in, layer instances out, no
store access and no side effects. That is what makes the layer stack testable
without a browser (`src/lib/deckLayers.spec.ts` asserts on the returned ids and
accessors). `MapView.vue` owns the MapLibre instance, the animation frames
(pulse, flow phase, ripple) and the picking callbacks, and simply re-runs the
factory.

Colors never come from literals: `src/lib/palette.ts` reads the `--pa-*`
custom properties with `getComputedStyle`, so WebGL layers cannot drift from
`src/styles/tokens.css`. Area fills are **precomposited over the void color**
(`over` / `overVoid`) so their pixels are opaque: that is what makes the scan
band, which renders behind the transparent map canvases, get occluded by land
instead of bleeding through it.

## Layer stack

Listed in draw order. Ids match the strings in `deckLayers.ts`.

| Layer id | Type | Draws |
| --- | --- | --- |
| `world-countries` | GeoJson | Natural Earth backdrop: dim fill, dashed borders, the "em breve" zone |
| `ambient-heatmap` | Heatmap | Simulated ambient activity, only while nothing is selected |
| `states-choropleth` | GeoJson | The 27 UFs, picking source for state clicks and hover |
| `national-outline` | GeoJson | Brazil's outer border (dissolved from the simplified states) |
| `municipios` | GeoJson | Municipal mesh of the selected state (loaded on demand) |
| `municipal-borders` | GeoJson | Faint context borders, all 27 meshes merged |
| `influence-arcs` | Arc | Capital-to-capital links, behind `INFLUENCE_ARCS_ENABLED` |
| `state-labels` | Text | UF siglas |
| `demografia-state-mesh` | Path | Cropped state's mesh raised into a platform, behind `STATE_LIFT_ENABLED` (off) |
| `demografia-columns` | Column | One hexagonal prism per município, height proportional to the square root of the metric |
| `demografia-outflow-segments` | Column | Fiscal outflow bands, stacked by tax |
| `demografia-inflow-segments` | Column | Fiscal return bands on the twin column, stacked by transfer |
| `fiscal-flow-rails` | Path | Faint continuous route of each flow arc |
| `fiscal-flow-stripes` | Path | Marching stripes; speed scales with the amount |
| `power-columns-official` / `power-columns-hidden` | Column | Score columns at the state capitals |
| `state-walls`, `national-wall` | SolidPolygon | Translucent relief walls along the borders |
| `state-wall-crests`, `national-wall-crest` | Path | Pulsing neon crest on top of each wall |

Layers are pushed conditionally: an absent id means the feature is off, not
that it failed. The walls are pushed **last** on purpose, so everything behind
them is already drawn and they blend over it instead of depth-clipping it.

## The two view modes

### Influence view (default)

State choropleth plus capital columns; clicking a state opens its ranking
panel and lazily loads that state's municipal mesh and indicators. Clicking a
município closes the camera on it and opens the light municipal panel. The
hidden dimension is locked (see feature flags below), so only the official
column renders and it centers on the capital.

### Demographic view (`VISÃO DEMOGRÁFICA [BR]`)

A separate, **read-only** mode: region selection is disabled, and the map
becomes one column per município across the whole country.

- **Metric switch**: population (Censo 2022) or PIB (2023). The palette follows
  the metric: `--pa-demo-pop` blue, `--pa-demo-gdp` forest green, applied to
  columns, municipal outlines, state lines, the national border and the legend.
- **Column height** is proportional to the square root of the metric, so São
  Paulo does not flatten the other 5,569 municípios.
- **Fiscal overlay** (PIB metric only, since flows are R$ against R$): the
  outflow column is segmented by tax and the twin return column by transfer
  type, with per-segment toggles in the side menu. Arcs animate between the
  column top and Brasília. Only the 14 biggest movers nationally plus the top
  município of every state get an arc, so small states still show a flow
  instead of the Sudeste hogging all of them.
- **State crop**: clicking a state focuses the camera on it (picking is
  restricted to the choropleth, so the click passes "through" the columns) and
  fires a ripple that bounces the columns as the wavefront passes. The ripple
  is contained to that state by IBGE code prefix and respects
  `prefers-reduced-motion`.
- **City card**: clicking a column opens the left-hand card with the município's
  demographic and fiscal breakdown.

### Esc walks back one level at a time

City card, then UF crop, then demographic view, then município, then state,
then national. The cascade lives in `App.vue`; each step is one keypress.

## Feature flags (`src/lib/features.ts`)

| Flag | Default | Effect |
| --- | --- | --- |
| `HIDDEN_INFLUENCE_ENABLED` | `false` | Brings back the hidden dimension: the panel's second ranking column, the amber map columns and arcs, the legend row. Locked until the F5/F6 pipeline and human review exist (ARCHITECTURE.md section 5). |
| `INFLUENCE_ARCS_ENABLED` | `false` | Capital-to-capital arcs. The mock links carry no product meaning until F5 produces real ones. |

`STATE_LIFT_ENABLED` in `deckLayers.ts` is a third, local switch: it lifts the
selected state and its mesh as a platform in the demographic view. Off for
now, so only the ripple animates.

## Performance notes

- Municipal meshes load **one state at a time** (largest, MG, is 569 KB); the
  app never holds all 5,570 polygons as pickable geometry. The demographic
  view is the exception and it uses centroids, not polygons.
- Failed dataset loads are handled without retry loops: a 404 or the SPA
  fallback marks the entry and moves on (`mapLayers`, `indicators`,
  `demografia` and `fiscal` stores all follow the same pattern).
- The deck.gl subpackages (`core`, `layers`, `aggregation-layers`,
  `extensions`, `mapbox`) must always be upgraded together to the same minor,
  or picking and rendering break in subtle ways.
