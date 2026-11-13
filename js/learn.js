/*  Sol 72: learning layer
 *  ------------------------------------------------------------------
 *  Turns what happens in the simulation into "why" moments that point at the real NASA data:
 *    - science cards   (pause once, first time something happens)
 *    - HUD warning     (flare countdown)
 *    - NASA tab rows   (real sol, pressure, wind, solar comparison, radiation ruler, sources)
 *    - end recap       (what your choices cost or saved, in real units)
 *  It only READS state; it never changes the simulation.
 */
(function () {
  'use strict';
  const N = window.Sol72Data, D = N.data;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
  const badge = mode => `<span class="bdg ${mode === 'live' ? 'live' : 'arc'}">${mode === 'live' ? 'LIVE' : 'ARCHIVE'}</span>`;
  const rad = id => D.radiation.rows.find(r => r.id === id);
  const fmt = (n, d = 1) => Number(n).toFixed(d);

  let ctx = null, shown = {}, reports = [], track = null;

  function reset(c) {
    ctx = c; shown = {}; reports = [];
    track = { shelterHours: 0, minMorale: 100, hours: 0, sawNight: false, cards: 0 };
  }

  const delayText = () => {
    const c = D.comms;
    if (ctx && ctx.loc === 'moon') return `${fmt(c.moon_one_way_s, 1)} seconds`;
    const now = N.marsDelayNowS && N.marsDelayNowS();
    const range = `${Math.round(c.mars_one_way_min_s / 60)} to ${Math.round(c.mars_one_way_max_s / 60)} minutes`;
    return now ? `about ${Math.round(now / 60)} minutes right now (${range} over the years)` : range;
  };
  let preview = null;   // the Sun chosen in the menu, before a mission starts
  const episodeInfo = () => (ctx && ctx.episode) || preview;

  /* ---------------------------------------------------------------- cards */
  function card(id, icon, title, html, src) {
    if (!ctx || !ctx.cards || shown[id] || track.cards >= 8) return null;
    shown[id] = 1; track.cards++;
    return { id, icon, title, html, src };
  }

  function welcome(state) {
    const w = ctx.loc === 'moon' ? 'the Moon' : 'Mars';
    const wx = ctx.loc === 'moon'
      ? 'NASA temperature and sunlight numbers for the Moon'
      : 'real weather from NASA\u2019s InSight lander, one real Martian day per day of your mission';
    return card('welcome', '\u{1F680}', 'Welcome to Sol 72, Commander',
      `<p>Keep 4 astronauts alive on ${w} for <b>${state.mission_hours} hours</b>. Every fix costs something somewhere else.</p>
       <p>This is built on real NASA data: ${wx}, <b>real solar flares</b> from NASA\u2019s space-weather database (DONKI) and real radiation measurements.</p>
       ${episodeInfo() && episodeInfo().blurb ? `<p><b>${esc(episodeInfo().title)}:</b> ${esc(episodeInfo().blurb)}</p>` : ''}
       <p>A radio message to Earth takes <b>${delayText()}</b> one way, so nobody can fix things for you in time.</p>
       <p><b>Start by watching three bars:</b> \u26A1 Power, \u{1FAC1} Oxygen and \u2622\uFE0F Radiation. The coach tip at the top tells you what needs attention.</p>`,
      { t: 'See all data sources in the NASA tab', u: null });
  }

  function onStep(state, events) {
    if (!ctx) return [];
    const out = [];
    const push = c => c && out.push(c);
    const dg = state.diagnostics || {};
    track.hours = state.hour; track.minMorale = Math.min(track.minMorale, state.crew_morale);
    if (state.modes.shelter) track.shelterHours++;

    for (const ev of events || []) {
      if (ev.type === 'solar_flare') {
        if (ev.phase === 'start') {
          reports.push({
            cls: ev.real ? ev.real.class : null, date: ev.real ? ev.real.date : null, sev: ev.severity,
            startHour: ev.hour, lead: ev.lead_h, panels0: state.shield_panels_left, shielding0: state.shielding,
            sheltered: null, arrived: false, unshielded: ev.effects.radiation_msv_unshielded, dose0: null, gained: null,
          });
          const r = ev.real;
          if (ev.unannounced) push(card('flare_nowarning', '\u{1F6A8}', 'No warning!',
            `<p>${r ? `A real <b>${esc(r.class)}</b> flare (${esc(N.fmtDate(r.date))}) is replaying.` : 'A flare just erupted.'} This one burst out on the <b>far side of the Sun</b>, where Earth\u2019s satellites cannot see it, so no alert came first.</p>
             <p>Real crews on the way to Mars could face the same surprise. That is why they live next to a storm shelter and check it often.</p>
             <p><b>Shelter now!</b> The particles are already here.</p>`,
            { t: 'NASA DONKI space-weather database', u: D.donki.home }));
          else push(card('flare_start', '\u2600\uFE0F', r ? `A real ${r.class} solar flare!` : 'A solar flare!',
            `<p>${r ? `The Sun fired ${/^[MX]/i.test(r.class) ? 'an' : 'a'} <b>${esc(r.class)}</b> flare, a real one from <b>${esc(N.fmtDate(r.date))}</b>.` : 'The Sun just fired a flare.'}</p>
             <p>Light from a flare reaches us in minutes, but the dangerous <b>particles</b> arrive later. In NASA\u2019s DONKI database the X1.9 flare of 18 Jan 2026 was followed by particles about <b>${D.donki.sep_example.lead_hours} hours</b> later.</p>
             <p>So you have about <b>${ev.lead_h} game hours</b> to get ready. <b>Shelter</b> keeps the crew safe but makes them grumpy. <b>Shielding</b> costs battery power. What will you pick?</p>`,
            { t: 'NASA DONKI record of that flare', u: D.donki.sep_example.url }));
        } else if (ev.phase === 'arrive') {
          const rep = reports[reports.length - 1];
          if (rep) { rep.arrived = true; rep.sheltered = state.modes.shelter; rep.dose0 = state.radiation_dose; rep.panelsUsed = rep.panels0 - state.shield_panels_left; rep.shielding1 = state.shielding; }
          push(card('flare_arrive', '\u2622\uFE0F', 'The particles are here',
            `<p>${state.modes.shelter ? 'Your crew is already inside the shelter. Nice planning!' : 'Your crew is still outside. Tap the dome to shelter!'}</p>
             <p>On Artemis I, NASA\u2019s sensors found the best-shielded spot in Orion gave about <b>4 times</b> more protection than the least-shielded spot. In the game, shelter cuts the dose to \u00BC.</p>
             <p>But real studies of crews under stress (NASA OSDR) show cramped, worried astronauts suffer too, so leave the shelter when the storm ends.</p>`,
            { t: 'Artemis I radiation results', u: D.artemis[0].url }));
        } else if (ev.phase === 'end') {
          const rep = reports[reports.length - 1];
          if (rep && rep.arrived && rep.gained == null) rep.gained = Math.max(0, state.radiation_dose - rep.dose0);
        }
      } else if (ev.type === 'dust_storm' && ev.phase === 'start') {
        push(card('dust', '\u{1F32A}\uFE0F', ev.scripted ? 'The storm that stopped Opportunity' : 'Dust storm!',
          `<p>Your storm cuts sunlight by about <b>${Math.abs(ev.effects.solar_output_pct)}%</b> for about ${ev.duration} hours.</p>
           <p>${esc(D.dust.fact)}</p>
           <p>Less sun means less power: switch life support to <b>eco</b>, or burn <b>generator</b> fuel.</p>`,
          { t: 'NASA report on the 2018 dust storm', u: D.dust.url }));
      }
    }

    if (!shown.night && ctx.loc === 'mars' && dg.daylight === 0 && state.hour > 1) {
      const row = (ctx.sols || []).find(r => r.sol === dg.real_sol) || D.insight.sols[0];
      track.sawNight = true;
      push(card('night', '\u{1F319}', 'First night on Mars',
        `<p>The Sun has set, so your solar panels make <b>zero power</b>. The battery must carry the whole base.</p>
         <p>NASA\u2019s InSight lander measured <b>${fmt(row.temp_min_c, 0)} \u00B0C</b> at night on its sol ${row.sol}. The colder it gets, the harder the heater works.</p>`,
        { t: 'NASA InSight weather', u: 'https://mars.nasa.gov/insight/weather/' }));
    }
    if (!shown.blackout && dg.blackout) {
      push(card('blackout', '\u26A1', 'Blackout!',
        `<p>The battery is empty and the Sun cannot keep up. Life support and heating shut down, the habitat gets cold and the crew\u2019s spirits crash.</p>
         <p>Restore power fast: turn on the <b>generator</b>, switch to <b>eco</b>, or stop the rover.</p>`, null));
    }
    if (!shown.osdr && state.crew_morale < 50 && state.radiation_dose > 3) {
      const o = D.osdr[0];
      push(card('osdr', '\u{1F9EC}', o.title,
        `<p>${esc(o.fact)}</p><p>That is why your crew has <b>two</b> bars to protect: shielding <i>and</i> morale.</p>`,
        { t: `NASA OSDR ${o.id}`, u: o.url }));
    }
    return out;
  }

  /* ---------------------------------------------------------------- coach: the one thing that needs attention */
  function coach(state) {
    if (!state || state.game_over) return null;
    const dg = state.diagnostics || {}, m = state.modes;
    if (dg.blackout) return { id: 'blackout', text: 'Blackout! Turn on the Generator and park the rover.' };
    if (dg.flare_phase === 'incoming') return { id: 'flare', text: `Flare coming in ${dg.flare_eta_h} h: use Shelter, or spend battery on Shielding.` };
    if (dg.flare_phase === 'arrived' && !m.shelter) return { id: 'flare2', text: 'Particle storm! Send the crew to the Shelter.' };
    if (state.power < 20) return { id: 'power', text: 'Battery low: run the Generator, stop the rover, or try Eco life support.' };
    if (state.oxygen < 35) return { id: 'oxygen', text: 'Oxygen is low: repair leaks with the Repair crew and leave Eco mode.' };
    if (state.habitat_health < 70 && !m.repair) return { id: 'hab', text: 'The habitat is leaking air. Switch on the Repair crew.' };
    if (state.panel_dust > 0.15 && !m.shelter) return { id: 'dust', text: 'Dusty panels make less power: Clean panels.' };
    if (state.food < 30 && !m.ration && !m.grow) return { id: 'food', text: 'Food is getting low: Grow food (uses power) or Ration it.' };
    if (state.crew_morale < 40) return { id: 'morale', text: 'The crew is down: leave the shelter, drive the rover, stop rationing.' };
    if (m.shelter && !dg.flare_phase) return { id: 'leave', text: 'The storm is over. Leave the Shelter so the crew can work again.' };
    if (!m.rover && dg.daylight > 0.3 && state.power > 70 && state.fuel > 30 && state.science < 100)
      return { id: 'science', text: 'Spare power and sunshine: send the Rover to collect research.' };
    return null;
  }

  /* ---------------------------------------------------------------- HUD flare countdown */
  function hud(state) {
    const dg = state && state.diagnostics;
    if (!dg || !dg.flare_phase) return null;
    const f = state.active_events.find(e => e.type === 'solar_flare');
    if (!f) return null;
    const r = f.real ? f.real.class + ' ' : '';
    if (dg.flare_phase === 'incoming') return `\u2600 ${r}flare! Particles in ${dg.flare_eta_h} h: shelter or shield!`;
    return `\u2622 Particle storm: ${f.remaining} h left. ${state.modes.shelter ? 'Sheltering.' : 'Shelter now!'}`;
  }

  /* ---------------------------------------------------------------- panel rows & tab */
  const row = (a, b) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`;

  function systemsRows(state) {
    const dg = state.diagnostics || {};
    let h = '';
    if (dg.real_sol != null) {
      h += row('Real sol (NASA InSight)', `${dg.real_sol} \u00B7 ${esc(N.fmtDate(dg.real_date))}`);
      h += row('Air pressure', `${Math.round(dg.pressure_pa)} Pa (${fmt(dg.pressure_pa / 1013.25, 1)}% of Earth)`);
      h += row('Wind', `${fmt(dg.wind_ms, 1)} m/s average`);
    }
    h += row('Radio to Earth', delayText() + ' one way');
    h += row('Research collected', `${Math.round(state.science)}% (goal for \u2605: ${(ctx && ctx.config && ctx.config.tuning && ctx.config.tuning.science_goal_stars) || 40}%)`);
    if (dg.crew_eff != null && dg.crew_eff < 0.95) h += row('Crew energy', `${Math.round(dg.crew_eff * 100)}% (tired crews work slower)`);
    if (dg.flare_phase) h += row('Flare', dg.flare_phase === 'incoming' ? `particles in ${dg.flare_eta_h} h` : 'particles here');
    return h;
  }

  function missionRows() {
    const e = episodeInfo();
    return (e ? row('The Sun you chose', esc(e.title)) : '') + row('Space weather', `${badge(N.state.donki.mode)} \u00D7${fmt(N.state.donki.mode === 'live' ? N.state.donki.scale : 1, 2)} flare chance`);
  }

  function spaceWeatherLine() {
    const s = N.state.donki;
    const e = episodeInfo();
    if (e && e.kind === 'storm') return `${badge('archive')} Replaying the real flares of the <b>${esc(e.title)}</b> (NASA/NOAA records).`;
    if (e && e.kind === 'dust') return `${badge('archive')} No flares in this mission: the lesson is the <b>2018 Mars dust storm</b>.`;
    if (e && e.kind === 'random') return `Random events: flares are not tied to real dates.`;
    if (s.mode === 'live') {
      const st = s.strongest ? `, strongest ${esc(s.strongest.class)}` : '';
      return `${badge('live')} ${s.m + s.x} strong (M/X) flares in the last ${s.days} days${st}. Flare chance in your mission \u00D7${fmt(s.scale, 2)}.`;
    }
    return `${badge('archive')} Latest real flare in our archive: ${esc(s.latest.class)} on ${esc(N.fmtDate(s.latest.date))}. Strongest of 2026: ${esc(s.strongest.class)} (${esc(N.fmtDate(s.strongest.date))}).`;
  }

  function briefing(world, scnId) {
    if (scnId) preview = N.episode(scnId, world);
    const s = N.state;
    const wx = world === 'moon'
      ? 'Temperatures from NASA\u2019s lunar range (\u2212173 to 127 \u00B0C) and the NASA solar constant.'
      : `${badge('archive')} Real weather from NASA InSight, sols ${D.insight.sols[0].sol}\u2013${D.insight.sols[D.insight.sols.length - 1].sol}: one real Martian day per mission day.`;
    return `<b>Real NASA data in this mission</b>
      <div>\u2600\uFE0F Space weather (DONKI): ${spaceWeatherLine()}</div>
      <div>\u{1F321}\uFE0F ${wx}</div>
      <div>\u{1F4E1} Radio to Earth: ${world === 'moon' ? fmt(D.comms.moon_one_way_s, 1) + ' seconds' : (N.marsDelayNowS && N.marsDelayNowS() ? 'about ' + Math.round(N.marsDelayNowS() / 60) + ' minutes today (' : '') + Math.round(D.comms.mars_one_way_min_s / 60) + '\u2013' + Math.round(D.comms.mars_one_way_max_s / 60) + ' minutes' + (N.marsDelayNowS && N.marsDelayNowS() ? ' over the years)' : '')} one way.</div>`;
  }

  function radiationRuler(state) {
    const max = 2;
    const rows = D.radiation.rows.slice().sort((a, b) => a.msv_day - b.msv_day);
    const mine = state ? (state.diagnostics.radiation_msv_h * 24) : null;
    let h = '<div class="rr">';
    for (const r of rows) h += `<div><span>${esc(r.label)}</span><i style="width:${Math.max(2, r.msv_day / max * 100)}%"></i><b>${r.msv_day < 0.01 ? '~0.007' : fmt(r.msv_day, 2)}</b></div>`;
    if (mine != null) h += `<div class="me"><span>Your base right now</span><i style="width:${Math.min(100, Math.max(2, mine / max * 100))}%"></i><b>${fmt(mine, 2)}</b></div>`;
    return h + '</div><p class="fine">mSv per day. Bars cap at 2 mSv/day.</p>';
  }

  function sources() {
    const C = D.constants;
    const items = [
      ['NASA DONKI: flares (FLR)', 'real flare names, classes and dates; live 30-day count when reachable, else an ARCHIVE', D.donki.home],
      ['NASA DONKI: particle events (SEP)', 'why a flare gives a 4-hour warning before the particles arrive', D.donki.home],
      ['DONKI records of the 2017 and 2024 storms', 'the real flares replayed in "Which Sun do you face?"', D.donki.home],
      ['NASA InSight weather', 'real Mars weather per sol (675 to 681): temperature, pressure, wind', 'https://mars.nasa.gov/insight/weather/'],
      ['NASA/JPL planetary positions', 'where Earth and Mars are today, which sets the radio delay', 'https://ssd.jpl.nasa.gov/planets/approx_pos.html'],
      ['NASA POWER', 'sunlight on Earth, for the solar comparison', 'https://power.larc.nasa.gov/'],
      ['NASA Mars Fact Sheet', 'sunlight reaching Mars (586.2 W/m\u00B2) sets your panel power', C.mars_solar_irradiance_url],
      ['NASA Moon Facts', 'Moon temperature range (\u2212173 to 127 \u00B0C) and the solar constant', C.moon_url],
      ['NASA MSL/Curiosity RAD', 'radiation on Mars and on the way there', 'https://doi.org/10.1126/science.1244797'],
      ['NASA Artemis I/II (SRAG)', 'storm-shelter protection and the warning approach', D.artemis[1].url],
      ['NASA OSDR', 'astronaut-health science behind the morale/radiation link (cards only)', 'https://osdr.nasa.gov/bio/'],
      ['NASA NTRS: 2018 Mars dust storm', 'the model for dust storms and the "storm that stopped Opportunity"', D.dust.url],
      ['NASA Image and Video Library', 'mission photos on the end screen', 'https://images.nasa.gov/'],
      ['NASA SDO and Solar Cycle 25 reports', 'cross-check of flare times and sunspot regions', 'https://science.nasa.gov/blogs/solar-cycle-25/2026/06/30/sun-releases-strong-flare-11/'],
      ['Chang\u2019e-4 LND (China/Germany, not NASA)', 'radiation on the Moon', 'https://www.science.org/doi/10.1126/sciadv.aaz1334'],
      ['NOAA Space Weather Prediction Center', 'flare classes and times for the archived storms (including 2003)', 'https://www.swpc.noaa.gov/'],
    ];
    return '<ul class="src">' + items.map(([n, w, u]) => `<li>${link(u, n)}: ${esc(w)}</li>`).join('') + '</ul>';
  }

  function nasaTab(state) {
    const dg = state.diagnostics, cmp = N.solarCompare(ctx && ctx.config);
    let h = '<h2>NASA data</h2><table>';
    h += row('Space weather (DONKI)', badge(N.state.donki.mode));
    h += row('Mars weather (InSight)', ctx && ctx.loc === 'mars' ? badge('archive') : 'not used here');
    h += row('Sunlight on Earth (POWER)', badge(N.state.power.mode));
    if (dg.real_sol != null) h += row('Today is real sol', `${dg.real_sol} \u00B7 ${esc(dg.season)}`);
    h += row('Radio to Earth', delayText());
    if (episodeInfo()) h += row('The Sun you chose', esc(episodeInfo().title));
    h += '</table>';
    if (cmp) h += `<p><b>Sunlight:</b> Earth\u2019s equator got <b>${fmt(cmp.earth, 1)}</b> kWh/m\u00B2/day (NASA POWER, ${esc(cmp.from)}\u2013${esc(cmp.to)}). Your panels get about <b>${fmt(cmp.here, 1)}</b>, which is ${Math.round(cmp.ratio * 100)}% of that.</p>`;
    h += '<p><b>Space weather:</b> ' + spaceWeatherLine() + '</p>';
    h += '<p><b>Radiation ruler</b></p>' + radiationRuler(state);
    h += `<p class="fine">${esc(D.radiation.ct_comparison)} ${esc(D.radiation.career_limit)}</p>`;
    h += '<p><b>Where the data comes from</b></p>' + sources();
    h += '<p class="fine">Also used: three.js r128 (MIT licence) for the 3D scene and the Montserrat font (SIL OFL). Sounds, scenery and characters are made in code by the team.</p>';
    h += '<p class="fine">Archived values are labelled ARCHIVE. Doses in play are game-scaled. Not endorsed by NASA. Team MohaShunyo \u00B7 three.js (MIT) \u00B7 Montserrat (SIL OFL) \u00B7 sounds synthesized in your browser.</p>';
    return h;
  }

  /* ---------------------------------------------------------------- end recap */
  function recap(state, win) {
    if (!ctx) return '';
    const marsDay = rad('mars').msv_day, dose = state.radiation_dose;
    const li = [];
    li.push(`\u2622\uFE0F Your crew received <b>${fmt(dose, 1)} mSv</b>. That is about <b>${fmt(dose / marsDay, 0)} days</b> of normal Mars-surface radiation (${marsDay} mSv/day, NASA Curiosity RAD).`);
    for (const r of reports) {
      const gained = r.gained != null ? r.gained : (r.arrived ? Math.max(0, dose - r.dose0) : 0);
      const name = r.cls ? `<b>${esc(r.cls)}</b> flare (${esc(N.fmtDate(r.date))})` : 'Solar flare';
      if (!r.arrived) { li.push(`\u2600\uFE0F ${name}: the mission ended before the particles arrived.`); continue; }
      const saved = r.unshielded > 0 ? Math.max(0, Math.round((1 - gained / r.unshielded) * 100)) : 0;
      const how = r.sheltered ? 'You sheltered before the particles arrived.' : (r.panelsUsed ? `You added ${r.panelsUsed} shielding panel${r.panelsUsed > 1 ? 's' : ''}.` : 'You did not shelter in time.');
      li.push(`\u2600\uFE0F ${name}: ${how} Dose taken <b>${fmt(gained, 1)} mSv</b> instead of ${r.unshielded} mSv unprotected (${saved}% saved).`);
    }
    const goal = (ctx.config && ctx.config.tuning && ctx.config.tuning.science_goal_stars) || 40;
    li.push(`\u{1F52C} Research collected: <b>${Math.round(state.science)}%</b> (the research star needs ${goal}%). Every trip in the rover cost power and fuel, and could not run while the crew sheltered.`);
    if (reports.some(r => r.lead === 0)) li.push('\u{1F6A8} At least one flare came with no warning. Far-side flares are invisible from Earth, so real crews keep a shelter ready all the time.');
    if (!reports.length) li.push('\u2600\uFE0F No solar flare hit your base this time. Try another seed to meet a real one!');
    if (track.shelterHours) li.push(`\u{1F3E0} You sheltered for <b>${track.shelterHours} h</b>, and morale paid for it (lowest ${Math.round(track.minMorale)}%). Every safety choice costs something.`);
    if (track.minMorale < 50 && dose > 3) li.push(`\u{1F9EC} NASA OSDR studies found radiation and stress affect the body in different ways, so real crews guard both.`);
    if (ctx.loc === 'mars') li.push(`\u{1F4E1} A message to Earth takes ${delayText()} each way, so real Mars crews must make big calls on their own.`);
    const im = D.images.find(i => i.world === ctx.loc) || D.images[0];
    const fig = `<figure class="pc"><img src="${esc(im.url)}" alt="${esc(im.title)}" onerror="this.parentNode.hidden=true"><figcaption>${esc(im.title)}. ${esc(im.credit)}. ${link(im.page, 'images.nasa.gov')}</figcaption></figure>`;
    return `<div id="recap"><h3>What NASA data taught you</h3><ul>${li.map(x => `<li>${x}</li>`).join('')}</ul>${fig}</div>`;
  }

  window.Sol72Learn = { reset, welcome, onStep, hud, coach, systemsRows, missionRows, nasaTab, briefing, recap, badge, spaceWeatherLine,
    setConfig: (cfg, sols) => { if (ctx) { ctx.config = cfg; ctx.sols = sols; } }, getReports: () => reports.slice() };
})();
