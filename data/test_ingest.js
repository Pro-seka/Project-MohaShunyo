// data/test_ingest.js
// Loads the cached sample snapshots, runs normalize(), prints a sample envData per source,
// and validates every field against expected ranges + provenance rules.
//
//   node data/test_ingest.js                 # offline checks (no network, no server)
//   node data/test_ingest.js --with-server   # also starts the mock server and tests the live path
//                                            # (requires `npm i express`)

import { readFile } from "node:fs/promises";
import { fetchLatest, normalize } from "./src/nasaData.js";

const ENV_KEYS = ["timestamp", "temperature", "pressure", "windSpeed", "dustOpacity", "radiation", "solarIrradiance", "sources"];
const FIELDS = ["temperature", "pressure", "windSpeed", "dustOpacity", "radiation", "solarIrradiance"];
// Expected physical/normalized ranges (inclusive). Deliberately generous; they catch unit mistakes.
const RANGES = {
  temperature: [-140, 35],     // deg C  (Mars surface/near-surface air)
  pressure: [200, 1400],       // Pa
  windSpeed: [0, 60],          // m/s
  dustOpacity: [0, 1],
  radiation: [0.005, 0.2],     // mSv/h (RAD surface baseline ~0.027)
  solarIrradiance: [0, 800],   // W/m2
};

let failures = 0;
const fail = (msg) => { failures++; console.error("  FAIL:", msg); };
const ok = (msg) => console.log("  ok:", msg);

function validate(env, label) {
  console.log(`\nValidating ${label}`);
  const keys = Object.keys(env).filter((k) => k !== "raw" && k !== "forecast");
  if (JSON.stringify(keys.sort()) !== JSON.stringify([...ENV_KEYS].sort())) fail(`unexpected keys: ${keys}`); else ok("envData keys match contract 4.2");
  if (env.timestamp !== null && Number.isNaN(Date.parse(env.timestamp))) fail("timestamp is not ISO");
  for (const f of FIELDS) {
    const v = env[f], s = env.sources?.[f];
    if (!s) { fail(`${f}: no provenance entry`); continue; }
    if (v === null) {
      if (s.dataset !== null) fail(`${f}: null value but provenance claims a dataset`);
      else ok(`${f}: null (documented: ${s.note?.slice(0, 60)}...)`);
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) { fail(`${f}: not a finite number (${v})`); continue; }
    const [lo, hi] = RANGES[f];
    if (v < lo || v > hi) fail(`${f}=${v} outside [${lo}, ${hi}]`); else ok(`${f}=${v} in [${lo}, ${hi}]`);
    for (const k of ["dataset", "url", "field", "proxy"]) if (!(k in s) || s[k] === null || s[k] === undefined) fail(`${f}: provenance missing "${k}"`);
    if (typeof s.proxy !== "boolean") fail(`${f}: proxy must be boolean`);
  }
  if (env.sources.radiation.proxy !== true) fail("radiation must be flagged proxy:true (MEDA has no dose sensor)");
}

const readSample = async (n) => JSON.parse(await readFile(new URL(`./cache/${n}-sample.json`, import.meta.url), "utf8"));

// 1) normalize() directly on the samples -------------------------------------------------
for (const source of ["meda", "mcs"]) {
  const snap = await readSample(source);
  const rec = source === "meda" ? snap.records.at(-1) : snap.daily.at(-1);
  console.log(`\n=== ${source.toUpperCase()} sample (synthetic=${snap.synthetic}) ===`);
  console.log("raw record:", JSON.stringify(rec));
  const env = normalize({ ...rec, synthetic: snap.synthetic === true }, source);
  const { sources, ...values } = env;
  console.log("envData values:", JSON.stringify(values));
  console.log("provenance (field -> dataset | proxy):");
  for (const [k, s] of Object.entries(sources)) console.log(`   ${k.padEnd(16)} ${s.dataset ? s.dataset.slice(0, 70) : "null"} | proxy=${s.proxy}${s.synthetic ? " | SYNTHETIC" : ""}`);
  validate(env, `normalize(${source})`);
}

