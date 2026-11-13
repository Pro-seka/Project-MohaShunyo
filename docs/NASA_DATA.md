# NASA data in Sol 72

Honesty rule: a value is called **LIVE** only when the browser really fetched it just now. Everything else is an **ARCHIVE** snapshot (stored in `js/data/nasa-data.js` and `js/data/storms.js`), a **computed** value, or a **published constant** with its citation. Nothing static is presented as live.

## Datasets
| Dataset | Status | Where it appears in play | Source |
|---|---|---|---|
| NASA DONKI flares (FLR) | Archive of 7 flares; optional LIVE (last 30 days) | Event names/dates, 4 h particle warning, flare chance, briefing | https://kauai.ccmc.gsfc.nasa.gov/DONKI/ , API `api.nasa.gov/DONKI/FLR` |
| NASA DONKI particle events (SEP) | Archive: one linked example; LIVE count if reachable | Why the warning window exists | DONKI FLR 2026-01-18T17:27:00-FLR-001 |
| Famous storms (2017, 2024, 2003) | Archive (`js/data/storms.js`): flare class, peak time, region | "Which Sun do you face?" replays | NOAA SWPC / NASA DONKI records; verify any row in DONKI by date |
| NASA InSight weather (sols 675 to 681) | Archive (feed frozen since the mission ended in 2022) | Per-sol temperature range (drives heater), pressure, wind, real sol label | `api.nasa.gov/insight_weather` (cached under `tools/nasa-data-layer/data/cached/`) |
| NASA Mars Fact Sheet (NSSDCA) | Published constant | Sunlight on Mars: solar irradiance 586.2 W/m2 (Earth 1361.0) sets the panel output before dust | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| NASA Moon Facts | Published constant | Moon surface temperature range -173 to 127 C drives the Moon heater load; solar constant 1361 W/m2 | https://science.nasa.gov/moon/facts |
| NASA/JPL planetary elements | **Computed** in the browser (`js/orbits.js`), accurate to a few percent | Today's Earth-Mars radio delay (3 to 22 min range) | https://ssd.jpl.nasa.gov/planets/approx_pos.html |
| NASA POWER (ALLSKY_SFC_SW_DWN, 0N 0E, 11 to 24 Sep 2026) | Archive; optional LIVE (14 days) | Earth vs your panels solar comparison | https://power.larc.nasa.gov/ |
| Curiosity RAD | Published constants | Mars background dose 0.64 mSv/day (Hassler 2014); cruise 1.8 mSv/day (Zeitlin 2013) | doi 10.1126/science.1244797 |
| Chang'e-4 LND | Published constant (non-NASA) | Moon background dose 1.369 mSv/day; ISS 0.731 mSv/day | Zhang et al. 2020, Sci. Adv. 6, eaaz1334 |
| Artemis I / II (SRAG) | Published results | Shelter factor 0.25 (about 4x protection); shelter procedure | see `artemis` in the data file |
| NASA OSDR | Published study descriptions | Science cards (OSD-618/640, OSD-511, Inspiration4, RadLab). Context only: no OSDR raw data feeds the simulation | https://osdr.nasa.gov/bio/ |
| 2018 global dust storm | Published | Dust-storm card and the scripted 2018 scenario | NASA NTRS 20190001691 |
| NASA Image and Video Library | Hotlinked from NASA when online | End-screen photo | https://images.nasa.gov/ |

## The 7 archived flares ("Today's Sun" offline)
| Class | Date | Region | Severity in game |
|---|---|---|---|
| X1.1 | 2026-06-30 | AR 4479 | minor |
| X1.9 | 2026-01-18 | AR 4341 (14341 in SDO numbering) | minor |
| X2.4 | 2026-04-23 | AR 4419 | moderate |
| X2.5 | 2026-04-24 | AR 4419 | moderate |
| X4.2 | 2026-02-04 | AR 4366 | moderate |
| X8.3 | 2026-02-01 | AR 4366 | severe |
| X28+ | 2003-11-04 | AR 486 | severe |

Verification done for this release: the X8.3 flare of 1 Feb 2026 from AR 4366 (strongest of 2026 in the archive) and the X1.9 flare of 18 Jan 2026 followed by a severe (S4) radiation storm on 19 Jan 2026 were cross-checked against several independent space-weather reports. Some classes still come from news outlets quoting NASA/NOAA rather than from the DONKI API itself; to replace them with DONKI records, run the `FLR` query for 2026 and edit `real_flares`. The 2003 flare is recorded as **X28+** because the satellite detectors saturated at X28 (it was later estimated near X45); earlier drafts said "X40+", which is not an official figure.

## Storm episodes (`js/data/storms.js`)
| Episode | Flares replayed (class, UTC date) |
|---|---|
| September 2017 (AR 2673) | X2.2 6 Sep, X9.3 6 Sep, X1.3 7 Sep, X8.2 10 Sep |
| May 2024 (AR 3664) | X2.2 9 May, X5.8 11 May, X8.7 14 May |
| Halloween 2003 (AR 486) | X17.2 28 Oct, X10.0 29 Oct, X28+ 4 Nov |
| 2018 dust storm (Mars) | One scripted dust storm: tau +3.0 (sunlight cut about 95 %) for 48 h, game-scaled |

The game replays the strongest 2 (Cadet, 72 h) or 3 (Commander, 96 h) flares in real order at seeded hours.

## What is game-scaled (not NASA numbers)
- Dose per flare: 8 / 35 / 100 mSv unshielded (minor / moderate / severe) and the 100 mSv mission limit. Real career limit discussion: a 2022 National Academies report recommended 600 mSv.
- Flare severity from class: below X2 minor, X2 to X7.9 moderate, X8 and above severe (Cadet caps at moderate).
- Battery, oxygen, food and fuel capacities, shrunk so 72 hours is enough to feel pressure.
- Dust-storm strength and length, panel area, efficiency, loads.
- Mars dust opacity (tau 0.4) is modelled from the season; InSight's feed has no opacity.
- The Moon mission starts in lunar afternoon so the Sun sinks during play; the real lunar day is about 29.5 Earth days.

## How data reaches the engine
`js/nasa.js` `buildEnv(world, scenarioId)` turns the archive (and the live scale, if any) into `config.data` for `SimEngine.init`: `daily[]` (InSight sols), `real_flares`, `scenario`, `sep_lead_h`, `flare_rate_scale`, `signal_delay_s`. Live flare scale = clamp(0.6 + strong_flares_in_30_days / 40, 0.6, 1.8); the archive uses 1.0. This is a design choice, not a NASA formula.

## Known limits
- Live DONKI/POWER code was tested against mocked responses, not the real servers. If a request fails the game silently uses the archive and shows ARCHIVE.
- `DEMO_KEY` is rate-limited; use `?nasa_key=`.
- Peak times in the storm archive are rounded; the 2026 flare rows have not all been re-checked against DONKI itself.
- `tools/data/cache/*-sample.json` from the team pipeline are synthetic and unused by the game.
