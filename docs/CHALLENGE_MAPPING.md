# How Sol 72 meets the NASA Space Apps 2026 challenge

Challenge: *design and build an interactive game or app that lets kids ages 7 to 12 manage a lunar or Martian outpost, making real decisions about life support, radiation shielding, power budgeting, food production and communication delay, and experiencing how those choices play out over a simulated mission.*

| Challenge requirement | Where Sol 72 delivers it |
|---|---|
| Lunar or Martian outpost | Mars and Moon bases, 72 h (Cadet) or 96 h (Commander) |
| Life support | Normal vs eco life support (power vs oxygen and morale), habitat leaks, repair crew |
| Radiation shielding | 4 shielding panels (battery cost), crew shelter (morale and work cost), real flare warning window |
| Power budgeting | Solar array, battery, night, dust, generator; 9 actions that all draw or spend power or fuel |
| Food production | Greenhouse (Grow food, uses power, best in daylight) vs rationing (morale cost, makes no food) |
| Communication delay | Shown as today's real Earth-Mars delay (JPL orbits); explains why crews decide alone; no-warning far-side flares in Commander. *There is no "ask Mission Control" action yet.* |
| "A choice that saves power today might cost oxygen tomorrow" | Eco life support: saves 2 kW, burns oxygen faster |
| "Trade oxygen for an extra research opportunity" | Rover research costs power and fuel, and is impossible while sheltering; stars reward it |
| No "safe" choice without cost | Every action has a cost; tests prove no single action beats a thoughtful player |
| Avoid overwhelming young players | Coach tip names the one thing to fix; welcome card says watch Power, Oxygen, Radiation first |
| Real NASA open data | DONKI flares and storms, InSight weather, JPL orbits, POWER, Curiosity RAD, Artemis, OSDR, NASA Image Library |
| Attribute data in the tool | NASA tab with sources and LIVE/ARCHIVE badges; end-screen "What NASA data taught you" |
| Don't present static data as live | ARCHIVE vs LIVE badges; archive values stored with provenance |
| Link a shielding decision to current space weather | "Today's Sun" uses live DONKI activity when reachable; end screen shows dose saved per real flare |
| Replayability | Seeds, 6 Suns x 2 worlds x 2 difficulties, replay log, learning from failure without a punishing restart |
| Low barrier to entry | Open `index.html`: no install, no account |
| Short explanation of datasets | `docs/NASA_DATA.md` |
| Plain language, jargon explained in context | Science cards explain sol, mSv, tau, DONKI once, when first needed |

## Honest gaps
- OSDR is used for science cards only; no OSDR raw data feeds the simulation.
- Communication delay is educational and drives no-warning flares, but is not a separate decision.
- The original three.js scene file (`js/game.js`) is formatted build output; the engine, data and teaching layers are readable source.
