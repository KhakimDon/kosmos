import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { state, engine } from '../engine/engine.js'
import { sound } from '../engine/sound.js'
import { makeShader } from '../engine/shader.js'
import { Node } from '../design/Node.jsx'
import design from '../design/design.json'
import { JOURNEY, lyAt, sci } from './journey.js'

/** Fly to a section with a warp: speed blur + star streaks + a swell. */
export function travelTo(target, { duration } = {}) {
  const lenis = window.__lenis
  if (!lenis) return
  const el = typeof target === 'string' ? document.getElementById(target) : target
  const y = typeof target === 'number' ? target : el ? el.offsetTop : 0
  const dist = Math.abs(y - lenis.scroll)
  const d = duration ?? Math.min(4.2, 1.4 + dist / 5000)
  sound.swell(d, 0.25)
  gsap.timeline()
    .to(state, { warp: Math.min(1.1, 0.35 + dist / 12000), duration: d * 0.35, ease: 'power2.in' })
    .to(state, { warp: 0, duration: d * 0.65, ease: 'power3.out' })
  lenis.scrollTo(y, { duration: d, easing: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2) })
}
window.__travelTo = travelTo

function useSectionPosition(sections) {
  const [pos, setPos] = useState(0)
  useEffect(() => {
    let raf
    let last = -1
    const loop = () => {
      const mid = window.innerHeight * 0.5
      let p = 0
      for (let i = 0; i < sections.length; i++) {
        const el = document.getElementById(sections[i].key)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.top <= mid && r.bottom > mid) { p = i + (mid - r.top) / r.height; break }
        if (r.top > mid) { p = i; break }
        p = i + 1
      }
      p = Math.min(p, sections.length - 0.001)
      if (Math.abs(p - last) > 0.0005) { last = p; setPos(p) }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [sections])
  return pos
}

function DepthGauge({ pos, sections, visible }) {
  const n = sections.length
  const idx = Math.min(n - 1, Math.floor(pos))
  const j = JOURNEY[idx] || JOURNEY[0]
  const ly = lyAt(pos)
  const readout = j.undefinedDist ? (Math.floor(state.time * 12) % 2 ? '∞ / UNDEFINED' : '∞ / UND3F1NED') : idx === 0 ? 'DISTANCE FROM ORIGIN —' : sci(ly)
  const frac = pos / n
  return (
    <nav className="gauge" data-visible={visible} aria-label="Journey depth">
      <span className="g-end g-top">ORIGIN</span>
      <div className="g-rail">
        <div className="g-travelled" style={{ transform: `scaleY(${frac})` }} />
        {sections.map((s, i) => (
          <button
            key={s.key}
            className="g-tick"
            data-on={i <= idx}
            data-cursor="link"
            data-cursor-label={`${JOURNEY[i]?.idx} — ${JOURNEY[i]?.name}`}
            style={{ top: `${(i / (n - 1)) * 100}%` }}
            onClick={() => travelTo(s.key)}
            aria-label={JOURNEY[i]?.name}
          >
            <span>{JOURNEY[i]?.idx}</span>
          </button>
        ))}
        <div className="g-marker" style={{ top: `${Math.min(1, pos / (n - 1)) * 100}%` }}>
          <div className="g-readout">
            <span className="g-dist">{readout}</span>
            <span className="g-name">{j.idx} — {j.name}</span>
          </div>
        </div>
      </div>
      <span className="g-end g-bottom">EDGE</span>
    </nav>
  )
}

function SoundToggle() {
  const [on, setOn] = useState(sound.on)
  useEffect(() => sound.subscribe(setOn), [])
  return (
    <button className="hud-sound" data-cursor="link" onClick={() => sound.toggle()} aria-label="Toggle sound" data-on={on}>
      <span className="bars">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 0.13}s` }} />)}</span>
      <span>{on ? 'SOUND ON' : 'SOUND OFF'}</span>
    </button>
  )
}

const MENU_FRAME = design['X2 — Navigation System']?.children?.find((c) => c.name.startsWith('Menu Overlay'))

function Menu({ open, onClose, pos, sections }) {
  const root = useRef(null)
  const stage = useRef(null)
  const viewRef = useRef(null)
  const [fit, setFit] = useState(1)
  const shaderNode = useRef(null)

  useLayoutEffect(() => {
    const f = () => setFit(Math.max(window.innerWidth / 1440, window.innerHeight / 900))
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  // orrery shader on the front layer, only while open
  useEffect(() => {
    if (!MENU_FRAME || !shaderNode.current) return
    const fill = MENU_FRAME.fill
    const shader = makeShader(fill.src, fill.uniforms || {}, { transparent: false })
    const view = { el: shaderNode.current, shader, layer: 'front', enabled: false }
    viewRef.current = view
    const off = engine.add(view)
    return () => { off(); shader.material.dispose() }
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const v = viewRef.current
    if (open) {
      window.__lenis?.stop()
      document.documentElement.classList.add('menu-open')
      gsap.delayedCall(0.9, () => { if (v) v.enabled = true; el.dataset.bg = 'off' })
      el.style.pointerEvents = 'auto'
      sound.swell(1.6, 0.18)
      const bodies = el.querySelectorAll('[data-name^="Body "], [data-name^="Body ring"], [data-name="Here ring"]')
      const labels = el.querySelectorAll('[data-name^="Label "]')
      gsap.timeline()
        .fromTo(el, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', duration: 1.3, ease: 'expo.inOut' })
        .fromTo(bodies, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, stagger: 0.03, ease: 'back.out(3)' }, 0.5)
        .fromTo(labels, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.04, ease: 'power2.out' }, 0.6)
        .fromTo(el.querySelectorAll('svg path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.8, ease: 'power2.inOut', stagger: 0.05 }, 0.3)
    } else {
      el.dataset.bg = 'on'
      if (v) v.enabled = false
      document.documentElement.classList.remove('menu-open')
      gsap.to(el, {
        clipPath: 'circle(0% at 50% 50%)', duration: 0.9, ease: 'expo.inOut',
        onComplete: () => { el.style.pointerEvents = 'none' },
      })
      window.__lenis?.start()
    }
  }, [open])

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && open) onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  // wire clicks: Body NN / Label NN → section NN ; Close
  useEffect(() => {
    const el = root.current
    if (!el) return
    const click = (e) => {
      const t = e.target.closest('[data-name]')
      if (!t) return
      const name = t.closest('[data-name^="Label "], [data-name^="Body "], [data-name="Close"], [data-name="Close cross"], [data-name="Esc"]')?.dataset.name
      if (!name) return
      if (/^Close|^Esc/.test(name)) return onClose()
      const m = name.match(/(\d\d)$/)
      if (m) {
        const i = parseInt(m[1], 10)
        onClose()
        setTimeout(() => travelTo(sections[i]?.key), 350)
      }
    }
    el.addEventListener('click', click)
    el.querySelectorAll('[data-name^="Label "], [data-name^="Body "], [data-name="Close"]').forEach((n) => {
      n.dataset.cursor = 'link'
      const m = n.dataset.name.match(/(\d\d)$/)
      if (m) n.dataset.cursorLabel = `TRAVEL → ${JOURNEY[+m[1]]?.dist}`
      n.style.cursor = 'pointer'
    })
    return () => el.removeEventListener('click', click)
  }, [sections, onClose])

  // live "you are here"
  const idx = Math.min(sections.length - 1, Math.floor(pos))
  useEffect(() => {
    const el = root.current
    if (!el) return
    const title = el.querySelector('[data-name="Here title"]')
    const dist = el.querySelector('[data-name="Here dist"]')
    const j = JOURNEY[idx]
    if (title && j) {
      const words = j.name.toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase()).split(' ')
      const lastWord = words.pop()
      title.innerHTML = `${words.join(' ')} <span style="font-family:'Instrument Serif';font-style:italic">${lastWord}</span>`
    }
    if (dist && j) dist.textContent = `${j.idx} — ${j.dist === '—' ? 'AT' : j.dist} FROM THE ORIGIN`
    // move "Here ring" to current body
    const body = el.querySelector(`[data-name="Body ${String(idx).padStart(2, '0')}"]`)
    const ring = el.querySelector('[data-name="Here ring"]')
    if (body && ring) {
      const bx = parseFloat(body.style.left) + parseFloat(body.style.width) / 2
      const by = parseFloat(body.style.top) + parseFloat(body.style.height) / 2
      gsap.to(ring, { left: bx - 12, top: by - 12, duration: 0.8, ease: 'power3.out' })
    }
  }, [idx])

  if (!MENU_FRAME) return null
  const frame = { ...MENU_FRAME, x: 0, y: 0 }
  return (
    <div ref={root} className="menu" data-open={open} style={{ clipPath: 'circle(0% at 50% 50%)', pointerEvents: 'none' }}>
      <div ref={shaderNode} className="menu-bg" />
      <div ref={stage} className="menu-stage" style={{ transform: `translate(-50%, -50%) scale(${fit})` }}>
        <Node node={{ ...frame, fill: null }} root />
      </div>
    </div>
  )
}

export function Hud({ sections, mobile }) {
  const pos = useSectionPosition(sections)
  const [menu, setMenu] = useState(false)
  const [intro, setIntro] = useState(!!window.__introDone)
  const lastIdx = useRef(0)
  useEffect(() => {
    const f = () => setIntro(true)
    window.addEventListener('noumena:intro', f)
    return () => window.removeEventListener('noumena:intro', f)
  }, [])
  const idx = Math.floor(pos)
  useEffect(() => {
    if (idx !== lastIdx.current) {
      sound.bell(idx, 0.12)
      lastIdx.current = idx
    }
  }, [idx])
  const pastHero = pos > 0.55
  return (
    <>
      <header className="hud-top" data-visible={intro && pastHero}>
        <button className="hud-word" data-cursor="link" onClick={() => travelTo(0)}>NOUMENA</button>
        <div className="hud-right">
          <SoundToggle />
          <button className="hud-menu" data-cursor="link" onClick={() => setMenu(true)}>
            <span className="hm-lines"><i /><i /></span>INDEX
          </button>
        </div>
      </header>
      {!mobile && <DepthGauge pos={pos} sections={sections} visible={intro && pastHero} />}
      {!mobile && <Menu open={menu} onClose={() => setMenu(false)} pos={pos} sections={sections} />}
      <div className="hud-sound-float" data-visible={intro && !pastHero}><SoundToggle /></div>
    </>
  )
}

export { ScrollTrigger }
