// S02 — Enter the Unknown.
// Depth stack: nebula gas (slow, scroll-scrubbed zoom-out 1.6 → 1.06 to sell the scale)
//   → headline (mid, letters condense out of the dust)
//   → dust lane (fast; the same lane is drawn in the nebula behind and in the front veil
//     over the type, both driven by one offset so it reads as one body of dust passing in front).
// Cursor parts the dust. The "YOU ARE HERE" marker counts its scale 10⁰ → 10²⁶ with the zoom.
import { autoChoreo, gsap, ScrollTrigger, SplitText } from '../auto.js'
import { makeShader } from '../../engine/shader.js'

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('')
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x) }

// Rebuild a view's shader from a "live" copy, carrying over every current uniform value.
function swapShader(view, name, extra = {}) {
  const old = view.shader
  const ov = { ...old.u }
  for (const [k, uu] of Object.entries(old.material.uniforms)) {
    if (uu.value && uu.value.isVector3) ov[k] = [uu.value.x, uu.value.y, uu.value.z]
  }
  Object.assign(ov, extra)
  const sh = makeShader(name, ov, { transparent: !!old.material.transparent })
  view.shader = sh
  old.material.dispose()
  return sh
}

export default function s02(ctx) {
  const { el, view } = ctx
  const kills = []
  const veilView = ctx.views.find((v) => v.layer === 'front')
  const U = swapShader(view, 'unknown-nebula-live', { u_zoom: 1.6 }).u
  const V = veilView ? swapShader(veilView, 'unknown-dustveil-live').u : {}

  const headFrame = ctx.q('Headline')
  const h1 = ctx.q('Headline 1')
  const h2 = ctx.q('Headline 2')
  const marker = ctx.q('You are here')
  const label = ctx.q('Marker label')
  const point = ctx.q('Point')
  const ring = ctx.q('Point ring')
  const leader = ctx.q('Leader')
  headFrame?.setAttribute('data-noauto', '')
  marker?.setAttribute('data-noauto', '')

  const auto = autoChoreo(ctx, { noCamera: true })
  if (leader) gsap.killTweensOf(leader)

  // ---------- scroll progress (0 = top enters at bottom, 1 = bottom leaves at top) ----------
  let p = 0
  let ps = 0
  kills.push(ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { p = s.progress } }))

  // ---------- headline: letters condense out of the dust ----------
  const splits = []
  const heads = [h1, h2].filter(Boolean)
  const chars = []
  heads.forEach((h) => {
    const sp = SplitText.create(h, { type: 'words,chars', charsClass: 'u-ch' })
    splits.push(sp)
    chars.push(...sp.chars)
  })
  const darkChars = h2 ? chars.filter((c) => h2.contains(c) && getComputedStyle(c).fontStyle === 'italic') : []
  const lightChars = chars.filter((c) => !darkChars.includes(c))
  gsap.set(chars, { opacity: 0, filter: 'blur(18px)', scale: 1.18, color: '#5d6a9c', willChange: 'transform, filter, opacity' })
  const headTl = gsap.timeline({ paused: true })
  headTl.to(lightChars, {
    keyframes: [
      { opacity: 0.35, filter: 'blur(10px)', scale: 1.1, duration: 0.9, ease: 'sine.out' },
      { opacity: 1, filter: 'blur(0px)', scale: 1, color: '#eef1f7', duration: 1.9, ease: 'cine' },
    ],
    stagger: { each: 0.07, from: 'random' },
  }, 0)
  // "dark" arrives last and stays a shade cooler — it is the dust, not the light
  headTl.to(darkChars, {
    keyframes: [
      { opacity: 0.25, filter: 'blur(12px)', duration: 1.0, ease: 'sine.out' },
      { opacity: 1, filter: 'blur(0px)', scale: 1, color: '#c9cfe6', duration: 2.4, ease: 'cine' },
    ],
    stagger: 0.12,
  }, 1.1)
  headTl.set(chars, { willChange: 'auto', filter: 'none' })
  kills.push(ScrollTrigger.create({ trigger: el, start: 'top 62%', onEnter: () => headTl.play() }))

  // ---------- marker: pulse + scale counter ----------
  let baseSpan, expSpan
  if (label) {
    label.textContent = ''
    baseSpan = document.createElement('span')
    baseSpan.textContent = 'YOU ARE HERE — 1 : 10'
    expSpan = document.createElement('span')
    expSpan.textContent = sup(0)
    expSpan.style.cssText = 'display:inline-block;min-width:2ch;font-variant-numeric:tabular-nums;color:#eef1f7'
    label.append(baseSpan, expSpan)
    label.style.fontVariantNumeric = 'tabular-nums'
  }
  const ripples = []
  if (ring) {
    for (let i = 0; i < 2; i++) {
      const r = ring.cloneNode()
      r.removeAttribute('data-id')
      r.removeAttribute('data-name')
      r.style.borderColor = 'rgba(127,216,255,0.55)'
      r.style.opacity = '0'
      ring.parentNode.insertBefore(r, ring)
      ripples.push(r)
    }
  }
  gsap.set([point, ring].filter(Boolean), { scale: 0, opacity: 0 })
  if (leader) gsap.set(leader, { scaleX: 0, transformOrigin: '100% 50%' })
  if (label) gsap.set(label, { opacity: 0 })
  const markTl = gsap.timeline({ paused: true })
  if (point) markTl.to(point, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }, 0)
  if (ring) markTl.to(ring, { scale: 1, opacity: 1, duration: 1.2, ease: 'cine' }, 0.1)
  if (leader) markTl.to(leader, { scaleX: 1, duration: 1.4, ease: 'cine' }, 0.2)
  if (label) {
    markTl.to(label, { opacity: 1, duration: 0.3 }, 0.35)
    markTl.fromTo(baseSpan, { textContent: '' }, { duration: 1.1, scrambleText: { text: 'YOU ARE HERE — 1 : 10', chars: '01<>/—·×', speed: 0.6, revealDelay: 0.2 }, ease: 'none' }, 0.35)
  }
  const rippleTl = gsap.timeline({ repeat: -1, paused: true })
  ripples.forEach((r, i) => {
    rippleTl.fromTo(r, { scale: 1, opacity: 0.7 }, { scale: 4.2, opacity: 0, duration: 2.4, ease: 'expo.out' }, i * 1.2)
  })
  kills.push(ScrollTrigger.create({
    trigger: marker || el, start: 'top 92%',
    onEnter: () => { markTl.play(); rippleTl.play() },
  }))
  // live point breathing
  const breathe = point && gsap.to(point, { boxShadow: '0 0 10px 2px rgba(127,216,255,0.75)', duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' })

  let expShown = -1
  let expTarget = 0
  let scrT = 0
  const bump = () => {
    if (ring) gsap.fromTo(ring, { scale: 1.35, borderColor: 'rgba(127,216,255,0.7)' }, { scale: 1, borderColor: 'rgba(238,241,247,0.15)', duration: 0.5, ease: 'expo.out', overwrite: 'auto' })
  }

  // ---------- pointer: parts the dust ----------
  let pointerSeen = false
  let clr = 0
  let lastMX = 0, lastMY = 0, speed = 0
  const onMove = () => { pointerSeen = true }
  window.addEventListener('pointermove', onMove, { passive: true })

  // ---------- per-frame ----------
  let t = 0
  view.onFrame = (v, st, dt, rect) => {
    t += dt
    ps += (p - ps) * Math.min(1, dt * 5)
    const s = rect.width / 1440 // css px per design px

    // camera: the pull-back. zoomed into the gas when the section arrives, out to the full field
    const ez = smooth((ps - 0.2) / 0.6)
    v.zoom = 1.6 - 0.54 * ez
    v.shiftX = -st.mouse.snx * 14
    v.shiftY = -st.mouse.sny * 10 - (ps - 0.5) * rect.height * 0.03
    U.u_zoom = v.zoom
    U.u_shx = v.shiftX / s
    U.u_shy = v.shiftY / s
    U.u_flow += dt * (0.045 + Math.min(Math.abs(st.svel), 40) * 0.004)
    U.u_breathe = 1 + 0.08 * Math.sin(t * 0.55) + 0.04 * Math.sin(t * 1.31 + 1.7)

    // dust lane: fastest layer. rises through the letters as you scroll, slides sideways, drifts in time
    const lx = (ps - 0.43) * -900 + t * 7
    const ly = (ps - 0.43) * 760
    U.u_lx = V.u_ox = lx
    U.u_ly = V.u_oy = ly
    V.u_flow = U.u_flow

    // pointer clearing (element-space design px). radius swells with pointer speed
    const mx = (st.mouse.sx - rect.left) / s
    const my = (st.mouse.sy - rect.top) / s
    const mv = Math.hypot(st.mouse.sx - lastMX, st.mouse.sy - lastMY) / Math.max(dt, 1e-3)
    lastMX = st.mouse.sx; lastMY = st.mouse.sy
    speed += (Math.min(mv, 2500) - speed) * Math.min(1, dt * 4)
    const inside = pointerSeen && my > -100 && my < 1300
    clr += ((inside ? 1 : 0) - clr) * Math.min(1, dt * 2.5)
    const crad = 230 + Math.min(speed * 0.08, 140)
    U.u_mx = V.u_mx = mx
    U.u_my = V.u_my = my
    U.u_clr = V.u_clr = clr
    U.u_crad = V.u_crad = crad

    // headline: mid layer
    if (headFrame) headFrame.style.transform = `translate3d(${-st.mouse.snx * 6}px, ${(ps - 0.43) * -110}px, 0)`

    // scale counter, scrubbed with the zoom-out
    if (expSpan) {
      expTarget = Math.round(26 * smooth((ps - 0.46) / 0.32))
      if (expTarget !== expShown) {
        if (expShown >= 0) { scrT = 0.22; bump() }
        expShown = expTarget
      }
      if (scrT > 0) {
        scrT -= dt
        const n = String(expShown).length
        let r = ''
        for (let i = 0; i < n; i++) r += SUP[(Math.random() * 10) | 0]
        expSpan.textContent = scrT > 0 ? r : sup(expShown)
      } else if (expSpan.textContent !== sup(expShown)) {
        expSpan.textContent = sup(expShown)
      }
    }
  }

  return () => {
    view.onFrame = null
    window.removeEventListener('pointermove', onMove)
    kills.forEach((k) => k.kill())
    headTl.kill(); markTl.kill(); rippleTl.kill(); breathe?.kill()
    splits.forEach((sp) => sp.revert())
    ripples.forEach((r) => r.remove())
    auto?.()
  }
}
