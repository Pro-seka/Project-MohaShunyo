# Used NASA data

### NASA data

| # | Dataset name | Link | How you used it (one line) |
|---|---|---|---|
| 1 | NASA DONKI: Solar Flares (FLR) | https://kauai.ccmc.gsfc.nasa.gov/DONKI/ (API: https://api.nasa.gov/DONKI/FLR) | Real flare classes and dates become the game's solar-flare events; live 30-day flare count (when reachable) sets how often flares hit, with a labelled ARCHIVE of 7 real flares (X1.1 to X8.3, 2026) offline. |
| 2 | NASA DONKI: Solar Energetic Particles (SEP) | https://kauai.ccmc.gsfc.nasa.gov/DONKI/ (API: https://api.nasa.gov/DONKI/SEP) | Models the real warning window: the 18 Jan 2026 X1.9 flare (18:09 UTC) was followed by particles about 4 h later, so every flare gives a 4-hour "shelter or shield" decision; live SEP count shown when reachable. |
| 3 | DONKI records of historic storms (Sept 2017 and May 2024) | https://kauai.ccmc.gsfc.nasa.gov/DONKI/ | The real X-class flares of those storms (class, date, sunspot region) replay in their true order in the "Which Sun do you face?" choice. |
| 4 | NASA InSight Mars weather, sols 675 to 681 | https://mars.nasa.gov/insight/weather/ (API: https://api.nasa.gov/insight_weather/) | Each mission day is one real InSight sol: its real minimum/maximum temperature drives the heater's power use; real pressure and wind are shown (ARCHIVE: the feed ended in 2022). |
| 5 | NASA/JPL approximate planetary positions | https://ssd.jpl.nasa.gov/planets/approx_pos.html | Computed in the browser to show today's real Earth-Mars radio delay (about 3 to 22 minutes), which explains why the crew must decide alone and drives the no-warning far-side flares. |
| 6 | NASA POWER (all-sky surface shortwave irradiance) | https://power.larc.nasa.gov/ | Compares real sunlight on Earth with what the player's solar panels receive on Mars or the Moon (LIVE 14 days when reachable, otherwise ARCHIVE 11 to 24 Sep 2026). |
| 7 | NASA Mars Fact Sheet (NSSDCA) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | Solar irradiance at Mars (586.2 W/m2, Earth 1361.0) sets how much power the panels make before dust and storms. |
| 8 | NASA Moon Facts | https://science.nasa.gov/moon/facts | Moon surface temperature range (-173 to 127 C) and the solar constant drive the Moon base's heater and power model. |
| 9 | NASA MSL/Curiosity RAD radiation measurements (Hassler et al. 2014; Zeitlin et al. 2013) | https://doi.org/10.1126/science.1244797 | Real Mars surface dose (0.64 mSv/day) and cruise dose (1.8 mSv/day) form the radiation ruler, and the end screen converts your crew's dose into "days of normal Mars radiation". |
| 10 | NASA Artemis I and II radiation-shelter results (SRAG) | https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/ | Orion's storm shelter gave about 4x protection, so the game's shelter cuts dose to one quarter; Artemis II's storm procedure is the model for the shelter action. |
| 11 | NASA Open Science Data Repository (OSDR): OSD-618/640, OSD-511, Inspiration4, RadLab | https://osdr.nasa.gov/bio/ | Science cards link radiation and crew stress to real astronaut-health research, so shielding and morale are taught together (context cards only; no OSDR raw data drives the simulation). |
| 12 | NASA NTRS 20190001691: the 2018 global Mars dust storm | https://ntrs.nasa.gov/api/citations/20190001691/downloads/20190001691.pdf | Model for the dust-storm event and the scripted "storm that stopped Opportunity" scenario (sunlight cut by exp(-tau)). 
| 13 | NASA Image and Video Library (PIA22228, as8-14-2392) | https://images.nasa.gov/ | Real NASA mission photo (InSight on Mars / Earthrise over the Moon) shown on the end screen, with credit. |
| 14 | NASA SDO and Solar Cycle 25 reports | https://science.nasa.gov/blogs/solar-cycle-25/2026/06/30/sun-releases-strong-flare-11/ | Used to cross-check the peak times and sunspot regions of the archived 2026 flares. |

### Other space agency data

| Dataset name | Link | How you used it |
|---|---|---|
| Chang'e-4 Lunar Lander Neutrons and Dosimetry (LND), CNSA mission with Kiel University instrument (Zhang et al. 2020) | https://www.science.org/doi/10.1126/sciadv.aaz1334 | Real radiation dose measured on the Moon's surface (1.369 mSv/day, about 200x Earth) sets the Moon background dose; the game labels it as a non-NASA instrument. |

