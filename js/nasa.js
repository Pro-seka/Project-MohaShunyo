/*  Sol 72: NASA data layer (browser side)
 *  ------------------------------------------------------------------
 *  1. Turns the archived snapshot in js/data/nasa-data.js into the object the simulation
 *     engine expects (buildEnv).
 *  2. At start-up tries two LIVE NASA services straight from the browser:
 *       - NASA DONKI   (api.nasa.gov/DONKI/FLR and /SEP): real solar flares of the last 30 days
 *       - NASA POWER   (power.larc.nasa.gov): real sunlight on Earth, for the solar comparison
 *     If a request fails (offline, rate limit, blocked) the game keeps using the archive and
 *     the badge says ARCHIVE. A value is only ever labelled LIVE when the request succeeded.
 *  3. Live DONKI activity changes the game: a stormy Sun raises the chance of a flare in your
 *     mission (flare_rate_scale), a calm Sun lowers it. The archive always uses scale 1.0.
 *
 *  URL options:  ?offline  skip every network call     ?nasa_key=YOURKEY  use your own api.nasa.gov key
 */
(function () {
  'use strict';
  const D = window.SOL72_NASA;
  const ST = window.SOL72_STORMS || { episodes: {} };
  const qs = new URLSearchParams(location.search);
  const KEY = qs.get('nasa_key') || 'DEMO_KEY';
  const listeners = [];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = iso => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

  /* ---------- current status of each data source (shown as badges in the game) ---------- */
  const archiveFlares = D.donki.flares.filter(f => f.date >= '2026-01-01').sort((a, b) => (a.date < b.date ? 1 : -1));
  const state = {
    donki: {
      mode: 'archive', scale: 1,
      latest: archiveFlares[0], strongest: archiveFlares.find(f => f.class === 'X8.3') || archiveFlares[0],
      total: null, m: null, x: null, sep: null, days: null, fetchedAt: null, error: null,
    },
    power: {
      mode: 'archive', error: null,
      avg: D.power.daily.reduce((s, r) => s + r.ghi_kwh_m2_day, 0) / D.power.daily.length,
      from: D.power.daily[0].date, to: D.power.daily[D.power.daily.length - 1].date,
    },
    insight: { mode: 'archive' },     // InSight stopped transmitting in 2022: archive is the only option
  };

  /* ---------- helpers ---------- */
  const rank = c => { const m = /^([ABCMX])(\d+(\.\d+)?)/i.exec(c || ''); return m ? { A: 1, B: 2, C: 3, M: 4, X: 5 }[m[1].toUpperCase()] * 1000 + parseFloat(m[2]) : 0; };
  const iso = d => d.toISOString().slice(0, 10);
  const compact = d => iso(d).replace(/-/g, '');

  async function getJSON(url, ms = 7000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  /** Design rule: calm Sun -> fewer flares in your mission, stormy Sun -> more. 20 M/X flares in 30 days = normal (1.1x). */
  const scaleFromCount = n => Math.min(1.8, Math.max(0.6, 0.6 + n / 40));

  /** Parse a DONKI /FLR response (array of flare records). Exported for the tests. */
  function parseDonki(flr, sep) {
    const list = (Array.isArray(flr) ? flr : []).filter(f => f && f.classType);
    const mx = list.filter(f => /^[MX]/i.test(f.classType));
    const x = list.filter(f => /^X/i.test(f.classType));
    const strongest = list.slice().sort((a, b) => rank(b.classType) - rank(a.classType))[0];
    const latest = list.slice().sort((a, b) => (a.peakTime < b.peakTime ? 1 : -1))[0];
    const conv = f => f && ({ class: f.classType, date: (f.peakTime || f.beginTime || '').slice(0, 10), peak_utc: f.peakTime, region: f.activeRegionNum ? 'AR ' + f.activeRegionNum : null, url: f.link, id: f.flrID });
    return {
      total: list.length, m: mx.length - x.length, x: x.length,
      sep: Array.isArray(sep) ? sep.length : null,
      strongest: conv(strongest), latest: conv(latest), scale: scaleFromCount(mx.length),
    };
  }

  /** Parse a NASA POWER daily response. Exported for the tests. */
  function parsePower(j) {
    const p = j && j.properties && j.properties.parameter && j.properties.parameter.ALLSKY_SFC_SW_DWN;
    if (!p) return null;
    const vals = Object.entries(p).filter(([, v]) => typeof v === 'number' && v > -900);
    if (!vals.length) return null;
    vals.sort();
    return { avg: vals.reduce((s, [, v]) => s + v, 0) / vals.length, from: vals[0][0], to: vals[vals.length - 1][0] };
  }

  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { /* UI errors must not break data */ } }); }

  async function liveDonki() {
    const end = new Date(), start = new Date(end.getTime() - 30 * 864e5);
    const q = `startDate=${iso(start)}&endDate=${iso(end)}&api_key=${encodeURIComponent(KEY)}`;
    const [flr, sep] = await Promise.all([
      getJSON(`https://api.nasa.gov/DONKI/FLR?${q}`),
      getJSON(`https://api.nasa.gov/DONKI/SEP?${q}`).catch(() => null),
    ]);
    const r = parseDonki(flr, sep);
    Object.assign(state.donki, r, { mode: 'live', days: 30, fetchedAt: new Date().toISOString(), error: null });
  }

  async function livePower() {
    const end = new Date(Date.now() - 3 * 864e5), start = new Date(end.getTime() - 13 * 864e5); // POWER lags ~2-3 days
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=0&latitude=0&start=${compact(start)}&end=${compact(end)}&format=JSON`;
    const r = parsePower(await getJSON(url));
    if (!r) throw new Error('no data');
    Object.assign(state.power, { mode: 'live', avg: r.avg, from: r.from, to: r.to, error: null });
  }

  /** Kick off the live requests (non-blocking). The game never waits for them. */
  function init() {
    if (qs.has('offline') || typeof fetch !== 'function') return Promise.resolve(state);
    return Promise.all([
      liveDonki().catch(e => { state.donki.error = String(e && e.message || e); }),
      livePower().catch(e => { state.power.error = String(e && e.message || e); }),
    ]).then(() => { emit(); return state; });
  }

  /* ---------- engine input ---------- */
  const COMMS = D.comms;

  /** Earth-Mars one-way radio time TODAY, in seconds, from JPL's approximate planet positions (js/orbits.js). */
  function marsDelayNowS(date) {
    const O = window.Sol72Orbits;
    return O ? Math.round(O.lightMinutes(date || new Date()) * 60) : null;
  }

  /** The Sun the player picked in the menu (a key of SOL72_STORMS.episodes). Falls back to "today". */
  function episode(id, world) {
    const ep = ST.episodes[id] || ST.episodes.today || { kind: 'today', title: "Today's Sun" };
    if (ep.marsOnly && world === 'moon') return { id: 'today', ...ST.episodes.today };
    return { id: ST.episodes[id] ? id : 'today', ...ep };
  }

  /** Everything the engine needs for one world, built from NASA data. */
  function buildEnv(world, scenarioId) {
    const w = world === 'moon' ? 'moon' : 'mars';
    const ep = episode(scenarioId || 'today', w);
    const swSource = ep.kind === 'today' ? (state.donki.mode === 'live' ? 'DONKI live' : 'DONKI archive') : `DONKI/NOAA archive: ${ep.title}`;
    const live = ep.kind === 'today' && state.donki.mode === 'live';
    const common = {
      location: w,
      real_flares: ep.kind === 'today' ? D.real_flares : null,   // storms replay their own flares; 'random' names none
      sep_lead_h: 4,
      flare_rate_scale: live ? state.donki.scale : 1,
      space_weather: { mode: live ? 'live' : 'archive', scale: live ? state.donki.scale : 1, episode: ep.id },
      scenario: ep.kind === 'storm' ? { id: ep.id, flares: ep.flares }
        : ep.kind === 'dust' ? { id: ep.id, dust: ep.dust } : null,
    };
    const marsNow = marsDelayNowS();
    if (w === 'moon') {
      return Object.assign(common, {
        solar_flux_wm2: D.constants.moon_solar_irradiance_wm2, temp_min_c: D.constants.moon_temp_min_c, temp_max_c: D.constants.moon_temp_max_c, dust_tau: 0,
        signal_delay_s: { min: COMMS.moon_one_way_s, max: COMMS.moon_one_way_s },
        source: `NASA Moon Facts (temperature, solar constant); ${swSource}; radiation: Chang'e-4 LND`,
      });
    }
    const sols = D.insight.sols;
    return Object.assign(common, {
      solar_flux_wm2: D.constants.mars_solar_irradiance_wm2, dust_tau: 0.4,
      temp_min_c: Math.min(...sols.map(s => s.temp_min_c)), temp_max_c: Math.max(...sols.map(s => s.temp_max_c)),
      daily: sols.map(s => ({
        sol: s.sol, date: s.date, season: s.season, temp_min_c: s.temp_min_c, temp_max_c: s.temp_max_c,
        pressure_pa: s.pressure_pa, wind_ms: s.wind_ms, wind_max_ms: s.wind_max_ms,
      })),
      signal_delay_s: { min: COMMS.mars_one_way_min_s, max: COMMS.mars_one_way_max_s, now: marsNow },
      source: `NASA InSight sols ${sols[0].sol}-${sols[sols.length - 1].sol} (archive); ${swSource}; MSL RAD radiation`,
    });
  }

  /** kWh per m2 per day the base's panels would see, vs Earth's equator (NASA POWER). */
  function solarCompare(cfg) {
    const e = cfg && cfg.environment;
    if (!e) return null;
    const here = e.solar_flux_wm2 * Math.exp(-e.dust_tau) * e.daylight_fraction * (2 / Math.PI) * 24 / 1000; // average per 24 h
    return { earth: state.power.avg, here, ratio: here / state.power.avg, mode: state.power.mode, from: state.power.from, to: state.power.to };
  }

  window.Sol72Data = {
    data: D, storms: ST, state, init, buildEnv, episode, marsDelayNowS, solarCompare, parseDonki, parsePower, fmtDate, scaleFromCount,
    onUpdate: fn => listeners.push(fn),
  };
})();
