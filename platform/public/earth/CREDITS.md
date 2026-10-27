# Earth imagery

- `blue-marble-4k.webp`, `blue-marble-2k.webp`: NASA Blue Marble composite (NASA Visible Earth), public domain.
- `night-lights-2k.webp`: city lights extracted from NASA's Earth at Night composite (NASA Visible Earth), public domain.
  Only the warm city-light signal is kept; the image is otherwise black.
- `poster.webp`: a still of this app's own WebGL render, used when WebGL 2 is unavailable.

The source JPEGs were taken from the `example/img` folder of the MIT-licensed `three-globe` npm package
(v2.45.6), which redistributes the NASA images, then re-encoded to WebP. NASA imagery is not an
endorsement by NASA.

Nothing here is live. The app computes only the sun's position for the current time; the view is a
slow camera drift over static composites.
