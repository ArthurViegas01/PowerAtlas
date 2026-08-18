/**
 * Pure search core of the command palette (IA-2). Building the entry list
 * from the stores happens in CommandPalette.vue; this module only knows how
 * to normalize, score and rank entries, so it stays unit-testable.
 */

export type PaletteGroup = 'command' | 'saved' | 'region' | 'country' | 'entity'

export type PaletteCommand =
  | 'national'
  | 'global'
  | 'demografia'
  | 'console'
  | 'mapa'
  | 'norte'
  | 'auto'
  | 'home'
  | 'salvar'
  | 'copiar'
  | 'intro'
  | 'comparar'
  | 'comparar-abrir'
  | 'sobre'
  | 'influencia'

export type PaletteAction =
  | { kind: 'command'; command: PaletteCommand }
  | { kind: 'region'; id: string; name: string }
  | { kind: 'country'; iso: string; name: string }
  | { kind: 'saved'; id: string }

export interface PaletteEntry {
  /** Stable key for v-for and the active-row bookkeeping. */
  key: string
  group: PaletteGroup
  label: string
  sublabel?: string
  /** Extra strings the query also matches (ids, siglas, aliases). */
  keywords?: string[]
  action: PaletteAction
}

/** Display order of the groups in the result list. */
export const GROUP_ORDER: PaletteGroup[] = ['command', 'saved', 'region', 'country', 'entity']

export const GROUP_LABEL: Record<PaletteGroup, string> = {
  command: 'COMANDOS',
  saved: 'ANÁLISES SALVAS',
  region: 'REGIÕES',
  country: 'PAÍSES · COMÉRCIO',
  entity: 'ENTIDADES · SIMULADO',
}

/** Lowercase and strip diacritics, so "sao" matches "São". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Match score: lower is better; null means no match.
 * 0 = label starts with the query, 1 = a label word starts with it,
 * 2 = label contains it, 3 = a keyword starts with it or the sublabel
 * contains it.
 */
export function scoreEntry(entry: PaletteEntry, query: string): number | null {
  const q = normalize(query)
  if (!q) return 0
  const label = normalize(entry.label)
  if (label.startsWith(q)) return 0
  if (label.split(/\s+/).some((word) => word.startsWith(q))) return 1
  if (label.includes(q)) return 2
  if ((entry.keywords ?? []).some((keyword) => normalize(keyword).startsWith(q))) return 3
  if (entry.sublabel && normalize(entry.sublabel).includes(q)) return 3
  return null
}

export interface RankedGroup {
  group: PaletteGroup
  label: string
  entries: PaletteEntry[]
}

/**
 * Rank the entries for a query and bucket them by group, capping each group
 * so one bucket cannot flood the list. An empty query keeps the insertion
 * order and GROUP_ORDER (the caller curates both); a real query sorts inside
 * each group by score, then alphabetically, and orders the GROUPS by their
 * best score (so "sao" puts SÃO PAULO above the commands that only contain
 * "visão"), with GROUP_ORDER breaking ties.
 */
export function rankEntries(
  entries: PaletteEntry[],
  query: string,
  perGroup = 6,
): RankedGroup[] {
  const scored: { entry: PaletteEntry; score: number }[] = []
  for (const entry of entries) {
    const score = scoreEntry(entry, query)
    if (score !== null) scored.push({ entry, score })
  }
  const searching = normalize(query) !== ''
  if (searching) {
    scored.sort(
      (a, b) =>
        a.score - b.score || a.entry.label.localeCompare(b.entry.label, 'pt-BR'),
    )
  }
  const buckets = GROUP_ORDER.map((group) => {
    const inGroup = scored.filter((s) => s.entry.group === group).slice(0, perGroup)
    return {
      group,
      label: GROUP_LABEL[group],
      entries: inGroup.map((s) => s.entry),
      best: inGroup.length ? inGroup[0].score : Infinity,
    }
  }).filter((bucket) => bucket.entries.length > 0)
  if (searching) {
    buckets.sort(
      (a, b) =>
        a.best - b.best || GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
    )
  }
  return buckets.map(({ group, label, entries: list }) => ({ group, label, entries: list }))
}
