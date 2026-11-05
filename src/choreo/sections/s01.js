// S01 — The Origin. A living Schwarzschild hole: the disk shears in Keplerian flow
// (inner orbits overtake outer ones), opens from edge-on as we arrive, lensing deepens,
// exposure blooms. The cursor drags a faint lens through the star field and feeds the
// hole when it comes near. The annotation is pinned to the real photon ring.
import { autoChoreo, gsap, ScrollTrigger, revealHeadline, scrambleIn } from '../auto.js'
import { makeShader } from '../../engine/shader.js'

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mix = (a, b, t) => a + (b - a) * t

// design-space geometry (frame "S01 — The Origin", 1440 × 1200)
const TICK = { x: 800.372 + 2, y: 449.284 + 2 }

export default function s01(ctx) {
  const { el, view } = ctx
  const fill = ctx.frame.fill?.uniforms || {}
  const old = view.shader
  view.shader = makeShader('origin-blackhole-live', fill)
  old.material.dispose()
  const u = (ctx.u = view.shader.u)
  const D = { cx: u.u_cx, cy: u.u_cy, tilt: u.u_tilt, einst: u.u_einst, exp: u.u_exp, R: u.u_R, H: u.u_H, stars: u.u_stars }

  const hl = ctx.q('Headline')
  const lead = ctx.q('Lead')
  const leader = ctx.q('Leader')
  const leaderPath = leader?.querySelector('path')
  const tick = ctx.q('Leader tick')
  const label = ctx.q('Annotation')
  const caption = ctx.q('Plate caption')
  const coord = ctx.q('Plate coord')
  const serif = hl?.querySelector('[data-span="1"]')
  for (const n of [hl, lead, leader, tick, label, caption, coord]) n?.setAttribute('data-noauto', '')

  // a hairline ring that pulses out of the tick when the leader lands on the photon ring
  const ring = document.createElement('div')
  Object.assign(ring.style, {
    position: 'absolute', left: `${TICK.x - 14}px`, top: `${TICK.y - 14}px`, width: '28px', height: '28px',
    borderRadius: '50%', border: '0.75px solid rgba(238,241,247,0.7)', opacity: '0', pointerEvents: 'none',
  })
  tick?.parentNode?.appendChild(ring)

  const stopAuto = autoChoreo(ctx, { zoomFrom: 1.0, zoomTo: 1.24, shift: 0.03, mouse: 0.7 })

  // ---- annotation: label decodes → leader reaches the photon ring → tick ignites
  const ann = gsap.timeline({ paused: true })
  const ls = label && scrambleIn(label, { duration: 1.3 })
  if (ls) ann.add(ls.play(), 0)
  if (leaderPath) ann.fromTo(leaderPath, { drawSVG: '100% 100%' }, { drawSVG: '0% 100%', duration: 1.5, ease: 'power3.inOut' }, 0.35)
  if (tick) ann.fromTo(tick, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }, 1.75)
  ann.fromTo(ring, { scale: 0.15, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1.6, ease: 'expo.out' }, 1.75)
  ann.progress(0.0001).pause()

  // ---- copy: headline rises, lead and plate follow
  const head = hl ? revealHeadline(hl, { stagger: 0.022, duration: 1.7 }) : null
  const copy = gsap.timeline({ paused: true })
  if (head) copy.add(head.tl.play(), 0)
  if (lead) copy.fromTo(lead, { opacity: 0, y: 24, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.5, ease: 'cine' }, 0.55)
  for (const [n, at] of [[caption, 0.9], [coord, 1.1]]) {
    const s = n && scrambleIn(n, { duration: 1.2 })
    if (s) copy.add(s.play(), at)
  }
  copy.progress(0.0001).pause()

  const triggers = [
    ScrollTrigger.create({ trigger: leader || el, start: 'top 78%', onEnter: () => ann.play() }),
    ScrollTrigger.create({ trigger: hl || el, start: 'top 88%', onEnter: () => copy.play() }),
  ]

  // ---- per frame
  let flow = 0
  let near = 0
  let lastLs = ''
  let lastTx = 1e9, lastTy = 1e9
  const moving = [leader, tick, label, ring].filter(Boolean)
  ctx.onFrame = (v, st, dt, rect, p) => {
    const a = ss(0.04, 0.46, p)                // arrival: edge-on → designed inclination
    const bell = Math.exp(-Math.pow((p - 0.47) / 0.12, 2))

    // the disk turns; scroll speed briefly spins it up
    flow += dt * (0.42 + Math.min(Math.abs(st.svel) * 0.035, 1.6))
    u.u_flow = flow

    // shader viewport (css px) — same math as engine._bind
    const vw = rect.width * v.zoom, vh = rect.height * v.zoom
    const vl = rect.left - (vw - rect.width) / 2 + v.shiftX
    const vt = rect.top - (vh - rect.height) / 2 + v.shiftY

    // cursor: the hole leans a hair toward it, a faint lens rides it, proximity deepens the well
    u.u_cx = D.cx + st.mouse.snx * 0.006
    u.u_cy = D.cy + st.mouse.sny * 0.005
    const pxPerD = vh / D.H
    const hx = vl + u.u_cx * vw, hy = vt + u.u_cy * vh
    const dM = Math.hypot(st.mouse.sx - hx, st.mouse.sy - hy) / (pxPerD * D.R)   // in shadow radii
    const nearT = Math.exp(-Math.max(0, dM - 1.2) / 1.6)
    near += (nearT - near) * Math.min(1, dt * 2.5)
    u.u_mx = (st.mouse.sx - vl) / vw
    u.u_my = (st.mouse.sy - vt) / vh
    u.u_mlens = (14 + 10 * near) * a

    u.u_tilt = mix(0.012, D.tilt, a) + Math.sin(st.time * 0.21) * 0.004
    u.u_einst = mix(0.95, D.einst, a) + near * 0.45
    u.u_exp = mix(0.22, D.exp, a) * (1 + 0.14 * bell + near * 0.12)
    u.u_glow = 0.3 * bell + near * 0.22
    u.u_stars = mix(0.35, D.stars, a)
    u.u_top = 320

    // pin the annotation to the photon ring wherever the camera has moved the hole
    const S = rect.width / 1440
    const c0x = D.cx * 1440, c0y = D.cy * D.H
    const dx0 = TICK.x - c0x, dy0 = TICK.y - c0y
    const k = (1.03 * D.R * pxPerD) / Math.hypot(dx0, dy0)
    const tx = (hx + dx0 * k - (rect.left + TICK.x * S)) / S
    const ty = (hy + dy0 * k - (rect.top + TICK.y * S)) / S
    if (Math.abs(tx - lastTx) > 0.05 || Math.abs(ty - lastTy) > 0.05) {
      lastTx = tx; lastTy = ty
      const t = `${tx.toFixed(2)}px ${ty.toFixed(2)}px`
      for (const n of moving) n.style.translate = t
    }

    // "cannot": its letters are pulled together as the hole takes us
    if (serif) {
      const pull = ss(0.25, 0.8, p)
      const lsv = `${mix(5, -1.2, pull).toFixed(2)}px`
      if (lsv !== lastLs) { lastLs = lsv; serif.style.letterSpacing = lsv }
    }
  }

  ;(window.__choreo ||= {}).s01 = { tl: ann, copy }

  return () => {
    triggers.forEach((t) => t.kill())
    ann.kill(); copy.kill()
    head?.split.revert()
    ring.remove()
    moving.forEach((n) => { n.style.translate = '' })
    if (serif) serif.style.letterSpacing = ''
    ctx.onFrame = null
    stopAuto()
  }
}
