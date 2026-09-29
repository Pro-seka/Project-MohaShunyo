# README_DATA — NASA data pipeline for the Mars outpost game

Owner: Ridwan. Everything here lives in `/data/`. Output contract (`envData`) is defined in the shared prompt, sec. 4.

## 0. READ FIRST — what is real and what is not

| Item | Status |
|---|---|
| `data/cache/meda-sample.json`, `data/cache/mcs-sample.json` | **SYNTHETIC** (`"synthetic": true`). Schema-compatible placeholders with plausible magnitudes. **Not NASA measurements.** Real files could not be downloaded when this was authored (PDS Atmospheres blocks automated fetches via robots.txt, and the build sandbox could not reach NASA hosts). |
| `envData.sources[field].synthetic` | Set to `true` on every field derived from a synthetic snapshot, so the UI can show a warning. |
| Instrument → `envData` field mapping | **Verified** against NASA/PDS pages (sec. 6). |
| MEDA CSV **column names** (`convert/columns.js`) | **Unverified best guesses.** Fix that one file after you open a real CSV (`--inspect`, sec. 7). |
| Native MCS DDR parsing | **Not implemented.** The converter reads a flat profile CSV (sec. 7). |
| Direct-PDS live fetch (`livePdsMeda`) | Logic tested against a fake server only. File naming on the real server is unverified. It falls back to cache on any failure. |
| Radiation | **Proxy** (MSL/RAD constant baseline). MEDA has no ionizing-radiation dose sensor. |
| MEDA `dustOpacity` | **Null** from MEDA data (no derived dust product). Optionally filled from MRO/MCS and flagged `proxy: true`. |

Nothing here presents synthetic or proxy data as measured NASA data: every field carries provenance, `proxy`, and (where relevant) `synthetic` flags.

## 1. Quick start

```bash
# Node >= 18. Root package.json must contain "type": "module".
node data/test_ingest.js                 # offline checks, prints envData per source
npm i express                            # only needed for the mock server
node data/test_ingest.js --with-server   # + live-path test against the mock server
node data/src/nasaMockServer.js          # http://localhost:8787
node data/src/convert/selftest_convert.js  # converter / PDS-path logic test
```

```js
import { fetchLatest } from "./data/src/nasaData.js";

const env  = await fetchLatest({ source: "meda" });                   // live if possible, else cache
const off  = await fetchLatest({ source: "mcs", offline: true });     // cache only
const both = await fetchLatest({ source: "meda", includeRaw: true }); // adds env.raw for the UI toggle
const fc   = await fetchLatest({ source: "mcs", forecastDays: 7 });   // adds env.forecast[] (7 envData objects)
```

Options: `{ source: "meda"|"mcs", offline, date: "YYYY-MM-DD", includeRaw, forecastDays, baseUrl, sol, fillDustFromMcs (default true), cacheBaseUrl, fetchImpl, retries, backoffMs }`.

Assumptions (one line each, per spec sec. 8):
- `envData` is returned exactly as in contract 4.2. Extra keys appear **only when requested**: `raw` (with `includeRaw`) and `forecast` (with `forecastDays`, MCS).
- With no `date`, "latest" = last record in the snapshot.
- From a `file://` page the browser cannot `fetch` local JSON; pass `baseUrl: "http://localhost:8787"` (mock server, CORS enabled).

### `raw` view (for Aritro's "raw vs simplified" toggle)
`env.raw = { source, origin: "live"|"cache", originUrl, snapshotFile, synthetic, syntheticNotice, liveError, units, record, fields[] }`
where `fields[] = { envField, rawField, rawValue, rawUnit, value }` shows original value and unit next to the simplified one, and `record` is the full raw record.

## 2. Ingestion options

- **Option A (quick).** `fetch()` in browser or Node with retries/backoff (429/5xx, honors `Retry-After`, exponential + jitter, 15 s timeout).
  - `baseUrl` set → JSON API (`/api/meda/latest`, `/api/mcs/:date`), e.g. the mock server or any compatible service.
  - `source: "meda"` without `baseUrl` → best-effort read of PDS Atmospheres directory listings + CSVs (`data_derived_env/`, `data_calibrated_env/`). Note: the NASA Open Data Portal (data.nasa.gov) entries for these datasets are metadata-only ("This dataset has no data"), so they cannot serve values.
  - MCS has no per-request live path (DDR profiles are too large); use the converter or `baseUrl`.
  - Any failure → automatic fallback to `data/cache/` (`raw.liveError` records why).
