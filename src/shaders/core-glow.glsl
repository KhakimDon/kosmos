precision mediump float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Void
 *  @color
 *  @default #030409 */
uniform vec3 u_void;

/** @label Midnight
 *  @color
 *  @default #070B1C */
uniform vec3 u_mid;

/** @label Glow
 *  @color
 *  @default #7FD8FF */
uniform vec3 u_glow;

/** @label Haze
 *  @color
 *  @default #3A2470 */
uniform vec3 u_haze;

/** @label Centre X (0..1)
 *  @range 0, 1
 *  @default 0.5 */
uniform float u_cx;

/** @label Centre Y (0..1 from top)
 *  @range 0, 1
 *  @default 0.5 */
uniform float u_cy;

/** @label Glow radius (px)
 *  @range 50, 1200
 *  @default 420 */
uniform float u_rad;

/** @label Glow strength
 *  @range 0, 2
 *  @default 0.55 */
uniform float u_amt;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int k = 0; k < 3; k++){ v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  // centre in device px (y from top -> flip)
  vec2 c = vec2(u_cx * u_res.x, (1.0 - u_cy) * u_res.y);
  // scale radius relative to a 1440-wide frame so it works at any device scale
  float k = u_res.x / 1440.0;
  vec2 d = (frag - c) / (u_rad * k);
  float r = length(d);

  // base: void with a whisper of midnight towards the centre
  vec3 col = mix(u_mid, u_void, ss(0.2, 2.6, r));

  // volumetric glow: soft core + long falloff, gently broken by slow noise
  vec2 q = d * 1.4;
  float n = fbm(q + vec2(3.1, 7.4));
  vec2 dir = d / (r + 1e-4);
  float streak = 0.75 + 0.25 * vnoise(dir * 2.5 + vec2(r * 1.5 + 2.0));
  float core = exp(-r * r * 40.0);
  float body = exp(-r * r * 4.0);
  float halo = exp(-r * 2.6) * (0.5 + 0.5 * n) * streak;
  float g = (core * 1.1 + body * 0.1 + halo * 0.24) * u_amt;
  col += u_glow * g * 0.5;

  // faint violet haze, offset low-left, very quiet
  vec2 hd = d - vec2(-0.9, -0.7);
  float haze = exp(-dot(hd, hd) * 0.55) * (0.4 + 0.6 * fbm(hd * 0.9 + 4.0));
  col += u_haze * haze * 0.16;

  // vignette
  vec2 uv = frag / u_res;
  float vig = ss(0.95, 0.35, length((uv - 0.5) * vec2(1.0, 1.2)));
  col *= mix(0.55, 1.0, vig);

  // dither against banding
  col += (hash(frag) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
