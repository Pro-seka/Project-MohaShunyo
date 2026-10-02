/**
 * simEngine.js — lunar / Martian outpost simulation (1 step = 1 simulated hour)
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
 *   Exactly 8 RNG draws are consumed every step whatever happens, so the event
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

import {
  CORE_KEYS, VARIABLES, clamp, createInitialState, snapshot, checkGameOver,
} from './gameState.js';

/* ------------------------------------------------------------------ */
/*  TUNING — global numbers                                            */
/* ------------------------------------------------------------------ */
export const TUNING = {
  crew: 4,
  mission_hours: 0,             // 0 = endless. N > 0: surviving N hours WINS (state.game_over.win = true)

  // Power (kW unless noted)
  battery_kwh: 1500,            // battery capacity; 1 % = battery_kwh/100 kWh
  panel_area_m2: 600,
  panel_efficiency: 0.25,
  base_load_kw: 8,              // computers, comms, lights
  life_support_kw: 5,           // scrubbers, pumps (full power)
  eco_life_support_factor: 0.6, // eco mode draws 60 % of life_support_kw
  rover_kw: 2,
  repair_kw: 0.8,
  heater_setpoint_c: 18,
  heater_kw_per_deg: 0.04,      // heater kW per °C below setpoint
  blackout_load_kw: 2,          // critical-only load when battery is empty
  generator_kw: 15,

  // Fuel
  fuel_kwh_per_pct: 50,         // 1 % of the tank = 50 kWh of generator output
  rover_fuel_pct_per_h: 0.15,

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
  shelter_dose_factor: 0.25,    // crew in storm shelter receive 25 % of the dose
  dose_limit_msv: 250,          // mission limit; reaching it = game over

  // Habitat & panels
  habitat_decay_per_h: 0.004,   // thermal cycling wear (% points / h)
  repair_rate_per_h: 0.5,       // habitat % points / h while repairing
  panel_repair_per_h: 0.004,    // panel_integrity / h while repairing
  cold_damage_per_h: 0.3,       // habitat % points / h during blackout
  panel_dust_per_h: 0.0004,     // dust settling on panels
  storm_dust_per_h: 0.0015,     // extra settling during a storm
  panel_dust_max: 0.6,
  clean_panels_kwh: 10,

  // Morale
  morale_base: 75,              // where morale sits when all is fine
  morale_response: 0.05,        // 5 %/h of the gap closed -> ~20 h time constant

  // Events
  event_scale: 8,               // probability speed-up (1 = real-world odds)
};

/**
 * Tuning for a SHORT (72 h = 3 day) mission. Pass as config.tuning:
 *   engine.init(seed, { location, data, tuning: SHORT_MISSION_TUNING })
 * Test results (Mars, 20 seeds): crew that does nothing dies ~40 %; crew that manages
 * generator / shelter / repair / eco mode survives 100 %. Smaller tanks make 72 h matter,
 * and event_scale 60 gives ~2-3 events per mission.
 */
