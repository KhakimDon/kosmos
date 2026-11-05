precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Centre X (0..1)
 *  @range 0, 1
 *  @default 0.6 */
uniform float u_cx;
/** @label Centre Y (0..1 from top)
 *  @range 0, 1
 *  @default 0.5 */
uniform float u_cy;
/** @label Shadow radius (design px)
 *  @range 40, 300
 *  @default 132 */
uniform float u_R;
/** @label Design height (px)
 *  @range 100, 3000
 *  @default 1200 */
uniform float u_H;
/** @label Disk outer (x shadow)
 *  @range 1.5, 6
 *  @default 3.4 */
uniform float u_rout;
/** @label Disk inner (x shadow)
 *  @range 1, 3
 *  @default 1.25 */
uniform float u_rin;
/** @label Tilt (edge-on = 0)
 *  @range 0.01, 0.4
 *  @default 0.09 */
uniform float u_tilt;
/** @label Disk tilt angle (rad)
 *  @range -0.5, 0.5
 *  @default -0.06 */
uniform float u_roll;
/** @label Exposure
 *  @range 0, 4
 *  @default 1.0 */
uniform float u_exp;
/** @label Doppler
 *  @range 0, 1
 *  @default 0.6 */
uniform float u_dop;
/** @label Stars
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_stars;
/** @label Einstein radius (x shadow)
 *  @range 0.5, 4
 *  @default 1.9 */
uniform float u_einst;

/** @label Hot
 *  @color
 *  @default #FFF4E2 */
uniform vec3 u_hot;
/** @label Gold
 *  @color
 *  @default #E8C27A */
uniform vec3 u_gold;
/** @label Amber
 *  @color
 *  @default #8A4F1E */
uniform vec3 u_amber;
/** @label Space
 *  @color
 *  @default #030409 */
uniform vec3 u_void;
/** @label Haze
 *  @color
 *  @default #0B0F26 */
