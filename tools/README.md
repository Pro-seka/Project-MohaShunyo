# tools/ : the team's original data pipeline (optional, not needed to play)

The game runs entirely from `js/data/nasa-data.js` (archived NASA snapshot with provenance), `js/data/storms.js` (famous storms) and `js/orbits.js`. Nothing in this folder is loaded by the game.

| Folder | What it is | Status |
|---|---|---|
| `nasa-data-layer/` | Node proxy + cache for NASA POWER, InSight and the Image Library, plus snapshot scripts | Used once to fetch the InSight/POWER snapshots now stored in `js/data/nasa-data.js`. `OUTPOST_DIR` defaults to this `tools/` folder. |
| `data/` | Earlier pipeline for MEDA/MCS-style Mars data with its own self-tests | **Its sample caches (`data/cache/*-sample.json`) are SYNTHETIC placeholders. They are not NASA measurements and the game does not use them.** Run its checks with `cd tools && node data/test_ingest.js`. |

`nasa-data-layer/scripts/buildDataJs.js` writes `tools/scripts/data.js`: an old output format. `js/data/nasa-data.js` is now curated by hand (every value has a source and an ARCHIVE/LIVE status in the file), so do not expect the script to regenerate it.
