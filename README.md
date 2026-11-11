# 揺れ YURE · the planet, played live

**Live site:** https://kenjirochan.github.io/Yure/
**Repository:** https://github.com/KenjiroChan/Yure

CCT360 Assignment 2: Designing With Data
Tony Ren & Eldrick (Kenji)

## Concept

*Yure* (揺れ) is Japanese for "shaking." The site turns the live USGS earthquake feed into something you can watch and listen to. Every earthquake recorded on Earth shows up as a glowing circle on a dark world map, and each one plays a note. You don't read a table of numbers. You see and hear how restless the planet has been over the past hour, day or week.

The map is centred on the Pacific so the Ring of Fire, where most quakes happen, sits in the middle in one piece. All sound is heard from Toronto: a quake in Japan plays in your right ear, and one in Chile plays toward your left.

## How the data drives the experience

The site requests the USGS GeoJSON feed using `fetch()` with `async`/`await`, then requests it again every 60 seconds. USGS also updates its feed every minute.

| Data from USGS | What it changes |
| --- | --- |
| Location (lat / lon) | Where the circle is drawn on the map |
| Magnitude | Circle size, ripple size, and how loud and long the note is. Quakes of 4.5 or more get a second, lower note |
| Depth | Circle colour (gold = shallow, amber = middle, grey = deep) and the note's pitch (deeper = lower) |
| Time | Older quakes fade out. Quakes from the last hour keep pulsing |
| East / west of Toronto | Left/right stereo position of the sound |
| Biggest quake in the last hour | How hard the 揺れ logo shakes (CSS variable `--tremble`) |
| Quakes per hour | How fast the "Live" dot pulses (CSS variable `--pulse`) |
| Strongest quake + total count | The headline sentence at the top of the page |
| New quakes since the last check | A ripple, a sound and a pop-up notice |

## User interactions

- **Listen**: turns sound on (browsers block audio until the user clicks something)
- **Replay** (or the space bar): plays the whole hour, day or week back in 40 seconds, with a progress bar
- **Hour / Day / Week tabs**: switch to a different USGS feed
- **Click a quake** on the map or in the Latest list to open an info card with its magnitude, depth, time and distance from Toronto, plus a link to the USGS page. **Esc** closes it
- **Hover** over a quake and the cursor turns into a pointer

The layout is responsive and works on phones, tablets and desktop.

## Files

```
index.html            page structure
css/style.css         layout, colours, typography, animations
js/main.js            fetching the data, drawing the map, replay, buttons
js/sound.js           Web Audio API sound for each quake
assets/world-map.svg  Pacific-centred world map
```

## Built with

HTML, CSS and JavaScript only, with no libraries or frameworks. It uses the Fetch API, the Canvas API, the Web Audio API and CSS custom properties.

## Credits

- **Earthquake data:** U.S. Geological Survey (USGS) Earthquake Hazards Program, real-time GeoJSON feeds: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- **Map outlines:** Natural Earth (public domain), https://www.naturalearthdata.com
- **Fonts:** Shippori Mincho and IBM Plex Mono, from Google Fonts (SIL Open Font License)
- **Musical scale:** the notes come from the Japanese *in* scale (D, E♭, G, A, B♭)
- **Distance formula:** the haversine formula, used to work out the distance from Toronto on each card
- **AI assistance:** Claude (Anthropic) was used as a coding assistant during development

## Roles

- **Eldrick (Kenji):** development: HTML structure, CSS, the USGS data fetching, canvas map, replay and Web Audio sound
- **Tony Ren:** code review, presentation deck, presentation script, and video recording and editing
