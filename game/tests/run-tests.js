/**
 * /game/tests/run-tests.js
 * Plain Node, no dependencies:   node game/tests/run-tests.js
 * Options:  --verbose  print every event of every scenario
 *           --traces   print short markdown trace tables (used for design-spec.md)
 *
 * Sections: 1) multiplier unit tests  2) API/shape tests  3) rules tests
 *           4) determinism  5) level files  6) decision-sequence scenarios (traces)
 */
import { readFileSync } from 'node:fs';
import {
  createGame, step, evaluateWinLoss, computeScore, sanitizeEnv, computeMultipliers,
  dustToSolar, irradianceToSolar, solarMultiplier, temperatureToHeater, temperatureToLifeSupportLoad,
  radiationToShieldDegradation, pressureToLeakChance, windToDustDeposition, dustToGrowth,
  TUNING, SYSTEMS,
} from '../src/game-logic.js';

const VERBOSE = process.argv.includes('--verbose');
const TRACES = process.argv.includes('--traces');

// ───────────────────────── tiny test harness ─────────────────────────
const R = { ok: 0, fail: 0, failed: [] };
function test(name, fn) {
  try {
    fn();
    R.ok++;
    if (!TRACES) console.log(`  ok   ${name}`);
  } catch (e) {
    R.fail++;
    R.failed.push(name);
    console.log(`  FAIL ${name}\n         ${e.message}`);
  }
}
const assert = (c, m = 'assertion failed') => { if (!c) throw new Error(m); };
const same = (a, b, m = '') => assert(JSON.stringify(a) === JSON.stringify(b), `${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const near = (a, b, eps = 1e-3, m = '') => assert(Math.abs(a - b) <= eps, `${m} expected ~${b}, got ${a}`);
const section = (t) => { if (!TRACES) console.log(`\n== ${t}`); };

const levelFile = (n) => JSON.parse(readFileSync(new URL(`../src/levels/level-${n}.json`, import.meta.url), 'utf8'));
const LEVELS = { 1: levelFile(1), 2: levelFile(2), 3: levelFile(3) };

// ───────────────────────── scripted "NASA-like" environments ─────────────────────────
// Deterministic stand-ins for Ridwan's module. Some fields are deliberately null now and then.
function makeEnv(kind, day, phase) {
  const isDay = phase === 'day';
  const wob = Math.sin(day * 1.7 + (isDay ? 0 : 1));
  const bell = (c, w, h) => h * Math.exp(-(((day - c) / w) ** 2));
  let dust, wind, temp, pressure, rad;
  if (kind === 'calm') {
    dust = 0.15 + 0.05 * wob; wind = 4 + 1.5 * wob; temp = (isDay ? -45 : -78) + 4 * wob; pressure = 725 + 8 * wob; rad = 0.03;
  } else if (kind === 'storms') {
    dust = 0.3 + bell(11, 2.2, 0.42) + bell(23, 1.5, 0.3) + 0.04 * wob;
    wind = 7 + 5 * bell(11, 2.5, 1) + 1.5 * wob; temp = (isDay ? -50 : -85) + 4 * wob; pressure = 665 + 12 * wob;
    rad = 0.04 + (day >= 17 && day <= 18 ? 0.03 : 0);
  } else {
    dust = 0.4 + bell(10, 2.2, 0.42) + bell(27, 2.5, 0.3) + 0.04 * wob;
    wind = 9 + 4 * bell(10, 2.5, 1) + 4 * bell(27, 3, 1) + 1.5 * wob; temp = (isDay ? -58 : -96) + 4 * wob; pressure = 610 + 15 * wob;
    rad = 0.05 + (day >= 20 && day <= 22 ? 0.03 : 0);
  }
  dust = Math.min(1, Math.max(0, dust));
  const env = {
    timestamp: `sol-${day}-${phase}`,
    temperature: +temp.toFixed(1), pressure: Math.round(pressure), windSpeed: +wind.toFixed(1),
    dustOpacity: +dust.toFixed(2), radiation: +rad.toFixed(3),
    solarIrradiance: isDay ? Math.round(560 * (1 - 0.8 * dust)) : 0,
    sources: { dust: 'MEDA', radiation: 'proxy' },
  };
  if (day % 5 === 0 && !isDay) env.temperature = null; // missing data
  if (day % 4 === 0) env.solarIrradiance = null; // missing data
  return env;
}

// ───────────────────────── decision policies (the "players") ─────────────────────────
const AP = TUNING.actionAp;
function investor(s, o) {
  const acts = [];
  let ap = s.actionPoints;
  const cond = { ...s.conditions, shield: s.shield };
  const add = (a) => { if (AP[a.type] <= ap) { acts.push(a); ap -= AP[a.type]; } };
  const storm = s.env.dustOpacity >= 0.6;
  if (s.panelDust >= 30 || cond.power < 55) add({ type: 'repair', target: 'power' });
  if (cond.lifeSupport < 60 || s.oxygen < 45) add({ type: 'repair', target: 'lifeSupport' });
  if (cond.shield < o.shieldRepair) add({ type: 'repair', target: 'shield' });
  if (cond.food < 60) add({ type: 'repair', target: 'food' });
  if (!storm && s.power >= o.floor && ap >= 2) {
    const want = o.order.find((k) => s.upgrades[k] < 2) || o.order.find((k) => s.upgrades[k] < 3);
    if (want) add({ type: 'upgrade', target: want });
  }
  if (!storm && s.power >= 50 && ap >= 1) {
    const t = o.order.find((k) => s.breakthroughs[k] < 2);
    if (t) add({ type: 'research', target: t });
  }
  if (storm && s.power < 50 && ap >= 1) add({ type: 'allocate', target: 'power' });
  return acts;
}
const POLICIES = {
  autopilot: () => [],
  lightsOut: () => [{ type: 'allocate', target: 'power' }], // conserve power every single phase
  patchAndPray: (s) => {
    const acts = [];
    const c = { ...s.conditions, shield: s.shield };
    let ap = s.actionPoints;
    if (s.panelDust > 35) { acts.push({ type: 'repair', target: 'power' }); ap--; c.power += 25; }
    while (ap > 0) {
      const [k, v] = Object.entries(c).sort((a, b) => a[1] - b[1])[0];
      if (v >= 98) break;
      acts.push({ type: 'repair', target: k }); ap--; c[k] += k === 'shield' ? 20 : 25;
    }
    return acts;
  },
  upgradeRush: (s) => {
    const order = [...SYSTEMS].sort((a, b) => s.upgrades[a] - s.upgrades[b]);
    const acts = []; let ap = s.actionPoints;
    for (const t of order) if (ap >= 2) { acts.push({ type: 'upgrade', target: t }); ap -= 2; }
    return acts;
  },
  labRat: (s) => SYSTEMS.concat(SYSTEMS).slice(0, s.actionPoints).map((t) => ({ type: 'research', target: t })),
  stormReady: (s) => investor(s, { order: ['food', 'shield', 'power', 'lifeSupport'], shieldRepair: 82, floor: 60 }),
  powerFirst: (s) => investor(s, { order: ['power', 'food', 'shield', 'lifeSupport'], shieldRepair: 82, floor: 40 }),
  foodFirst: (s) => investor(s, { order: ['food', 'power', 'lifeSupport', 'shield'], shieldRepair: 65, floor: 60 }),
};

// ───────────────────────── scenario runner ─────────────────────────
const SHORT = { repair: 'rep', upgrade: 'upg', research: 'res', allocate: 'alc', power: 'pwr', lifeSupport: 'air', shield: 'shd', food: 'fod' };
const abbr = (a) => `${SHORT[a.type]}:${SHORT[a.target]}`;

function runScenario(sc) {
  const g = createGame({ level: LEVELS[sc.level], seed: sc.seed });
  const rows = [];
  let guard = 0;
  while (g.state.result.status === 'ongoing' && guard++ < 400) {
    const s = g.state;
    const env = makeEnv(sc.env, s.day, s.phase);
    const acts = sc.policy(s);
    const at = { day: s.day, phase: s.phase };
    const out = step(g, [...acts, { type: 'endTurn' }], env);
    const n = g.state;
    rows.push({
      ...at, acts, outcome: n.lastTurn.outcome, dust: env.dustOpacity,
      hazards: out.events.filter((e) => e.type === 'hazard').map((e) => e.title),
      v: { O: n.oxygen, P: n.power, F: n.food, S: n.shield, R: n.radiation },
      events: out.events,
    });
  }
  return { g, rows };
}

const SCENARIOS = [
  { id: 'A', name: 'L1 Steady hand (invest + repair)', level: 1, env: 'calm', seed: 7, policy: POLICIES.stormReady, expect: { status: 'success', tier: 'full' } },
  { id: 'B', name: 'L1 Autopilot (never act)', level: 1, env: 'calm', seed: 7, policy: POLICIES.autopilot, expect: { status: 'success', tier: 'partial' } },
  { id: 'C', name: 'L1 Lights-out (conserve power every turn)', level: 1, env: 'calm', seed: 7, policy: POLICIES.lightsOut, expect: { status: 'failure', reason: 'objectives-missed' } },
  { id: 'D', name: 'L2 Storm-ready (food/shield first)', level: 2, env: 'storms', seed: 7, policy: POLICIES.stormReady, expect: { status: 'success', tier: 'full' } },
  { id: 'E', name: 'L2 Patch-and-pray (repair only)', level: 2, env: 'storms', seed: 7, policy: POLICIES.patchAndPray, expect: { status: 'success', tier: 'partial' } },
  { id: 'F', name: 'L2 Upgrade rush (no repairs)', level: 2, env: 'storms', seed: 7, policy: POLICIES.upgradeRush, expect: { status: 'failure', reason: 'blackout' } },
  { id: 'G', name: 'L3 Power first', level: 3, env: 'cascade', seed: 7, policy: POLICIES.powerFirst, expect: { status: 'success' } },
  { id: 'H', name: 'L3 Food first, shield ignored', level: 3, env: 'cascade', seed: 7, policy: POLICIES.foodFirst, expect: { status: 'failure', reason: 'objectives-missed' } },
  { id: 'I', name: 'L3 Lab rat (research only)', level: 3, env: 'cascade', seed: 7, policy: POLICIES.labRat, expect: { status: 'failure' } },
];

// ═════════════════════════ 1. multiplier unit tests ═════════════════════════
section('1. multiplier functions (NASA data -> game multipliers)');

test('dustToSolar: 0 -> 1.0, 1 -> 0.2, linear in between, clamped, null fallback', () => {
  near(dustToSolar(0), 1); near(dustToSolar(1), 0.2); near(dustToSolar(0.35), 0.72); near(dustToSolar(0.5), 0.6);
  near(dustToSolar(1.7), 0.2); near(dustToSolar(-3), 1); near(dustToSolar(null), 0.76); near(dustToSolar(undefined), 0.76); near(dustToSolar(NaN), 0.76);
});
test('irradianceToSolar: 450 W/m2 = full sun, floor 0.2, cap 1', () => {
  near(irradianceToSolar(450), 1); near(irradianceToSolar(225), 0.5); near(irradianceToSolar(10), 0.2); near(irradianceToSolar(900), 1); near(irradianceToSolar(null), 1);
});
test('solarMultiplier: dust only when irradiance is null, 50/50 blend otherwise', () => {
  near(solarMultiplier({ dustOpacity: 0.35, solarIrradiance: null }), 0.72);
  near(solarMultiplier({ dustOpacity: 0.35, solarIrradiance: 310 }), 0.5 * 0.72 + 0.5 * (310 / 450));
  near(solarMultiplier({ dustOpacity: 1, solarIrradiance: 0 }), 0.2); near(solarMultiplier(null), 0.76);
});
test('temperatureToHeater: -60 C = 1.0, colder = more draw, clamped 0.5..2.0', () => {
  near(temperatureToHeater(-60), 1); near(temperatureToHeater(-63), 1.05); near(temperatureToHeater(-120), 2);
  near(temperatureToHeater(-200), 2); near(temperatureToHeater(0), 0.5); near(temperatureToHeater(30), 0.5); near(temperatureToHeater(null), 1);
});
test('temperatureToLifeSupportLoad: -60 C = 1.0, clamped 0.85..1.4', () => {
  near(temperatureToLifeSupportLoad(-60), 1); near(temperatureToLifeSupportLoad(-100), 1 + 40 / 150); near(temperatureToLifeSupportLoad(-200), 1.4);
  near(temperatureToLifeSupportLoad(20), 0.85); near(temperatureToLifeSupportLoad(null), 1);
});
test('radiationToShieldDegradation: 0.03 = 1.0, clamped 0.5..3.0', () => {
  near(radiationToShieldDegradation(0.03), 1); near(radiationToShieldDegradation(0.06), 2); near(radiationToShieldDegradation(0.09), 3);
  near(radiationToShieldDegradation(0.4), 3); near(radiationToShieldDegradation(0.001), 0.5); near(radiationToShieldDegradation(null), 1);
});
test('pressureToLeakChance: 700 Pa = 5%, thinner air = more risk, clamped 2%..35%', () => {
  near(pressureToLeakChance(700), 0.05); near(pressureToLeakChance(720), 0.034); near(pressureToLeakChance(600), 0.13);
  near(pressureToLeakChance(300), 0.35); near(pressureToLeakChance(1000), 0.02); near(pressureToLeakChance(null), 0.05);
});
test('windToDustDeposition: 0.5..6 % of panel area per day phase', () => {
  near(windToDustDeposition(0), 0.5); near(windToDustDeposition(6.5), 3.75); near(windToDustDeposition(11), 6);
  near(windToDustDeposition(40), 6); near(windToDustDeposition(null), 3);
});
test('dustToGrowth: 1.0 -> 0.5', () => {
  near(dustToGrowth(0), 1); near(dustToGrowth(0.35), 0.825); near(dustToGrowth(1), 0.5); near(dustToGrowth(9), 0.5); near(dustToGrowth(null), 0.85);
});
test('every multiplier is monotonic and stays inside its clamp over a wide sweep', () => {
  const sweep = (fn, lo, hi, dir, min, max) => {
    let prev = null;
    for (let x = lo; x <= hi; x += (hi - lo) / 200) {
      const y = fn(x);
      assert(y >= min - 1e-9 && y <= max + 1e-9, `${fn.name}(${x}) = ${y} outside [${min}, ${max}]`);
      if (prev !== null) assert(dir * (y - prev) >= -1e-9, `${fn.name} not monotonic at ${x}`);
      prev = y;
    }
  };
  sweep(dustToSolar, -1, 2, -1, 0.2, 1);
  sweep(temperatureToHeater, -200, 50, -1, 0.5, 2);
  sweep(temperatureToLifeSupportLoad, -200, 50, -1, 0.85, 1.4);
  sweep(radiationToShieldDegradation, 0, 0.5, 1, 0.5, 3);
  sweep(pressureToLeakChance, 200, 1300, -1, 0.02, 0.35);
  sweep(windToDustDeposition, 0, 60, 1, 0.5, 6);
  sweep(dustToGrowth, -1, 2, -1, 0.5, 1);
});
test('computeMultipliers handles null env', () => {
  const m = computeMultipliers(null);
  for (const v of Object.values(m)) assert(Number.isFinite(v), 'non-finite multiplier');
});
test('sanitizeEnv: null, partial, garbage and out-of-range inputs', () => {
  const a = sanitizeEnv(null, 'calm');
  same(a.fallbacks, ['temperature', 'pressure', 'windSpeed', 'dustOpacity', 'radiation']); assert(a.solarIrradiance === null);
  const b = sanitizeEnv({ temperature: -63, pressure: 'abc', windSpeed: NaN, dustOpacity: 4, radiation: -1, solarIrradiance: 9999 }, 'unstable');
  same(b.temperature, -63); same(b.pressure, 660); same(b.windSpeed, 9); same(b.dustOpacity, 1); same(b.radiation, 0); same(b.solarIrradiance, 800);
  same(b.fallbacks, ['pressure', 'windSpeed']);
  assert(sanitizeEnv({ sources: { radiation: 'proxy (RAD estimate)' } }).proxy === true, 'proxy flag not detected');
  assert(sanitizeEnv({ sources: { dust: 'MEDA' } }).proxy === false, 'false proxy');
});

// ═════════════════════════ 2. API and shape tests ═════════════════════════
section('2. API contract (sections 4.1 - 4.3)');
const UI_KEYS = ['actionPoints', 'dust', 'day', 'events', 'food', 'lifeSupport', 'phase', 'power', 'radiation', 'shield'].sort();
function checkUi(ui) {
  same(Object.keys(ui).sort(), UI_KEYS, 'uiState keys');
  for (const k of ['lifeSupport', 'radiation', 'power', 'food', 'shield']) assert(Number.isFinite(ui[k]) && ui[k] >= 0 && ui[k] <= 100, `${k} out of 0..100: ${ui[k]}`);
  assert(ui.dust >= 0 && ui.dust <= 1, 'dust out of 0..1');
  assert(Number.isInteger(ui.day) && ui.day >= 1, 'bad day'); assert(ui.phase === 'day' || ui.phase === 'night', 'bad phase');
  assert(Number.isInteger(ui.actionPoints) && ui.actionPoints >= 0, 'bad AP');
  assert(Array.isArray(ui.events), 'events not array');
  for (const e of ui.events) {
    same(Object.keys(e).sort(), ['severity', 'text', 'title'], 'ui event keys');
    assert(['info', 'warning', 'critical'].includes(e.severity), `bad severity ${e.severity}`);
    assert(typeof e.title === 'string' && typeof e.text === 'string' && e.title && e.text, 'empty event text');
  }
}
test('exports: createGame, step, evaluateWinLoss are functions', () => {
  assert(typeof createGame === 'function' && typeof step === 'function' && typeof evaluateWinLoss === 'function');
});
test('step returns exactly { state, events, uiState } and uiState matches contract', () => {
  const g = createGame({ level: LEVELS[1], seed: 1 });
  const out = step(g, [{ type: 'repair', target: 'power' }, { type: 'endTurn' }], makeEnv('calm', 1, 'day'));
  same(Object.keys(out).sort(), ['events', 'state', 'uiState']); checkUi(out.uiState);
  assert(out.uiState.day === 1 && out.uiState.phase === 'night', 'clock did not advance to night');
});
test('createGame works with no config and with a level object passed directly', () => {
  assert(evaluateWinLoss(createGame().state) === 'ongoing'); assert(createGame(LEVELS[2]).state.level.id === 'level-2');
  assert(createGame({ level: LEVELS[3], seed: 'abc' }).state.level.turnLimit === 40);
});
test('missing / null / garbage envData never throws and uiState stays valid', () => {
  const bad = [undefined, null, {}, { temperature: null, pressure: null, windSpeed: null, dustOpacity: null, radiation: null, solarIrradiance: null },
    { temperature: 'x', pressure: NaN, dustOpacity: Infinity }, [], 'hello', { dustOpacity: 1e9, radiation: -5 }];
  for (const e of bad) {
    const g = createGame({ level: LEVELS[2], seed: 3 });
    for (let i = 0; i < 6; i++) checkUi(step(g, [{ type: 'endTurn' }], e).uiState);
  }
});
test('unknown actions, missing targets and junk are ignored with a warning, not thrown', () => {
  const g = createGame({ level: LEVELS[1], seed: 1 });
  const out = step(g, [null, 5, { type: 'dance', target: 'power' }, { type: 'repair' }, { type: 'repair', target: 'moon' }], makeEnv('calm', 1, 'day'));
  checkUi(out.uiState); assert(out.events.filter((e) => e.severity === 'warning').length >= 3); assert(out.state.actionPoints === 3);
});
test('evaluateWinLoss: failure conditions, success at the end, ongoing otherwise', () => {
  const base = () => createGame({ level: LEVELS[1], seed: 1 }).state;
  assert(evaluateWinLoss(base()) === 'ongoing');
  let s = base(); s.oxygen = 0; assert(evaluateWinLoss(s) === 'failure');
  s = base(); s.radiation = 100; assert(evaluateWinLoss(s) === 'failure');
  s = base(); s.starveTurns = 3; assert(evaluateWinLoss(s) === 'failure');
  s = base(); s.blackoutTurns = 3; assert(evaluateWinLoss(s) === 'failure');
  s = base(); s.day = 21; assert(evaluateWinLoss(s) === 'success');
  s = base(); s.day = 21; s.food = 5; assert(evaluateWinLoss(s) === 'failure', 'goals missed should fail');
  assert(evaluateWinLoss(null) === 'ongoing'); assert(evaluateWinLoss(createGame()) === 'ongoing');
});
test('step after game over returns a "Mission over" info event and changes nothing', () => {
  const g = createGame({ level: LEVELS[1], seed: 1 }); g.state.radiation = 100;
  step(g, [{ type: 'endTurn' }], makeEnv('calm', 1, 'day')); assert(g.state.result.status === 'failure');
  const snap = JSON.stringify(g.state);
  const out = step(g, [{ type: 'repair', target: 'power' }, { type: 'endTurn' }], makeEnv('calm', 1, 'day'));
  assert(out.events[0].title === 'Mission over'); assert(JSON.stringify(g.state) === snap, 'state changed after game over');
});
test('returned state is a copy: mutating it does not affect the game', () => {
  const g = createGame({ level: LEVELS[1], seed: 1 });
  const out = step(g, [], makeEnv('calm', 1, 'day')); out.state.power = -999;
  assert(g.state.power === 100);
});

// ═════════════════════════ 3. rules ═════════════════════════
section('3. rules');
test('action points: cannot overspend, repeats stop when AP runs out', () => {
  const g = createGame({ level: LEVELS[1], seed: 1 });
  Object.assign(g.state.conditions, { power: 40, lifeSupport: 40, food: 40 });
  const out = step(g, [{ type: 'repair', target: 'power', amount: 3 }, { type: 'repair', target: 'food' }], makeEnv('calm', 1, 'day'));
  assert(g.state.actionPoints === 0, `AP ${g.state.actionPoints}`); assert(g.state.phaseActions.length === 3);
  assert(out.events.some((e) => e.title === 'Out of action points'));
});
test('repair at full health costs nothing', () => {
  const g = createGame({ level: LEVELS[1], seed: 1 }); g.state.panelDust = 0;
  step(g, [{ type: 'repair', target: 'lifeSupport' }], makeEnv('calm', 1, 'day')); assert(g.state.actionPoints === 3);
});
test('upgrade: costs 2 AP + battery, raises level; refused (free) without resources; caps at level 3', () => {
  const g = createGame({ level: LEVELS[1], seed: 5 });
  step(g, [{ type: 'upgrade', target: 'power' }], makeEnv('calm', 1, 'day'));
  assert(g.state.actionPoints === 1 && g.state.power === 100 - TUNING.upgrade.cost.power.battery);
  const h = createGame({ level: LEVELS[1], seed: 5 }); h.state.power = 5;
  const out = step(h, [{ type: 'upgrade', target: 'power' }], makeEnv('calm', 1, 'day'));
  assert(h.state.actionPoints === 3 && h.state.upgrades.power === 0 && out.events[0].title === 'Not enough resources');
  const m = createGame({ level: LEVELS[1], seed: 5 }); m.state.upgrades.shield = 3;
  assert(step(m, [{ type: 'upgrade', target: 'shield' }], null).events.some((e) => e.title === 'Fully upgraded'));
});
test('actions listed after endTurn are ignored', () => {
  const g = createGame({ level: LEVELS[1], seed: 5 });
  step(g, [{ type: 'endTurn' }, { type: 'upgrade', target: 'power' }], makeEnv('calm', 1, 'day'));
  assert(SYSTEMS.every((k) => g.state.upgrades[k] === 0));
});
test('night phase gives one fewer action point (minimum 1)', () => {
  const g = createGame({ level: LEVELS[1], seed: 5 }); step(g, [{ type: 'endTurn' }], makeEnv('calm', 1, 'day'));
  assert(g.state.phase === 'night' && g.state.actionPoints === 2);
});
test('coupling: heavy dust cuts solar income; wind adds panel dust; cleaning removes it', () => {
  const run = (dust, wind) => { const g = createGame({ level: LEVELS[1], seed: 1 }); g.state.power = 50; step(g, [{ type: 'endTurn' }], { dustOpacity: dust, windSpeed: wind, temperature: -60, pressure: 700, radiation: 0.03 }); return g.state; };
  const clear = run(0.1, 4), storm = run(0.9, 4), gusty = run(0.1, 14);
  assert(clear.power > storm.power + 8, `clear ${clear.power} vs storm ${storm.power}`); assert(gusty.panelDust > clear.panelDust, 'wind did not add dust');
  const g = createGame({ level: LEVELS[1], seed: 1 }); g.state.panelDust = 60;
  step(g, [{ type: 'repair', target: 'power' }], null); assert(g.state.panelDust < 40, `panelDust ${g.state.panelDust}`);
});
test('coupling: radiation raises shield wear and crew dose; a strong shield blocks dose', () => {
  const run = (rad, shield) => { const g = createGame({ level: LEVELS[1], seed: 1 }); g.state.shield = shield; step(g, [{ type: 'endTurn' }], { radiation: rad, dustOpacity: 0.1, windSpeed: 4, temperature: -60, pressure: 700 }); return g.state; };
  const lo = run(0.03, 100), hi = run(0.09, 100), weak = run(0.03, 20);
  assert(100 - hi.shield > 2.5 * (100 - lo.shield), 'wear should scale with radiation'); assert(weak.radiation > lo.radiation + 0.5, 'weak shield should let more dose in');
});
test('coupling: low power starves life support (oxygen falls when the battery is empty)', () => {
  const run = (power) => { const g = createGame({ level: LEVELS[1], seed: 1 }); g.state.power = power; g.state.oxygen = 90; g.state.phase = 'night'; step(g, [{ type: 'endTurn' }], { dustOpacity: 1, windSpeed: 4, temperature: -60, pressure: 700, radiation: 0.03 }); return g.state.oxygen; };
  assert(run(0) < run(80) - 2, 'oxygen should be worse with an empty battery');
});
test('conserve mode saves battery; priority protects the chosen system in a brownout', () => {
  const env = { dustOpacity: 1, windSpeed: 4, temperature: -60, pressure: 700, radiation: 0.03 };
  const mk = () => { const g = createGame({ level: LEVELS[1], seed: 1 }); g.state.power = 3; g.state.phase = 'night'; g.state.actionPoints = 2; return g; };
  const plain = mk(); step(plain, [{ type: 'endTurn' }], env);
  const food = mk(); step(food, [{ type: 'allocate', target: 'food' }, { type: 'endTurn' }], env);
  assert(food.state.food > plain.state.food, 'food priority should help food'); assert(food.state.oxygen < plain.state.oxygen, 'and cost oxygen');
});

// ═════════════════════════ 4. determinism ═════════════════════════
section('4. determinism');
const fullRun = (level, seed, policy, env) => runScenario({ level, seed, policy, env });
test('same seed + same choices = identical game (states and events)', () => {
  const a = fullRun(2, 11, POLICIES.stormReady, 'storms'), b = fullRun(2, 11, POLICIES.stormReady, 'storms');
  assert(JSON.stringify(a.g.state) === JSON.stringify(b.g.state)); assert(JSON.stringify(a.rows) === JSON.stringify(b.rows));
});
test('different seeds give different luck', () => {
  const a = fullRun(2, 1, POLICIES.stormReady, 'storms'), b = fullRun(2, 2, POLICIES.stormReady, 'storms');
  assert(JSON.stringify(a.rows.map((r) => r.hazards)) !== JSON.stringify(b.rows.map((r) => r.hazards)), 'hazard schedule identical for different seeds');
});
test('bad luck does not depend on your choices (same seed, different players see the same flares)', () => {
  const flares = (r) => r.rows.map((x, i) => (x.hazards.includes('Solar particle event') ? i : -1)).filter((i) => i >= 0);
  const n = Math.min(...['autopilot', 'stormReady'].map((p) => fullRun(2, 7, POLICIES[p], 'storms').rows.length));
  const a = flares(fullRun(2, 7, POLICIES.autopilot, 'storms')).filter((i) => i < n), b = flares(fullRun(2, 7, POLICIES.stormReady, 'storms')).filter((i) => i < n);
  assert(JSON.stringify(a) === JSON.stringify(b) && a.length > 0, `flare turns differ: ${a} vs ${b}`);
});

// ═════════════════════════ 5. level files and hygiene ═════════════════════════
section('5. level files and code hygiene');
test('level JSONs keep every required field from contract 4.5 and the difficulty ramps up', () => {
  for (const n of [1, 2, 3]) {
    const L = LEVELS[n];
    assert(L.id === `level-${n}` && typeof L.name === 'string'); same(Object.keys(L.starterResources).sort(), ['food', 'oxygen', 'power', 'shield']);
    assert(['calm', 'unstable', 'cascade'].includes(L.envProfile)); assert(Number.isInteger(L.actionPoints) && L.actionPoints > 0 && Number.isInteger(L.turnLimit) && L.turnLimit > 0);
    assert(L.winConditions && L.excellence && L.hazards, 'missing extension fields');
  }
  assert(LEVELS[1].turnLimit < LEVELS[2].turnLimit && LEVELS[2].turnLimit < LEVELS[3].turnLimit);
  assert(LEVELS[1].hazards.faultChance < LEVELS[2].hazards.faultChance && LEVELS[2].hazards.faultChance <= LEVELS[3].hazards.faultChance);
  assert(LEVELS[3].hazards.cascade === true);
});
test('game-logic.js has no DOM, network, storage, imports or references to /ui/ or /data/', () => {
  const src = readFileSync(new URL('../src/game-logic.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const bad of [/\bdocument\b/, /\bwindow\b/, /\bfetch\s*\(/, /XMLHttpRequest/, /localStorage/, /\brequire\s*\(/, /^\s*import\s/m, /\/ui\//, /\/data\//, /Math\.random/, /Date\.now/, /new Date/])
    assert(!bad.test(code), `forbidden pattern ${bad}`);
});
test('scoring: stable, non-negative, rewards winning', () => {
  const s = createGame({ level: LEVELS[1], seed: 1 }).state;
  const base = computeScore(s, null);
  assert(base > 0 && computeScore(s, { status: 'success', tier: 'partial' }) === base + 150 && computeScore(s, { status: 'success', tier: 'full' }) === base + 300);
  s.radiation = 100; s.oxygen = 0; s.food = 0; s.power = 0; s.shield = 0; assert(computeScore(s, null) >= 0);
});

// ═════════════════════════ 6. decision sequences ═════════════════════════
section('6. decision sequences (traces)');
const results = {};
function printTrace(sc, rows, g) {
  console.log(`\n--- Scenario ${sc.id}: ${sc.name}  [level ${sc.level}, env "${sc.env}", seed ${sc.seed}]`);
  console.log('Sol | day actions -> night actions          | Air Pwr Food Shld Rad | Dust | turn results (d/n) | hazards');
  for (let i = 0; i < rows.length; i += 2) {
    const d = rows[i], n = rows[i + 1] || rows[i];
    const acts = (r) => (r.acts.map(abbr).join(',') || '-');
    const oc = (r) => r.outcome[0].toUpperCase();
    const hz = [...d.hazards, ...(n !== d ? n.hazards : [])].join('; ');
    const f = (x) => String(Math.round(x)).padStart(3);
    console.log(`${String(d.day).padStart(3)} | ${(acts(d) + ' -> ' + (n !== d ? acts(n) : '')).padEnd(37).slice(0, 37)} | ${f(n.v.O)} ${f(n.v.P)} ${f(n.v.F)}  ${f(n.v.S)} ${f(n.v.R)}  | ${String(d.dust).padEnd(4)} |        ${oc(d)}/${oc(n)}         | ${hz}`);
    if (VERBOSE) for (const r of [d, n]) for (const e of r.events) console.log(`       [${e.severity}] ${e.title}: ${e.text}`);
  }
  const r = g.state.result;
  console.log(`=> ${r.status.toUpperCase()}${r.tier ? ' (' + r.tier + ')' : ''} because "${r.reason}" | final score ${r.score}`);
}
function printMarkdown(sc, rows, g) {
  console.log(`\n**Trace ${sc.id}: ${sc.name}** (level ${sc.level}, seed ${sc.seed})\n`);
  console.log('| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |');
  console.log('|---|---|---|---|---|---|---|---|');
  const sols = Math.ceil(rows.length / 2);
  for (let i = 0; i < sols; i++) {
    const d = rows[2 * i], n = rows[2 * i + 1] || d;
    if (!(i === 0 || (i + 1) % 5 === 0 || i === sols - 1)) continue;
    const a = (r) => r.acts.map(abbr).join(' ') || 'none';
    const oc = (r) => r.outcome[0].toUpperCase();
    console.log(`| ${d.day} | ${a(d)} / ${n !== d ? a(n) : ''} | ${Math.round(n.v.O)} | ${Math.round(n.v.P)} | ${Math.round(n.v.F)} | ${Math.round(n.v.S)} | ${Math.round(n.v.R)} | ${oc(d)}/${oc(n)} |`);
  }
  const r = g.state.result;
  console.log(`\nResult: **${r.status}${r.tier ? ' (' + r.tier + ')' : ''}**, reason "${r.reason}", score ${r.score}.`);
}
for (const sc of SCENARIOS) {
  const { g, rows } = runScenario(sc);
  results[sc.id] = { r: g.state.result, sc };
  if (TRACES) printMarkdown(sc, rows, g);
  else printTrace(sc, rows, g);
  test(`scenario ${sc.id} "${sc.name}" ends as expected`, () => {
    const r = g.state.result;
    assert(r.status === sc.expect.status, `status ${r.status} (${r.reason}), wanted ${sc.expect.status}`);
    if (sc.expect.tier) assert(r.tier === sc.expect.tier, `tier ${r.tier}, wanted ${sc.expect.tier}`);
    if (sc.expect.reason) assert(r.reason === sc.expect.reason, `reason ${r.reason}, wanted ${sc.expect.reason}`);
    assert(evaluateWinLoss(g.state) === r.status, 'evaluateWinLoss disagrees with result');
  });
}

if (!TRACES) {
  section('7. coverage of outcomes and strategy diversity');
  test('at least one win, one loss and one partial outcome appear across the scenarios', () => {
    const all = Object.values(results).map((x) => x.r);
    assert(all.some((r) => r.status === 'success' && r.tier === 'full'), 'no full win');
    assert(all.some((r) => r.status === 'failure'), 'no failure');
    assert(all.some((r) => r.status === 'success' && r.tier === 'partial'), 'no partial outcome');
  });
  test('each level is both winnable and losable', () => {
    for (const n of [1, 2, 3]) {
      const rs = Object.values(results).filter((x) => x.sc.level === n).map((x) => x.r.status);
      assert(rs.includes('success'), `level ${n} has no winning scenario`); assert(rs.includes('failure'), `level ${n} has no losing scenario`);
    }
  });
  test('no dominant single strategy: every one-trick policy fails or only limps somewhere', () => {
    const kinds = { 1: 'calm', 2: 'storms', 3: 'cascade' };
    for (const p of ['autopilot', 'patchAndPray', 'upgradeRush', 'labRat', 'foodFirst']) {
      const outcomes = [1, 2, 3].map((n) => { const r = runScenario({ level: n, seed: 7, policy: POLICIES[p], env: kinds[n] }).g.state.result; return r.status === 'success' && r.tier === 'full'; });
      assert(!outcomes.every(Boolean), `${p} thrives on every level`);
    }
  });
  test('the best plan changes by level (upgradeRush thrives on calm L1 but fails on L2)', () => {
    const a = runScenario({ level: 1, seed: 7, policy: POLICIES.upgradeRush, env: 'calm' }).g.state.result;
    const b = runScenario({ level: 2, seed: 7, policy: POLICIES.upgradeRush, env: 'storms' }).g.state.result;
    assert(a.status === 'success' && b.status === 'failure', `${a.status}/${b.status}`);
  });
  test('every scenario works when EVERY envData field is null', () => {
    for (const n of [1, 2, 3]) {
      const g = createGame({ level: LEVELS[n], seed: 4 }); let guard = 0;
      while (g.state.result.status === 'ongoing' && guard++ < 400) checkUi(step(g, POLICIES.stormReady(g.state).concat({ type: 'endTurn' }), { temperature: null, pressure: null, windSpeed: null, dustOpacity: null, radiation: null, solarIrradiance: null }).uiState);
      assert(g.state.result.status !== 'ongoing', 'game never ended');
    }
  });
}

if (!TRACES) {
  console.log(`\n${R.ok} passed, ${R.fail} failed`);
  if (R.fail) { console.log('Failed: ' + R.failed.join(' | ')); process.exit(1); }
}
