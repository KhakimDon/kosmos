// S06 helpers: the infinite lattice — Fibonacci shells, nearest-neighbour links,
// radial links between shells, the signal chain to node 0, and its shaders.
import * as THREE from 'three'

export const SHELLS = [
  { R: 10.0, n: 9000 },
  { R: 9.15, n: 6200 },
  { R: 8.3, n: 4600 },
  { R: 7.1, n: 3200 },
  { R: 5.7, n: 2000 },
]

// deterministic PRNG so the lattice is identical on every load
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function fibShell(n, R, rot, out, o) {
  const ga = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const th = ga * i + rot
    out[o + i * 3] = Math.cos(th) * r * R
    out[o + i * 3 + 1] = y * R
    out[o + i * 3 + 2] = Math.sin(th) * r * R
  }
}

/** spatial hash over a range of points: k nearest (k ≤ 4) within the set */
function makeHash(pos, from, to, cell) {
  const map = new Map()
  const K = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512)
  for (let i = from; i < to; i++) {
    const k = K(Math.floor(pos[i * 3] / cell), Math.floor(pos[i * 3 + 1] / cell), Math.floor(pos[i * 3 + 2] / cell))
    let a = map.get(k)
    if (!a) map.set(k, (a = []))
    a.push(i)
  }
  const bd = new Float64Array(4), bj = new Int32Array(4)
  return {
    near(x, y, z, k, skip = -1) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell)
      let n = 0
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const a = map.get(K(cx + dx, cy + dy, cz + dz))
        if (!a) continue
        for (let q = 0; q < a.length; q++) {
          const j = a[q]
          if (j === skip) continue
          const ex = pos[j * 3] - x, ey = pos[j * 3 + 1] - y, ez = pos[j * 3 + 2] - z
          const d = ex * ex + ey * ey + ez * ez
          if (n < k) { let m = n++; while (m > 0 && bd[m - 1] > d) { bd[m] = bd[m - 1]; bj[m] = bj[m - 1]; m-- } bd[m] = d; bj[m] = j }
          else if (d < bd[k - 1]) { let m = k - 1; while (m > 0 && bd[m - 1] > d) { bd[m] = bd[m - 1]; bj[m] = bj[m - 1]; m-- } bd[m] = d; bj[m] = j }
        }
      }
      const out = []
      for (let m = 0; m < n; m++) out.push([bd[m], bj[m]])
      return out
    },
  }
}

export function buildLattice(density = 1) {
  const shells = SHELLS.map((s) => ({ R: s.R, n: Math.round(s.n * density) }))
  const total = shells.reduce((a, s) => a + s.n, 0)
  const pos = new Float32Array(total * 3)
  const shell = new Float32Array(total)
  const rnd = new Float32Array(total)
  const R = rng(7)
  const ranges = []
  let o = 0
  shells.forEach((s, k) => {
    fibShell(s.n, s.R, k * 1.3, pos, o * 3)
    for (let i = 0; i < s.n; i++) { shell[o + i] = k; rnd[o + i] = R() }
    ranges.push([o, o + s.n])
    o += s.n
  })
  const hashes = shells.map((s, k) => makeHash(pos, ranges[k][0], ranges[k][1], Math.sqrt((4 * Math.PI * s.R * s.R) / s.n) * 1.6))

  // links: 3 nearest on the same shell + sparse radial links to the shell outside
  const seen = new Set()
  const segs = [] // [i, j, kind]
  shells.forEach((s, k) => {
    const [a, b] = ranges[k]
    for (let i = a; i < b; i++) {
      const nn = hashes[k].near(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 3, i)
      for (const [, j] of nn) {
        const key = i < j ? i * 65536 + j : j * 65536 + i
        if (seen.has(key)) continue
        seen.add(key)
        segs.push(i, j, 0)
      }
      if (k > 0 && rnd[i] < 0.22) {
        const outR = shells[k - 1].R / s.R
        const nn2 = hashes[k - 1].near(pos[i * 3] * outR, pos[i * 3 + 1] * outR, pos[i * 3 + 2] * outR, 1)
        if (nn2.length) segs.push(i, nn2[0][1], 1)
      }
    }
  })
  return { pos, shell, rnd, ranges, segs, hashes, total }
}

const COMMON = /* glsl */ `
uniform float u_time;
uniform float u_pr;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_hover;
uniform float u_reveal;
uniform vec3 u_gold;
float hov(vec4 clip){
  vec2 sp = (clip.xy / clip.w * 0.5 + 0.5) * u_res;
  vec2 d = sp - u_mouse;
  return u_hover * exp(-dot(d, d) / (2.0 * 120.0 * 120.0));
}
// node 0 is where the lattice grows from
float grow(vec3 p){
  float a = acos(clamp(dot(normalize(p), u_gold), -1.0, 1.0)) / 3.14159;
  return smoothstep(a - 0.02, a + 0.06, u_reveal * 1.12);
}
`

