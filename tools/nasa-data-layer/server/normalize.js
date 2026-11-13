// Pure functions: raw NASA payloads -> small clean objects -> simEngine inputs.
// No network, no fs. Safe to unit-test.

export const SOLAR_CONSTANT = 1361; // W/m² at 1 AU

// Body constants. These are MODEL ASSUMPTIONS (published approximate figures),
// not live NASA feeds. Edit them here if your sim needs different baselines.
export const BODY = {
  moon: {
    name: 'Moon',
    distScale: 1, // ~1 AU from the Sun
    radiation_mSv_day: 1.37, // ~1.37 mSv/day surface dose (Chang'e-4 LND, approx.)
    tempC: { min: -173, max: 127 }, // equatorial surface extremes (LRO Diviner, approx.)
    dustBase: 0.5, // regolith: always present, no weather-driven variation
  },
  mars: {
    name: 'Mars',
    distScale: 0.4305, // 1 / 1.524² (mean Sun distance)
    radiation_mSv_day: 0.67, // ~0.67 mSv/day surface dose (MSL RAD, approx.)
    tempC: { min: -100, max: -10 }, // fallback if no weather data
    dustBase: 0.4,
  },
};

export const RADIATION_CAP_mSv_day = 2.0; // radiationIndex = dose / cap, clamped 0..1

// InSight reports northern-hemisphere seasons. Global dust season is Ls 180-360,
// i.e. northern autumn and winter.
const SEASON_DUST = { spring: 0.2, summer: 0.3, autumn: 0.6, winter: 0.65 };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round = (x, dp = 2) => (Number.isFinite(x) ? Number(x.toFixed(dp)) : null);
const validNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > -900; // POWER fill value is -999
const mean = (arr) => {
  const a = arr.filter(Number.isFinite);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
};

export const stripHtml = (s = '') =>
  String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const isoFromCompact = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

/** NASA POWER daily/point JSON -> [{date, ghi_kWh_m2_day, ghi_Wm2, toa_Wm2, tMaxC, tMinC}] */
export function normalizePower(raw) {
  const p = raw?.properties?.parameter;
  if (!p?.ALLSKY_SFC_SW_DWN) throw new Error('Unexpected POWER response shape');
  const units = raw.parameters ?? {};
  // RE community returns kWh/m²/day; convert defensively if MJ/m²/day.
  const toKwh = (name, v) => {
    if (!validNum(v)) return null;
    return String(units[name]?.units ?? '').includes('MJ') ? v / 3.6 : v;
  };
  return Object.keys(p.ALLSKY_SFC_SW_DWN)
    .sort()
    .map((d) => {
      const ghi = toKwh('ALLSKY_SFC_SW_DWN', p.ALLSKY_SFC_SW_DWN[d]);
      const toa = toKwh('ALLSKY_TOA_SW_DWN', p.ALLSKY_TOA_SW_DWN?.[d]);
      const tMax = p.T2M_MAX?.[d];
      const tMin = p.T2M_MIN?.[d];
      return {
        date: isoFromCompact(d),
        ghi_kWh_m2_day: round(ghi, 3),
        ghi_Wm2: ghi == null ? null : round((ghi * 1000) / 24),
        toa_Wm2: toa == null ? null : round((toa * 1000) / 24),
        tMaxC: validNum(tMax) ? round(tMax) : null,
        tMinC: validNum(tMin) ? round(tMin) : null,
      };
    });
}

