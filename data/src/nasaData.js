// data/src/nasaData.js
// Fetch + parse + normalize real NASA Mars data into the game's `envData` object.
// ES module; works in Node >= 18 and in browsers served over http(s).
// Public API (exactly two exports, per shared contract 4.1):
//   fetchLatest(options) -> envData        (live if possible, else cache)
//   normalize(rawRecord, source) -> envData
//
// Design notes and every unit conversion are documented in data/README_DATA.md.

import { parseCsv } from "./convert/csv.js";
import { buildMedaRecords } from "./convert/meda_records.js";
import { MEDA_FILE_TAGS, MARS2020_LANDING_MS, SOL_SECONDS, solFromDate } from "./convert/columns.js";

const IS_NODE = typeof process !== "undefined" && !!process.versions?.node;

// ------------------------------------------------------------------ constants
const KELVIN = 273.15;
/** Dust normalization: dustOpacity = clamp(tauVisible / TAU_MAX, 0, 1). See README sec. 4. */
const TAU_MAX = 5.0;
/** Visible(~600 nm)/IR(21.6 um) opacity ratio for MCS dust, Kleinbohl et al. 2009 (JGR 114, E10006). */
const IR_TO_VIS_TAU = 4.4;
const CO2_R = 192;       // J/kg/K, specific gas constant of CO2
const G_MARS = 3.71;     // m/s2
/** MSL/RAD surface baseline (Hassler et al. 2014): 0.21 mGy/day absorbed, 0.64 mSv/day dose equivalent. */
const RAD_BASELINE = { absorbed_mGy_day: 0.21, equivalent_mSv_day: 0.64 };
const RAD_Q = RAD_BASELINE.equivalent_mSv_day / RAD_BASELINE.absorbed_mGy_day; // ~3.05
const LS_PER_DAY = (86400 / SOL_SECONDS) * (360 / 668.6); // mean Ls advance per Earth day (approx.)
const MEDA_LMST_AT_LANDING_H = 15.0; // approximate; only used when the PDS tables have no UTC column

const URLS = {
  medaBundle: "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
  medaCal: "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_calibrated_env/",
  medaDer: "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/",
  mcsDdr: "https://nssdc.gsfc.nasa.gov/nmc/dataset/display.action?id=PSPA-00592",
  mcsArchive: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/Mars/Mars.html",
  rad: "https://doi.org/10.1126/science.1244797",
};

// ------------------------------------------------------------------ small helpers
const finite = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round = (x, d) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prov = (dataset, url, field, proxy = false, note) => ({ dataset, url, field, proxy, ...(note ? { note } : {}) });
const missing = (note) => ({ dataset: null, url: null, field: null, proxy: false, note });
const dayMs = 86400_000;
const dayDiff = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / dayMs);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * dayMs).toISOString().slice(0, 10);

/** Convert a radiation dose-rate reading to mSv/h. Q is only used for absorbed-dose (Gy) units. */
function toMSvPerHour(value, unit, Q = RAD_Q) {
  const v = finite(value);
  if (v == null) return null;
  switch (unit) {
    case "µGy/day": return (v * Q) / 1000 / 24;
    case "mGy/day": return (v * Q) / 24;
    case "µSv/day": return v / 1000 / 24;
    case "mSv/day": return v / 24;
    case "mSv/h": return v;
    default: throw new Error("Unsupported radiation unit: " + unit);
  }
}

function dustFromTauVisible(tauVis) {
  const t = finite(tauVis);
  return t == null ? null : round(clamp(t / TAU_MAX, 0, 1), 3);
}

function radiationProxy() {
  return {
    value: round(toMSvPerHour(RAD_BASELINE.equivalent_mSv_day, "mSv/day"), 4),
    source: prov(
      "MSL/RAD (Curiosity, Gale Crater) surface dose-equivalent baseline - Hassler et al. 2014, Science 343(6169)",
      URLS.rad,
      "dose equivalent 0.64 mSv/day (= 0.21 mGy/day absorbed x mean quality factor 3.05), first ~300 sols",
      true,
      "PROXY: Perseverance/MEDA has no ionizing-radiation dose sensor. Constant baseline from a different mission and site; not live and not Jezero."
    ),
  };
}

