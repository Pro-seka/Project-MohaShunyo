// fetchNasa.js - client data layer for simEngine. Works in the browser and Node 18+ (ES module).
//
// Modes
//   online  (default): calls the proxy (server/index.js). If the proxy/NASA is unreachable,
//                      silently falls back to the cached snapshot (result.source === 'snapshot').
//   offline          : never touches the network; reads data/cached/moon.json / mars.json only.
//
// Switch to offline (any one of these):
//   browser : add ?offline=1 to the page URL, or run  localStorage.nasaMode = 'offline'
//   node    : NASA_MODE=offline node yourScript.js
//   code    : import { setMode } from './data/fetchNasa.js'; setMode('offline');

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

const config = {
  proxyBase: 'http://localhost:3001', // where server/index.js runs
  fallbackToSnapshot: true,
  mode: detectMode(),
};

function detectMode() {
  try {
    if (isBrowser) {
      if (new URLSearchParams(window.location.search).get('offline') === '1') return 'offline';
      if (window.localStorage?.getItem('nasaMode') === 'offline') return 'offline';
    } else if (typeof process !== 'undefined' && process.env?.NASA_MODE === 'offline') {
      return 'offline';
    }
  } catch {
    /* storage blocked: ignore */
  }
  return 'online';
}

export const configure = (opts) => Object.assign(config, opts);
export const setMode = (mode) => {
  if (!['online', 'offline'].includes(mode)) throw new Error('mode must be "online" or "offline"');
  config.mode = mode;
};
export const getMode = () => config.mode;

// ---------- helpers ----------
const toRange = (r) => {
  if (!r) return {};
  if (Array.isArray(r)) return { start: r[0], end: r[1] };
  return { start: r.start, end: r.end };
};
const inRange = (date, { start, end }) => (!start || date >= start) && (!end || date <= end);

async function loadSnapshot(body) {
  const url = new URL(`./cached/${body}.json`, import.meta.url);
  if (isBrowser) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Snapshot ${body}.json not found (${r.status})`);
    return r.json();
  }
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(url, 'utf8'));
}

async function proxyGet(pathAndQuery) {
  const r = await fetch(`${config.proxyBase}${pathAndQuery}`, { signal: AbortSignal.timeout(25000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Proxy error ${r.status}`);
  return body;
}

// online first (unless offline mode), then snapshot fallback
async function withFallback(onlineFn, snapshotFn) {
  if (config.mode === 'offline') return { ...(await snapshotFn()), source: 'offline' };
  try {
    return await onlineFn();
  } catch (err) {
    if (!config.fallbackToSnapshot) throw err;
    return { ...(await snapshotFn()), source: 'snapshot', warning: err.message };
  }
}

// ---------- public API ----------

/**
 * Daily solar data from NASA POWER.
 * @param {number} lat @param {number} long
 * @param {{start:string,end:string}|[string,string]} dateRange ISO dates (YYYY-MM-DD)
 * @returns {Promise<{source:string, rangeMatched?:boolean, daily:Array<{date,ghi_kWh_m2_day,ghi_Wm2,toa_Wm2,tMaxC,tMinC}>}>}
 * Note: POWER is an Earth dataset. Offline snapshots hold a fixed equatorial reference series.
 */
export async function getPowerData(lat, long, dateRange) {
  const { start, end } = toRange(dateRange);
  const qs = new URLSearchParams({ lat, lon: long, ...(start && { start }), ...(end && { end }) });
  return withFallback(
    () => proxyGet(`/api/power?${qs}`),
    async () => {
      const snap = await loadSnapshot('moon');
      const all = snap.power.daily;
      const hit = all.filter((d) => inRange(d.date, { start, end }));
      return { rangeMatched: hit.length > 0, daily: hit.length ? hit : all };
    },
  );
}

/**
 * InSight Mars weather: temperature (°C), pressure (Pa), wind (m/s), per sol.
 * NOTE: InSight's mission ended in 2022, so the feed is a frozen archive. Expect
 * rangeMatched:false for recent dates; you get the latest sols that exist.
 */
export async function getMarsWeather(station = 'insight', dateRange) {
  const { start, end } = toRange(dateRange);
  const qs = new URLSearchParams({ station, ...(start && { start }), ...(end && { end }) });
  return withFallback(
    () => proxyGet(`/api/mars-weather?${qs}`),
    async () => {
      const snap = await loadSnapshot('mars');
      const all = snap.weather?.daily ?? [];
      const hit = all.filter((d) => d.date && inRange(d.date, { start, end }));
      return { rangeMatched: hit.length > 0 || !(start || end), daily: hit.length ? hit : all };
    },
  );
}

/**
 * Curated, display-safe NASA images. Returns [{id,title,description,href,thumb,credit}].
 * Offline: returns the images stored in the snapshots (may be empty -> use a CSS gradient).
 */
export async function getBackgroundImage(query) {
  const res = await withFallback(
    () => proxyGet(`/api/images?q=${encodeURIComponent(query)}`),
    async () => {
      const q = query.toLowerCase();
      const body = q.includes('mars') ? 'mars' : 'moon';
      return { images: (await loadSnapshot(body)).images ?? [] };
    },
  );
  return res.images;
}

/**
 * The one call simEngine needs:
 *   { body, solarFlux, radiationIndex, dustIndex, tempRange:{minC,maxC}, source, asOf }
 */
export async function getSimInputs(body = 'moon') {
  if (!['moon', 'mars'].includes(body)) throw new Error('body must be "moon" or "mars"');
  const res = await withFallback(
    () => proxyGet(`/api/sim/${body}`),
    async () => {
      const snap = await loadSnapshot(body);
      return { simInputs: snap.simInputs, meta: snap.meta };
    },
  );
  return { ...res.simInputs, source: res.source, asOf: res.meta?.generatedAt ?? new Date().toISOString() };
}

/**
 * The frontend file with the 8-field schema (name, image, background_layers, solarFlux, radiationIndex,
 * dustIndex, tempRange, notes). Online: GET {proxy}/cached/<body>.json. Falls back to
 * ../../data/cached_<body>.json (works when nasa-data-layer/ sits inside the frontend project
 * and the project root is what your static server serves).
 */
export async function getCachedEnvironment(body = 'mars') {
  if (!['moon', 'mars'].includes(body)) throw new Error('body must be "moon" or "mars"');
  const local = async () => {
    const url = new URL(`../../data/cached_${body}.json`, import.meta.url);
    if (isBrowser) return (await fetch(url)).json();
    return JSON.parse(await (await import('node:fs/promises')).readFile(url, 'utf8'));
  };
  if (config.mode === 'offline') return local();
  try {
    return await proxyGet(`/cached/${body}.json`);
  } catch {
    return local();
  }
}
