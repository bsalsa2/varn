# Earth imagery

- `blue-marble-4k.webp`, `blue-marble-2k.webp`: NASA Blue Marble composite (NASA Visible Earth), public domain.
- `night-lights-2k.webp`: city lights extracted from NASA's Earth at Night composite (NASA Visible Earth), public domain.
  Only the warm city-light signal is kept; the image is otherwise black.
- `night-lights-warm-2k.webp`: the city-light image above, tinted warm for the globe's night side.

The source JPEGs were taken from the `example/img` folder of the MIT-licensed `three-globe` npm package
(v2.45.6), which redistributes the NASA images, then re-encoded to WebP. NASA imagery is not an
endorsement by NASA.

These local files are the fallback base layer and night lights of the 3D Earth (and the Sky view's
descent). The primary imagery is streamed from the providers listed in platform/README.md.