// ------------------------------------------------------------------ normalize
function normalizeMeda(raw) {
  const T = finite(raw.AIR_TEMP), P = finite(raw.PRESSURE), W = finite(raw.WIND_SPEED), S = finite(raw.SW_DOWN_FLUX);
  const cal = "Mars 2020 MEDA Environmental Calibrated Data Collection (urn:nasa:pds:mars2020_meda:data_calibrated_env)";
  const der = "Mars 2020 MEDA Environmental Derived Data Collection (urn:nasa:pds:mars2020_meda:data_derived_env)";
  const rad = radiationProxy();
  const sources = {
    temperature: T == null ? missing("MEDA ATS air temperature absent in this record")
      : prov(cal + " - ATS (Air Temperature Sensor), mean of ATS1-3", URLS.medaCal, "AIR_TEMP (K) [ATS1-3 mean]", false),
    pressure: P == null ? missing("MEDA pressure absent in this record")
      : prov(der + " - PS (Pressure Sensor)", URLS.medaDer, "PRESSURE (Pa)", false),
    windSpeed: W == null
      ? missing("No MEDA wind value: wind sensor is duty-cycled (15 min per 2 h) and degraded since ~sol 345; derived wind not released for all sols")
      : prov(der + " - WIND (Wind Sensor)", URLS.medaDer, "WIND_SPEED (m/s) [horizontal]", false),
    dustOpacity: missing("MEDA PDS derived collection has no dust optical-depth product (only PS, RHS, TIRS, WIND, ANCILLARY). fetchLatest() may fill this from MCS as a flagged proxy."),
    radiation: rad.source,
    solarIrradiance: S == null ? missing("MEDA TIRS IR3 short-wave flux absent in this record")
      : prov(cal + " - TIRS (Thermal Infrared Sensor), up-looking IR3 channel 0.3-3 um", URLS.medaCal, "SW_DOWN_FLUX (W/m2)", false,
             "Not corrected for dust accumulation on the sensor (DCF); daytime values may read low."),
  };
  return {
    timestamp: raw.utc ?? null,
    temperature: T == null ? null : round(T - KELVIN, 1),
    pressure: round(P, 1),
    windSpeed: round(W, 2),
    dustOpacity: null,
    radiation: rad.value,
    solarIrradiance: round(S, 1),
    sources,
  };
}

function normalizeMcs(raw) {
  const T = finite(raw.T_LOWEST_K), P = finite(raw.P_LOWEST_PA), Z = finite(raw.Z_LOWEST_KM), tauIr = finite(raw.DUST_COLUMN_IR_TAU);
  const mode = raw.mode ?? "observed";
  const modeNote = mode === "observed" ? "" : ` Value is a ${mode} SYNTHESIZED from climatology + persistence, not a measurement.`;
  const ds = "MRO Mars Climate Sounder Level 5 DDR v1.0 (MRO-M-MCS-5-DDR-V1.0), retrieved profiles";
  const rad = radiationProxy();
  let pressure = null;
  if (T != null && P != null && Z != null) {
    const H = (CO2_R * T) / G_MARS; // m
    pressure = round(P * Math.exp((Z * 1000) / H), 1);
  }
  const sources = {
    temperature: T == null ? missing("No valid MCS temperature") : prov(ds, URLS.mcsDdr, "temperature at lowest valid retrieved level (K)", true,
      "PROXY: orbital limb retrieval a few km above the surface, dayside (~15 LTST), not 1.5 m air at the site." + modeNote),
    pressure: pressure == null ? missing("MCS pressure/height missing") : prov(ds, URLS.mcsDdr, "pressure at lowest valid level, extrapolated hydrostatically to the surface: p*exp(z/H), H=R*T/g", true,
      "PROXY: extrapolation with H = 192*T/3.71 m." + modeNote),
    windSpeed: missing("MCS does not measure wind"),
    dustOpacity: tauIr == null ? missing("No MCS dust column") : prov(ds, URLS.mcsDdr, "dust extinction (21.6 um, 1/km) integrated to a column optical depth, x4.4 to visible", false,
      "Column tau_vis = 4.4 x tau_IR (Kleinbohl 2009); dustOpacity = clamp(tau_vis/5, 0, 1)." + modeNote),
    radiation: rad.source,
    solarIrradiance: missing("MCS does not measure surface irradiance"),
  };
  return {
    timestamp: raw.utc ?? (raw.date ? `${raw.date}T12:00:00Z` : null),
    temperature: T == null ? null : round(T - KELVIN, 1),
    pressure,
    windSpeed: null,
    dustOpacity: dustFromTauVisible(tauIr == null ? null : tauIr * IR_TO_VIS_TAU),
    radiation: rad.value,
    solarIrradiance: null,
    sources,
  };
}