- **Option B (accurate).** Server-side Node converters write canonical JSON into `data/cache/`:
  - `convert/meda_to_json.js` — MEDA PDS4 **CSV** tables → hourly records. (MEDA products are ASCII CSV, so no NetCDF library is needed.)
  - `convert/mcs_to_json.js` — flat MCS profile CSV → daily record near Jezero.
  - Cache lookup order: `<source>-latest.json` (converter output) then `<source>-sample.json`.

## 3. Canonical snapshot schema (original units; input to `normalize()`)

MEDA record: `{ sol, lmst_hour, utc, PRESSURE [Pa], AIR_TEMP [K], GROUND_TEMP [K], WIND_SPEED [m/s], SW_DOWN_FLUX [W/m²] }` (any value may be `null`).

MCS daily record: `{ date, ls, TSURF_K [K], T_LOWEST_K [K], P_LOWEST_PA [Pa], Z_LOWEST_KM [km above surface], DUST_COLUMN_IR_TAU [IR 21.6 µm column optical depth], n_profiles, nearest_km }` plus a top-level `climatology[]` (10° Ls bins).

## 4. Field mapping and formulas

Constants: `K0 = 273.15`, `R_CO2 = 192 J/kg/K`, `g = 3.71 m/s²`, `τ_IR→vis = 4.4`, **`TAU_MAX = 5`**, RAD baseline = 0.21 mGy/day absorbed, 0.64 mSv/day equivalent (Q = 0.64/0.21 ≈ 3.05).

| envData field | Source | Raw NASA field (unit) | Formula | Worked example |
|---|---|---|---|---|
| `temperature` (°C) | MEDA | ATS air temperature, mean of ATS1–3 (K) — calibrated collection | `T − 273.15` | 210.15 K → **−63.0 °C** |
| `temperature` | MCS (**proxy**) | temperature at lowest valid retrieved level (K) | `T − 273.15` | 215 K → **−58.1 °C** (−58.15 rounds down in floating point) |
| `pressure` (Pa) | MEDA | PS pressure (Pa) — derived collection | identity | 720.4 Pa → **720.4** |
| `pressure` | MCS (**proxy**) | pressure `p` (Pa) and height `z` (km) of lowest valid level | `H = R·T/g`; `p_surf = p·exp(z/H)` | p=576 Pa, z=2.5 km, T=215 K → H=11.13 km, ×1.2519 → **721.1 Pa** |
| `windSpeed` (m/s) | MEDA | WIND horizontal wind speed (m/s) — derived collection | identity; **null** if absent | 6.5 m/s → **6.5**; sensor off → **null** |
| `windSpeed` | MCS | — (not measured) | — | **null** |
| `dustOpacity` (0..1) | MCS | dust extinction at 21.6 µm (km⁻¹) integrated to column τ_IR | `τ_vis = 4.4·τ_IR`; `clamp(τ_vis / 5, 0, 1)` | τ_IR=0.2 → τ_vis=0.88 → **0.176**; τ_IR=1.5 → τ_vis=6.6 → **1.0** (clipped) |
| `dustOpacity` | MEDA | — (no derived dust product) | **null**, or MCS value flagged `proxy: true` when `fillDustFromMcs` | — |
| `radiation` (mSv/h) | both (**proxy**) | MSL/RAD dose rate, original unit **µGy/day** (absorbed) or mSv/day (equivalent) | `µGy/day × Q / 1000 / 24`; `mSv/day / 24` | 210 µGy/day × 3.05 = 0.640 mSv/day → **0.0267 mSv/h**; 0.64 mSv/day → **0.0267** |
| `solarIrradiance` (W/m²) | MEDA | TIRS up-looking IR3 channel, 0.3–3 µm downwelling flux (W/m²) | identity; **null** if absent | 310 W/m² → **310** |
| `solarIrradiance` | MCS | — (not measured) | — | **null** |

