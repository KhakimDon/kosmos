precision highp float;

// S10 — The Future (live). Alien dusk: a ringed giant rising over eroded ridges.
// Ridges: 5 layers far -> near, each with its own parallax offset (u_par scroll, u_mx cursor).

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Planet X (0..1)
 *  @range 0, 1
 *  @default 0.60 */
uniform float u_px;
/** @label Planet radius
 *  @range 100, 1200
 *  @default 500 */
uniform float u_pr;
/** @label Horizon (px from bottom)
 *  @range 100, 1000
 *  @default 400 */
uniform float u_hz;
/** @label Planet sink (fraction of radius below horizon)
 *  @range -1, 1.2
 *  @default -0.20 */
uniform float u_sink;
/** @label Ring tilt (vertical squash)
 *  @range 0.02, 0.6
 *  @default 0.075 */
uniform float u_tilt;
/** @label Ring roll (radians)
 *  @range -0.5, 0.5
 *  @default -0.05 */
uniform float u_roll;
/** @label Beacon X (0..1)
 *  @range 0, 1
 *  @default 0.333 */
uniform float u_bx;
/** @label Seed
 *  @range 0, 100
 *  @default 7 */
uniform float u_seed;
/** @label Scroll parallax (-1..1)
 *  @range -1, 1
 *  @default 0 */
uniform float u_par;
/** @label Cursor X (-1..1)
 *  @range -1, 1
 *  @default 0 */
uniform float u_mx;
/** @label Planetshine (sky glow 0..1)
 *  @range 0, 1.5
 *  @default 1 */
uniform float u_glow;
/** @label Beacon blink (0..1)
 *  @range 0, 1
 *  @default 1 */
uniform float u_blink;
/** @label Fog
 *  @range 0, 2
 *  @default 1 */
uniform float u_fog;

/** @label Sky top
 *  @color
 *  @default #03040C */
uniform vec3 u_skyTop;
/** @label Sky mid (indigo)
 *  @color
 *  @default #14123A */
uniform vec3 u_skyMid;
/** @label Horizon (teal)
 *  @color
 *  @default #3D6E78 */
uniform vec3 u_skyHz;
/** @label Gold
 *  @color
 *  @default #E8C27A */
uniform vec3 u_gold;

float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm2(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*n2(p); p=m*p; a*=.5;} return v; }

// 1D gradient noise, -1..1 (irregular, no value-noise scallops)
float gn(float x){
  float i = floor(x), f = fract(x);
  float g0 = hash11(i) * 2. - 1., g1 = hash11(i + 1.) * 2. - 1.;
  float u = f*f*f*(f*(f*6. - 15.) + 10.);
  return mix(g0 * f, g1 * (f - 1.), u) * 2.2;
}

// eroded mountain profile, ~0..1. Low octaves = massif, mid = sharp ridged crests,
// high octaves = rough rock, damped in valleys (erosion).
float beaconBump(float xl){ float d = xl - u_bx * (u_res.x / u_res.y * 1400.); return 0.40 * exp(-abs(d) / 150.0) * (0.55 + 0.45 * exp(-d * d / 2500.0)); }

float mountain(float x, float s){
  x += 0.55 * gn(x * 0.37 + s * 3.1);                 // domain warp: break regularity
  float base = 0.5 + 0.5 * gn(x * 0.31 + s * 7.7);    // massif
  float h = base * base * 0.85;
  float a = 0.42, f = 1.0;
  for (int i = 0; i < 6; i++){
    float n = gn(x * f + s * 13.7 + float(i) * 5.13);
    float r = 1.0 - abs(n);                           // ridged
    r = r * r;
    float w = (i < 2) ? r : mix(r, 0.5 + 0.5 * n, 0.5);
    h += a * (w - 0.35) * mix(0.35, 1.0, ss(0.05, 0.6, h));   // crests rough, valleys smooth
    f *= 2.07; a *= 0.48;
  }
  return max(h, 0.0);
}

