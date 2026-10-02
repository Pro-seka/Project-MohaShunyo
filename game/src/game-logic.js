/**
 * /game/src/game-logic.js
 * Mars Outpost: deterministic game engine (pure logic).
 *
 * - No DOM, no network, no imports. Levels are passed in as plain objects.
 * - All randomness comes from a stateless seeded hash: rand(seed, a, b, c).
 *   The same seed + same choices + same envData always gives the same game,
 *   and "luck" (faults, flares, leaks) depends only on the turn number, so two
 *   players with different choices face the same bad luck.
 * - All NASA-data mappings are GAME-BALANCING choices inspired by real
 *   measurements, not a physics simulation.
 *
 * Public API (contract 4.1): createGame, step, evaluateWinLoss.
 * Extra named exports (multiplier functions, TUNING, ...) exist for tests.
 */

// ───────────────────────── constants ─────────────────────────

export const SYSTEMS = Object.freeze(['power', 'lifeSupport', 'shield', 'food']);
export const SYSTEM_NAMES = Object.freeze({
  power: 'Power',
  lifeSupport: 'Life Support',
  shield: 'Radiation Shield',
  food: 'Greenhouse',
});

/** Every balancing number lives here so it can be tuned (and documented) in one place. */
export const TUNING = {
  solarBase: 44, // battery % gained in one perfect daytime phase
  loads: { lifeSupport: 3.5, heater: 2, food: 2.5, shield: 1.5, misc: 1 }, // battery % per phase
  upkeepPerUpgrade: 0.1, // each upgrade level adds +10% to that system's load
  crewAir: 6, // oxygen % used per phase
  scrubber: 9, // oxygen % made per phase by a perfect scrubber
  plantAir: 0.1, // oxygen per point of crop growth
  crewFood: 4, // food % eaten per phase
  growthDay: 6, // food % grown in a perfect day phase
  growthNight: 3, // ...and night phase (grow lights only)
  shieldWear: 0.6, // shield integrity lost per phase at baseline radiation
  dose: 1.2, // crew dose per phase at baseline radiation with no shield
  doseBlock: 0.85, // a 100% shield blocks 85% of the dose
  unpoweredShieldPenalty: 1.5, // wear multiplier if shield loads are not fully powered
  flareMult: 3, // solar particle event multiplier on wear and dose
  panelDustPenalty: 0.6, // 100% dust on panels removes 60% of output
  wear: { power: 0.3, lifeSupport: 0.4, food: 0.3 }, // condition lost per phase
  repair: { amount: 25, shieldAmount: 20, clean: 40, failurePenalty: 3, minNeed: 98 },
  upgrade: {
    maxLevel: 3,
    partialDamage: 10,
    gain: { power: 0.15, lifeSupport: 0.12, shield: 0.2, food: 0.15 },
    cost: {
      power: { battery: 10 },
      lifeSupport: { battery: 12 },
      shield: { battery: 12 },
      food: { battery: 8, food: 6 },
    },
  },
  research: { battery: 3, perBreakthrough: 3, maxBreakthroughs: 2 },
  breakthrough: { power: 0.08, lifeSupport: 0.1, shield: 0.15, food: 0.1 },
  actionBase: { repair: 0.85, upgrade: 0.9, research: 0.7 },
  actionAp: { repair: 1, upgrade: 2, research: 1, allocate: 1 },
  cold: { heaterFrac: 0.6, tempC: -20, lsDamage: 3, foodDamage: 4 },
  leak: { airMin: 6, airSpan: 8, sealDamage: 4 },
  fault: { dmgMin: 15, dmgSpan: 16, cascadeChance: 0.35, cascadeBelow: 40, cascadeMin: 8, cascadeSpan: 8 },
  score: { perSol: 10, perStock: 1.5, perDose: -2, perUpgrade: 20, perBreakthrough: 30, winBonus: 150, fullBonus: 150 },
};

/** Fallback values used when an envData field is missing/null. Also the "feel" of each level profile. */
export const PROFILES = {
  calm: { temperature: -55, pressure: 720, windSpeed: 4, dustOpacity: 0.15, radiation: 0.03 },
  unstable: { temperature: -68, pressure: 660, windSpeed: 9, dustOpacity: 0.4, radiation: 0.04 },
  cascade: { temperature: -75, pressure: 620, windSpeed: 10, dustOpacity: 0.5, radiation: 0.05 },
};

const ENV_RANGES = {
  temperature: [-140, 30],
  pressure: [300, 1200],
  windSpeed: [0, 60],
  dustOpacity: [0, 1],
  radiation: [0, 0.5],
  solarIrradiance: [0, 800],
};

export const LEVEL_DEFAULTS = {
  id: 'level-1',
  name: 'First Sol',
  starterResources: { power: 100, oxygen: 100, food: 80, shield: 100 },
  envProfile: 'calm',
  actionPoints: 3,
  turnLimit: 20,
  hazards: { faultChance: 0, flareChance: 0, leakScale: 0.3, escalation: 0, cascade: false },
  winConditions: { minOxygen: 25, minFood: 25, minPower: 15, minShield: 30, maxRadiation: 70 },
  excellence: { minOxygen: 60, minFood: 50, minPower: 50, minShield: 60, maxRadiation: 30, minUpgrades: 2 },
};

