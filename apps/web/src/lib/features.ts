/**
 * The hidden-influence dimension is locked ("em breve") until the F5/F6
 * pipeline + human-review gate exist (ARCHITECTURE.md §5). This single flag
 * brings it all back: the panel's second ranking column, the amber map
 * columns and arcs, and the legend row.
 */
export const HIDDEN_INFLUENCE_ENABLED = false

/**
 * The capital-to-capital influence arcs render fictional mock links with no
 * product meaning yet ("ainda não têm propósito" — Arthur, 2026-07-22). Off
 * until the F5 pipeline produces real inter-region links worth drawing.
 */
export const INFLUENCE_ARCS_ENABLED = false