/**
 * Raw dataset record -> envData.
 * @param {object} rawRecord canonical snapshot record in ORIGINAL units (see README sec. 3)
 * @param {"meda"|"mcs"} source
 */
export function normalize(rawRecord, source) {
  if (!rawRecord || typeof rawRecord !== "object") throw new Error("normalize(): rawRecord must be an object");
  let env;
  if (source === "meda") env = normalizeMeda(rawRecord);
  else if (source === "mcs") env = normalizeMcs(rawRecord);
  else throw new Error(`normalize(): unknown source "${source}" (use "meda" or "mcs")`);
  if (rawRecord.synthetic === true) {
    // radiation is the published MSL/RAD constant (a real number, flagged proxy), not placeholder data
    for (const [k, s] of Object.entries(env.sources)) if (s.dataset && k !== "radiation") s.synthetic = true;
  }
  return env;
}

// ------------------------------------------------------------------ MCS climatology / forecast
function climAt(clim, ls) {
  if (!Array.isArray(clim) || clim.length === 0) return null;
  const s = [...clim].sort((a, b) => a.ls_center - b.ls_center);
  const L = ((ls % 360) + 360) % 360;
  const i = s.findIndex((c) => c.ls_center > L);
  const hi = i === -1 ? s[0] : s[i];
  const lo = i === -1 ? s[s.length - 1] : i === 0 ? s[s.length - 1] : s[i - 1];
  let loL = lo.ls_center, hiL = hi.ls_center, LL = L;
  if (hiL <= loL) hiL += 360;
  if (LL < loL) LL += 360;
  const f = hiL === loL ? 0 : (LL - loL) / (hiL - loL);
  const out = {};
  for (const k of ["T_LOWEST_K", "P_LOWEST_PA", "Z_LOWEST_KM", "DUST_COLUMN_IR_TAU"]) out[k] = lo[k] + (hi[k] - lo[k]) * f;
  return out;
}

const FORECAST_TAU_DAYS = { T_LOWEST_K: 2, P_LOWEST_PA: 3, DUST_COLUMN_IR_TAU: 5 };

/** forecast/climatology record for `date`, anchored on the nearest end of the observed series */
function synthesizeMcs(snap, date) {
  const daily = snap.daily;
  const first = daily[0], last = daily[daily.length - 1];
  const before = date < first.date;
  const anchor = before ? first : last;
  const k = dayDiff(anchor.date, date); // signed days from anchor
  const ls = anchor.ls + k * LS_PER_DAY;
  const clim = climAt(snap.climatology, ls);
  const clim0 = climAt(snap.climatology, anchor.ls);
  const rec = { date, ls: round(ls, 2), mode: before ? "climatology" : "forecast", Z_LOWEST_KM: anchor.Z_LOWEST_KM, TSURF_K: null,
    anchor_date: anchor.date, lead_days: k };
  for (const f of Object.keys(FORECAST_TAU_DAYS)) {
    if (!clim || !clim0) { rec[f] = anchor[f]; continue; } // no climatology: pure persistence
    const w = before ? 0 : Math.exp(-Math.max(k, 0) / FORECAST_TAU_DAYS[f]);
    rec[f] = round(clim[f] + (anchor[f] - clim0[f]) * w, 4);
  }
  rec.Z_LOWEST_KM = clim ? round(clim.Z_LOWEST_KM, 2) : anchor.Z_LOWEST_KM;
  return rec;
}

