// S12 — The Cosmic Footer. The last light: a distant galaxy turning, a catalogue
// that decodes like a plate index, live sky coordinates, and the wordmark rising
// from below the edge of the frame.
import { autoChoreo, gsap, ScrollTrigger } from '../auto.js'
import { makeShader } from '../../engine/shader.js'
import { asButton, flyToOrigin } from './s11-fly.js'

const COLS = ['Systems', 'Research', 'Laboratory', 'Contact']
const GLYPHS = '01░▒<>/\\—·×ΛΣΩ∆'
const pad = (n) => String(n).padStart(2, '0')

export default function s12(ctx) {
  const { view, el } = ctx
  const cleanups = []

  // ---- live galaxy (footer-galaxy-v3 + in-plane spin)
  const old = view.shader
  const sh = makeShader('footer-live', ctx.frame.fill?.uniforms || {})
  view.shader = sh
  old.material.dispose()
  const u = sh.u
  const base = { rot: u.u_rot, tilt: u.u_tilt, bright: u.u_bright }

  // ---- catalogue nodes
  const cat = COLS.map((c) => {
    const rows = []
    for (let i = 1; i <= 4; i++) {
      const name = ctx.q(`${c} ${i}`)
      if (name) rows.push({ code: ctx.q(`${c} ${i} code`), name })
    }
    return { code: ctx.q(`${c} code`), title: ctx.q(`${c} title`), rows }
  })
  const skip = ['Wordmark', 'Coordinates']
  COLS.forEach((c) => {
    skip.push(`${c} code`, `${c} title`)
    for (let i = 1; i <= 4; i++) skip.push(`${c} ${i}`, `${c} ${i} code`)
  })

  const autoClean = autoChoreo(ctx, { skip, zoomFrom: 1.0, zoomTo: 1.08, shift: 0.02, mouse: 0.6 })

  // ---- catalogue decodes in, column by column, row by row
  const plate = gsap.timeline({ paused: true })
  const decode = (node, at, dur = 0.9, chars = GLYPHS) => {
    if (!node) return
    const text = node.textContent
    plate.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at)
    plate.to(node, { duration: dur, scrambleText: { text, chars, revealDelay: 0.2, speed: 0.7 }, ease: 'none' }, at)
  }
  cat.forEach((col, ci) => {
    const t = ci * 0.14
    decode(col.code, t, 0.8)
    decode(col.title, t + 0.12, 1.0)
    col.rows.forEach((r, ri) => {
      const at = t + 0.38 + ri * 0.1
      decode(r.code, at, 0.7, '0123456789IVX.')
      decode(r.name, at + 0.06, 0.9, 'abcdefghijklmnopqrstuvwxyz')
    })
  })
  plate.progress(0.0001).pause()
  const plateST = ScrollTrigger.create({ trigger: ctx.q('Plate hairline') || el, start: 'top 85%', onEnter: () => plate.play() })
  cleanups.push(() => { plateST.kill(); plate.kill() })

  // ---- catalogue hover (entries are links-to-be: they answer the cursor)
  const GOLD = 'rgba(232,194,122,0.85)'
  cat.forEach((col) => col.rows.forEach(({ code, name }) => {
    name.setAttribute('data-cursor', 'link')
    name.style.pointerEvents = 'auto'
    const c0 = name.style.color, k0 = code?.style.color
    const on = () => {
      gsap.to(name, { x: 6, color: '#EEF1F7', duration: 0.7, ease: 'cine', overwrite: 'auto' })
      if (code) gsap.to(code, { color: GOLD, duration: 0.5, overwrite: 'auto' })
    }
    const off = () => {
      gsap.to(name, { x: 0, color: c0, duration: 0.9, ease: 'cine', overwrite: 'auto' })
      if (code) gsap.to(code, { color: k0, duration: 0.7, overwrite: 'auto' })
    }
    name.addEventListener('pointerenter', on)
    name.addEventListener('pointerleave', off)
    cleanups.push(() => { name.removeEventListener('pointerenter', on); name.removeEventListener('pointerleave', off) })
  }))

  // ---- RETURN TO ORIGIN ↑ — a real button, flies home with warp
  const ret = ctx.q('Return to origin')
  if (ret) {
    cleanups.push(asButton(ret, 'Return to origin', () => flyToOrigin({ duration: 4 })))
    const r0 = ret.style.color
    const on = () => gsap.to(ret, { y: -3, color: '#EEF1F7', textShadow: '0 0 14px rgba(232,194,122,.4)', duration: 0.6, ease: 'cine', overwrite: 'auto' })
    const off = () => gsap.to(ret, { y: 0, color: r0, textShadow: '0 0 0px rgba(232,194,122,0)', duration: 0.8, ease: 'cine', overwrite: 'auto' })
    ret.addEventListener('pointerenter', on); ret.addEventListener('pointerleave', off)
    ret.addEventListener('focus', on); ret.addEventListener('blur', off)
    const st = document.createElement('style')
    st.textContent = `[data-name="Return to origin"][role=button]::before{content:'';position:absolute;inset:-14px -18px}
      [data-name="Return to origin"][role=button]:focus-visible{outline:1px solid rgba(232,194,122,.55);outline-offset:8px}`
    document.head.appendChild(st)
    cleanups.push(() => {
      st.remove()
      ret.removeEventListener('pointerenter', on); ret.removeEventListener('pointerleave', off)
      ret.removeEventListener('focus', on); ret.removeEventListener('blur', off)
    })
  }

  // ---- live coordinates: RA/DEC seconds tick
  const coord = ctx.q('Coordinates')
  let ticker = null
  if (coord) {
    const m = coord.textContent.match(/RA\s+(\d+)h\s+(\d+)m\s+(\d+)s\s+·\s+DEC\s+([−-]?)(\d+)°\s+(\d+)′\s+(\d+)″/)
    let ra = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 63940
    const sign = m ? m[4] || '' : '−'
    let dec = m ? (+m[5]) * 3600 + (+m[6]) * 60 + (+m[7]) : 104428
    let n = 0
    const fmt = () => {
      const h = Math.floor(ra / 3600) % 24, mi = Math.floor(ra / 60) % 60, s = ra % 60
      const dd = Math.floor(dec / 3600), dm = Math.floor(dec / 60) % 60, ds = dec % 60
      return `RA ${pad(h)}h ${pad(mi)}m ${pad(s)}s · DEC ${sign}${pad(dd)}° ${pad(dm)}′ ${pad(ds)}″`
    }
    coord.style.fontVariantNumeric = 'tabular-nums'
    const text = fmt()
    const tl = gsap.timeline({ paused: true })
    tl.fromTo(coord, { opacity: 0 }, { opacity: 1, duration: 0.3 })
    tl.to(coord, { duration: 1.6, scrambleText: { text, chars: '0123456789', revealDelay: 0.3, speed: 0.6 }, ease: 'none' }, 0)
    tl.progress(0.0001).pause()
    const tick = () => {
      ra += 1
      if (++n % 3 === 0) dec += 1
      coord.textContent = fmt()
    }
    const cst = ScrollTrigger.create({
      trigger: el, start: 'top 75%', end: 'bottom top',
      onEnter: () => tl.play(),
      onToggle: (s) => {
        clearInterval(ticker); ticker = null
        if (s.isActive) ticker = setInterval(() => { if (tl.progress() === 1) tick() }, 1000)
      },
    })
    cleanups.push(() => { cst.kill(); tl.kill(); clearInterval(ticker) })
  }

  // ---- the wordmark: rises from below the edge, lit by a sweep from the galaxy side
  const wm = ctx.q('Wordmark')
  if (wm) {
    Object.assign(wm.style, {
      backgroundImage: [
        'linear-gradient(104deg, rgba(3,4,9,0) 0%, rgba(3,4,9,0) 43%, rgba(150,170,225,.10) 47%, rgba(205,215,245,.34) 50%, rgba(150,170,225,.10) 53%, rgba(3,4,9,0) 57%, rgba(3,4,9,0) 100%)',
        'radial-gradient(ellipse 30% 120% at 84% 62%, rgba(140,158,215,.20), rgba(3,4,9,0) 72%)',
        'linear-gradient(#030409, #030409)',
      ].join(', '),
      backgroundSize: '300% 100%, 100% 100%, 100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0% 0, 0 0, 0 0',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      willChange: 'transform',
    })
    const rise = gsap.fromTo(wm, { yPercent: 62 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 65%', end: 'bottom bottom', scrub: 1.4 },
    })
    const sw = { p: 0 }
    const sweep = gsap.timeline({ repeat: -1, repeatDelay: 3.2, paused: true })
    sweep.fromTo(sw, { p: 0 }, {
      p: 1, duration: 5.5, ease: 'sine.inOut',
      onUpdate: () => { wm.style.backgroundPosition = `${(sw.p * 100).toFixed(2)}% 0, 0 0, 0 0` },
    })
    const sst = ScrollTrigger.create({ trigger: el, start: 'top 40%', end: 'bottom top', onToggle: (s) => (s.isActive ? sweep.play() : sweep.pause()) })
    cleanups.push(() => { rise.scrollTrigger?.kill(); rise.kill(); sweep.kill(); sst.kill() })
  }

  // ---- galaxy life
  let spin = 0
  ctx.onFrame = (v, st, dt, rect, p) => {
    spin += dt * (0.03 + Math.min(Math.abs(st.svel) * 0.002, 0.08))
    u.u_spin = spin
    u.u_rot = base.rot + st.mouse.snx * 0.025
    u.u_tilt = base.tilt + st.mouse.sny * 0.02
    // the last light brightens as the page comes to rest on it
    const k = Math.min(1, Math.max(0, (p - 0.15) / 0.35))
    u.u_bright = base.bright * (0.6 + 0.4 * k)
  }

  return () => {
    cleanups.forEach((c) => c())
    autoClean()
    ctx.onFrame = null
  }
}
