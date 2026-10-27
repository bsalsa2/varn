# VARN Sky — design note

1. Purpose: answer three questions in 3 s — where the node points, what is in the sky, which tracks match a flight. Awareness only; nothing selects anything for action.
2. Stage: an all-sky polar dome (zenith centre, horizon rim, N up). The node's field of view is a soft sage cap; tracks are glyphs with fading comet trails.
3. Encoding is redundant (shape + tone + text): matched = filled bone disc, unmatched = fog ring, drone candidate = amber diamond (the only amber), unknown = sage square.
4. Plan view: seeded topographic contours (value noise + marching squares) with the node at centre. A passive sensor has no range, so tracks are drawn as bearings, not placed positions; rings are terrain scale only.
5. Glass: three floating panels (strap/headline, morphing list↔detail, timeline). Blur + saturate, SVG displacement at the edges (Chromium), 1px inner light, pointer specular, grain, depth shadow.
6. Legibility first: every glass panel carries a 78% charcoal scrim so bone and fog text clear WCAG AA over a pure-bone backdrop; ≥12px; tabular numerals.
7. Honesty: SIM and REAL never mix. SIM carries a permanent strap + canvas-drawn watermark (so screenshots include it) and "SIM" in every export. REAL reads public/data/sightings.json only; missing → empty state.
8. Data model: one track interface (`t0, t1, sample(t)`) for both modes; every number on screen derives from it at the current time.
9. Motion: one rAF loop drawing a single canvas; React re-renders at ~10 Hz for readouts. Pauses when hidden; drops refraction, grain and trail density if frames exceed 20 ms for 2 s.
10. Fallbacks: no backdrop-filter → frosted solid; reduced motion / transparency / more contrast → solid panels, no springs, no specular.

## REAL data format

`platform/public/data/sightings.json` (not committed): an array, or `{ "sightings": [...] }`, of rows
`{ id, time (ISO or epoch s), azimuth, elevation, label, match_status, match_reason?, callsign? }`.
Only those fields are read. Never commit real coordinates or footage.

## URL params (for screenshots and tests)

`#sky` plus `?seed=1729&t=150&paused&select=S-002&view=plan&mode=real&fps`.
