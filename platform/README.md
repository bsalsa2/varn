# VARN Systems Platform

A separate Operations Command Center frontend for VARN. The existing public landing page in `web/` is intentionally untouched.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Current implementation

The Command Center is one floating glass window over a WebGL render of Earth (`src/earth/`):

- Imagery: NASA Blue Marble and Earth at Night composites, public domain (see `public/earth/CREDITS.md`).
  Rendered by a single fragment shader; no 3D library. Sun position is computed for the current UTC time
  (`src/earth/sun.js`); the view is a slow camera drift. Nothing on the planet is live data.
- The workspace pane is clear on Overview and frosts over on other pages. Rows open an inspector that shows
  the exact lines of the evidence file a number came from (`evidence/*.md`, imported raw).
- Models and Datasets are read from the reports (`src/records.js`); there is no registry yet.
- ⌘K / Ctrl K opens a command menu; keys 1–6 switch pages; Esc closes panels.
- Falls back to a static still when WebGL 2 is unavailable, and to a plain dark background if imagery fails.
  `prefers-reduced-motion` stops the drift, parallax and entrance animations.

- Responsive operations dashboard with working section navigation.
- Basic API health check against `https://varn-api.varnlabs.workers.dev/health`.
- Explicit empty states for models, experiments, datasets, activity, and unconfigured services.
- No fabricated telemetry, model records, or historical events.
- Results page shows evaluation numbers hand-copied from Kaggle reports. Every value comes from a file in `evidence/`; nothing is fetched or computed.
- Reduced-motion support and responsive mobile navigation.

## Not implemented yet

Authentication, persistence, model registration, evaluation ingestion, dataset management, and operational telemetry are not implemented. The API currently exposes only basic service status. Do not put private data or credentials into this public prototype.

## Cloudflare Pages deployment

Create a separate Pages project connected to this repository. Set the project root directory to `platform`, build command to `npm run build`, and output directory to `dist`. This does not require changing the existing landing-page deployment configuration. Check current account limits before creating resources; do not add a payment method or enable paid services.
