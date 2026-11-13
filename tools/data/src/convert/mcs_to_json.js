// data/src/convert/mcs_to_json.js
// Option B (server-side): reduce MRO/MCS retrieved profiles to one daily record near a site.
//
// INPUT: a FLAT profile CSV, one row per (profile, pressure level), columns defined in
// MCS_FLAT_COLUMNS (convert/columns.js): profile_id, utc, ls, lat, lon, ltst, p_pa, z_km,
// t_k, dust_ext_km1, tsurf_k, pqual.
// The native Level-5 DDR (MRO-M-MCS-5-DDR-V1.0) layout could not be verified in the
// authoring session, so writing DDR -> flat CSV is a documented TODO (README_DATA.md sec. 7).
//
//   node data/src/convert/mcs_to_json.js --in profiles.csv --out data/cache/mcs-latest.json \
//        [--lat 18.44 --lon 77.45 --radius-km 500 --ltst-min 13 --ltst-max 17]
//
// Per profile:
//   lowest valid level = highest-pressure level with valid temperature and pressure
//   T_LOWEST_K, P_LOWEST_PA, Z_LOWEST_KM : values at that level (z above local surface)
//   DUST_COLUMN_IR_TAU = trapezoid integral of dust_ext_km1 over z (lowest level upward)
//        + well-mixed extrapolation from lowest level to the surface:
//          ext(z) = ext_low * p(z)/p_low  =>  ext_low * H * (exp(z_low/H) - 1),
//          H = R*T/g (R = 192 J/kg/K for CO2, g = 3.71 m/s2)
// Daily record = median over the profiles kept for that UTC date.

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./csv.js";
import { MCS_FLAT_COLUMNS as C, pickColumn } from "./columns.js";

const R = 192, G = 3.71;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const rad = (d) => (d * Math.PI) / 180;
function distKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 3389.5 * Math.asin(Math.sqrt(a));
}

export function reduceProfile(levels) {
  const ok = levels.filter((l) => l.p > 0 && l.t > 0 && l.z != null).sort((a, b) => a.z - b.z);
  if (ok.length < 2) return null;
  const low = ok[0];
  const H = (R * low.t / G) / 1000; // km
  let col = 0;
  for (let i = 1; i < ok.length; i++) {
    const a = ok[i - 1], b = ok[i];
    if (a.d == null || b.d == null) continue;
    col += 0.5 * (a.d + b.d) * (b.z - a.z);
  }
  if (low.d != null) col += low.d * H * (Math.exp(Math.max(low.z, 0) / H) - 1);
  return { T: low.t, P: low.p, Z: low.z, tau: col };
}

export async function convertMcs(inPath, { lat = 18.44, lon = 77.45, radiusKm = 500, ltstMin = 13, ltstMax = 17 } = {}) {
  const { headers, rows } = parseCsv(await readFile(inPath, "utf8"));
  const col = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, pickColumn(headers, v)]));
  for (const need of ["profileId", "utc", "ls", "lat", "lon", "pressure", "height", "temperature", "dustExtIr"]) {
    if (!col[need]) throw new Error(`Missing column for "${need}". Headers: ${headers.join(",")}`);
  }
  const profiles = new Map();
  for (const r of rows) {
    const id = r[col.profileId];
    if (!profiles.has(id)) profiles.set(id, { meta: r, levels: [] });
    profiles.get(id).levels.push({ p: r[col.pressure], z: r[col.height], t: r[col.temperature], d: r[col.dustExtIr] });
  }
  const byDate = new Map();
  for (const { meta, levels } of profiles.values()) {
    const km = distKm(lat, lon, meta[col.lat], meta[col.lon]);
    const ltst = col.ltst ? meta[col.ltst] : null;
    if (km > radiusKm) continue;
    if (ltst != null && (ltst < ltstMin || ltst > ltstMax)) continue;
    const red = reduceProfile(levels);
    if (!red) continue;
    const date = String(meta[col.utc]).slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ ...red, km, ls: meta[col.ls], tsurf: col.tsurf ? meta[col.tsurf] : null });
  }
  const daily = [...byDate.entries()].sort().map(([date, ps]) => ({
    date,
    ls: median(ps.map((p) => p.ls)),
    TSURF_K: median(ps.map((p) => p.tsurf).filter((x) => x != null)),
    T_LOWEST_K: median(ps.map((p) => p.T)),
    P_LOWEST_PA: median(ps.map((p) => p.P)),
    Z_LOWEST_KM: median(ps.map((p) => p.Z)),
    DUST_COLUMN_IR_TAU: median(ps.map((p) => p.tau)),
    n_profiles: ps.length,
    nearest_km: Math.min(...ps.map((p) => p.km)),
  }));
  return {
    source: "mcs", synthetic: false, schema: "mcs-site-daily-v1",
    generatedBy: "data/src/convert/mcs_to_json.js", generatedAt: new Date().toISOString(),
    site: { name: "Jezero Crater", lat, lon, radiusKm, ltstWindow: [ltstMin, ltstMax] },
    units: { TSURF_K: "K", T_LOWEST_K: "K", P_LOWEST_PA: "Pa", Z_LOWEST_KM: "km", DUST_COLUMN_IR_TAU: "1 (IR 21.6um column optical depth)" },
    daily,
    climatology: [], // build from multi-year output with make_climatology (see README) or leave empty
  };
}

function args(argv) { const a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; return a; }

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.in) throw new Error("usage: --in profiles.csv --out out.json");
  const snap = await convertMcs(a.in, {
    lat: a.lat ? +a.lat : undefined, lon: a.lon ? +a.lon : undefined, radiusKm: a["radius-km"] ? +a["radius-km"] : undefined,
    ltstMin: a["ltst-min"] ? +a["ltst-min"] : undefined, ltstMax: a["ltst-max"] ? +a["ltst-max"] : undefined,
  });
  const out = a.out || "data/cache/mcs-latest.json";
  await writeFile(out, JSON.stringify(snap, null, 2));
  console.log(`wrote ${out} (${snap.daily.length} daily records)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(e); process.exit(1); });
