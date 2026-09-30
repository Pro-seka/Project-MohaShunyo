# Mars Outpost

> **Every engineering decision has consequences.**
> A browser game for the **NASA Space Apps Challenge**. You command a small Mars outpost. Dust storms cut your solar power, radiation wears down the shield, equipment breaks, and you only have a few action points each turn. Fixing one problem always costs you somewhere else.

No build step, no framework, no backend. Plain HTML, CSS and ES modules.

## Play

**Online:** enable GitHub Pages for this repo (Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`), then open the Pages URL.

**Locally** (browsers block ES modules on `file://`, so use a server):

```bash
npm start                      # http://localhost:8000   (no dependencies needed for this)
# or, without Node:
python3 -m http.server 8000
```

Handy URL options: `?level=2` preselects a mission, `?seed=42` makes a run repeatable (same seed and same choices give the same game), `?demo=1` adds a UI demo button.

## How to play

1. Pick a mission (3 levels: *First Sol*, *Storm Season*, *The Long Haul*).
2. Each day and night you get **action points**. Spend them to **repair**, **upgrade**, **research** or **allocate** power to one of four systems: Power, Life support, Radiation shield, Greenhouse.
3. **End the turn.** Mars responds with weather derived from NASA data formats: dust, wind, cold, pressure and radiation.
4. Watch the **Outlook** in the status bar: it warns you a couple of sols before a storm. Survive until the relief ship arrives with every meter above the mission goals.

The point: you can't optimise everything. Upgrades draw more power. Research spends battery. Repairing panels means not repairing the shield. The end screen tells you which trade-off got you.

## Project layout

```
mars-outpost/
├── index.html              page shell (intro, dashboard, end-of-mission dialog)
├── styles/                 main.css (design tokens, layout), animations.css
├── src/                    the browser app
│   ├── main.js             entry point: wires UI <-> session <-> data
│   ├── session.js          turn flow, event log, view models (no DOM, unit-tested)
│   ├── env-feed.js         NASA snapshots -> one envData object per day/night phase
│   ├── scenarios.js        scripted storm calendar for missions 2 and 3
│   ├── ui.js               all DOM rendering and animation
│   └── vendor/             anime.js 4.5.0 (MIT), vendored so the game works offline
├── game/                   game engine (pure JS, no DOM, no network)
│   ├── src/game-logic.js   rules, equations, scoring, win/loss
│   ├── src/levels/         level-1..3.json
│   ├── tests/run-tests.js  49 engine tests + decision-sequence traces
│   ├── design/             design spec, balancing report, narrative bible
│   └── README_GAME.md
├── data/                   NASA data pipeline
│   ├── src/nasaData.js     fetchLatest(), normalize()
│   ├── src/convert/        CSV parser, MEDA/MCS converters, column mapping
│   ├── src/nasaMockServer.js  optional local API (needs express)
│   ├── cache/              meda-sample.json, mcs-sample.json  (SYNTHETIC, see below)
│   └── README_DATA.md
├── tests/                  glue-layer and UI tests, plus run-all.js
├── docs/                   ARCHITECTURE.md, UI.md
└── scripts/serve.js        zero-dependency static server (npm start)
```

## Tests

```bash
npm install     # only needed for the UI test (jsdom) and the mock server (express)
npm test        # runs all five suites
```

| Suite | What it checks |
|---|---|
| `game/tests/run-tests.js` | rules, multipliers, determinism, all three levels winnable and losable |
| `data/test_ingest.js` | NASA normalisation, units, provenance flags, retry/backoff (add `-- --with-server` via `npm run test:data -- --with-server` to also test the mock server) |
| `data/src/convert/selftest_convert.js` | CSV parser, MEDA table joiner, MCS profile reducer |
| `tests/session.test.js` | data feed, storm calendar, turn flow, autopilot playthroughs of every level with several seeds |
| `tests/ui.test.js` | the real `index.html` + `main.js` + `ui.js` driven in a headless DOM |

## About the data (please read)

- **The bundled snapshots are synthetic placeholders.** `data/cache/*-sample.json` are marked `"synthetic": true`: they have the exact schema and plausible magnitudes of Perseverance **MEDA** and MRO **Mars Climate Sounder** data, but they are **not NASA measurements**. The UI footer says so, and every derived field carries `synthetic` / `proxy` flags.
- **What is real:** the instrument-to-field mapping, unit conversions and dust-opacity formula (documented with sources in `data/README_DATA.md`), and the radiation baseline from MSL/RAD (Hassler et al. 2014), which is used as a constant *proxy* because MEDA has no dose sensor.
- **Storm calendar:** the sample data is calm, so missions 2 and 3 add a scripted storm calendar (`src/scenarios.js`) that only ever *raises* dust/wind and lowers temperature during "cold snaps". Overlaid fields are flagged `scenario: true`.
- **Using real data:** download MEDA/MCS files, run the converters in `data/src/convert/` (steps in `data/README_DATA.md` §7). They write `data/cache/*-latest.json`, which the game prefers over the samples automatically. The MEDA column names in `columns.js` are unverified guesses: check them with `--inspect` first.

## Credits and licence

- Game design, engine, UI and data pipeline: the Mars Outpost team.
- [anime.js](https://animejs.com) 4.5.0 by Julian Garnier, MIT licence (`src/vendor/anime.LICENSE.md`).
- Data sources and references are listed in `data/README_DATA.md`. This project is not a NASA product and is not endorsed by NASA.
- Project code: MIT (see `LICENSE`; change it if your team prefers another licence).
