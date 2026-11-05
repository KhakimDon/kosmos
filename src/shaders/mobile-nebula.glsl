precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @label Offset X (design px)
 *  @range 0, 1440
 *  @default 0 */
uniform float u_ox;
/** @time */
uniform float u_time;

/** @label Design width
 *  @range 100, 4000
 *  @default 1440 */
uniform float u_w;
/** @label Design height
 *  @range 100, 4000
 *  @default 1200 */
uniform float u_h;
/** @label Base
 *  @color
 *  @default #030409 */
uniform vec3 u_base;
/** @label Midnight
 *  @color
 *  @default #0A1230 */
uniform vec3 u_mid;
/** @label Nebula
 *  @color
 *  @default #3A2470 */
uniform vec3 u_neb;
/** @label Violet
 *  @color
 *  @default #6B4CFF */
uniform vec3 u_vio;
/** @label Cyan
 *  @color
 *  @default #7FD8FF */
uniform vec3 u_cyan;
/** @label Brightness
 *  @range 0, 4
 *  @default 1.0 */
uniform float u_bright;
/** @label Stars
 *  @range 0, 2
 *  @default 1.0 */
uniform float u_stars;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }

// ---- shared dust lane (same code in unknown-occlude.glsl) ----
// q in design px, y from top. returns 0..1 opacity of the lane, and rim in .y
vec2 lane(vec2 q){
  float x = q.x / 1440.0;
  float yc = 545.0 + (x - 0.5) * 190.0 + 38.0 * sin(x * 5.0 + 0.4);
  float e = fbm(q * 0.006 + vec2(3.1, 7.7));
  float e2 = fbm(q * 0.021 + vec2(9.0, 1.3));
  float d = (q.y - yc) + (e - 0.5) * 170.0 + (e2 - 0.5) * 60.0;
  float wTop = 60.0 + 26.0 * sin(x * 6.0 + 1.0);
  float wBot = 85.0 + 40.0 * cos(x * 3.3 + 0.5);
  float w = d < 0.0 ? wTop : wBot;
  float a = (1.0 - ss(w * 0.25, w, abs(d))) * (0.75 + 0.25 * ss(0.3, 0.6, e2));
  // ragged dark tendrils hanging below
  float tend = ss(0.55, 0.72, e2) * (1.0 - ss(0.0, 150.0, d - w * 0.5)) * step(0.0, d);
  a = max(a, tend * 0.85);
  // rim: the light-facing (upper) edge of the lane, back-lit
  float rim = exp(-pow((d + wTop * 0.9) / 16.0, 2.0)) * ss(0.35, 0.7, e2);
  return vec2(clamp(a, 0.0, 1.0), rim);
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 uv = fc / u_res;
  vec2 q = uv * vec2(u_w, u_h) + vec2(u_ox, 0.0);          // design px, y down
  vec2 p = q / 1440.0;

  // luminous core: upper right, behind the lane
  vec2 c1 = vec2(0.70, 0.30);
  vec2 c2 = vec2(0.30, 0.20);
  float glow = exp(-dot((p - c1) * vec2(1.0, 1.6), (p - c1) * vec2(1.0, 1.6)) * 5.0);
  float glow2 = exp(-dot((p - c2) * vec2(1.0, 1.8), (p - c2) * vec2(1.0, 1.8)) * 9.0) * 0.55;

  vec2 c3 = vec2(0.84, 0.70);
  float glow3 = exp(-dot((p - c3) * vec2(1.0, 1.5), (p - c3) * vec2(1.0, 1.5)) * 14.0) * 0.45;

  vec2 sp = p * 3.2;
  vec2 w = vec2(fbm(sp + vec2(0.0, 2.0)), fbm(sp + vec2(5.2, 1.3)));
  float n  = fbm(sp * 1.2 + w * 1.8);
  float n2 = fbm(sp * 2.4 - w * 1.1 + 11.0);

  float mass = pow(n, 2.4) * 2.8;
  mass *= 0.78 + 0.44 * noise(p * 46.0 + w * 6.0);
  // midnight dominates; violet only where gas is densest; brightest core desaturates toward silver-white
  vec3 gas = mix(u_mid * 1.7, u_neb, ss(0.55, 0.92, n));
  gas = mix(gas, mix(u_mid, u_cyan, 0.18) * 1.4, ss(0.5, 0.8, n2) * 0.45);
  gas = mix(gas, u_vio * 0.5, ss(0.78, 0.98, n) * 0.25);
  vec3 neb = gas * mass * (glow * 1.5 + glow2 + 0.10) + mix(u_mid * 1.8, u_cyan * 0.35, ss(0.5, 0.8, n2)) * mass * glow3;
  neb += vec3(0.62, 0.74, 0.86) * pow(glow, 4.0) * pow(n, 3.5) * 1.3;

  // cyan-lit filaments: thin, broken, gated by density and a breakup mask
  float fil = fbm(p * 9.0 + w * 2.5 + 40.0);
  float ridge = pow(max(0.0, 1.0 - abs(fil - 0.5) * 9.0), 6.0);
  float brk = ss(0.45, 0.70, fbm(p * 4.0 + 70.0));
  neb += u_cyan * ridge * brk * ss(0.35, 0.7, n) * (glow * 0.45 + glow2 * 0.2 + glow3 * 0.6);

  // far dust (soft, mid-scale) carving holes for depth
  float fd = ss(0.48, 0.72, fbm(sp * 1.7 + w * 2.2 + 30.0));
  neb *= 1.0 - fd * 0.75;

  // stars: sparse, mostly hidden by gas density
  vec3 st = vec3(0.0);
  vec2 cq = q / 9.0; vec2 id = floor(cq); vec2 f = fract(cq);
  float h = hash12(id + 17.0);
  if (h < 0.06) {
    vec2 pos = hash22(id + 3.0) * 0.7 + 0.15;
    float dd = length(f - pos) * 9.0;
    float b = pow(hash12(id + 41.0), 5.0);
    st = mix(vec3(1.0, 0.86, 0.7), vec3(0.75, 0.86, 1.0), hash12(id + 7.0)) * exp(-dd * dd / (0.35 + b * 1.6)) * (0.12 + b * 1.4);
  }
  st *= u_stars * (1.0 - fd) * (0.35 + glow);
  st *= 1.0 - ss(0.5, 0.75, uv.y);

  vec3 col = u_base + neb * u_bright + st;

  // the dust lane: foreground canyon
  vec2 L = lane(q);
  vec3 laneCol = u_base * 0.55 + col * 0.05;
  col = mix(col, laneCol, L.x * 0.97);
  col += mix(u_cyan, vec3(0.9), 0.4) * L.y * 0.3 * (glow * 1.4 + 0.15);

  // foreground: bottom gets darker, silhouetted dust
  float fg = ss(0.62, 1.0, uv.y) * (1.0 - ss(0.0, 1.0, glow3 * 2.5));
  float fgn = ss(0.4, 0.65, fbm(p * 2.0 + vec2(20.0, 4.0)));
  col *= 1.0 - fg * (0.55 + 0.4 * fgn);

  // vignette + tonemap
  float vig = 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.0, 0.9)) * 1.3, 2.4);
  col *= clamp(vig, 0.0, 1.0);
  col = 1.0 - exp(-col * 1.25);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
