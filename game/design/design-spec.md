# Mars Outpost: Design Spec (game engine, rules and scoring)

File: `/game/design/design-spec.md` · Engine: `/game/src/game-logic.js` · Owner: Sakib

Everything here matches the code. Every balancing number lives in the `TUNING` object at the top of `game-logic.js`.

> **Honesty note.** The NASA-to-gameplay mappings are game-balancing choices *inspired by* real measurements. They are not a physics simulation. See `balancing-report.md` for the ranges and the reasoning.

## 0. Assumptions (one line each, since the brief left these open)

1. `initialConfig` is `{ level: <level JSON object>, seed: <number|string> }`. A level JSON can also be passed directly (with an optional `"seed"` field). The engine never reads files, so the glue code loads the JSON.
2. `turnLimit` counts **sols** (Martian days). One sol = one **day phase** + one **night phase**. Each `endTurn` resolves one phase.
3. The `envData` passed to a `step` call that includes `endTurn` is the weather for the phase being resolved. The glue should pass daytime data for day phases and night-time data for night phases.
4. `uiState.lifeSupport` is the **oxygen reserve** (0-100). Hidden equipment health lives in `state.conditions` (power, lifeSupport, food) and `state.shield`. Aritro may read them from `state`, but nothing in the contract depends on it.
5. `amount` on `repair` / `research` means "repeat this many times" (1 to 3, each repeat costs its own AP and rolls its own outcome). It is ignored for `upgrade` and `allocate`.
6. Actions listed after `endTurn` in the same array are ignored. A `step` call without `endTurn` only applies actions (no time passes).
7. "Partial outcome" exists at three levels: per action, per turn, and as a mission ending (`success` with `tier: "partial"`, shown as "limping home").
8. `step` mutates the instance and returns a deep copy of the state, so the UI can keep or discard it safely.

## 1. Turn loop

```
Sol N, day phase  ->  player spends action points (AP)  ->  endTurn  ->  day resolves (sun is up)
Sol N, night phase->  player spends AP (one fewer)       ->  endTurn  ->  night resolves (no solar power)
Sol N+1 ...
```

- AP per day phase = the level's `actionPoints` (3). AP per night phase = that minus 1 (minimum 1): the crew is tired. Unused AP is lost.
- Costs: `repair` 1, `research` 1, `allocate` 1, `upgrade` 2.
- The mission ends when a fail condition hits, or after night of sol `turnLimit`.

## 2. State (the five systems)

| System | Stock (0-100) | Hidden health (0-100) | What it needs |
|---|---|---|---|
| **Power** | `power` (battery) | `conditions.power` (panels), `panelDust` (% of panel covered) | sunlight (day only) |
| **Life Support** | `oxygen` (shown as `lifeSupport`) | `conditions.lifeSupport` (scrubbers and seals) | power, healthy scrubbers |
| **Radiation Shielding** | `shield` (integrity) and `radiation` (crew dose, **higher is worse**) | the shield *is* its own health | power (a little), repairs |
| **Food** | `food` | `conditions.food` (greenhouse pumps) | power, light |
| **Dust & Weather** | `dust` (0-1, from `envData`) | none | (it is the enemy) |

Also tracked: `upgrades` (0-3 per system), `research` points, `breakthroughs` (0-2 per system), `alerts`, `blackoutTurns`, `starveTurns`, `score`, `result`.

Systems interact: dust lowers solar output **and** crop growth. Low power lowers scrubbing and growth. Cold makes heaters eat power. Plants add a little oxygen. A starved shield wears faster. In level 3 a weak system also damages its neighbour.

## 3. Actions

