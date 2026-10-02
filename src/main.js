// src/main.js - entry point. Wires the three parts together:
//   game engine (game/) + NASA data feed (data/ via src/env-feed.js) + UI (src/ui.js)
// All game logic lives in session.js/engine; all DOM work lives in ui.js. This file only connects them.
//
// URL options:  ?level=2   preselect a mission     ?seed=42   fixed seed (repeatable run)
//               ?demo=1    UI demo button (developer tool)
import * as UI from './ui.js';
import { createSession } from './session.js';
import { loadEnvFeed } from './env-feed.js';
import { TUNING } from '../game/src/game-logic.js';

const LEVEL_FILES = ['level-1', 'level-2', 'level-3'];

async function fetchJson(rel) {
  const res = await fetch(new URL(rel, import.meta.url));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${rel}`);
  return res.json();
}
const defaultLoaders = {
  loadCache: (name) => fetchJson(`../data/cache/${name}`),
  loadLevel: (id) => fetchJson(`../game/src/levels/${id}.json`),
};

const SYSTEM_NAMES = { power: 'Power (panels + battery)', lifeSupport: 'Life support (scrubbers)', shield: 'Radiation shield', food: 'Greenhouse' };

/** One-line explanation of what the chosen action does, built from the engine's own TUNING numbers. */
export function actionHint(type, target, T = TUNING) {
  const name = SYSTEM_NAMES[target] || 'this system';
  switch (type) {
    case 'repair': {
      const amt = target === 'shield' ? T.repair.shieldAmount : T.repair.amount;
      return `Repair ${name}: restores about ${amt}% condition${target === 'power' ? ' and brushes dust off the panels' : ''}. ${T.actionAp.repair} AP. It can partly fail, and dust makes outdoor work riskier.`;
    }
    case 'upgrade': {
      const c = T.upgrade.cost[target];
      const cost = c ? `${c.battery}% battery${c.food ? ` and ${c.food}% food` : ''}` : 'battery';
      return `Upgrade ${name}: a permanent boost (max level ${T.upgrade.maxLevel}). ${T.actionAp.upgrade} AP and ${cost}, and afterwards it draws ${Math.round(T.upkeepPerUpgrade * 100)}% more power.`;
    }
    case 'research':
      return `Research ${name}: ${T.actionAp.research} AP and ${T.research.battery}% battery. Enough good results unlock a permanent breakthrough.`;
    case 'allocate':
      return target === 'power'
        ? `Conserve mode: extras are switched off this phase, so the battery drains slower, but plants grow slower too. ${T.actionAp.allocate} AP.`
        : `Give ${name} first pick of the battery this phase. If power runs short, other systems go without. ${T.actionAp.allocate} AP.`;
    default:
      return '';
  }
}

export function dataStatusText(info) {
  if (!info.usable) return 'Weather source: built-in level profiles (no NASA data files could be loaded).';
  if (info.synthetic) {
    return 'Weather source: NASA-format SAMPLE data (a synthetic placeholder, not real measurements) plus a scripted storm calendar in missions 2 and 3. See data/README_DATA.md to plug in real MEDA / MCS files.';
  }
  return 'Weather source: cached NASA MEDA / MRO MCS snapshot plus a scripted storm calendar in missions 2 and 3. Radiation is a constant MSL/RAD baseline (proxy).';
}

export async function boot({ loaders = defaultLoaders, search = globalThis.location?.search ?? '' } = {}) {
  const params = new URLSearchParams(search);
  let levels;
  try {
    levels = await Promise.all(LEVEL_FILES.map((id) => loaders.loadLevel(id)));
  } catch (err) {
    console.error(err);
    UI.markBooted(); // the module did run, so hide the generic "still loading" note...
    UI.showBootError('The mission files could not be loaded. Serve the folder over http (npm start) and reload.'); // ...then show the specific one
    return null;
  }
  const feed = await loadEnvFeed(loaders.loadCache); // never throws; falls back to engine profiles
  const fixedSeed = params.has('seed') && Number.isFinite(Number(params.get('seed'))) ? Number(params.get('seed')) : null;
  const session = createSession({ levels, feed });
  let current = 0;

  const startMission = (i) => {
    current = Math.min(Math.max(i, 0), levels.length - 1);
    const view = session.start(current, fixedSeed === null ? {} : { seed: fixedSeed });
    UI.showGame();
    UI.setControlsEnabled(true);
    apply(view);
  };

  function apply(view) {
    UI.updateStatusPanel({ ...view.ui, details: view.details });
    if (view.over) {
      UI.setControlsEnabled(false);
      UI.showEnd(view.result, { hasNext: current < levels.length - 1 });
    }
  }

  const guard = (fn) => (e) => {
    try { fn(e); } catch (err) { console.error(err); UI.announce('Something went wrong. Try ending the turn or restarting the mission.'); }
  };

  document.addEventListener('game:start', guard((e) => startMission(e.detail.level)));
  document.addEventListener('game:again', guard(() => startMission(current)));
  document.addEventListener('game:next', guard(() => { UI.selectLevel(current + 1); startMission(current + 1); }));
  document.addEventListener('game:menu', guard(() => {
    if (session.running && !globalThis.confirm('Leave this mission? Your progress will be lost.')) return;
    UI.showIntro();
  }));
  document.addEventListener('game:action', guard((e) => {
    if (!session.running) return;
    const a = e.detail || {};
    if (a.type === 'endTurn') {
      const view = session.endTurn();
      apply(view);
      if (!view.over) UI.announce(`Sol ${view.ui.day}, ${view.ui.phase}. ${view.ui.actionPoints} action points.`);
    } else {
      apply(session.act(a));
    }
  }));

  const wanted = Number(params.get('level')) - 1;
  UI.renderLevelChoices(levels, Number.isInteger(wanted) && wanted >= 0 ? wanted : 0);
  UI.setActionHint(actionHint);
  UI.setDataStatus(dataStatusText(feed.info));
  UI.enableStart('Start mission');
  UI.markBooted();
  return { session, levels, feed };
}

if (typeof document !== 'undefined' && !globalThis.__MARS_TEST__) {
  boot().catch((err) => {
    console.error(err);
    UI.showBootError('Something went wrong while starting the game. Check the browser console.');
  });
}