vec3 skyAt(float y, float x, vec2 C, float R){
  float H = 1400.;
  float above = max(y - u_hz, 0.) / (H - u_hz);
  vec3 sky = mix(u_skyHz, u_skyMid, ss(0.0, 0.40, above));
  sky = mix(sky, u_skyTop, ss(0.28, 1.0, above));
  sky += vec3(0.10, 0.07, 0.20) * exp(-pow((above - 0.17) / 0.10, 2.)) * 0.30;
  // planetshine: the giant lights the sky around it as it rises
  float dP = length(vec2(x, y) - C) / R;
  sky += vec3(0.30, 0.52, 0.66) * exp(-max(dP - 1.0, 0.0) * 2.4) * 0.16 * u_glow * ss(-0.2, 0.6, (C.y - u_hz + R) / (2.0 * R));
  // horizon brightening
  sky += u_skyHz * (0.30 + 0.25 * u_glow) * exp(-above * 13.);
  return sky;
}

void main(){
  float H = 1400.;
  vec2 P = gl_FragCoord.xy / u_res.y * H;      // y up
  float W = u_res.x / u_res.y * H;
  float px = H / u_res.y;                       // units per pixel

  vec2 C = vec2(u_px * W, u_hz - u_sink * u_pr);
  float R = u_pr;
  vec3 col = skyAt(P.y, P.x, C, R);

  // ---------- STARS (upper sky) ----------
  {
    float above = (P.y - u_hz) / (H - u_hz);
    vec2 cell = floor(P / 7.0);
    vec2 f = P / 7.0 - cell;
    float h = hash12(cell + u_seed);
    if (h > 0.93){
      vec2 sp = hash22(cell * 1.3 + 4.0) * 0.8 + 0.1;
      float d = length(f - sp) * 7.0;
      float b = pow(hash12(cell + 9.1), 6.0);
      float tw = 0.75 + 0.25 * sin(u_time * (0.6 + 2.0 * h) + h * 40.0);
      col += vec3(0.75, 0.82, 1.0) * exp(-d * d / (0.5 + 1.6 * b)) * (0.10 + 0.9 * b) * tw * ss(0.15, 0.6, above);
    }
  }

  // ---------- PLANET + RINGS (3D, R units) ----------
  float ca = cos(u_roll), sa = sin(u_roll);
  vec2 q = (P - C) / R;
  vec2 rq = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);     // rolled frame (ring plane aligned)
  vec3 L = normalize(vec3(-0.80, 0.30, -0.52));                    // sun upper-left, behind
  vec3 Lr = vec3(ca * L.x + sa * L.y, -sa * L.x + ca * L.y, L.z);
  float t = u_tilt;
  vec3 Nr = vec3(0.0, sqrt(1.0 - t * t), t);                       // ring plane normal (rolled frame)
  float r2 = dot(q, q);
  float rim = sqrt(r2);
  float inner = 1.34, outer = 2.32;

  // ring density at plane radius rr, with analytic AA footprint fp
  // (fine ringlets fade where one pixel covers many of them)
  float zRing = -(Nr.y * rq.y) / Nr.z;
  vec3 pr = vec3(rq, zRing);
  float rr = length(pr);
  float fp = px / R * length(vec2(rq.x, rq.y / (t * t))) / max(rr, 1e-3);
  float tR = (rr - inner) / (outer - inner);
  float ringIn = ss(0.0, 0.01, tR) * ss(1.0, 0.985, tR);
  float dens = 0.0;
  if (ringIn > 0.0){
    float fine = ss(0.012, 0.002, fp * 6.0);
    dens = 0.55 + 0.20 * sin(tR * 31.0 + 1.0) + 0.12 * sin(tR * 71.0 + 2.0)
         + fine * (0.22 * (hash11(floor(tR * 220.0) + u_seed) - 0.5) + 0.14 * sin(tR * 420.0));
    dens *= 1.0 - 0.92 * ss(0.585, 0.60, tR) * ss(0.665, 0.65, tR);     // Cassini division
    dens *= 1.0 - 0.6 * ss(0.905, 0.915, tR) * ss(0.935, 0.925, tR);    // Encke-like gap
    dens *= mix(0.25, 1.0, ss(0.0, 0.22, tR));                           // faint C ring
    dens *= mix(1.0, 0.55, ss(0.70, 1.0, tR));
    dens = clamp(dens, 0., 1.) * ringIn;
  }
  // planet shadow on the ring (ray to sun hits the sphere?)
  float b = dot(pr, Lr), c = dot(pr, pr) - 1.0;
  float ringShadow = (b < 0.0) ? ss(-0.02, 0.06, -(b * b - c)) : 1.0;
  float ringLit = (0.30 + 0.70 * ringShadow);
  // forward scattering: backlit rings glow on the sun side
  float fwd = 0.55 + 0.45 * ss(1.4, -2.0, rq.x);
  vec3 ringCol = mix(vec3(0.62, 0.58, 0.56), vec3(0.80, 0.86, 0.94), ss(0.2, 0.9, tR)) * fwd * ringLit;

  bool front = zRing > 0.0;
  if (rim < 1.0){
    vec3 n = vec3(q, sqrt(1.0 - r2));
    vec3 nr = vec3(ca * n.x + sa * n.y, -sa * n.x + ca * n.y, n.z);
    float lat = nr.y;
    float lon = atan(nr.x, nr.z);
    // turbulent banding
    float tb = fbm2(vec2(lon * 2.2 + u_seed, lat * 9.0)) - 0.5;
    float bl = lat + tb * 0.030 + 0.008 * sin(lon * 7.0 + lat * 40.0);
    float band = 0.5 + 0.22 * sin(bl * 26.0) + 0.14 * sin(bl * 61.0 + 1.3) + 0.08 * sin(bl * 133.0 + 0.4);
    float streak = n2(vec2(lon * 6.0 + tb * 3.0, bl * 160.0));
    band += (streak - 0.5) * 0.22;
    vec3 cA = vec3(0.86, 0.82, 0.74);     // cream zones
    vec3 cB = vec3(0.52, 0.60, 0.74);     // blue-grey belts
    vec3 cD = vec3(0.30, 0.31, 0.42);     // dark belts
    vec3 surf = mix(cD, cB, ss(0.15, 0.5, band));
    surf = mix(surf, cA, ss(0.5, 0.85, band));
    // polar darkening
    surf *= mix(1.0, 0.72, ss(0.55, 0.95, abs(lat)));
    float d = dot(n, L);
    float diff = ss(-0.10, 0.65, d);
    // ring shadow on the planet: ray to sun crosses the ring plane inside the ring band
    float k = -dot(nr, Nr) / dot(Lr, Nr);
    float rs = 1.0;
    if (k > 0.0){
      vec3 hit = nr + Lr * k;
      float tr = (length(hit) - inner) / (outer - inner);
      if (tr > 0.0 && tr < 1.0){
        float dd = 0.62 + 0.2 * sin(tr * 31.0 + 1.0);
        dd *= 1.0 - 0.9 * ss(0.585, 0.60, tr) * ss(0.665, 0.65, tr);
        dd *= mix(0.25, 1.0, ss(0.0, 0.22, tr));
        rs = 1.0 - 0.82 * clamp(dd, 0., 1.);
      }
    }
    // dusk: warm thin twilight along the terminator
    vec3 day = surf * diff * 1.02 * rs;
    day += vec3(0.55, 0.32, 0.30) * exp(-pow((d - 0.02) / 0.10, 2.)) * 0.16 * rs;
    // limb darkening on the day side
    day *= mix(0.62, 1.0, pow(n.z, 0.35));
    // night side: faint ringshine + sky bounce
    vec3 night = vec3(0.016, 0.020, 0.040) + u_skyMid * 0.10 * n.z + vec3(0.04, 0.05, 0.07) * ss(0.2, -0.6, nr.y) * (1.0 - diff);
    vec3 pc = night + day;
    float fr = pow(1. - n.z, 3.0);
    float litRim = clamp(dot(normalize(n.xy + 1e-4), normalize(L.xy)) * 0.5 + 0.5, 0., 1.);
    pc += vec3(0.42, 0.70, 0.88) * fr * (0.10 + 0.85 * litRim * litRim);
    float aa = ss(1.0, 1.0 - 1.5 * px / R, rim);
    col = mix(col, pc, aa);
  } else {
    float halo = exp(-(rim - 1.0) * 20.);
    vec2 dir = q / rim;
    float lit = clamp(dot(dir, normalize(L.xy)) * 0.5 + 0.55, 0., 1.);
    col += vec3(0.45, 0.70, 0.88) * halo * (0.05 + 0.48 * lit * lit);
  }
  // rings: visible unless behind the planet disc
  if (dens > 0.0 && (front || rim > 1.0)){
    float a = dens * (front && rim < 1.0 ? 0.80 : 0.66);
    col = mix(col, ringCol, a);
  }

  // ---------- LOW CLOUD BANKS (in front of the planet, behind ridges) ----------
  {
    float yb = P.y - u_hz;
    float env = exp(-pow((yb - 70.0) / 55.0, 2.)) ;
    if (env > 0.01){
      float cl = fbm2(vec2((P.x + u_time * 7.0) / 380.0, yb / 16.0 + 3.0));
      cl = ss(0.48, 0.78, cl + 0.12 * fbm2(vec2(P.x / 90.0 - u_time * 0.05, yb / 7.0)));
      float onPlanet = ss(1.02, 0.95, length(P - C) / R);
      float sun = 0.55 + 0.45 * ss(R * 0.4, -R * 0.9, P.x - C.x);
      vec3 cc = mix(u_skyHz * 0.75, vec3(0.62, 0.74, 0.82), 0.35 * onPlanet * sun);
      col = mix(col, cc, cl * env * 0.42 * u_fog);
    }
  }

  // ---------- RIDGES (near -> far, first hit wins) ----------
  float baseY[5]; float amp[5]; float freq[5]; float dist[5]; float kp[5];
  baseY[0] = u_hz - 6.;   amp[0] = 60.;  freq[0] = 1.0 / 170.;  dist[0] = 1.00; kp[0] = 0.06;
  baseY[1] = u_hz - 60.;  amp[1] = 110.; freq[1] = 1.0 / 260.;  dist[1] = 0.55; kp[1] = 0.16;
  baseY[2] = u_hz - 150.; amp[2] = 170.; freq[2] = 1.0 / 360.;  dist[2] = 0.28; kp[2] = 0.32;
  baseY[3] = u_hz - 265.; amp[3] = 260.; freq[3] = 1.0 / 470.;  dist[3] = 0.11; kp[3] = 0.58;
  baseY[4] = u_hz - 420.; amp[4] = 430.; freq[4] = 1.0 / 640.;  dist[4] = 0.025; kp[4] = 1.00;
  float offX[5]; float offY[5];
  for (int i = 0; i < 5; i++){
    offX[i] = -u_mx * 46.0 * kp[i] + u_par * 30.0 * kp[i];
    offY[i] = u_par * 150.0 * kp[i];
  }

  vec3 farFog = mix(u_skyHz, u_skyMid, 0.30) * (0.92 + 0.15 * u_glow);
  vec3 rockNear = vec3(0.012, 0.014, 0.026);
  float hit = -1.0;
  float hY = 0.0;
  for (int j = 4; j >= 0; j--){
    float fx = (P.x + offX[j]) * freq[j];
    float h = baseY[j] + offY[j] + amp[j] * (mountain(fx, u_seed + float(j) * 3.3) + (j == 4 ? beaconBump(P.x + offX[j]) : 0.0));
    if (P.y < h && hit < 0.0){ hit = float(j); hY = h; }
  }
  if (hit >= 0.0){
    int i = int(hit + 0.5);
    float fi = hit;
    float fq = 0.0, ox = 0.0, oy = 0.0, am = 0.0, dd = 0.0, by = 0.0;
    for (int j = 0; j < 5; j++) if (j == i){ fq = freq[j]; ox = offX[j]; oy = offY[j]; am = amp[j]; dd = dist[j]; by = baseY[j]; }
    float sd = u_seed + fi * 3.3;
    float x = P.x + ox;
    float e = 2.5;
    float hl = mountain((x - e) * fq, sd), hr = mountain((x + e) * fq, sd);
    if (i == 4){ hl += beaconBump(x - e); hr += beaconBump(x + e); }
    float slope = (hr - hl) * am / (2.0 * e);                 // crest slope (fine)
    float E = 34.0;
    float dIn0 = hY - P.y;
    float xs = x + dIn0 * 0.55 + (fbm2(vec2(x / 60.0, dIn0 / 50.0) + fi) - 0.5) * 50.0;   // fall-line: lit faces become diagonal spurs
    float hL = mountain((xs - E) * fq, sd), hR = mountain((xs + E) * fq, sd);
    if (i == 4){ hL += beaconBump(xs - E); hR += beaconBump(xs + E); }
    float slopeS = (hR - hL) * am / (2.0 * E);                // broad face orientation
    float depthIn = hY - P.y;
    // lit by sky + planet from upper-left: left-facing (positive slope) faces light
    float facing = clamp(0.5 + slope * 0.9, 0.0, 1.0);
    float facingS = clamp(0.5 + slopeS * 1.3, 0.0, 1.0);
    float nearPlanet = exp(-pow((P.x - C.x) / (R * 1.5), 2.));
    // rock: gullies run down the fall line, broken strata
    vec2 rp = vec2(x * fq * 18.0 - depthIn * slopeS * fq * 10.0, depthIn / (36. + fi * 10.));
    float g1 = fbm2(rp + fi * 7.0);
    float strata = n2(vec2(x * fq * 4.0 + g1, (P.y - oy) / (7.0 + fi * 2.0)));
    float rock = 0.60 + 0.65 * (g1 * 0.75 + strata * 0.25);
    float fade = 1.0 - fi * 0.17;                              // nearer = darker silhouettes
    vec3 rc = rockNear * rock * (1.6 - fi * 0.25);
    // sky light on light-facing faces, falling off into the body
    float face = exp(-depthIn / (70. + fi * 70.)) * facingS;
    rc += mix(u_skyHz, vec3(0.55, 0.72, 0.82), 0.4) * face * (0.05 + 0.16 * nearPlanet) * (0.4 + 0.8 * g1) * fade;
    // crisp rim light along the crest
    float rimL = exp(-depthIn / (0.9 + fi * 0.3)) * (0.20 + 0.80 * facing) * (0.30 + 0.70 * nearPlanet);
    rc += vec3(0.60, 0.80, 0.92) * rimL * (0.45 + 0.25 * u_glow);
    // aerial perspective: distance fog + height fog toward the layer base
    vec3 fogC = mix(farFog, skyAt(u_hz + 30.0, P.x, C, R) * 0.9, 0.5);
    float aer = 1.0 - exp(-dd * 2.4);
    float hfog = exp(-max(P.y - (by + oy), 0.0) / (45.0 + fi * 35.0)) * max(0.46 - fi * 0.11, 0.0);
    vec3 lc = mix(rc, fogC, clamp(aer * 0.93, 0.0, 1.0));
    lc = mix(lc, fogC * (0.9 - fi * 0.12), clamp(hfog * (1.0 - aer * 0.5), 0.0, 1.0));
    // drifting fog banks in the valley in front of this layer
    float drift = u_time * (3.0 + fi * 4.0);
    float bank = fbm2(vec2((P.x + drift + fi * 300.0) / (260.0 + fi * 120.0), (P.y - oy) / (26.0 + fi * 14.0) - fi * 3.0));
    float bankEnv = exp(-max(P.y - (by + oy) + 10.0, 0.0) / (45.0 + fi * 25.0));
    float fogB = ss(0.45, 0.82, bank) * bankEnv * max(0.62 - fi * 0.14, 0.03) * u_fog;
    lc = mix(lc, fogC * (0.85 - fi * 0.1 + 0.2 * nearPlanet), clamp(fogB, 0.0, 0.8));
    col = lc;
  }
  // haze veil on the sky just above each far crest line (very soft)
  col += u_skyHz * 0.05 * exp(-abs(P.y - u_hz) / 40.0) * u_glow;

  // ---------- BEACON (single gold point on the near ridge) ----------
  {
    float bxc = u_bx * W;
    if (abs(P.x - (bxc - offX[4])) < 160.0 && P.y < u_hz){
      float bestY = -1e4; float bestX = bxc;
      for (int k = 0; k < 21; k++){
        float bx = bxc - offX[4] + (float(k) - 10.0) * 6.0;
        float bh = baseY[4] + offY[4] + amp[4] * (mountain((bx + offX[4]) * freq[4], u_seed + 4.0 * 3.3) + beaconBump(bx + offX[4]));
        if (bh > bestY){ bestY = bh; bestX = bx; }
      }
      vec2 bp = vec2(bestX, bestY + 3.0);
      float d = length(P - bp);
      float bl = u_blink;
      col += u_gold * (exp(-d * d / 3.5) * (0.45 + 1.1 * bl) + exp(-d / 16.0) * 0.10 * bl + exp(-d / 60.0) * 0.025 * bl);
    }
  }

  // ground falls to night toward the section's lower edge (hand-off to S11)
  col *= mix(0.35, 1.0, ss(0.0, 170.0, P.y));
  // vignette + dither
  vec2 uv = gl_FragCoord.xy / u_res;
  col *= 1.0 - 0.26 * pow(length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.2)), 2.0);
  col += (hash12(gl_FragCoord.xy + u_seed) - 0.5) / 255.0 * 1.5;
  gl_FragColor = vec4(col, 1.0);
}