| Action | AP | Cost | Success | Partial (50% effect) | Failure |
|---|---|---|---|---|---|
| `repair` X | 1 | none | X health +25 (shield +20). **Power** also cleans 40% of panel dust | half of that | health -3, no fix |
| `upgrade` X | 2 | battery 10 (Power), 12 (Life Support), 12 (Shield), 8 + 6 food (Greenhouse) | level +1 (max 3) | level +1 but X health -10 | costs are spent, nothing changes |
| `research` X | 1 | 3 battery | +1 research point | +0.5 point | +0 (battery still spent) |
| `allocate` X | 1 | none | always works. X in {lifeSupport, shield, food}: **priority** on the battery this phase. X = `power`: **conserve mode** (food load x0.6, extras x0.5, crops grow x0.6) | n/a | n/a |
| `endTurn` | 0 | | resolves the phase | | |

- A repair on something already at 98%+ (and, for Power, panels under 10% dust) is refused **for free** with a hint. So are upgrades you cannot afford.
- **Upgrade gains** per level: Power +15% solar output, Life Support +12% scrubber output, Shield -20% wear, Greenhouse +15% growth. Each level also raises that system's power load by 10% (**upkeep**).
- **Research**: every 3 points is a **breakthrough** (max 2 per system). Power +8% solar, Life Support -10% air use, Shield -15% wear, Greenhouse +10% growth. Each breakthrough also adds +4% to that system's action success chance.

### Action outcome roll

```
chance   = clamp( base - fieldPenalty + 0.04 x breakthroughs[X], 0.30, 0.97 )
base     = repair 0.85, upgrade 0.90, research 0.70
fieldPenalty = (0.35 if X in {power, shield} else 0.10) x dustOpacity  +  0.05 at night
roll r in [0,1) from the seeded hash:
  r < chance                              -> success
  r < chance + 0.6 x (1 - chance)         -> partial
  otherwise                               -> failure
```

*Why:* outdoor jobs (panels, shield plates) are harder in a dust storm, and everyone is sloppier at night.
*Example:* repair Power at night with dust 0.6 and no breakthroughs: `0.85 - 0.35x0.6 - 0.05 = 0.59` success, `0.41 x 0.6 = 24.6%` partial, `16.4%` failure.

## 4. NASA data to multipliers (summary)

Full table with ranges and rationale: `balancing-report.md`. All outputs are clamped.

| Function | Formula | Range |
|---|---|---|
| `dustToSolar(dust)` | `1 - 0.8 x dust` | 1.0 to 0.2 |
| `irradianceToSolar(W)` | `W / 450` | 0.2 to 1.0 |
| `solarMultiplier(env)` | dust only if irradiance is null, else `0.5 x dustToSolar + 0.5 x irradianceToSolar` | 0.2 to 1.0 |
| `temperatureToHeater(T)` | `1 + (-T - 60) / 60` | 0.5 to 2.0 |
| `temperatureToLifeSupportLoad(T)` | `1 + (-T - 60) / 150` | 0.85 to 1.4 |
| `radiationToShieldDegradation(r)` | `r / 0.03` | 0.5 to 3.0 |
| `pressureToLeakChance(P)` | `0.05 + (700 - P) x 0.0008` | 2% to 35% |
| `windToDustDeposition(w)` | `0.5 + 0.5 x w` (% of panel area per day phase) | 0.5 to 6 |
| `dustToGrowth(dust)` | `1 - 0.5 x dust` | 1.0 to 0.5 |

**Missing data.** Any field that is null, missing, `NaN` or not a number falls back to the level profile's default (calm / unstable / cascade values in `PROFILES`). Numbers outside the plausible range are clamped. `solarIrradiance: null` is normal and just means "use dust only". If `sources` contains a "proxy" flag the engine records `state.env.proxy = true`. The names of the fields that fell back are in `state.env.fallbacks`.

## 5. Phase resolution (in this exact order)

Let `m` = the multipliers above, `esc = 1 + escalation x (sol - 1)`, `U(k)` = upgrade level of k.

