# Balancing Report: NASA range to game multiplier

File: `/game/design/balancing-report.md` · Code: the multiplier functions at the top of `/game/src/game-logic.js`

> **Be honest about what this is.** These are **game-balancing choices inspired by real Mars data**. They are not a physics simulation. Real dust, heat, radiation and pressure effects are far more complicated. Every mapping is simple, monotonic and clamped so the game stays fair and predictable. The "real-world anchor" column gives rough orders of magnitude to show where each range comes from; check them against Ridwan's data sheets before quoting them in the pitch.

## 1. Master table (spreadsheet style)

| # | `envData` field | Unit | Plausible range we accept (clamped) | Neutral / "1.0" point | Game multiplier | Formula | Output range | Fallback if null |
|---|---|---|---|---|---|---|---|---|
| 1 | `dustOpacity` | 0-1 | 0 to 1 | 0 = clear | **solar** | `1 - 0.8 x d` | 1.0 to 0.2 | profile default (0.15 / 0.40 / 0.50) |
| 2 | `dustOpacity` | 0-1 | 0 to 1 | 0 = clear | **crop growth** | `1 - 0.5 x d` | 1.0 to 0.5 | same |
| 3 | `solarIrradiance` | W/m2 | 0 to 800 | 450 = full sun | **solar (blend)** | `0.5 x dustSolar + 0.5 x (W / 450)` | 0.2 to 1.0 | `null` allowed: use dust only |
| 4 | `temperature` | C | -140 to 30 | -60 C | **heater power draw** | `1 + (-T - 60) / 60` | 0.5 to 2.0 | profile default (-55 / -68 / -75) |
| 5 | `temperature` | C | -140 to 30 | -60 C | **life-support load** | `1 + (-T - 60) / 150` | 0.85 to 1.4 | same |
| 6 | `radiation` | mSv/h | 0 to 0.5 | 0.03 | **shield wear and crew dose** | `r / 0.03` | 0.5 to 3.0 | profile default (0.03 / 0.04 / 0.05) |
| 7 | `pressure` | Pa | 300 to 1200 | 700 Pa = 5% | **leak chance per phase** | `0.05 + (700 - P) x 0.0008` | 2% to 35% | profile default (720 / 660 / 620) |
| 8 | `windSpeed` | m/s | 0 to 60 | 0.5 at calm | **dust on panels per day phase** | `0.5 + 0.5 x w` | 0.5 to 6 (% of panel area) | profile default (4 / 9 / 10) |

*Inputs outside the accepted range are clamped first. Non-numbers (`null`, `NaN`, strings) trigger the fallback. Which fields fell back is recorded in `state.env.fallbacks`.*

## 2. Lookup tables (generated from the real functions)

**Dust (rows 1, 2)**

| dust | 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| solar x | 1.00 | 0.92 | 0.84 | 0.76 | 0.68 | 0.60 | 0.52 | 0.44 | 0.36 | 0.28 | 0.20 |
| growth x | 1.00 | 0.95 | 0.90 | 0.85 | 0.80 | 0.75 | 0.70 | 0.65 | 0.60 | 0.55 | 0.50 |

**Temperature (rows 4, 5)**

| T (C) | -130 | -120 | -110 | -100 | -90 | -80 | -70 | -60 | -50 | -40 | -30 | 0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| heater x | 2.00 | 2.00 | 1.83 | 1.67 | 1.50 | 1.33 | 1.17 | 1.00 | 0.83 | 0.67 | 0.50 | 0.50 |
| life-support load x | 1.40 | 1.40 | 1.33 | 1.27 | 1.20 | 1.13 | 1.07 | 1.00 | 0.93 | 0.87 | 0.85 | 0.85 |

**Radiation (row 6)**

| mSv/h | 0.01 | 0.02 | 0.03 | 0.045 | 0.06 | 0.075 | 0.09 | 0.12 |
|---|---|---|---|---|---|---|---|---|
| wear / dose x | 0.50 | 0.67 | 1.00 | 1.50 | 2.00 | 2.50 | 3.00 | 3.00 |

**Pressure (row 7)**

| Pa | 400 | 500 | 550 | 600 | 650 | 700 | 750 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| base leak chance | 29% | 21% | 17% | 13% | 9% | 5% | 2% | 2% | 2% |

The real chance is `base x leakScale x (1.5 - lifeSupportHealth/100)`. Level 2 (scale 1.0) with fresh seals at 720 Pa gives about 1.7% per phase. Level 3 (scale 1.3) with damaged seals (40% health) at 600 Pa gives `0.13 x 1.3 x 1.1 = 18.6%` per phase.

**Wind (row 8)**

| m/s | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 15 |
|---|---|---|---|---|---|---|---|---|
| % panel area covered per day phase (at neutral opacity) | 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5 | 6 | 6 |

The real deposit is `wind value x (0.5 + dust)`. Airborne dust settles faster when there is more of it.

## 3. Rationale for each mapping

**1. Dust to solar (1.0 to 0.2, linear).** Dust in the air blocks sunlight; that is the real reason Mars rovers slow down in storms. Even in the worst storms a little light gets through, so the floor is 0.2 rather than 0 (a floor also keeps the game from becoming unwinnable). *Real-world anchor:* Mars background dust opacity is typically a fraction of 1, and regional/global storms push it above 1, so we normalise 0 to 1 and compress the extremes into the top of the scale. *Choice:* linear so a teen can predict it: "0.5 dust means about 60% power".

