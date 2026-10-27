// Full-screen fragment shader that renders the planet analytically: every pixel is projected
// onto a unit sphere (orthographic, like a long-lens photo from orbit), converted to latitude
// and longitude, and sampled from the NASA Blue Marble texture. No meshes, no 3D library.
export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform sampler2D uDay;
uniform sampler2D uLights;
uniform vec2  uRes;       // drawing-buffer size, px
uniform vec2  uCenter;    // planet centre, drawing-buffer px (origin bottom-left)
uniform float uRadius;    // planet radius, drawing-buffer px
uniform vec2  uView;      // view centre (lat, lon), radians
uniform float uRoll;      // camera roll, radians
uniform vec3  uSun;       // unit vector to the sun, Earth-fixed frame
uniform float uDim;       // 0 = full brightness, 1 = receded behind the workspace
uniform float uGrid;      // graticule opacity
uniform float uReveal;    // 0..1 fade-in once imagery is loaded

const float PI = 3.141592653589793;

vec3 ecef(float lat, float lon) { return vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)); }

float gridLine(float coord, float step) {
  float f = coord / step;
  float w = fwidth(f);
  float d = abs(fract(f + 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, w * 1.2, d);
}

vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 0.86);                 // a little less saturated than the raw composite
  c *= vec3(0.96, 0.99, 1.04);               // pulled toward VARN's cool steel
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 q = (frag - uCenter) / uRadius;
  float cr = cos(uRoll), sr = sin(uRoll);
  q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y);
  float d = length(q);
  float aa = 1.5 / uRadius;

  float lat0 = uView.x, lon0 = uView.y;
  vec3 f = ecef(lat0, lon0);
  vec3 e = vec3(-sin(lon0), cos(lon0), 0.0);
  vec3 n = vec3(-sin(lat0) * cos(lon0), -sin(lat0) * sin(lon0), cos(lat0));

  // Space: VARN charcoal with a faint falloff toward the planet, no invented stars.
  vec2 uv = frag / uRes;
  vec3 space = mix(vec3(0.027, 0.035, 0.047), vec3(0.043, 0.059, 0.078), smoothstep(1.0, 0.0, uv.y) * 0.6);
  vec3 col = space;

  // Atmosphere halo outside the limb, lit only where the sun reaches it.
  vec3 limbDir = normalize(q.x * e + q.y * n + 1e-5 * f);
  float limbLight = smoothstep(-0.35, 0.45, dot(limbDir, uSun));
  float haloT = max(d - 1.0, 0.0);
  float halo = exp(-haloT * 34.0) * 0.85 + exp(-haloT * 7.0) * 0.16;
  vec3 atmo = vec3(0.36, 0.58, 0.98);
  col += atmo * halo * (0.12 + limbLight) * step(1.0, d) * uReveal;

  if (d < 1.0 + aa) {
    float z = sqrt(max(0.0, 1.0 - min(d * d, 1.0)));
    vec3 p = normalize(q.x * e + q.y * n + z * f);
    float lat = asin(clamp(p.z, -1.0, 1.0));
    float lon = atan(p.y, p.x);

    // Texture coords with seam-safe gradients (the longitude wraps at the date line).
    vec2 tc = vec2((lon + PI) / (2.0 * PI), (PI * 0.5 - lat) / PI);
    vec2 tcAlt = vec2(fract(tc.x + 0.5), tc.y);
    vec2 dx = dFdx(tc), dy = dFdy(tc);
    vec2 dxA = dFdx(tcAlt), dyA = dFdy(tcAlt);
    if (abs(dxA.x) + abs(dyA.x) < abs(dx.x) + abs(dy.x)) { dx.x = dxA.x; dy.x = dyA.x; }
    vec3 day = textureGrad(uDay, tc, dx, dy).rgb;
    float lights = textureGrad(uLights, tc, dx, dy).r;

    day = pow(day, vec3(1.08));
    float ndl = dot(p, uSun);
    float dayMix = smoothstep(-0.10, 0.16, ndl);
    float diffuse = clamp(ndl * 0.9 + 0.22, 0.0, 1.0);

    // Ocean glint: the Blue Marble oceans are the blue-dominant pixels.
    float water = smoothstep(0.03, 0.14, day.b - max(day.r, day.g));
    vec3 h = normalize(uSun + f);
    float spec = pow(max(dot(p, h), 0.0), 90.0) * water * 0.55 + pow(max(dot(p, h), 0.0), 12.0) * water * 0.05;

    vec3 lit = grade(day) * diffuse * 1.42 + vec3(1.0, 0.95, 0.86) * spec * dayMix;
    vec3 night = vec3(1.0, 0.78, 0.48) * pow(lights, 1.4) * 1.6 + grade(day) * 0.018;
    vec3 surface = mix(night, lit, dayMix);

    // Twilight band picks up a little warmth before it falls into night.
    float dusk = exp(-pow(ndl / 0.09, 2.0));
    surface += vec3(0.32, 0.17, 0.08) * dusk * 0.10;

    // Atmospheric thickness toward the limb.
    float rim = pow(1.0 - z, 2.4);
    surface = mix(surface, atmo * (0.18 + 0.82 * dayMix), rim * 0.55 * (0.25 + 0.75 * dayMix));
    surface += atmo * pow(1.0 - z, 6.0) * 0.35 * dayMix;

    // Graticule every 15°; fades on the night side and toward the limb.
    // (The date line is itself a 15° meridian, so the atan wrap there just lands on a line.)
    float g = max(gridLine(lat * 180.0 / PI, 15.0), gridLine(lon * 180.0 / PI, 15.0));
    surface = mix(surface, vec3(0.80, 0.86, 0.90), g * uGrid * (0.35 + 0.65 * dayMix) * z);

    float edge = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
    col = mix(col, surface, edge * uReveal);
  }

  // Recede when the workspace takes focus; keep the planet legible but quiet.
  col *= mix(1.0, 0.42, uDim);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l) * vec3(0.92, 0.97, 1.05), uDim * 0.35);

  // Filmic shoulder and a fine dither to keep the dark gradients from banding.
  col = col / (1.0 + col * 0.18);
  float dither = fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453) / 255.0;
  outColor = vec4(pow(col, vec3(1.0 / 1.06)) + dither, 1.0);
}`;