1. **Equipment fault** (chance `faultChance x esc`): a random system loses 15-30 health (shield takes 80% of that).
2. **Cascade** (level 3 only): if the weakest of Power/Life Support/Greenhouse is under 40 health, 35% chance its neighbour (Power to Life Support to Greenhouse to Power) loses 8-15.
3. **Solar particle event** (chance `flareChance`): shield wear and crew dose x3 this phase.
4. **Habitat leak** (chance `leakChance(P) x leakScale x (1.5 - lifeSupportHealth/100)`): lose 6-13 oxygen and 4 seal health.
5. **Power.** Day only: `panelDust += deposition(wind) x (0.5 + dust)`, then
   `generation = 44 x solar x (powerHealth/100) x (1 - 0.6 x panelDust/100) x (1 + 0.15U) x (1 + 0.08 x breakthroughs)`.
   Loads (battery % per phase), each x`(1 + 0.1U)` except heater and misc: Life Support 3.5, Heater `2 x heaterMult`, Greenhouse 2.5, Shield 1.5, Misc 1.
   Loads are served in priority order (default: Life Support, Heater, Greenhouse, Shield, Misc; an `allocate` moves one to the front). If the battery cannot cover a load, that system gets only a fraction `frac` this phase (a **brownout**). New battery = clamp(battery + generation - served, 0, 100).
6. **Cold damage.** If the heater gets under 60% of what it needs and it is colder than -20 C: Life Support health -3, Greenhouse health -4.
7. **Food.** `growth = (6 day | 3 night) x fracFood x foodHealth/100 x dustToGrowth x (1 + 0.15U) x (1 + 0.1 x breakthroughs)` and `food += growth - 4`.
8. **Life support.** `oxygen += 9 x fracLS x lsHealth/100 x (1 + 0.12U) - 6 x lsLoad x (1 - 0.1 x breakthroughs) + 0.1 x growth`.
9. **Shield and dose.** `wear = 0.6 x rad x flare x (1 - 0.2U) x (1 - 0.15 x breakthroughs)` (x1.5 if the shield was not fully powered). `dose = 1.2 x rad x flare x (1 - 0.85 x shield/100)`. Dose never goes down.
10. **Wear.** Panels -0.3 (day only), scrubbers -0.4, pumps -0.3 health per phase, all x`esc`.
11. Advance the clock, reset AP, check alerts, classify the turn, check win/fail.

### Worked example: one day phase (level 2, seed 1, no random hazard that phase)

Start: power 80, oxygen 85, food 70, shield 90, radiation 5, panelDust 5, all health 100. Weather: `temperature -63, pressure 720, wind 6.5, dust 0.35, radiation 0.03, irradiance 310`.

| Step | Calculation | Result |
|---|---|---|
| Multipliers | solar `0.5x0.72 + 0.5x(310/450)`, heater `1 + (63-60)/60`, LS load `1 + 3/150`, rad `0.03/0.03`, leak `0.05 - 20x0.0008`, deposition `0.5 + 0.5x6.5`, growth `1 - 0.5x0.35` | 0.704, 1.05, 1.02, 1.0, 3.4%, 3.75, 0.825 |
| Panel dust | `5 + 3.75 x (0.5 + 0.35)` | 8.2% |
| Solar generation | `44 x 0.704 x 1.0 x (1 - 0.6x0.082)` | +29.5 |
| Loads | `3.5 + 2x1.05 + 2.5 + 1.5 + 1` | -10.6 |
| **Power** | `80 + 29.5 - 10.6` | **98.9** |
| Crop growth | `6 x 1 x 1 x 0.825` | +4.95 |
| **Food** | `70 + 4.95 - 4` | **71.0** |
| Air | scrub 9, crew `6x1.02 = 6.12`, plants `0.1x4.95 = 0.5` | |
| **Oxygen** | `85 + 9 - 6.12 + 0.5` | **88.4** |
| Shield wear | `0.6 x 1.0` | -0.6 |
| **Shield** | `90 - 0.6` | **89.4** |
| Dose | `1.2 x 1.0 x (1 - 0.85x0.894)` | +0.29 |
| **Radiation** | `5 + 0.29` | **5.3** |

