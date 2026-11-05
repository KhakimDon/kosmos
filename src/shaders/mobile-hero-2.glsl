precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @label Design width (px)
 *  @range 100, 1440
 *  @default 1440 */
uniform float u_dw;
/** @label Signal top Y (design px)
 *  @range 0, 1000
 *  @default 330 */
uniform float u_st;
/** @time */
uniform float u_time;

/** @label Design height (px at 1440 wide)
 *  @range 600, 1400
 *  @default 1000 */
uniform float u_h;
/** @label Break point X (design px)
 *  @range 0, 1440
 *  @default 1010 */
uniform float u_bx;
/** @label Limb top Y (design px)
 *  @range 0, 1400
 *  @default 590 */
uniform float u_by;
/** @label Planet radius (design px)
 *  @range 500, 8000
 *  @default 2400 */
uniform float u_R;
/** @label Limb tilt (radians)
 *  @range -0.5, 0.5
 *  @default -0.06 */
uniform float u_tilt;
/** @label Crescent intensity
 *  @range 0, 4
 *  @default 1.0 */
uniform float u_cres;
/** @label Stars
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_stars;
/** @label Nebula
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_neb;
/** @label Signal
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_sig;
/** @label Gold
 *  @color
 *  @default #E8C27A */
uniform vec3 u_gold;
/** @label Cyan
 *  @color
 *  @default #7FD8FF */
uniform vec3 u_cyan;
/** @label Violet dust
 *  @color
 *  @default #3A2470 */
uniform vec3 u_violet;
/** @label Void
 *  @color
 *  @default #030409 */
