# UI – Outpost Ares

## Run locally
No build step. Chrome and Edge block ES modules on `file://`, so serve the folder:
`cd ui && python -m http.server 8000`, then open `http://localhost:8000/?demo=1`.
Firefox can open `index.html` directly. Click **Next demo state** to cycle calm → dust storm → radiation warning.

## Test both modes
Use the **Mode** button (or `GameUI.setPerformanceMode('performance')` in the console).
Cinematic: 90 stars in 3 parallax layers, morphing nebula, 2 orbiting satellites.
Performance: 16 static stars, no blur, no morph, no satellites, instant value changes.
Turn on OS "reduce motion" to force the Performance behaviour and disable CSS animation.

## Style guide (CSS variables in `main.css`)
- Colors: `--c-bg` deep indigo, `--c-panel` glass, `--c-text`, `--c-muted`, `--c-accent` warm amber (interactive only), `--c-ok/warn/crit`.
- Spacing: `--s-1` .25rem, `--s-2` .5rem, `--s-3` 1rem, `--s-4` 1.5rem, `--s-5` 2.5rem.
- Type: `--t-sm` .875rem, `--t-md` 1rem, `--t-lg` 1.375rem, `--t-xl` 2rem, `--t-hero` fluid up to 5.5rem.
- High contrast overrides the same variables via `html[data-contrast="high"]`.

## Class naming
BEM: `block__element--modifier` (`panel__title`, `event--critical`, `btn--primary`).
Animation helpers: `.anim-<purpose>` in `animations.css` (`.anim-alert-pulse`, `.anim-panel-enter`, `.anim-press`).
JS hooks use `data-stat` and `data-value`, never classes.

## `game:action` events (dispatched on `document`)
`detail` is `{ type, target }`: `repair`, `upgrade`, `research`, `allocate` (targets: `lifeSupport`, `power`, `food`, `shield`) and `{ type: "endTurn" }`.

## anime.js
v4.x via `https://cdn.jsdelivr.net/npm/animejs@4/+esm` (`animate`, `createTimeline`, `stagger`, `svg.morphTo`). Pin an exact 4.x version before release.

## Design rationale
- One signature moment: the aurora nebula morphs slowly (16 s) so the page feels alive without demanding attention.
- Three star layers move at different parallax depths to give Mars-orbit depth cheaply.
- Two satellites on opposite, very slow orbits add scale; the warm amber dot is the only bright moving thing.
- The intro is a single timeline (title, subtitle, button) so the entrance reads as one beat.
- Meter changes tween for 700 ms so players see what changed; critical events pulse the events panel.
- Performance mode and reduced motion drop morphing, parallax, blur and satellites first, since they cost the most.
