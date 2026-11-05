// S11 — The Final Portal. The climax: a living portal that inhales when you
// reach for it, and a scripted dive through it.
import { autoChoreo, gsap, ScrollTrigger, state, revealHeadline, scrambleIn } from '../auto.js'
import { makeShader } from '../../engine/shader.js'
import { createEnding } from './s11-ending.js'
import { asButton } from './s11-fly.js'

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export default function s11(ctx) {
  const { view } = ctx
  const cleanups = []

  // ---- swap in the live portal shader (same uniforms + flow/dive controls)
  const old = view.shader
  const sh = makeShader('portal-live', { ...(ctx.frame.fill?.uniforms || {}), u_refl: 0.36 })
  view.shader = sh
  old.material.dispose()
  const u = sh.u
  const R0 = u.u_R

  // live parameters (tweened by hover / the ending), integrated into uniforms per frame
  const P = { hover: 0, hoverT: 0, dive: 0, streak: 0, open: 1, rim: 1, ending: false, leaving: false, flow: 0, fall: 0, mag: 0 }

  // ---- DOM: the lower type block is choreographed here, not by autoChoreo
  const headline = ctx.q('Headline')
  const cta = ctx.q('CTA')
  const underline = ctx.q('CTA underline')
  const secondary = ctx.q('Secondary')
  underline?.setAttribute('data-noauto', '')
  const uPath = underline?.querySelector('path')

  const autoClean = autoChoreo(ctx, { skip: ['Headline', 'CTA', 'Secondary'], zoomFrom: 1.04, zoomTo: 1.14, shift: 0.03, mouse: 0.8 })

  // reveal of the lower block when it actually reaches the eye
  const low = gsap.timeline({ paused: true })
  const { tl: headTl } = revealHeadline(headline, { stagger: 0.03, duration: 1.7 })
  low.add(headTl.play(), 0)
  const ctaIn = scrambleIn(cta, { duration: 1.3 })
  if (ctaIn) low.add(ctaIn.play(), 0.7)
  if (uPath) low.fromTo(uPath, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 1.8, ease: 'cine' }, 0.9)
  low.fromTo(secondary, { opacity: 0, y: 12, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'cine' }, 1.2)
  low.progress(0.0001).pause()
  const lowST = ScrollTrigger.create({ trigger: headline, start: 'top 88%', onEnter: () => low.play() })
  cleanups.push(() => { lowST.kill(); low.kill() })

  // ---- the CTA becomes a real, keyboard-accessible button
  const hit = document.createElement('style')
  hit.textContent = `[data-name="CTA"][role=button]::before{content:'';position:absolute;inset:-22px -36px}
  [data-name="CTA"][role=button]:focus-visible{outline:1px solid rgba(232,194,122,.55);outline-offset:10px}
  [data-name="CTA"][role=button]{transition:color .6s, text-shadow .8s}
  [data-name="CTA"][role=button].is-hot{color:#FFF6EA;text-shadow:0 0 18px rgba(232,194,122,.45)}`
  document.head.appendChild(hit)
  cleanups.push(() => hit.remove())

  const ending = createEnding(ctx, P)
  cleanups.push(() => ending.destroy())
  cleanups.push(asButton(cta, 'Enter the Noumenon', () => ending.enter()))

  const hotOn = () => { P.hoverT = 1; cta.classList.add('is-hot') }
  const hotOff = () => { P.hoverT = 0; cta.classList.remove('is-hot') }
  cta.addEventListener('pointerenter', hotOn)
  cta.addEventListener('pointerleave', hotOff)
  cta.addEventListener('focus', hotOn)
  cta.addEventListener('blur', hotOff)
  cleanups.push(() => {
    cta.removeEventListener('pointerenter', hotOn); cta.removeEventListener('pointerleave', hotOff)
    cta.removeEventListener('focus', hotOn); cta.removeEventListener('blur', hotOff)
  })

  // magnetic CTA: a low attraction toward the cursor
  const mx = gsap.quickTo(cta, 'x', { duration: 0.9, ease: 'power3.out' })
  const my = gsap.quickTo(cta, 'y', { duration: 0.9, ease: 'power3.out' })
  let magX = 0, magY = 0

  // ---- per-frame life
  ctx.onFrame = (v, st, dt, rect, p) => {
    const s = rect.width / 1440
    // hover easing (slow inhale, slower exhale)
    const hk = 1 - Math.exp(-dt * (P.hoverT > P.hover ? 2.6 : 1.4))
    if (!P.ending) P.hover += (P.hoverT - P.hover) * hk
    const hv = P.hover

    // approach: the portal grows and the lens tightens as it comes to the centre
    const near = ss(0.04, 0.42, p)
    u.u_R = R0 * (0.84 + 0.16 * near) * (1 + 0.03 * hv)
    u.u_lens = 0.7 + 0.45 * near + 0.45 * hv
    u.u_pull = 0.45 + 0.35 * near + 1.2 * hv
    u.u_open = P.open * (1 + 0.32 * hv)
    u.u_rim = P.rim * (1 + 0.8 * hv)
    u.u_ripple = 1 + 0.4 * hv

    // clocks: everything flows faster when the portal inhales or we dive
    const d = P.dive
    const rush = P.streak
    P.flow += dt * (1 + 2.5 * hv + 22 * rush)
    P.fall += dt * (1 + 6 * hv + 60 * rush)
    u.u_flow = P.flow
    u.u_fall = P.fall
    u.u_dive = d
    u.u_streak = P.streak

    // map screen -> shader design space (the view is zoomed/shifted by the camera)
    const z = v.zoom
    const left = rect.left - (rect.width * z - rect.width) / 2 + v.shiftX
    const top = rect.top - (rect.height * z - rect.height) / 2 + v.shiftY
    const k = 1440 / (rect.width * z)
    u.u_mx = (st.mouse.sx - left) * k
    u.u_my = (st.mouse.sy - top) * k
    u.u_mk = P.ending ? 0 : 0.32 + 0.25 * hv
    u.u_ax = (st.w / 2 - left) * k
    u.u_ay = (st.h / 2 - top) * k
    // calm zone follows the type block (headline + CTA)
    u.u_tx = (rect.left + 720 * s - left) * k
    u.u_ty = (rect.top + 1045 * s - top) * k
    u.u_tw = 430 * s * k
    u.u_th = 165 * s * k

    // magnetic CTA
    if (!P.ending) {
      const cx = rect.left + 720 * s, cy = rect.top + 1118 * s
      const dx = st.mouse.x - cx, dy = st.mouse.y - cy
      const dist = Math.hypot(dx, dy)
      const f = Math.pow(Math.max(0, 1 - dist / (240 * s)), 1.6)
      const tx = dx * 0.24 * f, ty = dy * 0.34 * f
      if (Math.abs(tx - magX) > 0.05 || Math.abs(ty - magY) > 0.05) { magX = tx; magY = ty; mx(tx); my(ty) }
      if (uPath) uPath.style.stroke = `rgba(${Math.round(238 - 6 * hv)},${Math.round(241 - 47 * hv)},${Math.round(247 - 125 * hv)},${(0.15 + 0.6 * hv).toFixed(3)})`
      if (underline) underline.style.transform = `translateX(${(tx * 0.5).toFixed(2)}px) scaleX(${(1 + 0.22 * hv).toFixed(4)})`
    }
  }

  return () => {
    cleanups.forEach((c) => c())
    autoClean()
    ctx.onFrame = null
  }
}
