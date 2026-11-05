precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float x){ return fract(sin(x * 127.1) * 43758.5453); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;
/** @label Redshift z (Doppler)
 *  @range -0.02, 0.02
 *  @default 0.0 */
uniform float u_z;
/** @label Reveal (slit scan)
 *  @range 0, 1
 *  @default 1.0 */
uniform float u_reveal;
/** @label Shimmer
 *  @range 0, 1
 *  @default 1.0 */
uniform float u_shimmer;

/** @label Blue end
 *  @color
 *  @default #7FD8FF */
uniform vec3 u_c1;

/** @label Violet end
 *  @color
 *  @default #6B4CFF */
uniform vec3 u_c2;

/** @label Deep
 *  @color
 *  @default #070B1C */
uniform vec3 u_deep;

/** @label Brightness
 *  @range 0, 1.5
 *  @default 0.5 */
uniform float u_bright;

float line(float x, float c, float w, float d){ float t = (x - c) / w; return d * exp(-t * t); }

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float xo = uv.x;
  // Doppler: observed wavelength = rest * (1 + z); sample the rest-frame spectrum
  float lam = 3800.0 + 3200.0 * xo;
  float x = (lam / (1.0 + u_z) - 3800.0) / 3200.0;
  // continuum: cyan -> deep midnight -> violet, restrained
  vec3 col = mix(u_c1, u_c2, ss(0.05, 0.95, xo));
  float cq = (xo - 0.38) / 0.5;
  float cont = 0.35 + 0.65 * exp(-cq * cq);
  col = mix(col, vec3(dot(col, vec3(0.333))), 0.3);
  col = mix(u_deep, col, cont * u_bright);
  // absorption lines (same positions as the vector profile above it)
  float a = 0.0;
  a += line(x, 0.118, 0.0035, 0.92);
  a += line(x, 0.205, 0.0022, 0.70);
  a += line(x, 0.262, 0.0060, 0.95);
  a += line(x, 0.331, 0.0018, 0.55);
  a += line(x, 0.407, 0.0028, 0.80);
  a += line(x, 0.468, 0.0016, 0.45);
  a += line(x, 0.553, 0.0045, 0.90);
  a += line(x, 0.566, 0.0020, 0.60);
  a += line(x, 0.648, 0.0018, 0.50);
  a += line(x, 0.741, 0.0070, 0.97);
  a += line(x, 0.812, 0.0020, 0.55);
  a += line(x, 0.889, 0.0030, 0.75);
  // faint forest of weak lines
  float cell = floor(x * 260.0);
  float fx = fract(x * 260.0) - 0.5;
  float r = hash1(cell);
  a += step(0.62, r) * (r - 0.62) * 0.9 * exp(-(fx * fx) / 0.0144);
  // atmospheric scintillation: slow travelling brightness waves + photon shot noise
  float sc = 0.5 + 0.5 * sin(xo * 23.0 - u_time * 1.7) * sin(xo * 7.0 + u_time * 0.9 + uv.y * 2.0);
  col *= 1.0 + u_shimmer * (0.10 * (sc - 0.5) + 0.06 * sin(u_time * 3.1 + xo * 61.0) * sin(u_time * 2.3));
  col *= 1.0 - clamp(a, 0.0, 0.97);
  // line cores tremble very slightly (seeing)
  col += u_shimmer * (hash(vec2(floor(xo * 712.0), floor(u_time * 18.0))) - 0.5) * 0.035 * cont;
  // photographic plate: soft top/bottom falloff of the slit
  float slit = ss(0.0, 0.18, uv.y) * ss(1.0, 0.82, uv.y);
  col = mix(u_deep * 0.6, col, 0.35 + 0.65 * slit);
  col += (hash(floor(gl_FragCoord.xy) + floor(u_time * 24.0)) - 0.5) * 0.03;
  // slit-scan reveal: dark ahead of the scan, a thin bright edge riding it
  float e = xo - u_reveal;
  col = mix(col, u_deep * 0.45, ss(-0.004, 0.004, e));
  col += vec3(0.85, 0.92, 1.0) * exp(-e * e / 0.000012) * 0.9 * step(u_reveal, 0.999);
  gl_FragColor = vec4(col, 1.0);
}
