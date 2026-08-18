/**
 * Party-identity colors for the municipal choropleth (camada política): each
 * município is filled by the party of its elected mayor. Colors are the parties'
 * conventional/brand hues, tuned to stay legible on the dark void. Siglas
 * without a curated entry fall back to a deterministic muted hue, and unknown /
 * unmapped municípios use DEFAULT_PARTY_RGB (neutral gray).
 */
export type RGB = [number, number, number]

/**
 * Curated party colors, keyed by the sigla as the TSE publishes it. Many
 * parties cluster around red/blue/green, so the big ones get distinct hues for
 * the choropleth to read at a glance.
 */
const PARTY_RGB: Record<string, RGB> = {
  PT: [196, 30, 46], // vermelho
  PL: [20, 50, 130], // azul-marinho
  MDB: [45, 165, 80], // verde
  PSD: [90, 160, 220], // azul-claro
  PSDB: [0, 128, 200], // azul-tucano
  'UNIÃO': [200, 40, 120], // União Brasil — magenta
  UNIAO: [200, 40, 120],
  PP: [42, 100, 170], // azul
  REPUBLICANOS: [30, 120, 90], // verde-azulado
  PDT: [230, 90, 40], // laranja-avermelhado (trabalhista)
  PSB: [235, 190, 60], // amarelo
  NOVO: [255, 122, 0], // laranja
  PSOL: [150, 60, 160], // roxo
  PODE: [40, 155, 110], // Podemos — verde
  PODEMOS: [40, 155, 110],
  PCdoB: [175, 30, 40], // vermelho-escuro
  PCDOB: [175, 30, 40],
  CIDADANIA: [225, 70, 130], // rosa
  PV: [80, 175, 70], // verde
  REDE: [70, 175, 160], // verde-água
  SOLIDARIEDADE: [235, 130, 40], // laranja
  AVANTE: [60, 130, 200],
  AGIR: [120, 100, 190],
  'PRD': [110, 130, 150],
  MOBILIZA: [150, 120, 90],
  DC: [60, 120, 175],
}

/** Neutral gray for municípios with no party data / unknown sigla. */
export const DEFAULT_PARTY_RGB: RGB = [110, 122, 132]

/** The big parties surfaced in the legend swatches, in a stable order. */
export const LEGEND_PARTIES: string[] = [
  'PT',
  'PL',
  'MDB',
  'PSD',
  'PSDB',
  'UNIÃO',
  'PP',
  'REPUBLICANOS',
  'PDT',
  'PSB',
  'NOVO',
  'PSOL',
]

function normalize(sigla: string): string {
  return sigla.trim().toUpperCase()
}

/** Curated party color for a sigla, or null when none is curated. */
export function partyRgb(sigla: string): RGB | null {
  const key = normalize(sigla)
  return PARTY_RGB[key] ?? PARTY_RGB[key.replace(/\s+/g, '')] ?? null
}

/** Deterministic hue (0–360) from a sigla, stable across sessions. */
function siglaHue(sigla: string): number {
  let h = 0
  for (let i = 0; i < sigla.length; i++) h = (h * 31 + sigla.charCodeAt(i)) >>> 0
  return h % 360
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/**
 * A color for ANY sigla: the curated hue when there is one, else a
 * deterministic hash-derived color tuned to read on the dark map. An empty /
 * missing sigla returns the neutral gray.
 */
export function partyColorAny(sigla: string | null | undefined): RGB {
  if (!sigla) return DEFAULT_PARTY_RGB
  return partyRgb(sigla) ?? hslToRgb(siglaHue(normalize(sigla)), 0.5, 0.6)
}