uniform vec3 u_void;

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
  return c*core*(0.12+1.3*b);
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float k = u_dw / u_res.x;
  vec2 q = fc * k;                       // design px, y down
  float px = k;                          // one device pixel in design px (unused but handy)

  // ---------- deep space ----------
  // galaxy band: a faint diagonal river from upper-left to the right
  vec2 bd = normalize(vec2(1.0, 0.34));
  vec2 bn = vec2(-bd.y, bd.x);
  float bandDist = dot(q - vec2(0.0, 120.0), bn);
  float band = exp(-bandDist*bandDist / (2.0*170.0*170.0));
  vec2 sp = q / 420.0;
  float n1 = fbm(sp + vec2(3.1, 7.7));
  float n2 = fbm(sp*2.1 + n1*1.3 + 9.0);
  float lanes = ss(0.50, 0.72, n2);                  // dark dust lanes
  float glowB = band * (0.35 + 0.65*n1) * (1.0 - 0.75*lanes);

  vec3 col = u_void;
  col += vec3(0.55, 0.60, 0.75) * glowB * 0.040 * u_neb;
  // violet dust, very low, pooling above the limb on the right
  float vd = ss(0.42, 0.8, fbm(sp*0.8 + 21.0)) ;
  float vy = (q.y - 470.0)/220.0;
  float vmask = exp(-vy*vy) * ss(0.35*u_dw, u_dw, q.x);
  col += u_violet * vd * vmask * 0.22 * u_neb;

  // stars: denser inside the band
  vec3 st = starLayer(q, 6.0, 0.10 + 0.25*band, 0.9, 11.0);
  st += starLayer(q, 19.0, 0.28, 1.4, 23.0);
  st += starLayer(q, 61.0, 0.40, 2.1, 37.0);
  st += starLayer(q, 197.0, 0.55, 2.8, 53.0);
  st *= (1.0 - 0.8*lanes*band);
  col += st * u_stars * 0.85;

  // ---------- planet ----------
  vec2 tilt = vec2(sin(u_tilt), cos(u_tilt));       // planet "up" direction (y down space -> negate)
  vec2 up = vec2(tilt.x, -tilt.y);
  vec2 C = vec2(u_bx, u_by) - up * u_R;             // center far below
  vec2 rel = q - C;
  float r = length(rel);
  float h = r - u_R;                                // >0 above surface (space), <0 inside planet
  // angular distance along the limb from the break point, in design px
  float ang = atan(dot(rel, vec2(up.y, -up.x)), dot(rel, up));   // 0 at break point
  float s = ang * u_R;                              // arc length
  float as = abs(s);

  // light along limb falls off away from the break point (backlight grazing)
  float along = exp(-as / 640.0);
  float alongWide = exp(-as / 1300.0);

  float inside = 1.0 - ss(-0.6, 0.6, h);
  // planet body: near-black, faint cold scatter just inside the limb
  vec3 body = vec3(0.006, 0.008, 0.016);
  float rim = exp(h / 26.0) * inside;               // h negative inside
  body += u_cyan * rim * 0.06 * alongWide;
  float deep = exp(h / 180.0) * inside;
  body += vec3(0.04, 0.06, 0.12) * deep * 0.25 * alongWide;
  // very faint cloud texture on the night side, visible only near the rim
  float cl = fbm(vec2(s/240.0, h/60.0) + 4.0);
  body += vec3(0.05, 0.07, 0.11) * cl * deep * 0.35 * alongWide;
  col = mix(col, body, inside);

  // atmosphere: razor crescent + thin haze, above the surface
  float hp = max(h, 0.0);
  float outside = ss(-0.8, 0.4, h);
  float razor = exp(-abs(h - 0.6) / 0.9);                          // ~1px line
  float haze  = exp(-hp / 7.0) * outside;
  float halo  = exp(-hp / 38.0) * outside;
  vec3 white = vec3(0.93, 0.95, 0.98);
  vec3 atm = mix(u_cyan, white, along) * razor * (0.25 + 1.6*along) * alongWide;
  atm += u_cyan * haze * (0.12 + 0.75*along) * alongWide;
  atm += vec3(0.30, 0.55, 0.80) * halo * 0.10 * alongWide;
  col += atm * u_cres;

  // the Origin breaking over the limb: tight bloom + anamorphic streak hugging the limb
  vec2 B = vec2(u_bx, u_by);
  vec2 dB = q - B;
  float dist = length(dB);
  float bloom = exp(-dist / 70.0) * 0.16 + exp(-dist / 16.0) * 0.45;
  bloom *= ss(-6.0, 4.0, h);                        // light sits on/above the limb
  col += mix(white, u_gold, 0.35) * bloom * u_cres;
  // dawn: the Origin's light spilling into space above the limb, very low
  float dawn = exp(-dist / 320.0) * ss(-20.0, 60.0, h) * exp(-hp / 140.0);
  col += mix(u_cyan, white, 0.6) * dawn * 0.10 * u_cres;
  float streak = exp(-abs(dB.y + 0.0) / 1.1) * exp(-abs(dB.x) / 240.0);
  col += white * streak * 0.18 * u_cres;

  // gold point — the one gold element
  float core = exp(-dot(dB, dB) / (2.0 * 1.8 * 1.8));
  float corona = exp(-dist / 6.0);
  col += u_gold * (core * 2.2 + corona * 0.55);

  // the signal: an extremely thin vertical line rising from the break point
  float above = ss(0.0, 30.0, B.y - q.y) ;          // starts just above the point
  float fade = exp(-(B.y - q.y) / 520.0);
  float lineX = abs(q.x - B.x);
  float line = exp(-lineX * lineX / (2.0 * 0.35 * 0.35)) * 0.9 + exp(-lineX / 5.0) * 0.06;
  float sig = line * above * (0.2 + 0.8*fade) * step(q.y, B.y) * ss(u_st - 40.0, u_st + 120.0, q.y);
  col += mix(white, u_gold, 0.18) * sig * u_sig;

  // vignette + filmic
  vec2 uv = fc / u_res;
  float vig = 1.0 - 0.55 * pow(length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.1)) * 1.2, 2.4);
  col *= clamp(vig, 0.0, 1.0);
  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
