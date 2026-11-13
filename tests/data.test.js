/* Run: node tests/data.test.js   (no dependencies)
 * Sanity checks on the curated NASA data and the Earth-Mars signal delay. */
global.window = global;
require('../js/data/nasa-data.js');
require('../js/data/storms.js');
const O = require('../js/orbits.js');
const D = window.SOL72_NASA, ST = window.SOL72_STORMS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// storm archive
for (const [id, ep] of Object.entries(ST.episodes)) {
  if (ep.kind !== 'storm') continue;
  const t = ep.flares.map(f => Date.parse(f.peak_utc));
  ok(t.every((x, i) => !isNaN(x) && (i === 0 || x > t[i - 1])), `${id}: flare times are valid and in order`);
  ok(ep.flares.every(f => /^X\d/.test(f.class) && f.region && f.date === f.peak_utc.slice(0, 10)), `${id}: every flare has class, region and a matching date`);
}
ok(ST.episodes.storm2017.flares.map(f => f.class).join() === 'X2.2,X9.3,X1.3,X8.2', 'Sept 2017 = X2.2, X9.3, X1.3, X8.2');
ok(ST.episodes.storm2003.flares.at(-1).class === 'X28+', 'Halloween 2003 largest flare is recorded as X28+ (saturated), not an invented number');
ok(ST.episodes.dust2018.marsOnly === true, '2018 dust storm is Mars-only');

// curated 2026 flare list used by Today's Sun (offline)
ok(D.real_flares && ['minor', 'moderate', 'severe'].every(k => D.real_flares[k] && D.real_flares[k].length), 'real flares exist for every severity');
ok(!JSON.stringify(D).includes('X40+'), 'no unverified X40+ flare class remains');
const x83 = JSON.stringify(D).includes('"X8.3"') && JSON.stringify(D).includes('2026-02-01');
ok(x83, 'the X8.3 flare of 1 Feb 2026 is in the archive');

// sourced constants used by the game
const C = D.constants;
ok(C && C.mars_solar_irradiance_wm2 === 586.2 && /nssdc\.gsfc\.nasa\.gov/.test(C.mars_solar_irradiance_url), 'Mars sunlight constant matches the NASA Mars Fact Sheet (586.2 W/m2) and cites it');
ok(C.moon_temp_min_c === -173 && C.moon_temp_max_c === 127 && /science\.nasa\.gov\/moon/.test(C.moon_url), 'Moon temperature range matches NASA Moon Facts and cites it');

// signal delay from JPL elements
const dMin = O.lightMinutes(new Date('2025-01-12T00:00:00Z'));   // near opposition
const dMax = O.lightMinutes(new Date('2026-01-09T00:00:00Z'));   // near solar conjunction
ok(dMin >= 3 && dMin < 8, `near opposition Mars is ~3-8 light-minutes away (${dMin.toFixed(1)})`);
ok(dMax > 18 && dMax <= 23, `near conjunction Mars is ~18-23 light-minutes away (${dMax.toFixed(1)})`);
ok(O.lightMinutes(new Date('2026-11-13T00:00:00Z')) > 3 && O.lightMinutes(new Date('2026-11-13T00:00:00Z')) < 23, 'delay for the build date is in range');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