function resolveMcsRecord(snap, date) {
  const daily = snap.daily;
  if (!daily?.length) throw new Error("MCS snapshot has no daily records");
  if (!date) return { ...daily[daily.length - 1], mode: "observed" };
  const inRange = date >= daily[0].date && date <= daily[daily.length - 1].date;
  if (inRange) {
    let best = daily[0];
    for (const d of daily) if (Math.abs(dayDiff(d.date, date)) < Math.abs(dayDiff(best.date, date))) best = d;
    return { ...best, mode: "observed" };
  }
  return synthesizeMcs(snap, date);
}

function pickMedaRecord(snap, date) {
  const recs = snap.records;
  if (!recs?.length) throw new Error("MEDA snapshot has no records");
  if (!date) return recs[recs.length - 1];
  const withUtc = recs.filter((r) => r.utc);
  if (!withUtc.length) return recs[recs.length - 1];
  const sameDay = withUtc.filter((r) => r.utc.slice(0, 10) === date);
  if (sameDay.length) return sameDay[sameDay.length - 1];
  const target = Date.parse(date + "T12:00:00Z");
  return withUtc.reduce((b, r) => (Math.abs(Date.parse(r.utc) - target) < Math.abs(Date.parse(b.utc) - target) ? r : b));
}

// ------------------------------------------------------------------ network (Option A)
async function fetchWithBackoff(url, opts, kind) {
  const f = opts.fetchImpl ?? globalThis.fetch;
  if (typeof f !== "function") throw new Error("fetch() is not available in this environment");
  const retries = opts.retries ?? 3, base = opts.backoffMs ?? 500;
  const u = new URL(url);
  // Optional api.nasa.gov key: read from the environment, never hardcoded, never logged.
  if (IS_NODE && u.hostname === "api.nasa.gov" && process.env.NASA_API_KEY && !u.searchParams.has("api_key")) {
    u.searchParams.set("api_key", process.env.NASA_API_KEY);
  }
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await f(u.href, { signal: AbortSignal.timeout ? AbortSignal.timeout(opts.timeoutMs ?? 15000) : undefined });
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(base * 2 ** attempt);
      continue;
    }
    if (res.ok) return kind === "text" ? res.text() : res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const ra = Number(res.headers?.get?.("retry-after"));
      await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : base * 2 ** attempt + Math.random() * 100, 30000));
      continue;
    }
    throw new Error(`HTTP ${res.status} from ${u.origin}${u.pathname}`);
  }
}

/** Best-effort read of PDS Atmospheres directory listings + CSVs (UNVERIFIED file naming; falls back to cache). */
async function livePdsMeda(opts) {
  const targetSol = opts.sol ?? (opts.date ? solFromDate(opts.date) : null);
  const tables = {};
  let usedSol = null, lastDir = URLS.medaDer;
  for (const [key, { dir, tag }] of Object.entries(MEDA_FILE_TAGS)) { // PS first: it fixes the sol
    const root = dir === "derived" ? URLS.medaDer : URLS.medaCal;
    const rootHtml = await fetchWithBackoff(root, opts, "text");
    const blocks = [...rootHtml.matchAll(/href="(sol_(\d{4})_(\d{4})\/)"/g)].map((m) => ({ href: m[1], lo: +m[2], hi: +m[3] }));
    if (!blocks.length) throw new Error("PDS listing has no sol_* folders (layout changed?)");
    const block = (targetSol != null && blocks.find((b) => targetSol >= b.lo && targetSol <= b.hi)) || [...blocks].sort((a, b) => b.hi - a.hi)[0];
    const listing = await fetchWithBackoff(root + block.href, opts, "text");
    const files = [...listing.matchAll(/href="([^"]+\.csv)"/gi)].map((m) => m[1]).filter((f) => tag.test(f))
      .map((f) => ({ f, sol: Number(f.match(/_(\d{4})_/)?.[1]) })).filter((x) => Number.isFinite(x.sol));
    if (!files.length) { if (key === "PS") throw new Error("no PS files found"); continue; }
    const want = usedSol ?? (targetSol != null && files.some((x) => x.sol === targetSol) ? targetSol : Math.max(...files.map((x) => x.sol)));
    const hit = files.find((x) => x.sol === want);
    if (!hit) { if (key === "PS") throw new Error("no PS file for sol " + want); continue; }
    usedSol = want;
    lastDir = root + block.href;
    tables[key] = parseCsv(await fetchWithBackoff(root + block.href + hit.f, opts, "text"));
  }
  const recs = buildMedaRecords(tables);
  if (!recs.length) throw new Error("no MEDA records built from PDS tables");
  const rec = { ...recs[recs.length - 1] };
  if (!rec.utc) { // approximate UTC from sol + LMST hour (anchor: landing, LMST ~15 h)
    const el = ((rec.sol - 0) + (rec.lmst_hour + 0.5 - MEDA_LMST_AT_LANDING_H) / 24) * SOL_SECONDS * 1000;
    rec.utc = new Date(MARS2020_LANDING_MS + el).toISOString().replace(/\.\d+Z$/, "Z");
    rec.utc_approx = true;
  }
  return { record: rec, origin: "live", originUrl: lastDir, units: undefined, snapshotFile: null };
}