// 2) every MEDA sample record (incl. null-wind hours) --------------------------------------
{
  const snap = await readSample("meda");
  let nulls = 0;
  snap.records.forEach((r, i) => {
    const env = normalize({ ...r, synthetic: true }, "meda");
    if (env.windSpeed === null) nulls++;
    for (const f of ["temperature", "pressure", "solarIrradiance", "windSpeed"]) {
      const v = env[f]; if (v !== null && (v < RANGES[f][0] || v > RANGES[f][1])) fail(`record ${i} ${f}=${v} out of range`);
    }
  });
  console.log(`\nAll ${snap.records.length} MEDA sample records normalized; ${nulls} have null windSpeed (sensor duty-cycle).`);
  if (nulls === 0) fail("expected some null wind records in the sample");
}

// 3) fetchLatest() offline / fallback ---------------------------------------------------
console.log("\n=== fetchLatest() ===");
for (const source of ["meda", "mcs"]) {
  const env = await fetchLatest({ source, offline: true, includeRaw: true });
  validate(env, `fetchLatest({source:"${source}", offline:true})`);
  if (env.raw?.origin !== "cache" || !Array.isArray(env.raw.fields)) fail("includeRaw did not return raw view"); else ok(`raw view: origin=${env.raw.origin}, ${env.raw.fields.length} field rows, synthetic=${env.raw.synthetic}`);
}
{ // online request that must fail -> automatic cache fallback
  const failingFetch = async () => { throw new Error("network down"); };
  const env = await fetchLatest({ source: "meda", fetchImpl: failingFetch, retries: 0, includeRaw: true });
  validate(env, "fetchLatest with failing network (fallback)");
  if (env.raw.origin !== "cache" || !env.raw.liveError) fail("fallback did not record liveError"); else ok(`fell back to cache; liveError="${env.raw.liveError}"`);
}
{ // forecast beyond the observed series
  const env = await fetchLatest({ source: "mcs", offline: true, date: "2025-08-05", forecastDays: 3 });
  validate(env, "mcs forecast for 2025-08-05");
  if (!env.sources.dustOpacity.note.includes("forecast")) fail("forecast provenance note missing");
  if (env.forecast?.length !== 3) fail("expected 3 forecast days"); else { ok("forecast dust: " + env.forecast.map((f) => f.dustOpacity).join(", ")); env.forecast.forEach((f, i) => validate(f, `forecast day +${i + 1}`)); }
}
{ // backoff on 429 then success
  let calls = 0;
  const flaky = async () => (++calls < 3
    ? { ok: false, status: 429, headers: { get: () => "0" } }
    : { ok: true, status: 200, json: async () => ({ record: { ...(JSON.parse(await readFile(new URL("./cache/meda-sample.json", import.meta.url), "utf8"))).records.at(-1) } }) });
  const env = await fetchLatest({ source: "meda", baseUrl: "http://example.invalid", fetchImpl: flaky, backoffMs: 1, fillDustFromMcs: false, includeRaw: true });
  if (calls !== 3 || env.raw.origin !== "live") fail(`backoff test: calls=${calls}, origin=${env.raw.origin}`); else ok("429 handled with backoff (3 calls), origin=live");
}

// 4) optional: live path against the mock server ------------------------------------------
if (process.argv.includes("--with-server")) {
  const { createApp } = await import("./src/nasaMockServer.js");
  const server = createApp().listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const source of ["meda", "mcs"]) {
      const env = await fetchLatest({ source, baseUrl, includeRaw: true, forecastDays: source === "mcs" ? 2 : 0 });
      validate(env, `live via mock server (${source})`);
      if (env.raw.origin !== "live") fail("expected origin=live");
    }
    const r = await fetch(`${baseUrl}/api/meda/latest`, { headers: { Origin: "null" } });
    if (r.headers.get("access-control-allow-origin") !== "*") fail("CORS header missing"); else ok("CORS header present");
    const b = await r.json();
    if (!b.record || !b.envData) fail("server response shape"); else ok("GET /api/meda/latest -> record + envData");
    const m = await (await fetch(`${baseUrl}/api/mcs/2025-07-15`)).json();
    if (m.record?.date !== "2025-07-15") fail("mcs date lookup"); else ok("GET /api/mcs/2025-07-15 -> observed record for that date");
    const bad = await fetch(`${baseUrl}/api/mcs/not-a-date`);
    if (bad.status !== 400) fail("bad date should be 400"); else ok("bad date -> 400");
  } finally { server.close(); }
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