### Dust normalization: `clamp(τ / τmax, 0, 1)`, `τmax = 5`
- The raw quantity is a **column optical depth τ** (dimensionless). MCS retrieves **IR** extinction; Kleinböhl et al. (2009) note visible (~600 nm) opacity is about 4.4× the retrieved IR opacity, hence `τ_vis = 4.4·τ_IR`.
- **Why 5:** direct-beam transmission at zenith is `e^(−τ)`; at τ = 5 only ≈0.7 % of direct sunlight reaches the ground, i.e. a "heavy storm" for solar power and visibility. For scale, the 2018 global storm peaked at τ ≈ 8.5 at Curiosity and ≈ 11 at Opportunity, so a linear map to 8.5 would squash ordinary storms into 0.3–0.6. `τmax` is a game-design constant (single line in `nasaData.js`); raw τ is always preserved in `raw`.

### Multi-day MCS forecast (synthesized, not measured)
MCS is an orbital sounder, not a forecast product. For a `date` after the last observation (`k` days):
`x(k) = clim(Ls_k) + (x_last − clim(Ls_last)) · exp(−k/τx)` with `τx` = 5 d (dust), 3 d (pressure), 2 d (temperature); `Ls_k = Ls_last + k · 0.5384 · 1.0275` (mean advance; ignores orbital eccentricity, error of a few degrees). Persistence of the current anomaly decays to the seasonal climatology. Dates before the series use pure climatology. Results are labelled `mode: "forecast" | "climatology"` in `sources[…].note`. "Daily" MCS values use dayside profiles (~15 LTST) within 500 km of Jezero (18.44° N, 77.45° E).

## 5. Caching, server, keys

- `data/cache/*-latest.json` (converter output) overrides `*-sample.json`. Commit samples; don't commit real bulk downloads.
- **Mock server:** `node data/src/nasaMockServer.js [--port 8787]` serves `GET /api/meda/latest[?date=]` and `GET /api/mcs/:date` (`latest` or `YYYY-MM-DD`, `?forecastDays=N` up to 30) from cache with `Access-Control-Allow-Origin: *`. Response: `{ source, record, units, envData, forecast?, synthetic, snapshotFile }`.
- **API key:** none of the default paths use `api.nasa.gov`. If you add an `api.nasa.gov` endpoint: get a free key at https://api.nasa.gov, put `NASA_API_KEY=...` in a git-ignored `.env`, and run `node --env-file=.env …`. `fetchWithBackoff` appends it for that host only and never logs it. `DEMO_KEY` is heavily rate-limited (429 → backoff). `data/.gitignore` ignores `.env`; also add `.env` to the repo root `.gitignore`.

## 6. Source list (URLs and exact fields)

