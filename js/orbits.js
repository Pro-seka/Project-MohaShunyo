/* Sol 72 · Earth–Mars signal delay
 * Uses the mean orbital elements published by NASA/JPL ("Keplerian Elements for Approximate
 * Positions of the Major Planets", Standish, valid 1800-2050) to estimate where Earth and Mars
 * are on a given date, then converts the distance into radio travel time.
 * Accuracy is a few percent: plenty for a "message from Earth took N minutes" line. */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;
  // [a (AU), e, I (deg), L (deg), long.peri (deg), long.node (deg)] and their rates per Julian century
  const EL = {
    earth: { v: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
             r: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
    mars:  { v: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
             r: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] }
  };
  const AU_LIGHT_MIN = 8.316746;      // light travel time for 1 AU, in minutes
  const MOON_LIGHT_S = 1.282;         // mean Earth–Moon distance 384,400 km

  function jd(date) { return date.getTime() / 86400000 + 2440587.5; }

  function helio(body, date) {
    const T = (jd(date) - 2451545.0) / 36525;
    const p = EL[body].v.map((x, i) => x + EL[body].r[i] * T);
    const a = p[0], e = p[1], I = p[2] * D2R, L = p[3], wbar = p[4], Om = p[5] * D2R;
    const w = (wbar - p[5]) * D2R;
    let M = (((L - wbar) % 360) + 540) % 360 - 180; M *= D2R;
    let E = M; for (let i = 0; i < 12; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
    return [ (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
             (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
             (sw * sI) * xp + (cw * sI) * yp ];
  }

  function earthMarsAU(date) {
    const a = helio('earth', date), b = helio('mars', date);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }
  function lightMinutes(date) { return earthMarsAU(date) * AU_LIGHT_MIN; }

  const api = { earthMarsAU, lightMinutes, MOON_LIGHT_S, AU_LIGHT_MIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sol72Orbits = api;
})(typeof window !== 'undefined' ? window : globalThis);
