precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Planet X (0..1)
 *  @range 0, 1
 *  @default 0.60 */
uniform float u_px;
/** @label Planet radius (px of 1300 high)
 *  @range 100, 1200
 *  @default 500 */
uniform float u_pr;
/** @label Horizon (px from bottom)
 *  @range 100, 1000
 *  @default 400 */
uniform float u_hz;
/** @label Planet sink (fraction of radius below horizon)
 *  @range -1, 1
 *  @default -0.20 */
uniform float u_sink;
/** @label Ring tilt (vertical squash)
 *  @range 0.02, 0.6
 *  @default 0.062 */
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
float n1(float x){ float i = floor(x), f = fract(x); float u = f*f*(3.-2.*f); return mix(hash11(i), hash11(i+1.), u); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }

// ridged 1D mountain profile, 4 octaves, returns ~0..1
float ridge(float x, float s){
  float v = 0., a = .55, f = 1.;
  for (int i = 0; i < 4; i++){
    float n = n1(x*f + s*13.7 + float(i)*5.1);
    n = 1. - abs(2.*n - 1.);
    v += a * n * n;
    f *= 2.13; a *= .45;
  }
  return v;
}

float prof(float x, float s){
  float m = 0.45 + 0.75 * n1(x * 0.23 + s * 7.1);
  return pow(ridge(x, s), 1.35) * m;
}

