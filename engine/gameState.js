/**
 * gameState.js — state shape, variable metadata and win/lose rules.
 * No physics lives here; see simEngine.js for the model.
 *
 * All seven core variables are stored on a 0–100 % scale so the UI can draw
 * them all as bars. Physical units (kWh, kg) are converted in simEngine.js.
 */

/*
## Sim event → visual / audio mapping  (implemented in `gameVisuals.js` → `EVENT_MAP`)

Engine events look like `{ type, phase: 'start'|'end', severity: 'minor'|'moderate'|'severe', target?, message }`.
Severity scales intensity: minor ×0.6, moderate ×1.0, severe ×1.6. Sound names are logical names from
`assets_manifest.json`; if the file is missing the listed fallback (then a WebAudio synth) plays.

| Engine event | Visual (canvas) | HUD | Audio cue (→ fallback) | Accessibility text |
|---|---|---|---|---|
| `solar_flare` start | One bright warm-white flash (0.35 s, never strobes); severe adds a small shake | ☢ radiation readout pulses for the whole flare (`active_events`) | `solar_flare` → `explosion` | `message` read by aria-live |
| `solar_flare` end | — | pulse stops | — | "has passed" |
| `micrometeorite` start, `target: habitat` | Shards + small explosion + shake + smoke at the habitat; scorch marks grow | — | `impact` → `explosion` | "MODULE DAMAGE…" |
| `micrometeorite` start, `target: solar_array` | Same at the array; scorch marks grow with lost `panel_integrity` (power drops) | power rate in bars turns negative | `impact` → `explosion` | "LOSS OF POWER…" |
| `micrometeorite` start, `target: oxygen_tank` | Same at the tank; smoke is white (venting gas) | O2 bar drops | `impact` → `explosion` | "OXYGEN TANK PUNCTURE…" |
| `dust_storm` start | Orange haze + darker scene (brightness falls with severity: 0.45/0.65/0.85), drifting dust particles | — | looped `dust_loop` → `ambient_loop` → synth wind | "DUST STORM…" |
| `dust_storm` end | Haze fades out smoothly | — | loop stops | "has passed" |
| `alert` (warning / critical) | — | bar colour (amber / red) | `alarm` (quieter for warning) | "Oxygen critical: 12 %" |
| player action OK | — | bars update | `button` | action message |
| `gameover` | Big explosion at habitat, long shake, red flash | — | `explosion` | "Mission over: reason" |
| mission won (`game_over.win`) | Celebration burst, no explosion | — | — | "Mission complete…" |
| first key/click | — | — | `boot` (also unlocks browser audio) | — |

Continuous effects (dust haze, dust loop, radiation HUD pulse, damage marks) are re-synced from the
real state every step, so they stay correct after a restart or a replay.

Demo keys (they call `engine.debugTriggerEvent`, so the state really changes):
`D` dust storm · `S` solar flare · `H` micrometeorite (hit) (cycles habitat → array → O2 tank) ·
`N` advance 1 hour · `U` mute · hold `Shift` = severe.
*/

/** The seven core variables, in display order. */
export const CORE_KEYS = [
  'fuel', 'power', 'oxygen', 'food', 'crew_morale', 'shielding', 'habitat_health',
];

/** UI metadata. `warn` / `crit` are the thresholds that raise 'alert' events. */
export const VARIABLES = {
  fuel:           { label: 'Fuel',            unit: '%', warn: 25, crit: 10 },
  power:          { label: 'Power (battery)', unit: '%', warn: 25, crit: 10 },
  oxygen:         { label: 'Oxygen',          unit: '%', warn: 30, crit: 15 },
  food:           { label: 'Food',            unit: '%', warn: 25, crit: 10 },
  crew_morale:    { label: 'Crew morale',     unit: '%', warn: 35, crit: 15 },
  shielding:      { label: 'Shielding',       unit: '%', warn: 20, crit: 10 },
  habitat_health: { label: 'Habitat health',  unit: '%', warn: 50, crit: 25 },
};

/** Starting values (override with config.initial in init()). */
export const INITIAL_VALUES = {
  fuel: 100, power: 90, oxygen: 100, food: 100,
  crew_morale: 75, shielding: 30, habitat_health: 100,
};

/** Clamp v into [lo, hi]. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Build a fresh state object. */
export function createInitialState({ seed, location, tuning, initial = {} }) {
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
    panel_integrity: 1.0,          // 0–1, fraction of solar array still working
    panel_dust: 0.0,               // 0–1, fraction of sunlight blocked by dust on panels
    shield_panels_left: tuning.shield_panel_count,

    // --- player-selected operating modes (set via applyAction) ---
    modes: {
      life_support: 'normal',      // 'normal' | 'eco'
      rover: false,
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
export function snapshot(state) {
  return JSON.parse(JSON.stringify(state));
}

/** Returns a reason string if the mission has failed, otherwise null. */
export function checkGameOver(s, T) {
  if (s.oxygen <= 0)              return 'Crew asphyxiated: oxygen exhausted';
  if (s.food <= 0)                return 'Crew starved: food exhausted';
  if (s.habitat_health <= 0)      return 'Habitat structural failure';
  if (s.crew_morale <= 0)         return 'Crew morale collapsed: mission abandoned';
  if (s.radiation_dose >= T.dose_limit_msv) return 'Radiation dose limit exceeded';
  return null;
}