/** InSight feed -> { daily: [...], rangeMatched } . dateRange = {start,end} (ISO dates) or null. */
export function normalizeInsight(raw, dateRange = null) {
  const stat = (o) =>
    o && validNum(o.av) ? { avg: round(o.av), min: round(o.mn), max: round(o.mx), n: o.ct ?? null } : null;
  const all = (raw?.sol_keys ?? [])
    .map((k) => {
      const s = raw[k] ?? {};
      return {
        sol: Number(k),
        date: s.First_UTC ? String(s.First_UTC).slice(0, 10) : null,
        season: s.Season ? String(s.Season).toLowerCase() : null,
        tempC: stat(s.AT),
        pressurePa: stat(s.PRE),
        windMs: stat(s.HWS),
      };
    })
    .filter((r) => r.tempC || r.pressurePa || r.windMs);

  let daily = all;
  let rangeMatched = true;
  if (dateRange?.start && dateRange?.end) {
    const inRange = all.filter((r) => r.date && r.date >= dateRange.start && r.date <= dateRange.end);
    if (inRange.length) daily = inRange;
    else rangeMatched = false; // InSight ended in 2022: usually no overlap. Return what exists, flagged.
  }
  return { daily, rangeMatched };
}

/** Images API search JSON -> curated, display-safe list */
const BLOCK =
  /\b(crash|explosion|accident|disaster|fatal|killed|memorial|funeral|remains|challenger|columbia|apollo 1|fire|injur|weapon|military|nuclear test)\b/i;