void main(){
  float H = 1400.;
  vec2 P = gl_FragCoord.xy / u_res.y * H;      // y up, px-ish units
  float W = u_res.x / u_res.y * H;
  float yT = P.y / H;                           // 0 bottom .. 1 top

  // ---------- SKY ----------
  float above = max(P.y - u_hz, 0.) / (H - u_hz);
  vec3 sky = mix(u_skyHz, u_skyMid, ss(0.0, 0.42, above));
  sky = mix(sky, u_skyTop, ss(0.30, 1.0, above));
  // warm-less dusk afterglow: faint violet band above teal
  sky += vec3(0.10, 0.07, 0.20) * exp(-pow((above - 0.16) / 0.10, 2.)) * 0.35;
  // horizon brightening (lighter, thin)
  sky += u_skyHz * 0.35 * exp(-above * 14.);
  vec3 col = sky;

  // ---------- PLANET ----------
  vec2 C = vec2(u_px * W, u_hz - u_sink * u_pr);
  vec2 q = P - C;
  float R = u_pr;
  float r = length(q);
  vec3 L = normalize(vec3(-0.85, 0.32, -0.42));   // light from upper-left, slightly behind

  // atmosphere halo outside the limb
  float rim = r / R;
  if (rim > 1.0){
    float halo = exp(-(rim - 1.0) * 22.);
    vec2 dir = q / r;
    float lit = clamp(dot(dir, normalize(L.xy)) * 0.5 + 0.55, 0., 1.);
    col += vec3(0.45, 0.70, 0.85) * halo * (0.06 + 0.42 * lit * lit);
  } else {
    vec3 n = vec3(q / R, sqrt(max(1. - rim*rim, 0.)));
    // banding along tilted latitude
    float ca = cos(u_roll), sa = sin(u_roll);
    float lat = (-sa * n.x + ca * n.y);
    float warp = n2(vec2(n.x * 3.0, lat * 9.0) + u_seed) * 0.08;
    float b = lat + warp;
    float bands = 0.6 + 0.16 * sin(b * 23.0) + 0.10 * sin(b * 57.0 + 1.3) + 0.12 * (n2(vec2(b * 40.0, n.x * 2.0)) - .5);
    vec3 surfA = vec3(0.62, 0.66, 0.74);   // silver-blue
    vec3 surfB = vec3(0.40, 0.40, 0.52);   // violet dusk
    vec3 surf = mix(surfB, surfA, clamp(bands, 0., 1.));
    float d = dot(n, L);
    float diff = ss(-0.05, 0.6, d);
    // soft terminator
    vec3 day = surf * diff * 0.85;
    // night side picks up faint sky bounce
    vec3 night = vec3(0.020, 0.024, 0.050) + u_skyMid * 0.12 * n.z;
    vec3 pc = night + day;
    // fresnel atmosphere inside limb
    float fr = pow(1. - n.z, 3.0);
    float litRim = clamp(dot(normalize(n.xy + 1e-4), normalize(L.xy)) * 0.5 + 0.5, 0., 1.);
    pc += vec3(0.42, 0.70, 0.86) * fr * (0.12 + 0.75 * litRim * litRim);
    // limb antialias
    float aa = ss(1.0, 0.996, rim);
    col = mix(col, pc, aa);
  }

  // ---------- RINGS ----------
  {
    float ca = cos(u_roll), sa = sin(u_roll);
    vec2 rq = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);
    float rr = length(vec2(rq.x, rq.y / u_tilt)) / R;
    float inner = 1.38, outer = 2.35;
    float inRing = ss(inner, inner + 0.015, rr) * ss(outer, outer - 0.03, rr);
    // ring structure
    float t = (rr - inner) / (outer - inner);
    float dens = 0.60 + 0.20 * sin(t * 29.0) + 0.12 * sin(t * 67.0 + 2.0) + 0.18 * (n1(t * 48.0 + u_seed) - .5);
    dens *= 1.0 - 0.75 * ss(0.62, 0.66, t) * ss(0.72, 0.68, t);   // Cassini-like gap
    dens *= mix(0.6, 1.0, ss(0.0, 0.25, t));
    dens = clamp(dens, 0., 1.);
    bool front = rq.y < 0.0;
    bool behindPlanet = (!front) && (r < R);
    // ring lit by the same light: brighter on the left
    float side = clamp(0.62 - 0.32 * rq.x / (R * outer), 0.3, 1.0);
    // planet shadow onto the back-right ring
    float shadow = 1.0;
    vec3 ringCol = vec3(0.70, 0.74, 0.82) * side * shadow;
    float a = inRing * dens * 0.62;
    if (front && r < R) a *= 0.7;
    if (!behindPlanet) col = mix(col, ringCol, a);
  }

  // ---------- RIDGES (far -> near) ----------
  float baseY[5]; float amp[5]; float freq[5]; float haze[5];
  baseY[0] = u_hz - 12.;  amp[0] = 46.;  freq[0] = 1.0 / 150.;  haze[0] = 0.86;
  baseY[1] = u_hz - 70.;  amp[1] = 95.;  freq[1] = 1.0 / 230.;  haze[1] = 0.50;
  baseY[2] = u_hz - 150.; amp[2] = 150.; freq[2] = 1.0 / 320.;  haze[2] = 0.24;
  baseY[3] = u_hz - 250.; amp[3] = 210.; freq[3] = 1.0 / 430.;  haze[3] = 0.11;
  baseY[4] = u_hz - 400.; amp[4] = 320.; freq[4] = 1.0 / 620.;  haze[4] = 0.02;

  vec3 hazeCol = mix(u_skyHz, u_skyMid, 0.45) * 0.80;
  vec3 nearCol = vec3(0.010, 0.012, 0.024);
  float beaconY = -1e4; float beaconX = u_bx * W;
  if (abs(P.x - u_bx * W) < 90.0) for (int k = 0; k < 25; k++){
    float bx = u_bx * W + (float(k) - 12.0) * 5.0;
    float bh = baseY[4] + amp[4] * prof(bx * freq[4], u_seed + 4.0 * 3.3);
    if (bh > beaconY){ beaconY = bh; beaconX = bx; }
  }

  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float h = baseY[i] + amp[i] * prof(P.x * freq[i], u_seed + fi * 3.3);
    if (P.y < h){
      vec3 lc = mix(nearCol, hazeCol, haze[i]);
      // valley mist: lower parts of each ridge lighten toward haze
      float depthIn = h - P.y;
      // valley mist breaks into drifting banks instead of a flat gradient
      float bank = n2(vec2(P.x / 240. + fi * 7.3, P.y / 34.)) * 0.7 + n2(vec2(P.x / 90. - fi * 3.1, P.y / 14.)) * 0.3;
      float mist = ss(0.0, 110. + fi * 60., depthIn) * (0.62 - fi * 0.13) * mix(0.35, 1.35, bank);
      // rock faces: vertical erosion gullies running down from the crest
      float fan = P.x + depthIn * 0.7 * sin(P.x * freq[i] * 4.0 + fi);
      float gul = n2(vec2(fan * freq[i] * 16.0, depthIn / (9. + fi * 7.)));
      float gul2 = n2(vec2(fan * freq[i] * 45.0 + 3.0, depthIn / (5. + fi * 4.)));
      float rock = mix(0.84, 1.12, gul * 0.6 + gul2 * 0.4);
      lc *= mix(rock, 1.0, haze[i] * 0.5);
      lc = mix(lc, mix(hazeCol, u_skyHz * 0.85, 0.5), clamp(mist, 0., 1.));
      // thin rim light along the crest, stronger toward the planet / light side
      float slope = prof((P.x + 2.0) * freq[i], u_seed + fi * 3.3) - prof((P.x - 2.0) * freq[i], u_seed + fi * 3.3);
      float facing = clamp(0.55 - slope * 6.0, 0.0, 1.0);
      float nearPlanet = exp(-pow((P.x - C.x) / (R * 1.6), 2.));
      float rimL = exp(-depthIn / 1.1) * (0.25 + 0.75 * facing) * (0.30 + 0.70 * nearPlanet) * (1.0 - haze[i] * 0.6) * 0.9;
      lc += vec3(0.62, 0.80, 0.90) * rimL;
      // light-facing slopes stay lit a little way below the crest
      float face = exp(-depthIn / (22. + fi * 18.)) * facing * (0.25 + 0.75 * nearPlanet) * (1.0 - haze[i]) * gul;
      lc += hazeCol * 0.55 * face;
      col = lc;
    }
  }

  // ---------- BEACON (single gold point) ----------
  {
    vec2 bp = vec2(beaconX, beaconY + 2.5);
    float d = length(P - bp);
    col += u_gold * (exp(-d * d / 3.0) * 1.3 + exp(-d / 12.0) * 0.12);
  }

  // subtle vignette + dither
  vec2 uv = gl_FragCoord.xy / u_res;
  col *= 1.0 - 0.28 * pow(length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.2)), 2.0);
  col += (hash12(gl_FragCoord.xy + u_seed) - 0.5) / 255.0 * 1.5;
  gl_FragColor = vec4(col, 1.0);
}
