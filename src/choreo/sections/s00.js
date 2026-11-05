// S00 — Hero. "Opening shot": the limb is dark, two beads of light race along the
// atmosphere and converge on the gold point, which ignites; the signal climbs out of it,
// touches the nav hairline, the interface condenses, the monument headline rises.
// Scroll = the camera falls past the limb into the planet's night, toward the Origin.
import { autoChoreo, gsap, SplitText, scrambleIn } from '../auto.js'
import { makeShader } from '../../engine/shader.js'

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }

const BX = 1090
const BY = 600

export default function s00(ctx) {
  const { el, view } = ctx

  // ---- live shader (copy of hero-limb-v3 with camera / dawn / signal controls)
  const old = view.shader
  view.shader = makeShader('hero-limb-live', { ...(ctx.frame.fill?.uniforms || {}), u_zx: BX, u_zy: BY })
  old.material.dispose()
  const u = (ctx.u = view.shader.u)

  // ---- DOM nodes we own
  const wordmark = ctx.q('Wordmark')
  const nav = ctx.q('Nav links')
  const navItems = nav ? [...nav.children] : []
  const navRule = ctx.q('Nav hairline')
  const kicker = ctx.q('Kicker')
  const hl = ctx.q('Headline')
  const cue = ctx.q('Scroll cue')
  const cueRule = ctx.q('Scroll hairline')
  const cueLabel = ctx.q('Scroll label')
  const gauge = ctx.q('Depth gauge')
  for (const n of [wordmark, nav, kicker, hl, cue]) n?.setAttribute('data-noauto', '')

  const stopAuto = autoChoreo(ctx, { manualEnter: true, noCamera: true })
  // hairlines are owned here, not by the generic rule-grow
  for (const r of [navRule, cueRule]) if (r) { ctx.enter.killTweensOf(r); gsap.set(r, { clearProps: 'transform' }) }

  // ---- intro state (tweened), combined per frame with idle + cursor + scroll
  const I = { head: 860, glint: 0, cres: 0.0, pt: 0, flare: 0, stars: 0, neb: 0, sigH: 0, tip: 0 }

  // headline split: chars rise with depth, "exist" arrives last differently
  const split = SplitText.create(hl, { type: 'lines,words,chars', linesClass: 'sl', charsClass: 'sc' })
  const serifChars = split.chars.filter((c) => c.closest('[data-span="1"]'))
  const sansChars = split.chars.filter((c) => !serifChars.includes(c))
  const lines = split.lines
  gsap.set(lines, { transformPerspective: 1400, transformOrigin: '50% 100%' })

  const intro = gsap.timeline({ paused: true })
  // --- 1. the dark: stars resolve slowly
  intro.to(I, { stars: 1, neb: 1, duration: 3.2, ease: 'power1.inOut' }, 0.15)
  // --- 2. dawn: beads of light race along the limb toward the break point
  intro.to(I, { glint: 1, duration: 0.5, ease: 'power1.out' }, 0.2)
  intro.to(I, { head: 0, duration: 1.5, ease: 'power1.in' }, 0.22)
  intro.to(I, { cres: 0.75, duration: 1.4, ease: 'power2.in' }, 0.3)
  // --- 3. ignition at the gold point
  const T = 1.72
  intro.to(I, { glint: 0, duration: 0.35, ease: 'power2.out' }, T)
  intro.to(I, { pt: 2.6, flare: 1.35, cres: 1.6, duration: 0.16, ease: 'power2.out' }, T)
  intro.to(I, { pt: 1, cres: 1, duration: 2.0, ease: 'cine' }, T + 0.16)
  intro.to(I, { flare: 0, duration: 2.4, ease: 'power2.out' }, T + 0.16)
  // --- 4. the signal climbs out of the point
  intro.set(I, { tip: 1 }, T + 0.15)
  intro.to(I, { sigH: 1, duration: 1.05, ease: 'power2.inOut' }, T + 0.15)
  intro.to(I, { tip: 0, duration: 0.5, ease: 'power1.out' }, T + 1.05)
  // --- 5. it touches the nav hairline, which spreads from that point
  const N = T + 0.95
  if (navRule) intro.fromTo(navRule, { scaleX: 0, transformOrigin: `${((BX - 96) / 1248) * 100}% 50%` },
    { scaleX: 1, duration: 1.8, ease: 'cine' }, N)
  // nav items drop one by one, outward from the signal
  intro.fromTo(navItems, { y: -22, opacity: 0, filter: 'blur(5px)' },
    { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'cine', stagger: { each: 0.085, from: 2 } }, N + 0.12)
  if (wordmark) intro.fromTo(wordmark, { opacity: 0, letterSpacing: '22px' },
    { opacity: 1, letterSpacing: '8px', duration: 1.9, ease: 'cine' }, N + 0.2)
  // kicker decodes
  const ks = kicker && scrambleIn(kicker, { duration: 1.3 })
  if (ks) intro.add(ks.play(), N + 0.3)
  // --- 6. the monument headline
  const H = N + 0.45
  intro.fromTo(sansChars, { opacity: 0, yPercent: 70, z: -260, rotateX: -78, filter: 'blur(10px)', transformPerspective: 700, transformOrigin: '50% 100% -30px' },
    { opacity: 1, yPercent: 0, z: 0, rotateX: 0, filter: 'blur(0px)', duration: 1.9, ease: 'cine', stagger: { each: 0.032, from: 'start' } }, H)
  // "exist" — condenses out of light: large, defocused, warm, then settles cold and sharp
  intro.fromTo(serifChars, { opacity: 0, scale: 1.55, y: -18, filter: 'blur(22px)', color: '#E8C27A', transformOrigin: '50% 60%' },
    { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 2.4, ease: 'expo.out', stagger: { each: 0.07, from: 'center' } }, H + 0.85)
  intro.to(serifChars, { color: '#EEF1F7', duration: 2.6, ease: 'power1.inOut' }, H + 1.4)
  // --- 7. HUD + scroll cue
  intro.add(() => ctx.enter.play(), H + 0.9)
  if (cue) intro.fromTo(cue, { opacity: 0 }, { opacity: 1, duration: 1.0 }, H + 1.5)
  if (cueRule) intro.fromTo(cueRule, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.2, ease: 'cine' }, H + 1.5)
  if (cueLabel) { const s = scrambleIn(cueLabel, { duration: 1.0 }); if (s) intro.add(s.play(), H + 1.6) }

  // living scroll cue: a slow pulse that keeps reading as "descend"
  const pulse = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.6 })
  if (cueRule) {
    pulse.to(cueRule, { scaleX: 0, transformOrigin: '100% 50%', duration: 1.1, ease: 'power2.in' })
      .set(cueRule, { transformOrigin: '0% 50%' })
      .to(cueRule, { scaleX: 1, duration: 1.3, ease: 'cine' })
  }
  if (cueLabel) pulse.to(cueLabel, { opacity: 0.45, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
  intro.add(() => pulse.play(), H + 3.2)

  intro.progress(0).pause()
  ;(window.__choreo ||= {}).s00 = { intro, I }
  const start = () => intro.play(0)
  if (window.__introDone) start()
  else window.addEventListener('noumena:intro', start, { once: true })

  // ---- per frame: idle life + cursor + scroll-out camera
  let lastE = -1
  view.onFrame = (v, st, dt, rect) => {
    const t = st.time
    const e = clamp(-rect.top / rect.height)              // 0 at rest → 1 when the hero has left
    const fall = e * e * (3 - 2 * e)
    const mx = st.mouse.snx, my = st.mouse.sny

    v.zoom = 1; v.shiftX = 0; v.shiftY = 0
    const breath = 1 + 0.07 * Math.sin(t * 0.52) + 0.03 * Math.sin(t * 1.31 + 1.7)
    const twinkle = 1 + 0.16 * Math.sin(t * 2.3) * Math.sin(t * 0.77 + 0.6) + 0.05 * Math.sin(t * 9.1) * Math.sin(t * 3.7)

    // cursor bends the dawn a few design px; the sky parallaxes against the planet
    const bx = BX + mx * 7
    const by = BY + my * 3 - fall * 170                     // falling: the horizon climbs past us
    u.u_bx = bx; u.u_by = by
    u.u_zx = bx; u.u_zy = by
    u.u_zoom = 1 + Math.pow(e, 1.4) * 1.9                   // dive toward the point
    u.u_szoom = 1 + e * 0.35
    u.u_sx = -mx * 16; u.u_sy = -my * 9 - e * 140

    u.u_head = I.head
    u.u_glint = I.glint
    u.u_cres = I.cres * breath * (1 + e * 0.9)
    u.u_pt = I.pt * twinkle * (1 + e * 0.8)
    u.u_flare = I.flare + ss(0.15, 0.6, e) * 0.35 * (1 - ss(0.6, 1, e))
    u.u_stars = I.stars
    u.u_neb = I.neb
    u.u_sigH = I.sigH
    u.u_tip = I.tip
    u.u_sigTop = -fall * 900                               // the signal stretches up out of frame…
    u.u_sig = 1 - ss(0.35, 0.85, e)                         // …and thins away
    u.u_expo = 1 - ss(0.55, 1, e) * 0.55

    // DOM scroll-out (only touch styles when it changed)
    if (Math.abs(e - lastE) > 0.0004) {
      lastE = e
      // scroll-out uses y + filter (blur/opacity()) so it never fights the intro's opacity tweens
      const k = e < 0.001 ? 0 : e
      lines.forEach((l, i) => gsap.set(l, { y: -k * (230 - i * 70), z: k * (320 - i * 120), rotateX: k * 14 }))
      hl.style.filter = k ? `blur(${(ss(0.05, 0.7, k) * 16).toFixed(2)}px) opacity(${(1 - ss(0.12, 0.72, k)).toFixed(3)})` : ''
      const out = (n, dy, f = 0.4, blur = 4) => {
        if (!n) return
        n.style.translate = k ? `0 ${(-k * dy).toFixed(1)}px` : ''
        n.style.filter = k ? `blur(${(ss(0, f, k) * blur).toFixed(2)}px) opacity(${(1 - ss(0.04, f, k)).toFixed(3)})` : ''
      }
      out(kicker, 160, 0.48)
      out(nav, 60)
      out(wordmark, 60)
      out(navRule, 0, 0.4, 0)
      out(cue, -40, 0.18, 0)
      out(gauge, -40, 0.2, 0)
    }
  }

  return () => {
    window.removeEventListener('noumena:intro', start)
    intro.kill()
    pulse.kill()
    split.revert()
    for (const n of [hl, kicker, nav, wordmark, navRule, cue, gauge]) if (n) { n.style.translate = ''; n.style.filter = '' }
    stopAuto()
    view.onFrame = null
  }
}
