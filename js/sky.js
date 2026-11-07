// Day and night: sky colours, light tint, sun and moon for a time of day t in [0, 1).
// A full day lasts CYCLE seconds: a long sunny day, a pink dusk, a moonlit night and a sunrise.
export const CYCLE = 600;
export const DUSK = 0.6, NIGHT = 0.68, DAWN = 0.94;

const DAY_H = [0.8, 0.9, 0.98], DAY_Z = [0.3, 0.62, 0.93];
const NIGHT_H = [0.12, 0.17, 0.38], NIGHT_Z = [0.04, 0.06, 0.24];
const WARM_H = [0.98, 0.68, 0.52], WARM_Z = [0.42, 0.44, 0.76];
const NIGHT_TINT = [0.46, 0.53, 0.82], NIGHT_ENT = [0.6, 0.64, 0.88], WARM_TINT = [1.0, 0.86, 0.76];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };

export function skyAt(t) {
  t = ((t % 1) + 1) % 1;
  let night, warm = 0;
  if (t < DUSK) night = 0;
  else if (t < NIGHT) { const k = (t - DUSK) / (NIGHT - DUSK); night = smooth(0, 1, k); warm = Math.sin(k * Math.PI); }
  else if (t < DAWN) night = 1;
  else { const k = (t - DAWN) / (1 - DAWN); night = 1 - smooth(0, 1, k); warm = Math.sin(k * Math.PI); }

  const horizon = mix(mix(DAY_H, NIGHT_H, night), WARM_H, warm * 0.7);
  const zenith = mix(mix(DAY_Z, NIGHT_Z, night), WARM_Z, warm * 0.5);
  const tint = mix(mix([1, 1, 1], NIGHT_TINT, night), WARM_TINT, warm * 0.5);
  const entTint = mix(mix([1, 1, 1], NIGHT_ENT, night), WARM_TINT, warm * 0.4);

  // the sun arcs across the sky by day; the square moon rises over the night
  const sa = Math.min(1, t / (NIGHT - 0.02)) * Math.PI;
  const sunDir = norm([Math.cos(sa) * 0.8, Math.max(-0.2, Math.sin(sa)) * 0.9 + 0.05, -0.5]);
  const mt = t >= DUSK ? (t - DUSK) / (1 - DUSK) : 1;
  const ma = mt * Math.PI;
  const moonDir = norm([-Math.cos(ma) * 0.75, 0.3 + Math.sin(ma) * 0.6, -0.55]);
  return { t, night, warm, horizon, zenith, tint, entTint, sunDir, moonDir };
}
