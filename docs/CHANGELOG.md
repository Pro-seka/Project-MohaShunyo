# What this final version is

Merged from two submitted builds, "Sol72" (A) and "Sol72-NASA-Space-Apps" (B), after reading and running both.

**Base: B** (readable engine, seeded determinism, engine tests, honest LIVE/ARCHIVE labelling, science cards).

**Taken from A:** the "Which Sun do you face?" choice (2017, 2024, 2003 storms, 2018 dust storm), the JPL-based Earth-Mars radio delay (`orbits.js`), the no-warning far-side flares (Commander), and the pitch/video/checklist/how-to-play documents (rewritten to match the final game).

**New or fixed in this version**
- Balance: an idle crew no longer wins Cadet with 2 stars; Commander starves an idle crew; every action has a measured cost (see BALANCE.md).
- New mechanics: Grow food (greenhouse), research from rover trips, shelter blocks outside work, crew efficiency, guaranteed flare per mission, scripted real storms, no-warning flares.
- Stars reward skill (research goal and a well-run base), not just survival.
- Coach tip and a three-bars-first welcome so young players are not overloaded.
- Data fixes: the 2003 flare is now "X28+" (the detectors saturated at X28) instead of an unofficial "X40+"; the X4.2 flare of 4 Feb 2026 now names AR 4366; the data file's honesty text points at `js/nasa.js`; the dose limit text matches the game.
- Moon text corrected (the old menu promised "long nights" that never happened); the Moon mission now starts in lunar afternoon so power tightens late.
- Menu: the Launch button is always visible (sticky); the scenario row fits.
- Project cleanup: team pipeline moved to `tools/` (with a note that its sample caches are synthetic), documents rewritten, tests rewritten and extended.

**Submission pass:** Mars sunlight corrected to NASA's Mars Fact Sheet value (586.2 W/m2, was 585.9); the sunlight and Moon temperature constants now live in `js/data/nasa-data.js` (`constants`, each with its NASA source link); the in-game NASA tab lists all 16 data sources in the same order as the submission form.
