precision highp float;

// NOUMENA — X3 Motion storyboard miniatures.
// One shader, four transitions (u_scene 0..3), each sampled at progress u_t (0..1).

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Scene (0 hero>origin, 1 origin>unknown, 2 core>constellation, 3 future>portal)
 *  @range 0, 3
 *  @default 0 */
uniform float u_scene;

/** @label Progress
 *  @range 0, 1
 *  @default 0 */
uniform float u_t;

/** @label Seed
 *  @range 0, 100
 *  @default 3 */
uniform float u_seed;

const vec3 VOID = vec3(0.012, 0.016, 0.035);
const vec3 MID  = vec3(0.027, 0.043, 0.110);
const vec3 NEB  = vec3(0.227, 0.141, 0.439);
const vec3 VIO  = vec3(0.420, 0.298, 1.000);
const vec3 CYAN = vec3(0.498, 0.847, 1.000);
const vec3 SILV = vec3(0.682, 0.714, 0.784);
const vec3 WHT  = vec3(0.933, 0.945, 0.969);
const vec3 GOLD = vec3(0.910, 0.761, 0.478);

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }

// sparse point stars in design space q (pixels / scale)
float stars(vec2 q, float cell, float prob){
  vec2 id = floor(q/cell); vec2 f = q - id*cell;
  if (hash12(id + u_seed) > prob) return 0.0;
  vec2 pos = (hash22(id + u_seed*1.7)*0.8+0.1)*cell;
  float d = length(f - pos);
  float b = pow(hash12(id + u_seed*3.1), 5.0);
  float r = mix(0.5, 1.4, b);
  return exp(-d*d/(r*r*0.7)) * (0.15 + 1.1*b);
}

float ring(float d, float w){ return exp(-(d*d)/(w*w)); }

// ---------- A: Hero -> Origin -------------------------------------------
vec3 sceneA(vec2 p, vec2 q, float t){
  vec3 col = VOID + MID*0.35*(0.5 - p.y);
  col += WHT * stars(q, 18.0, 0.18) * 0.7;
  // planet: camera falls past it, so the limb rises and leaves through the top
  float R = 1.35;
  float limbY = mix(-0.30, 0.95, ss(0.0, 0.75, t));
  vec2 c = vec2(-0.25, limbY - R);
  float d = length(p - c) - R;
  float inside = 1.0 - ss(-0.002, 0.002, d);
  vec3 body = MID * 0.55 + NEB * 0.10 * ss(-0.6, 0.0, d);
  // night-side terminator texture, very faint
  body += SILV * 0.025 * fbm((p - c) * 7.0 + 3.0) * ss(-0.5, 0.0, d);
  col = mix(col, body, inside);
  // atmosphere: thin cyan-silver limb
  col += CYAN * 0.55 * ring(d, 0.006) + SILV * 0.10 * exp(-max(d, 0.0) * 28.0) * (1.0 - inside);
  // black hole emerges below as the planet clears
  float k = ss(0.35, 1.0, t);
  float wrapW = ss(0.72, 1.0, t);
  vec2 bh = vec2(0.0, mix(-0.55, -0.02, k));
  float rs = mix(0.015, 0.12, k);
  float r = length(p - bh);
  float shadow = 1.0 - ss(rs*0.96, rs*1.04, r);
  // photon ring: forms from the gold signal at the end
  float pr = rs * 1.5;
  col += WHT * 0.35 * ring(r - pr, 0.010) * k * (1.0 - 0.75*wrapW);
  col += VIO * 0.10 * exp(-max(r - pr, 0.0) * 14.0) * k;
  col = mix(col, VOID * 0.4, shadow);
  // gold signal: vertical hairline from the limb down to the singularity,
  // stretching, then wrapping into the photon ring
  float wrap = ss(0.72, 1.0, t);
  float topY = limbY - 0.02;
  float lineX = abs(p.x - bh.x);
  float onLine = ss(0.0075, 0.002, lineX) * step(bh.y + pr, p.y) * step(p.y, min(topY, 0.6));
  float lineFade = (1.0 - wrap) * ss(0.05, 0.25, t);
  col += GOLD * 0.85 * onLine * lineFade;
  // ring arc grows with wrap
  float ang = atan(p.x - bh.x, p.y - bh.y);           // 0 at top
  float arcOn = step(abs(ang), wrap * 3.1416 + 0.001);
  col += GOLD * 1.6 * ring(r - pr, 0.0055) * arcOn * wrap + GOLD * 0.12 * exp(-abs(r - pr) * 30.0) * wrap;
  return col;
}

