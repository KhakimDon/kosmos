precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Width (design px)
 *  @range 100, 3000
 *  @default 1440 */
uniform float u_w;
/** @label Origin X (design px)
 *  @range -2000, 3000
 *  @default 640 */
uniform float u_ox;
/** @label Origin Y (design px from top)
 *  @range -2000, 3000
 *  @default 450 */
uniform float u_oy;
/** @label Plane flattening
 *  @range 0.1, 1
 *  @default 0.56 */
uniform float u_flat;
/** @label Haze radius
 *  @range 10, 2000
 *  @default 420 */
uniform float u_hr;
/** @label Haze amount
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_haze;
/** @label Origin glow
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_glow;
/** @label Vignette
 *  @range 0, 2
 *  @default 0.7 */
uniform float u_vig;
/** @label Haze color
 *  @color
 *  @default #3A2470 */
uniform vec3 u_hc;
/** @label Haze color outer
 *  @color
 *  @default #0B1A3A */
uniform vec3 u_hc2;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 q = fc / u_res.x * u_w;               // design px, y down
  vec2 d = q - vec2(u_ox, u_oy);
  vec2 e = vec2(d.x, d.y / u_flat);          // into the orbital plane
  float r = length(e);
  float ang = atan(e.y, e.x);

  vec3 col = vec3(0.012, 0.016, 0.035);

  // orbital plane haze: dense near the origin, thinning outward, swept slightly along the spiral
  vec2 sw = vec2(ang * 1.3 + log(r + 30.0) * 2.2, log(r + 30.0) * 3.0);
  float n = fbm(sw * 1.4 + vec2(3.1, 7.7));
  float n2 = fbm(q / 260.0 + 11.0);
  float fall = exp(-r / u_hr);
  float haze = fall * (0.35 + 0.9 * ss(0.35, 0.8, n)) * (0.7 + 0.5 * n2);
  vec3 hz = mix(u_hc, u_hc2, ss(0.0, 1.2 * u_hr, r));
  col += hz * haze * u_haze * 0.55;

  // origin: tiny hot core + soft halo, flattened halo along the plane
  float dc = length(d);
  float core = exp(-dc * dc / 18.0);
  float halo = 1.0 / (1.0 + pow(dc / 38.0, 2.0));
  float planeHalo = 1.0 / (1.0 + pow(r / 110.0, 2.0)) * exp(-abs(d.y) / 60.0);
  vec3 warm = vec3(1.0, 0.93, 0.80);
  col += warm * (core * 1.4 + halo * 0.10 + planeHalo * 0.05) * u_glow;

  // vignette
  vec2 uv = fc / u_res;
  float vig = 1.0 - u_vig * pow(length((uv - 0.5) * vec2(1.0, 0.9)) * 1.3, 2.4);
  col *= clamp(vig, 0.0, 1.0);
  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
