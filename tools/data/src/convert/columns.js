// data/src/convert/columns.js
//
// !!! VERIFICATION STATUS !!!
// The PDS Atmospheres Node blocks automated fetches (robots.txt), so the exact CSV
// header names of the MEDA products could NOT be confirmed in the authoring session.
// Instrument -> product mapping IS verified (see README_DATA.md sec. 6). The column
// names below are best-effort candidates; each entry is a list tried in order
// (strings = exact header, RegExp = pattern). If a real file uses different headers,
// fix ONLY this file -- run `node data/src/convert/meda_to_json.js --inspect <file.csv>`
// to print the real headers.

export const MEDA_FILE_TAGS = {
  // substring/regex found in the PDS file name of each product
  PS:   { dir: "derived",    tag: /DER_PS/i },
  WIND: { dir: "derived",    tag: /DER_WIND/i },
  TIRS: { dir: "derived",    tag: /DER_TIRS/i },
  ATS:  { dir: "calibrated", tag: /CAL_ATS/i },
};

export const MEDA_COLUMNS = {
  time: {
    lmst: ["LMST"],
    ltst: ["LTST"],
    sclk: ["SCLK"],
    utc: ["UTC", "UTC_TIME", "TIME_UTC"],
  },
  // Derived pressure product (PS): pressure in Pa
  pressure: ["PRESSURE", "PRESSURE_PA", /^PRESS/i],
  // Calibrated air-temperature sensor (ATS): several detectors; ATS1-3 are averaged
  // (ATS4/5 sit on the rover body and are excluded, following the MEDA team's usage).
  airTemp: [/^ATS_?LOCAL_?TEMP_?[123]$/i, /^ATS_?TEMP_?[123]$/i, /^TEMP_?[123]$/i],
  // Derived TIRS: ground temperature (K)
  groundTemp: ["GROUND_TEMP", "GROUND_TEMPERATURE", /^GROUND.*TEMP/i],
  // Upward-looking TIRS IR3 channel (0.3-3 um), downwelling short-wave flux, W/m2
  swDown: [/IR3.*(FLUX|IRRAD)/i, /(SW|SHORT).*DOWN/i, /DOWN.*(SW|SHORT)/i],
  // Derived wind: horizontal wind speed, m/s
  windSpeed: ["HORIZONTAL_WIND_SPEED", "WIND_SPEED", /HORIZ.*WIND.*SPEED/i],
  // Fill/sentinel values found in PDS tables -> treated as null
  fillValues: [-9999, -999, 1e30, 9999],
};

// MCS: the converter reads a FLAT profile CSV (one row per profile level) -- see
// mcs_to_json.js header. Native DDR layout is NOT parsed (unverified, see README).
export const MCS_FLAT_COLUMNS = {
  profileId: ["profile_id", "PROFILE_ID"],
  utc: ["utc", "UTC"],
  ls: ["ls", "LS", "Ls"],
  lat: ["lat", "LAT"],
  lon: ["lon", "LON"],
  ltst: ["ltst", "LTST"],
  pressure: ["p_pa", "PRESSURE_PA"],          // Pa
  height: ["z_km", "HEIGHT_KM"],              // km above local surface
  temperature: ["t_k", "TEMPERATURE_K"],      // K
  dustExtIr: ["dust_ext_km1", "DUST_KM1"],    // IR (21.6 um / 463 cm-1) extinction, 1/km
  tsurf: ["tsurf_k", "TSURF_K"],              // K
  pqual: ["pqual", "PQUAL"],                  // 0 = retrieved pressure, 9 = climatological
};

/** First header (from `headers`) matching any candidate; returns header name or null. */
export function pickColumn(headers, candidates) {
  for (const c of candidates) {
    if (typeof c === "string") {
      const hit = headers.find((h) => h === c);
      if (hit) return hit;
    }
  }
  for (const c of candidates) {
    if (c instanceof RegExp) {
      const hit = headers.find((h) => c.test(h));
      if (hit) return hit;
    }
  }
  return null;
}

/** All headers matching a candidate list (used to average ATS1-3). */
export function pickColumns(headers, candidates) {
  const out = new Set();
  for (const c of candidates) {
    for (const h of headers) {
      if ((typeof c === "string" && h === c) || (c instanceof RegExp && c.test(h))) out.add(h);
    }
  }
  return [...out];
}

/** Parse "Sol-1740M14:31:18.123" or "1740M14:31:18" -> {sol, hour, seconds} or null. */
export function parseLmst(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/(?:Sol-?)?(\d+)M(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  if (!m) return null;
  const hour = +m[2];
  return { sol: +m[1], hour, seconds: hour * 3600 + +m[3] * 60 + parseFloat(m[4]) };
}

export const SOL_SECONDS = 88775.244;
/** Mars 2020 touchdown, 2021-02-18 ~20:55 UTC (sol 0). Used only for approximate date<->sol. */
export const MARS2020_LANDING_MS = Date.UTC(2021, 1, 18, 20, 55, 0);
export const solFromDate = (isoDate) =>
  Math.floor((Date.parse(isoDate + (isoDate.length <= 10 ? "T12:00:00Z" : "")) - MARS2020_LANDING_MS) / (SOL_SECONDS * 1000));
