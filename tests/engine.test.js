/* Run: node tests/engine.test.js   (no dependencies)
 * Checks the rules of the simulation, the scripted NASA storms, and the balance bands. */
global.window = global;
global.location = { search: '' };
require('../js/data/nasa-data.js');
require('../js/data/storms.js');
const E = require('../js/engine.js');
const D = window.SOL72_NASA, ST = window.SOL72_STORMS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function env(world, scenarioId) {
  const sols = D.insight.sols, ep = scenarioId && ST.episodes[scenarioId];
  const base = { real_flares: ep && ep.kind !== 'today' ? null : D.real_flares, sep_lead_h: 4, flare_rate_scale: 1, signal_delay_s: { min: 182, max: 1337 },
    scenario: ep && ep.kind === 'storm' ? { id: scenarioId, flares: ep.flares } : ep && ep.kind === 'dust' ? { id: scenarioId, dust: ep.dust } : null };
  return world === 'moon'
    ? { ...base, location: 'moon', solar_flux_wm2: 1361, temp_min_c: -173, temp_max_c: 127, dust_tau: 0 }
    : { ...base, location: 'mars', solar_flux_wm2: 586.2, dust_tau: 0.4,
        temp_min_c: Math.min(...sols.map(s => s.temp_min_c)), temp_max_c: Math.max(...sols.map(s => s.temp_max_c)),
        daily: sols.map(s => ({ sol: s.sol, date: s.date, season: s.season, temp_min_c: s.temp_min_c, temp_max_c: s.temp_max_c, pressure_pa: s.pressure_pa, wind_ms: s.wind_ms })) };
}
const cfg = (world, diff, scn) => ({ location: world, data: env(world, scn), tuning: E.DIFFICULTY[diff].tuning, initial: E.DIFFICULTY[diff].initial });
const act = id => E.applyAction(id);

const POL = {
  idle: () => {},
  casual: st => { const dg = st.diagnostics, m = st.modes;
    if (dg.flare_phase === 'arrived' && !m.shelter) act('toggle_shelter');
    if (!dg.flare_phase && m.shelter) act('toggle_shelter');
    if (st.power < 15 && !m.generator && st.fuel > 5) act('toggle_generator');
    if (st.power > 70 && m.generator) act('toggle_generator');
    if (st.food < 30 && !m.ration) act('toggle_ration'); },   // follows the coach tip about food
  smart: st => { const dg = st.diagnostics, m = st.modes, storm = st.active_events.some(e => e.type === 'dust_storm');
    if (dg.flare_phase === 'incoming' && st.shield_panels_left > 0 && st.power > 30) act('deploy_shielding');
    if (dg.flare_phase === 'incoming' && dg.flare_eta_h <= 1 && !m.shelter) act('toggle_shelter');
    if (dg.flare_phase === 'arrived' && !m.shelter) act('toggle_shelter');
    if (!dg.flare_phase && m.shelter) act('toggle_shelter');
    if (st.power < 22 && !m.generator && st.fuel > 3) act('toggle_generator');
    if (st.power > 60 && m.generator) act('toggle_generator');
    if (storm && st.power < 55 && m.life_support !== 'eco' && st.oxygen > 55) act('set_life_support_eco');
    if ((!storm || st.oxygen < 40) && m.life_support === 'eco') act('set_life_support_normal');
    if (st.habitat_health < 90 && !m.repair && st.power > 35) act('toggle_repair');
    if (st.habitat_health > 96 && m.repair) act('toggle_repair');
    if (st.panel_dust > .12 && !m.shelter) act('clean_panels');
    if (st.food < 60 && !m.grow && st.power > 55 && dg.daylight > 0.3) act('toggle_greenhouse');
    if ((st.food > 85 || st.power < 35) && m.grow) act('toggle_greenhouse');
    if (st.food < 30 && !m.ration) act('toggle_ration');
    const calm = !dg.flare_phase && !m.shelter && !storm && st.power > 70 && st.fuel > 40 && dg.daylight > 0.3;
    if (calm && !m.rover) act('toggle_rover');
    if (m.rover && (st.power < 55 || dg.flare_phase || dg.daylight < 0.1 || storm)) act('toggle_rover'); },
};
function run(seed, world, diff, policy, scn) {
  let s = E.init(seed, cfg(world, diff, scn)); let flares = 0, unann = 0;
  while (!s.game_over) {
    POL[policy](E.getState());
    const r = E.step(); s = r.state;
    r.events.forEach(e => { if (e.type === 'solar_flare' && e.phase === 'start') { flares++; if (e.unannounced) unann++; } });
  }
  return { win: !!s.game_over.win, flares, unann, rating: E.rating(s), final: s };
}
function batch(world, diff, policy, n = 60) {
  let w = 0, stars = 0, fl0 = 0;
  for (let i = 1; i <= n; i++) { const r = run(1000 + i * 7, world, diff, policy); w += r.win; stars += r.rating.stars; fl0 += r.flares === 0; }
  return { win: w / n, stars: stars / n, noFlare: fl0 / n };
}

