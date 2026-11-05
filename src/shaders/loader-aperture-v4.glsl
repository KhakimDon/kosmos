precision highp float;

// NOUMENA loader: gold origin point -> accretion ring -> aperture opening onto the planet's lit limb.
// Design space: 1440 x 900 panel, y down.

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Ring presence
 *  @range 0, 1
 *  @default 0 */
uniform float u_ring;

/** @label Aperture open
 *  @range 0, 1
 *  @default 0 */
uniform float u_open;

/** @label Stars
 *  @range 0, 2
 *  @default 0 */
uniform float u_stars;

/** @label Point
 *  @range 0, 1
 *  @default 1 */
uniform float u_point;

/** @label Gold
 *  @color
 *  @default #E8C27A */
uniform vec3 u_gold;

/** @label Cyan
 *  @color
 *  @default #7FD8FF */
uniform vec3 u_cyan;

/** @label Nebula
 *  @color
 *  @default #3A2470 */
uniform vec3 u_neb;

/** @label Base
 *  @color
 *  @default #030409 */
uniform vec3 u_base;

const float PI = 3.14159265;

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
  float b = pow(hash12(id + seed*3.1), 6.0);
  float r = mix(0.6, maxR, b);
  float core = exp(-d*d/(r*r*0.6));
  float t = hash12(id + seed*5.3);
  vec3 c = mix(vec3(1.0,0.86,0.72), vec3(0.76,0.86,1.0), ss(0.2,0.8,t));
  return c*core*(0.15+1.3*b);
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 q = fc / u_res * vec2(1440.0, 900.0);       // design px, y down
  vec2 C = vec2(720.0, 450.0);
  vec2 dp = q - C;
  float d = length(dp);
  float ang = atan(dp.y, dp.x);                      // -PI..PI, y down

  vec3 col = u_base;

  // faint midnight basin that deepens as the ring condenses
  col += vec3(0.010, 0.014, 0.034) * exp(-d / 520.0) * (0.3 + u_ring);

  // ring radius: tight accretion ring -> wide aperture
  float R = mix(150.0, 318.0, u_open);

  // ---- behind the aperture: the hero planet lit from behind (Origin light) ----
  float inside = 1.0 - ss(R - 3.0, R + 1.0, d);       // hard-ish lens mask
  float spill  = exp(-max(d - R, 0.0) / 60.0);          // light leaking past the blades
  vec3 reveal = vec3(0.0);
  if (u_open > 0.001) {
    vec2 P = vec2(720.0, 1760.0);
    float PR = 1200.0;                                   // limb top at y = 560
    vec2 pp = q - P;
    float pd = length(pp);
    vec2 dir = pp / pd;
    float facing = max(dot(dir, vec2(0.0, -1.0)), 0.0);
    float lightAlong = pow(facing, 220.0);              // light concentrated at the top of the limb
    float h = pd - PR;                                   // >0 outside planet
    // origin light behind the planet: wide warm-white bloom sitting on the limb
    vec2 G = vec2(720.0, 562.0);
    float gd = length((q - G) * vec2(0.55, 1.0));
    vec3 bloom = mix(vec3(1.0, 0.92, 0.80), vec3(0.55, 0.70, 1.0), ss(20.0, 220.0, gd)) * exp(-gd / 55.0) * 0.6;
    bloom += vec3(0.30, 0.40, 0.80) * exp(-gd / 240.0) * 0.07;
    bloom += vec3(0.02, 0.025, 0.06);
    // atmosphere: thin cyan->white rim
    float atm = (h > 0.0 ? exp(-h / 10.0) : exp(h / 2.2)) * (0.25 + 1.8 * lightAlong + 0.35 * pow(facing, 30.0));
    vec3 atmCol = mix(u_cyan, vec3(1.0, 0.97, 0.92), ss(0.0, 1.0, lightAlong));
    // planet body: near black with faint scattered light from the limb
    float body = 1.0 - ss(-1.0, 1.0, h);
    float scatter = body * exp(min(h, 0.0) / 120.0) * pow(facing, 40.0) * 0.06;
    vec3 sky = (h > 0.0) ? bloom : vec3(0.0);
    // gold glint: the Origin itself, just cresting the limb
    float gl = length((q - vec2(720.0, 557.0)) * vec2(0.35, 1.0));
    vec3 glint = u_gold * (exp(-gl * gl / 10.0) * 2.2 + exp(-gl / 22.0) * 0.5);
    // fine horizontal lens streak through the glint
    glint += vec3(1.0, 0.9, 0.75) * exp(-abs(q.y - 557.0) / 0.7) * exp(-abs(q.x - 720.0) / 70.0) * 0.25;
    // dust lanes on the bloom (cheap)
    float dust = fbm(q / vec2(220.0, 60.0) + 3.0);
    sky *= 0.75 + 0.5 * dust;
    vec3 planetCol = vec3(0.006, 0.008, 0.016) * body + u_neb * scatter * 2.0 + vec3(0.8,0.85,1.0) * scatter;
    reveal = sky * (1.0 - body) + planetCol + atmCol * atm + glint;
    reveal *= inside + spill * 0.08 * (1.0 - inside);
  }
  col = mix(col, col * (1.0 - inside * u_open), 1.0) + reveal * u_open;

  // ---- accretion haze: a faint spiral of matter condensing between point and ring ----
  if (u_ring > 0.001) {
    float lr = log(max(d, 1.0));
    float a2 = ang + lr * 2.6;                                  // logarithmic spiral, wraps seamlessly
    float sw = fbm(vec2(cos(a2), sin(a2)) * 2.4 + vec2(lr * 1.3, 7.0));
    float band = exp(-pow((d - R * 0.86) / (R * 0.28), 2.0));
    float haze = band * ss(0.4, 0.75, sw) * (1.0 - u_open);
    col += mix(u_neb * 1.4, vec3(0.6, 0.66, 0.85), 0.3) * haze * 0.16 * u_ring;
  }

  // ---- the ring / aperture blades ----
  if (u_ring > 0.001) {
    float doppler = 0.45 + 0.55 * pow(0.5 + 0.5 * cos(ang + 2.3), 1.6);
    float w = mix(0.9, 1.3, u_open);
    
    // aperture: six arcs that part as it opens, rotating slightly
    float seg = fract((ang + u_open * 0.35) / (2.0 * PI) * 6.0 + 0.5);
    float g = u_open * 0.10;
    // iris: each blade is a slightly spiralled arc, so the six arcs overlap like aperture leaves
    float Rr = R + u_open * (10.0 + (seg - 0.5) * 26.0);
    float core = exp(-pow((d - Rr) / w, 2.0));
    float glow = exp(-abs(d - Rr) / 14.0) * 0.12 + exp(-abs(d - Rr) / 60.0) * 0.03;
    float arcMask = (u_open > 0.001) ? ss(0.0, g + 0.001, seg) * (1.0 - ss(1.0 - g - 0.001, 1.0, seg)) : 1.0;
    // blade tips brighten where each arc ends
    float tip = (u_open > 0.001) ? (exp(-abs(seg - g) / 0.01) + exp(-abs(seg - (1.0 - g)) / 0.01)) * 0.4 : 0.0;
    vec3 ringCol = mix(vec3(0.80, 0.86, 0.98), vec3(1.0, 0.95, 0.86), doppler);
    col += ringCol * (core * 1.25 + glow) * doppler * u_ring * (arcMask + tip * core);
  }

  // ---- stars, born at the edges and never inside the lens ----
  if (u_stars > 0.001) {
    vec2 uv = fc / u_res;
    float e = length((uv - 0.5) * vec2(1.6, 1.0));
    float edge = ss(0.28, 0.75, e) ;
    edge = mix(edge, ss(R + 30.0, R + 160.0, d), u_open);
    vec3 s = starLayer(q, 9.0, 0.18, 1.0, 11.0);
    s += starLayer(q, 31.0, 0.30, 1.6, 23.0);
    s += starLayer(q, 97.0, 0.45, 2.4, 37.0);
    col += s * edge * u_stars;
  }

  // ---- the gold origin point ----
  if (u_point > 0.001) {
    float pc = exp(-d * d / 3.2);
    float ph = exp(-d / 9.0) * 0.22 + exp(-d / 70.0) * 0.035;
    col += u_gold * (pc * 1.8 + ph) * u_point * (1.0 - u_open);
  }

  // vignette, tone map, grain
  vec2 uv2 = fc / u_res;
  col *= clamp(1.0 - 0.55 * pow(length(uv2 - 0.5) * 1.3, 2.4), 0.0, 1.0);
  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
