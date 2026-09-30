// src/scenarios.js
// Level "weather scenarios": deterministic storm seasons layered on top of the NASA-format data.
//
// Why this exists: the bundled NASA snapshots are calm (dust opacity stays below ~0.15), so on their
// own they could never produce the dust storms that levels 2 and 3 are built around. Real Mars has
// storm seasons, so each level gets a fixed storm calendar. The overlay only ever RAISES dust and
// wind (it never invents temperatures or pressures), and every overlaid field is flagged in
// `env.sources[field].scenario = true` so the UI can be honest about it.
//
// A storm is { start, end, peak } in sols. Dust follows a smooth rise-and-fall (sine) shape, so the
// player gets a few sols of warning as it builds ("outlook") and a few sols of recovery afterwards.

export const SCENARIOS = {
  'level-1': { label: 'Calm season', storms: [], coldSnaps: [] },
  'level-2': {
    label: 'Storm Season',
    storms: [
      { start: 6, end: 10, peak: 0.75 },
      { start: 18, end: 23, peak: 0.88 },
    ],
    coldSnaps: [],
  },
  'level-3': {
    label: 'The Long Haul',
    storms: [
      { start: 5, end: 9, peak: 0.7 },
      { start: 15, end: 21, peak: 0.9 },
      { start: 28, end: 34, peak: 0.85 },
    ],
    coldSnaps: [{ start: 24, end: 27, deltaC: -14 }],
  },
};

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const inWindow = (w, sol) => sol >= w.start && sol <= w.end;

/** Dust opacity (0..1) the scenario asks for at a given sol/phase. 0 outside storms. */
export function scenarioDust(scn, sol, phase = 'day') {
  if (!scn) return 0;
  let dust = 0;
  for (const st of scn.storms) {
    if (!inWindow(st, sol)) continue;
    const t = (sol - st.start + (phase === 'night' ? 0.5 : 0)) / (st.end - st.start + 1);
    dust = Math.max(dust, st.peak * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
  }
  return dust;
}

/** Temperature offset (deg C) for cold snaps at a given sol. */
export function scenarioColdOffset(scn, sol) {
  if (!scn) return 0;
  return scn.coldSnaps.filter((w) => inWindow(w, sol)).reduce((a, w) => Math.min(a, w.deltaC), 0);
}

/**
 * Returns a NEW envData with the scenario applied (the input is never mutated).
 * Adds `scenario: { label, storm }` (ignored by the engine, used by the UI).
 */
export function applyScenario(env, scn, sol, phase = 'day') {
  if (!scn) return env;
  const out = { ...env, sources: { ...(env.sources || {}) } };
  const dust = scenarioDust(scn, sol, phase);
  if (dust > (out.dustOpacity ?? 0)) {
    out.dustOpacity = round(dust, 3);
    out.sources.dustOpacity = {
      dataset: 'Game scenario overlay', url: null, field: 'storm calendar', proxy: false, scenario: true,
      note: `GAME SCENARIO (${scn.label}): a scripted dust storm raises the NASA-derived dust value. Not a measurement.`,
    };
  }
  if (dust > 0.3) {
    const wind = Math.max(out.windSpeed ?? 5, 5 + 12 * dust);
    out.windSpeed = round(wind, 1);
    out.sources.windSpeed = {
      dataset: 'Game scenario overlay', url: null, field: 'storm calendar', proxy: false, scenario: true,
      note: 'GAME SCENARIO: storm winds. Not a measurement.',
    };
  }
  const dT = scenarioColdOffset(scn, sol);
  if (dT < 0 && typeof out.temperature === 'number') {
    out.temperature = round(out.temperature + dT, 1);
    out.sources.temperature = {
      ...(out.sources.temperature || {}), scenario: true,
      note: `GAME SCENARIO: cold snap (${dT} C) applied on top of the NASA-derived temperature.`,
    };
  }
  out.scenario = { label: scn.label, storm: dust >= 0.3 };
  return out;
}
