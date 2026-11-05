precision highp float;

float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }

/** @resolution */
uniform vec2 u_res;

/** @label Dust color
 *  @color
 *  @default #020308 */
uniform vec3 u_dust;

/** @label Node X in frame
 *  @range -4000, 4000
 *  @default 0 */
uniform float u_ox;
/** @label Node Y in frame
 *  @range -4000, 4000
 *  @default 0 */
uniform float u_oy;
/** @label Node width
 *  @range 1, 4000
 *  @default 1440 */
uniform float u_nw;
/** @label Node height
 *  @range 1, 4000
 *  @default 1200 */
uniform float u_nh;
/** @label Strength
 *  @range 0, 1
 *  @default 0.96 */
uniform float u_str;
/** @label Pointer X (design px, element space)
 *  @range -4000, 4000
 *  @default -9999 */
uniform float u_mx;
/** @label Pointer Y (design px, element space)
 *  @range -4000, 4000
 *  @default -9999 */
uniform float u_my;
/** @label Clearing strength
 *  @range 0, 1
 *  @default 0 */
uniform float u_clr;
/** @label Clearing radius (design px)
 *  @range 0, 800
 *  @default 190 */
uniform float u_crad;
/** @label Flow
 *  @range 0, 1000
 *  @default 0 */
uniform float u_flow;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5;} return v; }

vec2 lane(vec2 q){
  float x = q.x / 1440.0;
  float yc = 545.0 + (x - 0.5) * 190.0 + 38.0 * sin(x * 5.0 + 0.4);
  float e = fbm(q * 0.006 + vec2(3.1, 7.7));
  float e2 = fbm(q * 0.021 + vec2(9.0, 1.3));
  float d = (q.y - yc) + (e - 0.5) * 170.0 + (e2 - 0.5) * 60.0;
  float wTop = 60.0 + 26.0 * sin(x * 6.0 + 1.0);
  float wBot = 85.0 + 40.0 * cos(x * 3.3 + 0.5);
  float w = d < 0.0 ? wTop : wBot;
  float a = (1.0 - ss(w * 0.25, w, abs(d))) * (0.75 + 0.25 * ss(0.3, 0.6, e2));
  float tend = ss(0.55, 0.72, e2) * (1.0 - ss(0.0, 150.0, d - w * 0.5)) * step(0.0, d);
  a = max(a, tend * 0.85);
  float rim = exp(-pow((d + wTop * 0.9) / 16.0, 2.0)) * ss(0.35, 0.7, e2);
  return vec2(clamp(a, 0.0, 1.0), rim);
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 qe = vec2(uv.x * u_nw, (1.0 - uv.y) * u_nh);
  vec2 L = lane(qe + vec2(u_ox, u_oy));
  float cd = length(qe - vec2(u_mx, u_my)) / max(u_crad, 1.0);
  float cn = (cd < 1.6 && u_clr > 0.001) ? fbm(qe * 0.012 + vec2(u_flow * 0.3, 0.0)) : 0.5;
  float clr = (1.0 - ss(0.25, 1.0, cd + (cn - 0.5) * 0.7)) * u_clr;
  float a = L.x * u_str * (1.0 - clr * 0.95);
  gl_FragColor = vec4(u_dust * a, a);
}
