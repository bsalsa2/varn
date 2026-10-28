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

## Controls

Drag to rotate, scroll or pinch to zoom, right-drag or Ctrl-drag to tilt. `/` search, `L` layers,
`H` whole Earth, `Esc` close. Click the ground to inspect coordinates, elevation and imagery date.

## Sky view

The detector's all-sky view is still available at `#sky`.
