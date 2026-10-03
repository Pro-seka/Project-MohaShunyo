// Node/Express proxy for NASA APIs: validates input, rate-limits clients,
// caches upstream responses to data/cached/proxy-*.json, serves offline snapshots.
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizePower, normalizeInsight, normalizeImages, buildSimInputs, toCachedFile, BODY } from './normalize.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'data', 'cached');
// The frontend project root (holds data/cached_*.json and assets/images). Default: the parent of nasa-data-layer/.
const OUTPOST = path.resolve(process.env.OUTPOST_DIR || path.join(ROOT, '..'));
const PORT = Number(process.env.PORT || 3001);
const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY'; // <-- set in .env
const OFFLINE = process.env.OFFLINE === '1';
const TTL_MS = Number(process.env.CACHE_TTL_SECONDS || 3600) * 1000;
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 30);

const httpErr = (status, message) => Object.assign(new Error(message), { status });
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);

// ---------- validation ----------
function num(v, min, max, name, dflt) {
  if (v === undefined && dflt !== undefined) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw httpErr(400, `${name} must be a number in [${min}, ${max}]`);
  return n;
}
function parseRange(q, dfltDays = 14) {
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  const end = q.end ?? iso(addDays(new Date(), -7)); // POWER lags real time by a few days
  const start = q.start ?? iso(addDays(new Date(end), -(dfltDays - 1)));
  if (!okDate(start) || !okDate(end)) throw httpErr(400, 'start/end must be YYYY-MM-DD');
  if (start > end) throw httpErr(400, 'start must be <= end');
  if (Date.parse(end) - Date.parse(start) > 366 * 864e5) throw httpErr(400, 'range limited to 366 days');
  return { start, end };
}
const bodyParam = (b) => {
  if (!BODY[b]) throw httpErr(400, 'body must be "moon" or "mars"');
  return b;
};

// ---------- cache + upstream ----------
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').slice(0, 40);

async function cachedJson(name, url) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  // Hash the URL only; the API key travels in a header so it never lands in a cache file.
  const file = path.join(CACHE_DIR, `proxy-${name}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}.json`);
  let stale = null;
  try {
    stale = JSON.parse(await fs.readFile(file, 'utf8'));
    if (OFFLINE) return { data: stale.data, cache: 'OFFLINE' };
    if (Date.now() - stale.fetchedAt < TTL_MS) return { data: stale.data, cache: 'HIT' };
  } catch {
    /* no cache file yet */
  }
  if (OFFLINE) throw httpErr(503, 'OFFLINE=1 and nothing cached for this request. Use /api/sim/moon or /api/sim/mars.');

  try {
    const headers = new URL(url).hostname === 'api.nasa.gov' ? { 'X-Api-Key': API_KEY } : {};
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`NASA responded ${r.status}${r.status === 429 ? ' (rate limit: get a real API key)' : ''}`);
    const data = await r.json();
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ fetchedAt: Date.now(), url, data }));
    await fs.rename(tmp, file);
    return { data, cache: 'MISS' };
  } catch (e) {
    if (stale) return { data: stale.data, cache: 'STALE' }; // upstream down -> serve last good copy
    throw httpErr(502, `Upstream failed: ${e.message}`);
  }
}

const readSnapshot = async (body) => JSON.parse(await fs.readFile(path.join(CACHE_DIR, `${body}.json`), 'utf8'));