// ───────────────────────── small helpers ─────────────────────────

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v, fallback) => (isNum(v) ? v : fallback);
const r1 = (x) => Math.round(x * 10) / 10;
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Stateless seeded random in [0,1). Different (a,b,c) keys give independent streams. */
function rand(seed, a = 0, b = 0, c = 0) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const v of [a, b, c]) {
    h = Math.imul(h ^ ((v + 0x7f4a7c15) | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function toSeed(v) {
  if (isNum(v)) return Math.floor(v) | 0;
  if (typeof v === 'string') {
    let h = 2166136261;
    for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 16777619);
    return h | 0;
  }
  return 1;
}

// ───────────────────────── NASA data -> multipliers ─────────────────────────
// Each function accepts null/undefined (uses a neutral fallback) and clamps its output.

/** Dust opacity 0..1 -> solar multiplier 1.0..0.2 (linear). */
export function dustToSolar(dust) {
  return clamp(1 - 0.8 * clamp(num(dust, 0.3), 0, 1), 0.2, 1);
}

/** Measured irradiance (W/m2) -> solar multiplier. 450 W/m2 ~ "full sun" for the game. */
export function irradianceToSolar(irr) {
  return clamp(num(irr, 450) / 450, 0.2, 1);
}

/** Blend of the dust and irradiance mappings; falls back to dust only when irradiance is null. */
export function solarMultiplier(env) {
  const byDust = dustToSolar(env && env.dustOpacity);
  if (!env || !isNum(env.solarIrradiance)) return byDust;
  return clamp(0.5 * byDust + 0.5 * irradianceToSolar(env.solarIrradiance), 0.2, 1);
}

/** Temperature (C) -> heater power-draw multiplier 0.5..2.0. -60 C = 1.0. */
export function temperatureToHeater(t) {
  return clamp(1 + (-num(t, -60) - 60) / 60, 0.5, 2);
}

/** Temperature (C) -> life-support load multiplier 0.85..1.4. -60 C = 1.0. */
export function temperatureToLifeSupportLoad(t) {
  return clamp(1 + (-num(t, -60) - 60) / 150, 0.85, 1.4);
}

/** Radiation (mSv/h, normalized) -> shield wear + dose multiplier 0.5..3.0. 0.03 = 1.0. */
export function radiationToShieldDegradation(r) {
  return clamp(num(r, 0.03) / 0.03, 0.5, 3);
}

/** Pressure (Pa) -> base chance of a habitat leak per phase, 0.02..0.35. 700 Pa = 5%. */
export function pressureToLeakChance(p) {
  return clamp(0.05 + (700 - num(p, 700)) * 0.0008, 0.02, 0.35);
}

/** Wind (m/s) -> % of panel area covered with dust per day phase (at neutral opacity), 0.5..6. */
export function windToDustDeposition(w) {
  return clamp(0.5 + 0.5 * num(w, 5), 0.5, 6);
}

/** Dust opacity -> crop growth multiplier 1.0..0.5 (less light reaches the plants). */
export function dustToGrowth(dust) {
  return clamp(1 - 0.5 * clamp(num(dust, 0.3), 0, 1), 0.5, 1);
}

export function computeMultipliers(env) {
  return {
    solar: solarMultiplier(env),
    heater: temperatureToHeater(env && env.temperature),
    lsLoad: temperatureToLifeSupportLoad(env && env.temperature),
    rad: radiationToShieldDegradation(env && env.radiation),
    leak: pressureToLeakChance(env && env.pressure),
    deposition: windToDustDeposition(env && env.windSpeed),
    growth: dustToGrowth(env && env.dustOpacity),
  };
}

function hasProxy(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 3) return false;
  for (const [k, v] of Object.entries(obj)) {
    if (/proxy/i.test(k) && v) return true;
    if (typeof v === 'string' && /proxy/i.test(v)) return true;
    if (v && typeof v === 'object' && hasProxy(v, depth + 1)) return true;
  }
  return false;
}

/** Turns any envData (even null or partial) into a complete, clamped environment. */
export function sanitizeEnv(envData, profile = 'calm') {
  const base = PROFILES[profile] || PROFILES.calm;
  const src = envData && typeof envData === 'object' ? envData : {};
  const out = {};
  const fallbacks = [];
  for (const k of ['temperature', 'pressure', 'windSpeed', 'dustOpacity', 'radiation']) {
    if (isNum(src[k])) out[k] = clamp(src[k], ENV_RANGES[k][0], ENV_RANGES[k][1]);
    else {
      out[k] = base[k];
      fallbacks.push(k);
    }
  }
  out.solarIrradiance = isNum(src.solarIrradiance) ? clamp(src.solarIrradiance, ...ENV_RANGES.solarIrradiance) : null;
  out.timestamp = typeof src.timestamp === 'string' ? src.timestamp : null;
  out.proxy = hasProxy(src.sources);
  out.fallbacks = fallbacks;
  return out;
}

// ───────────────────────── narrative text ─────────────────────────

const NARR = {
  repair: {
    success: [
      'Your crew swaps worn parts on the {sys}. It hums like new.',
      'Careful hands and a fresh seal: the {sys} is back in great shape.',
    ],
    partial: [
      'You patch the {sys}, but one stubborn part stays glitchy. Only half fixed.',
      'Dust in the tools slows the job. The {sys} is partly repaired.',
    ],
    failure: [
      'A bolt strips and the fix falls apart. The {sys} is no better (a bit worse, actually).',
      'The spare part does not fit. The repair fails, so time to rethink.',
    ],
  },
  upgrade: {
    success: [
      'The new {sys} module clicks into place. A long-term win!',
      'Upgrade installed. The {sys} will pay you back every turn from now on.',
    ],
    partial: [
      'The {sys} upgrade works, but it needs tuning. Installed with teething problems.',
      'Half the new parts fit. The {sys} is better, but slightly damaged in the install.',
    ],
    failure: [
      'The prototype does not fit. Parts and power are used up and nothing changes.',
      'The upgrade fails a safety check and is scrapped. Ouch, that was expensive.',
    ],
  },
  research: {
    success: [
      'Experiment complete: clean data! You learned something real about the {sys}.',
      'The results match your prediction. Your team understands the {sys} better.',
    ],
    partial: [
      'Interesting, but the data is noisy. You will need one more run to be sure.',
      'A half-answer on the {sys}. Useful, but not conclusive.',
    ],
    failure: [
      'A sensor glitches and the samples are ruined. Science is like that sometimes.',
      'The experiment goes sideways. Nothing learned, and the battery took the hit.',
    ],
  },
};

const FACTS = {
  power: 'Fun fact: Mars rovers have been kept alive by wind gusts that blow dust off their panels.',
  lifeSupport: 'Fun fact: real habitats recycle water and CO2 because every kilogram sent to Mars is very expensive.',
  shield: 'Fun fact: Mars has almost no magnetic field, so soil (regolith) piled on a roof is a real shielding idea.',
  food: 'Fun fact: plants can grow without soil in nutrient water (hydroponics), which is how space greenhouses work.',
};

const BREAKTHROUGH = {
  power: ['Breakthrough: anti-static panel coating', 'Dust clings less to your panels: +8% solar output for good.'],
  lifeSupport: ['Breakthrough: better CO2 recycling', 'The crew wastes less air: about 10% less oxygen use for good.'],
  shield: ['Breakthrough: layered regolith plating', 'Extra layers of Martian soil slow the wear: 15% less shield damage for good.'],
  food: ['Breakthrough: hardier crops', 'A tougher strain of plants: +10% growth for good.'],
};

const FAULTS = {
  power: ['Solar wiring fault', 'A junction box shorts out and part of the array goes offline. Power condition -{d}%.'],
  lifeSupport: ['Scrubber fault', 'A CO2 scrubber cartridge clogs. Air recovers more slowly until it is repaired (-{d}%).'],
  food: ['Greenhouse pump fault', 'A hydroponic pump fails and the plants cannot drink (-{d}% condition).'],
  shield: ['Micrometeorite hit', 'A tiny rock strikes the shield plating. Integrity -{d}%.'],
};

const ALERT_T = {
  oxygen: { warn: 35, crit: 15, dir: 'low' },
  power: { warn: 25, crit: 8, dir: 'low' },
  food: { warn: 30, crit: 10, dir: 'low' },
  shield: { warn: 40, crit: 20, dir: 'low' },
  radiation: { warn: 55, crit: 80, dir: 'high' },
};

const ALERT_TEXT = {
  oxygen: ['Air reserves low', 'Oxygen is dropping. Check scrubber condition (repair Life Support) and make sure the battery is not empty.'],
  power: ['Battery low', 'The battery is running down. Clean the panels, wait out the dust, or use conserve mode (allocate Power).'],
  food: ['Food stores low', 'The crew is eating faster than the plants grow. Repair or upgrade the Greenhouse, and keep the lights powered.'],
  shield: ['Shield weakening', 'Radiation is wearing the shield down. Repair it before the dose meter climbs.'],
  radiation: ['Radiation dose rising', 'The crew has absorbed a lot of radiation. A stronger shield slows this; it cannot be reversed.'],
};

const ENV_FLAGS = [
  {
    key: 'storm', on: (e) => e.dustOpacity >= 0.6, off: (e) => e.dustOpacity < 0.45,
    onEv: ['warning', 'Dust storm', 'Dust in the air blocks sunlight, so solar panels make much less power and plants get less light. Save battery until it clears.'],
    offEv: ['info', 'Skies clearing', 'The dust is settling. Solar output is climbing back up.'],
  },
  {
    key: 'megastorm', on: (e) => e.dustOpacity >= 0.85, off: (e) => e.dustOpacity < 0.7,
    onEv: ['critical', 'Storm of the century', 'Almost no sunlight reaches the surface. Solar panels give only a trickle, so everything runs on the battery.'],
    offEv: null,
  },
  {
    key: 'gale', on: (e) => e.windSpeed >= 12, off: (e) => e.windSpeed < 9,
    onEv: ['warning', 'Strong winds', 'Wind lifts dust and drops it on your panels. Clean them (repair Power) or lose output.'],
    offEv: null,
  },
  {
    key: 'freeze', on: (e) => e.temperature <= -90, off: (e) => e.temperature > -80,
    onEv: ['warning', 'Deep freeze', 'It is brutally cold. Heaters work overtime, so the battery drains faster and the crew needs more life support.'],
    offEv: null,
  },
  {
    key: 'thin', on: (e) => e.pressure <= 560, off: (e) => e.pressure > 600,
    onEv: ['info', 'Pressure dip', 'Outside pressure is very low. Habitat seals are under more strain, so leaks are more likely.'],
    offEv: null,
  },
  {
    key: 'rad', on: (e) => e.radiation >= 0.06, off: (e) => e.radiation < 0.045,
    onEv: ['warning', 'Radiation spike', 'Radiation outside is high. Mars has almost no magnetic field, so your shield wears faster and the crew absorbs more.'],
    offEv: null,
  },
];

const TURN_FLAVOR = {
  success: ['A quiet {phase}. The outpost hums along.', 'A steady {phase}. Everyone sleeps a little easier.'],
  partial: ['A bumpy {phase}. Nothing broke for good, but watch the gauges.', 'A tense {phase}. Something slipped, and you will need to react.'],
  failure: ['A rough {phase}. A system is close to collapse.', 'A scary {phase}. The alarms will not stop.'],
};

const END_TEXT = {
  thriving: ['Mission complete: thriving!', 'The relief ship is in sight and your outpost is healthy. You planned, repaired and invested wisely. Legend status.'],
  limping: ['Mission complete: limping home', 'You survived, but the outpost is worn out. It is a real win, and there is room to do even better next time.'],
  suffocation: ['Mission failed: out of air', 'Oxygen ran out. Scrubbers need power and repairs, and dust storms cut the power they run on.'],
  radiation: ['Mission failed: radiation', 'The crew absorbed too much radiation. Shield integrity is the only thing between them and space weather.'],
  starvation: ['Mission failed: starvation', 'The food ran out and stayed out. Greenhouses need light, power and healthy pumps.'],
  blackout: ['Mission failed: blackout', 'The battery stayed empty. No power means no heat, no air scrubbing, no lights.'],
  'objectives-missed': ['Mission failed: goals missed', 'The crew is alive, but the outpost fell short of the mission minimums. Check the level goals and try a different mix.'],
};

const NEIGHBOR = { power: 'lifeSupport', lifeSupport: 'food', food: 'power' };
const OUTCOME_FACTOR = { success: 1, partial: 0.5, failure: 0 };

function fill(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

function pickText(arr, s, salt) {
  const r = rand(s.seed, s.turnIndex, 300 + salt, s.phaseActions.length);
  return arr[Math.floor(r * arr.length)];
}

// ───────────────────────── state ─────────────────────────

function normalizeLevel(cfg) {
  const src = cfg && cfg.level && typeof cfg.level === 'object' ? cfg.level : cfg && typeof cfg === 'object' ? cfg : {};
  const d = LEVEL_DEFAULTS;
  const sr = src.starterResources || {};
  return {
    id: typeof src.id === 'string' ? src.id : d.id,
    name: typeof src.name === 'string' ? src.name : d.name,
    starterResources: {
      power: clamp(num(sr.power, d.starterResources.power), 0, 100),
      oxygen: clamp(num(sr.oxygen, num(sr.lifeSupport, d.starterResources.oxygen)), 0, 100),
      food: clamp(num(sr.food, d.starterResources.food), 0, 100),
      shield: clamp(num(sr.shield, d.starterResources.shield), 0, 100),
    },
    envProfile: PROFILES[src.envProfile] ? src.envProfile : 'calm',
    actionPoints: clamp(Math.round(num(src.actionPoints, d.actionPoints)), 1, 8),
    turnLimit: clamp(Math.round(num(src.turnLimit, d.turnLimit)), 1, 200),
    hazards: { ...d.hazards, ...(src.hazards || {}) },
    winConditions: { ...d.winConditions, ...(src.winConditions || {}) },
    excellence: { ...d.excellence, ...(src.excellence || {}) },
  };
}

/**
 * Creates a game instance.
 * initialConfig: { level: <level JSON object>, seed: <number|string> }
 *   (a level JSON object may also be passed directly, with an optional "seed" field)
 */
export function createGame(initialConfig = {}) {
  const level = normalizeLevel(initialConfig);
  const seed = toSeed(initialConfig && initialConfig.seed !== undefined ? initialConfig.seed : initialConfig && initialConfig.level && initialConfig.level.seed);
  const zero = () => ({ power: 0, lifeSupport: 0, shield: 0, food: 0 });
  const state = {
    seed,
    level,
    day: 1,
    phase: 'day',
    turnIndex: 0,
    actionPoints: level.actionPoints,
    power: level.starterResources.power,
    oxygen: level.starterResources.oxygen,
    food: level.starterResources.food,
    shield: level.starterResources.shield,
    radiation: 5,
    panelDust: 5,
    conditions: { power: 100, lifeSupport: 100, food: 100 },
    upgrades: zero(),
    research: zero(),
    breakthroughs: zero(),
    priority: null,
    conserve: false,
    phaseActions: [],
    lastTurn: null,
    blackoutTurns: 0,
    starveTurns: 0,
    alerts: { oxygen: 0, power: 0, food: 0, shield: 0, radiation: 0 },
    envFlags: {},
    env: sanitizeEnv(null, level.envProfile),
    score: 0,
    result: { status: 'ongoing', reason: null, tier: null, score: 0 },
  };
  state.score = computeScore(state, null);
  return { version: '1.0.0', state };
}

// ───────────────────────── scoring & win/loss ─────────────────────────

function evaluate(s) {
  if (s.oxygen <= 0) return { status: 'failure', reason: 'suffocation', tier: null };
  if (s.radiation >= 100) return { status: 'failure', reason: 'radiation', tier: null };
  if (s.starveTurns >= 3) return { status: 'failure', reason: 'starvation', tier: null };
  if (s.blackoutTurns >= 3) return { status: 'failure', reason: 'blackout', tier: null };
  const lv = s.level || LEVEL_DEFAULTS;
  if (s.day > lv.turnLimit) {
    const w = { ...LEVEL_DEFAULTS.winConditions, ...(lv.winConditions || {}) };
    const ok = s.oxygen >= w.minOxygen && s.food >= w.minFood && s.power >= w.minPower && s.shield >= w.minShield && s.radiation <= w.maxRadiation;
    if (!ok) return { status: 'failure', reason: 'objectives-missed', tier: null };
    const e = { ...LEVEL_DEFAULTS.excellence, ...(lv.excellence || {}) };
    const upg = SYSTEMS.reduce((a, k) => a + s.upgrades[k], 0);
    const full = upg >= (e.minUpgrades || 0) && s.oxygen >= e.minOxygen && s.food >= e.minFood && s.power >= e.minPower && s.shield >= e.minShield && s.radiation <= e.maxRadiation;
    return { status: 'success', reason: full ? 'thriving' : 'limping', tier: full ? 'full' : 'partial' };
  }
  return { status: 'ongoing', reason: null, tier: null };
}

/** Returns 'ongoing' | 'success' | 'failure'. Accepts a state object or a game instance. */
export function evaluateWinLoss(gameState) {
  const s = gameState && gameState.state ? gameState.state : gameState;
  if (!s || typeof s !== 'object' || !isNum(s.oxygen)) return 'ongoing';
  return evaluate(s).status;
}

export function computeScore(s, res) {
  const K = TUNING.score;
  const sols = Math.min(s.day - 1, s.level.turnLimit);
  const upgrades = SYSTEMS.reduce((a, k) => a + s.upgrades[k], 0);
  const bts = SYSTEMS.reduce((a, k) => a + s.breakthroughs[k], 0);
  let score =
    K.perSol * sols +
    K.perStock * (s.oxygen + s.food + s.power + s.shield) +
    K.perDose * s.radiation +
    K.perUpgrade * upgrades +
    K.perBreakthrough * bts;
  if (res && res.status === 'success') score += K.winBonus + (res.tier === 'full' ? K.fullBonus : 0);
  return Math.max(0, Math.round(score));
}

// ───────────────────────── events & packing ─────────────────────────

function ev(s, severity, title, text, extra = {}) {
  return { type: 'info', title, text, severity, day: s.day, phase: s.phase, ...extra };
}

function buildUiState(s, events) {
  const ui = (v) => Math.round(clamp(v, 0, 100));
  return {
    day: Math.min(s.day, s.level.turnLimit),
    phase: s.day > s.level.turnLimit ? 'night' : s.phase,
    actionPoints: s.actionPoints,
    lifeSupport: ui(s.oxygen),
    radiation: ui(s.radiation),
    power: ui(s.power),
    food: ui(s.food),
    shield: ui(s.shield),
    dust: Math.round(clamp(s.env.dustOpacity, 0, 1) * 100) / 100,
    events: events.map((e) => ({ title: e.title, text: e.text, severity: e.severity })),
  };
}

function pack(s, events) {
  return { state: clone(s), events, uiState: buildUiState(s, events) };
}

// ───────────────────────── actions ─────────────────────────

function getCond(s, target) {
  return target === 'shield' ? s.shield : s.conditions[target];
}
function setCond(s, target, v) {
  const val = r1(clamp(v, 0, 100));
  if (target === 'shield') s.shield = val;
  else s.conditions[target] = val;
}

function rollOutcome(s, type, target, k) {
  const outdoor = target === 'power' || target === 'shield';
  const penalty = (outdoor ? 0.35 : 0.1) * s.env.dustOpacity + (s.phase === 'night' ? 0.05 : 0);
  const chance = clamp(TUNING.actionBase[type] - penalty + 0.04 * s.breakthroughs[target], 0.3, 0.97);
  const r = rand(s.seed, s.turnIndex, 100 + s.phaseActions.length, k);
  if (r < chance) return 'success';
  if (r < chance + (1 - chance) * 0.6) return 'partial';
  return 'failure';
}

function record(s, type, target, outcome) {
  s.phaseActions.push({ type, target, outcome });
}

function applyAction(s, a, events) {
  const type = a.type;
  const target = a.target;
  if (!TUNING.actionAp[type]) {
    events.push(ev(s, 'warning', 'Unknown order', `The crew does not know how to "${String(type)}". Try repair, upgrade, research, allocate or endTurn.`, { type: 'action' }));
    return;
  }
  if (!SYSTEMS.includes(target)) {
    events.push(ev(s, 'warning', 'Pick a system', `${type} needs a target: power, lifeSupport, shield or food.`, { type: 'action' }));
    return;
  }
  const repeats = type === 'repair' || type === 'research' ? clamp(Math.round(num(a.amount, 1)), 1, 3) : 1;
  for (let k = 0; k < repeats; k++) {
    if (!doOnce(s, type, target, k, events)) break;
  }
}

function doOnce(s, type, target, k, events) {
  const T = TUNING;
  const cost = T.actionAp[type];
  const name = SYSTEM_NAMES[target];
  const note = (severity, title, text) => events.push(ev(s, severity, title, text, { type: 'action', system: target }));
  if (s.actionPoints < cost) {
    note('warning', 'Out of action points', `${type} needs ${cost} action point${cost > 1 ? 's' : ''}, but you have ${s.actionPoints}. End the turn to rest.`);
    return false;
  }

  if (type === 'allocate') {
    s.actionPoints -= cost;
    if (target === 'power') {
      s.conserve = true;
      note('info', 'Conserve mode', 'Lights dimmed and extras switched off: the battery drains slower this phase, but plants grow slower too.');
    } else {
      s.priority = target;
      note('info', `Priority: ${name}`, `Power lines re-routed: ${name} gets first pick of the battery this phase. If power runs short, other systems go without.`);
    }
    record(s, type, target, 'success');
    return true;
  }

  if (type === 'repair') {
    const cur = getCond(s, target);
    const dirty = target === 'power' && s.panelDust > 10;
    if (cur >= T.repair.minNeed && !dirty) {
      note('info', 'Nothing to fix', `${name} is already in top shape. No action point spent.`);
      return false;
    }
    s.actionPoints -= cost;
    const outcome = rollOutcome(s, type, target, k);
    const f = OUTCOME_FACTOR[outcome];
    let extra = '';
    if (outcome === 'failure') setCond(s, target, cur - T.repair.failurePenalty);
    else {
      setCond(s, target, cur + (target === 'shield' ? T.repair.shieldAmount : T.repair.amount) * f);
      if (target === 'power') {
        const was = s.panelDust;
        s.panelDust = r1(Math.max(0, s.panelDust - T.repair.clean * f));
        if (was - s.panelDust > 1) extra = ` Panels brushed: dust ${Math.round(was)}% to ${Math.round(s.panelDust)}%.`;
      }
    }
    const label = target === 'shield' ? 'integrity' : 'condition';
    note(outcome === 'success' ? 'info' : 'warning', `Repair ${name}: ${outcome}`, `${fill(pickText(NARR.repair[outcome], s, 1), { sys: name })} ${name} ${label} ${Math.round(cur)}% to ${Math.round(getCond(s, target))}%.${extra}`);
    record(s, type, target, outcome);
    return true;
  }

  if (type === 'upgrade') {
    const lvl = s.upgrades[target];
    if (lvl >= T.upgrade.maxLevel) {
      note('info', 'Fully upgraded', `${name} is already at the maximum level. No action point spent.`);
      return false;
    }
    const c = T.upgrade.cost[target];
    if (s.power < c.battery || (c.food && s.food < c.food)) {
      note('warning', 'Not enough resources', `Upgrading ${name} costs ${c.battery}% battery${c.food ? ` and ${c.food}% food (seed stock)` : ''}. Nothing was spent.`);
      return false;
    }
    s.actionPoints -= cost;
    s.power = r1(s.power - c.battery);
    if (c.food) s.food = r1(s.food - c.food);
    const outcome = rollOutcome(s, type, target, k);
    let tail = '';
    if (outcome !== 'failure') {
      s.upgrades[target] = lvl + 1;
      tail = ` ${name} is now level ${lvl + 1}.`;
      if (outcome === 'partial') {
        setCond(s, target, getCond(s, target) - T.upgrade.partialDamage);
        tail += ` The install cost ${T.upgrade.partialDamage}% ${target === 'shield' ? 'integrity' : 'condition'}.`;
      }
    }
    note(outcome === 'success' ? 'info' : 'warning', `Upgrade ${name}: ${outcome}`, `${fill(pickText(NARR.upgrade[outcome], s, 2), { sys: name })}${tail}`);
    record(s, type, target, outcome);
    return true;
  }

  // research
  if (s.breakthroughs[target] >= T.research.maxBreakthroughs) {
    note('info', 'Nothing left to learn', `Your team has mastered the ${name} for this mission. No action point spent.`);
    return false;
  }
  if (s.power < T.research.battery) {
    note('warning', 'Not enough battery', `Experiments need ${T.research.battery}% battery. Nothing was spent.`);
    return false;
  }
  s.actionPoints -= cost;
  s.power = r1(s.power - T.research.battery);
  const outcome = rollOutcome(s, type, target, k);
  s.research[target] = r1(s.research[target] + OUTCOME_FACTOR[outcome]);
  let tail = outcome === 'success' ? ` ${FACTS[target]}` : '';
  let bt = false;
  if (s.research[target] >= T.research.perBreakthrough) {
    s.research[target] = r1(s.research[target] - T.research.perBreakthrough);
    s.breakthroughs[target] += 1;
    bt = true;
  }
  note(outcome === 'success' ? 'info' : 'warning', `Research ${name}: ${outcome}`, `${fill(pickText(NARR.research[outcome], s, 3), { sys: name })}${tail}`);
  if (bt) note('info', BREAKTHROUGH[target][0], BREAKTHROUGH[target][1]);
  record(s, type, target, outcome);
  return true;
}

// ───────────────────────── environment events ─────────────────────────

function syncEnvFlags(s, events) {
  for (const f of ENV_FLAGS) {
    const active = !!s.envFlags[f.key];
    if (!active && f.on(s.env)) {
      s.envFlags[f.key] = true;
      events.push(ev(s, f.onEv[0], f.onEv[1], f.onEv[2], { type: 'weather' }));
    } else if (active && f.off(s.env)) {
      s.envFlags[f.key] = false;
      if (f.offEv) events.push(ev(s, f.offEv[0], f.offEv[1], f.offEv[2], { type: 'weather' }));
    }
  }
}

function alertLevel(kind, v) {
  const t = ALERT_T[kind];
  if (t.dir === 'low') return v < t.crit ? 2 : v < t.warn ? 1 : 0;
  return v >= t.crit ? 2 : v >= t.warn ? 1 : 0;
}

function syncAlerts(s, events) {
  const vals = { oxygen: s.oxygen, power: s.power, food: s.food, shield: s.shield, radiation: s.radiation };
  for (const kind of Object.keys(ALERT_T)) {
    const lvl = alertLevel(kind, vals[kind]);
    if (lvl > s.alerts[kind]) {
      const [title, text] = ALERT_TEXT[kind];
      events.push(ev(s, lvl === 2 ? 'critical' : 'warning', lvl === 2 ? `${title}: CRITICAL` : title, text, { type: 'alert', system: kind }));
    }
    s.alerts[kind] = lvl;
  }
}

// ───────────────────────── phase resolution ─────────────────────────

function hurt(s, target, dmg) {
  setCond(s, target, getCond(s, target) - dmg);
}

function resolvePhase(s, events) {
  const T = TUNING;
  const H = s.level.hazards;
  const env = s.env;
  const m = computeMultipliers(env);
  const isDay = s.phase === 'day';
  const t = s.turnIndex;
  const R = (n) => rand(s.seed, t, n);
  const esc = 1 + (H.escalation || 0) * (s.day - 1);
  const before = { power: s.power, oxygen: s.oxygen, food: s.food, shield: s.shield };
  const doneDay = s.day;
  const donePhase = s.phase;
  let hazardHit = false;

  // 1. random equipment fault
  if (R(1) < (H.faultChance || 0) * esc) {
    const target = SYSTEMS[Math.floor(R(2) * SYSTEMS.length)];
    const dmg = T.fault.dmgMin + Math.floor(R(3) * T.fault.dmgSpan);
    const applied = target === 'shield' ? Math.round(dmg * 0.8) : dmg;
    hurt(s, target, applied);
    hazardHit = true;
    events.push(ev(s, 'warning', FAULTS[target][0], fill(FAULTS[target][1], { d: applied }), { type: 'hazard', system: target }));
  }

  // 2. cascade: the weakest linked system drags its neighbour down
  if (H.cascade) {
    const chain = ['power', 'lifeSupport', 'food'];
    const weak = chain.reduce((a, b) => (s.conditions[b] < s.conditions[a] ? b : a));
    if (s.conditions[weak] < T.fault.cascadeBelow && R(7) < T.fault.cascadeChance) {
      const victim = NEIGHBOR[weak];
      const dmg = T.fault.cascadeMin + Math.floor(R(8) * T.fault.cascadeSpan);
      hurt(s, victim, dmg);
      hazardHit = true;
      events.push(ev(s, 'critical', 'Cascade failure', `With the ${SYSTEM_NAMES[weak]} weakened, the strain spilled onto the ${SYSTEM_NAMES[victim]} (-${dmg}%). Systems are linked: fix the weakest one first.`, { type: 'hazard', system: victim }));
    }
  }

  // 3. solar particle event
  const flare = R(4) < (H.flareChance || 0);
  const flareMult = flare ? T.flareMult : 1;
  if (flare) {
    hazardHit = true;
    events.push(ev(s, 'warning', 'Solar particle event', 'A burst of charged particles from the Sun. Mars has almost no magnetic field to deflect them, so the shield takes triple wear this phase.', { type: 'hazard', system: 'shield' }));
  }

  // 4. habitat leak (pressure-driven)
  const leakChance = m.leak * (H.leakScale === undefined ? 1 : H.leakScale) * (1.5 - s.conditions.lifeSupport / 100);
  if (R(5) < leakChance) {
    const loss = T.leak.airMin + Math.floor(R(6) * T.leak.airSpan);
    s.oxygen = Math.max(0, s.oxygen - loss);
    hurt(s, 'lifeSupport', T.leak.sealDamage);
    hazardHit = true;
    events.push(ev(s, 'warning', 'Habitat leak', `Outside pressure is only ${Math.round(env.pressure)} Pa, and when weather shifts it the seals flex and can leak. You lost ${loss}% of your air.`, { type: 'hazard', system: 'lifeSupport' }));
  }

  // 5. power: generation, loads, brownouts
  let gen = 0;
  if (isDay) {
    s.panelDust = clamp(s.panelDust + m.deposition * (0.5 + env.dustOpacity), 0, 100);
    gen = T.solarBase * m.solar * (s.conditions.power / 100) * (1 - (T.panelDustPenalty * s.panelDust) / 100) * (1 + T.upgrade.gain.power * s.upgrades.power) * (1 + T.breakthrough.power * s.breakthroughs.power);
  }
  const up = (k) => 1 + T.upkeepPerUpgrade * s.upgrades[k];
  let loads = [
    { k: 'lifeSupport', d: T.loads.lifeSupport * up('lifeSupport') },
    { k: 'heater', d: T.loads.heater * m.heater },
    { k: 'food', d: T.loads.food * up('food') * (s.conserve ? 0.6 : 1) },
    { k: 'shield', d: T.loads.shield * up('shield') },
    { k: 'misc', d: T.loads.misc * (s.conserve ? 0.5 : 1) },
  ];
  if (s.priority) loads = [...loads.filter((l) => l.k === s.priority), ...loads.filter((l) => l.k !== s.priority)];
  let avail = s.power + gen;
  const frac = {};
  for (const l of loads) {
    const served = Math.min(l.d, Math.max(avail, 0));
    frac[l.k] = l.d > 0 ? served / l.d : 1;
    avail -= served;
  }
  s.power = clamp(avail, 0, 100);
  if (isDay) s.conditions.power = Math.max(0, s.conditions.power - T.wear.power * esc);

  // 6. cold damage if the heater is starved
  if (frac.heater < T.cold.heaterFrac && env.temperature < T.cold.tempC) {
    hurt(s, 'lifeSupport', T.cold.lsDamage);
    hurt(s, 'food', T.cold.foodDamage);
    hazardHit = true;
    events.push(ev(s, 'warning', 'Habitat cooling', 'The heaters are starved of power and the habitat is getting cold. Pipes and plants are taking damage.', { type: 'hazard' }));
  }

  // 7. food
  const growth = (isDay ? T.growthDay : T.growthNight) * frac.food * (s.conditions.food / 100) * m.growth * (1 + T.upgrade.gain.food * s.upgrades.food) * (1 + T.breakthrough.food * s.breakthroughs.food) * (s.conserve ? 0.6 : 1);
  s.food = clamp(s.food + growth - T.crewFood, 0, 100);
  s.conditions.food = Math.max(0, s.conditions.food - T.wear.food * esc);

  // 8. life support
  const scrub = T.scrubber * frac.lifeSupport * (s.conditions.lifeSupport / 100) * (1 + T.upgrade.gain.lifeSupport * s.upgrades.lifeSupport);
  const crew = T.crewAir * m.lsLoad * (1 - T.breakthrough.lifeSupport * s.breakthroughs.lifeSupport);
  s.oxygen = clamp(s.oxygen + scrub - crew + T.plantAir * growth, 0, 100);
  s.conditions.lifeSupport = Math.max(0, s.conditions.lifeSupport - T.wear.lifeSupport * esc);

  // 9. shield and radiation dose
  const wear = T.shieldWear * m.rad * flareMult * (1 - T.upgrade.gain.shield * s.upgrades.shield) * (1 - T.breakthrough.shield * s.breakthroughs.shield) * (frac.shield < 1 ? T.unpoweredShieldPenalty : 1);
  s.shield = Math.max(0, s.shield - wear);
  s.radiation = Math.min(100, s.radiation + T.dose * m.rad * flareMult * (1 - (T.doseBlock * s.shield) / 100));

  // tidy numbers
  for (const k of ['power', 'oxygen', 'food', 'shield', 'radiation', 'panelDust']) s[k] = r1(s[k]);
  for (const k of Object.keys(s.conditions)) s.conditions[k] = r1(s.conditions[k]);

  // failure counters
  s.blackoutTurns = s.power <= 0 ? s.blackoutTurns + 1 : 0;
  s.starveTurns = s.food <= 0 ? s.starveTurns + 1 : 0;

  // advance the clock
  s.turnIndex += 1;
  if (donePhase === 'day') s.phase = 'night';
  else {
    s.phase = 'day';
    s.day += 1;
  }
  s.actionPoints = s.phase === 'day' ? s.level.actionPoints : Math.max(1, s.level.actionPoints - 1);
  const actions = s.phaseActions;
  s.phaseActions = [];
  s.priority = null;
  s.conserve = false;

  syncAlerts(s, events);

  // classify the turn
  const worst = Math.max(...Object.values(s.alerts));
  const bad = actions.filter((a) => a.outcome === 'failure').length;
  const notClean = actions.filter((a) => a.outcome !== 'success').length;
  let outcome = 'success';
  if (worst >= 2 || (actions.length >= 2 && bad * 2 >= actions.length)) outcome = 'failure';
  else if (worst >= 1 || notClean > 0 || hazardHit) outcome = 'partial';
  const label = { success: 'Success', partial: 'Partial success', failure: 'Setback' }[outcome];
  const sign = (n) => (n >= 0 ? '+' : '') + Math.round(n);
  const flavor = fill(pickTurnFlavor(s, outcome, t), { phase: donePhase });
  const netText = `Battery ${sign(s.power - before.power)}, air ${sign(s.oxygen - before.oxygen)}, food ${sign(s.food - before.food)}, shield ${sign(s.shield - before.shield)}.`;
  events.push(ev(s, outcome === 'success' ? 'info' : outcome === 'partial' ? 'warning' : 'critical', `Sol ${doneDay} ${donePhase}: ${label}`, `${flavor} ${netText}`, { type: 'turn', outcome, day: doneDay, phase: donePhase }));
  s.lastTurn = { day: doneDay, phase: donePhase, outcome, actions };

  // mission end?
  const res = evaluate(s);
  s.score = computeScore(s, res);
  s.result = { ...res, score: s.score };
  if (res.status !== 'ongoing') {
    const [title, text] = END_TEXT[res.reason];
    events.push(ev(s, res.status === 'success' ? (res.tier === 'full' ? 'info' : 'warning') : 'critical', title, `${text} Final score: ${s.score}.`, { type: 'mission', outcome: res.status }));
  }
}

function pickTurnFlavor(s, outcome, t) {
  const arr = TURN_FLAVOR[outcome];
  return arr[Math.floor(rand(s.seed, t, 400) * arr.length)];
}

// ───────────────────────── step ─────────────────────────

/**
 * Applies player actions and, if the list contains {type:'endTurn'}, resolves the current phase.
 * Actions after 'endTurn' are ignored. envData may be null or partial.
 * Mutates gameInstance.state and returns { state (deep copy), events, uiState }.
 */
export function step(gameInstance, playerActions, envData) {
  const g = gameInstance && gameInstance.state ? gameInstance : createGame();
  const s = g.state;
  const events = [];
  if (s.result.status !== 'ongoing') {
    events.push(ev(s, 'info', 'Mission over', 'This mission has already ended. Start a new game to try again.', { type: 'mission' }));
    return pack(s, events);
  }
  s.env = sanitizeEnv(envData, s.level.envProfile);
  syncEnvFlags(s, events);

  const list = Array.isArray(playerActions) ? playerActions : playerActions ? [playerActions] : [];
  let ending = false;
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    if (a.type === 'endTurn') {
      ending = true;
      break;
    }
    applyAction(s, a, events);
  }
  if (ending) resolvePhase(s, events);
  return pack(s, events);
}
