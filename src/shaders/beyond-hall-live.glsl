precision highp float;

// NOUMENA S07 — Beyond Human Imagination
// An infinite Escher lattice: floating slabs & monoliths repeating up, down and ahead.
// Alternate levels are rotated 90 deg. A carved corridor leads to a vertical slit of white light.

/** @resolution */
uniform vec2 u_res;
/** @time */
uniform float u_time;

/** @label Fog deep
 *  @color
 *  @default #06051A */
uniform vec3 u_fogDeep;
/** @label Fog glow
 *  @color
 *  @default #3A2470 */
uniform vec3 u_fogGlow;
/** @label Stone
 *  @color
 *  @default #AEB6C8 */
uniform vec3 u_stone;
/** @label Seam
 *  @color
 *  @default #7FD8FF */
uniform vec3 u_seam;
/** @label Slit
 *  @color
 *  @default #EEF1F7 */
uniform vec3 u_slit;
/** @label Fog density
 *  @range 0, 0.3
 *  @default 0.06 */
uniform float u_fog;
/** @label Slit intensity
 *  @range 0, 4
 *  @default 1.0 */
uniform float u_slitAmt;
/** @label Seam amount
 *  @range 0, 2
 *  @default 1.0 */
uniform float u_seamAmt;
/** @label Camera height
 *  @range -3, 3
 *  @default 0.0 */
uniform float u_camY;
/** @label Horizon (0..1 from bottom)
 *  @range 0, 1
 *  @default 0.5 */
uniform float u_horizon;
/** @label Camera forward (z)
 *  @range 0, 100
 *  @default 0.0 */
uniform float u_camZ;
/** @label Yaw
 *  @range -0.5, 0.5
 *  @default 0.0 */
uniform float u_yaw;
/** @label Pitch
 *  @range -0.5, 0.5
 *  @default 0.0 */
uniform float u_pitch;
/** @label Roll
 *  @range -0.5, 0.5
 *  @default 0.0 */
uniform float u_roll;
/** @label Reality glitch
 *  @range 0, 1
 *  @default 0.0 */
uniform float u_glitch;
/** @label Level flip (other dimension)
 *  @range 0, 1
 *  @default 0.0 */
uniform float u_flip;
/** @label Slit width
 *  @range 0.3, 3
 *  @default 1.0 */
uniform float u_slitW;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }

float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }

const vec3 PER = vec3(9.0, 5.0, 7.0);

// material: 0 slab, 1 monolith
float g_mat;
vec3  g_loc;
float g_lev;

