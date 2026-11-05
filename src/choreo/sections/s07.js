// S07 — Beyond Human Imagination
// The impossible hall becomes a place you travel through: scroll glides the camera
// down the infinite corridor, the cursor steers the gaze, the slit of light breathes.
// Crossing into the section tears reality (slices slide and flip, levels re-orient).
// The mirrored BEYOND is a reflection on a liquid floor: it lags, sways and shears
// behind the real line, driven by scroll velocity.
import { autoChoreo, gsap, ScrollTrigger, SplitText, state } from '../auto.js'
import { makeShader } from '../../engine/shader.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const GLITCH_P = 0.11 // section progress where reality tears (top of section ~70% down the viewport)

export default function s07(ctx) {
  const { el, view } = ctx
  const cleanups = []

  // ---- 1. live shader: same hall, now with a moving camera
  let orig = null
  let u = ctx.u
  if (view) {
    orig = view.shader
    const fill = ctx.frame.fill?.uniforms || {}
    const live = makeShader('beyond-hall-live', fill)
    view.shader = live
    u = live.u
    cleanups.push(() => { view.shader = orig; live.material.dispose() })
  }

  // ---- 2. typography: the reflection is ours
  const headline = ctx.q('Headline')
  const mirror = ctx.q('Reflection')
  const floor = ctx.q('Floor line')
  let chars = []
  let split = null
  if (mirror) {
    mirror.setAttribute('data-noauto', '')
    split = SplitText.create(mirror, { type: 'lines,chars', mask: 'lines', linesClass: 'sl', charsClass: 'sc' })
    chars = split.chars
    mirror.style.willChange = 'transform'
    // the reflection fades as it goes deeper (local top = visual bottom because of scaleY(-1))
    mirror.style.webkitMaskImage = 'linear-gradient(to bottom, rgba(0,0,0,0.25), #000 85%)'
    mirror.style.maskImage = 'linear-gradient(to bottom, rgba(0,0,0,0.25), #000 85%)'
  }
  const rise = chars.map(() => ({ v: 1, o: 0, b: 8 }))

  const autoClean = autoChoreo(ctx, { skip: ['Reflection'], mouse: 0.45, zoomFrom: 1.04, zoomTo: 1.12 })

  // reflection entrance follows the headline: chars descend from the floor into place
  if (ctx.enter && chars.length) {
    rise.forEach((r, i) => {
      ctx.enter.to(r, { v: 0, o: 1, b: 0, duration: 1.9, ease: 'cine' }, 0.75 + i * 0.07)
    })
  }

  // ---- 3. reality glitch (scroll-linked + a time kick when the threshold is crossed)
  const kick = { v: 0 }
  let side = null
  const st = ScrollTrigger.create({
    trigger: el, start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => {
      const now = s.progress > GLITCH_P ? 1 : 0
      if (side !== null && now !== side) {
        gsap.killTweensOf(kick)
        gsap.fromTo(kick, { v: 1 }, { v: 0, duration: 0.85, ease: 'power3.out' })
      }
      side = now
    },
  })
  cleanups.push(() => st.kill())

  // ---- 4. per frame
  let camZ = 0
  let my = 0 // mirror lagged offset
  let skew = 0
  let warpMine = 0
  let ripple = 0
  const t0 = state.time
  ctx.onFrame = (v, s, dt, rect, p) => {
    const t = s.time
    const k = 1 - Math.pow(0.02, dt)
    // camera glides through the hall: scrubbed by scroll + a slow ambient drift
    const target = p * 34 + (t - t0) * 0.16
    camZ += (target - camZ) * k
    u.u_camZ = camZ
    u.u_yaw = -s.mouse.snx * 0.075 + Math.sin(t * 0.13) * 0.012
    u.u_pitch = s.mouse.sny * 0.045 + Math.sin(t * 0.11 + 1.0) * 0.008
    u.u_roll = clamp(s.svel * -0.0009, -0.05, 0.05)

    // the slit breathes; it opens a little as we get deeper
    const breath = 0.5 + 0.5 * Math.sin(t * 0.75)
    const flick = 0.04 * Math.sin(t * 2.3) * Math.sin(t * 0.37)
    u.u_slitAmt = (0.55 + 0.35 * clamp(p * 1.4, 0, 1)) * (0.78 + 0.32 * breath + flick)
    u.u_slitW = 0.75 + 0.6 * breath

    // glitch: bell around the threshold + kick
    const d = (p - GLITCH_P) / 0.05
    const gScroll = Math.exp(-d * d)
    const g = clamp(Math.max(gScroll * 0.9, kick.v), 0, 1)
    u.u_glitch = g
    u.u_flip = p < GLITCH_P ? 1 : 0
    const w = g * 0.55
    state.warp = Math.max(0, state.warp - warpMine + w)
    warpMine = w

    // ---- mirror: lag + shear + travelling wave
    const hy = headline ? gsap.getProperty(headline, 'y') : 0
    const mk = 1 - Math.pow(0.12, dt) // slow follower: the reflection lags
    my += (-0.45 * hy - my) * mk
    const vel = clamp(s.svel, -60, 60)
    skew += (clamp(-vel * 0.22, -14, 14) - skew) * (1 - Math.pow(0.05, dt))
    ripple += (Math.min(Math.abs(vel), 40) - ripple) * (1 - Math.pow(0.08, dt))
    if (mirror) {
      mirror.style.transform = `translate3d(${(-s.mouse.snx * 6).toFixed(2)}px, ${my.toFixed(2)}px, 0) scaleY(-1) skewX(${skew.toFixed(2)}deg)`
      const amp = 1.2 + ripple * 0.35
      for (let i = 0; i < chars.length; i++) {
        const r = rise[i]
        const ph = t * 1.7 - i * 0.75
        const wy = Math.sin(ph) * amp
        const wx = Math.sin(ph * 0.6 + 1.3) * amp * 0.5
        const sy = 1 + Math.sin(ph + 0.8) * (0.025 + ripple * 0.004)
        const c = chars[i]
        c.style.transform = `translate3d(${wx.toFixed(2)}px, ${(r.v * 110).toFixed(1)}%, 0) translateY(${wy.toFixed(2)}px) scaleY(${sy.toFixed(3)})`
        c.style.opacity = r.o
        c.style.filter = r.b > 0.05 ? `blur(${(r.b + ripple * 0.04).toFixed(2)}px)` : (ripple > 4 ? `blur(${(ripple * 0.04).toFixed(2)}px)` : '')
      }
    }
    if (floor) {
      const glow = clamp(ripple / 30, 0, 1)
      floor.style.boxShadow = `0 0 ${(6 + glow * 18).toFixed(1)}px rgba(127,216,255,${(0.06 + glow * 0.35 + 0.05 * breath).toFixed(3)})`
    }
  }

  return () => {
    state.warp = Math.max(0, state.warp - warpMine)
    ctx.onFrame = null
    autoClean?.()
    cleanups.forEach((f) => f())
    split?.revert()
  }
}
