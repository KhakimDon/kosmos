// S04 — "Armillary of thought": a real 3D instrument of great circles in three shells,
// a graduated dial, intersection nodes, travelling signals and a beating centre.
// World units = design px at the z=0 plane (camera distance chosen so 1300 units fill the height).
import * as THREE from 'three'

const D2R = Math.PI / 180
export const FOV = 16
export const DIST = 650 / Math.tan((FOV / 2) * D2R) // ≈ 2426

const SILVER = new THREE.Color('#AEB6C8')
const WHITE = new THREE.Color('#EEF1F7')
const GOLD = new THREE.Color('#E8C27A')
const SIGNAL = new THREE.Color('#E6F1FF')

// three shells of great circles (outer 6, middle 6, inner 4 = 16)
export const SHELLS = [
  { R: 440, front: 0.8, back: 0.11, lag: 5.0, rate: 0.05, axis: new THREE.Vector3(0.1, 1, 0.04).normalize() },
  { R: 290, front: 0.74, back: 0.1, lag: 2.6, rate: -0.075, axis: new THREE.Vector3(-0.28, 1, 0.12).normalize() },
  { R: 158, front: 0.85, back: 0.2, lag: 1.4, rate: 0.12, axis: new THREE.Vector3(0.35, 1, -0.2).normalize() },
]
// [shell, theta (deg from view axis), phi (deg, screen direction of the normal), precession rad/s, spin deg]
const RINGS = [
  [0, 77, 96, 0.012, 10], [0, 58, 28, -0.018, 140], [0, 81, 6, 0.02, 250], [0, 70, 160, -0.014, 60], [0, 52, 128, 0.016, 300], [0, 66, 236, -0.01, 200],
  [1, 70, 72, -0.02, 30], [1, 79, -24, 0.026, 170], [1, 84, 192, -0.017, 280], [1, 57, 122, 0.022, 90], [1, 74, 102, -0.03, 330], [1, 64, 14, 0.018, 220],
  [2, 61, 40, 0.035, 0], [2, 75, 124, -0.04, 120], [2, 69, 82, 0.03, 240], [2, 54, 168, -0.028, 60],
]
const DIAL = { R: 466, theta: 25, phi: 24, off: new THREE.Vector3(-24, -20, 0) }

const LINE_VERT = /* glsl */ `
uniform float u_R; uniform float u_cz; uniform float u_front; uniform float u_back;
attribute float a_t;
varying float v_t; varying float v_a; varying float v_f;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float f = clamp((wp.z - u_cz) / u_R, -1.0, 1.0);
  v_f = smoothstep(-0.28, 0.28, f);
  v_a = mix(u_back, u_front, v_f);
  v_t = a_t;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const LINE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 u_color; uniform float u_draw; uniform float u_head; uniform float u_sig; uniform float u_fade; uniform float u_tip;
varying float v_t; varying float v_a; varying float v_f;
void main(){
  if (v_t > u_draw) discard;
  float a = v_a;
  float edge = u_draw - v_t;
  a += u_tip * (1.0 - step(0.9999, u_draw)) * exp(-edge * 70.0) * 0.9;
  float d = u_head - v_t; d += step(d, 0.0);
  float tail = u_sig * (exp(-d * 30.0) * 0.9 + exp(-d * 220.0) * 1.4) * (0.25 + 0.75 * v_f);
  vec3 col = u_color * a * u_fade + vec3(0.9, 0.95, 1.0) * tail * u_fade;
  gl_FragColor = vec4(col, 1.0);
}`

