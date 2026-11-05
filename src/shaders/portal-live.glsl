precision highp float;
// S11 — The Final Portal, live version of dir-portal-v3:
// swirling far universe, flowing tunnel, star infall, shimmering chromatic rim,
// cursor micro-lens, rippling mirror plain with a calm zone under the type,
// and an in-shader camera dive (u_dive) through the aperture.

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Ring center X (design px)
 *  @range 0, 1440
 *  @default 720 */
uniform float u_cx;
/** @label Ring center Y (design px from top)
 *  @range 0, 1600
 *  @default 470 */
uniform float u_cy;
/** @label Ring radius (design px)
 *  @range 50, 600
 *  @default 290 */
uniform float u_R;
/** @label Horizon Y (design px from top)
 *  @range 0, 1600
 *  @default 900 */
uniform float u_hy;
/** @label Lensing strength
 *  @range 0, 2
 *  @default 1.0 */
uniform float u_lens;
/** @label Reflectivity
 *  @range 0, 1
 *  @default 0.42 */
uniform float u_refl;
/** @label Ripple
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_ripple;
/** @label Aperture (far opening size multiplier)
 *  @range 0.5, 3
 *  @default 1.0 */
uniform float u_open;
/** @label Pull (star infall brightness / lens boost)
 *  @range 0, 2
 *  @default 0.6 */
uniform float u_pull;
/** @label Flow clock (nebula swirl + tunnel travel, integrated in JS)
 *  @range 0, 1000
 *  @default 0 */
uniform float u_flow;
/** @label Infall clock (stars spiralling in, integrated in JS)
 *  @range 0, 1000
 *  @default 0 */
uniform float u_fall;
/** @label Rim intensity
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_rim;
/** @label Cursor X (design px)
 *  @range 0, 1440
 *  @default 720 */
uniform float u_mx;
/** @label Cursor Y (design px)
 *  @range 0, 1600
 *  @default 450 */
uniform float u_my;
/** @label Cursor lens strength
 *  @range 0, 2
 *  @default 0.0 */
uniform float u_mk;
/** @label Dive (0 = rest, 1 = through the aperture)
 *  @range 0, 1
 *  @default 0 */
uniform float u_dive;
/** @label Warp streaks
 *  @range 0, 1
 *  @default 0 */
uniform float u_streak;
/** @label Dive screen anchor X (design px)
 *  @range 0, 1440
 *  @default 720 */
uniform float u_ax;
/** @label Dive screen anchor Y (design px)
 *  @range 0, 1600
 *  @default 450 */
uniform float u_ay;
/** @label Calm zone X (reflection suppressed under type)
 *  @range 0, 1440
 *  @default 720 */
uniform float u_tx;
/** @label Calm zone Y
 *  @range 0, 1600
 *  @default 1040 */
uniform float u_ty;
/** @label Calm zone half-width
 *  @range 10, 800
 *  @default 330 */
uniform float u_tw;
/** @label Calm zone half-height
 *  @range 10, 600
 *  @default 120 */
uniform float u_th;
/** @label Calm amount
 *  @range 0, 1
 *  @default 0.94 */
uniform float u_calm;
/** @label Gold
 *  @color
 *  @default #E8C27A */
uniform vec3 u_gold;
/** @label Rose
 *  @color
 *  @default #CF8577 */
uniform vec3 u_rose;
/** @label Wine
 *  @color
 *  @default #2B0D1C */
uniform vec3 u_wine;
/** @label Void
 *  @color
 *  @default #030409 */
uniform vec3 u_void;
/** @label Midnight
 *  @color
 *  @default #070B1C */
uniform vec3 u_mid;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float starLayer(vec2 q, float cell, float prob, float r0, float seed){
  vec2 id = floor(q/cell); vec2 f = q - id*cell;
  if (hash12(id + seed) > prob) return 0.0;
  vec2 pos = (hash22(id + seed*1.7)*0.8+0.1)*cell;
  float d = length(f - pos);
  float b = pow(hash12(id + seed*3.1), 6.0);
  float r = mix(0.5, r0, b);
  return exp(-d*d/(r*r*0.7)) * (0.12 + 1.4*b);
}
float stars(vec2 q, float s){
  float v = starLayer(q, 9.0, 0.10, 1.0, 11.0+s);
  v += starLayer(q, 31.0, 0.32, 1.6, 23.0+s);
  v += starLayer(q, 97.0, 0.5, 2.4, 37.0+s);
  return v;
}
float starsLite(vec2 q, float s){
  return starLayer(q, 23.0, 0.20, 1.3, 51.0+s) + starLayer(q, 71.0, 0.45, 2.2, 63.0+s);
}