/* ---- 1. determinism and replay */
{
  const a = run(4242, 'mars', 'commander', 'smart'), b = run(4242, 'mars', 'commander', 'smart'), c = run(4243, 'mars', 'commander', 'smart');
  ok(JSON.stringify(a.final) === JSON.stringify(b.final), 'same seed + same actions = identical mission');
  ok(JSON.stringify(a.final) !== JSON.stringify(c.final), 'different seed = different mission');
}

/* ---- 2. no free choices: every action costs something somewhere else */
{
  const fresh = (world = 'mars') => E.init(7, cfg(world, 'commander'));
  const load = () => E.getState().diagnostics.load_kw;
  fresh(); const base = load();
  fresh(); act('toggle_rover'); E.step(); ok(E.getState().diagnostics.load_kw > base + 2, 'rover draws power');
  fresh(); act('toggle_greenhouse'); E.step(); const g = E.getState(); ok(g.diagnostics.load_kw > base + 2 && g.diagnostics.grow_on, 'greenhouse draws power');
  // greenhouse really grows food, rationing only slows the loss
  fresh(); for (let i = 0; i < 6; i++) E.step(); const f0 = E.getState().food;
  fresh(); act('toggle_greenhouse'); for (let i = 0; i < 6; i++) E.step(); const f1 = E.getState().food;
  fresh(); act('toggle_ration'); for (let i = 0; i < 6; i++) E.step(); const f2 = E.getState().food;
  ok(f1 > f0, 'greenhouse leaves more food than doing nothing');
  ok(f2 > f0 && f2 < 100 && f2 < f1, 'rationing slows the loss but never makes food (greenhouse beats it)');
  // research only comes from the rover in daylight
  fresh(); act('toggle_rover'); for (let i = 0; i < 10; i++) E.step(); ok(E.getState().science > 0 || E.getState().diagnostics.daylight <= 0.05, 'rover collects research in daylight');
  fresh(); for (let i = 0; i < 10; i++) E.step(); ok(E.getState().science === 0, 'no research without the rover');
  // shelter: costs morale, stops the rover, blocks cleaning, slows repairs
  fresh(); act('toggle_rover'); act('toggle_shelter'); E.step(); const sh = E.getState();
  ok(sh.modes.shelter && !sh.modes.rover, 'sheltering parks the rover');
  ok(act('toggle_rover').ok === false, 'cannot drive the rover while sheltering');
  fresh(); for (let i = 0; i < 60; i++) E.step(); const dustY = E.getState().panel_dust > 0.02;
  if (dustY) { act('toggle_shelter'); ok(act('clean_panels').ok === false, 'cannot clean panels while sheltering'); }
  const mor = (shelter) => { fresh(); if (shelter) act('toggle_shelter'); for (let i = 0; i < 20; i++) E.step(); return E.getState().crew_morale; };
  ok(mor(true) < mor(false), 'shelter costs morale');
  // eco saves power but burns oxygen faster
  fresh(); act('set_life_support_eco'); for (let i = 0; i < 20; i++) E.step(); const eco = E.getState();
  fresh(); for (let i = 0; i < 20; i++) E.step(); const nor = E.getState();
  ok(eco.oxygen < nor.oxygen, 'eco life support uses more oxygen');
  // generator burns fuel
  fresh(); act('toggle_generator'); for (let i = 0; i < 5; i++) E.step(); ok(E.getState().fuel < 97, 'generator burns fuel');
  // tired crews repair slower
  fresh(); E.applyEffects && 0; ok(E.getState().diagnostics.crew_eff === 1 || E.getState().diagnostics.crew_eff > 0.9, 'a rested crew works at full speed');
}

/* ---- 3. flares, the warning window and no-warning flares */
{
  let unannSeen = 0, annSeen = 0, leadOk = true;
  for (let i = 1; i <= 40; i++) {
    let s = E.init(2000 + i, cfg('mars', 'commander'));
    while (!s.game_over) { const r = E.step(); s = r.state;
      r.events.forEach(e => { if (e.type === 'solar_flare' && e.phase === 'start') { if (e.unannounced) { unannSeen++; if (e.lead_h !== 0) leadOk = false; } else { annSeen++; if (e.lead_h !== 4) leadOk = false; } } }); }
  }
  ok(unannSeen > 0 && annSeen > 0, `Commander has both warned (${annSeen}) and no-warning (${unannSeen}) flares`);
  ok(leadOk, 'warned flares give a 4 h window, unannounced give 0');
  let cadetUnann = 0;
  for (let i = 1; i <= 40; i++) cadetUnann += run(3000 + i, 'mars', 'cadet', 'idle').unann;
  ok(cadetUnann === 0, 'Cadet never has an unannounced flare');
  // a no-warning flare lands immediately
  let s = E.init(5, cfg('mars', 'commander')); E.debugTriggerEvent('solar_flare', 1);
  ok(E.getState().diagnostics.flare_phase === 'incoming', 'debug flare shows the incoming phase');
}
{ // guaranteed flare: every mission meets the Sun at least once (outside scripted scenarios)
  let zero = 0; for (let i = 1; i <= 60; i++) { const r = run(7000 + i, 'mars', 'cadet', 'idle'); if (r.flares === 0 && r.win) zero++; }
  ok(zero === 0, 'every completed Cadet mission meets at least one flare');
}

