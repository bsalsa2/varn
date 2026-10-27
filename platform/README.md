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

- Responsive operations dashboard with working section navigation.
- Basic API health check against `https://varn-api.varnlabs.workers.dev/health`.
- Explicit empty states for models, experiments, datasets, activity, and unconfigured services.
- No fabricated telemetry, evaluation metrics, model records, or historical events.
- Reduced-motion support and responsive mobile navigation.

## Not implemented yet

Authentication, persistence, model registration, evaluation ingestion, dataset management, and operational telemetry are not implemented. The API currently exposes only basic service status. Do not put private data or credentials into this public prototype.

## Cloudflare Pages deployment

Create a separate Pages project connected to this repository. Set the project root directory to `platform`, build command to `npm run build`, and output directory to `dist`. This does not require changing the existing landing-page deployment configuration. Check current account limits before creating resources; do not add a payment method or enable paid services.