// the sky above the plain, q in design px (y down). hi = full detail (not the reflection)
vec3 sky(vec2 q, bool hi){
  vec2 c = vec2(u_cx, u_cy);
  vec2 d = q - c;
  float r = length(d);
  float R = u_R;
  vec3 col = u_void;

  col = mix(col, u_mid, ss(0.0, u_hy, q.y) * 0.9);

  if (r > R) {
    vec2 n = d / r;
    // cursor micro-lens: the image of the sky is pushed away from the cursor
    vec2 dm = q - vec2(u_mx, u_my);
    float lm = length(dm) + 1e-3;
    vec2 cq = q - dm / lm * u_mk * 2600.0 / max(lm, 40.0) * exp(-lm / 260.0);
    vec2 cd = cq - c; float cr = length(cd) + 1e-3; vec2 cn = cd / cr;
    // gravitational lensing of the ring
    float k = u_lens * (1.0 + 0.25 * u_pull) * R * R * 1.15 / cr;
    vec2 src = c + cn * (cr - k);
    float st = stars(src, 0.0);
    float tint = hash12(floor(src/31.0));
    vec3 sc = mix(vec3(0.80,0.86,1.0), vec3(1.0,0.95,0.88), tint);
    float near = ss(R*1.01, R*1.05, r);
    col += sc * st * 0.7 * near;
    if (hi) {
      // a nearer shell of stars spiralling into the portal (two crossfaded phases)
      float rr = max(cr - k * 0.6, 1.0);
      for (int i = 0; i < 2; i++) {
        float f = fract(u_fall * 0.035 + float(i) * 0.5);
        float w = sin(3.14159 * f);
        vec2 sp = c + rot(-f * 0.9 + float(i) * 1.7) * (cn * rr * exp2(f));
        float s2 = starsLite(sp, float(i) * 13.0);
        // tangential tails grow with infall speed near the rim
        col += mix(vec3(1.0,0.90,0.78), vec3(0.85,0.90,1.0), float(i)) * s2 * w * (0.35 + 0.45 * u_pull) * near
               * (0.6 + 0.8 * exp(-(r - R) / (R * 0.6)));
      }
    }
    // faint cool halo of bent light hugging the outside of the ring
    col += vec3(0.50,0.70,0.95) * (0.05 + 0.04 * u_pull) * exp(-(r-R)/(R*0.35));
  } else {
    // a TUNNEL: a cone of circles whose centres drift toward an off-axis far opening
    float fe = clamp(0.34 * u_open, 0.1, 0.92);
    vec2 cf = c + vec2(0.22, -0.17) * R * (1.0 - fe) / 0.66;   // far opening centre
    float g = fe * R, h = R - g;
    vec2 a = q - cf, b = c - cf;
    float A = dot(b,b) - h*h, B = -2.0*(dot(a,b) + g*h), C = dot(a,a) - g*g;
    float disc = max(B*B - 4.0*A*C, 0.0);
    float s1 = (-B - sqrt(disc)) / (2.0*A), s2 = (-B + sqrt(disc)) / (2.0*A);
    float sP = (s1 >= -0.001 && s1 <= 1.001) ? s1 : s2;
    vec3 neb = vec3(0.0);
    vec2 dl = q - cf;
    float rf = length(dl);
    if (rf < g) {
      vec2 p = dl / g;
      float lp = length(p);
      // differential swirl: the core turns faster than the rim
      p = rot(u_flow * 0.045 + (1.0 - lp) * (0.9 + 0.4 * sin(u_flow * 0.11))) * p;
      vec2 sp = p * 1.7 + vec2(3.1, 7.4);
      vec2 w = vec2(fbm(sp + vec2(0.0, u_flow * 0.05)), fbm(sp + vec2(5.2, 1.3) - u_flow * 0.04));
      float n = fbm(sp * 1.3 + w * 1.8);
      vec2 cp = p - vec2(0.28, -0.40);
      float core = exp(-dot(cp,cp) * 5.0) * (0.35 + 0.9 * ss(0.35, 0.8, n));
      float lane = exp(-abs(p.y + 0.55*p.x - 0.05 + (n-0.5)*0.5) * 3.2);
      neb = u_wine * 0.35;
      neb = mix(neb, u_wine * 1.2, ss(0.25, 0.7, n));
      neb += u_rose * 0.6 * ss(0.4, 0.85, n) * (0.25 + 0.75*lane);
      neb = mix(neb, u_gold, ss(0.5, 1.0, n * lane * 0.6 + core * 0.8));
      float dust = ss(0.50, 0.80, fbm(sp * 3.1 + w * 2.0 + 21.0));
      neb *= 1.0 - dust * 0.6;
      // the gold-rose universe glows brighter as we dive into it
      neb *= 1.0 + 2.4 * u_dive * u_dive;
      if (hi) {
        float wst = stars(p * 260.0 + 500.0, 4.0);
        neb += vec3(1.0, 0.88, 0.74) * wst * 0.8 * (1.0 - ss(0.25, 0.7, u_dive));
      }
      neb *= 1.0 - 0.45 * ss(0.7, 1.0, lp) * (1.0 - u_dive);
      float fr = rf - g; neb += vec3(0.95,0.85,0.75) * 0.45 * exp(-fr*fr/1.0);
    } else {
      float sc = clamp(sP, 0.0, 1.0);
      float rho = g + sc * h;
      float depth = g / rho;                     // 1 at far end
      vec2 wc = cf + sc * b;
      vec2 wd = q - wc;
      float ang = atan(wd.y, wd.x);
      vec3 warm = mix(u_rose, u_gold, 0.3);
      float facing = 0.55 + 0.45 * cos(ang - 2.4);
      float leak = pow(depth, 2.2) * facing;
      neb = u_wine * 0.6 * leak + warm * 0.10 * pow(depth, 5.0);
      // grazing streaks running down the wall toward us (travel with the flow)
      float kk = rho / g;
      float st = noise(vec2(ang * 30.0, kk * 1.6 - u_flow * 0.35)) * noise(vec2(ang * 7.0 + 4.0, kk * 0.5 - u_flow * 0.12));
      neb += warm * (0.30 + 0.5 * u_dive) * ss(0.30, 0.70, st) * leak;
      // receding hairline rings, sliding toward the viewer
      float steps = 2.4;
      float ringf = fract(kk * steps - u_flow * 0.09);
      float dpx = min(ringf, 1.0 - ringf) / steps * g * (1.0 + length(b)/h);
      neb += vec3(0.70, 0.74, 0.82) * (0.08 + 0.25 * u_dive) * exp(-dpx*dpx/1.2) * (1.0 - 0.7*sc) * facing;
    }
    col = neb;
  }

  // the rim: razor-thin white-hot line with a shimmering chromatic split
  float e = r - R;
  float ang = atan(d.y, d.x);
  float sh = noise(vec2(ang * 6.0 + u_time * 0.35, u_time * 0.25));
  float sh2 = noise(vec2(ang * 22.0 - u_time * 1.1, 3.0));
  float split = 1.3 * (0.55 + 0.9 * sh) * (0.8 + 0.4 * u_rim);
  float w0 = 1.1 * (0.85 + 0.3 * sh2);
  float er = (e + split)/w0, eg = e/w0, eb = (e - split)/w0;
  float rc = exp(-er*er), gc = exp(-eg*eg), bc = exp(-eb*eb);
  vec3 rim = vec3(rc*0.7 + gc*0.75, gc*1.0 + rc*0.15 + bc*0.25, bc*0.8 + gc*0.75);
  float flick = 0.82 + 0.36 * sh2;
  col += rim * 1.9 * flick * u_rim;
  col += vec3(0.85,0.88,0.95) * 0.16 * u_rim * exp(-abs(e) / (6.0 + 6.0 * (u_rim - 1.0)));
  col += u_rose * (0.04 + 0.05 * (u_rim - 1.0)) * exp(-max(-e, 0.0) / 24.0) * step(e, 0.0);
  return col;
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 q0 = fc / u_res.x * 1440.0;   // design px, y down (screen)

  // ---- camera dive: centre on the far opening and fly into it
  vec2 c = vec2(u_cx, u_cy);
  float fe = clamp(0.34 * u_open, 0.1, 0.92);
  vec2 cf = c + vec2(0.22, -0.17) * u_R * (1.0 - fe) / 0.66;
  float dv = u_dive;
  vec2 T = mix(c, cf, ss(0.15, 0.7, dv));
  vec2 P = mix(T, vec2(u_ax, u_ay), ss(0.0, 0.35, dv));
  float Z = exp(dv * dv * 2.9);           // up to ~18x
  vec2 q = T + (q0 - P) / Z;

  vec3 col;
  if (q.y < u_hy) {
    col = sky(q, true);
  } else {
    float dy = q.y - u_hy;
    float z = 1.0 / (dy + 6.0);
    vec2 pu = vec2(q.x * z * 4.0, 900.0 * z);
    float rip = (noise(pu * vec2(0.6, 1.0) + vec2(u_time * 0.03, u_time * 0.22)) - 0.5);
    rip += (noise(pu * vec2(1.4, 2.3) + vec2(7.0 - u_time * 0.05, u_time * 0.35)) - 0.5) * 0.5;
    // slow swells travelling toward the viewer
    rip += 0.22 * sin(pu.y * 7.0 - u_time * 0.9 + noise(pu * 0.7) * 3.0);
    float amp = u_ripple * (0.6 + dy * 0.012);
    vec2 rq = vec2(q.x + rip * amp * 1.4, u_hy - dy + rip * amp * 0.4);
    vec3 refl = sky(rq, false);
    float fres = mix(1.0, 0.45, ss(0.0, 500.0, dy));
    float streak = noise(vec2(q.x * 0.0025 + rip * 0.3, 1400.0 * z - u_time * 0.02));
    streak = 0.65 + 0.7 * ss(0.3, 0.8, streak);
    // calm zone: the mirror goes matte where the type sits
    vec2 tz = (q - vec2(u_tx, u_ty)) / vec2(u_tw, u_th);
    float calm = 1.0 - u_calm * exp(-pow(dot(tz, tz), 1.4) * 0.9);
    col = mix(u_void, u_mid, 0.5) * 0.8 + refl * u_refl * fres * streak * calm;
    col *= mix(1.0, 0.55, ss(0.0, 450.0, dy));
  }

  float hdy = (q.y - u_hy)/0.6; float hl = exp(-hdy*hdy);
  float hx = 1.0 - ss(0.05, 0.5, abs(q.x/1440.0 - 0.5));
  col += vec3(0.68, 0.71, 0.78) * hl * (0.12 + 0.35 * hx);
  float sx = (q.x - u_cx)/(u_R*1.1); float spill = exp(-sx*sx) * exp(-max(q.y - u_hy, 0.0)/30.0) * step(u_hy, q.y);
  col += mix(u_gold, vec3(1.0), 0.6) * spill * (0.05 + 0.05 * (u_rim - 1.0));

  // ---- warp streaks during the dive (screen space, radiating from the anchor)
  if (u_streak > 0.01) {
    vec2 v = q0 - vec2(u_ax, u_ay);
    float rr = length(v);
    float an = atan(v.y, v.x);
    float lane = floor(an * 57.3);
    float hsh = hash12(vec2(lane, 3.0));
    float ofs = fract(an * 57.3) - 0.5;
    float seg = fract(log(rr + 1.0) * 0.9 - u_fall * 0.06 + hsh * 7.0);
    float line = ss(0.75, 1.0, seg) * exp(-ofs * ofs * 40.0) * step(0.55, hsh);
    vec3 wc = mix(u_gold, vec3(1.0, 0.95, 0.9), hsh);
    col += wc * line * ss(30.0, 500.0, rr) * u_streak * 1.4;
  }

  // beyond: a quiet, crisp star field in front of the far universe
  if (dv > 0.5) col += vec3(1.0, 0.92, 0.84) * stars(q0 + vec2(0.0, u_flow * 0.6), 9.0) * 0.55 * ss(0.5, 0.8, dv) * (1.0 - u_streak);

  vec2 uv = fc / u_res;
  float vig = 1.0 - 0.55 * (1.0 - 0.6 * dv) * pow(length((uv - 0.5) * vec2(1.0, 0.9)) * 1.3, 2.4);
  col *= clamp(vig, 0.0, 1.0);

  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