export function nodeMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: COMMON + /* glsl */ `
      attribute float a_shell;
      attribute float a_rnd;
      varying float v_a;
      varying vec3 v_col;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(wp.xyz);
        vec3 toC = cameraPosition - wp.xyz;
        float dist = length(toC);
        float facing = dot(n, toC / dist);
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        // front of the shell, or simply close to the lens (when we fly through)
        float front = max(smoothstep(-0.1, 0.55, facing), smoothstep(9.0, 2.5, dist));
        float sk = 1.0 - a_shell * 0.19;
        float h = hov(gl_Position);
        float persp = clamp(15.0 / max(-mv.z, 0.01), 0.6, 6.0);
        float size = mix(1.6, 4.2, front * sk) * persp * (1.0 + h * 0.9);
        size *= 0.85 + 0.3 * a_rnd;
        float tw = 0.75 + 0.25 * sin(u_time * (0.6 + a_rnd * 2.0) + a_rnd * 40.0);
        float a = mix(0.12, 1.0, front) * sk * tw;
        a = a + h * 0.55 * (0.3 + front);
        // close to the lens: soften, then vanish (flying through)
        a *= smoothstep(0.35, 1.6, -mv.z);
        a *= grow(position);
        gl_PointSize = min(size, 14.0) * u_pr;
        v_a = a;
        v_col = mix(vec3(0.62, 0.66, 0.86), vec3(0.93, 0.95, 0.98), front);
        v_col = mix(v_col, vec3(0.5, 0.85, 1.0), clamp(h * 1.2, 0.0, 0.8));
      }`,
    fragmentShader: /* glsl */ `
      varying float v_a;
      varying vec3 v_col;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c) * 2.0;
        float core = smoothstep(0.85, 0.15, r);
        float halo = exp(-r * r * 4.0) * 0.25;
        float a = (core + halo) * v_a;
        if (a < 0.003) discard;
        gl_FragColor = vec4(v_col * a, a);
      }`,
  })
}

export function linkMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: COMMON + /* glsl */ `
      attribute float a_t;
      attribute float a_seed;
      attribute float a_kind;
      attribute float a_shell;
      varying float v_t;
      varying float v_seed;
      varying float v_a;
      varying float v_kind;
      varying float v_h;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 toC = cameraPosition - wp.xyz;
        float dist = length(toC);
        float facing = dot(normalize(wp.xyz), toC / dist);
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        float front = max(smoothstep(-0.1, 0.6, facing), smoothstep(9.0, 2.5, dist));
        float sk = 1.0 - a_shell * 0.18;
        float h = hov(gl_Position);
        float a = a_kind > 0.5 ? 0.13 : mix(0.04, 0.3, front) * sk;
        a += h * 0.22;
        a *= smoothstep(0.3, 1.4, -mv.z);
        a *= grow(position);
        v_a = a; v_t = a_t; v_seed = a_seed; v_kind = a_kind; v_h = h;
      }`,
    fragmentShader: /* glsl */ `
      uniform float u_time;
      varying float v_t;
      varying float v_seed;
      varying float v_a;
      varying float v_kind;
      varying float v_h;
      void main(){
        vec3 base = v_kind > 0.5 ? vec3(0.42, 0.30, 1.0) : vec3(0.68, 0.71, 0.78);
        vec3 col = base * v_a;
        // packets of light: a fraction of links carry a travelling pulse
        float carrier = step(v_seed, 0.045 + v_h * 0.25);
        float spd = 0.35 + fract(v_seed * 37.13) * 0.6;
        float ph = fract(u_time * spd + v_seed * 13.7);
        float dir = step(0.5, fract(v_seed * 91.7));
        float t = mix(v_t, 1.0 - v_t, dir);
        float d = t - ph;
        float pk = exp(-d * d / 0.006) * carrier * smoothstep(0.04, 0.2, v_a);
        col += vec3(0.55, 0.86, 1.0) * pk * 0.8;
        float a = v_a + pk * 0.8;
        gl_FragColor = vec4(col, a);
      }`,
  })
}

export function signalMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: COMMON + /* glsl */ `
      attribute float a_t;
      uniform float u_sigDraw;
      varying float v_t;
      varying float v_a;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        v_t = a_t;
        v_a = smoothstep(0.3, 1.4, -mv.z) * (1.0 - smoothstep(u_sigDraw - 0.03, u_sigDraw, a_t));
      }`,
    fragmentShader: /* glsl */ `
      uniform float u_time;
      uniform float u_sigPhase;
      varying float v_t;
      varying float v_a;
      void main(){
        float d = v_t - u_sigPhase;
        float head = exp(-d * d / 0.0012);
        float tail = smoothstep(-0.25, 0.0, d) * step(d, 0.0) * 0.6;
        vec3 cy = vec3(0.5, 0.85, 1.0);
        float a = (0.85 + head * 2.0 + tail) * v_a;
        gl_FragColor = vec4(cy * a, a);
      }`,
  })
}
