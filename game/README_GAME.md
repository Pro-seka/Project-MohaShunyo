# /game: Mars Outpost engine (Sakib)

Pure JavaScript (ES module). No DOM, no network, no dependencies. Runs in Node and in the browser.

## Run the tests

```bash
node game/tests/run-tests.js            # unit + API + rules + determinism + 9 decision-sequence traces
node game/tests/run-tests.js --verbose  # also prints every event of every trace
node game/tests/run-tests.js --traces   # prints the markdown trace tables used in design-spec.md
```

Requires Node 18+ and `"type": "module"` in the root `package.json` (already set in this repo). Expected last line: `49 passed, 0 failed`. Exit code is 1 if anything fails.

## Files

```
game/
  src/game-logic.js        engine: createGame, step, evaluateWinLoss (+ multiplier functions for tests)
  src/levels/level-1.json  First Sol      (calm tutorial, 20 sols)
  src/levels/level-2.json  Storm Season   (storms + faults, 30 sols)
  src/levels/level-3.json  The Long Haul  (cascading risks, 40 sols)
  tests/run-tests.js       plain-Node tests and traces
  design/design-spec.md    rules, equations with worked examples, win/fail, scoring, traces, player tradeoffs
  design/narrative.md      briefing, NPCs, flavour text, endings
  design/balancing-report.md  NASA range -> multiplier table and rationale
  README_GAME.md           this file
```

## Using the engine (for the glue code)

```js
import { createGame, step, evaluateWinLoss } from './game/src/game-logic.js';
// level JSON is loaded by the glue (the engine never reads files)
const game = createGame({ level: level1Json, seed: 42 });

// on every game:action batch from the UI, plus the environment for the phase being resolved:
const { state, events, uiState } = step(game, [
  { type: 'repair', target: 'power' },
  { type: 'upgrade', target: 'food' },
  { type: 'endTurn' },
], envData);   // envData may be null or have null fields

evaluateWinLoss(state); // 'ongoing' | 'success' | 'failure'
```

- `uiState` has exactly the keys from contract 4.3. `events[]` has extra fields (`type`, `system`, `outcome`, `day`, `phase`).
- Without `endTurn` a `step` call only applies actions (time does not pass).
- Pass daytime data for day phases and night data for night phases.
- The seed makes the game repeatable. Use a fixed seed for a daily challenge, or `Date.now()` in the glue for variety (the engine never reads the clock).
- After the mission ends, `step` returns a "Mission over" event and changes nothing.
- Optional extras in `state`: `conditions`, `upgrades`, `breakthroughs`, `score`, `result: { status, reason, tier, score }`, `env` (the sanitised weather, with `fallbacks` and `proxy`).

## Scope

Everything is inside `/game/`. Nothing under `/ui/` or `/data/` was touched, imported or referenced (the tests check this).