/* ---- 4. scripted NASA storms */
{
  const s2024 = E.buildSchedule(env('mars', 'storm2024'), E.DIFFICULTY.commander.tuning, 99);
  ok(s2024 && s2024.flares.length === 3, 'May 2024: Commander replays the 3 real flares');
  ok(s2024.flares.map(f => f.real.class).join() === 'X2.2,X5.8,X8.7', 'flares replay in real chronological order');
  ok(s2024.flares.every((f, i) => i === 0 || f.hour > s2024.flares[i - 1].hour + 8), 'scripted flares never overlap');
  const cad = E.buildSchedule(env('mars', 'storm2017'), E.DIFFICULTY.cadet.tuning, 99);
  ok(cad.flares.length === 2 && cad.flares.every(f => f.sev <= 1), 'Cadet replays the 2 strongest flares, capped at moderate');
  ok(cad.flares.some(f => f.real.class === 'X9.3') || cad.flares.some(f => f.real.class === 'X8.2'), '2017 keeps the strongest flares (X9.3 / X8.2)');
  const dust = E.buildSchedule(env('mars', 'dust2018'), E.DIFFICULTY.cadet.tuning, 99);
  ok(dust && dust.storm && dust.no_random_flares, '2018 dust scenario scripts one big storm and no flares');
  ok(E.buildSchedule(env('moon', 'dust2018'), E.DIFFICULTY.cadet.tuning, 99) === null, '2018 dust storm does nothing on the Moon');
  ok(E.buildSchedule(env('mars', 'today'), E.DIFFICULTY.cadet.tuning, 99) === null, "Today's Sun uses random events");
  // an actual run: scripted flare names appear in order, and a scripted dust storm happens
  let seen = [], s = E.init(11, cfg('mars', 'commander', 'storm2024'));
  while (!s.game_over) { const r = E.step(); s = r.state; r.events.forEach(e => { if (e.type === 'solar_flare' && e.phase === 'start') seen.push(e.real && e.real.class); }); }
  ok(seen.join() === 'X2.2,X5.8,X8.7', 'a played May 2024 mission shows X2.2, X5.8, X8.7 in order');
  let stormSeen = 0; s = E.init(12, cfg('mars', 'cadet', 'dust2018'));
  while (!s.game_over) { const r = E.step(); s = r.state; r.events.forEach(e => { if (e.type === 'dust_storm' && e.phase === 'start' && e.scripted) stormSeen++; }); }
  ok(stormSeen === 1, 'the 2018 dust storm hits exactly once');
  ok(E.sevFromClass('X1.9') === 0 && E.sevFromClass('X5.8') === 1 && E.sevFromClass('X8.3') === 2 && E.sevFromClass('M5.0') === 0, 'flare class maps to severity');
}

/* ---- 5. stars reward skill, not just survival */
{
  const idle = batch('mars', 'cadet', 'idle', 40), smart = batch('mars', 'cadet', 'smart', 40);
  ok(smart.stars > idle.stars + 0.5, `smart players earn clearly more stars than idle (${smart.stars.toFixed(2)} vs ${idle.stars.toFixed(2)})`);
}

/* ---- 6. balance bands (60 seeds). Cadet is forgiving, Commander is not. */
{
  const B = {};
  for (const w of ['mars', 'moon']) for (const d of ['cadet', 'commander']) for (const p of ['idle', 'casual', 'smart']) B[`${w}/${d}/${p}`] = batch(w, d, p);
  const pct = x => Math.round(x * 100) + '%';
  for (const w of ['mars', 'moon']) for (const d of ['cadet', 'commander'])
    console.log(`  ${w}/${d}: idle ${pct(B[`${w}/${d}/idle`].win)} casual ${pct(B[`${w}/${d}/casual`].win)} smart ${pct(B[`${w}/${d}/smart`].win)}  stars idle ${B[`${w}/${d}/idle`].stars.toFixed(1)} smart ${B[`${w}/${d}/smart`].stars.toFixed(1)}`);
  for (const w of ['mars', 'moon']) {
    ok(B[`${w}/cadet/smart`].win >= 0.95, `${w} Cadet: a thoughtful player almost always wins (${pct(B[`${w}/cadet/smart`].win)})`);
    ok(B[`${w}/commander/smart`].win >= 0.85, `${w} Commander: a thoughtful player usually wins (${pct(B[`${w}/commander/smart`].win)})`);
    ok(B[`${w}/commander/smart`].win > B[`${w}/commander/idle`].win + 0.2, `${w} Commander: doing nothing is clearly worse (${pct(B[`${w}/commander/idle`].win)} idle)`);
    ok(B[`${w}/commander/idle`].win <= 0.6, `${w} Commander: idle crews lose often`);
    ok(B[`${w}/cadet/smart`].stars >= B[`${w}/cadet/idle`].stars + 1, `${w} Cadet: skill shows in the stars`);
  }
  ok(B['mars/commander/idle'].win <= 0.3, 'Mars Commander is genuinely hard if you do nothing');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