async function loadLive(opts) {
  if (opts.baseUrl) { // Option A: JSON API (mock server or any compatible service)
    const base = opts.baseUrl.replace(/\/+$/, "");
    const q = new URLSearchParams();
    if (opts.source === "meda" && opts.date) q.set("date", opts.date);
    if (opts.forecastDays) q.set("forecastDays", String(opts.forecastDays));
    const qs = q.toString() ? "?" + q : "";
    const url = opts.source === "meda" ? `${base}/api/meda/latest${qs}` : `${base}/api/mcs/${opts.date ?? "latest"}${qs}`;
    const body = await fetchWithBackoff(url, opts, "json");
    if (!body?.record) throw new Error("live response has no `record`");
    return { record: body.record, origin: "live", originUrl: `${base}/api/${opts.source}`, units: body.units, snapshotFile: null, forecast: body.forecast };
  }
  if (opts.source === "meda") return livePdsMeda(opts);
  throw new Error("No live MCS endpoint: DDR profiles are too large to parse per request; pass baseUrl or use the converter.");
}

// ------------------------------------------------------------------ cache
async function readJson(fileName, opts) {
  if (opts.cacheBaseUrl) {
    const url = opts.cacheBaseUrl.replace(/\/?$/, "/") + fileName;
    return fetchWithBackoff(url, { ...opts, retries: 0 }, "json");
  }
  const url = new URL("../cache/" + fileName, import.meta.url);
  if (IS_NODE) {
    const fs = await import("node:fs/promises");
    return JSON.parse(await fs.readFile(url, "utf8"));
  }
  return fetchWithBackoff(url.href, { ...opts, retries: 0 }, "json");
}

async function loadCached(source, date, opts) {
  let snap = null, file = null, lastErr = null;
  for (const name of [`${source}-latest.json`, `${source}-sample.json`]) { // converter output wins over the sample
    try { snap = await readJson(name, opts); file = name; break; } catch (e) { lastErr = e; }
  }
  if (!snap) throw new Error(`No cached snapshot for "${source}" in data/cache/ (${lastErr?.message})`);
  const record = source === "meda" ? pickMedaRecord(snap, date) : resolveMcsRecord(snap, date);
  return { record: { ...record, synthetic: snap.synthetic === true }, origin: "cache", originUrl: null, units: snap.units, snapshotFile: `data/cache/${file}`, snap, syntheticNotice: snap.syntheticNotice };
}

async function acquire(source, date, opts) {
  let liveError = null;
  if (!opts.offline) {
    try { return { ...(await loadLive({ ...opts, source, date })), liveError: null }; } catch (e) { liveError = e.message; }
  }
  return { ...(await loadCached(source, date, opts)), liveError };
}

