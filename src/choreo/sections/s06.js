// S06 — The Infinite System
// A real lattice: ~15k nodes on five Fibonacci shells, ~30k nearest-neighbour links,
// radial links between shells. It grows out of node 0 (gold), turns slowly around it,
// carries packets of light along its links, leans with the cursor (spring + inertia),
// lights up under the cursor, and on scroll the camera dives through the shell.
// The monument rate counts up through the orders of magnitude and stays live.
import * as THREE from 'three'
import { autoChoreo, gsap, ScrollTrigger, state } from '../auto.js'
import { engine } from '../../engine/engine.js'
import { buildLattice, nodeMaterial, linkMaterial, signalMaterial, SHELLS } from './s06-net.js'

const FW = 1440, FH = 1300
const FOV = 45
const R0 = SHELLS[0].R
const GOLD_PX = [996.75, 647]
const SIG_PX = [217.4, 1180.8]
const DIVE_PX = [700, 1110] // the camera dives along the ray through this pixel
const SIG_PERIOD = 3.2

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

export default function s06(ctx) {
  const { el, view } = ctx
  const cleanups = []
  const u = ctx.u

  // ---- retire the static vectors (keep labels, gold, its leader)
  const HIDE = ['Radial links', 'Links — far', 'Nodes — depth 5', 'Nodes — depth 4', 'Links — mid', 'Nodes — depth 3',
    'Links — near', 'Nodes — depth 2', 'Nodes — depth 1', 'Signal — path', 'Signal — nodes']
  HIDE.forEach((n) => { const e = ctx.q(n); if (e) { e.setAttribute('data-noauto', ''); e.style.visibility = 'hidden' } })
  const gold = ctx.q('Gold node')
  const leaderSvg = ctx.q('Gold leader')
  const leader = leaderSvg?.querySelector('path')
  const goldCap = ctx.q('Gold caption')
  const depthFade = ctx.q('Depth fade')
  const mono = ctx.q('Monument number')
  const expo = ctx.q('Exponent')
  ;[gold, leaderSvg, mono, expo].forEach((e) => e?.setAttribute('data-noauto', ''))

  const autoClean = autoChoreo(ctx, { noCamera: true, skip: ['Monument number', 'Exponent'] })
  const enter = ctx.enter

  // ---- 3D
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, FW / FH, 0.05, 200)
  const P5 = 1 / Math.tan((FOV * Math.PI) / 360)
  const D0 = R0 / Math.sin(Math.atan((844 / (FH / 2)) / P5))
  camera.position.set(0, 0, D0)
  const C0 = camera.position.clone()
  let shiftY = 1 // lens shift: sphere centre sits on the frame's bottom edge
  const applyLens = (aspect) => {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    camera.projectionMatrix.elements[9] = shiftY
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
  }
  applyLens(FW / FH)
  const rayDir = (px, py) => {
    const nx = (px / FW) * 2 - 1, ny = 1 - (py / FH) * 2
    return new THREE.Vector3(nx / camera.projectionMatrix.elements[0], (ny + shiftY) / P5, -1).normalize()
  }
  const hitSphere = (o, d, R) => {
    const b = o.dot(d), c = o.lengthSq() - R * R
    const h = b * b - c
    return h < 0 ? null : o.clone().addScaledVector(d, -b - Math.sqrt(h))
  }

  // lighter lattice on small / touch screens
  const L = buildLattice(matchMedia('(max-width: 800px), (pointer: coarse)').matches ? 0.4 : 1)
  // node 0 = the outer node under the designed gold pixel
  const gHit = hitSphere(C0, rayDir(...GOLD_PX), R0)
  const g0 = L.hashes[0].near(gHit.x, gHit.y, gHit.z, 1)[0][1]
  const goldObj = new THREE.Vector3(L.pos[g0 * 3], L.pos[g0 * 3 + 1], L.pos[g0 * 3 + 2])
  const goldAxis = goldObj.clone().normalize()
  const diveHit = hitSphere(C0, rayDir(...DIVE_PX), R0)

  const U = {
    u_time: { value: 0 }, u_pr: { value: 1 }, u_res: { value: new THREE.Vector2(FW, FH) }, u_mouse: { value: new THREE.Vector2(-1e4, -1e4) },
    u_hover: { value: 0 }, u_reveal: { value: 0 }, u_gold: { value: goldAxis.clone() }, u_sigPhase: { value: -1 }, u_sigDraw: { value: 0 },
  }
  const group = new THREE.Group()
  scene.add(group)
  // the incoming signal leans with the cursor but does not spin with the lattice
  const sigGroup = new THREE.Group()
  scene.add(sigGroup)

  // links (one draw call)
  const nSeg = L.segs.length / 3
  const lp = new Float32Array(nSeg * 6), lt = new Float32Array(nSeg * 2), ls = new Float32Array(nSeg * 2), lk = new Float32Array(nSeg * 2), lsh = new Float32Array(nSeg * 2)
  for (let s = 0; s < nSeg; s++) {
    const i = L.segs[s * 3], j = L.segs[s * 3 + 1], kind = L.segs[s * 3 + 2]
    lp.set([L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2], L.pos[j * 3], L.pos[j * 3 + 1], L.pos[j * 3 + 2]], s * 6)
    lt[s * 2] = 0; lt[s * 2 + 1] = 1
    const seed = (Math.sin(s * 12.9898) * 43758.5453) % 1
    ls[s * 2] = ls[s * 2 + 1] = Math.abs(seed)
    lk[s * 2] = lk[s * 2 + 1] = kind
    lsh[s * 2] = lsh[s * 2 + 1] = Math.min(L.shell[i], L.shell[j])
  }
  const lg = new THREE.BufferGeometry()
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3))
  lg.setAttribute('a_t', new THREE.BufferAttribute(lt, 1))
  lg.setAttribute('a_seed', new THREE.BufferAttribute(ls, 1))
  lg.setAttribute('a_kind', new THREE.BufferAttribute(lk, 1))
  lg.setAttribute('a_shell', new THREE.BufferAttribute(lsh, 1))
  const links = new THREE.LineSegments(lg, linkMaterial(U))
  links.frustumCulled = false
  group.add(links)

  // nodes (one draw call)
  const ng = new THREE.BufferGeometry()
  ng.setAttribute('position', new THREE.BufferAttribute(L.pos, 3))
  ng.setAttribute('a_shell', new THREE.BufferAttribute(L.shell, 1))
  ng.setAttribute('a_rnd', new THREE.BufferAttribute(L.rnd, 1))
  const nodes = new THREE.Points(ng, nodeMaterial(U))
  nodes.frustumCulled = false
  group.add(nodes)

  // the signal: a chain of links running across the near face into node 0
  const sHit = hitSphere(C0, rayDir(...SIG_PX), R0)
  // a smooth great-circle arc just above the outer shell, beads at even steps
  const NA = 96, NB = 17
  const sDir = sHit.clone().normalize(), gDir = goldAxis.clone()
  const arcAxis = new THREE.Vector3().crossVectors(sDir, gDir).normalize()
  const arcAng = sDir.angleTo(gDir)
  const arcQ = new THREE.Quaternion()
  const arc = []
  for (let k = 0; k <= NA; k++) {
    arcQ.setFromAxisAngle(arcAxis, (arcAng * k) / NA)
    arc.push(sDir.clone().applyQuaternion(arcQ).multiplyScalar(R0 * 1.002))
  }
  const cp = [], ct = []
  for (let k = 0; k < NA; k++) { cp.push(...arc[k].toArray(), ...arc[k + 1].toArray()); ct.push(k / NA, (k + 1) / NA) }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cp), 3))
  sg.setAttribute('a_t', new THREE.BufferAttribute(new Float32Array(ct), 1))
  const signal = new THREE.LineSegments(sg, signalMaterial(U))
  signal.frustumCulled = false
  sigGroup.add(signal)
  // signal nodes: cyan beads
  const bp = new Float32Array(NB * 3), bt = new Float32Array(NB)
  for (let k = 0; k < NB; k++) { const i = Math.round((k * NA) / NB); bp.set(arc[i].toArray(), k * 3); bt[k] = i / NA }
  const bg = new THREE.BufferGeometry()
  bg.setAttribute('position', new THREE.BufferAttribute(bp, 3))
  bg.setAttribute('a_t', new THREE.BufferAttribute(bt, 1))
  const beads = new THREE.Points(bg, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float u_pr; uniform float u_sigPhase; uniform float u_sigDraw; attribute float a_t; varying float v_a;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        float d = a_t - u_sigPhase; float hit = exp(-d*d/0.002);
        v_a = (1.0 + hit*1.5) * step(a_t, u_sigDraw) * smoothstep(0.3, 1.4, -mv.z);
        gl_PointSize = (3.4 + hit*3.0) * clamp(15.0 / -mv.z, 0.6, 5.0) * u_pr; }`,
    fragmentShader: `varying float v_a; void main(){ float r = length(gl_PointCoord-0.5)*2.0; float a = (smoothstep(1.0,0.3,r) + exp(-r*r*3.0)*0.4) * v_a; gl_FragColor = vec4(vec3(0.5,0.85,1.0)*a, a); }`,
  }))
  beads.frustumCulled = false
  sigGroup.add(beads)

  if (view) { view.scene3d = scene; view.camera3d = camera }

  // ---- gold node: DOM dot rides the projected node 0, with a pulse ring
  const ring = document.createElement('div')
  ring.style.cssText = 'position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:0.75px solid rgba(232,194,122,0.8);opacity:0;pointer-events:none'
  ctx.stage.appendChild(ring)
  cleanups.push(() => ring.remove())
  if (gold) {
    gold.style.boxShadow = '0 0 12px 3px rgba(232,194,122,0.45)'
    gold.dataset.cursor = 'object'
    gold.dataset.cursorLabel = 'NODE 0 · NEW LINK'
    gold.style.pointerEvents = 'auto'
  }
  const gC = [GOLD_PX[0], GOLD_PX[1]]
  const goldNow = new THREE.Vector3()

  // ---- monument: odometer through the orders of magnitude, then a live reading
  const odo = { cells: [], set: null }
  if (mono) {
    const txt = mono.textContent // "4.2 × 10"
    mono.textContent = ''
    const mk = (ch, digit) => {
      const s = document.createElement('span')
      if (digit) {
        s.style.display = 'inline-block'; s.style.position = 'relative'
        const i = document.createElement('span'); i.style.display = 'inline-block'; i.textContent = ch; s.appendChild(i)
      } else s.textContent = ch
      mono.appendChild(s)
      return s
    }
    const d0 = mk(txt[0], true); mk(txt[1]); const d1 = mk(txt[2], true); mk(txt.slice(3))
    odo.cells = [d0, d1]
  }
  const live = { v: 0, shown: '4.2', exp: '11', mant: 4.2 }
  function show(m, e, roll) {
    const s = m.toFixed(1)
    const es = String(e)
    if (expo && es !== live.exp) { expo.textContent = es; live.exp = es }
    if (s === live.shown) return
    const prev = live.shown
    live.shown = s
    const chars = [s[0], s[2]]
    odo.cells.forEach((c, k) => {
      const cur = c.lastChild
      if (!roll) { cur.textContent = chars[k]; return }
      if (prev[k * 2] === chars[k]) return
      // roll: the old digit lifts out, the new one rises in from below
      const nx = document.createElement('span')
      nx.style.display = 'inline-block'
      nx.textContent = chars[k]
      cur.style.position = 'absolute'; cur.style.left = '0'; cur.style.top = '0'
      c.appendChild(nx)
      gsap.to(cur, { yPercent: -40, opacity: 0, filter: 'blur(6px)', duration: 0.7, ease: 'power2.in', onComplete: () => cur.remove() })
      gsap.fromTo(nx, { yPercent: 40, opacity: 0, filter: 'blur(6px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.0, ease: 'cine', delay: 0.12 })
    })
  }
  const LOG = Math.log10(4.2e11)
  const count = { e: 0 }
  let counted = false
  if (enter && mono) {
    enter.fromTo([mono, expo], { opacity: 0, y: 30, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'cine', stagger: 0.1 }, 0.1)
    enter.fromTo(count, { e: 0 }, {
      e: 1, duration: 2.8, ease: 'expo.out',
      onUpdate: () => {
        const lv = count.e * LOG
        const e = Math.floor(lv + 1e-6)
        show(Math.min(9.9, Math.pow(10, lv - e)), e, false)
      },
      onComplete: () => { counted = true; nextTick = state.time + 2.4 },
    }, 0.1)
    // the lattice grows out of node 0, then the signal runs in
    enter.fromTo(U.u_reveal, { value: 0 }, { value: 1, duration: 3.4, ease: 'power2.inOut' }, 0.2)
    enter.fromTo(U.u_sigDraw, { value: 0 }, { value: 1.02, duration: 1.6, ease: 'power2.inOut' }, 2.2)
    if (gold) enter.fromTo(gold, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'expo.out' }, 0.25)
    enter.fromTo(ring, { scale: 0.3, opacity: 1 }, { scale: 3.4, opacity: 0, duration: 1.6, ease: 'power2.out' }, 0.3)
    if (leader) enter.fromTo(leader, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.0, ease: 'cine' }, 1.4)
  } else show(4.2, 11, false)
  let nextTick = 0

  // ---- interaction state
  const ms = { x: 0, y: 0, vx: 0, vy: 0 }
  const qSpin = new THREE.Quaternion(), qMouse = new THREE.Quaternion(), eul = new THREE.Euler()
  let p = 0
  const st0 = ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { p = s.progress } })
  cleanups.push(() => st0.kill())
  let lastPulse = 0
  const camTarget = new THREE.Vector3()
  const tmpV = new THREE.Vector3()

  if (view) view.onFrame = (v, st, dtRaw, rect) => {
    const dt = Math.min(dtRaw, 0.05)
    const sc = rect.width / FW
    U.u_time.value = st.time
    U.u_pr.value = engine.pr * sc
    U.u_res.value.set(rect.width, rect.height)
    const inside = st.mouse.x >= rect.left && st.mouse.x <= rect.right && st.mouse.y >= rect.top && st.mouse.y <= rect.bottom
    U.u_hover.value += ((inside ? 1 : 0) - U.u_hover.value) * Math.min(1, dt * 4)
    U.u_mouse.value.set(st.mouse.sx - rect.left, rect.bottom - st.mouse.sy)

    // cursor leans the whole lattice: spring with inertia
    const tx = st.mouse.snx * 0.075, ty = st.mouse.sny * 0.035
    ms.vx += (tx - ms.x) * 10 * dt; ms.vy += (ty - ms.y) * 10 * dt
    ms.vx *= Math.pow(0.04, dt); ms.vy *= Math.pow(0.04, dt)
    ms.x += ms.vx * dt * 2.4; ms.y += ms.vy * dt * 2.4
    qSpin.setFromAxisAngle(goldAxis, st.time * 0.016)
    eul.set(ms.y, ms.x, 0)
    qMouse.setFromEuler(eul)
    group.quaternion.copy(qMouse).multiply(qSpin)
    sigGroup.quaternion.copy(qMouse)

    // scroll: dive through the shell along the ray under DIVE_PX
    const f = smooth(0.42, 0.86, p)
    const fe = f * f * (3 - 2 * f)
    camTarget.copy(diveHit).sub(C0)
    camera.position.copy(C0).addScaledVector(camTarget, fe * 1.04)
    applyLens(rect.width / rect.height)
    camera.updateMatrixWorld()

    // node 0 on screen
    goldNow.copy(goldObj).applyQuaternion(group.quaternion).project(camera)
    const gx = (goldNow.x + 1) / 2 * FW, gy = (1 - goldNow.y) / 2 * FH
    const vis = 1 - smooth(0.04, 0.22, f)
    if (gold) { gold.style.translate = `${(gx - gC[0]).toFixed(2)}px ${(gy - gC[1]).toFixed(2)}px`; gold.style.visibility = vis > 0.01 ? 'visible' : 'hidden' }
    ring.style.translate = `${gx.toFixed(1)}px ${gy.toFixed(1)}px`
    if (leader) leader.setAttribute('d', `M${(gx + 3.4).toFixed(1)} ${(gy - 5).toFixed(1)} L1094 498`)
    if (leaderSvg) leaderSvg.style.opacity = vis
    if (goldCap) goldCap.style.opacity = vis
    if (depthFade) depthFade.style.opacity = (1 - smooth(0.0, 0.5, f)).toFixed(3)

    // signal loop: a packet runs the chain into node 0 → node 0 answers
    const cyc = (st.time % SIG_PERIOD) / SIG_PERIOD
    U.u_sigPhase.value = U.u_sigDraw.value >= 1 ? cyc * 1.25 - 0.05 : -1
    if (U.u_sigDraw.value >= 1 && cyc * 1.25 - 0.05 >= 1 && st.time - lastPulse > SIG_PERIOD * 0.5) {
      lastPulse = st.time
      gsap.fromTo(ring, { scale: 0.4, opacity: 0.9 }, { scale: 3, opacity: 0, duration: 1.4, ease: 'power2.out' })
      if (gold) gsap.fromTo(gold, { scale: 1.8 }, { scale: 1, duration: 0.9, ease: 'power3.out' })
    }

    // fog follows the projected silhouette of the outer shell
    if (u) {
      tmpV.set(0, 0, 0).project(camera)
      const dist = camera.position.length()
      u.u_w = FW; u.u_h = FH
      u.u_cx = (tmpV.x + 1) / 2 * FW
      u.u_cy = (1 - tmpV.y) / 2 * FH
      u.u_r = dist > R0 * 1.01 ? Math.tan(Math.asin(R0 / dist)) * P5 * FH / 2 : 9000
      u.u_fog = 0.35 + fe * 0.25
    }

    // live reading: the rate keeps moving
    if (counted && st.time > nextTick) {
      nextTick = st.time + 1.8 + Math.random() * 1.6
      const m = clamp(live.mant + (Math.random() < 0.5 ? -0.1 : 0.1) + (4.2 - live.mant) * 0.5, 4.0, 4.4)
      live.mant = Math.round(m * 10) / 10
      show(live.mant, 11, true)
    }
  }

  return () => {
    autoClean?.()
    if (view) { view.onFrame = null; view.scene3d = null; view.camera3d = null }
    lg.dispose(); ng.dispose(); sg.dispose(); bg.dispose()
    links.material.dispose(); nodes.material.dispose(); signal.material.dispose(); beads.material.dispose()
    cleanups.forEach((f) => f())
  }
}
