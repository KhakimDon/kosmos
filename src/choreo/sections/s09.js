// S09 — The Expansion. Scroll scrubs deep time (log years): the civilization front
// expands from the origin world across a slowly spinning galaxy. Markers ignite when the
// timeline passes their arrival time, reach arcs draw toward them, the gold leading edge
// travels outward. The DOM overlay is mapped through the same plane transform the shader
// uses (rotation, tilt, spin, camera zoom/shift), so it stays glued to the disk.
import { autoChoreo, gsap, ScrollTrigger, scrambleIn } from '../auto.js'
import { makeShader } from '../../engine/shader.js'
import { buildArcs } from './s09-arcs.js'

const T_NOW = Math.log10(2.5e6)          // 6.398
const R_NOW = 514.5                      // plane px radius of the "now" front (design)
const R_10K = 257.5                      // plane px radius of the 10^4 front
const POW = Math.log(4 / T_NOW) / Math.log(R_10K / R_NOW)   // logT = T_NOW * (d/R_NOW)^POW
const X0 = 96, DEC = 156                 // timeline: x = 96 + log10(yr) * 156

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const tOfD = (d) => T_NOW * Math.pow(Math.max(d, 0) / R_NOW, POW)
const dOfT = (t) => R_NOW * Math.pow(Math.max(t, 0) / T_NOW, 1 / POW)

// 2x2 helpers: [a, b, c, d] = [[a, b], [c, d]]
const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]]
const app = (A, x, y) => [A[0] * x + A[1] * y, A[2] * x + A[3] * y]
const rotS = (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)]       // shader u = Rs * d
const rotST = (a) => [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)]
const rotP = (a) => [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)]       // plane spin

function fmtYears(t) {
  const y = Math.pow(10, t) - 1
  if (t >= T_NOW - 0.004) return 'NOW · 2.5 × 10⁶ YR'
  if (y < 10000) return `YEAR ${Math.round(y).toLocaleString('en-US')}`
  const e = Math.floor(Math.log10(y))
  const m = y / Math.pow(10, e)
  const sup = String(e).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('')
  return `YEAR ${m.toFixed(1)} × 10${sup}`
}