// ---------- upstream fetchers ----------
async function fetchPower(lat, lon, { start, end }) {
  const s = start.replaceAll('-', '');
  const e = end.replaceAll('-', '');
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_TOA_SW_DWN,T2M_MAX,T2M_MIN` +
    `&community=RE&longitude=${lon}&latitude=${lat}&start=${s}&end=${e}&format=JSON`;
  const { data, cache } = await cachedJson(`power-${lat}_${lon}_${s}_${e}`, url);
  return { daily: normalizePower(data), raw: data, cache };
}
async function fetchInsight(range) {
  const url = 'https://api.nasa.gov/insight_weather/?feedtype=json&ver=1';
  const { data, cache } = await cachedJson('insight', url);
  return { ...normalizeInsight(data, range), raw: data, cache };
}
async function fetchImages(q) {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=25`;
  const { data, cache } = await cachedJson(`images-${slug(q)}`, url);
  return { images: normalizeImages(data), raw: data, cache };
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  next();
});
app.use('/api', rateLimit({ windowMs: 60_000, limit: RATE, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, slow down.' } }));
// Serve only /data (fetchNasa.js + cached JSON). Never the project root (.env lives there).
app.use('/data', express.static(path.join(ROOT, 'data')));

// Frontend-facing endpoints
//   GET /cached/mars.json -> <outpost>/data/cached_mars.json   (same for moon)
//   GET /images/<file>    -> <outpost>/assets/images/<file>
app.get('/cached/:body.json', (req, res) => {
  if (!BODY[req.params.body]) return res.status(404).json({ error: 'body must be "moon" or "mars"' });
  res.sendFile(path.join(OUTPOST, 'data', `cached_${req.params.body}.json`), (err) => {
    if (err) res.status(404).json({ error: `cached_${req.params.body}.json not found in ${path.join(OUTPOST, 'data')}` });
  });
});
app.use('/images', express.static(path.join(OUTPOST, 'assets', 'images')));
app.use('/assets', express.static(path.join(OUTPOST, 'assets')));

const h = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

app.get('/api/health', (req, res) => res.json({ ok: true, offline: OFFLINE, keyIsDemo: API_KEY === 'DEMO_KEY' }));

app.get('/api/power', h(async (req, res) => {
  const lat = num(req.query.lat, -90, 90, 'lat');
  const lon = num(req.query.lon, -180, 180, 'lon');
  const r = await fetchPower(lat, lon, parseRange(req.query));
  res.set('X-Cache', r.cache).json(req.query.raw ? r.raw : { source: 'nasa-power', cache: r.cache, daily: r.daily });
}));

app.get('/api/mars-weather', h(async (req, res) => {
  if ((req.query.station ?? 'insight') !== 'insight') throw httpErr(400, 'Only station=insight is supported');
  const range = req.query.start || req.query.end ? parseRange(req.query, 7) : null;
  const r = await fetchInsight(range);
  res.set('X-Cache', r.cache).json(req.query.raw ? r.raw : { source: 'nasa-insight', cache: r.cache, rangeMatched: r.rangeMatched, daily: r.daily });
}));

app.get('/api/images', h(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q || q.length > 80) throw httpErr(400, 'q is required (max 80 chars)');
  const r = await fetchImages(q);
  res.set('X-Cache', r.cache).json(req.query.raw ? r.raw : { source: 'nasa-images', cache: r.cache, images: r.images });
}));

// Normalized simEngine inputs. Live if possible, otherwise falls back to the snapshot file.
app.get('/api/sim/:body', h(async (req, res) => {
  const body = bodyParam(req.params.body);
  try {
    if (OFFLINE) throw new Error('offline');
    const lat = num(req.query.lat, -90, 90, 'lat', 0);
    const lon = num(req.query.lon, -180, 180, 'lon', 0);
    const power = await fetchPower(lat, lon, parseRange(req.query));
    let weather = [];
    if (body === 'mars') weather = (await fetchInsight(null).catch(() => ({ daily: [] }))).daily;
    res.json({ source: 'live', simInputs: buildSimInputs(body, { power: power.daily, weather }) });
  } catch {
    const snap = await readSnapshot(body);
    res.json({ source: 'snapshot', simInputs: snap.simInputs, meta: snap.meta });
  }
}));

// Rebuild snapshots from live NASA data (run once with a real key before the demo). Writes:
//   nasa-data-layer/data/raw_<body>.json      raw NASA payloads (input for `npm run normalize`)
//   nasa-data-layer/data/cached/<body>.json   snapshot used by fetchNasa offline mode
//   <outpost>/data/cached_<body>.json         the frontend file (8-field schema)
app.get('/api/snapshot/:body', h(async (req, res) => {
  if (OFFLINE) throw httpErr(409, 'Cannot build snapshots in OFFLINE mode');
  const body = bodyParam(req.params.body);
  const range = parseRange(req.query, 14);
  const ref = { lat: 0, lon: 0 };
  const power = await fetchPower(ref.lat, ref.lon, range);
  let insight = null;
  let weatherDaily = [];
  if (body === 'mars') {
    const w = await fetchInsight(null); // latest sols in the (frozen) InSight feed
    insight = w.raw;
    weatherDaily = w.daily;
  }
  const { images } = await fetchImages(body === 'moon' ? 'moon surface' : 'mars surface');
  const generatedAt = new Date().toISOString();
  const snapshot = {
    meta: { schema: 2, body, origin: 'live', generatedAt, range, note: 'Built from live NASA responses.' },
    simInputs: buildSimInputs(body, { power: power.daily, weather: weatherDaily }),
    power: { reference: ref, daily: power.daily },
    weather: body === 'mars' ? { station: 'insight', daily: weatherDaily } : null,
    images,
  };
  const cached = toCachedFile(body, { power: power.daily, weather: weatherDaily }, { origin: 'live' });
  await fs.writeFile(path.join(ROOT, 'data', `raw_${body}.json`), JSON.stringify({ body, origin: 'live', generatedAt, power: power.raw, insight }, null, 2));
  await fs.writeFile(path.join(CACHE_DIR, `${body}.json`), JSON.stringify(snapshot, null, 2));
  await fs.mkdir(path.join(OUTPOST, 'data'), { recursive: true });
  await fs.writeFile(path.join(OUTPOST, 'data', `cached_${body}.json`), JSON.stringify(cached, null, 2) + '\n');
  res.json({ written: [`data/raw_${body}.json`, `data/cached/${body}.json`, `${OUTPOST}/data/cached_${body}.json`], cached });
}));

app.listen(PORT, () => {
  console.log(`NASA proxy on http://localhost:${PORT}  frontend dir=${OUTPOST}  mode=${OFFLINE ? 'OFFLINE' : 'ONLINE'}  key=${API_KEY === 'DEMO_KEY' ? 'DEMO_KEY (30 req/hr!)' : 'custom'}`);
});
