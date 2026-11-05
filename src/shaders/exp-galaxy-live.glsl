precision highp float;

// S09 — The Expansion (live). Rigidly rotating barred-ish spiral: star-dense arms,
// fine star-forming knots, crisp filamentary dust lanes. A civilization front (u_front)
// lights a warm subset of stars inside a plane-circle around the origin world.

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Center X (design px)
 *  @range 0, 1440
 *  @default 930 */
uniform float u_cx;
/** @label Center Y (design px, from top)
 *  @range 0, 1500
 *  @default 560 */
uniform float u_cy;
/** @label Radius (design px)
 *  @range 100, 1200
 *  @default 560 */
uniform float u_R;
/** @label Rotation (rad)
 *  @range -3.2, 3.2
 *  @default -0.42 */
uniform float u_rot;
/** @label Tilt ratio (cos inclination)
 *  @range 0.1, 1
 *  @default 0.46 */
uniform float u_tilt;
/** @label Arm winding (1/tan pitch)
 *  @range 0.5, 8
 *  @default 2.1 */
uniform float u_wind;
/** @label Galaxy spin (rad, rigid)
 *  @range -3.2, 3.2
 *  @default 0.0 */
uniform float u_phase;
/** @label Brightness
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_gain;
/** @label Stars
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_stars;
/** @label Civilization front radius (R units, plane)
 *  @range 0, 1.5
 *  @default 0.0 */
uniform float u_front;
/** @label Origin X (R units, plane, unspun)
 *  @range -1, 1
 *  @default -0.109 */
uniform float u_ox;
/** @label Origin Y (R units, plane, unspun)
 *  @range -1, 1
 *  @default -0.448 */
uniform float u_oy;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }
float fbm5(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }

// screen-space star field (background halo, does not spin)
vec3 starLayer(vec2 q, float cell, float prob, float maxR, float seed){
  vec2 id = floor(q/cell); vec2 f = q - id*cell;
  if (hash12(id + seed) > prob) return vec3(0.);
  vec2 pos = (hash22(id + seed*1.7)*0.8+0.1)*cell;
  float d = length(f - pos);
  float b = pow(hash12(id + seed*3.1), 7.0);
  float r = mix(0.5, maxR, b);
  float core = exp(-d*d/(r*r*0.6));
  float t = hash12(id + seed*5.3);
  vec3 c = mix(vec3(1.0,0.82,0.64), vec3(0.76,0.85,1.0), ss(0.2,0.8,t));
  return c*core*(0.12+1.3*b);
}