float map(vec3 p){
  // impossible mirror: the world below the horizon is the world above, folded
  p.y = abs(p.y) + 2.0;
  vec3 id = floor(p / PER + 0.5);
  vec3 q = p - id * PER;
  float lev = id.y;
  // alternate levels rotated 90 degrees
  float odd = mod(lev + u_flip, 2.0);
  vec3 r = q;
  if (odd < 0.5) r = vec3(q.z, q.y, -q.x);
  float h = hash12(id.xz + lev * 7.31);

  // long thin slab / bridge
  vec3 sp = r - vec3(0.0, -0.9, 0.0);
  float slab = sdBox(sp, vec3(3.6, 0.09, 1.15));
  // monolith resting on the slab, offset
  vec3 mp = r - vec3(mix(-2.4, 2.4, step(0.5, h)), 0.55, 0.0);
  float mono = sdBox(mp, vec3(0.32, 1.35, 0.5));
  // thin vertical needle between levels
  vec3 np = q - vec3(3.9, 0.0, 3.0);
  float needle = sdBox(np, vec3(0.035, 2.6, 0.035)) + step(0.3, hash12(id.xz * 1.9 + 4.0)) * 9.0;

  float d = slab; g_mat = 0.0; g_loc = sp;
  if (mono < d){ d = mono; g_mat = 1.0; g_loc = mp; }
  if (needle < d){ d = needle; g_mat = 2.0; g_loc = np; }
  g_lev = lev;

  // carve the corridor the camera looks down
  float corr = -sdBox(p - vec3(0.0, 2.0, 0.0), vec3(1.5, 1.2, 1e4));
  if (corr > d){ d = corr; g_mat = 3.0; g_loc = p; }
  // a single plane of light splits the whole infinite structure
  float slot = -(abs(p.x) - 0.16);
  if (slot > d){ d = slot; g_mat = 4.0; g_loc = p; }
  return d;
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.004, 0.0);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - vec2(0.5 * u_res.x, u_horizon * u_res.y)) / u_res.y;

  // --- reality glitch: the image tears into horizontal slices; some slide, some flip
  float g = u_glitch;
  float gTear = 0.0;
  if (g > 0.001){
    float tstep = floor(u_time * 14.0);
    float band = floor((uv.y + 2.0) * mix(6.0, 26.0, hash12(vec2(tstep, 3.1))));
    float hb = hash12(vec2(band, tstep));
    float sel = step(1.0 - g * 0.85, hb);
    uv.x += sel * (hash12(vec2(band, tstep + 7.0)) - 0.5) * 0.55 * g;
    // flipped slices: the hall seen upside down / mirrored inside the tear
    float fl = step(0.72, hash12(vec2(band * 1.7, tstep + 2.0))) * sel;
    uv = mix(uv, vec2(-uv.x, -uv.y), fl);
    gTear = sel;
  }

  vec3 ro = vec3(0.0, u_camY, -2.0 + u_camZ);
  vec3 rd = normalize(vec3(uv, 1.25));
  // look direction: roll, pitch, yaw
  float cr = cos(u_roll), sr = sin(u_roll);
  rd.xy = mat2(cr, sr, -sr, cr) * rd.xy;
  float cp = cos(u_pitch), sp = sin(u_pitch);
  rd.yz = mat2(cp, sp, -sp, cp) * rd.yz;
  float cy = cos(u_yaw), sy = sin(u_yaw);
  rd.xz = mat2(cy, sy, -sy, cy) * rd.xz;

  float t = 0.0;
  float hit = 0.0;
  float steps = 0.0;
  for (int i = 0; i < 60; i++){
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.002 * t + 0.001){ hit = 1.0; break; }
    t += d * 0.9;
    steps += 1.0;
    if (t > 90.0) break;
  }

  // angular glow toward the vanishing point (light scattered from the slit)
  float ang = length(rd.xy / rd.z);
  float axial = exp(-ang * ang * 9.0);
  float axialTight = exp(-pow(abs(rd.x / rd.z) * 60.0, 2.0)) * exp(-pow(abs(rd.y / rd.z) * 1.6, 2.0));

  vec3 fogCol = mix(u_fogDeep, u_fogGlow, 0.08 + 0.92 * axial);
  fogCol += u_slit * 0.10 * exp(-ang * ang * 40.0) * u_slitAmt;

  vec3 col = fogCol;
  if (hit > 0.5){
    vec3 p = ro + rd * t;
    float m = map(p);
    float mat = g_mat; vec3 loc = g_loc; float lev = g_lev;
    vec3 n = calcNormal(p);

    // light lives far down the corridor
    vec3 L = normalize(vec3(-p.x, -p.y, 60.0));
    float dif = max(dot(n, L), 0.0);
    float top = 0.5 + 0.5 * n.y;
    float ao = clamp(1.0 - steps / 60.0, 0.0, 1.0);
    ao = 0.35 + 0.65 * ao * ao;

    vec3 base = u_stone * (mat == 1.0 ? 0.55 : 0.75);
    vec3 c = base * (0.07 + 0.16 * top) * ao + u_fogGlow * 0.12 * top;
    // rim: faces turned toward the corridor axis catch the slit light
    float facing = max(dot(n, normalize(vec3(-p.x, -p.y, 0.001))), 0.0);
    c += u_stone * dif * 0.9 * exp(-length(p.xy) * 0.18);
    c += mix(u_stone, u_fogGlow * 2.0, 0.35) * pow(facing, 2.0) * 0.30 * exp(-length(p.xy) * 0.22) * (0.4 + 0.6 * exp(-t * 0.02));

    // thin cyan seams: a groove along the middle of slab edges, only on some cells
    if (mat == 0.0){
      float s = 1.0 - ss(0.0, 0.018, abs(loc.y));
      float side = 1.0 - abs(n.y);
      float pick = step(0.55, hash12(vec2(lev, floor(p.z / PER.z + 0.5)) + floor(p.x / PER.x + 0.5) * 3.7));
      c += u_seam * s * side * pick * 0.9 * u_seamAmt;
    }
    if (mat == 4.0){
      // walls of the slot face the plane of light
      c += mix(u_stone, u_slit, 0.6) * 0.35 * (0.3 + 0.7 * exp(-t * 0.04)) * exp(-pow(abs(rd.y / rd.z) * 3.6, 4.0));
    }
    if (mat == 2.0){
      c += u_seam * 0.25 * u_seamAmt * (1.0 - abs(n.y));
    }

    float tr = exp(-t * u_fog);
    col = mix(fogCol, c, tr);
  }

  // the slit: only where the corridor stays open to infinity
  float open = hit > 0.5 ? 0.0 : 1.0;
  float core = exp(-pow(abs(rd.x / rd.z) * 380.0 / u_slitW, 2.0)) * exp(-pow(abs(rd.y / rd.z) * 5.0, 4.0));
  col += u_slit * (core * 1.6 + axialTight * 0.35) * u_slitAmt * open;
  // faint halo spills onto everything
  col += u_slit * 0.04 * axialTight * u_slitAmt;

  // glitch: torn slices pick up a cold spectral cast and a scanline
  if (g > 0.001){
    col = mix(col, col.bgr * vec3(0.7, 1.1, 1.6) + u_seam * 0.04, gTear * g * 0.6);
    col += u_slit * 0.05 * g * step(0.5, fract(gl_FragCoord.y * 0.5));
  }

  // vignette + gentle filmic curve
  vec2 v = gl_FragCoord.xy / u_res - 0.5;
  col *= 1.0 - 0.9 * dot(v, v);
  col = col / (1.0 + col * 0.35);
  col = pow(col, vec3(0.92));

  // grain
  col += (hash12(gl_FragCoord.xy) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