const PT_VERT = /* glsl */ `
uniform float u_dpr; uniform vec2 u_view; uniform vec2 u_mouse; uniform float u_hover;
attribute float a_size; attribute float a_alpha; attribute float a_kind; attribute vec3 a_col;
varying float v_alpha; varying float v_kind; varying float v_S; varying float v_rad; varying float v_g; varying vec3 v_col;
void main(){
  vec4 cp = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec2 ndc = cp.xy / cp.w;
  vec2 sp = vec2((ndc.x * 0.5 + 0.5) * u_view.x, (0.5 - ndc.y * 0.5) * u_view.y);
  float g = a_kind < 0.5 ? smoothstep(170.0, 8.0, length(sp - u_mouse)) * u_hover : 0.0;
  g *= g;
  v_g = g;
  float rad = a_size * 0.5 * (1.0 + g * 0.8);
  float S = rad * 2.0 + 16.0 + g * 20.0;
  if (a_kind > 0.5 && a_kind < 1.5) S = 24.0;
  if (a_kind > 1.5 && a_kind < 2.5) S = 72.0;
  v_S = S; v_rad = rad; v_alpha = a_alpha; v_kind = a_kind; v_col = a_col;
  gl_PointSize = S * u_dpr;
  gl_Position = cp;
}`
const PT_FRAG = /* glsl */ `
precision highp float;
varying float v_alpha; varying float v_kind; varying float v_S; varying float v_rad; varying float v_g; varying vec3 v_col;
void main(){
  float r = length(gl_PointCoord - 0.5) * v_S;
  float a;
  if (v_kind < 0.5) {
    float core = smoothstep(v_rad + 0.7, v_rad - 0.45, r);
    float s = 1.6 + v_rad + v_g * 6.0;
    float halo = exp(-r * r / (2.0 * s * s)) * (0.18 + v_g * 0.85);
    a = core * (1.0 + v_g * 0.6) + halo;
  } else if (v_kind < 1.5) {
    float core = smoothstep(3.1, 2.0, r);
    float ring = smoothstep(0.85, 0.05, abs(r - 7.0)) * 0.75;
    float halo = exp(-r * r / 40.0) * 0.4;
    a = core + ring + halo;
  } else if (v_kind < 2.5) {
    float core = smoothstep(v_rad + 0.7, v_rad - 0.6, r);
    float disc = smoothstep(7.4, 6.2, r) * 0.13;
    float s = 5.0 + v_rad * 1.8;
    float halo = exp(-r * r / (2.0 * s * s)) * 0.3;
    a = core + disc + halo;
  } else {
    float core = smoothstep(v_rad + 0.6, v_rad - 0.5, r);
    float halo = exp(-r * r / 14.0) * 0.7;
    a = core + halo;
  }
  a *= v_alpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(v_col * a, 1.0);
}`

function lineMaterial(color, front, back, R) {
  return new THREE.ShaderMaterial({
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
    uniforms: {
      u_color: { value: new THREE.Vector3(color.r, color.g, color.b) },
      u_front: { value: front }, u_back: { value: back }, u_R: { value: R }, u_cz: { value: 0 },
      u_draw: { value: 0 }, u_head: { value: 0 }, u_sig: { value: 0 }, u_fade: { value: 1 }, u_tip: { value: 1 },
    },
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  })
}

function circleGeometry(n = 320) {
  const pos = new Float32Array((n + 1) * 3)
  const t = new Float32Array(n + 1)
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    pos[i * 3] = Math.cos(a); pos[i * 3 + 1] = Math.sin(a); pos[i * 3 + 2] = 0
    t[i] = i / n
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('a_t', new THREE.BufferAttribute(t, 1))
  return g
}

// dial angle a (deg, design convention: 000° left, 090° bottom, 270° top) -> local plane angle
const dialLocal = (aDeg) => Math.PI + aDeg * D2R // 180° + a, CCW in world (y up)

function tickGeometry(R, filter, len) {
  const pos = []
  const t = []
  for (let k = 0; k < 288; k++) {
    const aDeg = k * 1.25
    const L = filter(k)
    if (!L) continue
    const a = dialLocal(aDeg)
    const c = Math.cos(a), s = Math.sin(a)
    pos.push(c * R, s * R, 0, c * (R + L), s * (R + L), 0)
    t.push(aDeg / 360, aDeg / 360)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('a_t', new THREE.BufferAttribute(new Float32Array(t), 1))
  return g
}

function normalFrom(theta, phi, out = new THREE.Vector3()) {
  const th = theta * D2R, ph = phi * D2R
  return out.set(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th))
}

const Z = new THREE.Vector3(0, 0, 1)
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _qi = new THREE.Quaternion()