// ---------- B: Origin -> Unknown ----------------------------------------
vec3 sceneB(vec2 p, vec2 q, float t){
  float relax = ss(0.0, 1.0, t);
  vec2 bh = vec2(0.0, 0.0);
  float rs = 0.13 * (1.0 - relax);
  vec2 dp = p - bh; float r = max(length(dp), 1e-3);
  // lensing: pull sample positions toward the hole (Einstein-ring style)
  float strength = rs * rs * 1.6;
  vec2 sp = p - dp / r * (strength / r);
  // nebula field sampled through the lens
  vec2 np = sp * 2.2 + vec2(u_seed * 0.37, 1.7);
  vec2 w = vec2(fbm(np + 2.0), fbm(np + vec2(5.2, 1.3)));
  float n = fbm(np * 1.2 + w * 1.6);
  float dens = mix(0.25, 1.0, relax);
  float lanes = ss(0.38, 0.7, fbm(np * 2.3 + w * 2.2 + 9.0));
  vec3 neb = mix(NEB * 0.8, MID * 1.6, ss(0.3, 0.75, w.y)) * pow(n, 3.0) * 3.4 * dens * (1.0 - 0.75 * lanes);
  float ridge = pow(max(0.0, 1.0 - abs(n - 0.58) * 6.0), 4.0);
  neb += CYAN * ridge * 0.22 * relax * (1.0 - lanes);
  vec3 col = VOID + neb;
  col += WHT * stars(sp * u_res.y / 0.9, 16.0, 0.16) * 0.6 * (1.0 - relax * 0.4);
  // photon ring + shadow fading out
  float pr = rs * 1.5;
  col += WHT * 0.45 * ring(r - pr, 0.008) * (1.0 - relax);
  float shadow = 1.0 - ss(rs * 0.96, rs * 1.04, r);
  col = mix(col, VOID * 0.3, shadow * (1.0 - relax * 0.8));
  return col;
}

// ---------- C: Core -> Constellation (backdrop; rings are vectors) -------
vec3 sceneC(vec2 p, vec2 q, float t){
  float k = ss(0.0, 1.0, t);
  float r = length(p);
  vec3 col = VOID + MID * 0.5 * (1.0 - r);
  col += CYAN * 0.10 * exp(-r * 9.0) * (1.0 - k);              // the core's own glow
  col += WHT * stars(q, 14.0, mix(0.04, 0.2, k)) * mix(0.25, 0.75, k);
  return col;
}

// ---------- D: Future -> Portal -----------------------------------------
vec3 sceneD(vec2 p, vec2 q, float t){
  float k = ss(0.0, 1.0, t);
  vec3 col = VOID + MID * 0.35 * (0.6 - p.y);
  col += WHT * stars(q, 18.0, 0.14) * 0.5;
  // ring geometry (matches the rim): inclination opens from edge-on to face-on
  float incl = mix(0.10, 1.0, k);              // b/a
  float a = mix(0.62, 0.36, k);
  float pR = mix(0.24, 0.0, ss(0.25, 0.95, t));// planet recedes into the portal
  vec2 e = vec2(p.x / a, p.y / (a * incl));
  float ed = length(e);
  // portal interior: another universe, revealed as the ring faces us
  float inner = 1.0 - ss(0.985, 1.0, ed);
  vec2 ip = p * 3.0 + vec2(7.0, 2.0);
  float n = fbm(ip + fbm(ip + 4.0));
  vec3 other = mix(VOID, MID * 1.4, ss(0.2, 0.7, n)) + CYAN * 0.30 * pow(max(0.0, 1.0 - abs(n - 0.55) * 5.0), 3.0) + WHT * stars(q * 0.7 + 40.0, 9.0, 0.3) * 0.7;
  other *= 0.35 + 0.65 * ss(1.0, 0.3, ed);
  col = mix(col, other, inner * ss(0.55, 1.0, t));
  // gas giant
  float dpl = length(p) - pR;
  float body = (1.0 - ss(-0.003, 0.003, dpl)) * step(0.001, pR);
  float lat = p.y / max(pR, 1e-3);
  float bands = fbm(vec2(lat * 5.0, p.x * 1.2 / max(pR, 1e-3) + u_seed));
  vec2 pn = p / max(pR, 1e-3);
  float lit = ss(0.6, -0.8, dot(pn, vec2(0.75, -0.55)));
  float limbDark = sqrt(max(0.0, 1.0 - dot(pn, pn)));
  vec3 pc = mix(MID * 1.1, SILV * 0.30, ss(0.3, 0.75, bands)) * (0.12 + 0.88 * lit) * (0.45 + 0.55 * limbDark);
  col = mix(col, pc, body);
  col += SILV * 0.25 * ring(dpl, 0.004) * step(0.001, pR);
  // ring band 1.0 .. 1.18 in ellipse space; back half hidden behind the planet
  float band = ss(0.995, 1.01, ed) * (1.0 - ss(mix(1.12, 1.035, k), mix(1.135, 1.045, k), ed));
  float behind = step(0.0, p.y) * body;
  float rb = band * (1.0 - behind);
  float rings = 0.7 + 0.3 * ss(0.3, 0.7, noise(vec2(ed * 90.0, 0.5)));
  vec3 rc = mix(SILV * 0.55 * rings, SILV * 0.7, ss(0.6, 1.0, k));
  col = mix(col, rc, rb * mix(0.85, 0.5, k));
  // crisp rim edge on the final state
  col += WHT * 0.9 * ring((ed - 1.0) * a, 0.0025) * ss(0.6, 1.0, k);
  return col;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - 0.5 * u_res) / u_res.y;        // y up, -0.5..0.5
  vec2 q = vec2(fc.x, u_res.y - fc.y) / u_res.y * 360.0;
  float t = clamp(u_t, 0.0, 1.0);
  vec3 col;
  if (u_scene < 0.5)      col = sceneA(p, q, t);
  else if (u_scene < 1.5) col = sceneB(p, q, t);
  else if (u_scene < 2.5) col = sceneC(p, q, t);
  else                    col = sceneD(p, q, t);
  vec2 uv = fc / u_res;
  col *= 1.0 - 0.45 * pow(length(uv - 0.5) * 1.3, 2.4);
  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
