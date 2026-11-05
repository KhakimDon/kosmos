precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Base
 *  @color
 *  @default #030409 */
uniform vec3 u_base;

/** @label Deep
 *  @color
 *  @default #070B1C */
uniform vec3 u_deep;

/** @label Dust
 *  @color
 *  @default #3A2470 */
uniform vec3 u_dust;

/** @label Dust amount
 *  @range 0, 1
 *  @default 0.18 */
uniform float u_dustAmt;

/** @label Stars
 *  @range 0, 3
 *  @default 1.0 */
uniform float u_stars;

/** @label Focus X
 *  @range 0, 1
 *  @default 0.57 */
uniform float u_fx;

/** @label Focus Y (from top)
 *  @range 0, 1
 *  @default 0.58 */
uniform float u_fy;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }

// sparse, mostly sub-pixel stars; brightness follows a steep power law (few bright, many barely there)
float stars(vec2 q, float cell, float prob, float seed){
  vec2 id = floor(q/cell); vec2 f = q - id*cell;
  if (hash12(id + seed) > prob) return 0.0;
  vec2 pos = (hash22(id + seed*1.7)*0.8+0.1)*cell;
  float d = length(f - pos);
  float b = pow(hash12(id + seed*3.1), 6.0);
  float r = mix(0.5, 1.5, b);
  return exp(-d*d/(r*r)) * mix(0.07, 0.9, b);
}

void main(){
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y);

  // focus: the chart's centre of gravity — slightly lifted midnight there
  vec2 fc = vec2(u_fx * asp, 1.0 - u_fy);
  float dF = length((p - fc) * vec2(0.8, 1.1));
  vec3 col = mix(u_deep, u_base, ss(0.0, 0.95, dF));

  // a faint dust lane crossing the plate diagonally (galactic plane on the chart)
  float lane = (p.y - 0.18) - (p.x - 0.1) * 0.42;
  float laneMask = exp(-lane*lane / 0.035);
  float n = fbm(p * 3.2 + vec2(4.1, 1.3));
  float n2 = fbm(p * 7.0 - vec2(2.0, 5.0));
  float dust = laneMask * ss(0.38, 0.85, n) * (0.6 + 0.4*n2);
  col += u_dust * dust * u_dustAmt;
  // dark absorption filaments inside the lane
  col *= 1.0 - laneMask * ss(0.55, 0.8, n2) * 0.35;

  // stars: density slightly higher inside the lane, like a real milky way
  vec2 q = px * (1300.0 / u_res.y);
  float s = stars(q, 11.0, 0.03 + 0.14*laneMask, 1.0) * 0.8 + stars(q + 31.0, 29.0, 0.12, 7.0) + stars(q + 77.0, 71.0, 0.30, 13.0) * 1.3;
  vec3 starTint = mix(vec3(0.78, 0.84, 0.95), vec3(0.93, 0.95, 0.97), hash12(floor(q/23.0)));
  col += starTint * s * u_stars;

  // vignette
  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.9;

  // fine grain to avoid banding
  col += (hash12(px) - 0.5) * 0.006;

  gl_FragColor = vec4(col, 1.0);
}
