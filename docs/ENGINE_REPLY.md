# Engine reply: answers for Person 3 and notes for Person 1

From the owner of the simulation engine (`simEngine.js`) and event visuals/audio (`gameVisuals.js`).
Note: the briefs number people differently (in Person 1's brief this part is "Person 2, game content & rules"; in Person 3's handoff, Person 3 is data). Use **part names**, not numbers.

---

## A. Answers to Person 3's questions (the "Simulation (simEngine)" part)

1. **Part I own:** simulation engine + event animations/sounds. Files: `scripts/simEngine.js`, `scripts/gameState.js`, `scripts/gameVisuals.js`, `scripts/bridge.js`, `assets_manifest.json`.
2. **Folders and files:**
   ```
   scripts/  simEngine.js  gameState.js  gameVisuals.js  bridge.js   (+ demo-only: uiExample.js demoVisuals.js)
   assets_manifest.json    demo.html (demo only)
   ```
3. **Module system:** ES modules (`import ... from`, `export`). Pages must load them with `<script type="module">`. `fetchNasa.js` being ESM is fine.
4. **Framework:** none. Plain HTML/JS, no bundler, no build step.
5. **Server:** I don't run one. Any static server works (`python3 -m http.server 8080`). No `package.json` needed for my files.
10. **Inputs the engine uses (all optional, one value each, no day-by-day list needed):**
    `solar_flux_wm2` (W/m², peak, dust applied by the engine) · `temp_min_c`, `temp_max_c` (°C) · `dust_tau` (optical depth, 0 for Moon) · `background_dose_msv_h` (mSv/h) · optional `day_length_h`, `daylight_fraction`.
11. **Scales:** your files are fine as they are. `scripts/bridge.js` converts them:
    - `solarFlux` → `solar_flux_wm2` (unchanged, °C stays °C)
    - `dustIndex` → Mars: `dust_tau` 1:1 (0.6 → τ 0.6). Moon: no atmosphere, so dust only makes panels dirtier faster.
    - `radiationIndex` → `radiationIndex × 0.01` mSv/h (Mars 3.4 → 0.034, close to real ≈ 0.027; a Moon index of ~5.7 would give the real ≈ 0.057).
    **Please tell me** what real value each end of the 0–10 radiation scale stands for, and whether your Moon `dustIndex` is lunar dust on panels or something else. If you tell me, I change that one constant.
12. **Worlds:** only `mars` and `moon`. A third world needs a new preset from me.
13. **Timing:** the engine reads the data **once**, in `engine.init(seed, config)`. No updates while running. A live fetch must finish before `init`; the offline JSON is simplest.
14. **Missing from my side:** I have only seen the Mars example. Please paste `cached_moon.json` and the output shape of `getSimInputs()`, and I'll check the conversion against them.

**How your file reaches the engine (3 lines):**
```js
import * as engine from './scripts/simEngine.js';
import { loadEnvironment } from './scripts/bridge.js';
const cfg = await loadEnvironment('data/cached_mars.json');   // converts units
engine.init('2026', cfg);
```

---

## B. Notes for Person 1 (frontend)

**What is different from the plan in your brief.** Your brief describes *day-by-day decision cards* (`scenarios.json` with static `effects`). My engine is an *hour-by-hour simulation* with random events. They fit together like this (recommended):

1. The player picks an option on the decision screen.
2. `engine.applyEffects(option.effects, scenario.title)`: your `effects` apply immediately. fuel/oxygen/power/food are % points; **`radiation` = % of the mission dose limit** (+5 = 5 % of 250 mSv).
3. `const day = advanceDay(engine)` (from `bridge.js`): simulates 24 hours, including random solar flares, micrometeorite strikes and dust storms.
4. Results screen: `day.delta` (what changed), `day.events` (what hit them; each has a `message`), plus your `learn` sentence.
5. HUD: `toFrontendStats(engine.getState())` returns `fuel, oxygen, power, food, radiation` (all 0–100, radiation bad when high), plus `crew_morale, shielding, habitat_health` as extras.

**Lose conditions the engine already enforces** (`state.game_over.reason`): oxygen ≤ 0, food ≤ 0, habitat health ≤ 0, crew morale ≤ 0, or radiation dose ≥ limit (radiation stat = 100). **Win:** your choice, for example `state.hour / 24 >= N`.

**Balance note:** over one simulated day the engine drains only a few % per resource, so your card `effects` will dominate. If you want hourly consumption to matter more, use `advanceDay(engine, 72)` or ask me to raise the rates.

**Overlap to settle:** your brief lists `assets.js` and `animations.js`. My `gameVisuals.js` also loads assets and animates events. Pick one:
- **Option 1:** use mine for the outpost scene (a `<canvas id="stage">`) and keep yours for the screens and HUD.
- **Option 2:** use only yours. Wire it with `engine.subscribe('event', ev => yourAnimation(ev))` where `ev.type` is `solar_flare`, `micrometeorite` or `dust_storm`, `ev.severity` is `minor`, `moderate` or `severe`, and `ev.target` names the module hit.

**Asset names:** `assets_manifest.json` (project root) now uses your real file names. Sounds you did not list (`solar_flare`, `impact`, `dust_loop`, `alarm`) fall back automatically: flare and impact use `explosion`, dust uses the ambient loop, alarm is synthesized. Missing sprites (habitat, solar array, oxygen tank) are drawn as shapes.

**Please send me:**
- Your export names from `scripts/assets.js` and `scripts/animations.js` (paste the files).
- Whether your pages use `<script type="module">`.
- The `scenarios.json` once it exists. I'll check the effect keys against the engine.

---

## C. What I changed after reading your files

- New `applyEffects()` in the engine and new `scripts/bridge.js`, as described above.
- `gameVisuals.js` now picks `backgroundMars` / `backgroundMoon` by location.
- `assets_manifest.json` rewritten with your file names.
- My earlier brief is renamed `ENGINE_BRIEF.md`, so it no longer clashes with Person 1's `TEAM_BRIEF.md`.