**2. Dust to crop growth (1.0 to 0.5).** Plants need light too, but greenhouses can use grow-lights, so the penalty is gentler than for solar panels. This creates a real two-front pressure in storms: less power *and* less food.

**3. Irradiance blend.** `solarIrradiance` is a direct measurement, so we use it when we have it. Because irradiance already includes the effect of dust, we blend 50/50 with the dust mapping instead of multiplying, which would count dust twice. `450 W/m2` is the game's "full sun" (real clear-sky noon values are a bit higher, so 450 is a slightly conservative baseline for a dusty landing site). Calibrated so the example `envData` (dust 0.35, 310 W/m2) gives 0.70, close to the dust-only 0.72.

**4. Temperature to heater draw (0.5 to 2.0).** Colder means the heaters work harder. -60 C is the neutral point, close to a typical Mars mean. *Real-world anchor:* Perseverance/MEDA sees roughly -80 C nights and -20 to -40 C afternoons, depending on season. The night heater draw is therefore about 1.3x, and a deep-freeze night at -100 C about 1.7x. The 0.5 floor means warm afternoons cut the heating bill by half but never to zero.

**5. Temperature to life-support load (0.85 to 1.4).** Cold habitats need more work to keep the air conditioned. The range is intentionally milder than the heater (about a quarter of the effect) so temperature is a second-order pressure on air, not a first-order one.

**6. Radiation to shield wear and dose (0.5 to 3.0).** `0.03 mSv/h` is the neutral point because the example `envData` uses 0.03, and it is of the same order as surface dose-rate measurements from earlier Mars missions (roughly 0.5 to 0.7 mSv per day, i.e. about 0.02 to 0.03 mSv/h). The 3x ceiling matches the 3x "solar particle event" multiplier, so a flare and a data-driven spike both feel like the same kind of danger. The floor of 0.5 stops a quiet reading from making the shield free.

**7. Pressure to leak chance (35% to 2%).** Mars surface pressure is roughly 600 to 900 Pa depending on place and season. In the game, thinner outside air means a bigger pressure difference across the seals and more seal stress. This is a *game* link (real leak rates depend on the pressure difference between inside and outside, which is enormous in every case), used to make weather changes matter. Seal health multiplies it, so repairing Life Support cuts leak risk.

**8. Wind to dust deposition (0.5 to 6).** Wind lifts dust and drops it on panels. *Real-world anchor:* rovers' panels do collect dust over months, and occasional wind gusts and dust devils have cleaned them. To keep the game simple only the "collects dust" half is modelled; the player does the cleaning (repair Power removes 40%). At 6.5 m/s and 0.35 dust a day phase adds `3.75 x 0.85 = 3.2%`, so after ten sols without cleaning the panels give about 20% less.

## 4. Calibration targets (why the constants are what they are)

Values below assume healthy equipment and are computed from the real formulas (`solarBase 44`, loads 10 to 11 per phase).

| Weather | Dust | Panels dusty | Solar x | Day income | Loads (day + night) | **Net battery per sol** |
|---|---|---|---|---|---|---|
| Calm | 0.15 | 10% | 0.88 | +36.4 | 10.0 + 11.1 | **+15** |
| Moderate | 0.40 | 15% | 0.68 | +27.2 | 10.2 + 11.3 | **+6** |
| Storm | 0.80 | 25% | 0.36 | +13.5 | 10.2 + 11.3 | **-8** |
| Storm of the century | 0.95 | 30% | 0.24 | +8.7 | 10.5 + 11.7 | **-13** |

- A full battery therefore lasts on the order of 8 to 12 sols of storm, which is about the length of the storms in the levels. Skipping upgrades and cleaning makes that shorter.
- **Food:** crew eats 8 per sol; a healthy greenhouse grows about `9 x growth x` health. At dust 0.15 that is about +0.3 per sol (break-even); at dust 0.8 about -2.6 per sol. Food upgrades are how you get ahead.
- **Air:** a healthy scrubber makes 9 per phase and the crew uses about 6, so air normally refills. It only falls if scrubbers are worn, the battery is empty, or a leak hits.
- **Shield:** baseline wear is 0.6 per phase (about 24 over 20 sols). A solar particle event triples that: at baseline radiation about 1.8 shield and about 1.8 dose (at 60% shield) in one phase.
- **Radiation dose** never falls, so it is the long-term clock. That is why a shield-neglecting strategy can look healthy for 30 sols and still fail at the end (trace H).

## 5. Sanity checks that the tests enforce

- Every multiplier function stays inside its stated range over a wide sweep and is monotonic.
- Null, `NaN`, strings and out-of-range numbers never break the engine.
- No single one-trick strategy thrives on all three levels.
- Bad luck is the same for every player on the same seed, so balancing comparisons are fair.

## 6. Tuning guide

To make the game easier or harder, change one thing at a time, then rerun the tests and read the traces (`node game/tests/run-tests.js --traces`):

| To make it... | Change | Where |
|---|---|---|
| less punishing storms | raise `solarBase` or the 0.2 floor in `dustToSolar` | `TUNING.solarBase`, `dustToSolar` |
| slower power drain | lower `TUNING.loads.*` | `TUNING.loads` |
| gentler equipment | lower `faultChance` / `escalation` in the level JSON | `hazards` |
| easier win | lower the `winConditions` minimums in the level JSON | level JSON |
| stronger upgrades | raise `TUNING.upgrade.gain` | `TUNING.upgrade` |