export const SHORT_MISSION_TUNING = {
  mission_hours: 72, event_scale: 60,
  o2_capacity_kg: 10, food_capacity_kg: 16, fuel_kwh_per_pct: 10, battery_kwh: 350,
  o2_leak_max_kg_h: 0.8, habitat_decay_per_h: 0.08, cold_damage_per_h: 0.6,
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
      panel_area_m2: 700, battery_kwh: 900,
      event_rate_flare: 0.0004, event_rate_meteor: 0.0001, event_rate_storm: 0.0003,
    },
  },
  moon: {
    env: {
      solar_flux_wm2: 1361,
      temp_mean_c: -60, temp_amp_c: 40,
      dust_tau: 0,
      day_length_h: 708.7, daylight_fraction: 0.8, // polar-ish site, short night
      background_dose_msv_h: 0.057,       // ≈ 1.37 mSv/day (Chang'e-4)
      start_phase: 0.1,
      source: 'preset:moon',
    },
    tuning: {
      panel_area_m2: 120, battery_kwh: 1500,
      panel_dust_per_h: 0.0001,
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
    doseTotal: [5, 20, 80],       // mSv received by an unshielded crew
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
    duration: [48, 120, 240],     // hours (jittered ±25 %)
    tauAdd: [0.8, 1.8, 3.0],      // extra optical depth: sunlight x exp(-tau)
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
let actionLog = [];
const listeners = {};

function emit(type, payload) {
  (listeners[type] || []).forEach(fn => fn(payload, type));
  (listeners['*'] || []).forEach(fn => fn(payload, type));
}

/** Subscribe to engine notifications. Returns an unsubscribe function. */
export function subscribe(type, fn) {
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
export function seedEnvironment(data = {}, base) {
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
  // temperature swings between (mean - amp) at night and (mean + amp) at noon.
  d.temp_c = env.temp_mean_c + env.temp_amp_c * (2 * d.daylight - 1);
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
  let rover = s.modes.rover && s.fuel > 0;   // rover needs fuel
  let repair = s.modes.repair;
  let load = T.base_load_kw + lsFactor * T.life_support_kw + heater
    + (rover ? T.rover_kw : 0) + (repair ? T.repair_kw : 0);

  // 4. BLACKOUT --------------------------------------------------------
  // empty battery and supply < demand: shed everything except critical loads.
  d.blackout = s.power <= 0 && supply < load;
  let ls = lsFactor; // effective life-support level used for oxygen recycling
  if (d.blackout) { ls = 0; rover = false; repair = false; load = T.blackout_load_kw; }
  d.load_kw = load; d.net_kw = supply - load;
  d.rover_on = rover; d.repair_on = repair; d.ls_level = ls;

  // 5. RADIATION (mSv per hour) ------------------------------------------
  const flare = s.active_events.find(e => e.type === 'solar_flare');
  // raw dose = background + flare dose spread over the flare's duration.
  const raw = env.background_dose_msv_h + (flare ? flare.dose_unshielded_msv_h : 0);
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
    / T.food_capacity_kg * 100;
  // shielding: slow settling/erosion.
  r.shielding = -T.shield_degrade_per_h;
  // habitat: wear, minus repair gain, minus cold damage in blackout.
  r.habitat_health = -T.habitat_decay_per_h + (repair ? T.repair_rate_per_h : 0)
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
function startFlare(i, events) {
  const d = EVENT_TYPES.solar_flare;
  addActive('solar_flare', i, d.duration[i], { dose_unshielded_msv_h: d.doseTotal[i] / d.duration[i] });
  S.power = clamp(S.power - d.surgeLossPct[i], 0, 100);
  hit(d.moraleHit[i]);
  events.push({ id: `solar_flare-${S.hour}`, type: 'solar_flare', phase: 'start', hour: S.hour,
    severity: SEVERITY[i], title: d.title, duration: d.duration[i],
    effects: { radiation_msv_unshielded: d.doseTotal[i], battery_pct: -d.surgeLossPct[i], morale: -d.moraleHit[i] },
    message: `RADIATION SPIKE (${SEVERITY[i]}): up to ${d.doseTotal[i]} mSv over ${d.duration[i]} h for an unshielded crew`
      + (d.surgeLossPct[i] ? `; electronics surge drained ${d.surgeLossPct[i]} % battery` : '') + '. Shelter or add shielding!' });
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

function startStorm(i, jitterRoll, events) {
  const d = EVENT_TYPES.dust_storm;
  const dur = Math.round(d.duration[i] * (0.75 + 0.5 * jitterRoll)); // ±25 % jitter
  addActive('dust_storm', i, dur, { tau_add: d.tauAdd[i] });
  hit(d.moraleHit[i]);
  const cut = Math.round((1 - Math.exp(-d.tauAdd[i])) * 100);
  events.push({ id: `dust_storm-${S.hour}`, type: 'dust_storm', phase: 'start', hour: S.hour,
    severity: SEVERITY[i], title: d.title, duration: dur,
    effects: { solar_output_pct: -cut, morale: -d.moraleHit[i] },
    message: `DUST STORM (${SEVERITY[i]}): solar output down ~${cut} % for ~${dur} h. Consider eco mode or generator.` });
}

function rollEvents(events) {
  // 8. FIXED RNG DRAWS: always 8, in this order, so the timeline never depends on actions.
  const r = Array.from({ length: 8 }, () => rng());
  const chance = rate => 1 - Math.exp(-rate * T.event_scale); // rate/h -> probability this hour
  if (r[0] < chance(T.event_rate_flare) && !hasActive('solar_flare')) startFlare(sev(r[3]), events);
  if (r[1] < chance(T.event_rate_meteor)) startMeteor(sev(r[4]), r[6], events);
  if (r[2] < chance(T.event_rate_storm) && !hasActive('dust_storm')) startStorm(sev(r[5]), r[7], events);
}

/** Count down multi-hour events and report when they end. */
function tickEvents(events) {
  S.active_events = S.active_events.filter(e => {
    e.remaining -= 1;
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
    description: 'Uses power and fuel; boosts morale (exploration).',
    isOn: s => s.modes.rover,
    can: s => (!s.modes.rover && s.fuel <= 0 ? 'No fuel' : null),
    run: toggle('rover', 'Rover deployed: drawing power and fuel.', 'Rover parked.'),
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
    description: 'Restores habitat health (+0.5 %/h) and solar panels; draws power.',
    isOn: s => s.modes.repair,
    can: () => null,
    run: toggle('repair', 'Repair crew working.', 'Repair crew stood down.'),
  },
  toggle_ration: {
    label: 'Ration food',
    description: 'Food use x0.75, morale target -10.',
    isOn: s => s.modes.ration,
    can: () => null,
    run: toggle('ration', 'Food rationing ON.', 'Food rationing OFF.'),
  },
  toggle_shelter: {
    label: 'Radiation shelter',
    description: 'Crew shelter: dose x0.25, morale target -15. Use during solar flares.',
    isOn: s => s.modes.shelter,
    can: () => null,
    run: toggle('shelter', 'Crew moved to radiation shelter.', 'Crew left the shelter.'),
  },
  clean_panels: {
    label: 'Clean solar panels',
    description: 'Removes dust from panels for clean_panels_kwh of battery.',
    isOn: () => false,
    can: (s, T) => (s.panel_dust < 0.02 ? 'Panels already clean'
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
export function init(seed, config = {}) {
  origConfig = JSON.parse(JSON.stringify(config));
  const location = config.location || (config.data && config.data.location) || 'mars';
  const preset = PRESETS[location] || PRESETS.mars;
  T = { ...TUNING, ...preset.tuning, ...(config.tuning || {}) };
  ENV = seedEnvironment(config.data || {}, preset.env);
  rng = mulberry32(seedToInt(seed));
  actionLog = [];
  S = createInitialState({ seed, location, tuning: T, initial: config.initial });
  refreshRates();
  return snapshot(S);
}

/** Advance one hour. Returns { state, events }. */
export function step() {
  if (!S) throw new Error('simEngine: call init() first');
  if (S.game_over) return { state: snapshot(S), events: [] };

  const events = [];
  S.hour += 1;
  rollEvents(events);                                  // new events (instant effects applied now)

  const before = Object.fromEntries(CORE_KEYS.map(k => [k, S[k]]));
  refreshRates();                                      // rates for this hour
  for (const k of CORE_KEYS) S[k] = clamp(S[k] + S.rates[k], 0, 100); // value += rate
  S.radiation_dose += S.diagnostics.radiation_msv_h;   // cumulative dose
  const storm = S.active_events.some(e => e.type === 'dust_storm');
  S.panel_dust = clamp(S.panel_dust + T.panel_dust_per_h + (storm ? T.storm_dust_per_h : 0), 0, T.panel_dust_max);
  if (S.diagnostics.repair_on) S.panel_integrity = Math.min(1, S.panel_integrity + T.panel_repair_per_h);
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
export function applyAction(actionId) {
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
export function debugTriggerEvent(type, severity = 1, opts = {}) {
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
export function applyEffects(effects = {}, label = 'decision') {
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

/** Current state snapshot (safe to keep / mutate). */
export function getState() { return S ? snapshot(S) : null; }

/** Action list for building buttons. */
export function listActions() {
  return Object.entries(ACTIONS).map(([id, a]) => ({
    id, label: a.label, description: a.description,
    active: S ? a.isOn(S) : false,
    disabled_reason: S ? a.can(S, T) : null,
  }));
}

/** Effective numbers (tuning + environment) for a debug / judges panel. */
export function getConfig() { return { tuning: { ...T }, environment: { ...ENV } }; }

/** Everything needed to reproduce this run. */
export function getReplayLog() {
  return { seed: S.seed, config: origConfig, actions: [...actionLog], hours: S.hour };
}

/** Re-run a log from scratch (silent) and return the final state. */
export function replay(log, hours = log.hours) {
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