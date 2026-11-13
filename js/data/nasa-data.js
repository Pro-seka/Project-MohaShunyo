/* Sol 72: archived NASA data snapshot (assembled from nasa-data-layer/data/cached/*.json and the pages cited per item).
 * NOTHING here is a live feed. See docs/NASA_DATA.md for the source of every number. */
window.SOL72_NASA = {
 "meta": {
  "project": "Sol 72",
  "built": "2026-11-11",
  "honesty": "Everything in this file is an ARCHIVED snapshot or a published constant. Nothing here is a live feed. The game tries live NASA APIs at start-up (js/nasa.js) and labels the result LIVE only if the request really succeeded."
 },
 "insight": {
  "name": "NASA InSight lander weather (TWINS temperature, PS pressure, wind sensors)",
  "station": "Elysium Planitia, Mars",
  "api": "https://api.nasa.gov/insight_weather/?feedtype=json&ver=1",
  "fetched_utc": "2026-10-01T16:52:16Z",
  "note": "Last 7 sols that remain in NASA's frozen InSight weather feed (mission ended Dec 2022). Values are per-sol min/max/mean of the raw sensor readings.",
  "sols": [
   {
    "sol": 675,
    "date": "2020-10-19",
    "season": "fall",
    "northern_season": "early winter",
    "temp_min_c": -96.9,
    "temp_max_c": -15.9,
    "temp_avg_c": -62.3,
    "pressure_pa": 750.6,
    "pressure_min_pa": 722.1,
    "pressure_max_pa": 768.8,
    "wind_ms": 7.2,
    "wind_max_ms": 22.5
   },
   {
    "sol": 676,
    "date": "2020-10-20",
    "season": "fall",
    "northern_season": "early winter",
    "temp_min_c": -96.9,
    "temp_max_c": -16.5,
    "temp_avg_c": -62.8,
    "pressure_pa": 749.1,
    "pressure_min_pa": 722.5,
    "pressure_max_pa": 767.1,
    "wind_ms": 8.5,
    "wind_max_ms": 26.9
   },
   {
    "sol": 677,
    "date": "2020-10-21",
    "season": "fall",
    "northern_season": "mid winter",
    "temp_min_c": -97.2,
    "temp_max_c": -16.9,
    "temp_avg_c": -63.1,
    "pressure_pa": 748.7,
    "pressure_min_pa": 720.6,
    "pressure_max_pa": 767.4,
    "wind_ms": 7.9,
    "wind_max_ms": 23.2
   },
   {
    "sol": 678,
    "date": "2020-10-22",
    "season": "fall",
    "northern_season": "mid winter",
    "temp_min_c": -97.7,
    "temp_max_c": -9.1,
    "temp_avg_c": -62.6,
    "pressure_pa": 743.7,
    "pressure_min_pa": 717.7,
    "pressure_max_pa": 760.3,
    "wind_ms": 5.2,
    "wind_max_ms": 18.4
   },
   {
    "sol": 679,
    "date": "2020-10-23",
    "season": "fall",
    "northern_season": "mid winter",
    "temp_min_c": -96.6,
    "temp_max_c": -11.6,
    "temp_avg_c": -62.6,
    "pressure_pa": 744.5,
    "pressure_min_pa": 719.4,
    "pressure_max_pa": 763.3,
    "wind_ms": 5.6,
    "wind_max_ms": 19.4
   },
   {
    "sol": 680,
    "date": "2020-10-24",
    "season": "fall",
    "northern_season": "mid winter",
    "temp_min_c": -96.8,
    "temp_max_c": -15.3,
    "temp_avg_c": -61.8,
    "pressure_pa": 744.0,
    "pressure_min_pa": 717.1,
    "pressure_max_pa": 764.0,
    "wind_ms": 6.5,
    "wind_max_ms": 24.2
   },
   {
    "sol": 681,
    "date": "2020-10-25",
    "season": "fall",
    "northern_season": "mid winter",
    "temp_min_c": -95.4,
    "temp_max_c": -4.4,
    "temp_avg_c": -62.4,
    "pressure_pa": 743.5,
    "pressure_min_pa": 718.5,
    "pressure_max_pa": 760.2,
    "wind_ms": 5.6,
    "wind_max_ms": 18.6
   }
  ]
 },
 "power": {
  "name": "NASA POWER (Prediction Of Worldwide Energy Resources), daily, ALLSKY_SFC_SW_DWN",
  "api": "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN&community=RE&longitude=0&latitude=0&start=20260911&end=20260924&format=JSON",
  "fetched_utc": "2026-10-01T16:52:14Z",
  "location": {
   "lat": 0,
   "lon": 0,
   "label": "Earth, equator (0N, 0E)"
  },
  "unit": "kWh per m2 per day of sunlight reaching the ground",
  "daily": [
   {
    "date": "2026-09-11",
    "ghi_kwh_m2_day": 5.032,
    "t_max_c": 24.23,
    "t_min_c": 23.5
   },
   {
    "date": "2026-09-12",
    "ghi_kwh_m2_day": 4.063,
    "t_max_c": 24.15,
    "t_min_c": 23.13
   },
   {
    "date": "2026-09-13",
    "ghi_kwh_m2_day": 4.213,
    "t_max_c": 24.52,
    "t_min_c": 23.48
   },
   {
    "date": "2026-09-14",
    "ghi_kwh_m2_day": 6.004,
    "t_max_c": 24.51,
    "t_min_c": 24.02
   },
   {
    "date": "2026-09-15",
    "ghi_kwh_m2_day": 6.573,
    "t_max_c": 24.58,
    "t_min_c": 23.87
   },
   {
    "date": "2026-09-16",
    "ghi_kwh_m2_day": 6.161,
    "t_max_c": 24.94,
    "t_min_c": 24.12
   },
   {
    "date": "2026-09-17",
    "ghi_kwh_m2_day": 4.66,
    "t_max_c": 24.65,
    "t_min_c": 24.02
   },
   {
    "date": "2026-09-18",
    "ghi_kwh_m2_day": 6.121,
    "t_max_c": 24.42,
    "t_min_c": 23.75
   },
   {
    "date": "2026-09-19",
    "ghi_kwh_m2_day": 6.453,
    "t_max_c": 24.75,
    "t_min_c": 23.8
   },
   {
    "date": "2026-09-20",
    "ghi_kwh_m2_day": 5.048,
    "t_max_c": 25,
    "t_min_c": 23.75
   },
   {
    "date": "2026-09-21",
    "ghi_kwh_m2_day": 5.584,
    "t_max_c": 24.36,
    "t_min_c": 23.81
   },
   {
    "date": "2026-09-22",
    "ghi_kwh_m2_day": 6.65,
    "t_max_c": 24.94,
    "t_min_c": 23.96
   },
   {
    "date": "2026-09-23",
    "ghi_kwh_m2_day": 6.682,
    "t_max_c": 25.07,
    "t_min_c": 24.34
   },
   {
    "date": "2026-09-24",
    "ghi_kwh_m2_day": 6.645,
    "t_max_c": 25.14,
    "t_min_c": 24.4
   }
  ]
 },
 "donki": {
  "name": "NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information), CCMC",
  "home": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/",
  "api": "https://api.nasa.gov/DONKI/FLR  and  https://api.nasa.gov/DONKI/SEP",
  "snapshot_utc": "2026-11-11",
  "note": "Hand-curated archive of real 2026 flares. Class and date come from the cited NASA pages or NASA-quoting news; the mSv doses used in play are game-scaled, not measured.",
  "sep_example": {
   "id": "2026-01-18T17:27:00-FLR-001",
   "class": "X1.9",
   "flare_peak_utc": "2026-01-18T18:09:00Z",
   "first_particles_utc": "2026-01-18T22:33:00Z",
   "instrument": "SOHO COSTEP 15.8-39.8 MeV (GOES-P SEISS >10 MeV followed at 22:55Z)",
   "lead_hours": 4.4,
   "region": "S15E20 (AR 14341)",
   "url": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/FLR/44029/2",
   "meaning": "The flare's light reached Earth within minutes, but the dangerous particles took about 4.4 hours: that gap is the warning window the game gives you (4 game hours)."
  },
  "flares": [
   {
    "id": "FLR-2026-06-30",
    "class": "X1.1",
    "date": "2026-06-30",
    "peak_utc": "2026-06-30T20:50:00Z",
    "region": "AR 4479",
    "severity": "minor",
    "source": "NASA Solar Cycle 25 blog (date/time) + Starlust (class)",
    "url": "https://science.nasa.gov/blogs/solar-cycle-25/2026/06/30/sun-releases-strong-flare-11/"
   },
   {
    "id": "2026-01-18T17:27:00-FLR-001",
    "class": "X1.9",
    "date": "2026-01-18",
    "peak_utc": "2026-01-18T18:09:00Z",
    "region": "AR 14341 (S15E20)",
    "severity": "minor",
    "source": "NASA DONKI",
    "url": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/FLR/44029/2"
   },
   {
    "id": "FLR-2026-04-23",
    "class": "X2.4",
    "date": "2026-04-23",
    "peak_utc": "2026-04-24T01:07:00Z",
    "region": "AR 4419",
    "severity": "moderate",
    "source": "NASA SDO (time) + PopSci (class)",
    "url": "https://science.nasa.gov/?p=1215402"
   },
   {
    "id": "FLR-2026-04-24",
    "class": "X2.5",
    "date": "2026-04-24",
    "peak_utc": "2026-04-24T08:13:00Z",
    "region": "AR 4419",
    "severity": "moderate",
    "source": "NASA SDO (time) + PopSci (class)",
    "url": "https://science.nasa.gov/?p=1215402"
   },
   {
    "id": "FLR-2026-02-04",
    "class": "X4.2",
    "date": "2026-02-04",
    "peak_utc": null,
    "region": "AR 4366",
    "severity": "moderate",
    "source": "NASA SDO image article",
    "url": "https://www.nasa.gov/image-article/strong-solar-flare"
   },
   {
    "id": "FLR-2026-02-01",
    "class": "X8.3",
    "date": "2026-02-01",
    "peak_utc": "2026-02-01T23:57:00Z",
    "region": "AR 4366",
    "severity": "severe",
    "source": "Space.com citing NOAA SWPC / NASA SDO",
    "url": "https://www.space.com/astronomy/sun/sun-unleashes-extraordinary-solar-flare-barrage-as-new-volatile-sunspot-turns-toward-earth"
   },
   {
    "id": "FLR-2003-11-04",
    "class": "X28+",
    "date": "2003-11-04",
    "peak_utc": null,
    "region": null,
    "severity": "severe",
    "source": "Largest flare of the satellite era: GOES saturated at X28, later estimated near X45 (pre-DONKI)",
    "url": "https://www.popsci.com/science/two-solar-flares-nasa/"
   }
  ],
  "cycle_note": "Solar Cycle 25 reached its maximum around late 2024 (NASA/NOAA announcement, Oct 2024), so 2026 is still a busy year for flares."
 },
 "radiation": {
  "note": "Dose equivalent in mSv per day. All published measurements; none is a live feed.",
  "rows": [
   {
    "id": "earth",
    "label": "Earth surface",
    "msv_day": 0.007,
    "approx": true,
    "source": "Derived: Moon surface is ~200x Earth surface (Zhang et al. 2020, Science Advances)",
    "url": "https://www.science.org/doi/10.1126/sciadv.aaz1334"
   },
   {
    "id": "mars",
    "label": "Mars surface (Gale Crater)",
    "msv_day": 0.64,
    "source": "NASA MSL/Curiosity RAD, Hassler et al. 2014, Science 343",
    "url": "https://doi.org/10.1126/science.1244797"
   },
   {
    "id": "iss",
    "label": "Inside the ISS",
    "msv_day": 0.731,
    "source": "Zhang et al. 2020 (same period as Chang'e-4)",
    "url": "https://www.science.org/doi/10.1126/sciadv.aaz1334"
   },
   {
    "id": "moon",
    "label": "Moon surface",
    "msv_day": 1.369,
    "source": "Chang'e-4 LND, Zhang et al. 2020, Science Advances (non-NASA instrument)",
    "url": "https://www.science.org/doi/10.1126/sciadv.aaz1334"
   },
   {
    "id": "cruise",
    "label": "Flying to Mars (inside spacecraft)",
    "msv_day": 1.8,
    "source": "NASA MSL/Curiosity RAD cruise data, Zeitlin et al. 2013",
    "url": "https://www.sciencedaily.com/releases/2013/05/130530145930.htm"
   }
  ],
  "ct_comparison": "NASA's Cary Zeitlin: on the trip to Mars the dose adds up like a whole-body CT scan every five or six days.",
  "career_limit": "A June 2021 National Academies report recommended a 600 mSv career limit for NASA astronauts. The game's 100 mSv mission limit is scaled down so a 72-hour mission can show the danger."
 },
 "comms": {
  "moon_one_way_s": 1.28,
  "mars_one_way_min_s": 182,
  "mars_one_way_max_s": 1337,
  "basis": "Computed as distance / speed of light using NASA's closest (~54.6 million km) and farthest (~401 million km) Earth-Mars distances and the Moon's mean distance (384,400 km)."
 },
 "artemis": [
  {
   "id": "A1",
   "title": "Artemis I shelter test",
   "fact": "On Artemis I, NASA's sensors in Orion showed the most shielded spots, such as the storm shelter area, gave about four times more protection than the least shielded spots.",
   "source": "NASA SRAG / Nature 2024 (reported by CNN)",
   "url": "https://ktvz.com/cnn-other/2024/09/19/mannequins-flew-around-the-moon-on-a-path-astronauts-could-soon-take-scientists-just-revealed-how-they-fared/"
  },
  {
   "id": "A2",
   "title": "Artemis II (launched 1 April 2026)",
   "fact": "Four astronauts flew a roughly 10-day trip around the Moon. Orion has six radiation sensors and each astronaut wears a personal dosimeter. If a solar storm hits, the crew stacks supplies along the least-shielded wall to build a shelter.",
   "source": "NASA",
   "url": "https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/"
  }
 ],
 "osdr": [
  {
   "id": "OSD-618 / OSD-640",
   "title": "Radiation + isolation + low gravity, together",
   "fact": "NASA scientists exposed mice to simulated deep-space radiation while also keeping them isolated or with low gravity. Radiation changed their immune cells early on, and living conditions changed them later, so a crew needs good shielding AND good morale.",
   "source": "NASA OSDR",
   "url": "https://catalog.data.gov/dataset/combined-space-stressors-induce-independent-behavioral-deficits-predicted-by-early-periphe"
  },
  {
   "id": "OSD-511",
   "title": "Young vs old on the Space Station",
   "fact": "Forty mice flew to the ISS in the Rodent Research Reference Mission 1. Scientists compared young and old animals and found that age changes how bodies respond to spaceflight.",
   "source": "NASA OSDR",
   "url": "https://www.biorxiv.org/content/10.1101/2025.02.17.638732.full.pdf"
  },
  {
   "id": "Inspiration4 / SOMA",
   "title": "The first all-civilian crew",
   "fact": "For the first time, data from a commercial astronaut crew (Inspiration4) was shared openly in OSDR. In June 2024, 44 papers about how spaceflight changes human bodies were published from it.",
   "source": "NASA Ames OSDR",
   "url": "https://www.nasa.gov/general/ames-research-center-democratizes-space-biosciences-research-with-first-commercial-astronaut-data"
  },
  {
   "id": "OSDR RadLab",
   "title": "A library of space radiation",
   "fact": "OSDR holds more than 455 studies, plus RadLab, a database of radiation measurements from space missions.",
   "source": "NASA NTRS 20240001562",
   "url": "https://ntrs.nasa.gov/citations/20240001562"
  }
 ],
 "dust": {
  "fact": "In 2018 a planet-wide dust storm darkened Mars. Dust opacity (tau) peaked near 8.5 at Curiosity, so only a tiny fraction of direct sunlight reached the ground.",
  "source": "NASA NTRS 20190001691",
  "url": "https://ntrs.nasa.gov/api/citations/20190001691/downloads/20190001691.pdf"
 },
 "images": [
  {
   "id": "PIA22228",
   "title": "InSight on the Surface of Mars",
   "credit": "NASA/JPL",
   "world": "mars",
   "url": "https://images-assets.nasa.gov/image/PIA22228/PIA22228~medium.jpg",
   "page": "https://images.nasa.gov/details/PIA22228"
  },
  {
   "id": "as8-14-2392",
   "title": "Earthrise over the Moon (Apollo 8)",
   "credit": "NASA/JSC",
   "world": "moon",
   "url": "https://images-assets.nasa.gov/image/as8-14-2392/as8-14-2392~medium.jpg",
   "page": "https://images.nasa.gov/details/as8-14-2392"
  }
 ],
 "real_flares": {
  "minor": [
   {
    "id": "FLR-2026-06-30",
    "class": "X1.1",
    "date": "2026-06-30",
    "peak_utc": "2026-06-30T20:50:00Z",
    "region": "AR 4479",
    "source": "NASA Solar Cycle 25 blog (date/time) + Starlust (class)",
    "url": "https://science.nasa.gov/blogs/solar-cycle-25/2026/06/30/sun-releases-strong-flare-11/"
   },
   {
    "id": "2026-01-18T17:27:00-FLR-001",
    "class": "X1.9",
    "date": "2026-01-18",
    "peak_utc": "2026-01-18T18:09:00Z",
    "region": "AR 14341 (S15E20)",
    "source": "NASA DONKI",
    "url": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/FLR/44029/2"
   }
  ],
  "moderate": [
   {
    "id": "FLR-2026-04-23",
    "class": "X2.4",
    "date": "2026-04-23",
    "peak_utc": "2026-04-24T01:07:00Z",
    "region": "AR 4419",
    "source": "NASA SDO (time) + PopSci (class)",
    "url": "https://science.nasa.gov/?p=1215402"
   },
   {
    "id": "FLR-2026-04-24",
    "class": "X2.5",
    "date": "2026-04-24",
    "peak_utc": "2026-04-24T08:13:00Z",
    "region": "AR 4419",
    "source": "NASA SDO (time) + PopSci (class)",
    "url": "https://science.nasa.gov/?p=1215402"
   },
   {
    "id": "FLR-2026-02-04",
    "class": "X4.2",
    "date": "2026-02-04",
    "peak_utc": null,
    "region": "AR 4366",
    "source": "NASA SDO image article",
    "url": "https://www.nasa.gov/image-article/strong-solar-flare"
   }
  ],
  "severe": [
   {
    "id": "FLR-2026-02-01",
    "class": "X8.3",
    "date": "2026-02-01",
    "peak_utc": "2026-02-01T23:57:00Z",
    "region": "AR 4366",
    "source": "Space.com citing NOAA SWPC / NASA SDO",
    "url": "https://www.space.com/astronomy/sun/sun-unleashes-extraordinary-solar-flare-barrage-as-new-volatile-sunspot-turns-toward-earth"
   },
   {
    "id": "FLR-2003-11-04",
    "class": "X28+",
    "date": "2003-11-04",
    "peak_utc": null,
    "region": null,
    "source": "Largest flare of the satellite era: GOES saturated at X28, later estimated near X45 (pre-DONKI)",
    "url": "https://www.popsci.com/science/two-solar-flares-nasa/"
   }
  ]
 },
 "constants": {
  "mars_solar_irradiance_wm2": 586.2,
  "mars_solar_irradiance_source": "NASA Mars Fact Sheet (NSSDCA): solar irradiance at Mars 586.2 W/m2, Earth 1361.0",
  "mars_solar_irradiance_url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
  "moon_solar_irradiance_wm2": 1361,
  "moon_temp_min_c": -173,
  "moon_temp_max_c": 127,
  "moon_source": "NASA Moon Facts: surface temperature -173 C to 127 C depending on exposure to sunlight; solar constant 1361 W/m2",
  "moon_url": "https://science.nasa.gov/moon/facts"
 }
};
