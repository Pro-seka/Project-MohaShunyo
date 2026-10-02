// tests/session.test.js - the glue layer, end to end, in plain Node (no browser needed).
//   node tests/session.test.js
import { readFileSync } from 'node:fs';
import { createSession, outlookFor, LESSONS } from '../src/session.js';
import { createEnvFeed } from '../src/env-feed.js';
import { SCENARIOS, scenarioDust, applyScenario } from '../src/scenarios.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const levels = [1, 2, 3].map((n) => read(`../game/src/levels/level-${n}.json`));
const meda = read('../data/cache/meda-sample.json');
const mcs = read('../data/cache/mcs-sample.json');
const feed = createEnvFeed({ meda, mcs });

let ok = 0, bad = 0;
const test = (name, fn) => {
  try { fn(); ok++; console.log('  ok  ', name); } catch (e) { bad++; console.log('  FAIL', name, '\n       ', e.message); }
};
const assert = (c, m = 'assertion failed') => { if (!c) throw new Error(m); };

console.log('== env feed + scenarios');
test('feed builds contract-4.2 envData for day and night', () => {
  const day = feed.get(1, 'day'), night = feed.get(1, 'night');
  for (const e of [day, night]) {
    for (const k of ['timestamp', 'temperature', 'pressure', 'windSpeed', 'dustOpacity', 'radiation', 'solarIrradiance', 'sources']) assert(k in e, `missing ${k}`);
  }
  assert(day.solarIrradiance > 100, 'daytime should have sunlight: ' + day.solarIrradiance);
  assert(night.solarIrradiance === 0 || night.solarIrradiance < 5, 'night should be dark: ' + night.solarIrradiance);
  assert(night.temperature < day.temperature, 'night colder than day');
});
test('dust comes from MCS and is flagged proxy + synthetic (sample data)', () => {
  const s = feed.get(3, 'day').sources.dustOpacity;
  assert(s.proxy === true && s.synthetic === true, JSON.stringify(s));
});
test('scenario overlay raises dust in storm windows only, never mutates input', () => {
  const base = feed.get(8, 'day');
  const copy = JSON.stringify(base);
  const storm = applyScenario(base, SCENARIOS['level-2'], 8, 'day');
  assert(JSON.stringify(base) === copy, 'input was mutated');
  assert(storm.dustOpacity > 0.5, 'expected storm dust, got ' + storm.dustOpacity);
  assert(storm.sources.dustOpacity.scenario === true, 'overlay must be flagged');
  const calm = applyScenario(feed.get(1, 'day'), SCENARIOS['level-2'], 1, 'day');
  assert(calm.dustOpacity < 0.2, 'calm sol should stay calm');
  assert(applyScenario(base, null, 8, 'day') === base, 'no scenario -> same object');
});
test('storm peaks reach the configured strength', () => {
  const p = Math.max(...Array.from({ length: 12 }, (_, i) => scenarioDust(SCENARIOS['level-2'], 6 + i * 0.5 | 0, i % 2 ? 'night' : 'day')));
  assert(p > 0.6, 'peak ' + p);
});
test('cold snap only on level 3 and only lowers temperature', () => {
  const l3 = applyScenario(feed.get(25, 'night'), SCENARIOS['level-3'], 25, 'night');
  const raw = feed.get(25, 'night');
  assert(l3.temperature < raw.temperature, 'cold snap should lower temp');
  const l2 = applyScenario(feed.get(25, 'night'), SCENARIOS['level-2'], 25, 'night');
  assert(l2.temperature === raw.temperature);
});
test('feed with NO data still returns a usable, all-null envData (engine falls back)', () => {
  const empty = createEnvFeed({});
  const e = empty.get(4, 'day');
  assert(e.temperature === null && e.dustOpacity === null && empty.info.usable === false);
});
test('feed survives garbage snapshots without throwing', () => {
  const junk = createEnvFeed({ meda: { records: [{ lmst_hour: 12 }, null] }, mcs: { daily: [{}] } });
  junk.get(2, 'day'); junk.get(2, 'night');
});

