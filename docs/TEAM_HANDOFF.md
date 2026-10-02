# NASA Data Layer: Team Handoff

From: Person 3 (data layer). Please read it, answer the questions at the bottom, and send the answers back to me.

## 1. What this part does
It gives the game real-world Moon and Mars environment numbers (sunlight, radiation, dust, temperature) taken from NASA data, plus background images with credits. It works online (through a small proxy server) and fully offline (plain JSON files), so the demo still runs with no internet.

## 2. What you get (inside `outpost-game/`)
| Path | What it is | Who uses it |
|---|---|---|
| `data/cached_mars.json`, `data/cached_moon.json` | The environment numbers for each world | Frontend and simulation |
| `data/image_metadata.json` | Credit, license and original URL for every image | Frontend (credits screen) |
| `assets/images/` | `hero_nebula_3840x2160.jpg`, `surface_mars_1920x1080.jpg`, `surface_moon_1920x1080.jpg`, `nebula_layer_01.png`, `starfield_tile.png` | Frontend |
| `nasa-data-layer/` | Server, normalizer, `data/fetchNasa.js`, README | Only needed for live data |

Where files go: `data/` and `assets/` sit directly inside the project root. Paths in the JSON (for example `assets/images/surface_mars_1920x1080.jpg`) start from that root. Keep `nasa-data-layer/` in the root too, and do not move files inside it.

## 3. What a cached file contains
```json
{
  "name": "mars_demo_2026",
  "image": "assets/images/surface_mars_1920x1080.jpg",
  "background_layers": ["assets/images/nebula_layer_01.png", "assets/images/starfield_tile.png"],
  "solarFlux": 585.9,
  "radiationIndex": 3.4,
  "dustIndex": 0.6,
  "tempRange": { "minC": -93.9, "maxC": -20.9 },
  "notes": "source: NASA POWER / InSight - normalized for demo [SEED VALUES]"
}
```
- `solarFlux`: W/m². Peak sunlight at that world's distance from the Sun. Not reduced by dust, so apply `dustIndex` in the sim.
- `radiationIndex`: 0 to 10 scale (10 is the worst).
- `dustIndex`: 0 to 1.
- `tempRange`: surface temperatures in °C.

## 4. How to use it
1. **Plain frontend (works offline):** `const env = await (await fetch('data/cached_mars.json')).json();`. Serve the project root with any static server (`python3 -m http.server 8080`).
2. **Through the proxy (online):** `cd nasa-data-layer && npm install && cp .env.example .env && npm start`. Then call `http://localhost:3001/cached/mars.json`. `/images/<filename>` serves the images.
3. **From JavaScript modules:** `import { getSimInputs, getCachedEnvironment } from './nasa-data-layer/data/fetchNasa.js'`. This needs a project that uses `import` (ES modules).
4. **Offline switch:** add `?offline=1` to the page URL. Nothing then touches the network.

## 5. Current limits (be honest with judges)
- The numbers in the JSON are **seed values** until I run the live snapshot with a NASA key. The `notes` field says so.
- The three photos are **generated placeholders**, not NASA images, until the image script is run with internet.
- NASA POWER is Earth data, so radiation, Moon temperature and Mars dust come from fixed model constants, not live feeds. The InSight weather feed has been frozen since the mission ended in 2022.

## 6. Questions for you (copy this section, fill it in, send it back)

**Everyone**
1. Your name and which part you own:
2. Your project root folder name and a list of your top-level folders and files (paste the output of `tree` or `ls`):
3. Do your JavaScript files use `import ... from` or `require(...)`?
4. Are you using a framework or bundler (plain HTML/JS, React, Vite, Phaser, other)? Which version?
5. Do you run your own server? Which port and which package.json?

**Frontend / UI**
6. Complete list of image filenames and sizes you need (I only know the five above), and the audio files you need:
7. How do you load the JSON (`fetch` path or `import`)? Paste the line:
8. Do you show credits on screen? What exact fields do you need from `image_metadata.json`?
9. Any error you see when loading my files (paste it exactly):

**Simulation (simEngine)**
10. Which inputs does the sim need, with units? Do you need anything beyond the four values above (for example a day-by-day list instead of one number)?
11. Does the sim expect different scales (for example `radiationIndex` 0 to 100, or Kelvin instead of °C)?
12. Which worlds do you need besides Mars and the Moon, if any?
13. Does the sim read data once at start, or does it need updates while running?

**Anything else**
14. What is failing or missing from your side?
