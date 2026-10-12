// THE SPECTRUM (founder, 2026-10-12: the logo, the Latest chip and the hero keyword "should have the same color, can
// be multi-colored"). One multi-colour ramp shared by the three: the logo intro's particles and the diamond's glow
// (logo.tsx), the hero keyword's particles (keyword.tsx) and the Latest chip's text (v8.css, --spectrum). Blue, teal,
// green, amber, ember: the site's meaning colours in one line, and still no purple or pink.
export type RGB = [number, number, number];
export const SPECTRUM: RGB[] = [[90, 180, 255], [45, 212, 191], [61, 214, 140], [242, 183, 90], [255, 106, 43]];
export const SPECTRUM_HEX = SPECTRUM.map(([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`);

/** The colour at t (0..1) along the spectrum, as an rgb() string. */
export function spectrumAt(t: number): string {
  const c = Math.max(0, Math.min(1, t)) * (SPECTRUM.length - 1);
  const i = Math.min(SPECTRUM.length - 2, Math.floor(c)), f = c - i, a = SPECTRUM[i], b = SPECTRUM[i + 1];
  return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`;
}