console.log('\n== session flow');
test('start() returns a full view with the five meters and a starting log', () => {
  const s = createSession({ levels, feed, makeSeed: () => 7 });
  const v = s.start(0);
  for (const k of ['day', 'phase', 'actionPoints', 'lifeSupport', 'radiation', 'power', 'food', 'shield', 'dust', 'events']) assert(k in v.ui, 'ui missing ' + k);
  assert(v.ui.events.length >= 1 && v.ui.events[0].fresh === true);
  assert(v.details.solLimit === 20 && v.details.seed === 7 && v.over === false);
});
test('act() spends action points immediately and time does not pass', () => {
  const s = createSession({ levels, feed });
  const a = s.start(0, { seed: 1 });
  const b = s.act({ type: 'allocate', target: 'power' });
  assert(b.ui.actionPoints === a.ui.actionPoints - 1, `AP ${a.ui.actionPoints} -> ${b.ui.actionPoints}`);
  assert(b.ui.day === 1 && b.ui.phase === 'day');
});
test('endTurn() advances day -> night -> next sol and refreshes AP', () => {
  const s = createSession({ levels, feed });
  s.start(0, { seed: 1 });
  const n = s.endTurn();
  assert(n.ui.phase === 'night' && n.ui.day === 1, `${n.ui.phase} ${n.ui.day}`);
  assert(n.ui.actionPoints === levels[0].actionPoints - 1, 'night has one fewer AP');
  const d = s.endTurn();
  assert(d.ui.phase === 'day' && d.ui.day === 2);
  assert(d.ui.actionPoints === levels[0].actionPoints);
});
test('log keeps at most 8 entries and marks only the newest batch as fresh', () => {
  const s = createSession({ levels, feed });
  s.start(0, { seed: 2 });
  let v;
  for (let i = 0; i < 6; i++) v = s.endTurn();
  assert(v.ui.events.length <= 8);
  const firstOld = v.ui.events.findIndex((e) => !e.fresh);
  assert(v.ui.events[0].fresh === true);
  assert(firstOld === -1 || v.ui.events.slice(firstOld).every((e) => !e.fresh), 'fresh entries must come first');
});
test('same seed + same choices = identical game (determinism through the glue)', () => {
  const play = () => {
    const s = createSession({ levels, feed });
    s.start(1, { seed: 99 });
    for (let i = 0; i < 12; i++) { s.act({ type: 'repair', target: 'power' }); s.endTurn(); }
    return JSON.stringify(s.state);
  };
  assert(play() === play());
});
test('different seeds diverge on a hazardous level', () => {
  const run = (seed) => {
    const s = createSession({ levels, feed });
    s.start(2, { seed });
    for (let i = 0; i < 16; i++) s.endTurn();
    return JSON.stringify(s.state);
  };
  assert(run(1) !== run(2));
});
test('view objects are copies: mutating them cannot corrupt the game', () => {
  const s = createSession({ levels, feed });
  const v = s.start(0, { seed: 3 });
  v.ui.power = -999; v.details.conditions.power = -1; v.ui.events.length = 0;
  const w = s.act({ type: 'allocate', target: 'power' });
  assert(w.ui.power > 0 && w.details.conditions.power > 0);
});
test('methods before start() fail clearly, unknown level fails clearly', () => {
  const s = createSession({ levels, feed });
  let e1 = null, e2 = null;
  try { s.act({ type: 'repair', target: 'power' }); } catch (e) { e1 = e; }
  try { s.start(9); } catch (e) { e2 = e; }
  assert(e1 && /start/i.test(e1.message) && e2 && /level/i.test(e2.message));
});
test('bad input from the UI never crashes the session', () => {
  const s = createSession({ levels, feed });
  s.start(0, { seed: 4 });
  for (const a of [{}, { type: 'nope', target: 'power' }, { type: 'repair' }, { type: 'repair', target: 'ghost' }, null, undefined, { type: 'upgrade', target: '__proto__' }]) s.act(a);
  s.act({ type: 'repair', target: 'power' });
});

