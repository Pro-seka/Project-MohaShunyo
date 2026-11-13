# Gameplay and learning design

Audience: ages 7 to 12 (older siblings and classrooms can use Commander mode and the NASA tab).

## Core idea
A base with four astronauts, seven bars (fuel, power, oxygen, food, morale, shielding, habitat) and a radiation meter. Hours tick every 5 s (1x, 2x, 4x). Space pauses. Nothing is free: every action moves at least two things in opposite directions, and **power is the shared currency** (every machine draws kilowatts; the generator trades power for fuel; the rover trades fuel and power for research).

To keep young players from feeling overloaded:
- the **coach tip** at the top names the single most urgent thing ("Battery low: run the Generator...");
- the welcome card says: watch three bars first, **Power, Oxygen, Radiation**;
- science cards explain each new word once, and can be turned off.

## The signature lesson: the flare warning window
1. A flare is spotted (banner: "X8.3 flare! Particles in 4 h"). Every mission meets at least one flare.
2. Four game hours later the particles arrive (dose starts).
3. In between the player chooses: shelter early (dose x0.25, morale target -15, but no rover, no panel cleaning, repairs at half speed), spend battery on shielding panels (+12 % each, 4 total), or gamble.
4. **Commander only:** about 3 in 10 flares come from the far side of the Sun with **no warning**: the particles are already here.
5. The end screen shows what the choice saved: "Dose taken 15 mSv instead of 100 mSv unprotected (85 % saved)".

## Which Sun do you face?
| Choice | What happens |
|---|---|
| Today's Sun | Random flare timing, named after real flares; live DONKI activity changes how often they hit |
| Sept 2017 / May 2024 / Halloween 2003 | The strongest real flares of that storm replay in their real order (Cadet: 2, Commander: 3; Cadet caps them at moderate) |
| Dust storm 2018 (Mars) | No flares. One big storm cuts sunlight about 95 % for 48 h: stretch the battery |
| Surprise me | Random events, no real flare names |

## What every action trades
See the table in the README. Hidden couplings worth knowing: a worn-out crew (low morale) repairs and researches slower; eco life support recycles less oxygen; low sun at the end of a Moon mission (the mission starts in lunar afternoon) tightens power late.

## Stars (skill, not just survival)
1 survive, +1 research goal (40 % of the mission research, from rover trips in daylight), +1 well-run base (battery at least 20 %, habitat at least 70 %, morale at least 60 %, dose at most 30 % of the limit). A player who does nothing averages about 1 star on Cadet and starves on Commander.

## Other mechanics and the real fact behind each
| Mechanic | Real fact |
|---|---|
| Heater load rises as temperature falls | InSight recorded down to about -97 C on its sols |
| Night = zero solar power | Mars sol is 24 h 39 m; batteries carry the base |
| Dust storm cuts sunlight by exp(-tau) | The 2018 global storm cut sunlight to the Opportunity rover until it fell silent |
| Radio delay shown (today's value from JPL orbits) | Moon 1.3 s, Mars 3 to 22 min one way |
| Morale and radiation both matter | OSDR OSD-618/640: radiation and living conditions affect the body differently |
| Dose compared in "days on Mars" | Curiosity RAD 0.64 mSv/day |

## Replayability
Seeds replay identical events. Different seeds pick different flares, dust storms and meteorites. Six Sun choices x two worlds x two difficulties. "Copy replay log" in the Mission tab reproduces a run exactly.

## Plain-language rule
Science words (sol, mSv, tau) are explained in the card or tab where they appear.

## Known limits
- The radio delay teaches why nobody can help in real time and drives the no-warning flares, but there is no "ask Mission Control" action yet.
- Cadet is very forgiving (an idle crew usually survives, most of all on the Moon); the stars still reward real play. See [BALANCE.md](BALANCE.md).
