// src/session.js
// The glue between the three parts, with NO DOM access (so it can be tested in Node):
//   game engine (game/src/game-logic.js)  <->  session  <->  UI (src/ui.js, via main.js)
//   NASA data feed (src/env-feed.js) supplies the weather for each phase.
//
// Turn flow (matches game/README_GAME.md):
//   act(action)   -> engine.step(game, [action], env)         applies the action now, time does not pass
//   endTurn()     -> engine.step(game, [endTurn], env)        resolves the phase with the weather the player saw
//                 -> env = feed.get(next phase)               the next phase's weather arrives
//                 -> engine.step(game, [], env)               "morning briefing": weather events appear
//
// Every method returns a view: { ui, details, over, result, batch }.

import { createGame, step, evaluateWinLoss, TUNING } from '../game/src/game-logic.js';
import { SCENARIOS } from './scenarios.js';

const MAX_LOG = 8;

export const LESSONS = {
  thriving: 'You never had a free upgrade: every gain in one system was paid for in another (battery, action points or wear), and you chose where to pay.',
  limping: 'You survived by patching the biggest problem each turn. Investing earlier in upgrades would cost battery now but reduce wear and risk later.',
  suffocation: 'Life support needs power, and power needs clean panels. One weak link pulled the whole chain down: fix the weakest system first.',
  radiation: 'Radiation dose can never be reversed. Every action point spent elsewhere was one not spent on the shield, so protect it before the dose meter climbs.',
  starvation: 'Plants need light, power and healthy pumps. Saving battery by dimming the greenhouse saved power today and cost food tomorrow.',
  blackout: 'Everything on the outpost runs on the battery. Research and upgrades spend it, so a storm arriving with a low battery leaves no room to react.',
  'objectives-missed': 'The crew is alive, but the outpost missed the mission minimums. Compare your final meters with the level goals and try a different mix of repairs and upgrades.',
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Short text + severity for the weather coming in the next two sols. */
export function outlookFor(feed, scenario, sol, limit) {
  let worst = 0;
  for (let k = 1; k <= 2; k++) {
    if (sol + k > limit) break;
    const d = feed.get(sol + k, 'day', scenario).dustOpacity ?? 0;
    worst = Math.max(worst, d);
  }
  if (worst >= 0.6) return { text: 'Dust storm building', level: 'crit' };
  if (worst >= 0.35) return { text: 'Hazy, dust rising', level: 'warn' };
  return { text: 'Clear skies', level: 'ok' };
}

/**
 * @param {{levels: object[], feed: {get:Function, info:object}, makeSeed?: () => number}} deps
 */
export function createSession({ levels, feed, makeSeed = () => Date.now() % 1_000_000_000 }) {
  let game = null;
  let level = null;
  let scenario = null;
  let env = null;
  let seed = 0;
  let log = [];
  let lastUi = null;

  const requireGame = () => {
    if (!game) throw new Error('No mission running. Call start() first.');
  };

  function pushLog(batch) {
    log = [
      ...batch.map((e) => ({ title: e.title, text: e.text, severity: e.severity, fresh: true })),
      ...log.map((e) => ({ ...e, fresh: false })),
    ].slice(0, MAX_LOG);
  }

  function buildView(batch) {
    const s = game.state;
    const status = evaluateWinLoss(game);
    const over = status !== 'ongoing';
    let result = null;
    if (over) {
      const endEv = batch.find((e) => e.type === 'mission' && e.outcome) || null;
      result = {
        status,
        reason: s.result.reason,
        tier: s.result.tier,
        score: s.score,
        title: endEv ? endEv.title : status === 'success' ? 'Mission complete' : 'Mission failed',
        text: endEv ? endEv.text : '',
        lesson: LESSONS[s.result.reason] || '',
        seed,
        sols: Math.min(s.day - (status === 'success' ? 1 : 0), level.turnLimit),
        levelId: level.id,
      };
    }
    return {
      ui: { ...lastUi, events: log.map((e) => ({ ...e })) },
      details: {
        levelName: level.name,
        solLimit: level.turnLimit,
        maxUpgrade: TUNING.upgrade.maxLevel,
        score: s.score,
        conditions: { ...s.conditions },
        shield: s.shield,
        upgrades: { ...s.upgrades },
        breakthroughs: { ...s.breakthroughs },
        panelDust: s.panelDust,
        conserve: s.conserve,
        priority: s.priority,
        outlook: over ? { text: '–', level: 'ok' } : outlookFor(feed, scenario, s.day, level.turnLimit),
        scenarioLabel: scenario ? scenario.label : null,
        seed,
      },
      over,
      result,
      batch: batch.map((e) => ({ ...e })),
    };
  }

  return {
    get feedInfo() { return feed.info; },
    get levels() { return levels; },
    get running() { return !!game && evaluateWinLoss(game) === 'ongoing'; },
    get state() { return game ? clone(game.state) : null; },
    get seed() { return seed; },

    /** Starts (or restarts) a mission. `opts.seed` makes the run repeatable. */
    start(levelIndex = 0, opts = {}) {
      level = levels[levelIndex];
      if (!level) throw new Error(`Unknown level index ${levelIndex}`);
      scenario = SCENARIOS[level.id] || null;
      seed = Number.isFinite(opts.seed) ? Math.floor(opts.seed) : makeSeed();
      game = createGame({ level, seed });
      log = [];
      env = feed.get(1, 'day', scenario);
      const r = step(game, [], env); // sol 1 briefing: weather events for the first phase
      lastUi = r.uiState;
      const intro = [{
        type: 'info', title: `${level.name}: mission start`, severity: 'info',
        text: `${level.description} You have ${level.turnLimit} sols to keep the outpost alive.`,
      }];
      pushLog([...intro, ...r.events]);
      return buildView([...intro, ...r.events]);
    },

    /** Applies one player action immediately (time does not pass). */
    act(action) {
      requireGame();
      if (!this.running) return buildView([]);
      const r = step(game, [action], env);
      lastUi = r.uiState;
      pushLog(r.events);
      return buildView(r.events);
    },

    /** Resolves the current phase, then delivers the next phase's weather. */
    endTurn() {
      requireGame();
      if (!this.running) return buildView([]);
      const resolved = step(game, [{ type: 'endTurn' }], env);
      let batch = [...resolved.events];
      lastUi = resolved.uiState;
      if (evaluateWinLoss(game) === 'ongoing') {
        env = feed.get(game.state.day, game.state.phase, scenario);
        const brief = step(game, [], env);
        lastUi = brief.uiState;
        batch = [...batch, ...brief.events];
      }
      pushLog(batch);
      return buildView(batch);
    },
  };
}
