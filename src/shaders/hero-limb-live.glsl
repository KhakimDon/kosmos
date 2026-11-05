precision highp float;
// Live variant of hero-limb-v3 for the S00 choreography (s00.js):
// adds a camera (zoom about a point), sky parallax, a dawn sweep along the limb,
// gold-point intensity / ignition flare and a growing signal line.

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @default 1000 */
uniform float u_h;
/** @default 1010 */
uniform float u_bx;
/** @default 590 */
uniform float u_by;
/** @default 2400 */
uniform float u_R;
/** @default -0.06 */
uniform float u_tilt;
/** @default 1.0 */
uniform float u_cres;
/** @default 1.0 */
uniform float u_stars;
/** @default 1.0 */
uniform float u_neb;
/** @default 1.0 */
uniform float u_sig;
/** @color
 *  @default #E8C27A */
uniform vec3 u_gold;
/** @color
 *  @default #7FD8FF */
uniform vec3 u_cyan;
/** @color
 *  @default #3A2470 */
uniform vec3 u_violet;
/** @color
 *  @default #030409 */
uniform vec3 u_void;

// ---- live controls ----
/** @label Camera zoom about (u_zx,u_zy)
 *  @default 1 */
uniform float u_zoom;
/** @default 1090 */
uniform float u_zx;
/** @default 600 */
uniform float u_zy;
/** @label Sky zoom (depth: less than u_zoom)
 *  @default 1 */
uniform float u_szoom;
/** @label Sky offset x (design px)
 *  @default 0 */
uniform float u_sx;
/** @default 0 */
uniform float u_sy;
/** @label Dawn sweep head (arc px from break point; 0 = fully lit)
 *  @default 0 */
uniform float u_head;
/** @label Sweep glint intensity
 *  @default 0 */
uniform float u_glint;
/** @label Gold point intensity
 *  @default 1 */
uniform float u_pt;
/** @label Ignition flare
 *  @default 0 */
uniform float u_flare;
/** @label Signal reveal 0..1
 *  @default 1 */
uniform float u_sigH;
/** @label Signal tip glow
 *  @default 0 */
uniform float u_tip;
/** @label Signal top shift (design px, negative = taller)
 *  @default 0 */
uniform float u_sigTop;
/** @label Overall exposure
 *  @default 1 */
uniform float u_expo;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }

vec3 starLayer(vec2 q, float cell, float prob, float maxR, float seed){
  vec2 id = floor(q/cell); vec2 f = q - id*cell;
  if (hash12(id + seed) > prob) return vec3(0.);
  vec2 pos = (hash22(id + seed*1.7)*0.8+0.1)*cell;
  float d = length(f - pos);
  float b = pow(hash12(id + seed*3.1), 8.0);
  float r = mix(0.5, maxR, b);
  float core = exp(-d*d/(r*r*0.6));
  float t = hash12(id + seed*5.3);
  vec3 c = mix(vec3(1.0,0.86,0.72), vec3(0.76,0.85,1.0), ss(0.2,0.8,t));
  // slow scintillation of the brighter stars
  float tw = 1.0 + 0.35 * b * sin(u_time * (1.3 + 3.0*t) + t * 40.0);
  return c*core*(0.12+1.3*b)*tw;
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float k = 1440.0 / u_res.x;
  vec2 q0 = fc * k;                      // design px, y down
  vec2 Z = vec2(u_zx, u_zy);
  vec2 q = Z + (q0 - Z) / u_zoom;        // planet / light camera
  vec2 qs = Z + (q0 - Z) / u_szoom + vec2(u_sx, u_sy);   // sky camera (further away)

  // ---------- deep space ----------
  vec2 bd = normalize(vec2(1.0, 0.34));
  vec2 bn = vec2(-bd.y, bd.x);
  float bandDist = dot(qs - vec2(0.0, 120.0), bn);
  float band = exp(-bandDist*bandDist / (2.0*170.0*170.0));
  vec2 sp = qs / 420.0;
  float n1 = fbm(sp + vec2(3.1, 7.7));
  float n2 = fbm(sp*2.1 + n1*1.3 + 9.0);
  float lanes = ss(0.50, 0.72, n2);
  float glowB = band * (0.35 + 0.65*n1) * (1.0 - 0.75*lanes);

  vec3 col = u_void;
  col += vec3(0.55, 0.60, 0.75) * glowB * 0.040 * u_neb;
  float vd = ss(0.42, 0.8, fbm(sp*0.8 + 21.0)) ;
  float vy = (q.y - 470.0)/220.0;
  float vmask = exp(-vy*vy) * ss(500.0, 1440.0, q.x);
  col += u_violet * vd * vmask * 0.22 * u_neb;

  vec3 st = starLayer(qs, 6.0, 0.10 + 0.25*band, 0.9, 11.0);
  st += starLayer(qs, 19.0, 0.28, 1.4, 23.0);
  st += starLayer(qs, 61.0, 0.40, 2.1, 37.0);
  st += starLayer(qs, 197.0, 0.55, 2.8, 53.0);
  st *= (1.0 - 0.8*lanes*band);
  col += st * u_stars * 0.85;

  // ---------- planet ----------
  vec2 tilt = vec2(sin(u_tilt), cos(u_tilt));
  vec2 up = vec2(tilt.x, -tilt.y);
  vec2 C = vec2(u_bx, u_by) - up * u_R;
  vec2 rel = q - C;
  float r = length(rel);
  float h = r - u_R;
  float ang = atan(dot(rel, vec2(up.y, -up.x)), dot(rel, up));
  float s = ang * u_R;
  float as = abs(s);

  float along = exp(-as / 640.0);
  float alongWide = exp(-as / 1300.0);
  // dawn sweep: the limb is lit from the far ends inward, until the head reaches the point
  float lit = ss(u_head - 110.0, u_head, as);
  float glint = exp(-abs(as - u_head) / 22.0) * u_glint;

  float inside = 1.0 - ss(-0.6, 0.6, h);
  vec3 body = vec3(0.006, 0.008, 0.016);
  float rim = exp(h / 26.0) * inside;
  body += u_cyan * rim * 0.06 * alongWide * lit;
  float deep = exp(h / 180.0) * inside;
  body += vec3(0.04, 0.06, 0.12) * deep * 0.25 * alongWide * lit;
  float cl = fbm(vec2(s/240.0, h/60.0) + 4.0);
  body += vec3(0.05, 0.07, 0.11) * cl * deep * 0.35 * alongWide * lit;
  // stars must not shine through the planet
  col = mix(col, body, inside);

  float hp = max(h, 0.0);
  float outside = ss(-0.8, 0.4, h);
  float razor = exp(-abs(h - 0.6) / 0.9);
  float haze  = exp(-hp / 7.0) * outside;
  float halo  = exp(-hp / 38.0) * outside;
  vec3 white = vec3(0.93, 0.95, 0.98);
  vec3 atm = mix(u_cyan, white, along) * razor * (0.25 + 1.6*along) * alongWide;
  atm += u_cyan * haze * (0.12 + 0.75*along) * alongWide;
  atm += vec3(0.30, 0.55, 0.80) * halo * 0.10 * alongWide;
  col += atm * u_cres * lit;
  // the travelling glint (a bead of light riding the razor edge)
  vec3 gl = white * razor * 2.4 + mix(u_cyan, white, 0.5) * haze * 1.1 + u_cyan * halo * 0.35;
  col += gl * glint;

  // ---------- the Origin breaking over the limb ----------
  vec2 B = vec2(u_bx, u_by);
  vec2 dB = q - B;
  float dist = length(dB);
  float L = u_pt;
  float bloom = exp(-dist / 70.0) * 0.16 + exp(-dist / 16.0) * 0.45;
  bloom *= ss(-6.0, 4.0, h);
  col += mix(white, u_gold, 0.35) * bloom * u_cres * L;
  float dawn = exp(-dist / 320.0) * ss(-20.0, 60.0, h) * exp(-hp / 140.0);
  col += mix(u_cyan, white, 0.6) * dawn * (0.10 * u_cres * L + 0.35 * u_flare);
  float streak = exp(-abs(dB.y) / 1.1) * exp(-abs(dB.x) / 240.0);
  col += white * streak * 0.18 * u_cres * L;
  // ignition: anamorphic flare + wide bloom
  float fl = exp(-abs(dB.y) / 1.6) * exp(-abs(dB.x) / 820.0) * 0.55
           + exp(-abs(dB.y) / 9.0) * exp(-abs(dB.x) / 260.0) * 0.12
           + exp(-dist / 110.0) * 0.45 + exp(-dist / 420.0) * 0.10;
  col += mix(white, u_gold, 0.45) * fl * u_flare * ss(-30.0, 10.0, h + 30.0);

  // gold point
  float core = exp(-dot(dB, dB) / (2.0 * 1.8 * 1.8));
  float corona = exp(-dist / 6.0);
  col += u_gold * (core * 2.2 + corona * 0.55) * L;

  // ---------- the signal ----------
  float above = ss(0.0, 30.0, B.y - q.y);
  float fade = exp(-(B.y - q.y) / 520.0);
  float lineX = abs(q.x - B.x);
  float line = exp(-lineX * lineX / (2.0 * 0.35 * 0.35)) * 0.9 + exp(-lineX / 5.0) * 0.06;
  float len = u_sigH * (B.y - 60.0);
  float yHead = B.y - len;
  float reveal = ss(yHead - 14.0, yHead + 24.0, q.y);
  float sig = line * above * (0.2 + 0.8*fade) * step(q.y, B.y) * ss(110.0 + u_sigTop, 330.0 + u_sigTop, q.y) * reveal;
  col += mix(white, u_gold, 0.18) * sig * u_sig;
  // leading tip of the growing signal
  float tipD = length(vec2(lineX * 1.0, (q.y - yHead) * 0.22));
  col += mix(white, u_gold, 0.3) * (exp(-tipD / 2.2) * 0.9 + exp(-tipD / 14.0) * 0.12) * u_tip * step(q.y, B.y);

  vec2 uv = fc / u_res;
  float vig = 1.0 - 0.55 * pow(length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.1)) * 1.2, 2.4);
  col *= clamp(vig, 0.0, 1.0);
  col *= u_expo;
  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
