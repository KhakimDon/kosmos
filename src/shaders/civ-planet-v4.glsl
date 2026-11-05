precision highp float;

// NOUMENA S03 - The Digital Civilization
// Opaque full-frame: night-side planet with circuitry city lattice + tilted ring habitat.

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Center X (0..1)
 *  @range 0, 1
 *  @default 0.36 */
uniform float u_cx;
/** @label Center Y (0..1, from bottom)
 *  @range 0, 1
 *  @default 0.42 */
uniform float u_cy;
/** @label Radius (fraction of height)
 *  @range 0.1, 1
 *  @default 0.43 */
uniform float u_r;
/** @label City amount
 *  @range 0, 4
 *  @default 1.0 */
uniform float u_city;
/** @label Crescent amount
 *  @range 0, 4
 *  @default 1.0 */
uniform float u_cres;
/** @label Ring radius (planet radii)
 *  @range 1.05, 2.5
 *  @default 1.42 */
uniform float u_ringR;
/** @label Ring elevation (sin)
 *  @range -0.6, 0.6
 *  @default -0.16 */
uniform float u_ringE;
/** @label Ring roll
 *  @range -1, 1
 *  @default -0.22 */
uniform float u_roll;
/** @label Seed
 *  @range 0, 100
 *  @default 7 */
uniform float u_seed;
/** @label Exposure
 *  @range 0.2, 4
 *  @default 1.3 */
uniform float u_exp;

const vec3 VOID = vec3(0.012, 0.016, 0.035);
const vec3 MID  = vec3(0.027, 0.043, 0.110);
const vec3 CYAN = vec3(0.50, 0.85, 1.00);
const vec3 CITY = vec3(0.80, 0.93, 1.00);
const vec3 GOLD = vec3(0.91, 0.76, 0.48);
const vec3 SILV = vec3(0.68, 0.71, 0.78);

float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y)*p.z); }
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx)*0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ v += a*n3(p); p = p*2.07 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return v / 0.875; }

// lattice line: distance to nearest integer along one axis, gated per segment
float latticeLine(vec2 g, float w, float keep, float seed){
  vec2 f = abs(fract(g) - 0.5);           // 0.5 at the line
  vec2 d = 0.5 - f;                        // distance to line in grid units
  vec2 id = floor(g);
  float onX = step(keep, h12(id + seed));            // vertical (meridian) segment in this cell
  float onY = step(keep, h12(id.yx + seed + 17.0));  // horizontal (parallel) segment
  return max(ss(w, 0.0, d.x)*onX, ss(w, 0.0, d.y)*onY);
}