export function normalizeImages(raw, limit = 6) {
  const items = raw?.collection?.items ?? [];
  const out = [];
  for (const it of items) {
    const d = it.data?.[0];
    const thumb = it.links?.find((l) => l.render === 'image')?.href ?? it.links?.[0]?.href;
    if (!d || d.media_type !== 'image' || !thumb || !d.nasa_id) continue;
    const text = `${d.title ?? ''} ${d.description ?? ''} ${(d.keywords ?? []).join(' ')}`;
    if (BLOCK.test(text)) continue;
    if (!/^https:\/\//.test(thumb)) continue;
    out.push({
      id: d.nasa_id,
      title: stripHtml(d.title).slice(0, 120),
      description: stripHtml(d.description).slice(0, 240),
      href: thumb.replace('~thumb.', '~medium.'),
      thumb,
      credit: `NASA${d.center ? '/' + d.center : ''}`,
      dateCreated: d.date_created ? String(d.date_created).slice(0, 10) : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The object simEngine consumes (this is the contract; keep names stable).
 *  solarFlux       W/m², peak flux at the body's distance from the Sun (NOT reduced by dust;
 *                  simEngine can apply dustIndex itself)
 *  radiationIndex  0..10 (surface dose in mSv/day / 2 * 10)
 *  dustIndex       0..1
 *  tempRange       {minC, maxC} in degrees Celsius
 */
export function buildSimInputs(bodyKey, { power = [], weather = [] } = {}) {
  const b = BODY[bodyKey];
  if (!b) throw new Error(`Unknown body "${bodyKey}" (use moon or mars)`);

  const recent = weather.slice(-7);
  let dust = b.dustBase;
  let tempRange = { minC: b.tempC.min, maxC: b.tempC.max };
  if (bodyKey === 'mars' && recent.length) {
    const season = [...recent].reverse().find((r) => r.season)?.season;
    if (season in SEASON_DUST) dust = SEASON_DUST[season];
    const mn = mean(recent.map((r) => r.tempC?.min));
    const mx = mean(recent.map((r) => r.tempC?.max));
    if (mn != null && mx != null) tempRange = { minC: round(mn, 1), maxC: round(mx, 1) };
  }

  // POWER is an Earth dataset. For the Moon (also ~1 AU) its top-of-atmosphere insolation
  // tells us how the Sun's strength varies with the date (Earth-Sun distance), so we use it
  // as a small correction. For Mars we use the mean-distance constant.
  let seasonal = 1;
  if (bodyKey === 'moon') {
    const toaMean = mean(power.map((r) => r.toa_Wm2));
    if (toaMean != null) seasonal = clamp(toaMean / (SOLAR_CONSTANT / Math.PI), 0.95, 1.05);
  }

  return {
    body: bodyKey,
    solarFlux: round(SOLAR_CONSTANT * b.distScale * seasonal, 1),
    radiationIndex: round(clamp(b.radiation_mSv_day / RADIATION_CAP_mSv_day, 0, 1) * 10, 1),
    dustIndex: round(clamp(dust, 0, 1)),
    tempRange,
  };
}

// ---------- frontend-facing cached file ----------
export const BACKGROUND_LAYERS = ['assets/images/nebula_layer_01.png', 'assets/images/starfield_tile.png'];
export const CACHED_DEFAULTS = {
  mars: { name: 'mars_demo_2026', image: 'assets/images/surface_mars_1920x1080.jpg' },
  moon: { name: 'moon_demo_2026', image: 'assets/images/surface_moon_1920x1080.jpg' },
};

/** Exactly the 8-field schema the frontend expects. `origin` = 'seed' | 'live' (from the raw file). */
export function toCachedFile(bodyKey, inputs, { origin = 'live' } = {}) {
  const s = buildSimInputs(bodyKey, inputs);
  const d = CACHED_DEFAULTS[bodyKey];
  const source =
    bodyKey === 'mars'
      ? 'source: NASA POWER / InSight - normalized for demo'
      : 'source: NASA POWER (top-of-atmosphere insolation) + published lunar constants - normalized for demo';
  return {
    name: d.name,
    image: d.image,
    background_layers: [...BACKGROUND_LAYERS],
    solarFlux: s.solarFlux,
    radiationIndex: s.radiationIndex,
    dustIndex: s.dustIndex,
    tempRange: s.tempRange,
    notes: origin === 'seed' ? `${source} [SEED VALUES - refresh with npm run snapshot]` : source,
  };
}

/** Shape the engine's data.js expects (scripts/data.js: marsData / moonData). Units: W/m², °C, hours, mSv/h. */
export function toEngineData(bodyKey, inputs, { origin = 'live' } = {}) {
  const s = buildSimInputs(bodyKey, inputs);
  const b = BODY[bodyKey];
  const mars = bodyKey === 'mars';
  const src = mars
    ? 'NASA InSight weather archive (temperature, season) + NASA POWER top-of-atmosphere insolation; dose from published MSL RAD figure'
    : 'NASA POWER top-of-atmosphere insolation + published LRO Diviner temperatures and Chang\'e-4 LND dose';
  return {
    source: origin === 'seed' ? `${src} [SEED VALUES - run npm run snapshot]` : src,
    location: bodyKey,
    solar_flux_wm2: s.solarFlux,
    solar_kwh_m2_day: null, // engine converts this only if solar_flux_wm2 is missing
    temp_min_c: s.tempRange.minC,
    temp_max_c: s.tempRange.maxC,
    // InSight's feed has no optical depth, so tau is MODELLED from the season-based dustIndex:
    // clear sky ~0.3, heavy dust season ~2.0. Moon has no atmosphere.
    dust_tau: mars ? round(0.3 + 1.7 * s.dustIndex, 2) : 0,
    day_length_h: mars ? 24.66 : 708.7, // sol / synodic month
    daylight_fraction: 0.5, // constant: equatorial average, not measured
    background_dose_msv_h: round(b.radiation_mSv_day / 24, 4),
  };
}

/** raw file shape: { body, origin, power: <raw POWER JSON>, insight: <raw InSight JSON|null> } */
export function normalizeRawFile(raw) {
  const body = raw.body;
  const power = normalizePower(raw.power);
  const weather = raw.insight ? normalizeInsight(raw.insight).daily : [];
  return { body, power, weather, cached: toCachedFile(body, { power, weather }, { origin: raw.origin }) };
}

// ---------- CLI: node server/normalize.js data/raw_mars.json [--out ../data/cached_mars.json] ----------
const isMain = typeof process !== 'undefined' && process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (isMain) {
  const fs = await import('node:fs/promises');
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : null;
  const inFile = args.find((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));
  if (!inFile) {
    console.error('usage: node server/normalize.js <raw.json> [--out <file>]');
    process.exit(1);
  }
  const { cached } = normalizeRawFile(JSON.parse(await fs.readFile(inFile, 'utf8')));
  const json = JSON.stringify(cached, null, 2) + '\n';
  if (out) await fs.writeFile(out, json);
  else process.stdout.write(json);
}