// plane-space stars (spin with the disk). p in plane px, metric back-projected to screen.
// returns rgb, and .a style info packed: w = hash used for civ selection via out param
vec3 diskStars(vec2 p, float cell, float prob, float maxR, float seed, float tilt, mat2 back, out float sel, out float dist){
  vec2 id = floor(p/cell); vec2 f = p - id*cell;
  sel = hash12(id + seed*9.7);
  vec2 pos = (hash22(id + seed*1.7)*0.8+0.1)*cell;
  vec2 dv = back * (f - pos);
  float d = length(vec2(dv.x, dv.y * tilt));
  dist = d;
  if (hash12(id + seed) > prob) { dist = 1e3; return vec3(0.); }
  float b = pow(hash12(id + seed*3.1), 5.0);
  float r = mix(0.45, maxR, b);
  float core = exp(-d*d/(r*r*0.55));
  float t = hash12(id + seed*5.3);
  vec3 c = mix(vec3(1.0,0.86,0.70), vec3(0.70,0.82,1.0), ss(0.15,0.7,t));
  return c*core*(0.18+1.4*b);
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 q = fc / u_res.x * 1440.0;     // design px, y down
  float pxs = 1440.0 / u_res.x;       // design px per pixel

  vec2 d = q - vec2(u_cx, u_cy);
  float cr = cos(u_rot), sr = sin(u_rot);
  vec2 u = vec2(cr*d.x + sr*d.y, -sr*d.x + cr*d.y);
  vec2 g0 = vec2(u.x, u.y / u_tilt) / u_R;             // plane (screen-aligned)
  float cp = cos(u_phase), sp = sin(u_phase);
  mat2 spin = mat2(cp, -sp, sp, cp);                   // g = spin * gr  -> gr = spin^T g
  vec2 g = vec2(cp*g0.x + sp*g0.y, -sp*g0.x + cp*g0.y);   // co-rotating plane
  float r = length(g);
  float th = atan(g.y, g.x);
  float lr = log(max(r, 0.002));

  // ---- spiral structure
  float wob = fbm(g*3.0 + 4.0) - 0.5;
  float ph = th - lr*u_wind + wob*0.9;
  float armC = 0.5 + 0.5*cos(2.0*ph);
  float spur = pow(0.5 + 0.5*cos(4.0*ph + 1.3 + wob*2.0), 8.0) * ss(0.3, 0.6, r);
  float arm = pow(armC, 4.0) + 0.45*spur;
  float armSharp = pow(armC, 10.0);

  float disk = exp(-r*2.6);
  float edge = 1.0 - ss(0.75, 1.18, r);
  float armZone = ss(0.06, 0.22, r) * edge;

  // ---- clumps: OB associations, multi-scale
  float cl  = fbm(g*7.0 + vec2(1.7, 9.2));
  float cl2 = fbm(g*16.0 + vec2(3.1, 2.0));
  float cl3 = noise(g*44.0 + 7.0);
  float clump = ss(0.42, 0.95, cl*0.6 + cl2*0.55);
  float fineK = ss(0.62, 0.95, cl3) * ss(0.45, 0.8, cl2);

  vec3 warm  = vec3(1.0, 0.78, 0.52);
  vec3 young = vec3(0.56, 0.74, 1.0);
  vec3 pink  = vec3(1.0, 0.40, 0.60);

  vec3 col = vec3(0.0);
  // diffuse old disk
  col += mix(warm, vec3(0.60, 0.65, 0.82), ss(0.0, 0.55, r)) * disk * 0.72 * edge;
  // inter-arm glow (unresolved stars) so arms sit in a disk, not in void
  col += vec3(0.30, 0.36, 0.52) * exp(-r*2.0) * 0.16 * edge;
  // arms: blue-white young light, clumpy
  float armLight = arm * armZone * (0.10 + 1.6*clump*clump + 0.40*cl + 0.9*fineK*armSharp) * exp(-r*1.2);
  col += young * armLight * 0.82;

  // ---- resolved disk stars (spin with the galaxy)
  vec2 pp = g * u_R;                         // plane px
  mat2 back = mat2(cp, sp, -sp, cp);         // co-rotating -> screen-aligned plane
  float sel1, d1, sel2, d2, sel3, d3;
  float armDen = clamp(arm*1.3 + 0.12, 0.0, 1.0);
  vec3 s1 = diskStars(pp, 2.6, 0.30*armDen*armZone, 0.9, 41.0, u_tilt, back, sel1, d1);
  vec3 s2 = diskStars(pp, 6.0, 0.40*armDen*armZone + 0.04*edge, 1.4, 53.0, u_tilt, back, sel2, d2);
  vec3 s3 = diskStars(pp, 15.0, 0.45*armDen*armZone, 2.0, 67.0, u_tilt, back, sel3, d3);
  vec3 ds = s1*0.45 + s2*0.7 + s3;
  col += ds * (0.25 + 1.1*arm) * exp(-r*0.8) * 0.6;

  // ---- HII knots: small sharp pink knots on the arm crest, just outside the dust lane
  {
    vec2 kp = pp / 9.0;
    vec2 kid = floor(kp); vec2 kf = kp - kid;
    float kh = hash12(kid + 3.3);
    vec2 kpos = hash22(kid + 8.1)*0.7 + 0.15;
    vec2 kd = back * ((kf - kpos) * 9.0);
    float kdist = length(vec2(kd.x, kd.y * u_tilt));
    float crest = ss(0.70, 0.98, 0.5 + 0.5*cos(2.0*(ph - 0.18)));
    float on = step(1.0 - 0.10*crest*armZone*ss(0.4, 0.7, cl), kh);
    float kr = 0.5 + 0.9*hash12(kid + 1.9);
    col += pink * on * exp(-kdist*kdist/(kr*kr)) * 0.45 * exp(-r*0.6);
    col += pink * on * exp(-kdist/(kr*2.5)) * 0.05;
  }

  // ---- bulge / bar-ish warm core
  vec2 gb = vec2(u.x, u.y / mix(u_tilt, 1.0, 0.45)) / u_R;
  float rb = length(gb);
  col += warm * exp(-rb*rb*95.0) * 1.7;
  col += vec3(1.0, 0.93, 0.82) * exp(-rb*rb*900.0) * 1.6;
  col += warm * exp(-rb*7.0) * 0.28;

  // ---- dust: crisp lanes on the trailing edge + feathery filaments + spurs crossing arms
  float dustC = 0.5 + 0.5*cos(2.0*(ph + 0.42));
  float fil  = fbm5(g*13.0 + 20.0);
  float fil2 = noise(g*52.0 + 11.0);
  float laneEdge = dustC + (fil - 0.5)*0.07 + (fil2 - 0.5)*0.03;
  float lane = ss(0.982, 0.997, laneEdge) * (0.45 + 0.55*ss(0.35, 0.65, fil));
  // secondary thin lane + ridged dust threads (crisp, filamentary)
  float thr = 1.0 - abs(2.0*noise(vec2(ph*7.0, lr*5.0) + fil*1.5) - 1.0);
  float patch = ss(0.35, 0.75, noise(g*8.0 + 31.0));
  float threads = ss(0.88, 0.97, thr) * ss(0.6, 0.95, dustC) * 0.5 * patch;
  lane = max(lane * mix(0.45, 1.0, ss(0.2, 0.6, noise(g*5.0 + 2.0) + fil2*0.3)), threads);
  float feather = ss(0.60, 0.72, fil) * ss(0.55, 0.9, dustC) * 0.32;
  // spurs: thin dark fingers crossing the arm at the pitch angle
  float spurC = 0.5 + 0.5*cos(9.0*ph + lr*8.0 + fil*3.0);
  float spurs = ss(0.90, 0.99, spurC) * ss(0.35, 0.8, armC) * ss(0.5, 0.75, fil) * 0.35;
  float dustAmt = clamp(lane*0.8 + feather*0.7 + spurs, 0.0, 1.0) * ss(0.04, 0.16, r) * edge;
  // the near side of the tilted disk shows its dust more (front half, toward the viewer)
  dustAmt *= mix(0.8, 1.1, ss(0.2, -0.4, g0.y));
  col *= 1.0 - 0.93*dustAmt;
  // reddening at lane edges
  col += vec3(0.08, 0.035, 0.02) * dustAmt * (1.0 - dustAmt) * 1.6 * disk * 4.0;

  // ---- civilization: stars inside the front glow warm-gold, the frontier rim breathes
  if (u_front > 0.0){
    vec2 o = vec2(u_ox, u_oy);
    float dO = length(g - o);
    float inside = ss(u_front, u_front - 0.03, dO);
    float civ = 0.0;
    civ += (sel2 < 0.22 ? 1.0 : 0.0) * exp(-d2*d2/0.8);
    civ += (sel3 < 0.45 ? 1.0 : 0.0) * exp(-d3*d3/1.2) * 1.2;
    float tw = 0.8 + 0.2*sin(u_time*1.3 + sel2*40.0);
    col += vec3(1.0, 0.80, 0.48) * civ * inside * tw * 0.7 * (0.3 + 0.8*armDen);
    // frontier: faint warm shell in the plane
    float shell = exp(-pow((dO - u_front)/0.012, 2.0));
    col += vec3(0.95, 0.76, 0.46) * shell * 0.05 * (0.5 + arm);
  }

  col *= u_gain;

  // ---- halo field stars (screen space)
  float halo = exp(-r*0.9) * 0.9 + 0.25;
  vec3 st = starLayer(q, 9.0, 0.10, 0.9, 11.0) + starLayer(q, 31.0, 0.28, 1.5, 23.0) + starLayer(q, 97.0, 0.45, 2.2, 37.0);
  col += st * u_stars * halo * (1.0 - 0.8*dustAmt);

  vec3 base = vec3(0.012, 0.016, 0.035);
  col += base;
  col += vec3(0.02, 0.025, 0.06) * exp(-r*1.2);

  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
