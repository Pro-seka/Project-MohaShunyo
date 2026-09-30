// src/env-feed.js
// Turns the cached NASA snapshots (data/cache/*.json) into one envData object per game phase.
//
//   const feed = await loadEnvFeed(loadJson);        // loadJson(fileName) -> Promise<object>
//   const env  = feed.get(sol, 'day', scenario);     // envData (contract 4.2), never throws
//
// Selection rules (documented in docs/ARCHITECTURE.md):
//  - Daytime phases use MEDA records from local solar time 09:00-15:59, night phases 20:00-04:59.
//    Records rotate with the sol number so consecutive sols see different real-looking conditions.
//  - Dust comes from the MRO/MCS daily series (one entry per sol, cycling), flagged proxy:true,
//    exactly like fetchLatest() does when it fills MEDA's missing dust field.
//  - If a snapshot is missing the feed still works: fields stay null and the engine falls back to
//    its level profile. Nothing here ever throws into the game loop.

import { normalize } from '../data/src/nasaData.js';
import { applyScenario } from './scenarios.js';

const isDaylight = (r) => r.lmst_hour >= 9 && r.lmst_hour <= 15;
const isNight = (r) => r.lmst_hour >= 20 || r.lmst_hour <= 4;

const emptyEnv = () => ({
  timestamp: null, temperature: null, pressure: null, windSpeed: null,
  dustOpacity: null, radiation: null, solarIrradiance: null, sources: {},
});

/** Builds a feed from already-loaded snapshots (used by tests and by loadEnvFeed). */
export function createEnvFeed({ meda = null, mcs = null, origin = 'cache' } = {}) {
  const objs = (a) => (Array.isArray(a) ? a.filter((r) => r && typeof r === 'object') : []);
  const medaRecs = objs(meda?.records);
  const daily = objs(mcs?.daily);
  const dayPool = medaRecs.filter(isDaylight);
  const nightPool = medaRecs.filter(isNight);
  const pool = (phase) => {
    const p = phase === 'night' ? nightPool : dayPool;
    return p.length ? p : medaRecs;
  };
  const synthetic = (meda?.synthetic === true) || (mcs?.synthetic === true);

  function get(sol = 1, phase = 'day', scenario = null) {
    const i = Math.max(0, Math.floor(sol) - 1);
    let env = emptyEnv();
    try {
      const recs = pool(phase);
      if (recs.length) {
        const rec = recs[i % recs.length];
        env = { ...env, ...normalize({ ...rec, synthetic: meda.synthetic === true }, 'meda') };
      }
      if (daily.length) {
        const d = daily[i % daily.length];
        const m = normalize({ ...d, mode: 'observed', synthetic: mcs.synthetic === true }, 'mcs');
        env.sources = { ...env.sources };
        if (m.dustOpacity != null) {
          env.dustOpacity = m.dustOpacity;
          env.sources.dustOpacity = {
            ...m.sources.dustOpacity, proxy: true, origin,
            note: `PROXY: MEDA has no dust product; orbital MCS column dust (date ${d.date}) used instead. ` + (m.sources.dustOpacity.note ?? ''),
          };
          if (mcs.synthetic === true) env.sources.dustOpacity.synthetic = true;
        }
        // If there is no MEDA data at all, MCS still supplies temperature, pressure and radiation.
        if (!recs.length) {
          for (const k of ['temperature', 'pressure', 'radiation', 'timestamp']) env[k] = m[k];
          for (const k of ['temperature', 'pressure', 'radiation']) env.sources[k] = m.sources[k];
        }
      }
    } catch (err) {
      console.warn('[env-feed] could not build environment, using engine fallbacks:', err);
      env = emptyEnv();
    }
    return applyScenario(env, scenario, sol, phase);
  }

  return {
    get,
    info: {
      origin,
      hasMeda: medaRecs.length > 0,
      hasMcs: daily.length > 0,
      synthetic,
      usable: medaRecs.length > 0 || daily.length > 0,
    },
  };
}

/** Loads `<source>-latest.json` (converter output) first, then `<source>-sample.json`. */
async function loadSnapshot(loadJson, source) {
  for (const name of [`${source}-latest.json`, `${source}-sample.json`]) {
    try { return await loadJson(name); } catch { /* try the next file */ }
  }
  return null;
}

export async function loadEnvFeed(loadJson) {
  const [meda, mcs] = await Promise.all([loadSnapshot(loadJson, 'meda'), loadSnapshot(loadJson, 'mcs')]);
  return createEnvFeed({ meda, mcs, origin: 'cache' });
}
