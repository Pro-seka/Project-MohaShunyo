# Sol 72

**Keep four astronauts alive on Mars or the Moon, using real NASA data.**
A browser game for kids aged 7 to 12, built for the NASA Space Apps Challenge 2026
(*"Build a Lunar or Martian outpost"*: balance life support, power, shielding and food, where every fix costs something somewhere else).

Play it: open `index.html` in any modern browser. No install, no account, no build step.
Hosted version: https://pro-seka.github.io/Project-MohaShunyo/ (GitHub Pages serves this folder's `index.html`; update the link if your repository name differs).

## What you do
Walk around a 3D base (WASD, arrow keys, or tap) and tap objects to run the outpost. Survive 72 hours (Cadet) or 96 hours (Commander). Same seed, same events: share a seed with a friend. A **coach tip** at the top always names the one thing that needs attention, so a new player never has to read eight bars at once.

Pick **which Sun to face**: today's real flares (NASA DONKI), the September 2017 storm, the May 2024 Gannon storm, Halloween 2003, the 2018 Mars dust storm that stopped Opportunity, or random events.

## Nothing is free: the trade-offs
| Action (hotkey) | What it gives | What it costs |
|---|---|---|
| Drive rover (1) | Research for the star, morale | 4 kW and fuel; only collects in daylight; parked while sheltering |
| Clean panels (2) | Recovers dusty-panel power | Battery; not allowed while sheltering |
| Repair crew (3) | Fixes habitat leaks and panels | Power; half speed in the shelter; slower if the crew is worn out |
| Grow food (4) | Greenhouse makes food | 3 kW; best in daylight |
| Ration food (5) | Food lasts longer | Morale drops, and it makes no new food |
| Generator (6) | 20 kW in a storm or at night | Fuel, which the rover also needs |
| Shelter (7) | Radiation dose cut to a quarter | Morale, no rover, no cleaning |
| Add shielding (8) | Permanent protection | Battery power, and only 4 panels |
| Eco life support (9) | Saves 2 kW | Less oxygen recycled, lower morale |

**Stars:** 1 for surviving, 1 for reaching the research goal, 1 for a well-run base (finish with battery, a sound habitat, a happy crew and a low dose). Doing nothing earns about 1 star at best.

## Learning goals (what a child takes away)
1. A solar flare gives a **warning window**; the dangerous particles arrive hours later (real DONKI record: flare 18:09 UTC, particles 22:33 UTC on 18 Jan 2026).
2. Some flares come from the **far side of the Sun** with no warning (Commander).
3. **Power is life**: night, dust and storms cut sunlight, and the heater works harder in the cold.
4. A message to Mars takes **3 to 22 minutes** (the game computes today's real value), so crews decide alone.
5. Safety costs something: shelter protects the body but hurts morale and stops work.

## The NASA data (what is real, what is not)
Every number is labelled **LIVE**, **ARCHIVE** or *game-scaled* inside the game (NASA tab). Full detail: [`docs/NASA_DATA.md`](docs/NASA_DATA.md).

| NASA source | How the game uses it |
|---|---|
| **DONKI** (space weather) | Flares in your mission are real: 2026 flares (X1.1 to X8.3), or the full 2017, 2024 and 2003 storm episodes replayed in order. If the browser reaches NASA, the last 30 days of real flares change how often flares hit you. |
| **InSight** weather | On Mars, mission day N is a real InSight sol (675 to 681): its real temperature range drives your heater; real pressure and wind are shown. |
| **JPL planetary positions** | Where Earth and Mars are today sets the radio delay shown in the game. |
| **NASA POWER** | Real sunlight on Earth, compared with the sunlight your panels get. Live if reachable. |
| **Curiosity RAD** | Mars background dose and the cruise dose in the radiation ruler. |
| **Artemis I and II** | Shelter = 1/4 dose, from the measured 4x protection of Orion's storm shelter. |
| **OSDR** | Science cards linking radiation and crew stress (OSD-618/640), plus OSD-511 and Inspiration4. Context only. |
| **NASA Image Library** | Mission photo on the end screen (loaded from NASA when online). |
| Chang'e-4 LND | Moon background dose. This is a Chinese-German instrument, not NASA; the game says so. |

Doses in play are **game-scaled** (a severe flare is 100 mSv against a 100 mSv mission limit) so a 72-hour mission can show the danger. The flare class and date are real; the dose is not a prediction.

## Project layout
```
index.html              the game page
css/sol72.css           the wood-and-gold theme
js/engine.js            simulation engine (deterministic, seeded) + difficulty presets
js/data/nasa-data.js    archived NASA snapshot with provenance for every value
js/data/storms.js       famous space-weather episodes (curated archive)
js/orbits.js            Earth-Mars radio delay from JPL orbital elements
js/nasa.js              builds engine input from NASA data, tries live DONKI/POWER
js/learn.js             science cards, coach tips, NASA tab, flare countdown, end recap
js/game.js              3D scene, controls, HUD, sound (formatted build output)
js/vendor/three.min.js  three.js r128 (MIT)
fonts/                  Montserrat (SIL OFL)
docs/                   how to play, gameplay design, NASA data, balance, challenge mapping, pitch kit
tests/                  engine.test.js, data.test.js (Node), browser_e2e.py (Playwright)
tools/                  the team's original data pipeline (optional; see tools/README.md)
```

## Run, test, options
- Play: open `index.html`. (A local server also works: `python3 -m http.server`.)
- The game tries NASA live data by default and falls back to the archive. `?offline` skips every network call. `?nasa_key=KEY` uses your own api.nasa.gov key instead of `DEMO_KEY`. `?demo=1` enables demo keys: Z dust storm, X flare, C meteor, N advance one hour (hold Shift for severe).
- Tests: `node tests/engine.test.js && node tests/data.test.js` (no dependencies). Optional browser test: `python3 tests/browser_e2e.py` (needs Playwright).

## Credits
NASA DONKI, InSight, POWER, Curiosity RAD, Artemis, OSDR and the NASA Image and Video Library; NASA/JPL planetary elements; NOAA SWPC; Chang'e-4 LND (Zhang et al. 2020). three.js (MIT). Montserrat (SIL OFL). Sounds are synthesized in the browser. Scenery, rover and astronauts are drawn in code. Team MohaShunyo. MIT licence. Not endorsed by NASA; no NASA insignia is used.