void main(){
  float R = u_r * u_res.y;                                 // radius in device px
  vec2 c = (gl_FragCoord.xy - vec2(u_cx, u_cy)*u_res) / R; // planet units
  float px = 1.0 / R;                                      // one device px in planet units
  float len = length(c);

  // background: void, faint midnight bloom toward the crescent side
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col = mix(VOID, MID, 0.55*ss(1.6, 0.2, length(c - vec2(0.55, 0.45)))) ;
  col *= 0.9 + 0.1*ss(1.2, 0.0, abs(uv.y - 0.5));

  vec3 L = normalize(vec3(0.42, 0.40, -0.86));            // Origin light from behind, upper right
  float planetZ = -10.0;
  float disk = ss(1.0 + px, 1.0 - px, len);

  if (len < 1.0 + px) {
    vec2 q = c / max(len, 1.0) ;
    float zz = sqrt(max(0.0, 1.0 - dot(q, q)));
    vec3 n = vec3(q, zz);
    planetZ = zz;
    float ndl = dot(n, L);

    // surface frame: slight axial tilt (seam stays on far side)
    float ct = cos(0.32), st = sin(0.32);
    vec3 sp = vec3(ct*n.x - st*n.y, st*n.x + ct*n.y, n.z);
    float lon = atan(sp.x, sp.z);
    float lat = asin(clamp(sp.y, -1.0, 1.0));

    // continents
    float cont = fbm(sp*1.9 + u_seed);
    float land = ss(0.47, 0.56, cont);
    float dense = ss(0.46, 0.68, fbm(sp*4.3 + u_seed + 40.0)) * land;

    // dark surface
    vec3 alb = mix(vec3(0.010, 0.014, 0.030), vec3(0.030, 0.034, 0.050), land);
    vec3 surf = alb * 0.6;

    // lit crescent
    float day = ss(-0.02, 0.22, ndl);
    vec3 dayCol = mix(vec3(0.10, 0.16, 0.26), mix(SILV, vec3(0.85, 0.88, 0.94), 0.5), land*0.6 + 0.2);
    surf += dayCol * day * 0.75 * u_cres;
    float term = exp(-pow(ndl / 0.07, 2.0));
    surf += CYAN * term * 0.10 * u_cres * ss(0.0, 0.4, 1.0 - zz);

    // ---- city lattice on the night side ----
    float night = ss(0.03, -0.06, ndl);
    float limbFade = ss(0.0, 0.30, zz);
    float cosl = max(cos(lat), 0.15);
    // major lattice: 40 meridians / parallels per half-turn
    vec2 gM = vec2(lon * 20.0 / 3.14159, lat * 20.0 / 3.14159);
    float wM = 1.1 * px * 20.0 / 3.14159 / max(zz, 0.25);
    float major = latticeLine(gM, wM, 0.45, u_seed);
    // minor lattice inside dense districts
    vec2 gm = gM * 4.0;
    float minor = latticeLine(gm, wM * 4.0, 0.35, u_seed + 5.0);
    // nodes at major intersections
    vec2 dI = (gM - floor(gM + 0.5));
    float nodeH = h12(floor(gM + 0.5) + u_seed + 3.0);
    float nodeR = (0.03 + 0.10*nodeH*nodeH);
    float node = ss(nodeR, nodeR*0.3, length(dI)) * step(0.55, nodeH);
    float halo = exp(-length(dI) / (0.06 + 0.12*nodeH)) * step(0.55, nodeH);
    // micro-dots in dense areas (minor intersections)
    vec2 dm = (gm - floor(gm + 0.5));
    float mH = h12(floor(gm + 0.5) + u_seed + 9.0);
    float micro = ss(0.10, 0.02, length(dm)) * step(0.5, mH);
    // arteries: ridge lines of a low-frequency field
    // trunk arteries: a coarse lattice (every 5 cells) — the planet's backbone
    float art = latticeLine(gM / 5.0, wM * 1.6 / 5.0, 0.30, u_seed + 21.0);

    float settle = ss(0.40, 0.62, cont);
    float lum = major * (0.30*land + 0.70*dense)
              + minor * 0.45 * dense
              + node  * (0.45*land + 1.6*dense)
              + micro * 0.80 * dense
              + halo  * 0.15 * dense
              + art   * 0.85 * ss(0.44, 0.52, cont);
    vec3 cityCol = CITY * lum;
    cityCol += CYAN * 0.07 * dense + CYAN * 0.010 * land;   // urban sky-glow
    // gold cores: rare megacity hearts
    float coreH = h12(floor(gM + 0.5) + u_seed + 51.0);
    float core = step(0.93, coreH) * step(0.45, dense) * ss(0.11, 0.02, length(dI));
    cityCol += GOLD * core * 2.4 + GOLD * step(0.93, coreH) * step(0.45, dense) * ss(0.6, 0.0, length(dI)) * 0.08;

    surf += cityCol * night * limbFade * u_city;

    // thin backlit atmosphere inside the limb
    vec2 ld = normalize(L.xy);
    float facing = dot(normalize(q + 1e-5), ld);
    float rimIn = pow(1.0 - zz, 6.0);
    surf += CYAN * rimIn * (0.10 + 0.9*ss(0.2, 1.0, facing)) * 0.8;

    col = mix(col, surf, disk);
  }

  // atmosphere halo outside the limb (forward scattering of the Origin's light)
  {
    float d = max(len - 1.0, 0.0);
    vec2 ld = normalize(L.xy);
    float facing = dot(c / max(len, 1e-4), ld);
    float lit = ss(-0.2, 1.0, facing);
    float I = exp(-d / 0.006) * (0.12 + 1.6*lit*lit) + exp(-d / 0.035) * (0.03 + 0.30*lit*lit);
    col += mix(CYAN, vec3(0.9, 0.95, 1.0), lit*0.5) * I * (1.0 - disk) ;
  }

  // ---- orbital ring habitat ----
  {
    float cr = cos(u_roll), sr = sin(u_roll);
    float xr =  cr*c.x + sr*c.y;
    float yr = -sr*c.x + cr*c.y;
    float e = u_ringE;
    float s = xr, t = yr / e;
    float k = sqrt(max(0.0, 1.0 - e*e));
    float rz = t * k;                          // + toward the viewer
    float rho = length(vec2(s, t));
    float g = length(vec2(s / rho, (t / rho) / e)); // |grad rho| on screen
    float dScr = abs(rho - u_ringR) / g;       // screen distance (planet units) to ring centerline
    float th = atan(t, s);

    bool hidden = (len < 1.0) && (rz < planetZ);
    if (!hidden) {
      // hairline track (continuous, silver)
      float trackD = abs(rho - (u_ringR + 0.045)) / g;
      float track = ss(0.8*px, 0.0, trackD) * 0.22;
      // lit segments
      float N = 96.0;
      float sf = th / 6.28318 * N;
      float sid = floor(sf);
      float sfr = fract(sf);
      float on = step(0.22, h12(vec2(sid, u_seed)));
      float segMask = ss(0.0, 0.04, sfr) * ss(1.0, 0.82, sfr) * on;
      float band = ss(4.0*px, 1.4*px, dScr);
      float bright = 0.65 + 0.35*h12(vec2(sid, u_seed + 2.0));
      // shadow of the planet on the ring (light from behind -> far side shadowed)
      vec3 P = vec3(c, rz);
      float bq = dot(P, L); float cq = dot(P, P) - 1.0;
      float disc = bq*bq - cq;
      float shadow = (disc > 0.0 && (-bq + sqrt(disc)) > 0.0 && cq > 0.0) ? 0.8 : 1.0;
      // front half slightly brighter (closer)
      float near = 0.75 + 0.25*ss(-1.0, 1.0, rz);
      vec3 ringCol = mix(CITY, vec3(1.0), 0.3) * band * segMask * bright * 1.25 * near * shadow;
      ringCol += CYAN * ss(10.0*px, 0.0, dScr) * segMask * 0.05 * near;
      col += ringCol + SILV * track;
    }
  }

  col = 1.0 - exp(-col * u_exp);
  // fine grain to avoid banding
  col += (h12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