export class Armillary {
  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 1440 / 1300, 10, 20000)
    this.camera.position.set(0, 0, DIST)
    this.root = new THREE.Group()
    this.scene.add(this.root)
    this.geos = []
    this.mats = []

    const circle = circleGeometry(360)
    this.geos.push(circle)

    // great circles
    this.rings = RINGS.map(([s, theta, phi, prec, spin], i) => {
      const sh = SHELLS[s]
      const mat = lineMaterial(SILVER, sh.front, sh.back, sh.R)
      this.mats.push(mat)
      const line = new THREE.Line(circle, mat)
      line.frustumCulled = false
      line.renderOrder = 1
      this.root.add(line)
      return {
        i, s, theta, phi, prec, spin: spin * D2R, line, mat,
        dTheta: ((i * 37) % 11 - 5) * 2.6, dPhi: ((i * 53) % 13 - 6) * 3.2, // unfold spread (deg)
        draw: 0, settle: 0, q: new THREE.Quaternion(), qInv: new THREE.Quaternion(), n: new THREE.Vector3(), R: sh.R,
        sig: null, nodes: [],
      }
    })
    // flattened (star-chart) radii: concentric, inner shells closest to the centre
    const order = [...this.rings].sort((a, b) => b.s - a.s || a.i - b.i)
    order.forEach((r, k) => { r.flatR = 150 + k * 92 })

    // dial (graduated outer ring) + inner dial + ticks
    this.dial = new THREE.Group()
    this.root.add(this.dial)
    this.dialBase = new THREE.Quaternion().setFromUnitVectors(Z, normalFrom(DIAL.theta, DIAL.phi))
    const mk = (geo, R, front, back, Type = THREE.Line) => {
      const m = lineMaterial(SILVER, front, back, DIAL.R)
      this.mats.push(m)
      const o = new Type(geo, m)
      o.frustumCulled = false
      o.renderOrder = 0
      if (R) o.scale.setScalar(R)
      this.dial.add(o)
      return o
    }
    // circle geometry starts at angle 0 (local +x = design 180°); rotate so draw starts at 000° (left)
    const dialCircle = circleGeometry(480)
    dialCircle.rotateZ(Math.PI)
    this.geos.push(dialCircle)
    this.dialRing = mk(dialCircle, DIAL.R, 0.7, 0.2)
    this.dialInner = mk(dialCircle, DIAL.R - 12, 0.36, 0.1)
    const gMinor = tickGeometry(DIAL.R, (k) => (k % 4 ? 6.5 : 0))
    const gMajor = tickGeometry(DIAL.R, (k) => (k % 4 ? 0 : k % 24 ? 15.5 : 31))
    this.geos.push(gMinor, gMajor)
    this.ticksMinor = mk(gMinor, 0, 0.42, 0.12, THREE.LineSegments)
    this.ticksMajor = mk(gMajor, 0, 0.78, 0.2, THREE.LineSegments)
    this.dialParts = [this.dialRing, this.dialInner, this.ticksMinor, this.ticksMajor]
    this.dialDraw = 0

    // nodes: intersections of great circles within each shell (antipodal pairs)
    this.nodes = []
    for (let a = 0; a < this.rings.length; a++) {
      for (let b = a + 1; b < this.rings.length; b++) {
        if (this.rings[a].s !== this.rings[b].s) continue
        for (const sign of [1, -1]) {
          const k = this.nodes.length
          const bright = (k * 7) % 5 < 2
          const node = { a, b, sign, idx: k, pos: new THREE.Vector3(), f: 0, ta: 0, tb: 0, flash: 0, vis: 0, bright, gold: false, lit: 0 }
          this.nodes.push(node)
          this.rings[a].nodes.push(node)
          this.rings[b].nodes.push(node)
        }
      }
    }
    // exactly one gold node, on the outer shell
    this.nodes[13].gold = true
    this.gold = this.nodes[13]

    const NN = this.nodes.length
    this.NN = NN
    const NP = NN + this.rings.length + 1
    this.ptPos = new Float32Array(NP * 3)
    this.ptSize = new Float32Array(NP)
    this.ptAlpha = new Float32Array(NP)
    this.ptKind = new Float32Array(NP)
    this.ptCol = new Float32Array(NP * 3)
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(this.ptPos, 3).setUsage(THREE.DynamicDrawUsage))
    pg.setAttribute('a_size', new THREE.BufferAttribute(this.ptSize, 1).setUsage(THREE.DynamicDrawUsage))
    pg.setAttribute('a_alpha', new THREE.BufferAttribute(this.ptAlpha, 1).setUsage(THREE.DynamicDrawUsage))
    pg.setAttribute('a_kind', new THREE.BufferAttribute(this.ptKind, 1))
    pg.setAttribute('a_col', new THREE.BufferAttribute(this.ptCol, 3))
    this.geos.push(pg)
    this.ptU = { u_dpr: { value: 1 }, u_view: { value: new THREE.Vector2(1440, 1300) }, u_mouse: { value: new THREE.Vector2(-9999, -9999) }, u_hover: { value: 1 } }
    const pm = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG, uniforms: this.ptU,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    })
    this.mats.push(pm)
    this.points = new THREE.Points(pg, pm)
    this.points.frustumCulled = false
    this.points.renderOrder = 3
    this.root.add(this.points)
    const setCol = (k, c) => { this.ptCol[k * 3] = c.r; this.ptCol[k * 3 + 1] = c.g; this.ptCol[k * 3 + 2] = c.b }
    this.nodes.forEach((n, k) => {
      this.ptKind[k] = n.gold ? 1 : 0
      setCol(k, n.gold ? GOLD : n.bright ? WHITE : SILVER)
    })
    this.headBase = NN
    this.rings.forEach((r, i) => { this.ptKind[NN + i] = 3; setCol(NN + i, SIGNAL) })
    this.centreIdx = NP - 1
    this.ptKind[this.centreIdx] = 2
    setCol(this.centreIdx, WHITE)

    // motion state
    this.spin = 0
    this.time = 0
    this.qDragT = new THREE.Quaternion() // gyroscope target (drag)
    this.qHover = new THREE.Quaternion()
    this.shellQ = SHELLS.map(() => new THREE.Quaternion())
    this.dialQ = new THREE.Quaternion()
    this.qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -64 * D2R)
    this.nextSpawn = 2.5
  }

  /** ring point at parameter t (0..1), group space */
  ringPoint(r, t, out) {
    const a = t * Math.PI * 2
    return out.set(Math.cos(a) * r.scale, Math.sin(a) * r.scale, 0).applyQuaternion(r.q)
  }

  tOn(r, p) {
    _v2.copy(p).applyQuaternion(r.qInv)
    let t = Math.atan2(_v2.y, _v2.x) / (Math.PI * 2)
    return t < 0 ? t + 1 : t
  }

  /**
   * params: { dt, time, unfold, flat, hoverX, hoverY, svel, build (0..1 global), beat }
   */
  update(P) {
    const { dt } = P
    this.time += dt
    const flat = P.flat
    const unfold = P.unfold
    this.spin += dt * (1 + Math.min(Math.abs(P.svel) * 0.05, 3))

    // gyroscope: drag target relaxes slowly back to rest; cursor hover adds a gentle lean
    this.qDragT.slerp(_q.identity(), 1 - Math.exp(-dt * 0.12))
    this.qHover.setFromEuler(new THREE.Euler(P.hoverY * 0.16, P.hoverX * 0.22, 0))
    const target = _q2.copy(this.qDragT).multiply(this.qHover)
    SHELLS.forEach((sh, s) => this.shellQ[s].slerp(target, 1 - Math.exp(-dt * sh.lag)))
    this.dialQ.slerp(target, 1 - Math.exp(-dt * 7))

    // ---- rings
    for (const r of this.rings) {
      const sh = SHELLS[r.s]
      const th = r.theta + unfold * r.dTheta + (1 - r.settle) * 34
      const ph = r.phi + unfold * r.dPhi + (1 - r.settle) * (r.i % 2 ? 40 : -40)
      normalFrom(th, ph, _v)
      _q.setFromUnitVectors(Z, _v)
      // precession of this ring about its shell axis + layer rotation of the shell
      const layer = sh.rate * this.spin + r.prec * this.spin * 3
      _q2.setFromAxisAngle(sh.axis, layer)
      r.q.copy(this.shellQ[r.s]).multiply(_q2).multiply(_q)
      _q2.setFromAxisAngle(Z, r.spin)
      r.q.multiply(_q2)
      if (flat > 0) {
        _q.copy(this.qFlat).multiply(_q2.setFromAxisAngle(Z, r.spin + r.i * 0.7))
        r.q.slerp(_q, flat)
      }
      r.qInv.copy(r.q).invert()
      r.n.copy(Z).applyQuaternion(r.q)
      const shellR = sh.R * (1 + unfold * (r.s === 0 ? 0.05 : r.s === 1 ? -0.02 : -0.1))
      r.scale = shellR + (r.flatR * 1.9 - shellR) * flat * flat
      r.line.quaternion.copy(r.q)
      r.line.scale.setScalar(r.scale)
      const u = r.mat.uniforms
      u.u_draw.value = r.draw
      u.u_R.value = r.scale
      u.u_fade.value = 1 - flat * 0.6
    }

    // ---- dial
    _q.copy(this.dialQ).multiply(this.dialBase)
    if (flat > 0) _q.slerp(this.qFlat, flat)
    this.dial.quaternion.copy(_q)
    this.dial.position.copy(DIAL.off).multiplyScalar(1 - flat)
    this.dial.scale.setScalar(1 + flat * flat * 2.9)
    for (const o of this.dialParts) {
      o.material.uniforms.u_draw.value = this.dialDraw
      o.material.uniforms.u_R.value = DIAL.R * this.dial.scale.x
      o.material.uniforms.u_fade.value = o.isLineSegments ? 1 - flat * 0.9 : 1 - flat * 0.55
    }

    // ---- nodes (true intersections, recomputed every frame)
    const nodeFade = (1 - flat) * (1 - flat)
    for (const n of this.nodes) {
      const ra = this.rings[n.a], rb = this.rings[n.b]
      _v.crossVectors(ra.n, rb.n)
      const L = _v.length()
      if (L > 1e-5) _v.multiplyScalar((n.sign * ra.scale) / L)
      n.pos.copy(_v)
      n.f = THREE.MathUtils.clamp(n.pos.z / ra.scale, -1, 1)
      n.ta = this.tOn(ra, n.pos)
      n.tb = this.tOn(rb, n.pos)
      const vis = (n.ta <= ra.draw + 1e-4 ? 1 : 0) * (n.tb <= rb.draw + 1e-4 ? 1 : 0)
      if (vis && !n.lit) { n.lit = 1; n.flash = 1 }
      n.vis += ((vis ? 1 : 0) - n.vis) * (1 - Math.exp(-dt * 10))
      n.flash *= Math.exp(-dt * 2.4)
      const k = n.idx
      this.ptPos[k * 3] = n.pos.x; this.ptPos[k * 3 + 1] = n.pos.y; this.ptPos[k * 3 + 2] = n.pos.z
      const depth = THREE.MathUtils.smoothstep(n.f, -0.35, 0.35)
      const base = n.gold ? 1 : n.bright ? 0.82 : 0.32
      const back = n.gold ? 0.25 : n.bright ? 0.12 : 0.08
      const crit = (ra.s === 2 ? 1.15 : 1)
      this.ptAlpha[k] = (back + (base - back) * depth) * crit * n.vis * nodeFade + n.flash * 0.9 * n.vis * nodeFade
      this.ptSize[k] = (n.bright ? 3 : 2) * (ra.s === 2 && n.bright ? 1.1 : 1) + n.flash * 2.2
    }

    // ---- signals: thoughts hop node → node along rings, then onto the crossing ring
    this.updateSignals(P)

    // ---- centre heartbeat
    const c = this.centreIdx
    this.ptPos[c * 3] = 0; this.ptPos[c * 3 + 1] = 0; this.ptPos[c * 3 + 2] = 0
    this.ptAlpha[c] = P.centre * (1 - flat * 0.7) * (0.85 + P.beat * 0.6)
    this.ptSize[c] = 2.6 + P.beat * 1.6

    const g = this.points.geometry.attributes
    g.position.needsUpdate = true
    g.a_size.needsUpdate = true
    g.a_alpha.needsUpdate = true
  }

  spawn(fromNode, ringIdx, hops) {
    const r = this.rings[ringIdx]
    if (r.sig || r.draw < 0.999) return false
    // next node along +t on this ring
    const t0 = fromNode.a === ringIdx ? fromNode.ta : fromNode.tb
    let best = null, bd = 9
    for (const n of r.nodes) {
      if (n === fromNode) continue
      const tn = n.a === ringIdx ? n.ta : n.tb
      let d = tn - t0
      if (d <= 0.004) d += 1
      if (d < bd) { bd = d; best = n }
    }
    if (!best) return false
    r.sig = { from: fromNode, to: best, t: 0, dur: 0.35 + bd * 2.4, hops }
    return true
  }

  updateSignals(P) {
    const dt = P.dt
    const live = P.signals * (1 - P.flat)
    // new thought: on every heartbeat ("lub") and occasionally in between
    this.nextSpawn -= dt
    if (live > 0.5 && (P.beatOnset || this.nextSpawn <= 0)) {
      this.nextSpawn = 1.1 + Math.random() * 1.4
      const cand = this.nodes.filter((n) => n.f > -0.1 && n.lit)
      if (cand.length) {
        const n = cand[(Math.random() * cand.length) | 0]
        this.spawn(n, Math.random() < 0.5 ? n.a : n.b, 2 + ((Math.random() * 4) | 0))
      }
    }
    for (const r of this.rings) {
      const k = this.headBase + r.i
      const s = r.sig
      if (!s) {
        r.mat.uniforms.u_sig.value = 0
        this.ptAlpha[k] = 0
        continue
      }
      s.t += dt / s.dur
      const e = s.t < 1 ? 0.5 - 0.5 * Math.cos(Math.PI * Math.min(s.t, 1)) : 1
      const ta = s.from.a === r.i ? s.from.ta : s.from.tb
      let tb = s.to.a === r.i ? s.to.ta : s.to.tb
      if (tb <= ta) tb += 1
      let head = ta + (tb - ta) * e
      head -= Math.floor(head)
      const env = Math.min(1, s.t * 6) * live
      r.mat.uniforms.u_head.value = head
      r.mat.uniforms.u_sig.value = env * (s.t < 1 ? 1 : Math.max(0, 1 - (s.t - 1) * 5))
      this.ringPoint(r, head, _v)
      this.ptPos[k * 3] = _v.x; this.ptPos[k * 3 + 1] = _v.y; this.ptPos[k * 3 + 2] = _v.z
      const depth = THREE.MathUtils.smoothstep(_v.z / r.scale, -0.4, 0.4)
      this.ptAlpha[k] = (0.25 + 0.75 * depth) * r.mat.uniforms.u_sig.value
      this.ptSize[k] = 2.2
      if (s.t >= 1 && !s.arrived) {
        s.arrived = true
        s.to.flash = Math.min(1.2, s.to.flash + 1)
        if (s.hops > 0) {
          const other = s.to.a === r.i ? s.to.b : s.to.a
          s.next = [s.to, other, s.hops - 1]
        }
      }
      if (s.t >= 1.2) {
        r.sig = null
        if (s.next) this.spawn(...s.next)
      }
    }
  }

  /** evaluate the assembled rest pose (fully drawn, settled), run fn, then restore the live state */
  atRest(P, fn) {
    const saved = this.rings.map((r) => [r.draw, r.settle])
    const savedN = this.nodes.map((n) => [n.lit, n.flash, n.vis])
    const dd = this.dialDraw
    this.rings.forEach((r) => { r.draw = 1; r.settle = 1 })
    this.update({ ...P, dt: 0, signals: 0 })
    this.nodes.forEach((n) => { n.vis = 1 })
    this.root.updateMatrixWorld()
    this.camera.updateMatrixWorld()
    fn()
    this.rings.forEach((r, i) => { r.draw = saved[i][0]; r.settle = saved[i][1] })
    this.nodes.forEach((n, i) => { [n.lit, n.flash, n.vis] = savedN[i] })
    this.dialDraw = dd
  }

  setGold(node) {
    const setCol = (k, c) => { this.ptCol[k * 3] = c.r; this.ptCol[k * 3 + 1] = c.g; this.ptCol[k * 3 + 2] = c.b }
    for (const n of this.nodes) {
      n.gold = n === node
      this.ptKind[n.idx] = n.gold ? 1 : 0
      setCol(n.idx, n.gold ? GOLD : n.bright ? WHITE : SILVER)
    }
    this.gold = node
    const g = this.points.geometry.attributes
    g.a_kind.needsUpdate = true
    g.a_col.needsUpdate = true
  }

  /** project a group-space point to design px (1440×1300 stage) */
  toDesign(p, out) {
    _v.copy(p).applyMatrix4(this.root.matrixWorld).project(this.camera)
    out.x = (_v.x * 0.5 + 0.5) * 1440
    out.y = (0.5 - _v.y * 0.5) * 1300
    return out
  }

  /** dial point at design angle aDeg and radius rr (group space) */
  dialPoint(aDeg, rr, out) {
    const a = dialLocal(aDeg)
    return out.set(Math.cos(a) * rr, Math.sin(a) * rr, 0).applyQuaternion(this.dial.quaternion).multiplyScalar(this.dial.scale.x).add(this.dial.position)
  }

  dispose() {
    this.geos.forEach((g) => g.dispose())
    this.mats.forEach((m) => m.dispose())
  }
}
