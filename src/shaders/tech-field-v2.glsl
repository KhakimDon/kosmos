precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

/** @resolution */
uniform vec2 u_res;

/** @label Base
 *  @color
 *  @default #030409 */
uniform vec3 u_base;

/** @label Lift
 *  @color
 *  @default #070B1C */
uniform vec3 u_lift;

/** @label Grain
 *  @range 0, 0.1
 *  @default 0.025 */
uniform float u_grain;

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  // light leaks in from the Origin side (top), a very soft midnight lift
  float lift = ss(0.25, 1.0, uv.y) * 0.85;
  // a broad, low band behind the main plate (middle third)
  float bq = (uv.y - 0.55) / 0.22;
  float band = exp(-bq * bq) * 0.55;
  vec3 col = mix(u_base, u_lift, clamp(lift * 0.6 + band, 0.0, 1.0));
  // side vignette
  float vx = ss(0.0, 0.35, uv.x) * ss(1.0, 0.65, uv.x);
  col *= 0.82 + 0.18 * vx;
  // fine photographic grain
  float g = hash(floor(gl_FragCoord.xy)) - 0.5;
  col += g * u_grain;
  gl_FragColor = vec4(col, 1.0);
}