(ESA, JAXA, CSA and ISRO data: none. Leave those out.)

### Other datasets

| Name | Link | How you used it |
|---|---|---|
| NOAA Space Weather Prediction Center flare records | https://www.swpc.noaa.gov/ | Flare class and time of the archived Halloween 2003 storm (X17.2, X10.0, X28+) and cross-checks for the 2017 and 2024 storms. |
| three.js r128 (MIT licence) | https://threejs.org/ | 3D rendering of the base, rover and astronauts in the browser. |
| Montserrat font (SIL Open Font Licence) | https://fonts.google.com/specimen/Montserrat | Game text and interface. |

---------------------------------------------------------------------

### References

NASA data and documents
- DONKI space weather database: https://kauai.ccmc.gsfc.nasa.gov/DONKI/ and API https://api.nasa.gov/
- InSight weather: https://mars.nasa.gov/insight/weather/
- JPL approximate planetary positions: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- NASA POWER: https://power.larc.nasa.gov/
- NASA Mars Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- NASA Moon Facts: https://science.nasa.gov/moon/facts
- Hassler et al. 2014, Science 343 (Curiosity RAD, Mars surface dose): https://doi.org/10.1126/science.1244797
- Zeitlin et al. 2013, Science 340 (Curiosity RAD, cruise dose; press summary): https://www.sciencedaily.com/releases/2013/05/130530145930.htm
- NASA Artemis II radiation and storm shelter: https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/
- Artemis I shelter result (NASA SRAG, Nature 2024, as reported by CNN): https://ktvz.com/cnn-other/2024/09/19/mannequins-flew-around-the-moon-on-a-path-astronauts-could-soon-take-scientists-just-revealed-how-they-fared/
- NASA OSDR: https://osdr.nasa.gov/bio/ ; OSD-618/640 record: https://catalog.data.gov/dataset/combined-space-stressors-induce-independent-behavioral-deficits-predicted-by-early-periphe ; OSD-511 preprint: https://www.biorxiv.org/content/10.1101/2025.02.17.638732.full.pdf ; Inspiration4 data release: https://www.nasa.gov/general/ames-research-center-democratizes-space-biosciences-research-with-first-commercial-astronaut-data ; RadLab and OSDR overview: https://ntrs.nasa.gov/citations/20240001562
- 2018 Mars global dust storm: https://ntrs.nasa.gov/api/citations/20190001691/downloads/20190001691.pdf
- NASA Image and Video Library: https://images.nasa.gov/ (PIA22228: https://images.nasa.gov/details/PIA22228 ; as8-14-2392: https://images.nasa.gov/details/as8-14-2392)
- NASA Solar Cycle 25 blog, 30 Jun 2026 flare: https://science.nasa.gov/blogs/solar-cycle-25/2026/06/30/sun-releases-strong-flare-11/
- NASA SDO image article "Strong solar flare": https://www.nasa.gov/image-article/strong-solar-flare

Other agencies and independent reports (flare cross-checks)
- NOAA Space Weather Prediction Center: https://www.swpc.noaa.gov/
- Zhang et al. 2020, Science Advances 6, eaaz1334 (Chang'e-4 LND): https://www.science.org/doi/10.1126/sciadv.aaz1334
- X8.3 flare of 1 Feb 2026, AR 4366 (Space.com): https://www.space.com/astronomy/sun/sun-unleashes-extraordinary-solar-flare-barrage-as-new-volatile-sunspot-turns-toward-earth
- X1.9 flare of 18 Jan 2026, AR 4341 (Watchers): https://watchers.news/2026/01/18/long-duration-x1-9-solar-flare-erupts-from-region-4341-earth-directed-cme-likely/
- S4 radiation storm of 19 Jan 2026 (SpaceWeatherLive): https://www.spaceweatherlive.com/en/news/view/600/20260119-cme-impact-s4-solar-radiation-storm.html
- April 2026 flares (Popular Science): https://www.popsci.com/science/two-solar-flares-nasa/
- National Academies 2022 report recommending a 600 mSv career limit for astronauts (quoted in the game's NASA tab): [add the link you use]

Software and assets
- three.js r128, MIT licence: https://threejs.org/
- Montserrat typeface, SIL OFL: https://fonts.google.com/specimen/Montserrat
- Game scenery, rover, astronauts and sounds are drawn or synthesised in code by our team.
- Our project documentation: README.md and docs/ in the repository (NASA_DATA.md lists every dataset, what is LIVE, ARCHIVE or game-scaled).
