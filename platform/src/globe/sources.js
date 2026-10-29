// Every imagery and data source the Earth viewer uses, with what it really is: provider,
// resolution, how often it changes and its licence. No source is shown as active until it
// has actually returned data.

const ARCGIS_KEY = import.meta.env.VITE_ARCGIS_API_KEY || '';
const withKey = (url) => (ARCGIS_KEY ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(ARCGIS_KEY)}` : url);

export const BASE = {
  esri: {
    name: 'Esri World Imagery',
    service: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    token: ARCGIS_KEY || undefined,
    url: withKey('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    maximumLevel: 21,   // deeper than most coverage; tiles Esri has no data for are discarded and the sharper ancestor stays
    credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    cadence: 'Periodic basemap mosaic; each area has its own capture date',
    resolution: '~0.3–1 m in many cities, 10–15 m elsewhere',
  },
  blueMarble: {
    name: 'NASA Blue Marble',
    url: '/earth/blue-marble-4k.webp',
    credit: 'NASA Visible Earth (public domain)',
    cadence: 'Static composite',
    resolution: '~10 km',
  },
};

// Optional upgrades. Each needs a key that costs money or limits use, so they stay off unless
// the key is set in the Cloudflare Pages environment. See platform/README.md.
export const UPGRADES = {
  ionToken: import.meta.env.VITE_CESIUM_ION_TOKEN || '',
};

export const LABELS = {
  name: 'Esri World Boundaries and Places',
  url: withKey('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'),
  maximumLevel: 19,
  credit: 'Esri, HERE, Garmin, © OpenStreetMap contributors',
};

export const TERRAIN = {
  name: 'AWS Terrain Tiles',
  url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  maxLevel: 15,
  credit: 'Terrain: Mapzen / AWS Open Data (SRTM, GMTED, ETOPO1 and others)',
  resolution: '~30 m on land, coarser in places',
};

// NASA GIBS layers. GIBS has renamed and retired layers over time, so each entry lists
// candidate identifiers; the first that answers is used, and its date is the one shown.
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const GIBS_CREDIT = 'NASA EOSDIS Global Imagery Browse Services (GIBS)';
export const OVERLAYS = {
  clouds: {
    label: 'Clouds', name: 'Daily satellite view', cadence: 'daily', lookback: 4, alpha: 0.6, blend: { minFactor: 0.3, from: 30e3, to: 700e3, nightAlpha: 0.3 },
    schedule: 'One true-colour composite per day; the newest one is usually 1–2 days old.',
    resolution: '~250–375 m', note: 'True colour as the satellite saw it that day, so clouds are real. Swaths have gaps near the equator.',
    candidates: [
      ['VIIRS_NOAA20_CorrectedReflectance_TrueColor', 9, 'jpg'],
      ['VIIRS_SNPP_CorrectedReflectance_TrueColor', 9, 'jpg'],
      ['MODIS_Terra_CorrectedReflectance_TrueColor', 9, 'jpg'],
    ],
  },
  weather: {
    label: 'Weather', name: 'Precipitation rate (IMERG)', cadence: 'half-hourly', lookback: 12, alpha: 0.75, blend: { minFactor: 0.55, from: 20e3, to: 400e3 },
    schedule: 'A new rain-rate estimate every 30 minutes, published about 3–4 hours after it was observed.',
    resolution: '~10 km', note: 'NASA GPM IMERG early run: satellite-estimated rain and snow rate, published a few hours after the fact.',
    candidates: [
      ['IMERG_Precipitation_Rate', 6, 'png'],
      ['IMERG_Precipitation_Rate_30min', 6, 'png'],
      ['IMERG_Precipitation_Rate', 7, 'png'],
    ],
  },
  fires: {
    label: 'Fires', name: 'Active fires and thermal anomalies', cadence: 'daily', lookback: 3, alpha: 1, group: 'eo',
    schedule: 'Detections are grouped by day; the newest day available is usually yesterday.',
    sparse: true, probe: [3, 4, 3],                         // Africa/Middle East: some detections nearly every day
    resolution: '375 m detections', note: 'Satellite thermal anomalies. A detection is a hot pixel, not a confirmed fire. Each is only a pixel or two wide: zoom in to a region to see them.',
    candidates: [
      ['VIIRS_NOAA20_Thermal_Anomalies_375m_All', 8, 'png'],
      ['VIIRS_SNPP_Thermal_Anomalies_375m_All', 8, 'png'],
      ['MODIS_Terra_Thermal_Anomalies_All', 7, 'png'],
      ['MODIS_Aqua_Thermal_Anomalies_All', 7, 'png'],
    ],
  },
  vegetation: {
    label: 'Vegetation', name: 'Vegetation index (NDVI)', cadence: '8-day composite', lookback: 20, alpha: 0.5, group: 'eo', blend: { minFactor: 0.5, from: 30e3, to: 500e3, nightAlpha: 0.5 }, saturation: 0.85,
    schedule: 'One vegetation composite per 8-day period, so it can be a week or more old.',
    resolution: '~250 m', note: 'MODIS NDVI: greener means denser, healthier vegetation.',
    candidates: [
      ['MODIS_Terra_NDVI_8Day', 9, 'png'],
      ['MODIS_Aqua_NDVI_8Day', 9, 'png'],
      ['MODIS_Terra_L3_NDVI_16Day', 9, 'png'],
    ],
  },
  nightLights: {
    label: 'Night lights', name: 'Night-time lights (VIIRS Day/Night Band)', cadence: 'daily', lookback: 4, alpha: 0.9, group: 'eo', blend: { minFactor: 0.6, from: 30e3, to: 500e3 },
    schedule: 'One observation per night; the newest is usually 1–2 days old.',
    resolution: '~750 m', note: 'Light at night as observed that night; moonlit clouds also appear.',
    candidates: [
      ['VIIRS_SNPP_DayNightBand_ENCC', 8, 'png'],
      ['VIIRS_NOAA20_DayNightBand_ENCC', 8, 'png'],
      ['VIIRS_SNPP_DayNightBand_At_Sensor_Radiance', 8, 'png'],
    ],
  },
};

export const gibsUrl = (id, level, ext, time) => `${GIBS}/${id}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`;

function times(cadence, lookback, now = new Date()) {
  const out = [];
  if (cadence === 'half-hourly') {
    const t = new Date(now.getTime() - 3 * 3600e3);            // early-run IMERG lags a few hours
    t.setUTCSeconds(0, 0); t.setUTCMinutes(t.getUTCMinutes() < 30 ? 0 : 30);
    for (let i = 0; i < lookback; i++) out.push(new Date(t.getTime() - i * 1800e3).toISOString().replace('.000', ''));
  } else {
    for (let i = 1; i <= lookback; i++) out.push(new Date(now.getTime() - i * 86400e3).toISOString().slice(0, 10));
  }
  return out;
}

async function tileExists(url, minBytes = 300) {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return false;
    const size = (await res.blob()).size;
    return size > minBytes;                                     // GIBS answers missing days with a tiny empty tile
  } catch { return false; }
}

/**
 * Find the newest time and the first working identifier for an overlay by requesting one
 * low-zoom tile per attempt. Resolves to { id, level, ext, time } or null.
 */
export async function resolveOverlay(key, signal) {
  const o = OVERLAYS[key];
  const [pz, px, py] = o.probe || [1, 0, 0];
  // Sparse layers (fires) are mostly transparent, so a small tile is normal: they get a second,
  // size-blind pass, which still needs a real image answer from NASA for that date.
  for (const minBytes of o.sparse ? [300, 0] : [300]) {
    for (const time of times(o.cadence, o.lookback)) {
      if (signal?.aborted) return null;
      // Candidates for one time are probed together; the first in list order that answers wins.
      const ok = await Promise.all(o.candidates.map(([id, level, ext]) =>
        tileExists(gibsUrl(id, level, ext, time).replace('{z}', pz).replace('{y}', py).replace('{x}', px), minBytes)));
      const i = ok.indexOf(true);
      if (i >= 0) { const [id, level, ext] = o.candidates[i]; return { id, level, ext, time }; }
    }
  }
  return null;
}

export { describeAge } from './freshness.js';