The same weather in a storm (dust 0.85, 12 m/s wind, -96 C, radiation 0.09, no irradiance) gives solar 0.32, heater x1.6, LS load x1.24, shield wear x3, deposition 6, growth x0.575. That is why storms hurt.

## 6. Outcomes and narrative

- **Per action:** success / partial / failure, each with branching teen-friendly text (2 variants each, picked by the seeded hash). The text always states the numbers ("Power condition 62% to 87%"). A research success adds a real-world fun fact.
- **Per turn:** after every `endTurn` one summary event is produced:
  - `failure` ("Setback", severity critical) if any alert is at critical level, or at least half of 2+ actions failed.
  - `partial` (severity warning) if any alert is at warning level, any action was not a clean success, or a hazard hit.
  - `success` (severity info) otherwise.
  It also states net changes: "Battery -12, air +3, food -1, shield 0."
- **Alerts** fire once when a stock crosses a threshold (warning / critical): oxygen 35 / 15, power 25 / 8, food 30 / 10, shield 40 / 20, radiation 55 / 80 (higher is worse).
- **Weather explainers** fire when a condition switches on: dust storm (dust >= 0.6), storm of the century (>= 0.85), strong winds (>= 12 m/s), deep freeze (<= -90 C), pressure dip (<= 560 Pa), radiation spike (>= 0.06). Each explains *why* it matters.
- All flavour text is in `narrative.md` and in the `NARR` / event tables of `game-logic.js`.

## 7. Levels

| | Level 1: First Sol | Level 2: Storm Season | Level 3: The Long Haul |
|---|---|---|---|
| Idea | tutorial, calm weather | storms and equipment faults | long mission, cascading risks |
| `envProfile` | calm | unstable | cascade |
| Sols (`turnLimit`) | 20 | 30 | 40 |
| AP (day / night) | 3 / 2 | 3 / 2 | 3 / 2 |
| Start power / oxygen / food / shield | 100 / 100 / 80 / 100 | 80 / 85 / 70 / 90 | 70 / 80 / 60 / 80 |
| Fault chance per phase | 0 | 10% | 12% |
| Solar particle event chance | 0 | 5% | 7% |
| Leak scale | 0.3 | 1.0 | 1.3 |
| Wear escalation per sol | 0 | +1% | +1.5% |
| Cascade | no | no | yes |
| **Win minimums** (at end) | O2 >= 25, food >= 25, power >= 15, shield >= 30, dose <= 70 | 25, 25, 20, 35, dose <= 65 | 30, 30, 25, 40, dose <= 60 |
| **Thriving** also needs | O2 >= 60, food >= 50, power >= 50, shield >= 60, dose <= 30, 2 upgrade levels | 55, 45, 45, 55, dose <= 35, 4 upgrade levels | 50, 40, 40, 55, dose <= 50, 6 upgrade levels |

## 8. Win, fail and endings

`evaluateWinLoss(state)` returns:

**`failure`** as soon as any of these is true:
- oxygen <= 0 (*suffocation*)
- radiation dose >= 100 (*radiation*)
- food at 0 for 3 phases in a row (*starvation*)
- battery at 0 for 3 phases in a row (*blackout*)
- the last sol ends and the win minimums are not met (*objectives-missed*)

**`success`** after night of the last sol if all win minimums are met.
- `tier: "full"` (*thriving*) if the thriving thresholds are also met.
- `tier: "partial"` (*limping home*) otherwise. This is a real win, just a worn-out one.

**`ongoing`** in every other case. The result is stored in `state.result = { status, reason, tier, score }`.

## 9. Scoring

```
score = 10 x sols survived
      + 1.5 x (oxygen + food + power + shield)
      - 2 x radiation dose
      + 20 x total upgrade levels
      + 30 x total breakthroughs
      + 150 if success   (+150 more if tier is full)
```
Rounded, never below 0. Failed runs keep what they earned before the end (but get no bonus).

