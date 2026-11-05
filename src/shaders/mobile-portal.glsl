precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @label Design width (px)
 *  @range 100, 1440
 *  @default 1440 */
uniform float u_dw;
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

// star layer in design px; stretch = tangential smear factor near the lens
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

// the sky above the plain, q in design px (y down)
vec3 sky(vec2 q){
  vec2 c = vec2(u_cx, u_cy);
  vec2 d = q - c;
  float r = length(d);
  float R = u_R;
  vec3 col = u_void;

  // faint midnight gradient towards the horizon
  col = mix(col, u_mid, ss(0.0, u_hy, q.y) * 0.9);

  if (r > R) {
    // gravitational lensing: sample stars from a source plane pushed away from the ring
    vec2 n = d / r;
    float k = u_lens * R * R * 1.15 / r;
    vec2 src = c + n * (r - k);
    // tangential smear near the rim: rotate sample slightly
    float st = stars(src, 0.0);
    float tint = hash12(floor(src/31.0));
    vec3 sc = mix(vec3(0.80,0.86,1.0), vec3(1.0,0.95,0.88), tint);
    // dim stars far away and right next to the rim (shadow / photon ring)
    float near = ss(R*1.01, R*1.05, r);
    col += sc * st * 0.7 * near;
    // very faint cool halo of bent light hugging the outside of the ring
    col += vec3(0.50,0.70,0.95) * 0.05 * exp(-(r-R)/(R*0.35));
  } else {
    // the other universe: warm gold-rose nebula
    vec2 p = d / R;                 // -1..1
    float rr = r / R;
    vec2 sp = p * 1.7 + vec2(3.1, 7.4);
    vec2 w = vec2(fbm(sp), fbm(sp + vec2(5.2, 1.3)));
    float n = fbm(sp * 1.3 + w * 1.8);
    float n2 = fbm(sp * 2.6 - w + 9.0);
    // a soft luminous core offset up-left, the far universe's own origin
    vec2 cp = p - vec2(0.34, -0.50);
    float core = exp(-dot(cp,cp) * 4.5) * (0.35 + 0.9 * ss(0.35, 0.8, n));
    // a diagonal luminous lane of gas sweeping across the far universe
    float lane = exp(-abs(p.y + 0.55*p.x - 0.05 + (n-0.5)*0.5) * 3.2);
    float ridge = pow(max(0.0, 1.0 - abs(n2 - 0.5) * 5.0), 3.0);
    vec3 neb = u_wine * 0.30;
    neb = mix(neb, u_wine * 1.1, ss(0.25, 0.7, n));
    neb += u_rose * 0.55 * ss(0.4, 0.85, n) * (0.25 + 0.75*lane);
    neb += u_rose * 0.35 * ridge * lane;
    neb = mix(neb, u_gold * 1.0, ss(0.45, 1.0, n * lane * 0.6 + core * 0.75));
    // dark dust lanes
    float dust = ss(0.50, 0.80, fbm(sp * 3.1 + w * 2.0 + 21.0));
    neb *= 1.0 - dust * 0.6;
    neb += u_gold * core * 0.18;
    // warm stars, finer
    float wst = stars(q * 0.8 + 500.0, 4.0);
    neb += vec3(1.0, 0.86, 0.70) * wst * 0.9;
    // depth: darken toward the rim (seen through a tunnel)
    neb *= 1.0 - 0.15 * ss(0.85, 1.0, rr);
    col = neb;
  }

  // the rim: razor-thin white-hot line with chromatic split
  float e = r - R;
  float w0 = 1.1;
  float er = (e + 1.3)/w0, eg = e/w0, eb = (e - 1.3)/w0;
  float rc = exp(-er*er), gc = exp(-eg*eg), bc = exp(-eb*eb);
  vec3 rim = vec3(rc*0.7 + gc*0.75, gc*1.0 + rc*0.15 + bc*0.25, bc*0.8 + gc*0.75);
  col += rim * 1.9;
  // inner glow of the rim (light from beyond)
  col += mix(u_gold, vec3(1.0), 0.5) * 0.22 * exp(-abs(e) / 7.0);
  col += u_rose * 0.10 * exp(-max(-e, 0.0) / 40.0) * step(e, 0.0);
  return col;
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 q = fc / u_res.x * u_dw;   // design px, y down
  vec3 col;

  if (q.y < u_hy) {
    col = sky(q);
  } else {
    float dy = q.y - u_hy;
    // perspective depth on the plain (closer = bigger dy)
    float z = 1.0 / (dy + 6.0);
    vec2 pu = vec2(q.x * z * 4.0, 900.0 * z);
    float rip = (noise(pu * vec2(0.6, 1.0) + vec2(0.0, u_time*0.1)) - 0.5);
    rip += (noise(pu * vec2(1.4, 2.3) + 7.0) - 0.5) * 0.5;
    float amp = u_ripple * (0.6 + dy * 0.012);
    vec2 rq = vec2(q.x + rip * amp * 1.4, u_hy - dy + rip * amp * 0.4);
    vec3 refl = sky(rq);
    // fresnel-ish: reflection strongest near horizon, fades closer to viewer
    float fres = mix(1.0, 0.45, ss(0.0, 500.0, dy));
    // long horizontal sheen streaks of a still surface
    float streak = noise(vec2(q.x * 0.0025 + rip * 0.3, 1400.0 * z));
    streak = 0.65 + 0.7 * ss(0.3, 0.8, streak);
    col = mix(u_void, u_mid, 0.5) * 0.8 + refl * u_refl * fres * streak;
    // the plain darkens toward the viewer
    col *= mix(1.0, 0.55, ss(0.0, 450.0, dy));
  }

  // horizon hairline (silver, fading to the edges)
  float hdy = (q.y - u_hy)/0.6; float hl = exp(-hdy*hdy);
  float hx = 1.0 - ss(0.05, 0.5, abs(q.x/u_dw - 0.5));
  col += vec3(0.68, 0.71, 0.78) * hl * (0.12 + 0.35 * hx);
  // light spill of the portal on the plain near the horizon
  float sx = (q.x - u_cx)/(u_R*1.1); float spill = exp(-sx*sx) * exp(-max(q.y - u_hy, 0.0)/30.0) * step(u_hy, q.y);
  col += mix(u_gold, vec3(1.0), 0.6) * spill * 0.05;

  // vignette
  vec2 uv = fc / u_res;
  float vig = 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.0, 0.9)) * 1.3, 2.4);
  col *= clamp(vig, 0.0, 1.0);

  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
