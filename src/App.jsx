import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SECTIONS, MOBILE } from './sections.js'
import { engine, state } from './engine/engine.js'
import { Section } from './components/Section.jsx'
import { choreoFor } from './choreo/sections/index.js'
import { Hud } from './components/Hud.jsx'
import { Loader } from './components/Loader.jsx'
import { Cursor } from './components/Cursor.jsx'

gsap.registerPlugin(ScrollTrigger)

let lenis = null

function useStageScale(designWidth) {
  useLayoutEffect(() => {
    const set = () => document.documentElement.style.setProperty('--s', String(window.innerWidth / designWidth))
    set()
    window.addEventListener('resize', set)
    return () => window.removeEventListener('resize', set)
  }, [designWidth])
}

export default function App() {
  const back = useRef(null)
  const front = useRef(null)
  const [mobile] = useState(() => window.innerWidth < 760)
  const list = mobile ? MOBILE : SECTIONS
  const designWidth = mobile ? 390 : 1440
  useStageScale(designWidth)

  useLayoutEffect(() => {
    engine.init(back.current, front.current)
  }, [])

  useEffect(() => {
    history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, touchMultiplier: 1.4 })
    window.__lenis = lenis
    lenis.on('scroll', (l) => {
      state.scroll = l.scroll
      state.velocity = l.velocity
      state.progress = l.progress
      ScrollTrigger.update()
    })
    const tick = (time, dt) => {
      lenis.raf(time * 1000)
      engine.render(Math.min(dt / 1000, 0.05))
    }
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    const move = (e) => { state.mouse.x = e.clientX; state.mouse.y = e.clientY }
    const down = () => { state.mouse.down = true }
    const up = () => { state.mouse.down = false }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    const onResize = () => ScrollTrigger.refresh()
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    // hero navigation → journey travel
    const NAV = { 'Link Origin': 's01', 'Link Systems': 's05', 'Link Research': 's08', 'Link Portal': 's11', Enter: 's01', 'Scroll cue': 's01' }
    const hero = document.getElementById('s00')
    const navClick = (e) => {
      const t = e.target.closest('[data-name]')
      const n = t && Object.keys(NAV).find((k) => t.closest(`[data-name="${k}"]`))
      if (n) window.__travelTo?.(NAV[n])
    }
    hero?.addEventListener('click', navClick)
    Object.keys(NAV).forEach((k) => {
      const el = hero?.querySelector(`[data-name="${k}"]`)
      if (el) { el.dataset.cursor = 'link'; el.style.cursor = 'pointer'; el.style.pointerEvents = 'auto' }
    })
    if (new URLSearchParams(location.search).has('nointro')) {
      setTimeout(() => { window.__introDone = true; window.dispatchEvent(new Event('noumena:intro')) }, 200)
    }
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <>
      <canvas ref={back} className="gl gl-back" />
      <main className="journey">
        {list.map((s, i) => (
          <Section key={s.key} id={s.key} index={i} frame={s.frame} designWidth={designWidth} choreo={choreoFor(s.key)} />
        ))}
      </main>
      <canvas ref={front} className="gl gl-front" />
      <Hud sections={list} mobile={mobile} />
      <Loader />
      <Cursor />
    </>
  )
}
