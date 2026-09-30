# Mars Outpost: Narrative Bible

File: `/game/design/narrative.md` · Tone: teen-friendly, a bit of humour, always explains *why*. No gore, no blame. Failure is "a lesson from Mission Control", never a punishment.

The in-game strings that the engine prints live in `game-logic.js` (tables `NARR`, `FACTS`, `BREAKTHROUGH`, `FAULTS`, `ALERT_TEXT`, `ENV_FLAGS`, `TURN_FLAVOR`, `END_TEXT`). This file is the story around them, plus the briefings the UI can show between levels.

## 1. The premise

It is the near future. Earth's space agencies have sent a four-person crew to **Outpost Ares Nova**, a small habitat on the rim of an ancient Martian lake bed. A relief ship is on its way, but it takes a while. Your job as **Outpost Director** is to keep everyone alive until it arrives.

You cannot fly, fight or build anything fancy. You have **action points**, a **battery**, and a habitat that reacts to Mars's real weather (the game uses data from NASA's Perseverance rover weather station and Mars orbiters).

## 2. Mission briefing (opening screen)

> **MISSION CONTROL, ORBITAL RELAY 7**
> *Director, welcome to Ares Nova. You have four crew, one battery, and a lot of red dust.*
> *Mars has almost no air and no magnetic field. It is cold, dusty, and the Sun's particles hit the ground. Your outpost has five systems that all depend on each other: **Power, Life Support, Radiation Shield, Greenhouse**, and the **Weather** you cannot control.*
> *Every day and every night you get a few action points. Use them to repair, upgrade, research or re-route power. Then end the turn and see what Mars does.*
> *The relief ship is coming. Keep them alive. Good luck.*

## 3. The crew (fictional NPCs the UI can quote)

| Name | Role | Voice | Speaks about |
|---|---|---|---|
| **Cmdr. Zara Quinn** | Commander | calm, dry humour | overall mood, end-of-level summaries |
| **Kofi Mensah** | Power engineer | practical, loves gadgets | panels, battery, dust, upgrades |
| **Dr. Mira Chen** | Botanist | cheerful, talks to the plants | Greenhouse, food, growth |
| **Dr. Anika Rahman** | Flight surgeon and radiation lead | steady, precise | shield, dose, air quality |
| **HABI** | habitat assistant AI | literal, a bit too honest | alerts, "did you know?" facts |

### Example lines (trigger to line)

| Trigger | Speaker | Line |
|---|---|---|
| Battery alert (warning) | Kofi | "Battery's under a quarter. Either the panels are dusty, or we ran the lab too hard. Probably both." |
| Dust storm begins | HABI | "Dust opacity is rising. Sunlight reaching panels: falling. I recommend saving power now, not later." |
| Food alert | Mira | "The lettuce is judging me, and it has a point. We are eating faster than it grows." |
| Shield alert | Anika | "Every bit of dose stays with us. Please fix the shield before it gets worse." |
| Solar particle event | HABI | "Solar particle event detected. Mars has no magnetic field to help. Shield wear is tripled for this phase." |
| Habitat leak | Kofi | "Seal on hatch two flexed in the pressure swing. We lost some air. Patch it before the next one." |
| Cascade failure | Zara | "One weak system just dragged another down. Fix the weakest link first, then work outward." |
| Breakthrough | Mira / Kofi | "We just learned something that will help every single sol." |
| Partial success | Zara | "Not perfect, but we are still here. Watch the gauges." |
| Setback | Zara | "That was rough. Breathe. What is the single biggest problem right now?" |

## 4. How each turn reads (branching outcomes)

Every action resolves as **success**, **partial success** or **failure**. Two variants each are in the engine; the picture below shows the shape.

| Action | Success | Partial | Failure |
|---|---|---|---|
| Repair | "Careful hands and a fresh seal: the {system} is back in great shape." | "Dust in the tools slows the job. The {system} is partly repaired." | "The spare part does not fit. The repair fails, so time to rethink." |
| Upgrade | "The new {system} module clicks into place. A long-term win!" | "The upgrade works, but it needs tuning. Installed with teething problems." | "The prototype does not fit. Parts and power are used up and nothing changes." |
| Research | "Experiment complete: clean data! You learned something real about the {system}." + fun fact | "Interesting, but the data is noisy. You will need one more run to be sure." | "A sensor glitches and the samples are ruined. Science is like that sometimes." |

After the last action the turn gets its own summary (a quiet, bumpy or scary day/night) plus the net changes ("Battery -12, air +3, food -1, shield 0").

### Real-world fun facts (shown on research success)

