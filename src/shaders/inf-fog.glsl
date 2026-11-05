precision highp float;

// NOUMENA S06 — depth fog behind the infinite lattice.
// The lattice is a giant sphere whose upper limb crosses the frame.
// Space above is void; a thin haze hugs the limb; inside the sphere the
// fog thickens with depth (towards the lower part, the far shells).

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Frame width (px)
 *  @range 100, 4000
 *  @default 1440 */
uniform float u_w;
/** @label Frame height (px)
 *  @range 100, 4000
 *  @default 1300 */
uniform float u_h;
/** @label Center X (px)
 *  @range -2000, 4000
 *  @default 720 */
uniform float u_cx;
/** @label Center Y (px, from top)
 *  @range -2000, 6000
 *  @default 1650 */
uniform float u_cy;
/** @label Limb radius (px)
 *  @range 10, 6000
 *  @default 1250 */
uniform float u_r;
/** @label Void
 *  @color
 *  @default #030409 */
uniform vec3 u_void;
/** @label Midnight
 *  @color
 *  @default #070B1C */
uniform vec3 u_mid;
/** @label Nebula
 *  @color
 *  @default #3A2470 */
uniform vec3 u_neb;
/** @label Haze
 *  @color
 *  @default #AEB6C8 */
uniform vec3 u_haze;
/** @label Haze amount
 *  @range 0, 1
 *  @default 0.10 */
uniform float u_hazeAmt;
/** @label Fog amount
 *  @range 0, 1
 *  @default 0.35 */
uniform float u_fog;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * u_w, (1.0 - uv.y) * u_h);       // frame px, y down
  float d = length(p - vec2(u_cx, u_cy)) / u_r;         // 1.0 = limb

  // base: void above, midnight inside the sphere
  vec3 col = u_void;
  float inside = ss(1.02, 0.96, d);
  col = mix(col, u_mid, inside * 0.55);

  // fog inside thickens towards the depth (lower part / center of sphere)
  float depth = ss(1.0, 0.55, d);
  float n = fbm(p / 420.0);
  float fogMask = depth * (0.55 + 0.9 * n);
  col = mix(col, mix(u_mid, u_neb, 0.30), clamp(fogMask * u_fog, 0.0, 1.0));
  // the far side recedes: deeper part of the sphere sinks back to void
  col = mix(col, u_void, ss(0.75, 0.15, d) * 0.45);

  // thin haze hugging the limb, both sides, falling fast outside
  float above = max(d - 1.0, 0.0);
  float limb = exp(-above * 26.0) * ss(0.86, 1.0, d);
  limb *= 0.75 + 0.5 * fbm(p / 260.0 + 4.0);
  col += u_haze * limb * u_hazeAmt;

  // vignette
  vec2 q = uv - 0.5;
  col *= 1.0 - 0.35 * dot(q, q);

  // tiny dither against banding
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