uniform vec3 u_haze;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm3(vec2 p){ float v=0., a=.5; for(int i=0;i<3;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return v; }

// star layer in design-px space
float starLayer(vec2 q, float cell, float prob, float rad, float seed){
  vec2 id = floor(q/cell); vec2 f = q - id*cell;
  if (hash12(id + seed) > prob) return 0.0;
  vec2 pos = (hash22(id + seed*1.7)*0.8+0.1)*cell;
  float d = length(f - pos);
  float b = pow(hash12(id + seed*3.1), 6.0);
  float r = mix(0.5, rad, b);
  return exp(-d*d/(r*r)) * (0.12 + 1.3*b);
}

// disk emission for a disk-plane radius rd (in shadow units) and azimuth phi
vec3 diskColor(float rd, float phi, float dop, out float a){
  float t = clamp((rd - u_rin) / (u_rout - u_rin), 0.0, 1.0);
  float inner = ss(u_rin - 0.04, u_rin + 0.10, rd);
  float outer = 1.0 - ss(u_rout * 0.72, u_rout, rd);
  float prof = inner * outer * pow(1.0 - t, 1.6);
  // concentric streaks (turbulent rings)
  float st = noise(vec2(rd * 16.0, phi * 2.0 + 3.0)) * 0.6 + noise(vec2(rd * 45.0, phi * 5.0)) * 0.4;
  prof *= 0.55 + 0.75 * st;
  prof *= dop;
  vec3 c = mix(u_hot, u_gold, ss(0.02, 0.38, t));
  c = mix(c, u_amber, ss(0.35, 1.0, t));
  c = mix(c, u_hot, ss(1.2, 1.7, dop) * 0.5);
  a = clamp(prof * 1.4, 0.0, 1.0);
  c = pow(c, vec3(1.25));
  return c * prof * 1.9;
}

void main(){
  float s = u_res.y / u_H;                                  // device px per design px
  vec2 cpx = vec2(u_cx * u_res.x, (1.0 - u_cy) * u_res.y);
  vec2 dq = (gl_FragCoord.xy - cpx) / s;                    // design px, y up
  // roll the whole system slightly
  float cr = cos(u_roll), sr = sin(u_roll);
  dq = vec2(cr*dq.x - sr*dq.y, sr*dq.x + cr*dq.y);
  vec2 q = dq / u_R;                                        // shadow units
  float r = length(q);
  float th = atan(q.y, q.x);

  // ---------- lensed background ----------
  float E = u_einst;
  vec2 beta = q * (1.0 - E*E / max(r*r, 1e-4));             // point-lens mapping
  float mag = clamp(1.0 / abs(1.0 - pow(E / max(r, 1e-3), 4.0)), 0.0, 6.0);
  vec2 bpx = beta * u_R;
  float stars = starLayer(bpx, 9.0, 0.10, 0.9, 3.0)
              + starLayer(bpx, 31.0, 0.30, 1.3, 17.0)
              + starLayer(bpx, 97.0, 0.45, 1.9, 41.0);
  stars *= u_stars * mix(1.0, mag, 0.55);
  float haze = fbm3(beta * 0.55 + 4.0);
  vec3 col = u_void + u_haze * ss(0.45, 0.9, haze) * 0.45;
  // faint lensed Einstein ring from the background haze
  col += u_haze * exp(-pow((r - E) / 0.05, 2.0)) * 0.12;
  col += vec3(0.80, 0.86, 1.0) * stars;

  // ---------- shadow ----------
  float shadow = 1.0 - ss(0.985, 1.0, r);
  col *= 1.0 - shadow;

  // ---------- lensed far side of the disk (arc over the top, thin arc below) ----------
  float up = 0.5 + 0.5 * sin(th);                           // 1 at top, 0 at bottom
  float w = mix(0.11, 0.85, pow(up, 1.8));                  // apparent width of the lensed image
  float rl = 1.035 + (r - 1.035);                           // distance outside photon sphere image
  float rdL = u_rin + (rl - 1.035) / w * (u_rout - u_rin);
  float aL;
  float dopL = 1.0 + u_dop * (-cos(th)) * 0.9;
  vec3 lens = diskColor(rdL, th * 3.0, dopL, aL);
  float lensMask = ss(1.02, 1.05, r) * mix(0.55, 1.0, up);
  col += lens * lensMask * 0.78;

  // ---------- photon ring ----------
  float pr = exp(-pow((r - 1.022) / 0.0065, 2.0));
  float prw = exp(-pow((r - 1.03) / 0.03, 2.0)) * 0.25;
  col += u_hot * (pr * 1.6 + prw) * (0.75 + 0.45 * (-cos(th)) * u_dop);

  // ---------- direct image of the disk (near side crosses in front of the shadow) ----------
  float rd = length(vec2(q.x, q.y / u_tilt));
  float phi = atan(q.y / u_tilt, q.x);
  float near = q.y < 0.0 ? 1.0 : 0.0;
  float visible = max(near, 1.0 - shadow);                  // far half hidden behind shadow
  float dopD = 1.0 + u_dop * (-q.x / max(rd, 1e-3));
  float aD;
  vec3 disk = diskColor(rd, phi, dopD, aD);
  // soft vertical edge (disk has thickness)
  aD *= visible; disk *= visible;
  col = col * (1.0 - aD * 0.92) + disk;

  // gentle bloom around the bright inner disk, no more than needed
  float bl = exp(-length(vec2(q.x * 0.5, q.y * 2.4)) * 1.6);
  col += u_gold * bl * 0.05 * (1.0 - 0.5 * u_dop * q.x / (abs(q.x) + 0.8)) * (1.0 - shadow * 0.85);

  col *= u_exp;
  col = 1.0 - exp(-col * 1.25);
  // vignette
  vec2 uv = gl_FragCoord.xy / u_res;
  col *= clamp(1.0 - 0.55 * pow(length((uv - vec2(u_cx, 1.0 - u_cy)) * vec2(1.2, 1.0)), 2.2), 0.0, 1.0);
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
