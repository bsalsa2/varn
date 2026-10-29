# VARN Command Center

> **Policy: this project uses free sources only.** No paid API, no billed key, no subscription: nothing here may cost money. Paid options (for example Google Photorealistic 3D Tiles) were deliberately removed so a key cannot be added by accident.

An interactive 3D Earth: real satellite imagery, terrain and selectable Earth-observation layers,
built with [CesiumJS](https://cesium.com/platform/cesiumjs/) (Apache-2.0). The public site in
`web/` (tryvarn.com) is separate and untouched.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The build copies Cesium's runtime assets (workers, textures) into `dist/cesium`. Cloudflare Pages:
root directory `platform`, build command `npm run build`, output `dist`.

## Data sources

| Layer | Provider | Updates | Resolution | Key? |
|---|---|---|---|---|
| Satellite | Esri World Imagery | Periodic basemap; each area has its own capture date, shown from Esri's imagery metadata at the view centre and on click | ~0.3–1 m in many cities, coarser elsewhere | Not required today; see licensing |
| Fallback base | NASA Blue Marble (bundled) | Static | ~10 km | No |
| Terrain | AWS Terrain Tiles (Terrarium) | Static | ~30 m on land | No |
| Labels | Esri World Boundaries and Places | Periodic | — | Not required today |
| Day / night | Sun position computed in the browser; city lights NASA Earth at Night (bundled) | Live sun | — | No |
| Clouds | NASA GIBS, VIIRS / MODIS corrected-reflectance true colour | Daily (latest available day shown) | ~250–375 m | No |
| Weather | NASA GIBS, GPM IMERG precipitation rate | Half-hourly, a few hours behind | ~10 km | No |
| Fires / Vegetation / Night lights | NASA GIBS (VIIRS thermal anomalies, MODIS NDVI, VIIRS Day/Night Band) | Daily / 8-day | 250–750 m | No |
| Search | OpenStreetMap Nominatim (on submit only) | — | — | No |

GIBS layer names change over time, so each layer lists candidates; the viewer requests one tile per
candidate and date and only shows a layer, with its real date, once data comes back. A layer that
never answers switches itself off and says so.

### Licensing and keys

- **Esri** basemaps answer without a key at the moment, but Esri's terms expect an ArcGIS account for
  production and commercial use. ArcGIS Location Platform has a free tier. Put a key in the Pages
  environment as `VITE_ARCGIS_API_KEY` (restrict it to the site's referrer); it is a client-side key by
  design.
- **Cesium ion** (Cesium World Terrain, Bing aerial, 3D buildings) is not used. Its free Community plan
  is non-commercial; commercial use is a paid plan. `VITE_CESIUM_ION_TOKEN` is read if set.
- NASA data is public domain; attribution is shown in the credits line.

Keys and tokens go in Cloudflare Pages environment variables, never in the repository.

## Sharpness and realism

- **Full device resolution.** The globe renders at the screen's real pixel density (capped at 2×), not
  CSS pixels, with anti-aliasing and a tighter tile-detail target; this was the main source of soft imagery.
- **Faster loading when zooming quickly.** Tile requests to Esri, NASA and AWS run in parallel (36, 24 and
  24 per host), the tile cache is larger, neighbouring tiles are preloaded, terrain is decoded in worker
  threads, and the view repaints every time the tile queue changes. Until a sharp tile arrives, the best
  tile already loaded stays on screen.
- **Real imagery depth.** Esri imagery is requested down to its service's own zoom levels (up to 21). Where
  Esri has no data at a depth it returns an identical "not yet available" tile; those are discarded so the
  sharpest real tile stays visible, never a grey placeholder. Resolution is limited by what Esri holds for
  that place: about 0.3–1 m in many cities, coarser elsewhere.
- **Relief shading.** Mountains are shaded from the elevation data (lit from the north-west, soft shadows,
  stronger from orbit), so terrain looks solid under the imagery. It follows the Terrain toggle.
- **Camera.** Search and locate arrive angled and centred, like Google Earth; diving in with the scroll wheel
  eases the view toward the horizon near the ground; there are tilt and north-up buttons.

## Smoothness, brightness and connection checks

- **No UI churn while the globe moves.** The camera, cursor and tile-queue readouts live in a small store that notifies React at most ~8×/s, so panning and zooming never re-render the interface.
- **Relief shading is seamless and cheap.** Tiles are shaded from a 3×3 neighbourhood so there are no lines at tile edges, in one shared elevation worker (decoded-tile cache, newest-first queue). While flying, shading tiles are skipped rather than queued, and Cesium asks again when the camera settles.
- **Transitions fade, they do not switch.** Lighting, the night side and city lights blend with altitude; there is no pop at a threshold.
- **Failed tiles retry** (up to three times) instead of leaving permanent holes.
- **Brightness.** Day-side imagery is graded in a final pass (gamma 0.86, gain 1.05, saturation 1.14, soft highlight shoulder). Measured against the same scene before the grade: close-up +14 %, orbit +20 % mean luminance.
- **Quality governor.** If the average frame time stays above ~34 ms the renderer steps down once (resolution, then MSAA); the status line says "Quality adjusted for speed". `?fixed` disables it.
- **Graphics-context loss** shows a "Restart the globe" card instead of a frozen canvas.
- **Connections** (Layers panel): a quick check runs automatically after load and lists real results per source: Esri imagery, AWS elevation, globe engine files, bundled NASA imagery, Esri capture dates and labels, WebGL, location permission. "Test all" adds NASA GIBS and place search. An amber dot on the Layers button means something failed. A layer that cannot load switches itself off; nothing is shown as active unless data returned.
- `?debug` exposes the Cesium widget and `__setTime(iso)` (freezes the clock) for testing.

## Command terminal

Press `` ` `` (or the terminal button, or open `/#terminal`) for a command-line view of the same globe. It is labelled **UNCLASSIFIED // PUBLIC DATA ONLY** because that is exactly what it is: open data, shown with its own timestamps, nothing simulated, no agency branding. If a source is down you get its error.

| Command | What it does |
|---|---|
| `brief` | One-screen summary: M4.5+ quakes (24 h) and open natural events (7 d) |
| `quakes [hour\|day\|week\|month] [min_mag]` | USGS earthquakes: table, markers on the globe, alert line at M6+ |
| `fires [days]` | NASA EONET wildfire incidents (markers) + NASA GIBS thermal detections (raster) |
| `events [category\|all] [days]` | Storms, volcanoes, floods… from NASA EONET |
| `go <n>` | Fly to item *n* of the last list and open its details |
| `fly <place \| lat, lon> [km]` | Fly to a place name or coordinates |
| `layers [name on\|off]` | List or switch layers (`fires`, `clouds`, `weather`, `buildings`, …) |
| `watch quakes [min_mag]` | Poll the USGS past-hour feed every 2 min and print new events |
| `status`, `sun`, `imagery`, `time` | Camera, sun angle at the view centre, imagery capture date, UTC |
| `mark <name>` / `marks [name]` | Bookmarks (stored in this browser) |
| `check [deep]` | Real connection test of every data source |
| `about` | Sources, licences and limits |

Tab completes, ↑/↓ recalls history, Ctrl+L clears. The command logic is plain JS (`src/globe/commands.js`) with unit tests.

Earthquakes can also be switched on from **Layers › Earthquakes**, and turning on **Fires** plots the EONET incidents next to the satellite detections.

### What the layer labels mean

Labels describe how often the *source* produces data; the layer row and status line also show how old the data on screen actually is.

| Layer | Label | Meaning |
|---|---|---|
| Satellite, Labels | Basemap | A mosaic of many capture dates, updated periodically. The inspection card shows the capture date where Esri reports one. |
| Terrain | Static | Elevation model, not updated. |
| Day / night | Real time | The sun's position is computed from your clock and refreshed each minute. City lights are a static NASA composite. |
| Clouds | Daily | One true-colour composite per day; the newest is usually 1–2 days old. |
| Weather | 30-min data | A rain-rate estimate every 30 minutes, published about 3–4 hours after it was observed, so the newest is never "now". |
| Fires | Daily | Detections grouped by day; the newest day is usually yesterday. Incident markers (EONET) are a snapshot. |
| Vegetation | 8-day | One composite per 8-day period, so it can be a week or more old. |
| Night lights | Daily | One observation per night, usually 1–2 days old. |
| Earthquakes | Snapshot | The USGS feed updates about every minute; this view re-reads it every 5 minutes and shows when it was fetched. |

### Layer blending and tile reliability

Overlays fade in and out instead of switching, and their opacity eases down as you zoom in (clouds from 0.60 to 0.18, vegetation from 0.50 to 0.25, weather and night lights less), so 250 m–10 km data never washes out sharp close-ups. Night-side clouds and vegetation are dimmed. A failed tile request is retried with growing pauses (not for 4xx answers); only a tile that still fails counts, for one minute, and the sharper parent tile stays on screen meanwhile.

Clicking the globe opens one compact card: place name (OpenStreetMap), position, elevation, imagery capture date and resolution, and the sun's state with solar time. Place lookup runs once per click.

### About fires

NASA's thermal-anomaly layer is raw satellite hot-pixel detections: each is one or two pixels wide, so from orbit it is nearly invisible and only reads when you zoom to a region. That is why the incident markers exist. EONET lists notable incidents rather than every fire; a detection is not a confirmed fire. The layer finder also treats these mostly-transparent tiles as valid when NASA answers with a small image (an earlier size check wrongly rejected them as "unavailable").

### 3D buildings

On by default and automatic: nothing is drawn from orbit or at regional scale; buildings grow out of the ground once the camera is below about 6.5 km. Only one source is ever on screen:

| # | Source | Needs | Cost | What you see |
|---|---|---|---|---|
| 1 | Cesium OSM Buildings, only if you set `VITE_CESIUM_ION_TOKEN` | a free Cesium ion account (no card) | free tier | extruded OSM buildings |
| 2 | **Open footprints (the default)**: OpenStreetMap buildings from OpenFreeMap vector tiles, extruded in the existing Cesium scene (`buildingsLayer.js`, `buildingsData.js`) | nothing | free, no key | plain extruded footprints |

What the default source is and is not: footprints plus a height in metres, from OSM `height` or `building:levels` tags (and `min_height` for overhangs). There are no roof shapes and no facade detail, and buildings are not photogrammetry. Many buildings are not mapped with a height and use a plain low default; the Layers panel states what share of the loaded buildings that is. Coverage is wherever OSM has buildings, which is dense and well-mapped in most large cities and thin elsewhere. Dense tiles are thinned to their largest 4,500 footprints; at most 20 tiles / 40,000 buildings stay in memory. Where there is no data, nothing is drawn. Heights are placed on the same terrain data the globe uses.

Attribution: © OpenStreetMap contributors, building tiles by OpenFreeMap / OpenMapTiles (shown in the credits line). OpenFreeMap asks for fair use; if traffic ever grows large, self-host or sponsor it. If the source is unreachable the layer reports the reason and switches itself off.

### Zoom sharpness

Imagery tiles load progressively: the sharper parents stay on screen while finer tiles arrive, with no blank flash. Imagery is never sharpened artificially. When you zoom beyond what the source captured, the status line says "enlarged beyond the source detail". While a zoom is under way the app warms the browser cache with the tiles it is heading toward (under the cursor, low priority, capped), the tile cache holds 900 tiles, failed tiles retry, and the "Sharpening imagery" indicator only appears if loading lasts more than 0.7 s.

## Controls

Drag to rotate, scroll or pinch to zoom, right-drag or Ctrl-drag to tilt. `/` search, `L` layers,
`H` whole Earth, `Esc` close. Click the ground to inspect coordinates, elevation and imagery date.

## Sky view

The detector's all-sky view is still available at `#sky`.
