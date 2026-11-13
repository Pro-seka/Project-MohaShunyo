// data/src/convert/meda_to_json.js
// Option B (server-side): convert MEDA PDS4 CSV products into a canonical JSON snapshot.
//
// MEDA science products are plain ASCII CSV tables (NOT NetCDF), so no netcdfjs is needed.
// Download the products you want from the PDS Atmospheres Node (see README_DATA.md sec. 6),
// then run:
//
//   node data/src/convert/meda_to_json.js \
//        --ps   <...DER_PS...csv>   --wind <...DER_WIND...csv> \
//        --tirs <...DER_TIRS...csv> --ats  <...CAL_ATS...csv>  \
//        --last-hours 24 --out data/cache/meda-latest.json \
//        [--anchor-utc 2021-02-18T20:55:00Z --anchor-sol 0 --anchor-lmst 15.0]
//
//   node data/src/convert/meda_to_json.js --inspect <file.csv>   # print real headers
//
// --anchor-*: only needed if the CSVs carry no UTC column (otherwise `utc` stays null).
// --last-hours N: keep only the last N hourly records (keeps snapshots small).

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./csv.js";
import { buildMedaRecords, MEDA_UNITS } from "./meda_records.js";

function args(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      a[k] = v;
    }
  }
  return a;
}

export async function convertMeda(files, { lastHours = 24, anchor } = {}) {
  const tables = {};
  for (const [k, path] of Object.entries(files)) {
    if (path) tables[k] = parseCsv(await readFile(path, "utf8"));
  }
  let records = buildMedaRecords(tables, { anchor });
  if (lastHours) records = records.slice(-lastHours);
  return {
    source: "meda",
    synthetic: false,
    schema: "meda-hourly-v1",
    generatedBy: "data/src/convert/meda_to_json.js",
    generatedAt: new Date().toISOString(),
    site: { name: "Jezero Crater (Perseverance)", lat: 18.44, lon: 77.45 },
    units: MEDA_UNITS,
    inputFiles: files,
    records,
  };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a.inspect) {
    const t = parseCsv(await readFile(a.inspect, "utf8"));
    console.log("headers:", t.headers);
    console.log("first row:", t.rows[0]);
    return;
  }
  const anchor = a["anchor-utc"]
    ? { utcMs: Date.parse(a["anchor-utc"]), sol: Number(a["anchor-sol"] ?? 0), lmstHours: Number(a["anchor-lmst"] ?? 0) }
    : undefined;
  const snap = await convertMeda(
    { PS: a.ps, WIND: a.wind, TIRS: a.tirs, ATS: a.ats },
    { lastHours: Number(a["last-hours"] ?? 24), anchor }
  );
  const out = a.out || "data/cache/meda-latest.json";
  await writeFile(out, JSON.stringify(snap, null, 2));
  console.log(`wrote ${out} (${snap.records.length} hourly records)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(e); process.exit(1); });