// ------------------------------------------------------------------ raw view for the UI toggle
const RAW_MAP = {
  meda: [
    ["temperature", "AIR_TEMP", "K"], ["pressure", "PRESSURE", "Pa"], ["windSpeed", "WIND_SPEED", "m/s"], ["solarIrradiance", "SW_DOWN_FLUX", "W/m2"],
  ],
  mcs: [
    ["temperature", "T_LOWEST_K", "K"], ["pressure", "P_LOWEST_PA", "Pa"], ["dustOpacity", "DUST_COLUMN_IR_TAU", "1 (IR column tau)"],
  ],
};

function buildRaw(source, picked, env, extraFields = []) {
  const fields = RAW_MAP[source].map(([envField, rawField, rawUnit]) => ({
    envField, rawField, rawValue: picked.record[rawField] ?? null, rawUnit, value: env[envField],
  }));
  fields.push({ envField: "radiation", rawField: "MSL/RAD baseline", rawValue: RAD_BASELINE.equivalent_mSv_day, rawUnit: "mSv/day", value: env.radiation });
  return {
    source, origin: picked.origin, originUrl: picked.originUrl, snapshotFile: picked.snapshotFile,
    synthetic: picked.record.synthetic === true, syntheticNotice: picked.syntheticNotice ?? null,
    liveError: picked.liveError ?? null, units: picked.units ?? null, record: picked.record,
    fields: [...fields, ...extraFields],
  };
}

// ------------------------------------------------------------------ fetchLatest
/**
 * Live if possible, else cache. Returns envData exactly as in contract 4.2.
 * Extra keys appear ONLY when requested: `raw` (includeRaw) and `forecast` (forecastDays, mcs).
 * @param {{source?:"meda"|"mcs", offline?:boolean, date?:string, includeRaw?:boolean,
 *          forecastDays?:number, baseUrl?:string, sol?:number, fillDustFromMcs?:boolean,
 *          cacheBaseUrl?:string, fetchImpl?:Function, retries?:number, backoffMs?:number}} [options]
 */
export async function fetchLatest(options = {}) {
  const opts = { source: "meda", offline: false, includeRaw: false, forecastDays: 0, fillDustFromMcs: true, ...options };
  if (opts.source !== "meda" && opts.source !== "mcs") throw new Error(`fetchLatest(): unknown source "${opts.source}"`);
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) throw new Error("fetchLatest(): date must be YYYY-MM-DD");

  const picked = await acquire(opts.source, opts.date ?? null, opts);
  const env = normalize(picked.record, opts.source);
  for (const s of Object.values(env.sources)) if (s.dataset) s.origin = picked.origin;

  const extra = [];
  if (opts.source === "meda" && env.dustOpacity == null && opts.fillDustFromMcs) {
    try {
      const day = (env.timestamp ?? "").slice(0, 10) || opts.date || null;
      const m = await acquire("mcs", day, opts);
      const menv = normalize(m.record, "mcs");
      if (menv.dustOpacity != null) {
        env.dustOpacity = menv.dustOpacity;
        env.sources.dustOpacity = {
          ...menv.sources.dustOpacity, proxy: true, origin: m.origin,
          note: `PROXY: MEDA has no dust product; orbital MCS column dust (mode: ${m.record.mode ?? "observed"}, date ${m.record.date}) used instead. ` + (menv.sources.dustOpacity.note ?? ""),
        };
        if (m.record.synthetic === true) env.sources.dustOpacity.synthetic = true;
        extra.push({ envField: "dustOpacity", rawField: "DUST_COLUMN_IR_TAU (MCS)", rawValue: m.record.DUST_COLUMN_IR_TAU ?? null, rawUnit: "1 (IR column tau)", value: env.dustOpacity });
      }
    } catch { /* keep null; engine handles nulls */ }
  }

  if (opts.source === "mcs" && opts.forecastDays > 0) {
    if (picked.forecast) env.forecast = picked.forecast;
    else if (picked.snap) {
      const base = picked.record.date;
      env.forecast = [];
      for (let k = 1; k <= opts.forecastDays; k++) {
        const rec = { ...synthesizeMcs(picked.snap, addDays(base, k)), synthetic: picked.record.synthetic === true };
        env.forecast.push(normalize(rec, "mcs"));
      }
    }
  }
  if (opts.includeRaw) env.raw = buildRaw(opts.source, picked, env, extra);
  return env;
}
