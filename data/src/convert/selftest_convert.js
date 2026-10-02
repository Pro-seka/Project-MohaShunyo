// data/src/convert/selftest_convert.js
// Offline logic test for csv.js, meda_records.js and the MCS profile reducer.
//   node data/src/convert/selftest_convert.js
// Uses tiny in-memory fixtures (not NASA data) - it checks the code, not the science.

import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCsv } from "./csv.js";
import { buildMedaRecords } from "./meda_records.js";
import { reduceProfile, convertMcs } from "./mcs_to_json.js";
import { parseLmst } from "./columns.js";

let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log("  ok:", name);
  else { failed++; console.error("  FAIL:", name, extra); }
};
const close = (a, b, eps = 1e-6) => typeof a === "number" && Math.abs(a - b) <= eps;

console.log("csv.js");
{
  const t = parseCsv('\ufeffA, B ,C\r\n1,"x, y",\n"say ""hi""",2.5e1,-3\n\n');
  check("headers trimmed + BOM removed", JSON.stringify(t.headers) === '["A","B","C"]', JSON.stringify(t.headers));
  check("numbers parsed, strings kept, empty -> null", t.rows[0].A === 1 && t.rows[0].B === "x, y" && t.rows[0].C === null);
  check("escaped quotes + exponent + negative", t.rows[1].A === 'say "hi"' && t.rows[1].B === 25 && t.rows[1].C === -3);
  check("blank lines skipped", t.rows.length === 2);
  check("empty input", parseCsv("").rows.length === 0);
  const ml = parseCsv('a,b\n"line1\nline2",7\n');
  check("embedded newline in quotes", ml.rows[0].a === "line1\nline2" && ml.rows[0].b === 7);
}

console.log("meda_records.js");
{
  const ps = parseCsv("LMST,PRESSURE\nSol-1740M14:10:00,720\nSol-1740M14:40:00,722\nSol-1740M15:05:00,-9999\n");
  const ats = parseCsv("LMST,ATS_LOCAL_TEMP1,ATS_LOCAL_TEMP2,ATS_LOCAL_TEMP3\nSol-1740M14:10:00,240,250,260\nSol-1740M15:05:00,230,-9999,236\n");
  const tirs = parseCsv("LMST,GROUND_TEMP,IR3_DOWN_FLUX\nSol-1740M14:10:00,270,310\n");
  const wind = parseCsv("LMST,HORIZONTAL_WIND_SPEED\nSol-1740M15:05:00,6.5\n");
  const recs = buildMedaRecords({ PS: ps, ATS: ats, TIRS: tirs, WIND: wind }, {
    anchor: { utcMs: Date.UTC(2021, 1, 18, 20, 55), sol: 0, lmstHours: 15 },
  });
  check("two hourly records", recs.length === 2, JSON.stringify(recs));
  const r14 = recs[0], r15 = recs[1];
  check("hour 14: pressure averaged", r14.lmst_hour === 14 && close(r14.PRESSURE, 721));
  check("hour 14: ATS1-3 averaged", close(r14.AIR_TEMP, 250));
  check("hour 14: TIRS ground temp + flux", close(r14.GROUND_TEMP, 270) && close(r14.SW_DOWN_FLUX, 310));
  check("hour 14: no wind -> null", r14.WIND_SPEED === null);
  check("hour 15: fill value -> null pressure", r15.PRESSURE === null);
  check("hour 15: ATS ignores fill value", close(r15.AIR_TEMP, 233));
  check("hour 15: wind", close(r15.WIND_SPEED, 6.5));
  check("utc synthesised from anchor, ISO", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(r14.utc ?? ""), String(r14.utc));
  let threw = false;
  try { buildMedaRecords({ PS: parseCsv("FOO,BAR\n1,2\n") }); } catch { threw = true; }
  check("table without time column throws a clear error", threw);
  const noAnchor = buildMedaRecords({ PS: ps });
  check("no anchor + no UTC column -> utc null", noAnchor[0].utc === null);
  const withUtc = buildMedaRecords({ PS: parseCsv("LMST,UTC,PRESSURE\nSol-1740M14:10:00,2026-01-09T15:20:11Z,720\n") });
  check("UTC column is used (floored to the hour)", withUtc[0].utc === "2026-01-09T15:00:00Z", String(withUtc[0].utc));
}

console.log("columns.js");
{
  const t = parseLmst("Sol-1740M14:31:18.123");
  check("parseLmst", t && t.sol === 1740 && t.hour === 14);
  check("parseLmst rejects junk", parseLmst("nope") === null);
}

console.log("mcs_to_json.js");
{
  const red = reduceProfile([
    { p: 570, z: 2.5, t: 215, d: 0.002 },
    { p: 300, z: 10, t: 190, d: 0.001 },
    { p: 100, z: 20, t: 170, d: 0 },
  ]);
  check("reduceProfile returns lowest level + finite column tau", red && red.Z === 2.5 && Number.isFinite(red.tau) && red.tau > 0, JSON.stringify(red));
  check("reduceProfile needs >= 2 valid levels", reduceProfile([{ p: 1, z: 1, t: 200, d: 0 }]) === null);

  const dir = await mkdtemp(join(tmpdir(), "mcs-"));
  try {
    const rows = ["profile_id,utc,ls,lat,lon,ltst,p_pa,z_km,t_k,dust_ext_km1,tsurf_k,pqual"];
    for (const [id, lat, lon] of [[1, 18.5, 77.5], [2, -60, 10]]) { // profile 2 is far from Jezero -> excluded
      rows.push(`${id},2025-06-01T14:00:00Z,100,${lat},${lon},15,570,2.5,215,0.002,259,0`);
      rows.push(`${id},2025-06-01T14:00:00Z,100,${lat},${lon},15,300,10,190,0.001,259,0`);
      rows.push(`${id},2025-06-01T14:00:00Z,100,${lat},${lon},15,100,20,170,0,259,0`);
    }
    const f = join(dir, "profiles.csv");
    await writeFile(f, rows.join("\n"));
    const snap = await convertMcs(f);
    check("convertMcs keeps only profiles near Jezero", snap.daily.length === 1 && snap.daily[0].n_profiles === 1, JSON.stringify(snap.daily));
    check("convertMcs daily record has expected keys", ["date", "ls", "T_LOWEST_K", "P_LOWEST_PA", "Z_LOWEST_KM", "DUST_COLUMN_IR_TAU"].every((k) => k in snap.daily[0]));
    check("convertMcs marks output as not synthetic", snap.synthetic === false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

console.log(failed ? `\n${failed} FAILED` : "\nall converter checks passed");
process.exit(failed ? 1 : 0);
