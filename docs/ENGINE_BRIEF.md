# Outpost Sim: Team Brief (Engine + Visuals part)

Written by Person 2 (simulation engine + event visuals/audio). Everyone reads **Section 1**, then fills in **only their own section** (2, 3 or 4) and sends it back to Person 2.

---

## 1. The big picture (everyone read this)

The game runs in **one-hour steps**. Person 2's engine keeps 7 numbers (0–100 %):
`fuel, power, oxygen, food, crew_morale, shielding, habitat_health`.
The player picks actions (generator, rover, eco life support, shielding, repair, ...). Random events (solar flare, micrometeorite, dust storm) hit the outpost. A visuals file plays an animation and sound for each event.

```
Team C (data.js) ──numbers──▶  simEngine.js  ──events/state──▶  gameVisuals.js ──▶ screen + sound
                                   ▲                                   ▲
                      main page / ui.js (buttons)            Team A (images + audio + manifest)
```

### Folder layout (put files exactly here)

```
outpost-project/
├── index.html                 ← main game page (UI owner)
├── demo.html                  ← Person 2's test page (can delete at the end)
├── assets_manifest.json       ← OR assets/assets_manifest.json (agree on ONE place)
├── scripts/
│   ├── simEngine.js           ← Person 2
│   ├── gameState.js           ← Person 2
│   ├── gameVisuals.js         ← Person 2
│   ├── demoVisuals.js, uiExample.js  ← Person 2 (demo only)
│   ├── data.js                ← Team C
│   └── ui.js                  ← UI owner
└── assets/
    ├── images/                ← Team A
    └── audio/                 ← Team A
```

### Rules
1. Don't edit another person's file. Ask the owner.
2. Everything must be run from a local server (`python3 -m http.server`), not by double-clicking the HTML file.
3. Use lowercase file names with no spaces.
4. Units: W/m² for sunlight, °C for temperature, mSv/h for radiation.

---

## 2. TEAM A (images + audio): fill in and send back

The code uses **logical names**; you tell me which real file belongs to each. Write the exact file name you made (or "not made"). Sprites: 128×128 PNG for player and rover; others up to 256 px.

| Logical name (don't rename) | What it is | Your real file path | Size (px) |
|---|---|---|---|
| playerSprite | commander | assets/images/commander_sprite_128.png | 128×128 |
| roverSprite | rover | | |
| habitatSprite | habitat module | | |
| solarArraySprite | solar panels | | |
| oxygenTankSprite | oxygen tank | | |
| smokeSprite | smoke puff (soft, transparent) | | |
| shardSprite | debris shard | | |
| sparkSprite | explosion spark | | |
| backgroundImage | surface background (640×360 or 16:9) | | |

| Logical name | What it is | Real file (ogg and/or mp3) | Loop? |
|---|---|---|---|
| explosion | big boom | assets/audio/explosion.ogg | no |
| solar_flare | flare whoosh/alarm | | no |
| impact | micrometeorite hit | | no |
| dust_loop | wind / dust storm | | **yes** |
| ambient_loop | base ambience | | **yes** |
| button | UI click | | no |
| boot | start-up sound | | no |
| alarm | low-resource warning beep | | no |

**Also tell me:**
- Does your `assets_manifest.json` already exist? Paste it in the box below.
- Are the sprites facing a particular direction or pixel art (crisp edges)?
- Do you have extra files not in this list (icons, explosion animation frames)? List them.

**Paste your assets_manifest.json here:**
```json

```

---

## 3. TEAM C (data): fill in and send back

`data.js` should export **one plain object**. Every field is optional; missing ones fall back to defaults. Fill the real numbers and tell me the source.

```js
export const marsData = {
  source: "",                // e.g. "InSight TWINS sol 120-180" / "NASA POWER lat,lon"
  location: "mars",          // "mars" or "moon"
  solar_flux_wm2: null,      // peak sunlight at noon, W/m²   (default Mars 590, Moon 1361)
  // OR, if you only have NASA POWER daily energy:
  solar_kwh_m2_day: null,    // kWh/m²/day  (the engine converts it)
  temp_min_c: null,          // coldest night temperature, °C
  temp_max_c: null,          // warmest day temperature, °C
  dust_tau: null,            // atmospheric dust optical depth (InSight opacity), 0 for Moon
  day_length_h: null,        // Mars 24.66, Moon 708.7
  daylight_fraction: null,   // fraction of the day with sun (0.05–1)
  background_dose_msv_h: null // radiation on the surface, mSv per hour
};
```

**Answer these:**
1. Which datasets did you use (NASA POWER, InSight, other)? Which dates/location?
2. Do you have **both** Mars and Moon data? If only one, which?
3. Are your numbers in the units above? If not, list the units you have.
4. Is the data loaded from a file/URL (JSON/CSV) or typed in by hand? If it loads from the internet, say so, since it must finish before the game starts.

**Paste your data object (or a sample of your raw data) here:**
```js

```

---

## 4. UI / MAIN PAGE OWNER: fill in and send back

(Say who this is: ____________)

### What you must add to the main page
```html
<canvas id="stage"></canvas>        <!-- scene with animations -->
<div id="hud-radiation"></div>      <!-- optional radiation readout -->
```
```js
import * as engine from './simEngine.js';
import { loadAssets, bindEngine } from './gameVisuals.js';

await loadAssets('assets/assets_manifest.json');   // path to the real manifest
engine.init('2026', { location: 'mars', data: marsData });   // data from Team C
bindEngine(engine, { canvas: document.getElementById('stage'),
                     hudRadiation: document.getElementById('hud-radiation') });
```
After this, `engine.step()` (advance one hour) and `engine.applyAction('toggle_generator')` automatically play visuals and sounds.

**Action ids you can use for buttons:** `toggle_generator`, `toggle_rover`, `set_life_support_eco`, `set_life_support_normal`, `deploy_shielding`, `toggle_repair`, `toggle_ration`, `toggle_shelter`, `clean_panels`.
`engine.listActions()` returns the labels and which buttons are on/disabled.

**Test keys (demo/judges):** N = advance 1 h · D = dust storm · S = solar flare · M = micrometeorite · Shift = severe · U = mute.

### Answer these
1. What does your page look like (framework? plain HTML/JS? React?)
2. Which of the 7 variables and actions do you show/use?
3. Game length: how many hours/days should a mission last? Win condition (survive N days)?
4. Do you auto-advance time (timer) or does the player press a button?
5. Any extra action or event you want added to the engine? Describe in one line.

---

## 5. What to send back to Person 2 (checklist)

Person 2 then sends this to Claude. Please provide:

- [ ] Your filled-in section above (2, 3 or 4)
- [ ] Your real file (`assets_manifest.json`, `data.js`, or `ui.js`) pasted in full
- [ ] If something doesn't work: open the page, press **F12 → Console**, and paste the **red error text**, plus the name of the file you were testing
- [ ] What you expected to happen vs what happened (one sentence)

---

## 6. Quick reference: what each event does on screen

| Event | You should see / hear |
|---|---|
| Solar flare | one bright flash, ☢ readout pulses, flare sound |
| Micrometeorite | shards + smoke on the hit module, shake, impact sound |
| Dust storm | orange haze + darker scene, looping wind sound |
| Resource low | alarm beep |
| Game over | big explosion, red flash |

If a sprite or sound file is missing, the game still runs with a drawn shape or a synthesized sound. The console tells you which names were missing.
