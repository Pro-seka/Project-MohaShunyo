// data/src/convert/meda_records.js
// Joins the separate MEDA PDS tables (PS, ATS, TIRS, WIND) into hourly records in the
// canonical snapshot schema (README_DATA.md sec. 3):
//   { sol, lmst_hour, utc, PRESSURE [Pa], AIR_TEMP [K], GROUND_TEMP [K], WIND_SPEED [m/s], SW_DOWN_FLUX [W/m2] }
//
// Column names come from columns.js (unverified best guesses; see README_DATA.md sec. 7).
// Any value that is missing, non-numeric or a PDS fill value becomes null.

import { MEDA_COLUMNS as C, pickColumn, pickColumns, parseLmst, solFromDate, SOL_SECONDS } from "./columns.js";

export const MEDA_UNITS = {
  PRESSURE: "Pa",
  AIR_TEMP: "K",
  GROUND_TEMP: "K",
  WIND_SPEED: "m/s",
  SW_DOWN_FLUX: "W/m2",
};

const num = (v) => (typeof v === "number" && Number.isFinite(v) && !C.fillValues.includes(v) ? v : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const round = (x, d) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const isoNoMs = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

/** Which output fields each input table provides, and how to read them. */
const TABLE_FIELDS = {
  PS:   (h) => [{ out: "PRESSURE",     cols: [pickColumn(h, C.pressure)].filter(Boolean) }],
  ATS:  (h) => [{ out: "AIR_TEMP",     cols: pickColumns(h, C.airTemp) }],
  TIRS: (h) => [
    { out: "GROUND_TEMP",  cols: [pickColumn(h, C.groundTemp)].filter(Boolean) },
    { out: "SW_DOWN_FLUX", cols: [pickColumn(h, C.swDown)].filter(Boolean) },
  ],
  WIND: (h) => [{ out: "WIND_SPEED",   cols: [pickColumn(h, C.windSpeed)].filter(Boolean) }],
};

function timeOfRow(row, cols) {
  if (cols.lmst) {
    const t = parseLmst(row[cols.lmst]);
    if (t) return { sol: t.sol, hour: t.hour, utc: cols.utc && typeof row[cols.utc] === "string" ? row[cols.utc] : null };
  }
  if (cols.utc && typeof row[cols.utc] === "string") {
    const d = row[cols.utc];
    const ms = Date.parse(d.endsWith("Z") ? d : d + "Z");
    if (Number.isFinite(ms)) return { sol: solFromDate(new Date(ms).toISOString()), hour: new Date(ms).getUTCHours(), utc: d };
  }
  return null;
}

/**
 * @param {Record<string,{headers:string[],rows:object[]}>} tables  keys: PS, ATS, TIRS, WIND (any subset, at least one)
 * @param {{anchor?:{utcMs:number, sol:number, lmstHours:number}}} [opts]  used to synthesise `utc` when the tables carry none
 * @returns {object[]} hourly records sorted by sol, hour
 */
export function buildMedaRecords(tables, { anchor } = {}) {
  const names = Object.keys(tables || {}).filter((k) => tables[k] && TABLE_FIELDS[k]);
  if (!names.length) throw new Error("buildMedaRecords(): no usable tables (expected PS, ATS, TIRS and/or WIND)");

  const buckets = new Map(); // "sol:hour" -> { sol, hour, utc, acc: { FIELD: number[] } }
  for (const name of names) {
    const { headers, rows } = tables[name];
    const timeCols = {
      lmst: pickColumn(headers, C.time.lmst),
      utc: pickColumn(headers, C.time.utc),
    };
    if (!timeCols.lmst && !timeCols.utc) {
      throw new Error(`MEDA ${name} table has no LMST or UTC column. Headers: ${headers.join(", ")}`);
    }
    const fields = TABLE_FIELDS[name](headers);
    for (const f of fields) {
      if (!f.cols.length) throw new Error(`MEDA ${name} table: no column found for ${f.out}. Headers: ${headers.join(", ")}`);
    }
    for (const row of rows) {
      const t = timeOfRow(row, timeCols);
      if (!t) continue;
      const key = `${t.sol}:${t.hour}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { sol: t.sol, hour: t.hour, utc: null, acc: {} }));
      if (!b.utc && t.utc) b.utc = t.utc;
      for (const f of fields) {
        // ATS: average the detectors in the row first, then average across the hour
        const vals = f.cols.map((c) => num(row[c])).filter((v) => v != null);
        if (!vals.length) continue;
        (b.acc[f.out] ??= []).push(mean(vals));
      }
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.sol - b.sol || a.hour - b.hour)
    .map((b) => {
      let utc = null;
      if (b.utc) utc = b.utc.slice(0, 13) + ":00:00Z";
      else if (anchor) {
        const ms = anchor.utcMs + ((b.sol - anchor.sol) + (b.hour + 0.5 - anchor.lmstHours) / 24) * SOL_SECONDS * 1000;
        utc = isoNoMs(ms);
      }
      const pick = (k, d) => round(mean(b.acc[k] ?? []), d);
      return {
        sol: b.sol,
        lmst_hour: b.hour,
        utc,
        PRESSURE: pick("PRESSURE", 1),
        AIR_TEMP: pick("AIR_TEMP", 2),
        GROUND_TEMP: pick("GROUND_TEMP", 2),
        WIND_SPEED: pick("WIND_SPEED", 2),
        SW_DOWN_FLUX: pick("SW_DOWN_FLUX", 1),
      };
    });
}
