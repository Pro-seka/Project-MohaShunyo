(function (root) {
'use strict';
/**
 * engine.js — Sol 72 outpost simulation engine (1 step = 1 simulated hour)
 * =============================================================================
 *
 * README
 * ------
 * WHAT IT IS
 *   A small, deterministic, hour-by-hour model of a 4-person outpost. The player
 *   picks actions; the engine turns them into resource rates, rolls random
 *   external events from a seeded RNG, and integrates everything one hour at a time.
 *
 * API  (ES module, browser side)
 *   init(seed, config)     start / restart. config = { location, data, tuning, initial }
 *   step()                 advance 1 hour -> { state, events }
 *   applyAction(actionId)  player choice  -> { ok, message, state }
 *   getState()             deep-copied snapshot of the current state
 *   subscribe(type, fn)    'step' | 'event' | 'alert' | 'action' | 'gameover' | '*'
 *                          returns an unsubscribe function. fn(payload, type)
 *   applyEffects(effects, label)  one-off decision card (+/- % points; radiation = % of dose limit)
 *   debugTriggerEvent(type, severity, opts)  force a flare/strike/storm (demo keys; replayable)
 *   listActions()          action ids + labels + on/off + disabled reason (for buttons)
 *   getConfig()            effective tuning + environment numbers (for a debug panel)
 *   getReplayLog()/replay()  reproduce a run exactly (seed + action history)
 *
 * UNITS & SCALE
 *   Time  : 1 step = 1 hour.   Energy: kWh (1 kW for 1 h = 1 kWh).
 *   The seven core variables (fuel, power, oxygen, food, crew_morale, shielding,
 *   habitat_health) are all 0–100 %. "power" is battery state of charge.
 *   Physical capacities (battery_kwh, o2_capacity_kg, ...) convert kWh/kg -> %.
 *   Extra tracked values: radiation_dose (mSv), panel_integrity, panel_dust.
 *
 * MODEL ASSUMPTIONS (all simplified on purpose)
 *   1. Solar is the only primary power. Output = area * efficiency * flux
 *      * daylight * exp(-dust optical depth) * (1 - dust on panels) * integrity.
 *   2. Fuel feeds a backup generator (electrical kW) and the rover. It does NOT
 *      power anything unless the player turns the generator / rover on.
 *   3. Life support recycles most oxygen. Eco mode uses less power but recycles less.
 *   4. Radiation = background + solar-flare dose, reduced by shielding and shelter.
 *   5. Morale relaxes toward a target set by comfort and danger factors.
 *   6. Empty battery with not enough supply = blackout: life support and heating stop.
 *
 * RANDOM EVENTS (seeded, so judges can replay a scenario)
 *   Exactly 9 RNG draws are consumed every step whatever happens, so the event
 *   timeline depends only on the seed, not on player actions. Same seed -> same
 *   flares / strikes / storms at the same hours. Probability per hour:
 *       p = 1 - exp(-rate_per_hour * event_scale)
 *   Base rates (per hour, in PRESETS below) are order-of-magnitude real-world
 *   values: ~3-4 significant solar particle events / year, a few damaging
 *   strikes / year (more on the Moon: no atmosphere), ~2-3 regional Mars dust
 *   storms / year. `event_scale` (default 8) speeds them up so a 30-day game is
 *   not boring (≈2 flares, ≈2 Moon strikes, ≈1-2 Mars storms per month).
 *   Set it to 1 for "real" odds.
 *   Severity (same for each type): 60 % minor, 30 % moderate, 10 % severe.
 *
 * DATA SEEDING (Team C)
 *   config.data may contain any of these (all optional, numbers only):
 *     solar_flux_wm2       peak irradiance at top of the sunlit cycle, W/m^2
 *     solar_kwh_m2_day     NASA POWER daily mean (ALLSKY_SFC_SW_DWN), converted to a peak
 *     temp_min_c, temp_max_c  (InSight TWINS / REMS style), or temp_mean_c + temp_amp_c
 *     dust_tau             atmospheric optical depth (InSight opacity), 0 for Moon
 *     day_length_h, daylight_fraction, background_dose_msv_h, source (string)
 *   Missing fields fall back to the location preset ('mars' or 'moon').
 *
 * WHERE TO BALANCE  (search for the names below)
 *   TUNING          every global number: capacities, loads, rates, morale weights
 *   PRESETS         per-location solar/temperature/dose + event probabilities
 *   EVENT_TYPES     severity tables (durations, dose, damage, morale hit)
 *   ACTIONS         what each player action does
 *   computeRates()  the line-by-line formulas (section numbers 1–8 in comments)
 */

/*  SOL 72 UPGRADES (on top of the original MohaShunyo engine)
 *  ----------------------------------------------------------
 *  1. FLARE WARNING WINDOW (NASA DONKI). A DONKI flare record is followed hours later by a
 *     linked SEP (particle) record. The 18 Jan 2026 X1.9 flare peaked 18:09 UTC; particles were
 *     first seen 22:33 UTC (~4.4 h). So a flare now has two phases: 'start' (spotted, no dose
 *     yet, `tuning.sep_lead_h` = 4 h) and 'arrive' (surge + dose clock). That window is where
 *     the player must decide: shelter early (costs morale), spend power on shielding, or gamble.
 *  2. REAL FLARES REPLAYED. config.data.real_flares = { minor:[..], moderate:[..], severe:[..] }
 *     (real DONKI/SDO flares). Which one is replayed is chosen by seeded RNG draw r[8].
 *     The mSv numbers are game-scaled; the flare class/date shown to the player are real.
 *  3. REAL PER-SOL WEATHER. config.data.daily = [{sol,date,season,temp_min_c,temp_max_c,
 *     pressure_pa,wind_ms}] (NASA InSight TWINS). Mission day N uses row N, so every day is a
 *     different real Martian day. Pressure and wind are shown, temperature drives the heater.
 *  4. SIGNAL DELAY. config.data.signal_delay_s = {min,max} is carried into the environment for
 *     the UI (Moon ~1.3 s, Mars ~3-22 min one way). Display only.
 *  5. LIVE SPACE WEATHER. config.data.flare_rate_scale scales the flare chance (set from live
 *     DONKI counts when the browser could reach NASA; 1.0 when using the archived snapshot).
 *  RNG draws per hour are now 9 (was 8): same seed gives a new timeline versus the old engine.
 */

/* ---------------- state shape, variable metadata, win/lose rules (was gameState.js) ---------------- */
/** The seven core variables, in display order. */
const CORE_KEYS = [
  'fuel', 'power', 'oxygen', 'food', 'crew_morale', 'shielding', 'habitat_health',
];

/** UI metadata. `warn` / `crit` are the thresholds that raise 'alert' events. */
const VARIABLES = {
  fuel:           { label: 'Fuel',            unit: '%', warn: 25, crit: 10 },
  power:          { label: 'Power (battery)', unit: '%', warn: 25, crit: 10 },
  oxygen:         { label: 'Oxygen',          unit: '%', warn: 30, crit: 15 },
  food:           { label: 'Food',            unit: '%', warn: 25, crit: 10 },
  crew_morale:    { label: 'Crew morale',     unit: '%', warn: 35, crit: 15 },
  shielding:      { label: 'Shielding',       unit: '%', warn: 20, crit: 10 },
  habitat_health: { label: 'Habitat health',  unit: '%', warn: 50, crit: 25 },
};

/** Starting values (override with config.initial in init()). */
const INITIAL_VALUES = {
  fuel: 100, power: 90, oxygen: 100, food: 100,
  crew_morale: 75, shielding: 30, habitat_health: 100,
};

/** Clamp v into [lo, hi]. */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Build a fresh state object. */
function createInitialState({ seed, location, tuning, initial = {} }) {
  return {
    hour: 0,                       // completed simulated hours
    seed,
    location,
    mission_hours: tuning.mission_hours || 0,   // 0 = endless; UI can show hour / mission_hours

    // --- core variables (0–100 %) ---
    ...INITIAL_VALUES,
    ...initial,

    // --- extra tracked values ---
    radiation_dose: 0,             // cumulative crew dose, mSv
    science: 0,                    // research collected, 0-100 % of the mission goal (rover trips in daylight)
    flare_count: 0,                // flares met so far (for the guaranteed-flare rule)
    panel_integrity: 1.0,          // 0–1, fraction of solar array still working
    panel_dust: 0.0,               // 0–1, fraction of sunlight blocked by dust on panels
    shield_panels_left: tuning.shield_panel_count,

    // --- player-selected operating modes (set via applyAction) ---
    modes: {
      life_support: 'normal',      // 'normal' | 'eco'
      rover: false,
      grow: false,                 // greenhouse lamps on (food production)
      generator: false,
      repair: false,
      ration: false,
      shelter: false,
    },

    // --- filled in by the engine each step ---
    rates: Object.fromEntries(CORE_KEYS.map(k => [k, 0])), // change per hour, in % points
    diagnostics: {},               // kW numbers, temperature, radiation rate, ...
    active_events: [],             // multi-hour events (flare, dust storm)
    game_over: null,               // null or { reason, hour }
  };
}

/** Deep copy so the UI can never mutate engine internals. */
function snapshot(state) {
  return JSON.parse(JSON.stringify(state));
}

/** Returns a reason string if the mission has failed, otherwise null. */
function checkGameOver(s, T) {
  if (s.oxygen <= 0)              return 'Crew asphyxiated: oxygen exhausted';
  if (s.food <= 0)                return 'Crew starved: food exhausted';
  if (s.habitat_health <= 0)      return 'Habitat structural failure';
  if (s.crew_morale <= 0)         return 'Crew morale collapsed: mission abandoned';
  if (s.radiation_dose >= T.dose_limit_msv) return 'Radiation dose limit exceeded';
  return null;
}
/* ---------------- simulation ---------------- */



/* ------------------------------------------------------------------ */
/*  TUNING — global numbers                                            */
/* ------------------------------------------------------------------ */
const TUNING = {
  crew: 4,
  mission_hours: 0,             // 0 = endless. N > 0: surviving N hours WINS (state.game_over.win = true)

  // Power (kW unless noted)
  battery_kwh: 1500,            // battery capacity; 1 % = battery_kwh/100 kWh
  panel_area_m2: 600,
  panel_efficiency: 0.25,
  base_load_kw: 8,              // computers, comms, lights
  life_support_kw: 5,           // scrubbers, pumps (full power)
  eco_life_support_factor: 0.6, // eco mode draws 60 % of life_support_kw
  rover_kw: 4,
  repair_kw: 0.8,
  heater_setpoint_c: 18,
  heater_kw_per_deg: 0.04,      // heater kW per °C below setpoint
  blackout_load_kw: 2,          // critical-only load when battery is empty
  generator_kw: 20,

  // Fuel
  fuel_kwh_per_pct: 50,         // 1 % of the tank = 50 kWh of generator output
  rover_fuel_pct_per_h: 0.35,

  // Oxygen
  o2_capacity_kg: 120,
  o2_kg_per_person_h: 0.042,    // ≈ 1 kg/day per person
  o2_recycle_max: 0.80,         // share of O2 recovered at full life support
  o2_leak_max_kg_h: 0.3,        // leak when habitat_health is 0

  // Food
  food_capacity_kg: 200,
  food_kg_per_person_h: 0.0333, // ≈ 0.8 kg/day incl. packaging
  ration_factor: 0.75,

  // Shielding & radiation
  shield_degrade_per_h: 0.01,   // % points lost per hour
  shield_panel_gain: 12,        // % points per deployed panel
  shield_panel_count: 4,        // how many panels the player owns
  shield_panel_cost_kwh: 40,
  shield_max_reduction: 0.9,    // shielding 100 % cuts dose by 90 %
  shelter_dose_factor: 0.25,    // crew in storm shelter receive 25 % of the dose (NASA Artemis I: shelter = ~4x protection)
  sep_lead_h: 4,                // hours between 'flare spotted' and particles arriving (NASA DONKI, 18 Jan 2026: ~4.4 h)
  dose_limit_msv: 100,          // game-scaled mission limit; reaching it = game over (NASA's real career limit is 600 mSv)

  // Habitat & panels
  habitat_decay_per_h: 0.004,   // thermal cycling wear (% points / h)
  repair_rate_per_h: 0.5,       // habitat % points / h while repairing
  panel_repair_per_h: 0.004,    // panel_integrity / h while repairing
  cold_damage_per_h: 0.3,       // habitat % points / h during blackout
  panel_dust_per_h: 0.0004,     // dust settling on panels
  storm_dust_per_h: 0.0015,     // extra settling during a storm
  panel_dust_max: 0.6,
  clean_panels_kwh: 10,

  // Greenhouse (food production) and research
  grow_kw: 3,                   // lamps + pumps + heating for the greenhouse
  grow_food_pct_per_h: 0.45,    // food % points grown per hour (needs light and power)
  science_per_rover_h: 3.5,     // research % points per hour of rover driving in daylight
  science_goal_stars: 40,       // research % needed for the research star

  // Shelter side effects: nobody goes outside while sheltering
  shelter_repair_factor: 0.5,   // repairs only happen indoors: half speed

  // Morale
  morale_base: 75,              // where morale sits when all is fine
  morale_response: 0.05,        // 5 %/h of the gap closed -> ~20 h time constant

  // Events
  event_scale: 8,               // probability speed-up (1 = real-world odds)
  unannounced_share: 0,         // share of flares that give NO warning (far side of the Sun). Commander uses this.
  max_flare_severity: 2,        // 0 minor, 1 moderate, 2 severe: the biggest flare this difficulty may roll
  max_storm_severity: 2,        // same for dust storms
};

/**
 * Tuning for a SHORT (72 h = 3 day) mission. Pass as config.tuning:
 *   engine.init(seed, { location, data, tuning: SHORT_MISSION_TUNING })
 * Test results (Mars, 20 seeds): crew that does nothing dies ~40 %; crew that manages
 * generator / shelter / repair / eco mode survives 100 %. Smaller tanks make 72 h matter,
 * and event_scale 60 gives ~2-3 events per mission.
 */
const SHORT_MISSION_TUNING = {
  mission_hours: 72, event_scale: 60,
  o2_capacity_kg: 10, food_capacity_kg: 12, fuel_kwh_per_pct: 8, battery_kwh: 350,
  o2_leak_max_kg_h: 0.4, habitat_decay_per_h: 0.08, cold_damage_per_h: 0.6,
  guarantee_flare: true,        // every mission meets at least one flare (the warning-window lesson)
};

/**
 * Difficulty presets: the single source of truth for the game, the tests and the balance simulator.
 *   cadet     72 h, calmer skies, a comfortable start, every flare comes with a warning.
 *   commander 96 h, harsher events, a tighter start, some flares come with NO warning.
 */
const DIFFICULTY = {
  cadet:     { tuning: { ...SHORT_MISSION_TUNING, event_scale: 30, max_flare_severity: 1, max_storm_severity: 0, habitat_decay_per_h: 0.42 }, initial: { shielding: 45, crew_morale: 85 } },
  commander: { tuning: { ...SHORT_MISSION_TUNING, mission_hours: 96, unannounced_share: 0.3, habitat_decay_per_h: 0.26 }, initial: {} },
};

/* ------------------------------------------------------------------ */
/*  PRESETS — per-location environment + event rates                   */
/* ------------------------------------------------------------------ */
const PRESETS = {
  mars: {
    env: {
      solar_flux_wm2: 590,      // top-of-atmosphere; dust tau cuts it below
      temp_mean_c: -55, temp_amp_c: 35,   // -90 °C night .. -20 °C day
      dust_tau: 0.5,
      day_length_h: 24.66, daylight_fraction: 0.5,
      background_dose_msv_h: 0.027,       // ≈ 0.64 mSv/day (Curiosity RAD)
      start_phase: 0.1,
      source: 'preset:mars',
    },
    tuning: {
      panel_area_m2: 430, battery_kwh: 900, panel_dust_per_h: 0.002,
      event_rate_flare: 0.0004, event_rate_meteor: 0.0001, event_rate_storm: 0.0002,
    },
  },
  moon: {
    env: {
      solar_flux_wm2: 1361,
      temp_mean_c: -60, temp_amp_c: 40,
      dust_tau: 0,
      day_length_h: 708.7, daylight_fraction: 0.8, // polar-ish site, short night
      background_dose_msv_h: 0.057,       // ≈ 1.37 mSv/day (Chang'e-4)
      start_phase: 0.6,                   // local afternoon: the Sun sinks lower as the mission goes on
      source: 'preset:moon',
    },
    tuning: {
      panel_area_m2: 70, battery_kwh: 1500,
      panel_dust_per_h: 0.003,
      event_rate_flare: 0.0004, event_rate_meteor: 0.0004, event_rate_storm: 0,
    },
  },
};

/* ------------------------------------------------------------------ */
/*  EVENT_TYPES — severity tables, index 0/1/2 = minor/moderate/severe */
/* ------------------------------------------------------------------ */
const SEVERITY = ['minor', 'moderate', 'severe'];
const EVENT_TYPES = {
  solar_flare: {
    title: 'Solar particle event',
    duration: [6, 12, 24],        // hours of elevated radiation
    doseTotal: [8, 35, 100],      // mSv received by an unshielded crew (GAME-SCALED so a short mission can show the danger)
    surgeLossPct: [0, 0, 6],      // severe flares trip electronics: battery % lost
    moraleHit: [2, 5, 10],
  },
  micrometeorite: {
    title: 'Micrometeorite strike',
    habitatDamage: [3, 10, 25],   // % points of habitat_health
    panelLoss: [0.05, 0.15, 0.35],// fraction of solar array destroyed
    o2Loss: [2, 6, 15],           // % of oxygen vented
    moraleHit: [2, 4, 8],
  },
  dust_storm: {
    title: 'Dust storm',
    duration: [36, 72, 120],      // hours (jittered ±25 %)
    tauAdd: [0.5, 1.0, 1.6],      // extra optical depth: sunlight x exp(-tau)  (cuts sunlight 39 / 63 / 80 %)
    moraleHit: [1, 3, 6],
  },
};

/* ------------------------------------------------------------------ */
/*  Engine internals                                                   */
/* ------------------------------------------------------------------ */
let S = null;          // live state
let T = null;          // effective tuning
let ENV = null;        // effective environment
let rng = null;        // seeded PRNG
let origConfig = null; // for replay
let SCHED = null;      // scripted scenario timetable (or null)
let GUARANTEE_HOUR = null; // hour at which a flare is forced if none has happened yet
let actionLog = [];
const listeners = {};

function emit(type, payload) {
  (listeners[type] || []).forEach(fn => fn(payload, type));
  (listeners['*'] || []).forEach(fn => fn(payload, type));
}

/** Subscribe to engine notifications. Returns an unsubscribe function. */
function subscribe(type, fn) {
  (listeners[type] ||= new Set()).add(fn);
  return () => listeners[type].delete(fn);
}

/** mulberry32: tiny seeded PRNG, returns floats in [0,1). */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Accept a number or a string seed. */
function seedToInt(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Merge a Data-module object over the preset environment. */
function seedEnvironment(data = {}, base) {
  const env = { ...base };
  const num = v => typeof v === 'number' && Number.isFinite(v);
  if (num(data.day_length_h)) env.day_length_h = data.day_length_h;
  if (num(data.daylight_fraction)) env.daylight_fraction = clamp(data.daylight_fraction, 0.05, 1);
  if (num(data.solar_flux_wm2)) {
    env.solar_flux_wm2 = data.solar_flux_wm2;
  } else if (num(data.solar_kwh_m2_day)) {
    // daily mean W/m^2 -> peak: mean = peak * daylight_fraction * (2/pi)  (half-sine shape)
    const meanW = data.solar_kwh_m2_day * 1000 / 24;
    env.solar_flux_wm2 = meanW / (env.daylight_fraction * 2 / Math.PI);
  }
  if (num(data.temp_min_c) && num(data.temp_max_c)) {
    env.temp_mean_c = (data.temp_min_c + data.temp_max_c) / 2;
    env.temp_amp_c = (data.temp_max_c - data.temp_min_c) / 2;
  } else {
    if (num(data.temp_mean_c)) env.temp_mean_c = data.temp_mean_c;
    if (num(data.temp_amp_c)) env.temp_amp_c = data.temp_amp_c;
  }
  if (num(data.dust_tau)) env.dust_tau = Math.max(0, data.dust_tau);
  if (num(data.background_dose_msv_h)) env.background_dose_msv_h = data.background_dose_msv_h;
  if (data.source) env.source = String(data.source);
  // --- Sol 72 additions: real per-sol weather rows, radio delay, real flare catalogue ---
  if (Array.isArray(data.daily) && data.daily.length) {
    env.daily = data.daily.filter(r => num(r.temp_min_c) && num(r.temp_max_c)).map(r => ({ ...r }));
  }
  if (data.signal_delay_s && num(data.signal_delay_s.min) && num(data.signal_delay_s.max)) {
    env.signal_delay_s = { min: data.signal_delay_s.min, max: data.signal_delay_s.max };
  }
  if (data.real_flares && typeof data.real_flares === 'object') env.real_flares = data.real_flares;
  if (num(data.sep_lead_h)) env.sep_lead_h = Math.max(0, Math.round(data.sep_lead_h));
  if (num(data.flare_rate_scale)) env.flare_rate_scale = clamp(data.flare_rate_scale, 0.25, 4);
  if (data.space_weather) env.space_weather = data.space_weather;
  if (data.scenario && typeof data.scenario === 'object') env.scenario = data.scenario;
  env.phase_offset_h = env.start_phase * env.day_length_h;
  return env;
}

/* ------------------------------------------------------------------ */
/*  The physics: computeRates()  (pure function of state)              */
/* ------------------------------------------------------------------ */
function computeRates(s, env, T) {
  const d = {}; // diagnostics

  // 1. ENVIRONMENT -----------------------------------------------------
  // t: time into the day cycle, shifted so the game starts mid-morning.
  const t = s.hour + env.phase_offset_h;
  // phase: 0..1 position within the day cycle.
  const phase = (t % env.day_length_h) / env.day_length_h;
  // daylight: half-sine over the sunlit part of the day (0 at dawn/dusk, 1 at noon), 0 at night.
  d.daylight = phase < env.daylight_fraction
    ? Math.sin(Math.PI * phase / env.daylight_fraction) : 0;
  // Which day of the mission is this? (1 = first sol/day)
  const dayIndex = Math.floor(t / env.day_length_h);
  d.mission_sol = dayIndex + 1;
  // Temperature swing: if real per-sol weather rows were supplied (NASA InSight TWINS), use
  // that sol's own min/max, so every sol of the mission is a different real Martian day.
  let tMean = env.temp_mean_c, tAmp = env.temp_amp_c;
  if (env.daily && env.daily.length) {
    const row = env.daily[dayIndex % env.daily.length];
    tMean = (row.temp_min_c + row.temp_max_c) / 2;
    tAmp = (row.temp_max_c - row.temp_min_c) / 2;
    d.real_sol = row.sol; d.real_date = row.date; d.season = row.season;
    d.pressure_pa = row.pressure_pa; d.wind_ms = row.wind_ms; d.wind_max_ms = row.wind_max_ms;
  }
  // temperature swings between (mean - amp) at night and (mean + amp) at noon.
  d.temp_c = tMean + tAmp * (2 * d.daylight - 1);
  // a dust storm adds optical depth on top of the baseline.
  const storm = s.active_events.find(e => e.type === 'dust_storm');
  d.tau_effective = env.dust_tau + (storm ? storm.tau_add : 0);

  // 2. POWER SUPPLY (kW) ----------------------------------------------
  // area * efficiency * flux gives peak panel kW; then scale by sun, dust in air,
  // dust on panels and surviving panel fraction.
  d.solar_kw = T.panel_area_m2 * T.panel_efficiency * (env.solar_flux_wm2 / 1000)
    * d.daylight * Math.exp(-d.tau_effective) * (1 - s.panel_dust) * s.panel_integrity;
  // generator only runs if the player switched it on AND there is fuel.
  d.generator_on = s.modes.generator && s.fuel > 0;
  d.generator_kw = d.generator_on ? T.generator_kw : 0;
  const supply = d.solar_kw + d.generator_kw;

  // 3. POWER LOAD (kW) ------------------------------------------------
  // life-support power scales with the chosen mode (1.0 normal, 0.6 eco).
  const lsFactor = s.modes.life_support === 'eco' ? T.eco_life_support_factor : 1;
  // heater works harder the colder it is outside.
  const heater = Math.max(0, T.heater_setpoint_c - d.temp_c) * T.heater_kw_per_deg;
  let rover = s.modes.rover && s.fuel > 0 && !s.modes.shelter;   // rover needs fuel, and nobody drives while sheltering
  let repair = s.modes.repair;
  let grow = s.modes.grow;
  let load = T.base_load_kw + lsFactor * T.life_support_kw + heater
    + (rover ? T.rover_kw : 0) + (repair ? T.repair_kw : 0) + (grow ? T.grow_kw : 0);

  // 4. BLACKOUT --------------------------------------------------------
  // empty battery and supply < demand: shed everything except critical loads.
  d.blackout = s.power <= 0 && supply < load;
  let ls = lsFactor; // effective life-support level used for oxygen recycling
  if (d.blackout) { ls = 0; rover = false; repair = false; grow = false; load = T.blackout_load_kw; }
  d.load_kw = load; d.net_kw = supply - load;
  d.rover_on = rover; d.repair_on = repair; d.grow_on = grow; d.ls_level = ls;
  // Crew efficiency: a worn-out, unhappy crew works slower (repairs, research). 1 at morale >= 70, 0.3 at <= 26.
  d.crew_eff = clamp((s.crew_morale - 20) / 50, 0.3, 1);
  // Research: only while the rover is out in daylight (and not in a flare shelter).
  d.science_rate = rover && d.daylight > 0.05 ? T.science_per_rover_h * d.crew_eff : 0;

  // 5. RADIATION (mSv per hour) ------------------------------------------
  const flare = s.active_events.find(e => e.type === 'solar_flare');
  // A flare's light arrives at once, but its dangerous PARTICLES arrive hours later
  // (NASA DONKI lists the flare first, the SEP particle event ~4 h after). Dose only starts on arrival.
  const flareArrived = !!flare && !(flare.arrives_in > 0);
  d.flare_phase = flare ? (flareArrived ? 'arrived' : 'incoming') : null;
  d.flare_eta_h = flare && !flareArrived ? flare.arrives_in : 0;
  // raw dose = background + flare dose spread over the flare's duration.
  const raw = env.background_dose_msv_h + (flareArrived ? flare.dose_unshielded_msv_h : 0);
  // shielding 0..100 % removes up to shield_max_reduction of the dose.
  const shieldFactor = 1 - T.shield_max_reduction * s.shielding / 100;
  // sheltering crew receive only a fraction.
  d.radiation_msv_h = raw * shieldFactor * (s.modes.shelter ? T.shelter_dose_factor : 1);

  // 6. MORALE TARGET --------------------------------------------------
  // start from base, subtract penalties that grow as things get worse.
  let target = T.morale_base;
  target -= Math.max(0, 30 - s.oxygen) * 0.5;            // thin air
  target -= Math.max(0, 25 - s.food) * 0.4;              // hunger
  target -= Math.max(0, 25 - s.power) * 0.3;             // lights dimming
  target -= Math.max(0, 50 - s.habitat_health) * 0.3;    // damaged home
  target -= 20 * Math.min(1, s.radiation_dose / T.dose_limit_msv); // dose anxiety
  if (s.modes.life_support === 'eco') target -= 8;       // stuffy, cold
  if (s.modes.ration) target -= 10;                      // hungry on purpose
  if (s.modes.shelter) target -= 15;                     // cramped in shelter
  if (d.blackout) target -= 25;                          // dark and freezing
  if (rover) target += 8;                                // exploring lifts spirits
  d.morale_target = target;

  // 7. RATES (change per hour, in % points) ----------------------------
  const r = {};
  // power: net kWh this hour as % of battery capacity.
  r.power = d.net_kw / T.battery_kwh * 100;
  // fuel: generator burns kW/fuel_kwh_per_pct; rover burns a fixed %.
  r.fuel = -(d.generator_on ? T.generator_kw / T.fuel_kwh_per_pct : 0)
    - (rover ? T.rover_fuel_pct_per_h : 0);
  // oxygen: crew use * unrecycled share + leak that grows as the hull worsens.
  const o2Use = T.crew * T.o2_kg_per_person_h * (1 - T.o2_recycle_max * ls);
  const o2Leak = T.o2_leak_max_kg_h * (1 - s.habitat_health / 100);
  r.oxygen = -(o2Use + o2Leak) / T.o2_capacity_kg * 100;
  // food: crew * ration per hour, reduced when rationing.
  r.food = -(T.crew * T.food_kg_per_person_h * (s.modes.ration ? T.ration_factor : 1))
    / T.food_capacity_kg * 100
    + (grow ? T.grow_food_pct_per_h * Math.max(0.15, d.daylight) : 0);   // lamps help at night but sunlight helps more
  // shielding: slow settling/erosion.
  r.shielding = -T.shield_degrade_per_h;
  // habitat: wear, minus repair gain, minus cold damage in blackout.
  const repairEff = d.crew_eff * (s.modes.shelter ? T.shelter_repair_factor : 1);
  d.repair_eff = repairEff;
  r.habitat_health = -T.habitat_decay_per_h + (repair ? T.repair_rate_per_h * repairEff : 0)
    - (d.blackout ? T.cold_damage_per_h : 0);
  // morale: move 5 % of the way toward the target each hour.
  r.crew_morale = (target - s.crew_morale) * T.morale_response;

  return { rates: r, diag: d };
}

function refreshRates() {
  const { rates, diag } = computeRates(S, ENV, T);
  S.rates = rates; S.diagnostics = diag;
}

/* ------------------------------------------------------------------ */
/*  Random events                                                      */
/* ------------------------------------------------------------------ */
/* Severity roll: 60 % minor, 30 % moderate, 10 % severe. */
const sev = x => (x < 0.6 ? 0 : x < 0.9 ? 1 : 2);
const hit = h => { S.crew_morale = clamp(S.crew_morale - h, 0, 100); };
const hasActive = type => S.active_events.some(e => e.type === type);
function addActive(type, i, dur, extra) {
  if (dur > 0) S.active_events.push({ id: `${type}-${S.hour}`, type, severity: SEVERITY[i],
    started: S.hour, duration: dur, remaining: dur, ...extra });
}

/* The three event starters. Used by the random roller AND by debugTriggerEvent(). */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = iso => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/** Pick a REAL NASA DONKI flare of this severity from the supplied catalogue (deterministic from the roll). */
function pickRealFlare(i, roll) {
  const list = ENV.real_flares && ENV.real_flares[SEVERITY[i]];
  if (!list || !list.length) return null;
  return list[Math.min(list.length - 1, Math.floor(roll * list.length))];
}

function startFlare(i, events, pickRoll = 0.5, opts = {}) {
  const d = EVENT_TYPES.solar_flare;
  // lead = hours between "flare spotted" and "particles arrive". 0 = no warning (far side of the Sun).
  const lead = opts.lead != null ? opts.lead : (ENV.sep_lead_h ?? T.sep_lead_h);
  const real = opts.real !== undefined ? opts.real : pickRealFlare(i, pickRoll);
  addActive('solar_flare', i, d.duration[i] + lead, {
    dose_unshielded_msv_h: d.doseTotal[i] / d.duration[i],
    arrives_in: lead, particle_hours: d.duration[i], real: real || null,
  });
  const active = S.active_events[S.active_events.length - 1];
  S.flare_count += 1;
  hit(d.moraleHit[i]);
  const what = real ? `a real ${real.class} flare (${fmtDate(real.date)}, NASA space weather)` : 'a solar flare';
  const unannounced = lead === 0;
  events.push({ id: `solar_flare-${S.hour}`, type: 'solar_flare', phase: 'start', hour: S.hour,
    severity: SEVERITY[i], title: d.title, duration: d.duration[i], lead_h: lead, unannounced, real: real || null,
    effects: { radiation_msv_unshielded: d.doseTotal[i], battery_pct: -d.surgeLossPct[i], morale: -d.moraleHit[i] },
    message: unannounced
      ? `NO WARNING (${SEVERITY[i]}): ${what} erupted on the far side of the Sun, where Earth cannot see it. The particles are already here!`
      : `SOLAR FLARE SPOTTED (${SEVERITY[i]}): ${what}. Dangerous particles arrive in ~${lead} h: get ready to shelter or add shielding!` });
  if (unannounced && active) arriveFlare(active, events);   // no warning window: the storm is here now
}

/** The particle storm reaches the base: surge damage + the dose clock starts. */
function arriveFlare(e, events) {
  const d = EVENT_TYPES.solar_flare;
  const i = SEVERITY.indexOf(e.severity);
  S.power = clamp(S.power - d.surgeLossPct[i], 0, 100);
  events.push({ id: `solar_flare-${e.started}-arrive`, type: 'solar_flare', phase: 'arrive', hour: S.hour,
    severity: e.severity, title: 'Particle storm arrived', duration: e.particle_hours, real: e.real || null,
    effects: { radiation_msv_unshielded: d.doseTotal[i], battery_pct: -d.surgeLossPct[i] },
    message: `PARTICLE STORM ARRIVED (${e.severity}): up to ${d.doseTotal[i]} mSv over ${e.particle_hours} h for an unshielded crew`
      + (d.surgeLossPct[i] ? `; electronics surge drained ${d.surgeLossPct[i]} % battery` : '') + '. Shelter now!' });
}

function startMeteor(i, targetRoll, events) {
  const d = EVENT_TYPES.micrometeorite;
  const target = targetRoll < 0.5 ? 'habitat' : targetRoll < 0.8 ? 'solar_array' : 'oxygen_tank';
  let message, effects;
  if (target === 'habitat') {
    // Whipple-style shielding absorbs up to 30 % of the damage.
    const dmg = d.habitatDamage[i] * (1 - 0.3 * S.shielding / 100);
    S.habitat_health = clamp(S.habitat_health - dmg, 0, 100);
    effects = { habitat_health: -dmg };
    message = `MODULE DAMAGE (${SEVERITY[i]}): hull struck, habitat health -${dmg.toFixed(1)} % (leak rate up)`;
  } else if (target === 'solar_array') {
    const before = S.panel_integrity;
    S.panel_integrity = clamp(S.panel_integrity - d.panelLoss[i], 0, 1);
    effects = { panel_integrity: S.panel_integrity - before };
    message = `LOSS OF POWER (${SEVERITY[i]}): solar array hit, output -${Math.round((before - S.panel_integrity) * 100)} %`;
  } else {
    S.oxygen = clamp(S.oxygen - d.o2Loss[i], 0, 100);
    effects = { oxygen: -d.o2Loss[i] };
    message = `OXYGEN TANK PUNCTURE (${SEVERITY[i]}): ${d.o2Loss[i]} % of oxygen vented`;
  }
  hit(d.moraleHit[i]);
  events.push({ id: `micrometeorite-${S.hour}`, type: 'micrometeorite', phase: 'start', hour: S.hour,
    severity: SEVERITY[i], title: d.title, target, duration: 0,
    effects: { ...effects, morale: -d.moraleHit[i] }, message });
}

function startStorm(i, jitterRoll, events, opts = {}) {
  const d = EVENT_TYPES.dust_storm;
  const dur = opts.duration != null ? opts.duration : Math.round(d.duration[i] * (0.75 + 0.5 * jitterRoll)); // ±25 % jitter
  const tau = opts.tau != null ? opts.tau : d.tauAdd[i];
  addActive('dust_storm', i, dur, { tau_add: tau });
  hit(d.moraleHit[i]);
  const cut = Math.round((1 - Math.exp(-tau)) * 100);
  events.push({ id: `dust_storm-${S.hour}`, type: 'dust_storm', phase: 'start', hour: S.hour,
    severity: SEVERITY[i], title: d.title, duration: dur, scripted: !!opts.scripted,
    effects: { solar_output_pct: -cut, morale: -d.moraleHit[i] },
    message: `DUST STORM (${SEVERITY[i]}): solar output down ~${cut} % for ~${dur} h. Consider eco mode or generator.` });
}

function rollEvents(events) {
  // 8. FIXED RNG DRAWS: always 10, in this order, so the timeline never depends on actions.
  //    (r[8] chooses WHICH real DONKI flare is replayed; r[9] decides whether a flare comes with no warning.)
  const r = Array.from({ length: 10 }, () => rng());
  const chance = rate => 1 - Math.exp(-rate * T.event_scale); // rate/h -> probability this hour
  const flareScale = ENV.flare_rate_scale ?? 1;               // live DONKI activity can scale the flare chance
  const sched = SCHED;
  // Flares: a scripted storm replays real flares at fixed hours; otherwise they are random.
  if (sched && sched.flares) {
    sched.flares.filter(f => f.hour === S.hour && !hasActive('solar_flare'))
      .forEach(f => startFlare(f.sev, events, 0.5, { real: f.real, lead: f.lead }));
  } else if (!(sched && sched.no_random_flares) && r[0] < chance(T.event_rate_flare * flareScale) && !hasActive('solar_flare')) {
    startFlare(Math.min(T.max_flare_severity, sev(r[3])), events, r[8], r[9] < T.unannounced_share ? { lead: 0 } : {});
  } else if (GUARANTEE_HOUR === S.hour && S.flare_count === 0 && !hasActive('solar_flare')) {
    // nothing rolled by now: make sure the player meets the Sun at least once
    startFlare(Math.min(T.max_flare_severity, sev(r[3])), events, r[8], r[9] < T.unannounced_share ? { lead: 0 } : {});
  }
  if (r[1] < chance(T.event_rate_meteor)) startMeteor(sev(r[4]), r[6], events);
  // Dust storms: the 2018 scenario scripts one big storm; otherwise they are random (Mars only).
  if (sched && sched.storm) {
    if (sched.storm.hour === S.hour && !hasActive('dust_storm')) startStorm(2, 0.5, events, { tau: sched.storm.tau, duration: sched.storm.duration, scripted: true });
  } else if (r[2] < chance(T.event_rate_storm) && !hasActive('dust_storm')) startStorm(Math.min(T.max_storm_severity, sev(r[5])), r[7], events);
}

/* ------------------------------------------------------------------ */
/*  Scripted scenarios (real historic storms)                          */
/* ------------------------------------------------------------------ */
/** GOES class string -> severity index. X1-X1.9 minor, X2-X7.9 moderate, X8+ severe. M/C minor. */
function sevFromClass(c) {
  const m = /^([ABCMX])(\d+(\.\d+)?)/i.exec(c || '');
  if (!m) return 1;
  const L = m[1].toUpperCase(), n = parseFloat(m[2]);
  if (L !== 'X') return 0;
  return n < 2 ? 0 : n < 8 ? 1 : 2;
}
const classValue = c => { const m = /^([ABCMX])(\d+(\.\d+)?)/i.exec(c || ''); return m ? ({ A: 1, B: 2, C: 3, M: 4, X: 5 }[m[1].toUpperCase()] * 1000 + parseFloat(m[2])) : 0; };

/**
 * Turn env.scenario into a fixed timetable (deterministic from the seed).
 *   scenario.flares  real flares of a storm, chronological. The strongest N are replayed in order.
 *   scenario.dust    { tau, duration }: one scripted dust storm (Mars only).
 * Returns null when there is no scenario (random events as usual).
 */
function buildSchedule(env, tuning, seed) {
  const sc = env.scenario;
  if (!sc) return null;
  const H = tuning.mission_hours || 72;
  const prng = mulberry32((seedToInt(seed) ^ 0x5CE7A101) >>> 0);
  if (sc.dust && (env.location_kind || env.location) !== 'moon') {
    return { id: sc.id, no_random_flares: true, flares: null,
      storm: { hour: 6 + Math.floor(prng() * 8), tau: sc.dust.tau, duration: sc.dust.duration } };
  }
  const list = Array.isArray(sc.flares) ? sc.flares.slice() : [];
  if (!list.length) return null;
  const want = Math.min(list.length, H <= 72 ? 2 : 3);
  const idx = list.map((f, i) => i).sort((a, b) => classValue(list[b].class) - classValue(list[a].class)).slice(0, want).sort((a, b) => a - b);
  const maxSev = tuning.max_flare_severity != null ? tuning.max_flare_severity : 2;
  const flares = [];
  let earliest = 8;
  idx.forEach((fi, k) => {
    const f = list[fi];
    const sevI = Math.min(maxSev, sevFromClass(f.class));
    const slot = Math.round(H * (k + 1) / (want + 1) + (prng() - 0.5) * 8);
    const hour = Math.max(earliest, Math.min(H - 8, slot));
    const lead = prng() < (tuning.unannounced_share || 0) ? 0 : (env.sep_lead_h ?? tuning.sep_lead_h);
    flares.push({ hour, sev: sevI, real: f, lead });
    earliest = hour + EVENT_TYPES.solar_flare.duration[sevI] + (env.sep_lead_h ?? tuning.sep_lead_h) + 2;   // never overlap
  });
  return { id: sc.id, flares: flares.filter(f => f.hour <= H - 6), storm: null, no_random_flares: true };
}

/** Count down multi-hour events and report when they end. */
function tickEvents(events) {
  S.active_events = S.active_events.filter(e => {
    e.remaining -= 1;
    if (e.type === 'solar_flare' && e.arrives_in > 0) {
      e.arrives_in -= 1;
      if (e.arrives_in === 0) arriveFlare(e, events);
    }
    if (e.remaining > 0) return true;
    events.push({ id: `${e.type}-${e.started}-end`, type: e.type, phase: 'end', hour: S.hour,
      severity: e.severity, title: `${EVENT_TYPES[e.type].title} ended`, effects: {},
      message: `${EVENT_TYPES[e.type].title} has passed.` });
    return false;
  });
}

/* ------------------------------------------------------------------ */
/*  Player actions                                                     */
/* ------------------------------------------------------------------ */
const toggle = (key, onMsg, offMsg) => s => { s.modes[key] = !s.modes[key]; return s.modes[key] ? onMsg : offMsg; };

const ACTIONS = {
  toggle_generator: {
    label: 'Backup generator',
    description: 'Burn fuel for +generator_kw of power. Fuel drains ~0.3 %/h while on.',
    isOn: s => s.modes.generator,
    can: s => (!s.modes.generator && s.fuel <= 0 ? 'No fuel' : null),
    run: toggle('generator', 'Generator ON: burning fuel for power.', 'Generator OFF.'),
  },
  toggle_rover: {
    label: 'Drive rover',
    description: 'Collects research in daylight and lifts morale. Uses power and fuel. Cannot go out while the crew shelters.',
    isOn: s => s.modes.rover,
    can: s => (!s.modes.rover && s.modes.shelter ? 'Crew is sheltering: nobody can drive'
      : !s.modes.rover && s.fuel <= 0 ? 'No fuel' : null),
    run: toggle('rover', 'Rover deployed: collecting research, drawing power and fuel.', 'Rover parked.'),
  },
  toggle_greenhouse: {
    label: 'Grow food',
    description: 'Greenhouse makes food (best in daylight) but its lamps and pumps draw power.',
    isOn: s => s.modes.grow,
    can: () => null,
    run: toggle('grow', 'Greenhouse ON: growing food, drawing power.', 'Greenhouse OFF.'),
  },
  set_life_support_eco: {
    label: 'Life support: eco',
    description: 'Saves ~40 % of life-support power (and generator fuel) but recycles less O2 and lowers morale.',
    isOn: s => s.modes.life_support === 'eco',
    can: s => (s.modes.life_support === 'eco' ? 'Already eco' : null),
    run: s => { s.modes.life_support = 'eco'; return 'Life support set to ECO.'; },
  },
  set_life_support_normal: {
    label: 'Life support: normal',
    description: 'Full power, full oxygen recycling.',
    isOn: s => s.modes.life_support === 'normal',
    can: s => (s.modes.life_support === 'normal' ? 'Already normal' : null),
    run: s => { s.modes.life_support = 'normal'; return 'Life support set to NORMAL.'; },
  },
  deploy_shielding: {
    label: 'Deploy shielding panel',
    description: 'One-off: +shield_panel_gain % shielding for shield_panel_cost_kwh of battery. Limited panels.',
    isOn: () => false,
    can: (s, T) => (s.shield_panels_left <= 0 ? 'No panels left'
      : s.power < T.shield_panel_cost_kwh / T.battery_kwh * 100 ? 'Not enough battery' : null),
    run: (s, T) => {
      s.shielding = clamp(s.shielding + T.shield_panel_gain, 0, 100);
      s.power = clamp(s.power - T.shield_panel_cost_kwh / T.battery_kwh * 100, 0, 100);
      s.shield_panels_left -= 1;
      return `Shielding panel deployed (+${T.shield_panel_gain} %). ${s.shield_panels_left} left.`;
    },
  },
  toggle_repair: {
    label: 'Repair crew',
    description: 'Restores habitat health (+0.5 %/h at full crew strength) and solar panels; draws power.',
    isOn: s => s.modes.repair,
    can: () => null,
    run: toggle('repair', 'Repair crew working.', 'Repair crew stood down.'),
  },
  toggle_ration: {
    label: 'Ration food',
    description: 'Food use x0.75, morale target -10. Stretches the food you have; does not make more.',
    isOn: s => s.modes.ration,
    can: () => null,
    run: toggle('ration', 'Food rationing ON.', 'Food rationing OFF.'),
  },
  toggle_shelter: {
    label: 'Radiation shelter',
    description: 'Crew shelter: dose x0.25, morale target -15. No rover, no panel cleaning, repairs at half speed while inside.',
    isOn: s => s.modes.shelter,
    can: () => null,
    run: s => {
      s.modes.shelter = !s.modes.shelter;
      if (s.modes.shelter) { s.modes.rover = false; return 'Crew moved to radiation shelter. Rover parked: nobody goes outside.'; }
      return 'Crew left the shelter.';
    },
  },
  clean_panels: {
    label: 'Clean solar panels',
    description: 'Removes dust from panels for clean_panels_kwh of battery.',
    isOn: () => false,
    can: (s, T) => (s.modes.shelter ? 'No outside work while the crew shelters'
      : s.panel_dust < 0.02 ? 'Panels already clean'
      : s.power < T.clean_panels_kwh / T.battery_kwh * 100 ? 'Not enough battery' : null),
    run: (s, T) => {
      s.panel_dust = 0;
      s.power = clamp(s.power - T.clean_panels_kwh / T.battery_kwh * 100, 0, 100);
      return 'Panels cleaned.';
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Initialise the engine.
 * @param {number|string} seed   same seed => same event timeline
 * @param {object} config        { location: 'mars'|'moon', data: {...}, tuning: {...}, initial: {...} }
 */
function init(seed, config = {}) {
  origConfig = JSON.parse(JSON.stringify(config));
  const location = config.location || (config.data && config.data.location) || 'mars';
  const preset = PRESETS[location] || PRESETS.mars;
  T = { ...TUNING, ...preset.tuning, ...(config.tuning || {}) };
  ENV = seedEnvironment(config.data || {}, preset.env);
  ENV.location_kind = location;
  rng = mulberry32(seedToInt(seed));
  SCHED = buildSchedule(ENV, T, seed);
  GUARANTEE_HOUR = T.guarantee_flare && !SCHED ? 16 + Math.floor(mulberry32((seedToInt(seed) ^ 0xF1A5E) >>> 0)() * 24) : null;
  actionLog = [];
  S = createInitialState({ seed, location, tuning: T, initial: config.initial });
  refreshRates();
  return snapshot(S);
}

/** Advance one hour. Returns { state, events }. */
function step() {
  if (!S) throw new Error('simEngine: call init() first');
  if (S.game_over) return { state: snapshot(S), events: [] };

  const events = [];
  S.hour += 1;
  rollEvents(events);                                  // new events (instant effects applied now)

  const before = Object.fromEntries(CORE_KEYS.map(k => [k, S[k]]));
  refreshRates();                                      // rates for this hour
  for (const k of CORE_KEYS) S[k] = clamp(S[k] + S.rates[k], 0, 100); // value += rate
  S.radiation_dose += S.diagnostics.radiation_msv_h;   // cumulative dose
  S.science = clamp(S.science + S.diagnostics.science_rate, 0, 100);   // research collected
  const storm = S.active_events.some(e => e.type === 'dust_storm');
  S.panel_dust = clamp(S.panel_dust + T.panel_dust_per_h + (storm ? T.storm_dust_per_h : 0), 0, T.panel_dust_max);
  if (S.diagnostics.repair_on) S.panel_integrity = Math.min(1, S.panel_integrity + T.panel_repair_per_h * S.diagnostics.repair_eff);
  tickEvents(events);

  // threshold alerts (fire once, when a variable crosses downward)
  for (const k of CORE_KEYS) {
    const v = VARIABLES[k];
    const level = before[k] > v.crit && S[k] <= v.crit ? 'critical'
      : before[k] > v.warn && S[k] <= v.warn ? 'warning' : null;
    if (level) {
      const a = { id: `alert-${k}-${S.hour}`, type: 'alert', phase: 'start', hour: S.hour, level,
        variable: k, severity: level, title: `${v.label} ${level}`,
        effects: {}, message: `${v.label} ${level}: ${S[k].toFixed(1)} %` };
      events.push(a); emit('alert', a);
    }
  }

  const reason = checkGameOver(S, T);
  if (reason) S.game_over = { reason, hour: S.hour, win: false };
  else if (T.mission_hours > 0 && S.hour >= T.mission_hours) {       // survived the whole mission
    S.game_over = { reason: `Mission complete: crew survived ${Math.round(T.mission_hours / 24 * 10) / 10} days`, hour: S.hour, win: true };
  }

  const result = { state: snapshot(S), events };
  events.filter(e => e.type !== 'alert').forEach(e => emit('event', e));
  emit('step', result);
  if (S.game_over) emit('gameover', S.game_over);
  return result;
}

/** Apply a player action. Takes effect from the next step; rate preview updates now. */
function applyAction(actionId) {
  if (!S) throw new Error('simEngine: call init() first');
  const a = ACTIONS[actionId];
  if (!a) return { ok: false, message: `Unknown action "${actionId}"`, state: snapshot(S) };
  if (S.game_over) return { ok: false, message: 'Mission over', state: snapshot(S) };
  const why = a.can(S, T);
  if (why) return { ok: false, message: why, state: snapshot(S) };
  const message = a.run(S, T);
  actionLog.push({ hour: S.hour, actionId });
  refreshRates();
  const res = { ok: true, actionId, message, state: snapshot(S) };
  emit('action', res);
  return res;
}

/**
 * DEBUG / DEMO: force an event right now (keyboard demo, judges, tests).
 * Runs the same code as a random event, so the state really changes, but it does NOT
 * consume the seeded RNG (the random timeline is untouched) and is stored in the
 * replay log so replay() reproduces it.
 * @param {'solar_flare'|'micrometeorite'|'dust_storm'} type
 * @param {0|1|2} severity   0 minor, 1 moderate (default), 2 severe
 * @param {{target?: 'habitat'|'solar_array'|'oxygen_tank'}} opts  micrometeorite only
 */
function debugTriggerEvent(type, severity = 1, opts = {}) {
  if (!S) throw new Error('simEngine: call init() first');
  if (S.game_over || !EVENT_TYPES[type]) return null;
  const i = clamp(Math.round(severity), 0, 2);
  const events = [];
  S.active_events = S.active_events.filter(e => e.type !== type); // restart if already active
  if (type === 'solar_flare') startFlare(i, events);
  if (type === 'dust_storm') startStorm(i, 0.5, events);
  if (type === 'micrometeorite') {
    const roll = { habitat: 0.25, solar_array: 0.65, oxygen_tank: 0.9 }[opts.target] ?? 0.25;
    startMeteor(i, roll, events);
  }
  events.forEach(e => { e.debug = true; });
  actionLog.push({ hour: S.hour, actionId: `debug:${type}`, debug: { type, severity: i, opts } });
  refreshRates();
  events.forEach(e => emit('event', e));
  emit('step', { state: snapshot(S), events });        // lets the HUD / log refresh
  return events[0];
}

/**
 * Apply a one-off decision card: { fuel:-10, oxygen:5, power:-10, food:-5, radiation:5 }.
 * fuel/oxygen/power/food (and crew_morale, shielding, habitat_health) are % points.
 * radiation is % of the mission dose limit (so +5 = 5 % of dose_limit_msv added).
 * Lets a scenario card (scenarios.json `effects`) and the hourly model share one state.
 */
function applyEffects(effects = {}, label = 'decision') {
  if (!S) throw new Error('simEngine: call init() first');
  if (S.game_over) return { ok: false, message: 'Mission over', state: snapshot(S) };
  for (const k of CORE_KEYS) {
    if (Number.isFinite(effects[k])) S[k] = clamp(S[k] + effects[k], 0, 100);
  }
  if (Number.isFinite(effects.radiation)) {
    S.radiation_dose = Math.max(0, S.radiation_dose + effects.radiation / 100 * T.dose_limit_msv);
  }
  actionLog.push({ hour: S.hour, actionId: `effects:${label}`, effects: { ...effects } });
  refreshRates();
  const reason = checkGameOver(S, T);
  if (reason) S.game_over = { reason, hour: S.hour };
  const res = { ok: true, actionId: `effects:${label}`, message: `Decision applied: ${label}`, state: snapshot(S) };
  emit('action', res);
  if (S.game_over) emit('gameover', S.game_over);
  return res;
}

/**
 * End-of-mission rating (0-3 stars). 1 = survived. +1 research goal met (rover trips cost power and fuel).
 * +1 "well-run base": you finished with reserves, not just alive: battery >= 20 %, habitat >= 70 %,
 * morale >= 60 % and a dose under 30 % of the limit.
 */
function rating(state = S) {
  const win = !!(state.game_over && state.game_over.win);
  const research = state.science >= T.science_goal_stars;
  const healthy = state.power >= 20 && state.habitat_health >= 70 && state.crew_morale >= 60 && state.radiation_dose <= 0.3 * T.dose_limit_msv;
  return { stars: win ? 1 + research + healthy : 0, survived: win, research, healthy, science: state.science };
}

/** Scripted storm timetable of the current run (null if events are random). For the UI and tests. */
function getSchedule() { return SCHED ? JSON.parse(JSON.stringify(SCHED)) : null; }

/** Current state snapshot (safe to keep / mutate). */
function getState() { return S ? snapshot(S) : null; }

/** Action list for building buttons. */
function listActions() {
  return Object.entries(ACTIONS).map(([id, a]) => ({
    id, label: a.label, description: a.description,
    active: S ? a.isOn(S) : false,
    disabled_reason: S ? a.can(S, T) : null,
  }));
}

/** Effective numbers (tuning + environment) for a debug / judges panel. */
function getConfig() { return { tuning: { ...T }, environment: { ...ENV } }; }

/** Everything needed to reproduce this run. */
function getReplayLog() {
  return { seed: S.seed, config: origConfig, actions: [...actionLog], hours: S.hour };
}

/** Re-run a log from scratch (silent) and return the final state. */
function replay(log, hours = log.hours) {
  init(log.seed, log.config);
  for (let h = 0; h < hours && !S.game_over; h++) {
    log.actions.filter(a => a.hour === S.hour).forEach(a =>
      a.debug ? debugTriggerEvent(a.debug.type, a.debug.severity, a.debug.opts)
        : a.effects ? applyEffects(a.effects, a.actionId.slice(8))
        : applyAction(a.actionId));
    step();
  }
  return getState();
}

const API = { init, step, applyAction, debugTriggerEvent, applyEffects, getState, listActions, getConfig,
  getReplayLog, replay, subscribe, seedEnvironment, rating, getSchedule, sevFromClass, buildSchedule,
  TUNING, SHORT_MISSION_TUNING, DIFFICULTY, PRESETS, EVENT_TYPES, CORE_KEYS, VARIABLES, INITIAL_VALUES };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.SimEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
