import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import design from './design/design.json'
import { engine, state } from './engine/engine.js'
import { Section } from './components/Section.jsx'
import { choreoFor } from './choreo/sections/index.js'
import { Hud } from './components/Hud.jsx'

gsap.registerPlugin(ScrollTrigger)

export const SECTIONS = Object.keys(design)
  .filter((k) => /^S\d\d/.test(k))
  .sort()
  .map((k) => ({ key: 's' + k.slice(1, 3), name: k, frame: design[k] }))

export const MOBILE = (design['M — Mobile Journey']?.children || []).map((f, i) => ({ key: 'm' + String(i).padStart(2, '0'), name: f.name, frame: f }))

export let lenis = null

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
    </>
  )
}
