# Architecture

Plain scripts, no bundler, so the game runs from `file://`. Load order in `index.html`:
`three.min.js` -> `data/nasa-data.js` (window.SOL72_NASA) -> `data/storms.js` (window.SOL72_STORMS) -> `engine.js` (window.SimEngine) -> `orbits.js` (window.Sol72Orbits) -> `nasa.js` (window.Sol72Data) -> `learn.js` (window.Sol72Learn) -> `game.js`.

- **engine.js**: deterministic hour-by-hour model, seeded. API: `init, step, applyAction, debugTriggerEvent, applyEffects, getState, listActions, getConfig, getReplayLog, replay, subscribe, rating, getSchedule, buildSchedule, sevFromClass`, plus `DIFFICULTY` (the single source of truth for Cadet and Commander, used by the game, the tests and the balance work). Exports for Node via `module.exports`.
- **nasa.js**: archive + live DONKI/POWER; `buildEnv(world, scenarioId)` feeds the engine, including the chosen storm and today's Earth-Mars delay.
- **orbits.js**: JPL approximate planetary elements -> radio delay.
- **learn.js**: read-only teaching layer (cards, coach tips, NASA tab, recap); never changes the simulation.
- **game.js**: the 3D scene, input, HUD and sound. It is formatted build output with shortened variable names; edit it with care and keep the engine API as the contract.

## Engine rules worth knowing
- **Fixed RNG draws:** 10 per hour, in a fixed order, so events never depend on player actions (r[8] picks the real flare, r[9] decides a no-warning flare).
- **Scripted scenarios:** `config.data.scenario` ({flares} or {dust}) becomes a seeded timetable (`buildSchedule`); flares replay in real order, never overlapping.
- **Guaranteed flare:** if none has rolled by a seeded hour (16 to 39), one is forced.
- **Crew efficiency:** `clamp((morale-20)/50, 0.3, 1)` scales repairs and research.

## Tests
- `node tests/engine.test.js`: determinism, every action's cost, flares and no-warning flares, scripted storms, stars, balance bands.
- `node tests/data.test.js`: storm archive sanity, no unverified flare classes, signal delay at known orbit positions.
- `python3 tests/browser_e2e.py` (Playwright, Chromium): plays a mission with mocked NASA responses, scenario selection, new hotkeys. Slow in headless software WebGL (about 2.5 minutes).

`docs/team-notes/` keeps the original team briefs for reference.
