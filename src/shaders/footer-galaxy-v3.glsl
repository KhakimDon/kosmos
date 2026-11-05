precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Base
 *  @color
 *  @default #020308 */
uniform vec3 u_base;

/** @label Core color
 *  @color
 *  @default #F1E6D2 */
uniform vec3 u_core;

/** @label Arm color
 *  @color
 *  @default #9FB4D8 */
uniform vec3 u_arm;

/** @label Halo color
 *  @color
 *  @default #2A2160 */
uniform vec3 u_halo;

/** @label Center X (design px)
 *  @range 0, 1440
 *  @default 1080 */
uniform float u_cx;

/** @label Center Y (design px from top)
 *  @range 0, 1200
 *  @default 600 */
uniform float u_cy;

/** @label Radius (design px)
 *  @range 20, 800
 *  @default 230 */
uniform float u_rad;

/** @label Rotation (rad)
 *  @range -3.2, 3.2
 *  @default -0.42 */
uniform float u_rot;

/** @label Tilt (minor/major)
 *  @range 0.1, 1
 *  @default 0.36 */
uniform float u_tilt;

/** @label Brightness
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_bright;

/** @label Stars
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_stars;

/** @label Seed
 *  @range 0, 100
 *  @default 7 */
uniform float u_seed;

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
  float r = mix(0.5, maxR, b);
  float core = exp(-d*d/(r*r*0.6));
  float t = hash12(id + seed*5.3);
  vec3 c = mix(vec3(1.0,0.86,0.72), vec3(0.76,0.85,1.0), ss(0.2,0.8,t));
  return c*core*(0.10+1.2*b);
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float k = 1440.0 / u_res.x;
  vec2 q = fc * k;                 // design px, y down

  // ---- galaxy plane coordinates
  vec2 d = q - vec2(u_cx, u_cy);
  float c = cos(u_rot), s = sin(u_rot);
  vec2 g = vec2(c*d.x + s*d.y, -s*d.x + c*d.y);
  g.y /= u_tilt;                   // de-project the inclined disc
  vec2 gp = g / u_rad;             // 1.0 = nominal radius
  float r = length(gp);
  float th = atan(gp.y, gp.x);

  // two logarithmic arms, fbm-broken
  float lr = log(max(r, 0.02));
  float arm = cos(2.0*(th - 2.4*lr) + 0.6*fbm(gp*3.0 + u_seed));
  arm = pow(max(0.0, arm*0.5 + 0.5), 2.2);
  float clump = fbm(gp*7.0 + u_seed*3.1);
  float dust = ss(0.55, 0.85, fbm(gp*5.0 - u_seed)) * ss(0.12, 0.35, r);

  float disk = exp(-r*3.2) * (0.25 + 1.4*arm*(0.55 + 0.9*clump)) * (1.0 - 0.75*dust);
  float bulge = exp(-pow(r/0.11, 1.35)) * 1.6;
  float halo = exp(-r*1.15) * 0.10;

  // projected (screen) distance for a soft core glow
  float rs = length(d) / u_rad;
  float glow = exp(-rs*rs*9.0) * 0.18;

  vec3 col = u_base;
  col += u_halo * halo * 2.4;
  // broad diffuse light of the galaxy washing the lower plate
  float wide = exp(-pow(length(d*vec2(0.55,1.0))/(u_rad*1.9), 2.0));
  col += mix(u_halo, u_arm, 0.45) * wide * 0.17;
  col += u_arm * disk * 0.55 * u_bright;
  col += u_core * (bulge + glow) * u_bright;

  // star-forming knots along arms (cool, tiny)
  float knot = ss(0.78, 0.95, noise(gp*38.0 + u_seed)) * arm * exp(-r*2.5);
  col += vec3(0.62,0.80,1.0) * knot * 0.35 * u_bright;

  // sparse field stars, suppressed inside the disc
  vec3 st = starLayer(q, 19.0, 0.10, 1.0, 11.0+u_seed);
  st += starLayer(q, 61.0, 0.22, 1.7, 23.0+u_seed);
  st += starLayer(q, 197.0, 0.30, 2.4, 37.0+u_seed);
  col += st * u_stars * (1.0 - ss(0.2, 0.9, disk*3.0));

  // very faint vignette toward the edges
  vec2 uv = fc / u_res;
  col *= 1.0 - 0.35*pow(length((uv - vec2(0.6,0.6))*vec2(1.0,1.2)), 2.0);

  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
