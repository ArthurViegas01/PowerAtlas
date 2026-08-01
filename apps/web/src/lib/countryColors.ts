/**
 * National-identity colors for the world trade layer: each partner country's
 * fill, label and arrows read in its own flag-derived hue instead of a single
 * direction color. Tuned to stay legible on the dark void. Countries without
 * an entry fall back to DEFAULT_COUNTRY_RGB.
 */
export type RGB = [number, number, number]

const RED: RGB = [225, 60, 60]
const BLUE: RGB = [70, 120, 220]
const GREEN: RGB = [70, 180, 105]
const GOLD: RGB = [235, 195, 70]
const ORANGE: RGB = [240, 145, 50]
const CELESTE: RGB = [120, 190, 232]

const COUNTRY_RGB: Record<string, RGB> = {
  // Americas
  USA: BLUE,
  ARG: CELESTE,
  MEX: GREEN,
  CHL: [80, 140, 225],
  CAN: RED,
  URY: [95, 150, 225],
  PER: RED,
  PRY: RED,
  BOL: GREEN,
  COL: GOLD,
  VEN: GOLD,
  // Asia
  CHN: RED,
  JPN: [235, 80, 90], // branco e vermelho
  KOR: [80, 130, 220],
  IND: [240, 150, 55], // açafrão
  VNM: RED,
  SGP: RED,
  THA: [90, 130, 215],
  IDN: RED,
  MYS: [80, 120, 210],
  TWN: [80, 120, 215],
  HKG: RED,
  BGD: GREEN,
  ARE: GREEN,
  SAU: GREEN,
  IRN: GREEN,
  TUR: RED,
  // Europe
  NLD: ORANGE, // Países Baixos
  DEU: GOLD, // preto-vermelho-ouro
  ESP: [232, 170, 55], // rojigualda
  ITA: GREEN,
  GBR: [70, 110, 210],
  FRA: [90, 130, 225],
  RUS: [90, 140, 230],
  BEL: GOLD,
  PRT: GREEN,
  CHE: RED,
  POL: RED,
  // Africa & Oceania
  NGA: GREEN,
  ZAF: GREEN,
  EGY: RED,
  DZA: GREEN,
  MAR: RED,
  AUS: [70, 110, 205],
}

/** Neutral fallback for partners without a curated identity color. */
export const DEFAULT_COUNTRY_RGB: RGB = [120, 205, 225]

/** National color for an ISO alpha-3, or null if none is curated. */
export function countryRgb(iso: string): RGB | null {
  return COUNTRY_RGB[iso] ?? null
}
