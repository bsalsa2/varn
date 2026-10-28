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
  googleKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
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
    label: 'Clouds', name: 'Daily satellite view', cadence: 'daily', lookback: 4, alpha: 0.55,
    resolution: '~250–375 m', note: 'True colour as the satellite saw it that day, so clouds are real. Swaths have gaps near the equator.',
    candidates: [
      ['VIIRS_NOAA20_CorrectedReflectance_TrueColor', 9, 'jpg'],
      ['VIIRS_SNPP_CorrectedReflectance_TrueColor', 9, 'jpg'],
      ['MODIS_Terra_CorrectedReflectance_TrueColor', 9, 'jpg'],
    ],
  },
  weather: {
    label: 'Weather', name: 'Precipitation rate (IMERG)', cadence: 'half-hourly', lookback: 12, alpha: 0.85,
    resolution: '~10 km', note: 'NASA GPM IMERG early run: satellite-estimated rain and snow rate, published a few hours after the fact.',
    candidates: [
      ['IMERG_Precipitation_Rate', 6, 'png'],
      ['IMERG_Precipitation_Rate_30min', 6, 'png'],
      ['IMERG_Precipitation_Rate', 7, 'png'],
    ],
  },
  fires: {
    label: 'Fires', name: 'Active fires and thermal anomalies', cadence: 'daily', lookback: 3, alpha: 1, group: 'eo',
    resolution: '375 m detections', note: 'VIIRS thermal anomalies. A detection is a hot pixel, not a confirmed fire.',
    candidates: [
      ['VIIRS_NOAA20_Thermal_Anomalies_375m_All', 8, 'png'],
      ['VIIRS_SNPP_Thermal_Anomalies_375m_All', 8, 'png'],
      ['MODIS_Combined_Thermal_Anomalies_All', 8, 'png'],
    ],
  },
  vegetation: {
    label: 'Vegetation', name: 'Vegetation index (NDVI)', cadence: '8-day composite', lookback: 20, alpha: 0.75, group: 'eo',
    resolution: '~250 m', note: 'MODIS NDVI: greener means denser, healthier vegetation.',
    candidates: [
      ['MODIS_Terra_NDVI_8Day', 9, 'png'],
      ['MODIS_Aqua_NDVI_8Day', 9, 'png'],
      ['MODIS_Terra_L3_NDVI_16Day', 9, 'png'],
    ],
  },
  nightLights: {
    label: 'Night lights', name: 'Night-time lights (VIIRS Day/Night Band)', cadence: 'daily', lookback: 4, alpha: 0.9, group: 'eo',
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

async function tileExists(url) {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return false;
    const size = (await res.blob()).size;
    return size > 300;                                          // GIBS answers missing days with a tiny empty tile
  } catch { return false; }
}

/**
 * Find the newest time and the first working identifier for an overlay by requesting one
 * low-zoom tile per attempt. Resolves to { id, level, ext, time } or null.
 */
export async function resolveOverlay(key, signal) {
  const o = OVERLAYS[key];
  for (const time of times(o.cadence, o.lookback)) {
    if (signal?.aborted) return null;
    // Candidates for one time are probed together; the first in list order that answers wins.
    const ok = await Promise.all(o.candidates.map(([id, level, ext]) =>
      tileExists(gibsUrl(id, level, ext, time).replace('{z}', '1').replace('{y}', '0').replace('{x}', '0'))));
    const i = ok.indexOf(true);
    if (i >= 0) { const [id, level, ext] = o.candidates[i]; return { id, level, ext, time }; }
  }
  return null;
}