**MEDA (Mars 2020 Perseverance, Jezero) — PDS Atmospheres Node**
- Instrument page: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html — verified: sensors WS, ATS, TIRS, HS, RDS, PS; calibrated products ATS/ENG/PS/RDS/RHS/TIRS/WIND; **derived products PS, RHS, TIRS, WIND, ANCILLARY only**.
- Bundle `urn:nasa:pds:mars2020_meda::6.0` (DOI 10.17189/1522849); collections `data_calibrated_env`, `data_derived_env::3.0`: https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/ (CSV tables).
- Fields used: `PS` pressure (Pa, derived); `ATS` air temperature ATS1–3 (K, calibrated); `WIND` horizontal wind speed (m/s, derived); `TIRS` IR3 up-looking short-wave flux (W/m², calibrated). Catalog: https://nssdc.gsfc.nasa.gov/nmc/dataset/display.action?id=PSPA-00986
- SIS for calibrated/derived RDR: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/logs/MEDA_RDR_SIS_issue1.docx — **read it to confirm column names** (sec. 7).
- Currency: PDS Geosciences Mars 2020 page lists Release 16 (sols 1740–1859, 10 Jan–13 May 2026), released Aug 2026: https://pds-geosciences.wustl.edu/missions/mars2020/. "Latest" MEDA data therefore lags real time by months.
- Wind caveats (verified in published abstracts): wind sensor runs only 15 min every 2 h, was reactivated on sol 345 with reduced capability with further failures since (https://ui.adsabs.harvard.edu/abs/2025epsc.conf.1461M/abstract); derived wind was public up to sol 315 in an earlier paper (https://arxiv.org/pdf/2410.19132). Expect many null winds.
- TIRS/RDS dust accumulation requires correction factors (same ADS abstract), so short-wave flux may read low.

**MRO Mars Climate Sounder**
- Listing you supplied: https://data.nasa.gov/dataset/mro-mars-climate-sounder-level-2-edr-v1-0-9ae69 — **this is the raw EDR (digital counts), metadata-only ("no data")**. It is *not* usable for temperature/dust. The retrieved profiles are in **Level 5 DDR** `MRO-M-MCS-5-DDR-V1.0`: https://nssdc.gsfc.nasa.gov/nmc/dataset/display.action?id=PSPA-00592
- Archive: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/Mars/Mars.html — data through 31 Jul 2025 (`mrom_2227`) at time of writing.
- Fields used: retrieved temperature (K) and pressure on the retrieval grid, dust extinction 21.6 µm (km⁻¹) → column τ_IR (integrated by `mcs_to_json.js`), height above surface. DDR quality flag `pqual` (0 retrieved pressure, 9 climatological).
- Method: Kleinböhl et al. 2009, https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2009JE003358 (IR→visible factor ≈ 4.4).

**Radiation proxy:** Hassler et al. 2014, *Science* 343:1244797, https://doi.org/10.1126/science.1244797 — 0.21 ± 0.04 mGy/day, 0.64 ± 0.12 mSv/day at Gale Crater (first ~300 sols). Later years read higher (~0.30–0.35 mGy/day near solar minimum); for live RAD values use the MSL RAD dataset at the PDS Geosciences Node (not integrated).

**Dust scale reference:** https://ntrs.nasa.gov/api/citations/20190001691/downloads/20190001691.pdf (τ peak 8.5 at Curiosity, 2018).

## 7. Known gaps / how to finish Option B on real data

1. **MEDA column names.** Download one file per product (index CSVs are linked from the instrument page), run
   `node data/src/convert/meda_to_json.js --inspect path/to/file.csv`, and edit `MEDA_COLUMNS` / `MEDA_FILE_TAGS` in `convert/columns.js`. Then:
   ```bash
   node data/src/convert/meda_to_json.js --ps DER_PS.csv --ats CAL_ATS.csv --tirs DER_TIRS.csv --wind DER_WIND.csv \
        --last-hours 24 --out data/cache/meda-latest.json
   ```
   If the tables have no UTC column, pass `--anchor-utc/--anchor-sol/--anchor-lmst`; otherwise `utc` stays null (timestamp null in envData). The live PDS path approximates UTC from sol + LMST (landing at ~15 h LMST assumed, ±1 h) and marks `utc_approx: true`.
2. **MCS DDR → flat CSV.** Write (Node or Python) a step that expands DDR profile files into `profile_id,utc,ls,lat,lon,ltst,p_pa,z_km,t_k,dust_ext_km1,tsurf_k,pqual`, then run `mcs_to_json.js --in profiles.csv --out data/cache/mcs-latest.json`. Build `climatology[]` from ≥1 Mars year of daily output (10° Ls bins, same keys as the sample) or leave empty (forecast then falls back to persistence).
3. **Replace synthetic samples**, or delete the `*-sample.json` files once `*-latest.json` exist. `node data/src/convert/make_synthetic_samples.js` regenerates the placeholders.
4. MCS `temperature`/`pressure` are proxies (orbital, dayside, above-surface + extrapolation); MEDA is preferred whenever available.

## 8. Files

```
data/
  src/nasaData.js            fetchLatest(), normalize()  (only two exports)
  src/nasaMockServer.js      Express server (CORS)
  src/convert/csv.js         zero-dependency CSV parser
  src/convert/columns.js     column candidates, file tags, LMST/sol helpers   <- edit after inspecting real files
  src/convert/meda_records.js  join MEDA tables -> hourly records (shared by converter + live path)
  src/convert/meda_to_json.js  Option B converter (MEDA)
  src/convert/mcs_to_json.js   Option B converter (MCS)
  src/convert/make_synthetic_samples.js  deterministic synthetic placeholders
  src/convert/selftest_convert.js  converter + PDS-path logic test (fake files)
  cache/meda-sample.json, cache/mcs-sample.json   SYNTHETIC
  test_ingest.js, README_DATA.md, .gitignore
```
