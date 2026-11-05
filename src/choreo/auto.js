// Shared cinematic choreography applied to every section, then refined per section.
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { state } from '../engine/engine.js'

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, DrawSVGPlugin, CustomEase)
CustomEase.create('cine', 'M0,0 C0.16,0.9 0.12,1 1,1')
CustomEase.create('cineIn', 'M0,0 C0.6,0 0.84,0.4 1,1')

const SCRAMBLE = '01░▒<>/\\—·×ΛΣΩ∆'

export function fontSizeOf(el) {
  return parseFloat(el.style.fontSize) || 14
}
export function isMono(el) {
  return /Mono/.test(el.style.fontFamily || '')
}

/** Masked line+char rise for big type. Returns the timeline (paused). */
export function revealHeadline(el, { delay = 0, stagger = 0.018, duration = 1.5 } = {}) {
  const split = SplitText.create(el, { type: 'lines,words,chars', mask: 'lines', linesClass: 'sl', charsClass: 'sc' })
  const tl = gsap.timeline({ paused: true, delay })
  tl.fromTo(split.chars, { yPercent: 115, rotateX: -70, opacity: 0, filter: 'blur(8px)' }, {
    yPercent: 0, rotateX: 0, opacity: 1, filter: 'blur(0px)', duration, ease: 'cine',
    stagger: { each: stagger, from: 'start' },
  })
  return { tl, split }
}

export function scrambleIn(el, { delay = 0, duration = 1.1 } = {}) {
  const text = el.textContent
  if (!text.trim()) return null
  // only scramble plain (non-rich) labels
  if (el.children.length) {
    return gsap.timeline({ paused: true, delay }).fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.8 })
  }
  const tl = gsap.timeline({ paused: true, delay })
  tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 })
  tl.to(el, { duration, scrambleText: { text, chars: SCRAMBLE, revealDelay: 0.25, speed: 0.6 }, ease: 'none' }, 0)
  return tl
}

/** Generic entrance + scroll physics for a section ctx (see Section.jsx). */
export function autoChoreo(ctx, opts = {}) {
  const { el, view } = ctx
  const triggers = []
  const tweens = []
  const skip = new Set(opts.skip || [])

  // 1. Shader camera: slow push-in while the section crosses the screen + mouse parallax
  if (view && !opts.noCamera) {
    const cam = { p: 0 }
    const zoomFrom = opts.zoomFrom ?? 1.06
    const zoomTo = opts.zoomTo ?? 1.16
    const shift = opts.shift ?? 0.035
    const mouse = opts.mouse ?? 1
    triggers.push(ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { cam.p = s.progress } }))
    view.onFrame = (v, st, dt, rect) => {
      const p = cam.p
      v.zoom = zoomFrom + (zoomTo - zoomFrom) * p + (v.extraZoom || 0)
      v.shiftY = (p - 0.5) * rect.height * shift * -1 - st.mouse.sny * 10 * mouse
      v.shiftX = -st.mouse.snx * 16 * mouse
      ctx.onFrame?.(v, st, dt, rect, p)
    }
  } else if (view && opts.noCamera && !view.onFrame) {
    const cam = { p: 0 }
    triggers.push(ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { cam.p = s.progress } }))
    view.onFrame = (v, st, dt, rect) => ctx.onFrame?.(v, st, dt, rect, cam.p)
  }

  // 2. Typography
  const texts = [...el.querySelectorAll('.ds-text')].filter((t) => !skip.has(t.dataset.name) && !t.closest('[data-noauto]'))
  const big = []
  const labels = []
  const body = []
  for (const t of texts) {
    const fs = fontSizeOf(t)
    if (fs >= 36) big.push(t)
    else if (isMono(t)) labels.push(t)
    else body.push(t)
  }
  const enter = gsap.timeline({ paused: true })
  big.forEach((t, i) => {
    const { tl } = revealHeadline(t, { stagger: fontSizeOf(t) > 100 ? 0.028 : 0.016 })
    enter.add(tl.play(), 0.1 + i * 0.25)
  })
  body.forEach((t, i) => {
    enter.fromTo(t, { opacity: 0, y: 24, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'cine' }, 0.5 + i * 0.08)
  })
  labels.forEach((t, i) => {
    const s = scrambleIn(t, { duration: 0.9 + Math.min(t.textContent.length, 40) * 0.012 })
    if (s) enter.add(s.play(), 0.2 + Math.min(i * 0.05, 1.2))
  })

  // 3. Line work: hairline rules grow, SVG paths draw, points ignite
  const rules = [...el.querySelectorAll('.ds-frame')].filter((f) => f.offsetHeight <= 2 && f.offsetWidth > 8 && !f.children.length && !f.closest('[data-noauto]'))
  rules.forEach((r, i) => enter.fromTo(r, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.6, ease: 'cine' }, 0.3 + Math.min(i * 0.03, 0.9)))
  const vrules = [...el.querySelectorAll('.ds-frame')].filter((f) => f.offsetWidth <= 2 && f.offsetHeight > 8 && !f.children.length && !f.closest('[data-noauto]'))
  vrules.forEach((r, i) => enter.fromTo(r, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 1.8, ease: 'cine' }, 0.3 + Math.min(i * 0.03, 0.9)))
  const paths = [...el.querySelectorAll('.ds-vector path')].filter((p) => !p.closest('[data-noauto]'))
  paths.forEach((p, i) => {
    if (p.getAttribute('stroke')) enter.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2.2, ease: 'power2.inOut' }, 0.2 + Math.min(i * 0.04, 1.4))
    else enter.fromTo(p, { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0.4)
  })
  const dots = [...el.querySelectorAll('.ds-ellipse')].filter((d) => !d.closest('[data-noauto]'))
  dots.forEach((d) => enter.fromTo(d, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(3)' }, 0.6 + Math.random() * 1.2))

  ctx.enter = enter
  // set initial hidden state immediately (avoid flash), before the trigger may fire
  enter.progress(0.0001).pause()
  if (!opts.manualEnter) triggers.push(ScrollTrigger.create({
    trigger: el, start: opts.start || 'top 70%',
    onEnter: () => enter.play(),
    onLeaveBack: () => { if (opts.replay) enter.reverse() },
  }))

  // 4. Depth parallax for DOM layers: bigger type lags, labels float
  const parallaxLayers = big.map((t) => ({ t, k: -0.06 }))
  parallaxLayers.forEach(({ t, k }) => {
    tweens.push(gsap.fromTo(t, { y: () => -k * window.innerHeight * 1.2 }, {
      y: () => k * window.innerHeight * 1.2, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
    }))
  })

  return () => {
    triggers.forEach((t) => t.kill())
    tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill() })
    enter.kill()
    if (view) view.onFrame = null
  }
}

export { gsap, ScrollTrigger, SplitText, state }
