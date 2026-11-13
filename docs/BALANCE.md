# Balance report

Measured with scripted players over 60 seeds per cell (`node tests/engine.test.js` prints this table; the tests fail if the bands below are broken).

| World / difficulty | Does nothing (idle) | Reacts only to emergencies and the food tip (casual) | Thoughtful (smart) | Stars: idle -> smart |
|---|---|---|---|---|
| Mars Cadet | 95 % win | 100 % | 100 % | 0.9 -> 2.6 |
| Mars Commander | **0 %** (starves around hour 90) | 95 % | 93 % | 0.0 -> 1.7 |
| Moon Cadet | 100 % | 100 % | 100 % | 1.0 -> 2.9 |
| Moon Commander | **0 %** (starves around hour 90) | 72 % | 97 % | 0.0 -> 2.0 |

How to read it: **Cadet is a gentle learning mode** (survival is likely) but skill shows in the stars (an idle crew gets about 1, a thoughtful one about 2.6). **Commander is where choices decide life or death.**

## What was changed from the two earlier builds, and why
| Problem found | Fix |
|---|---|
| An idle crew won 92 to 100 % of Cadet runs and also scored 2 of 3 stars | Stars now need research and a well-run base; habitat wear and panel dust need real upkeep |
| Morale could not hurt you, so Shelter was nearly free | Shelter now parks the rover, blocks panel cleaning and halves repair speed |
| Ration food was pure cost (food never ran short) | Food store cut from 16 kg to 12 kg, so a 96 h Commander mission runs out unless you ration or grow food; Grow food (greenhouse) added; rationing only stretches what you have |
| No research or reward to risk things for | Research from rover trips in daylight, shown in the Mission tab and stars |
| Generator and fuel were nearly free | Fuel tank 800 kWh instead of 1000; the generator is 20 kW and burns 2.5 % fuel per hour; the rover burns 0.35 % per hour from the same tank |
| Doses so low (250 mSv limit) that radiation rarely mattered | Game-scaled doses 8 / 35 / 100 mSv against a 100 mSv limit |
| The Moon never had a night or sunset ("long nights" in the menu) | Moon mission starts in lunar afternoon: the Sun sinks as you play. Menu text corrected |
| 4 in 10 Cadet missions never met a flare | One flare is guaranteed per mission |
| Dust storms of up to 240 h could not be survived | Storms 36 to 120 h and 39 to 80 % sunlight loss; the 2018 scenario is 48 h |
| Oxygen leaked too fast from small habitat damage | Leak halved, so repairs matter without being a death sentence |

## Dominance check
No single action held on repeat beats a thoughtful player (best single-action policy: generator always on, about 55 to 60 % win in Commander, 0 stars).

## How to re-tune
Difficulty lives in `DIFFICULTY` and the presets in `js/engine.js`. Run `node tests/engine.test.js` after any change; the bands at the end of that file are the design contract.
