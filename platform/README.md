# VARN Command Center

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

### Google-Earth-style 3D cities (optional, needs a key)

True photorealistic 3D buildings use Google Photorealistic 3D Tiles. They need a Google Maps Platform key
with billing enabled (usage-based pricing: check Google's current prices before enabling) or a Cesium ion
token. Neither is set, so the **3D buildings** layer shows as unavailable. To turn it on, add
`VITE_GOOGLE_MAPS_API_KEY` (restrict it to this site's referrer and set a quota) in the Pages environment
and redeploy. Google requires its own geocoder and attribution while these tiles are shown; both are handled.
With `VITE_CESIUM_ION_TOKEN` the viewer also uses Cesium World Terrain. These keys are client-side by design,
so restrict and cap them.

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

## Controls

Drag to rotate, scroll or pinch to zoom, right-drag or Ctrl-drag to tilt. `/` search, `L` layers,
`H` whole Earth, `Esc` close. Click the ground to inspect coordinates, elevation and imagery date.

## Sky view

The detector's all-sky view is still available at `#sky`.
