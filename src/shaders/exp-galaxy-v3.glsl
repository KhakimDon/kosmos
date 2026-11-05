precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Center X (design px)
 *  @range 0, 1440
 *  @default 930 */
uniform float u_cx;
/** @label Center Y (design px, from top)
 *  @range 0, 1500
 *  @default 560 */
uniform float u_cy;
/** @label Radius (design px)
 *  @range 100, 1200
 *  @default 560 */
uniform float u_R;
/** @label Rotation (rad)
 *  @range -3.2, 3.2
 *  @default -0.42 */
uniform float u_rot;
/** @label Tilt ratio (cos inclination)
 *  @range 0.1, 1
 *  @default 0.46 */
uniform float u_tilt;
/** @label Arm winding (1/tan pitch)
 *  @range 0.5, 8
 *  @default 2.1 */
uniform float u_wind;
/** @label Arm phase
 *  @range -3.2, 3.2
 *  @default 0.0 */
uniform float u_phase;
/** @label Brightness
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_gain;
/** @label Stars
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_stars;

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
  float b = pow(hash12(id + seed*3.1), 7.0);
  float r = mix(0.5, maxR, b);
  float core = exp(-d*d/(r*r*0.6));
  float t = hash12(id + seed*5.3);
  vec3 c = mix(vec3(1.0,0.82,0.64), vec3(0.76,0.85,1.0), ss(0.2,0.8,t));
  return c*core*(0.12+1.3*b);
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 q = fc / u_res.x * 1440.0;     // design px, y down

  // galaxy plane coordinates
  vec2 d = q - vec2(u_cx, u_cy);
  float cr = cos(u_rot), sr = sin(u_rot);
  vec2 u = vec2(cr*d.x + sr*d.y, -sr*d.x + cr*d.y);
  vec2 g = vec2(u.x, u.y / u_tilt) / u_R;
  float r = length(g);
  float th = atan(g.y, g.x);
  float lr = log(max(r, 0.002));

  // spiral arms (2-armed log spiral), perturbed by noise
  float wob = fbm(g*3.0 + 4.0) - 0.5;
  float ph = th - lr*u_wind - u_phase + wob*0.9;
  float armC = 0.5 + 0.5*cos(2.0*ph);
  float arm = pow(armC, 4.0) + 0.45*pow(0.5+0.5*cos(4.0*ph + 1.3 + wob*2.0), 8.0)*ss(0.3,0.6,r);
  // dust lane sits on the inner (trailing) edge of each arm
  float dustC = 0.5 + 0.5*cos(2.0*(ph + 0.42));
  float lane = pow(dustC, 7.0);

  float disk = exp(-r*2.6) ;
  float edge = 1.0 - ss(0.75, 1.15, r);
  float armZone = ss(0.06, 0.22, r) * edge;

  // clumpy structure along arms
  vec2 sp = vec2(ph*1.3, lr*3.2);
  float cl = fbm(g*7.0 + vec2(1.7, 9.2));
  float cl2 = fbm(g*16.0 + vec2(3.1, 2.0));
  float clump = ss(0.42, 0.95, cl*0.6 + cl2*0.55);

  vec3 warm = vec3(1.0, 0.78, 0.52);
  vec3 young = vec3(0.55, 0.74, 1.0);
  vec3 pink = vec3(1.0, 0.42, 0.62);

  // diffuse disk light
  vec3 col = vec3(0.0);
  col += mix(warm, vec3(0.62,0.66,0.82), ss(0.0, 0.55, r)) * disk * 0.75 * edge;
  // arms: blue-white young star regions
  float armLight = arm * armZone * (0.14 + 1.7*clump*clump + 0.45*cl) * exp(-r*1.25);
  col += young * armLight * 0.85;
  // resolved young stars riding the arms
  vec3 ys = starLayer(q, 5.0, 0.35, 1.3, 71.0) + starLayer(q, 13.0, 0.5, 1.9, 83.0);
  col += ys * (arm*1.6 + 0.15) * armZone * exp(-r*0.8) * 0.55;
  // fine starry grain in arms
  float grain = ss(0.55, 0.95, noise(g*140.0)) * arm * armZone;
  col += vec3(0.0)*grain;
  // HII knots: rare pink spots where clumps peak on arm crest
  float kn = noise(g*38.0 + 5.0);
  float knot = ss(0.82, 1.0, kn) * ss(0.55, 0.95, armC) * armZone * ss(0.45, 0.7, cl);
  col += pink * knot * 0.45 * exp(-r*0.9);
  // bulge / warm core (circular-ish in the plane, slightly puffier in screen)
  vec2 gb = vec2(u.x, u.y / mix(u_tilt, 1.0, 0.45)) / u_R;
  float rb = length(gb);
  col += warm * exp(-rb*rb*95.0) * 1.7;
  col += vec3(1.0, 0.92, 0.80) * exp(-rb*rb*900.0) * 1.6;
  col += warm * exp(-rb*7.0) * 0.28;

  // dust lanes absorb
  float fil = ss(0.52, 0.72, fbm(g*11.0 + 20.0));
  float dustAmt = clamp(lane * (0.55 + 0.45*fil) + fil*0.25*(1.0-armC), 0.0, 1.0) * ss(0.04, 0.16, r) * edge;
  col *= 1.0 - 0.92*dustAmt;

  col *= u_gain;

  // halo of faint stars, denser toward the galaxy
  float halo = exp(-r*0.9) * 0.9 + 0.25;
  vec3 st = starLayer(q, 9.0, 0.10, 0.9, 11.0) + starLayer(q, 31.0, 0.28, 1.5, 23.0) + starLayer(q, 97.0, 0.45, 2.2, 37.0);
  col += st * u_stars * halo * (1.0 - 0.8*dustAmt);

  // base void
  vec3 base = vec3(0.012, 0.016, 0.035);
  col += base;
  // very subtle midnight haze around the galaxy
  col += vec3(0.02, 0.025, 0.06) * exp(-r*1.2);

  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fc) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