export default function s09(ctx) {
  const { el, view } = ctx
  const kill = []

  // ---------------------------------------------------------------- shader swap
  const fill = Array.isArray(ctx.frame.fill) ? ctx.frame.fill.find((f) => f.type === 'shader') : ctx.frame.fill
  let u = ctx.u
  if (view) {
    const old = view.shader
    view.shader = makeShader('exp-galaxy-live', { ...(fill?.uniforms || {}) })
    old.material.dispose()
    u = view.shader.u
  }
  const G = { cx: u.u_cx, cy: u.u_cy, R: u.u_R, rot0: u.u_rot, tilt0: u.u_tilt }
  // reference: design screen -> co-rotating plane (spin 0)
  const toPlane = (x, y) => {
    const [ux, uy] = app(rotS(G.rot0), x - G.cx, y - G.cy)
    return [ux, uy / G.tilt0]
  }

  // ---------------------------------------------------------------- overlay nodes
  const reach = ctx.q('Reach')
  const tl = ctx.q('Timeline')
  reach?.setAttribute('data-noauto', '')
  tl?.setAttribute('data-noauto', '')

  const origin = { x: 787.0, y: 494.1 }
  {
    const ow = ctx.q('Origin world')
    if (ow) { origin.x = parseFloat(ow.style.left) + 3; origin.y = parseFloat(ow.style.top) + 3 }
  }
  const oP = toPlane(origin.x, origin.y)
  u.u_ox = oP[0] / G.R
  u.u_oy = oP[1] / G.R
  const distO = (x, y) => { const p = toPlane(x, y); return Math.hypot(p[0] - oP[0], p[1] - oP[1]) }

  const center = (n) => [parseFloat(n.style.left) + parseFloat(n.style.width) / 2, parseFloat(n.style.top) + parseFloat(n.style.height) / 2]

  // systems (markers) ignite at their arrival time
  const sys = ctx.qa('Reach').length ? [...reach.querySelectorAll('.ds-ellipse')].filter((n) => /^System/.test(n.dataset.name)) : []
  const markers = sys.map((n) => {
    const [x, y] = center(n)
    const op = n.style.opacity === '' ? 1 : parseFloat(n.style.opacity)
    const ring = document.createElement('div')
    ring.style.cssText = 'position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:0.75px solid rgba(238,241,247,.85);opacity:0;pointer-events:none'
    n.appendChild(ring)
    gsap.set(n, { scale: 0, opacity: 0, transformOrigin: '50% 50%' })
    return { n, x, y, t: tOfD(distO(x, y)), op, ring, on: false, sx: gsap.quickSetter(n, 'x', 'px'), sy: gsap.quickSetter(n, 'y', 'px') }
  })

  const fixed = ['Origin ring', 'Origin world', 'Origin label'].map((nm) => ctx.q(nm)).filter(Boolean).map((n) => {
    const [x, y] = n.classList.contains('ds-text') ? [origin.x, origin.y] : center(n)
    return { n, x, y, sx: gsap.quickSetter(n, 'x', 'px'), sy: gsap.quickSetter(n, 'y', 'px') }
  })

  // gold leading edge travels the arm-chain outward
  const leadNodes = ['Leading edge ring', 'Leading edge', 'Lead label'].map((nm) => ctx.q(nm)).filter(Boolean)
  const leadEl = ctx.q('Leading edge')
  const leadHome = leadEl ? center(leadEl) : [1264.2, 306.6]
  const chainPts = [[origin.x, origin.y], [821.0, 456.3], [919.0, 401.6], [960.4, 380.4], [1011.0, 363.9], [1070.5, 334.2], [1152.5, 318.4], [1193.4, 310.2], [1226.4, 300.3], leadHome]
  const chain = chainPts.map(([x, y]) => ({ x, y, t: tOfD(distO(x, y)) }))
  const leadSet = leadNodes.map((n) => ({ n, sx: gsap.quickSetter(n, 'x', 'px'), sy: gsap.quickSetter(n, 'y', 'px') }))
  const leadAt = (T) => {
    if (T <= chain[0].t) return [chain[0].x, chain[0].y]
    for (let i = 1; i < chain.length; i++) {
      if (T <= chain[i].t) {
        const a = chain[i - 1], b = chain[i]
        const k = clamp01((T - a.t) / Math.max(b.t - a.t, 1e-4))
        return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k]
      }
    }
    return leadHome
  }
  if (leadEl) leadEl.style.boxShadow = '0 0 8px 2px rgba(232,194,122,.55), 0 0 22px 6px rgba(232,194,122,.18)'

  // arcs: every sub-path becomes its own path, drawn from the origin side outward
  const arcSvgs = ['Reach arcs — settled', 'Reach arcs — frontier', 'Reach arc — leading'].map((nm) => ctx.q(nm)).filter(Boolean)
  const arcs = buildArcs(arcSvgs, (x, y) => tOfD(distO(x, y)))
  kill.push(arcs.restore)

  const front10 = ctx.q('Front — 10⁴ yr')
  const frontNow = ctx.q('Front — now')
  const front10Op = front10 ? parseFloat(front10.style.opacity || 1) : 1
  const frontNowOp = frontNow ? parseFloat(frontNow.style.opacity || 1) : 1
  if (front10) front10.style.opacity = 0
  for (const f of [front10, frontNow]) if (f) f.style.transformOrigin = '0 0'
  for (const s of arcSvgs) s.style.transformOrigin = '0 0'

  // timeline
  const elapsed = ctx.q('Elapsed')
  const nowMark = ctx.q('Now marker')
  const nowLabel = ctx.q('Now label')
  const ticks = ['Tick YEAR 0', 'Tick 10²', 'Tick 10⁴', 'Tick 10⁶', 'Tick 10⁸'].map((nm, i) => ({ n: ctx.q(nm), t: i * 2 })).filter((k) => k.n).map((k) => ({ ...k, c: k.n.style.color }))
  const NOW_X = X0 + T_NOW * DEC
  if (elapsed) { elapsed.style.transformOrigin = `${X0}px 1080px` }
  if (nowLabel) { nowLabel.style.fontVariantNumeric = 'tabular-nums' }

  // ---------------------------------------------------------------- standard choreo
  const offAuto = autoChoreo(ctx, { zoomFrom: 1.04, zoomTo: 1.12, mouse: 0.6 })
  kill.push(offAuto)

  // overlay intro: origin first, then the HUD
  const intro = gsap.timeline({ paused: true })
  const oRing = ctx.q('Origin ring'), oWorld = ctx.q('Origin world'), oLabel = ctx.q('Origin label'), lLabel = ctx.q('Lead label')
  if (oWorld) intro.fromTo(oWorld, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: 'expo.out' }, 0.3)
  if (oRing) intro.fromTo(oRing, { scale: 3, opacity: 0 }, { scale: 1, opacity: 0.9, duration: 1.8, ease: 'cine' }, 0.35)
  if (oLabel) { const s = scrambleIn(oLabel, { duration: 1.0 }); if (s) intro.add(s.play(), 0.8) }
  if (lLabel) gsap.set(lLabel, { opacity: 0 })
  const tlTexts = tl ? [...tl.querySelectorAll('.ds-text')] : []
  tlTexts.forEach((t, i) => { if (t !== nowLabel) { const s = scrambleIn(t, { duration: 0.9 }); if (s) intro.add(s.play(), 0.6 + i * 0.06) } })
  const axisPaths = tl ? ['Axis', 'Minor ticks', 'Major ticks'].map((nm) => tl.querySelector(`[data-name="${nm}"] path`)).filter(Boolean) : []
  axisPaths.forEach((p, i) => intro.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2.0, ease: 'power2.inOut' }, 0.4 + i * 0.15))
  intro.progress(0.0001).pause()
  const trIntro = ScrollTrigger.create({ trigger: el, start: 'top 70%', onEnter: () => intro.play() })

  // ---------------------------------------------------------------- deep time scrub
  const sc = { target: 0 }
  const trTime = ScrollTrigger.create({ trigger: el, start: 'top 30%', end: 'bottom 85%', onUpdate: (s) => { sc.target = s.progress } })
  let T = 0
  let lastLabel = ''
  let leadShown = false
  let labelShown = false
  let f10Shown = false

  ctx.onFrame = (v, st, dt, rect) => {
    // smoothed deep time
    const tgt = sc.target * T_NOW
    T += (tgt - T) * (1 - Math.exp(-dt * 3.2))
    if (Math.abs(tgt - T) < 1e-4) T = tgt

    // galaxy: slow trailing spin (idle + a little from deep time), cursor tilts the plane
    const spin = -(st.time * 0.0035 + T * 0.035)
    const rot = G.rot0 + st.mouse.snx * 0.03
    const tilt = G.tilt0 + st.mouse.sny * 0.03
    u.u_phase = spin
    u.u_rot = rot
    u.u_tilt = tilt
    u.u_front = dOfT(T) / G.R * (T > 0.02 ? 1 : 0)

    // overlay transform: reference design px -> current design px (stage space)
    const s = rect.width / 1440
    const z = v.zoom
    const A = mul(rotST(rot), mul([1, 0, 0, tilt], mul(rotP(spin), mul([1, 0, 0, 1 / G.tilt0], rotS(G.rot0)))))
    const L = [A[0] * z, A[1] * z, A[2] * z, A[3] * z]
    const cxs = 720, cys = rect.height / s / 2
    const F = (x, y) => {
      const [ax, ay] = app(A, x - G.cx, y - G.cy)
      return [cxs + (G.cx + ax - cxs) * z + v.shiftX / s, cys + (G.cy + ay - cys) * z + v.shiftY / s]
    }
    const [ex, ey] = F(0, 0)
    const mat = `matrix(${L[0]},${L[2]},${L[1]},${L[3]},${ex},${ey})`
    for (const sv of arcSvgs) sv.style.transform = mat

    for (const f of fixed) { const [x, y] = F(f.x, f.y); f.sx(x - f.x); f.sy(y - f.y) }

    // fronts: the "now" front IS the live wavefront (scaled about the origin in the plane)
    const [ox, oy] = F(origin.x, origin.y)
    if (frontNow) {
      const k = Math.max(dOfT(T) / R_NOW, 0.0001)
      frontNow.style.transform = `matrix(${L[0] * k},${L[2] * k},${L[1] * k},${L[3] * k},${ox - (L[0] * origin.x + L[1] * origin.y) * k},${oy - (L[2] * origin.x + L[3] * origin.y) * k})`
      frontNow.style.opacity = frontNowOp * clamp01(T / 0.6)
    }
    if (front10) {
      front10.style.transform = mat
      if (!f10Shown && T >= 4) { f10Shown = true; gsap.to(front10, { opacity: front10Op, duration: 1.4, ease: 'sine.out' }) }
      else if (f10Shown && T < 3.97) { f10Shown = false; gsap.to(front10, { opacity: 0, duration: 0.5 }) }
    }

    // markers
    for (const m of markers) {
      const [x, y] = F(m.x, m.y)
      m.sx(x - m.x); m.sy(y - m.y)
      if (!m.on && T >= m.t) {
        m.on = true
        gsap.killTweensOf([m.n, m.ring])
        gsap.fromTo(m.n, { scale: 0, opacity: 0 }, { scale: 1, opacity: m.op, duration: 1.1, ease: 'expo.out' })
        gsap.fromTo(m.ring, { scale: 0.2, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1.6, ease: 'power2.out' })
      } else if (m.on && T < m.t - 0.01) {
        m.on = false
        gsap.killTweensOf([m.n, m.ring])
        gsap.to(m.n, { scale: 0, opacity: 0, duration: 0.45, ease: 'power2.in' })
        gsap.set(m.ring, { opacity: 0 })
      }
    }

    // arcs draw as the message travels
    arcs.update(T)

    // leading edge
    const [lx, ly] = leadAt(T)
    const [Lx, Ly] = F(lx, ly)
    for (const ls of leadSet) { ls.sx(Lx - leadHome[0]); ls.sy(Ly - leadHome[1]) }
    const showLead = T > 0.35
    if (showLead !== leadShown) {
      leadShown = showLead
      const nodes = leadNodes.filter((n) => n !== lLabel)
      gsap.to(nodes, { opacity: showLead ? (i) => (nodes[i].dataset.name === 'Leading edge ring' ? 0.7 : 1) : 0, scale: showLead ? 1 : 0.2, duration: showLead ? 1.0 : 0.4, ease: showLead ? 'expo.out' : 'power2.in' })
    }
    // the label joins once the edge has cleared the origin
    const showLabel = T > 2.6
    if (lLabel && showLabel !== labelShown) {
      labelShown = showLabel
      if (showLabel) { gsap.set(lLabel, { opacity: 1 }); scrambleIn(lLabel, { duration: 0.9 })?.play() }
      else gsap.to(lLabel, { opacity: 0, duration: 0.3 })
    }

    // timeline: fill, now marker, live counter, ticks brighten as passed
    const xT = X0 + T * DEC
    if (elapsed) elapsed.style.transform = `scaleX(${Math.max((xT - X0) / (NOW_X - X0), 0.0001)})`
    if (nowMark) nowMark.style.transform = `translateX(${xT - NOW_X}px)`
    if (nowLabel) {
      // ride above the axis caption while passing over it, settle onto the caption line after
      const lift = -22 * (1 - Math.max(0, Math.min(1, (xT - 400) / 80)))
      nowLabel.style.transform = `translate(${xT - NOW_X}px, ${lift}px)`
      const txt = fmtYears(T)
      if (txt !== lastLabel) { nowLabel.textContent = txt; lastLabel = txt }
    }
    for (const k of ticks) k.n.style.color = T >= k.t - 0.01 ? 'rgba(238,241,247,.92)' : k.c
    // dock the timeline to the viewport bottom while the section crosses the screen
    if (tl) {
      const yScreen = rect.top + 1080 * s
      const dockY = Math.max(st.h - 96 * s, rect.top + 660 * s)
      const dy = Math.min(0, dockY - yScreen) / s
      tl.style.transform = `translateY(${dy}px)`
    }
  }

  return () => {
    kill.forEach((k) => k())
    trIntro.kill(); trTime.kill(); intro.kill()
    markers.forEach((m) => { m.ring.remove(); gsap.killTweensOf(m.n) })
    ctx.onFrame = null
  }
}
