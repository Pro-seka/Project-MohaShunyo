# Architecture

Three independent parts, joined by one small glue layer.

```
            data/cache/*.json            game/src/levels/*.json
                   │                              │
          ┌────────▼────────┐             ┌───────▼────────┐
          │  src/env-feed   │  envData    │ game-logic.js  │  createGame / step / evaluateWinLoss
          │  + scenarios    ├────────────►│  (pure engine) │
          └────────▲────────┘             └───────▲────────┘
                   │ nasaData.normalize()         │
                   │                      ┌───────┴────────┐  view = { ui, details, over, result }
                   └──────────────────────┤ src/session.js │◄──────────────┐
                                          └───────┬────────┘               │ game:action, game:start ...
                                                  │ view                   │ (DOM events)
                                          ┌───────▼────────┐        ┌──────┴──────┐
                                          │  src/main.js   ├───────►│  src/ui.js  │
                                          └────────────────┘        └─────────────┘
```

## Rules of the road

- `game/` has no DOM, network or imports, and never reads the clock or `Math.random` (a test enforces this). Randomness is a seeded hash, so a run is fully determined by *seed + choices + weather*.
- `data/` never touches the game. Its output contract is `envData` (see `data/README_DATA.md` §4).
- `src/ui.js` never touches game rules. It renders what it is given and dispatches DOM events.
- `src/session.js` is the only place that calls the engine, and it has no DOM access, so it is tested in plain Node.

## One turn

1. Player commits an action → UI dispatches `game:action {type, target}` → `session.act()` calls `step(game, [action], env)`. The action applies immediately; time does not pass.
2. Player ends the turn → `session.endTurn()`:
   1. `step(game, [endTurn], env)` resolves the phase with the weather the player saw.
   2. `env = feed.get(nextSol, nextPhase, scenario)`.
   3. `step(game, [], env)` (no actions): the "morning briefing", so weather events for the new phase appear in the log.
3. `session` returns a view (meters, event log with a `fresh` flag, per-system condition, outlook, result). `main.js` passes it to `ui.updateStatusPanel()`, and to `ui.showEnd()` when the mission is over.

## Weather for each phase (`src/env-feed.js`)

| Field | Source |
|---|---|
| temperature, pressure, wind, irradiance | MEDA hourly record; daytime phases use local time 09:00–15:59, night phases 20:00–04:59; records rotate with the sol number |
| dust opacity | MRO/MCS daily series (one entry per sol, cycling), flagged `proxy` |
| radiation | constant MSL/RAD baseline, flagged `proxy` |
| storms (missions 2–3) | `src/scenarios.js` raises dust/wind on a fixed calendar; flagged `scenario` |

If a snapshot is missing or malformed the feed returns nulls and the engine falls back to its level profile. It never throws into the game loop.

## Outlook

`session.outlookFor()` peeks two sols ahead in the same feed (the storm calendar is deterministic) and reports "Clear skies", "Hazy, dust rising" or "Dust storm building". This gives the player time to prepare, which is the point of the trade-off design.

## What was changed while merging the three packages

Nothing in `game/src/game-logic.js`, the level files, or `data/src/nasaData.js` was modified. Changes were made only at the seams:

- **Layout.** Files were placed to match the paths each package's own README and imports already assumed (`game/src/...`, `data/src/...`, `data/cache/...`, `styles/`, `src/`).
- **Missing data modules written.** `nasaData.js` imports `convert/csv.js` and `convert/meda_records.js`, which were not in the data zip (nor were `make_synthetic_samples.js` / `selftest_convert.js`). `csv.js` and `meda_records.js` were re-implemented from the contracts in `README_DATA.md` and `columns.js`, and `selftest_convert.js` was added to test them. `make_synthetic_samples.js` was not recreated; the committed samples are used as-is.
- **UI.** Rebranded "Outpost Ares" → "Mars Outpost"; anime.js vendored at a pinned version instead of `@4` from a CDN; mission picker, how-to, end-of-mission dialog, outlook, score, per-system condition lines and an action hint added; footer text corrected to describe the data honestly; the auto-start button now emits `game:start` instead of hiding the intro itself.
- **Glue (new).** `main.js`, `session.js`, `env-feed.js`, `scenarios.js`.
- **Tooling (new).** `package.json`, `scripts/serve.js`, `tests/`, `.github/workflows/ci.yml`, `LICENSE`, `.gitignore`.
