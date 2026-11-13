/* Sol 72: famous space-weather episodes (curated ARCHIVE, never live).
 * Written from published NASA / NOAA records: flare class, peak time (UTC, rounded to the minute) and active region.
 * The game replays the strongest flares of an episode in order, with game-scaled doses.
 * The episode list is the "Which Sun do you want to face?" choice in the menu.
 * Verify any entry in NASA DONKI: https://kauai.ccmc.gsfc.nasa.gov/DONKI/ (search the date range). */
window.SOL72_STORMS = {
  meta: {
    honesty: 'ARCHIVED summaries of real events. Peak times are rounded. These are never presented as live data.',
    donki: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
  },
  episodes: {
    today: {
      title: "Today's Sun",
      short: 'Real flares from the last 30 days (NASA DONKI), or our 2026 archive when offline',
      kind: 'today',
    },
    storm2017: {
      title: 'September 2017 storm',
      short: 'Four X-class flares in one week',
      blurb: 'A fast-growing sunspot group, Active Region 2673, erupted on 4 to 10 September 2017. Curiosity\u2019s radiation detector on Mars saw the particle storm reach the Martian surface too.',
      kind: 'storm',
      flares: [
        { id: 'FLR-2017-09-06a', class: 'X2.2', date: '2017-09-06', peak_utc: '2017-09-06T09:10:00Z', region: 'AR 2673' },
        { id: 'FLR-2017-09-06b', class: 'X9.3', date: '2017-09-06', peak_utc: '2017-09-06T12:02:00Z', region: 'AR 2673' },
        { id: 'FLR-2017-09-07',  class: 'X1.3', date: '2017-09-07', peak_utc: '2017-09-07T14:36:00Z', region: 'AR 2673' },
        { id: 'FLR-2017-09-10',  class: 'X8.2', date: '2017-09-10', peak_utc: '2017-09-10T16:06:00Z', region: 'AR 2673' },
      ],
    },
    storm2024: {
      title: 'May 2024 storm',
      short: 'The Gannon superstorm',
      blurb: 'Active Region 3664 produced a string of X-class flares and several CMEs. Auroras reached far south of their usual range on 10 to 11 May 2024, the strongest geomagnetic storm in about 20 years.',
      kind: 'storm',
      flares: [
        { id: 'FLR-2024-05-09', class: 'X2.2', date: '2024-05-09', peak_utc: '2024-05-09T09:13:00Z', region: 'AR 3664' },
        { id: 'FLR-2024-05-11', class: 'X5.8', date: '2024-05-11', peak_utc: '2024-05-11T01:23:00Z', region: 'AR 3664' },
        { id: 'FLR-2024-05-14', class: 'X8.7', date: '2024-05-14', peak_utc: '2024-05-14T16:51:00Z', region: 'AR 3664' },
      ],
    },
    storm2003: {
      title: 'Halloween 2003',
      short: 'Some of the biggest flares ever recorded',
      blurb: 'Active Region 486 unleashed record-sized flares in late October and early November 2003, long before today\u2019s space-weather satellites. The 4 November flare saturated the detectors at X28 and was later estimated near X45.',
      kind: 'storm',
      flares: [
        { id: 'FLR-2003-10-28', class: 'X17.2', date: '2003-10-28', peak_utc: '2003-10-28T11:10:00Z', region: 'AR 486' },
        { id: 'FLR-2003-10-29', class: 'X10.0', date: '2003-10-29', peak_utc: '2003-10-29T20:49:00Z', region: 'AR 486' },
        { id: 'FLR-2003-11-04', class: 'X28+',  date: '2003-11-04', peak_utc: '2003-11-04T19:29:00Z', region: 'AR 486' },
      ],
    },
    dust2018: {
      title: 'Dust storm of 2018',
      short: 'The storm that stopped Opportunity (Mars only)',
      blurb: 'In June 2018 a planet-sized dust storm choked the sunlight reaching the Opportunity rover\u2019s solar panels. The rover went quiet on 10 June 2018. In this mission the Sun disappears early: cut your power use and stretch the battery.',
      kind: 'dust',
      marsOnly: true,
      dust: { tau: 3.0, duration: 48 },   // game-scaled: cuts sunlight ~95 % for 48 h
    },
    random: {
      title: 'Surprise me',
      short: 'Random events, no real flare names',
      kind: 'random',
    },
  },
};
