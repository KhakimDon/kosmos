// S10 — The Future. A ringed giant rises over an alien dusk; ridges parallax in depth.
import { autoChoreo, gsap, ScrollTrigger, SplitText } from '../auto.js'
import { makeShader } from '../../engine/shader.js'

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x) }

export default function s10(ctx) {
  const { el, view } = ctx
  const head = ctx.q('Headline')
  const cleanups = []

  // --- swap in the live shader (same uniforms + parallax/rise controls)
  let shader = null
  if (view) {
    const old = view.shader
    const fill = ctx.frame.fill && (Array.isArray(ctx.frame.fill) ? ctx.frame.fill.find((f) => f.type === 'shader') : ctx.frame.fill)
    shader = makeShader('future-live', { ...(fill?.uniforms || {}) })
    view.shader = shader
    old.material.dispose()
  }
  const u = shader?.u

  // --- calm, emotional headline: words surface out of the dusk, one breath each
  let split = null
  const enter = gsap.timeline({ paused: true })
  if (head) {
    head.setAttribute('data-noauto', '')
    split = SplitText.create(head, { type: 'words', wordsClass: 'w10' })
    gsap.set(split.words, { opacity: 0, yPercent: 38, filter: 'blur(14px)' })
    enter.to(split.words, {
      opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 2.8, ease: 'cine',
      stagger: { each: 0.22, from: 'start' },
    }, 0.2)
    // the italic "wait" lingers a beat, then settles a touch warmer
    const wait = [...head.querySelectorAll('[data-span]')].find((s) => /wait/.test(s.textContent))
    if (wait) enter.fromTo(wait, { color: '#EEF1F7' }, { color: '#F3E3C0', duration: 2.4, ease: 'sine.inOut' }, 2.4)
  }

  const off = autoChoreo(ctx, { skip: ['Headline'], noCamera: true })
  cleanups.push(off)
  const t1 = ScrollTrigger.create({ trigger: el, start: 'top 55%', onEnter: () => enter.play(), onLeaveBack: () => enter.reverse() })

  // --- scroll: the planet rises; ridges separate in depth
  const sc = { rise: 0, p: 0 }
  const t2 = ScrollTrigger.create({ trigger: el, start: 'top 80%', end: 'top -45%', onUpdate: (s) => { sc.rise = s.progress } })
  const t3 = ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { sc.p = s.progress } })

  let rise = 0
  let par = 0
  if (view) {
    view.onFrame = (v, st, dt, rect) => {
      const k = 1 - Math.exp(-dt * 2.2)
      rise += (sc.rise - rise) * k
      par += ((sc.p - 0.5) - par) * (1 - Math.exp(-dt * 5))
      const r = smooth(rise)
      // camera: very gentle drift, the depth lives in the ridge layers
      v.zoom = 1.03 + 0.03 * sc.p
      v.shiftX = -st.mouse.snx * 6
      v.shiftY = -st.mouse.sny * 5
      if (!u) return
      // planet: from barely cresting (sink .82) to majestic (-.26), slight slide right->left
      u.u_sink = lerp(0.84, -0.26, r)
      u.u_px = lerp(0.635, 0.60, r)
      u.u_roll = lerp(-0.085, -0.05, r) + st.mouse.snx * 0.006
      u.u_glow = lerp(0.25, 1.15, r)
      u.u_par = par * 1.6
      u.u_mx = st.mouse.snx
      u.u_fog = 0.85 + 0.25 * Math.sin(st.time * 0.07)
      // gold beacon: a slow lighthouse breath (~5 s), short bright peak
      const ph = (st.time % 5.2) / 5.2
      u.u_blink = 0.18 + 0.82 * Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 6)
    }
  }

  return () => {
    cleanups.forEach((c) => c())
    t1.kill(); t2.kill(); t3.kill()
    enter.kill()
    split?.revert()
    if (view) view.onFrame = null
  }
}
