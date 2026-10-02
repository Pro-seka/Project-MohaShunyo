# nasa-data-layer (Person 3)

Supplies the game with normalized NASA data, cached JSON for offline demos, and image credits.

```
outpost-game/                     <- frontend project root (Team A)
├─ data/
│  ├─ cached_mars.json            <- normalized Mars environment (frontend reads this)
│  ├─ cached_moon.json
│  └─ image_metadata.json         <- credit/license/original URL for every image
├─ assets/images/                 <- hero_nebula_3840x2160.jpg, surface_mars_1920x1080.jpg,
│                                    surface_moon_1920x1080.jpg, nebula_layer_01.png, starfield_tile.png
└─ nasa-data-layer/               <- this folder
   ├─ server/index.js             <- proxy + cache + static endpoints
   ├─ server/normalize.js         <- raw NASA -> schema (also a CLI)
   ├─ scripts/fetchImages.js      <- downloads real NASA images + writes credits
   └─ data/  fetchNasa.js, raw_mars.json, raw_moon.json, cached/ (snapshots + proxy cache)
```

## Start the server (online mode)
```bash
cd nasa-data-layer
npm install
cp .env.example .env      # paste NASA_API_KEY=... (free at https://api.nasa.gov/; DEMO_KEY works but is ~30 req/hr)
npm start                 # http://localhost:3001
```
If `nasa-data-layer/` is not inside the frontend folder, set `OUTPOST_DIR=/path/to/outpost-game` in `.env`.

| Endpoint | Returns |
|---|---|
| `GET /cached/mars.json`, `/cached/moon.json` | `outpost-game/data/cached_mars.json` / `cached_moon.json` |
| `GET /images/<filename>` | file from `outpost-game/assets/images/` (also `/assets/...`) |
| `GET /api/power?lat=&lon=&start=&end=` | NASA POWER daily solar, normalized (`&raw=1` = untouched) |
| `GET /api/mars-weather?station=insight` | InSight temp/pressure/wind per sol |
| `GET /api/images?q=mars%20surface` | curated NASA Images API results |
| `GET /api/sim/mars` (or `moon`) | live simEngine inputs, falls back to the snapshot |
| `GET /api/snapshot/mars` (or `moon`) | rebuilds raw + cached files from live NASA data |
| `GET /api/health` | mode and key status |

The proxy sends your key to NASA server-side, so browsers never hit NASA directly (no CORS problems). It rate-limits clients (30 req/min/IP), caches upstream responses to `data/cached/proxy-*.json`, and serves the last good copy if NASA is down (`X-Cache: STALE`).

## Offline mode (no internet, no server)
Copy the files and serve the project root with any static server:
```bash
# the frontend only needs outpost-game/data/cached_mars.json and cached_moon.json (already there)
cd outpost-game && python3 -m http.server 8080    # frontend: fetch('data/cached_mars.json')
```
Or keep using `fetchNasa.js` with `?offline=1` on the page URL (`getCachedEnvironment('mars')`, `getSimInputs('mars')`). To make the proxy itself serve only cached files: `npm run start:offline`.

## Schema of `cached_*.json`
`name, image, background_layers[], solarFlux, radiationIndex, dustIndex, tempRange{minC,maxC}, notes`
- `solarFlux`: W/m², peak flux at the body's distance from the Sun (not reduced by dust; apply `dustIndex` in the sim)
- `radiationIndex`: 0 to 10 (surface dose in mSv/day divided by 2, times 10)
- `dustIndex`: 0 to 1; `tempRange`: degrees Celsius

## Regenerate the cached files
```bash
npm start && npm run snapshot        # live: writes data/raw_*.json, data/cached/*.json and ../data/cached_*.json
npm run normalize                    # offline: raw_*.json -> ../data/cached_mars.json and cached_moon.json
# equivalent single-file form:
node server/normalize.js data/raw_mars.json > ../data/cached_mars.json
```

## Images and credits
`npm run fetch-images` (needs internet; `npm i sharp` to auto-resize) downloads real NASA images into `../assets/images/` under the exact filenames and overwrites their entries in `../data/image_metadata.json` with the real credit and `https://images.nasa.gov/details/<id>` URL. `nebula_layer_01.png` and `starfield_tile.png` are transparent overlays and stay generated.

## Current state: placeholders and seed data
- **The JSON values are seed data** (`notes` says so) until you run `npm run snapshot` with a real key.
- **The three photo images are generated placeholders**, not NASA images (`status: "placeholder"` in `image_metadata.json`). Run `npm run fetch-images` and commit the result before judging.

## Data caveats
POWER is an Earth dataset, so only its top-of-atmosphere term is reused for the Moon. Radiation, Moon temperature and the Mars dust index are model constants (see `server/normalize.js`), not live feeds. InSight ended in 2022, so its feed is a frozen archive. NASA media is generally public domain, but check each item's page, and don't imply NASA endorsement.

## `scripts/data.js` for the simulation engine
`npm run build-datajs` writes `../scripts/data.js`, which exports `marsData` and `moonData` in the engine's format (`solar_flux_wm2`, `temp_min_c`, `temp_max_c`, `dust_tau`, `day_length_h`, `daylight_fraction`, `background_dose_msv_h`, `source`, `location`). It holds plain values with no network calls, so it loads instantly and works offline. Run `npm run snapshot` first to replace the seed values with live ones.
`dust_tau` is modelled from the season (InSight has no optical depth in its feed) and `daylight_fraction` is a constant 0.5. Both are assumptions.