- **Power:** Mars rovers have been kept alive by wind gusts that blow dust off their panels.
- **Life Support:** real habitats recycle water and CO2 because every kilogram sent to Mars is very expensive.
- **Shield:** Mars has almost no magnetic field, so soil (regolith) piled on a roof is a real shielding idea.
- **Greenhouse:** plants can grow without soil in nutrient water (hydroponics), which is how space greenhouses work.

## 5. "Why?" explainers (education built into the events)

| Event | The one-sentence science |
|---|---|
| Dust storm | Dust in the air blocks sunlight, so panels make less power and plants get less light. |
| Strong winds | Wind lifts dust and drops it on the panels, so clean them or lose output. |
| Deep freeze | Heaters work harder in the cold, so the battery drains faster and the crew needs more life support. |
| Radiation spike / solar particle event | Mars has almost no magnetic field, so charged particles reach the ground and wear the shield faster. |
| Pressure dip / leak | Habitat seals flex when outside pressure changes, so old seals can leak. |
| Cascade failure | Systems depend on each other, so a weak one drags its neighbour down. |

## 6. Level stories

### Level 1: First Sol (tutorial)
> *"Sol 1. Clear skies, easy weather, and a crew that has been told you are new. Nothing will break yet. Use this time to find out what each button does. Notice how much power the panels make, how quickly the plants grow, and what happens when you do nothing at all."*
- **Goal:** survive 20 sols with air, food, power and shield above the minimums.
- **Thriving means:** healthy stocks *and* at least two upgrades.
- **Lesson:** doing nothing barely works, so investment pays.
- **Win text:** "The relief ship's lights appear in the sky. You did it, Director!"

### Level 2: Storm Season
> *"Orbital relay is showing a dust front building over the crater. Sol 8 to 14 look ugly. Equipment that has been fine for months is starting to complain."*
- **Goal:** 30 sols through dust storms, random equipment faults and the odd solar flare.
- **Lesson:** save battery *before* the storm, clean the panels, and do not let one system rot.
- **Mid-level beat (sol 8):** Kofi: "Panels are going orange. Storm is close. Top the battery off, Director."
- **Win text:** "You read the sky and you planned ahead. That is what Mars rewards."

### Level 3: The Long Haul
> *"The relief ship is delayed. Forty sols. The equipment is ageing and the weather is not getting kinder. Every weak system makes its neighbours weaker. You cannot just patch things forever."*
- **Goal:** 40 sols with cascading risks and wear that grows every sol.
- **Lesson:** long-term thinking. Patching holds the line, but only upgrades and research let you get ahead.
- **Mid-level beat (sol 20):** Anika: "Radiation is climbing. If the shield slips now, we will feel it at the very end."
- **Win text:** "Forty sols. Four crew. Zero excuses. You are the reason they are going home."

## 7. Endings

| Ending | Trigger | Title | Text |
|---|---|---|---|
| Thriving | success, full tier | Mission complete: thriving! | "The relief ship is in sight and your outpost is healthy. You planned, repaired and invested wisely. Legend status." |
| Limping home | success, partial tier | Mission complete: limping home | "You survived, but the outpost is worn out. It is a real win, and there is room to do even better next time." |
| Out of air | oxygen 0 | Mission failed: out of air | "Oxygen ran out. Scrubbers need power and repairs, and dust storms cut the power they run on." |
| Radiation | dose 100 | Mission failed: radiation | "The crew absorbed too much radiation. Shield integrity is the only thing between them and space weather." |
| Starvation | food 0 for 3 phases | Mission failed: starvation | "The food ran out and stayed out. Greenhouses need light, power and healthy pumps." |
| Blackout | battery 0 for 3 phases | Mission failed: blackout | "The battery stayed empty. No power means no heat, no air scrubbing, no lights." |
| Goals missed | last sol reached, minimums not met | Mission failed: goals missed | "The crew is alive, but the outpost fell short of the mission minimums. Check the level goals and try a different mix." |

**Debrief tip for the UI:** after a failure show the `reason` and one suggestion from the tradeoffs section (`design-spec.md`, section 12), for example "Blackout: try conserve mode (allocate Power) before a storm, and clean your panels."

## 8. Tone rules

1. Explain *why* in one sentence, without jargon. "Opacity" is fine because the UI shows a dust bar.
2. Numbers are honest: show what changed ("Battery -12").
3. Humour is about Mars and the crew's quirks, never about the player's mistakes.
4. Danger is real but never gruesome. Failure means "the mission is scrubbed", and the text focuses on the lesson.
5. Facts must be true at the level of a school textbook. Anything we simplified is flagged in `balancing-report.md`.
