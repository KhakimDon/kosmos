// S05 — The Constellation
// A celestial plate that plots itself: the RA/Dec net draws in, the constellation is
// traced star to star by a plotter head, every system's bodies orbit on their ellipses.
// Hovering a system brings it "in focus" (gold star, reticle, leader, expanded caption);
// the plate turns a few degrees with the cursor like a sky dome, the sky scintillates.
import { autoChoreo, gsap, ScrollTrigger, SplitText, state } from '../auto.js'
import { makeShader } from '../../engine/shader.js'
import { subpaths, fitEllipse, ellipsePoint, ellipseParam, splitPath, rot, reticleD, leaderD } from './s05-chart.js'

const POLE = { x: 1020, y: -210 }
const GOLD = '#E8C27A'
const SCR = '01░▒<>/\\—·×ΛΣΩ∆'

const SYSTEMS = [
  { key: 'Oracle', id: 'NMA-01', cap: 'NMA-01 caption', name: 'Oracle', big: { x: 380, y: 540, side: 'r' },
    line: 'Reasoning engine — long chains of thought, checked at every step before a single word is said.',
    data: ['2 MODELS', '1.2 S / THOUGHT', 'IN ORBIT'] },
  { key: 'Loom', id: 'NMA-02', cap: 'NMA-02 caption', name: 'Loom', big: { x: 700, y: 380, side: 'r' },
    line: 'Synthetic data — whole worlds woven to order, so models can learn what was never recorded.',
    data: ['1 MODEL', '6 H / EPOCH', 'IN ORBIT'] },
  { key: 'Cartograph', id: 'NMA-03', cap: null, name: 'Cartograph', big: { x: 1052, y: 704, side: 'r' },
    line: 'World models — a learned physics of everything a machine can observe, and a few things it cannot yet.',
    data: ['3 MODELS', '0.4 S / STEP', 'IN FLIGHT'] },
  { key: 'Echo', id: 'NMA-04', cap: 'NMA-04 caption', name: 'Echo', big: { x: 800, y: 470, side: 'l' },
    line: 'Voice — speech that listens back, with the timing, breath and texture of a person.',
    data: ['2 MODELS', '80 MS / TURN', 'IN ORBIT'] },
  { key: 'Helix', id: 'NMA-05', cap: 'NMA-05 caption', name: 'Helix', big: { x: 780, y: 990, side: 'l' },
    line: 'Molecular design — proteins and materials folded in silico before anyone touches a pipette.',
    data: ['3 MODELS', '1.8 D / FOLD', 'IGNITING'] },
  { key: 'Sentinel', id: 'NMA-06', cap: 'NMA-06 caption', name: 'Sentinel', big: { x: 520, y: 975, side: 'r' },
    line: 'Alignment — the quiet system that watches all the others, so the gravity holds.',
    data: ['1 MODEL', 'CONTINUOUS', 'ALWAYS ON'] },
]
// constellation figure subpaths, in plotting order: [from, to] system indices
const EDGES = [[5, 0], [0, 1], [1, 2], [2, 3], [2, 4]]

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export default function s05(ctx) {
  const { el, stage } = ctx
  const view = ctx.view
  const cleanups = []
  const q = (n) => ctx.q(n)

  // ---- live sky: same plate, now scintillating and turning with the dome
  let u = ctx.u
  if (view) {
    const orig = view.shader
    const live = makeShader('const-sky-live', ctx.frame.fill?.uniforms || {})
    view.shader = live
    u = live.u
    cleanups.push(() => { view.shader = orig; live.material.dispose() })
  }

  // ---- collect the plate
  const grids = ['Grid — right ascension', 'Grid — declination', 'Grid — reference parallel +30°'].map(q).filter(Boolean)
  const figure = q('Constellation figure')
  const reticle = q('Cartograph — reticle')
  const leader = q('Cartograph — leader')
  const scale = q('Cartograph — orbit scale')
  const bigCap = q('NMA-03 caption (selected)')
  const rotSvgs = [...grids, figure, reticle, leader, scale].filter(Boolean)

  const sys = SYSTEMS.map((S, i) => {
    const orbitsSvg = q(`${S.key} — orbits`)
    const star = q(`${S.key} — star`)
    const sx = parseFloat(star.style.left) + star.offsetWidth / 2
    const sy = parseFloat(star.style.top) + star.offsetHeight / 2
    const orbitPaths = splitPath(orbitsSvg)
    const ellipses = orbitPaths.map((p) => fitEllipse(subpaths(p.getAttribute('d'))[0]))
    const planets = []
    for (let k = 1; k < 6; k++) {
      const pl = q(`${S.key} — planet ${k}`)
      if (!pl) break
      const px = parseFloat(pl.style.left) + pl.offsetWidth / 2
      const py = parseFloat(pl.style.top) + pl.offsetHeight / 2
      let best = null
      ellipses.forEach((e) => {
        const r = ellipseParam(e, px, py)
        if (!best || Math.abs(r.r - 1) < Math.abs(best.r - 1)) best = { ...r, e }
      })
      const w = 0.62 * Math.pow(26 / best.e.a, 1.5)
      planets.push({ el: pl, x0: px, y0: py, e: best.e, phi: best.phi, w })
    }
    let cap = S.cap ? q(S.cap) : null
    return { S, i, orbitsSvg, orbitPaths, ellipses, star, x: sx, y: sy, starSize: star.offsetWidth, planets, cap,
      color: star.style.backgroundColor, rate: 1, lit: { o: 0 } }
  })

  // Cartograph has no compact caption in the design (it is the one in focus) — clone one
  const proto = sys[0].cap
  if (proto) {
    const c = proto.cloneNode(true)
    c.removeAttribute('data-id')
    c.dataset.name = 'NMA-03 caption'
    c.style.left = '884px'; c.style.top = '842px'
    c.querySelector('[data-name="Designation"]').textContent = 'NMA-03'
    c.querySelector('[data-name="Name"]').textContent = 'Cartograph'
    c.querySelector('[data-name="Line"]').textContent = 'World models'
    proto.parentNode.appendChild(c)
    sys[2].cap = c
    cleanups.push(() => c.remove())
  }

  // nodes we drive ourselves (before autoChoreo)
  const mine = [...rotSvgs, bigCap, ...sys.flatMap((s) => [s.orbitsSvg, s.star, s.cap, ...s.planets.map((p) => p.el)])].filter(Boolean)
  mine.forEach((n) => n.setAttribute('data-noauto', ''))
  rotSvgs.forEach((s) => { s.style.transformOrigin = `${POLE.x}px ${POLE.y}px`; s.style.willChange = 'rotate' })
  sys.forEach((s) => { s.orbitsSvg.style.transformOrigin = `${POLE.x}px ${POLE.y}px` })

  const autoClean = autoChoreo(ctx, { mouse: 0.6, zoomFrom: 1.05, zoomTo: 1.12 })
  const enter = ctx.enter

  // ---- split line work so it can be plotted stroke by stroke
  const gridPaths = grids.flatMap((g) => splitPath(g))
  const edges = figure ? splitPath(figure) : []
  const edgePts = edges.map((p) => { const s = subpaths(p.getAttribute('d'))[0]; return [s[0], s[s.length - 1]] })

  // orbit strokes become opacity-driven
  sys.forEach((s) => s.orbitPaths.forEach((p) => {
    p.setAttribute('stroke', '#EEF1F7')
    p.style.strokeOpacity = 0.18
  }))
  edges.forEach((p) => { p.setAttribute('stroke', '#AEB6C8'); p.style.strokeOpacity = 0.36 })

  // ---- overlay: plotter heads, ignition rings, hit areas
  const layer = document.createElement('div')
  layer.style.cssText = 'position:absolute;left:0;top:0;width:1440px;height:1300px;pointer-events:none;z-index:2'
  stage.appendChild(layer)
  cleanups.push(() => layer.remove())
  const dot = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;' + css; layer.appendChild(d); return d }
  const heads = edges.map(() => dot('width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;box-shadow:0 0 8px 2px rgba(190,215,255,.75),0 0 22px 6px rgba(127,216,255,.25);opacity:0'))
  const rings = sys.map((s) => dot(`width:${s.starSize * 2}px;height:${s.starSize * 2}px;margin:${-s.starSize}px 0 0 ${-s.starSize}px;border:0.75px solid rgba(238,241,247,.7);opacity:0`))
  const headT = edges.map(() => ({ t: 0 }))

  // hit areas = the system groups (the global cursor reads data-cursor)
  sys.forEach((s) => {
    const R = Math.max(46, (Math.max(...s.ellipses.map((e) => e.a)) + 18))
    const h = document.createElement('div')
    h.style.cssText = `position:absolute;left:${s.x - R}px;top:${s.y - R * 0.62}px;width:${R * 2}px;height:${R * 1.24}px;border-radius:50%;pointer-events:auto`
    h.dataset.cursor = 'object'
    h.dataset.cursorLabel = `${s.S.id} · ${s.S.name.toUpperCase()}`
    layer.appendChild(h)
    s.hit = h
    for (const t of [h, s.cap].filter(Boolean)) {
      t.dataset.cursor = 'object'
      t.dataset.cursorLabel = h.dataset.cursorLabel
      t.style.pointerEvents = 'auto'
      t.addEventListener('pointerenter', () => hover(s.i))
      t.addEventListener('pointerleave', () => unhover(s.i))
      t.addEventListener('click', () => select(s.i, true))
    }
  })

  // ---- the expanded caption is a single instrument that travels between systems
  const bc = {
    des: bigCap.querySelector('[data-name="Designation"]'),
    name: bigCap.querySelector('[data-name="Name"]'),
    line: bigCap.querySelector('[data-name="Line"]'),
    rule: bigCap.querySelector('[data-name="Rule"]'),
    vals: [...bigCap.querySelectorAll('[data-name="Value"]')],
    rows: [...bigCap.querySelectorAll('[data-name="Data"] > .ds-frame')],
    keys: [...bigCap.querySelectorAll('[data-name="Key"]')],
  }
  bigCap.dataset.cursor = 'object'
  const leaderPath = leader?.querySelector('path')
  const reticlePath = reticle?.querySelector('path')
  if (reticlePath) reticlePath.setAttribute('stroke', 'rgba(238,241,247,0.75)')
  const ret = { x: sys[2].x, y: sys[2].y, h: 18, a: 0 }
  const drawReticle = () => reticlePath?.setAttribute('d', reticleD(ret.x, ret.y, ret.h, 6, ret.a))

  let sel = 2
  let touched = false
  let hovered = -1
  let focus = { v: 0 } // 0 = idle plate, 1 = a system is being looked at (others dim)
  let swap = null
  let nameSplit = null

  function layoutCaption(s) {
    const B = s.S.big
    bigCap.style.left = B.x + 'px'
    bigCap.style.top = B.y + 'px'
    const right = B.side === 'l'
    bigCap.style.alignItems = right ? 'flex-end' : 'flex-start'
    for (const t of [bc.des, bc.name, bc.line]) t.style.textAlign = right ? 'right' : 'left'
    bc.rows.forEach((r) => { r.style.justifyContent = right ? 'flex-end' : 'flex-start' })
    bc.keys.forEach((k) => { k.style.textAlign = right ? 'right' : 'left' })
    bigCap.dataset.cursorLabel = `${s.S.id} · ${s.S.name.toUpperCase()}`
    leaderPath?.setAttribute('d', leaderD(s, B, s.starSize > 6 ? 24 : 17))
  }

  function styleSystems(dur = 0.8) {
    sys.forEach((s) => {
      const on = s.i === sel
      const dim = focus.v > 0.5 && !on
      gsap.to(s.lit, { o: on ? 1 : 0, duration: dur, ease: 'power2.out', overwrite: 'auto' })
      gsap.to(s.orbitPaths, { strokeOpacity: on ? 0.46 : dim ? 0.08 : 0.18, strokeWidth: on ? 0.8 : 0.5, duration: dur, overwrite: 'auto' })
      gsap.to(s.planets.map((p) => p.el), { opacity: dim ? 0.4 : 1, duration: dur, overwrite: 'auto' })
      if (s.cap) gsap.to(s.cap, { opacity: on ? 0 : dim ? 0.4 : 1, duration: on ? 0.35 : dur, overwrite: 'auto' })
      gsap.to(s.star, {
        backgroundColor: on ? GOLD : s.i === 2 ? '#EEF1F7' : s.color, scale: on ? (s.starSize > 6 ? 1 : 1.5) : 1,
        boxShadow: on ? '0 0 10px 2px rgba(232,194,122,0.55)' : '0 0 0px 0px rgba(232,194,122,0)', opacity: dim ? 0.6 : 1,
        duration: dur, overwrite: 'auto',
      })
    })
    edges.forEach((p, k) => {
      const touch = EDGES[k][0] === sel || EDGES[k][1] === sel
      gsap.to(p, { strokeOpacity: touch ? 0.62 : focus.v > 0.5 ? 0.16 : 0.34, duration: dur, overwrite: 'auto' })
    })
    if (scale) gsap.to(scale, { opacity: sel === 2 ? 1 : 0, duration: dur, overwrite: 'auto' })
  }

  function select(i, user) {
    if (user) lastUser = state.time
    touched = true
    if (!tourAt) tourAt = state.time + 1
    if (i === sel) return
    sel = i
    const s = sys[i]
    swap?.kill()
    // the entrance may still be decoding the caption — take over its targets
    gsap.killTweensOf([bc.des, bc.name, bc.line, bc.rule, ...bc.vals, ...bc.rows, bigCap].filter(Boolean))
    gsap.set([bc.des, bc.name, bc.line, ...bc.vals, ...bc.rows].filter(Boolean), { opacity: 1, y: 0, filter: 'blur(0px)' })
    if (bc.rule) gsap.set(bc.rule, { scaleX: 1 })
    styleSystems()
    gsap.to(ret, { x: s.x, y: s.y, h: s.starSize > 6 ? 18 : 12, a: ret.a + Math.PI / 2, duration: 1.1, ease: 'cine', onUpdate: drawReticle, overwrite: 'auto' })
    swap = gsap.timeline()
    swap.to(bigCap, { opacity: 0, filter: 'blur(6px)', duration: 0.3, ease: 'power2.in' }, 0)
    if (leaderPath) swap.to(leaderPath, { drawSVG: '100% 100%', duration: 0.3, ease: 'power2.in' }, 0)
    swap.add(() => {
      nameSplit?.revert()
      bc.des.textContent = `${s.S.id} · IN FOCUS`
      bc.name.textContent = s.S.name
      bc.line.textContent = s.S.line
      s.S.data.forEach((v, k) => { if (bc.vals[k]) bc.vals[k].textContent = v })
      layoutCaption(s)
      nameSplit = SplitText.create(bc.name, { type: 'chars', mask: 'chars', charsClass: 'sc' })
    }, 0.32)
    swap.set(bigCap, { opacity: 1, filter: 'blur(0px)' }, 0.33)
    if (reticle) gsap.to(reticle, { opacity: 1, duration: 0.4 })
    swap.add(() => {
      gsap.fromTo(nameSplit.chars, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.0, ease: 'cine', stagger: 0.03 })
      gsap.fromTo(bc.des, { opacity: 0 }, { opacity: 1, duration: 0.2 })
      gsap.to(bc.des, { duration: 0.8, scrambleText: { text: bc.des.textContent, chars: SCR, revealDelay: 0.2, speed: 0.7 } })
      gsap.fromTo(bc.line, { opacity: 0, y: 10, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.0, ease: 'cine', delay: 0.12 })
      if (bc.rule) gsap.fromTo(bc.rule, { scaleX: 0, transformOrigin: s.S.big.side === 'l' ? '100% 50%' : '0% 50%' }, { scaleX: 1, duration: 1.0, ease: 'cine', delay: 0.2 })
      bc.vals.forEach((v, k) => gsap.to(v, { duration: 0.9, delay: 0.25 + k * 0.08, scrambleText: { text: v.textContent, chars: SCR, revealDelay: 0.3, speed: 0.7 } }))
      if (leaderPath) gsap.fromTo(leaderPath, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'cine' })
    }, 0.34)
  }

  let leaveTimer = null
  function hover(i) {
    hovered = i
    clearTimeout(leaveTimer)
    if (focus.v < 1) { focus.v = 1; styleSystems(0.6) }
    select(i, true)
  }
  function unhover(i) {
    if (hovered !== i) return
    hovered = -1
    clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => { if (hovered < 0) { focus.v = 0; styleSystems(1.2) } }, 500)
  }
  cleanups.push(() => clearTimeout(leaveTimer))

  // idle tour: when nobody touches the plate, focus drifts along the constellation
  let lastUser = -1e9
  const TOUR = [2, 3, 4, 2, 1, 0, 5]
  let tourK = 0, tourAt = 0

  // ---- entrance: plot the plate
  layoutCaption(sys[2])
  drawReticle()
  if (enter) {
    // the RA/Dec net draws itself
    gridPaths.forEach((p, k) => enter.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2.6, ease: 'power2.inOut' }, 0.05 + (k % 15) * 0.07))
    // stars ignite in plotting order, edges are traced by a moving head
    const T0 = 0.7, ED = 0.55
    const igniteAt = new Array(6).fill(0)
    igniteAt[EDGES[0][0]] = T0
    EDGES.forEach(([a, b], k) => {
      const start = igniteAt[a] + 0.15
      igniteAt[b] = start + ED
      enter.fromTo(edges[k], { drawSVG: '0%' }, { drawSVG: '100%', duration: ED, ease: 'power1.inOut' }, start)
      enter.fromTo(headT[k], { t: 0 }, { t: 1, duration: ED, ease: 'power1.inOut' }, start)
      enter.fromTo(heads[k], { opacity: 0 }, { opacity: 1, duration: 0.12 }, start)
      enter.to(heads[k], { opacity: 0, duration: 0.35 }, start + ED - 0.05)
    })
    sys.forEach((s) => {
      const t = igniteAt[s.i]
      enter.fromTo(s.star, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out', immediateRender: true }, t)
      enter.fromTo(rings[s.i], { scale: 0.6, opacity: 0.9 }, { scale: 4.2, opacity: 0, duration: 1.4, ease: 'power2.out' }, t)
      s.orbitPaths.forEach((p, k) => enter.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.3 + k * 0.25, ease: 'cine' }, t + 0.1 + k * 0.08))
      enter.fromTo(s.planets.map((p) => p.el), { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.1 }, t + 0.4)
      if (s.cap && s.i !== 2) {
        const [d, n, l] = ['Designation', 'Name', 'Line'].map((nm) => s.cap.querySelector(`[data-name="${nm}"]`))
        const txt = d.textContent
        enter.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.2 }, t + 0.2)
        enter.to(d, { duration: 0.8, scrambleText: { text: txt, chars: SCR, revealDelay: 0.2, speed: 0.7 } }, t + 0.2)
        enter.fromTo([n, l], { opacity: 0, y: 10, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'cine', stagger: 0.08 }, t + 0.3)
      }
    })
    // the plate comes into focus on Cartograph
    const tf = igniteAt[2] + 0.45
    // focus arrives on Cartograph — as standalone tweens, so a hover can take over at any moment
    enter.add(() => { if (!touched) introFocus() }, tf)
    if (u) enter.fromTo(u, { u_stars: 0.35, u_twinkle: 0 }, { u_stars: 0.95, u_twinkle: 0.6, duration: 3, ease: 'power2.out' }, 0)
  }
  styleSystems(0)
  if (enter) {
    // until the plate is plotted nothing is in focus
    gsap.set(sys[2].star, { backgroundColor: '#EEF1F7', boxShadow: '0 0 0px 0px rgba(232,194,122,0)' })
    gsap.set([bigCap, reticle, scale].filter(Boolean), { opacity: 0 })
    if (leaderPath) gsap.set(leaderPath, { drawSVG: '0% 0%' })
  }
  function introFocus() {
    gsap.to(sys[2].star, { backgroundColor: GOLD, boxShadow: '0 0 10px 2px rgba(232,194,122,0.55)', duration: 0.8 })
    if (reticlePath) gsap.fromTo(ret, { h: 40, a: -Math.PI / 2 }, { h: 18, a: 0, duration: 1.2, ease: 'cine', onUpdate: drawReticle })
    if (reticle) gsap.to(reticle, { opacity: 1, duration: 0.6 })
    if (leaderPath) gsap.fromTo(leaderPath, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'cine', delay: 0.3 })
    if (scale) gsap.to(scale, { opacity: 1, duration: 1.2, delay: 0.2 })
    gsap.set(bigCap, { opacity: 1 })
    gsap.fromTo(bc.des, { opacity: 0 }, { opacity: 1, duration: 0.2, delay: 0.5 })
    gsap.to(bc.des, { duration: 0.9, delay: 0.5, scrambleText: { text: bc.des.textContent, chars: SCR, revealDelay: 0.25, speed: 0.7 } })
    gsap.fromTo([bc.name, bc.line], { opacity: 0, y: 14, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, ease: 'cine', stagger: 0.1, delay: 0.6 })
    if (bc.rule) gsap.fromTo(bc.rule, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.2, ease: 'cine', delay: 0.8 })
    gsap.fromTo(bc.rows, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.08, delay: 0.9 })
    bc.vals.forEach((v, k) => gsap.to(v, { duration: 0.9, delay: 0.9 + k * 0.08, scrambleText: { text: v.textContent, chars: SCR, revealDelay: 0.3, speed: 0.7 } }))
    tourAt = state.time + 8
  }

  // ---- per frame: orbits, dome rotation, plotter heads
  const tmp = [0, 0], tmp2 = [0, 0]
  const dome = { m: 0, v: 0 }
  let visible = false
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { rootMargin: '200px' })
  io.observe(el)
  cleanups.push(() => io.disconnect())

  ctx.onFrame = (v, st, dt, rect, p) => {
    dt = Math.min(dt, 0.05)
    // dome: cursor turns the sky a little (spring with inertia), scroll adds sidereal drift
    const target = st.mouse.snx * 1.3 - st.mouse.sny * 0.4
    dome.v += (target - dome.m) * 9 * dt
    dome.v *= Math.pow(0.02, dt)
    dome.m += dome.v * dt * 2.2
    const theta = dome.m + (p - 0.5) * -2.4 + Math.sin(st.time * 0.07) * 0.25
    if (u) { u.u_rot = (theta * Math.PI) / 180 * 0.85; u.u_px = POLE.x / 1440; u.u_py = POLE.y / 1300 }
    const deg = theta.toFixed(4) + 'deg'
    for (const s of rotSvgs) s.style.rotate = deg
    for (const s of sys) s.orbitsSvg.style.rotate = deg

    for (const s of sys) {
      // the system in focus runs faster — it wakes up
      s.rate += ((s.i === sel ? 2.2 : 1) - s.rate) * Math.min(1, dt * 2)
      rot(POLE, theta, s.x, s.y, tmp)
      const dx = tmp[0] - s.x, dy = tmp[1] - s.y
      s.star.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`
      if (s.cap) s.cap.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`
      s.hit.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
      rings[s.i].style.translate = `${tmp[0].toFixed(1)}px ${tmp[1].toFixed(1)}px`
      if (s.i === sel) bigCap.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`
      for (const pl of s.planets) {
        pl.phi += pl.w * s.rate * dt
        ellipsePoint(pl.e, pl.phi, tmp2)
        rot(POLE, theta, tmp2[0], tmp2[1], tmp2)
        // near half of the orbit (lower, tilted toward us) a touch larger
        const near = Math.sin(pl.phi)
        pl.el.style.translate = `${(tmp2[0] - pl.x0).toFixed(2)}px ${(tmp2[1] - pl.y0).toFixed(2)}px`
        pl.el.style.scale = (1 + 0.22 * near).toFixed(3)
      }
    }
    edges.forEach((_, k) => {
      const t = headT[k].t
      if (t <= 0 || t >= 1) return
      const [a, b] = edgePts[k]
      rot(POLE, theta, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, tmp)
      heads[k].style.translate = `${tmp[0].toFixed(1)}px ${tmp[1].toFixed(1)}px`
    })

    // idle tour
    if (tourAt && hovered < 0 && st.time - lastUser > 9 && st.time > tourAt) {
      tourK = (tourK + 1) % TOUR.length
      select(TOUR[tourK], false)
      tourAt = st.time + 6.5
    }
  }

  return () => {
    autoClean?.()
    swap?.kill()
    nameSplit?.revert()
    ctx.onFrame = null
    cleanups.forEach((f) => f())
  }
}
