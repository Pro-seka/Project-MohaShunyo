# Outpost Commander

A browser game for the NASA Space Apps Challenge. You command a four-person outpost on Mars or the Moon and balance power, oxygen, food, shielding, morale and habitat health. Every fix costs something somewhere else.
**[Check Here to Play Outpost Commander Directly](https://pro-seka.github.io/Project-MohaShunyo/)**


## Run it

Open `index.html` in any modern browser. Nothing to install or build. It needs an internet connection for the anime.js script; fonts load from the local `fonts/` folder, so keep it next to `index.html`. For a local server instead: `python3 -m http.server`, then open http://localhost:8000.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. Repository Settings, Pages, deploy from the `main` branch root.
3. The game is live at `https://<user>.github.io/<repo>/`.

## How to play

Tap objects on the base: solar array cleans, rover drives, dome shelters the crew, greenhouse rations food, astronaut repairs, generator burns fuel, berm adds shielding, tank toggles eco life support. The same actions are on the button dock. Space pauses. Speed is 1x, 2x or 4x. Sounds are synthesized in the browser (no audio files): every action, tab, speed change and event has its own cue. Toggle with the speaker button or the M key. Survive the whole mission (72 h Cadet, 96 h Commander). A run seed is shown in the Mission tab, and the same seed replays the same events.

## What is where

- `index.html` is the whole game: interface, scene, animation and the simulation engine embedded in it. Edit this file to change the game.
- `engine/` holds the original `simEngine.js` and `gameState.js` for reference. They are embedded unchanged in `index.html`. The balance numbers are `TUNING`, `SHORT_MISSION_TUNING` and `PRESETS` there.
- `nasa-data-layer/` fetches and caches NASA data (InSight weather, NASA POWER solar data, NASA Image and Video Library metadata). Add your own key in a local `.env` (see `.env.example`); do not commit it.
- `data/` and `docs/` are the original team data and briefs.

## Credits

- Environment numbers: NASA InSight (TWINS) weather, NASA POWER solar data, NASA reference values for the Moon.
- NASA Image and Video Library, https://images.nasa.gov. NASA/JPL credited as the source.
- Simulation engine and data layer: Outpost Sim team. Animation: anime.js (MIT). Font: Montserrat (SIL OFL). Icons: Phosphor Icons (MIT), inlined. Scenery, rover, rocket and astronaut: original, drawn in code.
- Not endorsed by NASA. The NASA insignia is not used.