*Worked example (trace A below):* 20 sols -> 200. Final oxygen 100, food 100, power 87.4, shield 97.4 -> `1.5 x 384.8 = 577.2`. Dose 15.5 -> `-31`. 12 upgrade levels -> 240. 8 breakthroughs -> 240. Total `1226.2`, plus win 150 and thriving 150 = **1526**.

## 10. Determinism

- All randomness is `rand(seed, turnIndex, stream, k)`, a stateless hash. No `Math.random`, no clock.
- Luck (faults, flares, leaks) depends only on the seed and the turn number, **not** on what you did. Two players on the same seed face the same bad luck, so scores are comparable. (Tests check this.)
- Same seed + same actions + same `envData` = identical game.

## 11. Example game traces

Produced by `node game/tests/run-tests.js --traces` (bots follow fixed rules; the weather is a scripted stand-in for NASA data with a few null fields). Legend: turn results **S** = success, **P** = partial, **F** = setback; Rad = crew dose (lower is better). Actions: `rep`air, `upg`rade, `res`earch, `alc` = allocate; targets `pwr`, `air`, `shd`, `fod`. Only sol 1, every 5th sol and the last sol are shown.

**Trace A: L1 Steady hand (invest + repair)** (level 1, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | upg:fod res:fod / upg:fod | 100 | 81 | 69 | 99 | 5 | F/S |
| 5 | upg:air res:fod / upg:fod | 100 | 65 | 70 | 95 | 7 | P/S |
| 10 | res:shd / res:shd | 100 | 84 | 97 | 83 | 10 | S/S |
| 15 | res:air / res:air | 100 | 84 | 100 | 99 | 14 | S/P |
| 20 | none / none | 100 | 87 | 100 | 97 | 16 | S/S |

Result: **success (full)**, reason "thriving", score 1526.

**Trace B: L1 Autopilot (never act)** (level 1, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | none / none | 100 | 89 | 80 | 99 | 5 | S/S |
| 5 | none / none | 100 | 90 | 81 | 94 | 7 | S/S |
| 10 | none / none | 100 | 90 | 81 | 88 | 10 | S/S |
| 15 | none / none | 100 | 90 | 79 | 82 | 13 | S/S |
| 20 | none / none | 100 | 90 | 76 | 76 | 17 | S/S |

Result: **success (partial)**, reason "limping", score 829.

**Trace C: L1 Lights-out (conserve power every turn)** (level 1, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | alc:pwr / alc:pwr | 100 | 91 | 77 | 99 | 5 | S/S |
| 5 | alc:pwr / alc:pwr | 100 | 91 | 64 | 94 | 7 | S/S |
| 10 | alc:pwr / alc:pwr | 100 | 91 | 49 | 88 | 10 | S/S |
| 15 | alc:pwr / alc:pwr | 100 | 91 | 32 | 82 | 13 | S/S |
| 20 | alc:pwr / alc:pwr | 100 | 91 | 14 | 76 | 17 | P/P |

Result: **failure**, reason "objectives-missed", score 587.

**Trace D: L2 Storm-ready (food/shield first)** (level 2, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | upg:fod res:fod / upg:fod | 91 | 74 | 58 | 88 | 6 | F/S |
| 5 | res:fod / upg:air | 100 | 49 | 60 | 84 | 9 | S/P |
| 10 | none / none | 100 | 50 | 55 | 98 | 13 | S/S |
| 15 | rep:air res:shd / upg:pwr | 100 | 65 | 47 | 93 | 16 | S/P |
| 20 | res:shd / res:shd | 100 | 60 | 49 | 88 | 22 | S/P |
| 25 | res:pwr / res:pwr | 100 | 84 | 54 | 92 | 26 | S/P |
| 30 | res:air / none | 100 | 87 | 68 | 90 | 30 | S/S |

Result: **success (full)**, reason "thriving", score 1537.

**Trace E: L2 Patch-and-pray (repair only)** (level 2, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | rep:shd / rep:shd | 91 | 89 | 70 | 99 | 6 | P/S |
| 5 | none / none | 100 | 89 | 68 | 98 | 8 | S/S |
| 10 | rep:fod rep:air rep:fod / rep:fod | 100 | 89 | 63 | 98 | 11 | P/S |
| 15 | rep:air rep:air / rep:shd | 100 | 89 | 56 | 94 | 14 | S/P |
| 20 | none / rep:shd | 100 | 89 | 54 | 99 | 19 | S/S |
| 25 | rep:shd / none | 100 | 89 | 48 | 98 | 23 | S/S |
| 30 | rep:shd rep:fod / none | 100 | 89 | 46 | 98 | 26 | S/S |

Result: **success (partial)**, reason "limping", score 899.

**Trace F: L2 Upgrade rush (no repairs)** (level 2, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | upg:pwr / upg:pwr | 91 | 73 | 70 | 88 | 6 | P/S |
| 5 | upg:fod / upg:pwr | 100 | 55 | 60 | 74 | 10 | S/P |
| 10 | upg:pwr / upg:pwr | 100 | 40 | 59 | 61 | 17 | S/S |
| 15 | upg:pwr / upg:pwr | 98 | 0 | 51 | 57 | 25 | P/F |
| 19 | upg:pwr / upg:pwr | 67 | 0 | 36 | 51 | 38 | F/F |

Result: **failure**, reason "blackout", score 585.

**Trace G: L3 Power first** (level 3, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | rep:shd upg:pwr / rep:shd res:pwr | 86 | 70 | 59 | 95 | 6 | F/F |
| 5 | upg:air / upg:pwr | 100 | 35 | 50 | 89 | 10 | S/P |
| 10 | alc:pwr / none | 100 | 39 | 40 | 98 | 16 | S/S |
| 15 | rep:air res:fod / res:fod | 100 | 84 | 27 | 94 | 20 | P/P |
| 20 | res:shd / res:shd | 100 | 77 | 24 | 95 | 26 | P/P |
| 25 | res:air / rep:pwr res:air | 100 | 75 | 33 | 97 | 31 | S/F |
| 30 | res:air / rep:pwr | 100 | 84 | 36 | 92 | 35 | P/S |
| 35 | rep:shd / rep:shd | 100 | 87 | 41 | 82 | 42 | P/S |
| 40 | none / none | 95 | 87 | 45 | 97 | 45 | S/P |

Result: **success (full)**, reason "thriving", score 1576.

**Trace H: L3 Food first, shield ignored** (level 3, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | upg:fod res:fod / upg:fod | 86 | 59 | 47 | 78 | 6 | F/S |
| 5 | none / upg:air | 100 | 39 | 47 | 70 | 12 | S/P |
| 10 | alc:pwr / none | 100 | 42 | 46 | 74 | 23 | S/S |
| 15 | rep:air res:pwr / upg:shd | 100 | 57 | 35 | 64 | 31 | S/P |
| 20 | none / upg:pwr | 100 | 40 | 29 | 64 | 43 | S/P |
| 25 | rep:shd res:air / rep:pwr res:air | 100 | 52 | 33 | 84 | 52 | F/F |
| 30 | res:air / rep:pwr res:air | 100 | 70 | 30 | 68 | 59 | P/P |
| 35 | rep:shd / rep:shd | 100 | 87 | 30 | 77 | 70 | P/P |
| 40 | none / none | 95 | 87 | 37 | 74 | 77 | P/P |

Result: **failure**, reason "objectives-missed", score 1166.

**Trace I: L3 Lab rat (research only)** (level 3, seed 7)

| Sol | Choices that sol (day / night) | Air | Power | Food | Shield | Rad | Turn results |
|---|---|---|---|---|---|---|---|
| 1 | res:pwr res:air res:shd / res:pwr res:air | 86 | 63 | 59 | 78 | 6 | P/F |
| 5 | res:pwr res:air res:shd / res:pwr res:air | 100 | 43 | 56 | 71 | 12 | P/S |
| 10 | res:pwr res:air res:shd / res:pwr res:air | 100 | 20 | 44 | 41 | 26 | S/P |
| 15 | res:pwr res:air res:shd / res:pwr res:air | 96 | 0 | 21 | 33 | 40 | F/F |
| 17 | res:pwr res:air res:shd / res:pwr res:air | 80 | 0 | 6 | 29 | 46 | F/F |

Result: **failure**, reason "blackout", score 430.

### What the traces show

| Trace | Lesson |
|---|---|
| A vs B | On calm level 1, investing turns a bare survival (score 829, "limping") into a thriving base (1526). |
| C | "Save power all the time" **loses** on the tutorial: dimmed lights starve the crops. Being stingy is a strategy, and it has a price. |
| D vs E | In storms, mixing repairs with upgrades and research thrives. Repair-only never grows and only limps home. |
| F | Upgrades without repairs drain the battery to zero and end in a blackout. |
| G vs H | On level 3, fixing power first works. Putting food first and ignoring the shield lets the dose creep to 77, so the mission is missed at the very end. |
| I | Research pays back slowly. On its own it cannot keep the lights on. |

No single one-trick plan thrives on all three levels (checked in the tests).

## 12. Tradeoffs (for players)

**Repair** *Now:* fixes what is broken and keeps you safe. *Later:* it does not make anything better than new, and things wear out again. Repairs only hold your ground.

**Upgrade** *Now:* costs 2 action points and some battery, so your base is weaker this turn, and every upgrade uses a bit more power. *Later:* it gives a permanent boost every turn. Upgrading during a storm, when the battery is low, is how bases go dark.

**Research** *Now:* uses an action point and battery, and can fail. *Later:* three good experiments give a permanent breakthrough and make that system's jobs a bit more reliable.

**Allocate** *Now:* costs an action point. *Later:* nothing lasts past this phase. *Use it:* when the battery is nearly empty. Priority decides who gets power first. Conserve mode makes the battery last longer, but your plants grow slower.

**End turn** *Now:* time moves on and things wear out. *Later:* nothing good happens on its own, so use your action points first (an unused point is gone).

**The big trade-offs**
- Dust storms make **less power** and **less food** at the same time. Save battery *before* the storm.
- Dust and wind cover your panels. Clean them (repair Power) or lose output.
- The shield never heals fully and radiation dose **never goes down**. A weak shield now means a high dose later.
- If one system is weak, its neighbours suffer. Fix the weakest link first.
- You cannot do everything. Each turn has only 3 action points, so choosing is the game.

**Why does a dust storm hurt solar panels?** Dust in the air scatters and absorbs sunlight before it reaches the panels, so they get less light. Plants get less light too, so they grow slower. Dust that lands on the panels blocks even more.
**Why does cold hurt?** Heaters must work harder when it is colder, which drains the battery. Very cold nights also make the crew use more life support.
**Why is radiation a problem on Mars?** Mars has almost no magnetic field and a very thin atmosphere, so charged particles from the Sun and space reach the ground. Thick walls or soil piled on top help.
**Why do leaks happen?** Habitats are pressurised and the outside air is very thin. Weather changes flex the seals, and old seals leak.

## 13. Notes for teammates (no changes to the contract)

- Aritro: `uiState` has exactly the keys in section 4.3. If you want to show hidden health bars, read `state.conditions.{power,lifeSupport,food}` and `state.upgrades` from the `step` result. `events[].type` is `action | weather | hazard | alert | turn | mission` and can be used for icons. `state.result` is `{ status, reason, tier, score }`.
- Ridwan: any `envData` field may be `null`. The engine clamps values to these ranges: temperature -140..30 C, pressure 300..1200 Pa, wind 0..60 m/s, dust 0..1, radiation 0..0.5 mSv/h, irradiance 0..800 W/m2.