console.log('\n== full missions (a simple autopilot plays every level with several seeds)');
function autopilot(levelIndex, seed) {
  const s = createSession({ levels, feed });
  let v = s.start(levelIndex, { seed });
  let guard = 0;
  while (!v.over && guard++ < 400) {
    const d = v.details, u = v.ui;
    const c = d.conditions;
    // Priority: air, then battery/panels, then greenhouse, then shield, then invest what is left.
    const wants = [];
    if (u.lifeSupport < 60 || c.lifeSupport < 60) wants.push(['repair', 'lifeSupport']);
    if (u.power < 55 || c.power < 60 || d.panelDust > 25) wants.push(['repair', 'power']);
    if (u.food < 50 || c.food < 60) wants.push(['repair', 'food']);
    if (d.shield < 60) wants.push(['repair', 'shield']);
    wants.push(['research', 'shield'], ['upgrade', 'shield'], ['upgrade', 'power']);
    if (u.power < 40) wants.unshift(['allocate', 'power']);
    for (const [type, target] of wants) {
      if (v.ui.actionPoints <= 0) break;
      v = s.act({ type, target });
      if (v.over) break;
    }
    if (!v.over) v = s.endTurn();
  }
  return { v, guard };
}
test('every level reaches a definite end (no infinite loops) for 6 seeds', () => {
  for (let li = 0; li < 3; li++) {
    for (const seed of [1, 2, 3, 42, 777, 2026]) {
      const { v, guard } = autopilot(li, seed);
      assert(v.over && guard < 400, `level ${li + 1} seed ${seed} did not finish`);
      assert(v.result && ['success', 'failure'].includes(v.result.status));
      assert(v.result.title && v.result.lesson, 'end screen needs a title and a lesson');
      assert(Number.isFinite(v.result.score));
    }
  }
});
test('the tutorial level is winnable by the simple autopilot on most seeds', () => {
  const wins = [1, 2, 3, 42, 777, 2026].filter((seed) => autopilot(0, seed).v.result.status === 'success').length;
  assert(wins >= 4, `only ${wins}/6 wins on level 1`);
});
test('after the mission ends, act() and endTurn() are harmless no-ops', () => {
  const s = createSession({ levels, feed });
  let v = s.start(0, { seed: 5 });
  let g = 0; while (!v.over && g++ < 200) v = s.endTurn();
  assert(v.over);
  const before = JSON.stringify(s.state);
  s.act({ type: 'repair', target: 'power' }); s.endTurn();
  assert(JSON.stringify(s.state) === before);
});
test('every failure reason and both success tiers have a lesson text', () => {
  for (const r of ['thriving', 'limping', 'suffocation', 'radiation', 'starvation', 'blackout', 'objectives-missed']) assert(LESSONS[r] && LESSONS[r].length > 40, r);
});

console.log('\n== outlook');
test('outlook warns before the level-2 storm and is calm at the start', () => {
  const scn = SCENARIOS['level-2'];
  assert(outlookFor(feed, scn, 1, 30).level === 'ok');
  const seen = new Set();
  for (let sol = 1; sol <= 30; sol++) seen.add(outlookFor(feed, scn, sol, 30).level);
  assert(seen.has('crit') && seen.has('ok'), [...seen].join());
  const first = [...Array(30).keys()].map((i) => i + 1).find((sol) => outlookFor(feed, scn, sol, 30).level !== 'ok');
  assert(first < scn.storms[0].start, `warning on sol ${first} should come before the storm starts on sol ${scn.storms[0].start}`);
});
test('the outlook never looks past the end of the mission', () => {
  assert(outlookFor(feed, SCENARIOS['level-2'], 30, 30).level === 'ok');
});

console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
