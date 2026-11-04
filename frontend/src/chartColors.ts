/**
 * Chart colors for the app's dark surface. Categorical slots 1-4 (blue,
 * orange, aqua, yellow), dark steps, validated against the card surface
 * #1d2026 with the dataviz palette checks:
 * - slots 1-3 pass all-pairs (CVD dE >= 9.4, normal-vision >= 20.9);
 * - slots 1-4 pass the adjacent pairlist used for line charts (worst CVD
 *   dE 8.4, normal-vision 19.8), all >= 3:1. Slot 4 (yellow) sits close to
 *   slot 2 (orange) when compared directly, so 4-line charts always carry
 *   direct end labels and a legend -- identity never rests on color alone.
 * A series keeps its slot by position, never by rank.
 */
export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500"];

export const CHART_INK = {
  primary: "#f0f0f0",
  secondary: "#aaaaaa",
  muted: "#898781",
};
export const CHART_GRID = "#2c2f36";
export const CHART_AXIS = "#3a3d44";
export const CHART_SURFACE = "#1d2026";
