import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { makeShader } from '../engine/shader.js'
import { sound } from '../engine/sound.js'
import { state } from '../engine/engine.js'

const pad = (n) => String(Math.round(n)).padStart(3, '0')

/**
 * Ignition → Accretion → Event horizon. The aperture opens onto the hero as a real
 * radial mask over this layer; the visitor chooses to enter with or without sound.
 */
export function Loader() {
  const root = useRef(null)
  const canvas = useRef(null)
  const counter = useRef(null)
  const caption = useRef(null)
  const bar = useRef(null)
  const word = useRef(null)
  const [phase, setPhase] = useState('loading') // loading | choose | gone
  const sh = useRef(null)

  useEffect(() => {
    if (new URLSearchParams(location.search).has('nointro')) { setPhase('gone'); return }
    window.__lenis?.stop()
    const renderer = new THREE.WebGLRenderer({ canvas: canvas.current, antialias: false, alpha: false })
    const pr = Math.min(window.devicePixelRatio || 1, 1.5)
    renderer.setPixelRatio(pr)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const s = makeShader('loader-aperture-v4', { u_point: 0, u_ring: 0, u_open: 0, u_stars: 0 })
    sh.current = s
    const U = s.material.uniforms
    let t0 = performance.now()
    let raf
    const size = () => renderer.setSize(window.innerWidth, window.innerHeight, false)
    size()
    window.addEventListener('resize', size)
    const loop = () => {
      const t = (performance.now() - t0) / 1000
      const W = canvas.current.width, H = canvas.current.height
      U.ds_origin.value.set(0, 0)
      for (const n of s.roles.res) U[n].value.set(W, H)
      for (const n of s.roles.time) U[n].value = t
      for (const k in s.u) if (k in U) U[k].value = s.u[k]
      renderer.render(s.scene, cam)
      raf = requestAnimationFrame(loop)
    }
    loop()

    const prog = { v: 0 }
    const show = () => { if (counter.current) counter.current.textContent = pad(prog.v) }
    const ready = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 300)),
    ])
    const tl = gsap.timeline()
    tl.to(s.u, { u_point: 1, duration: 1.4, ease: 'power2.inOut' })
      .fromTo([counter.current?.parentNode, bar.current?.parentNode], { opacity: 0 }, { opacity: 1, duration: 1 }, 0.3)
      .to(prog, { v: 63, duration: 1.8, ease: 'power1.inOut', onUpdate: show }, 1.2)
      .to(s.u, { u_ring: 1, duration: 1.8, ease: 'power3.out' }, 1.4)
      .to(s.u, { u_stars: 1, duration: 2.4, ease: 'power1.out' }, 1.6)
      .to(bar.current, { scaleX: 0.63, duration: 1.8, ease: 'power1.inOut' }, 1.2)
    ready.then(() => {
      tl.then(() => {
        gsap.timeline()
          .to(prog, { v: 100, duration: 0.9, ease: 'power2.out', onUpdate: show })
          .to(bar.current, { scaleX: 1, duration: 0.9, ease: 'power2.out' }, 0)
          .call(() => { if (caption.current) caption.current.textContent = ' / 100 — CHOOSE YOUR ENTRY' })
          .fromTo(word.current, { opacity: 0, letterSpacing: '0.9em', filter: 'blur(12px)' }, { opacity: 1, letterSpacing: '0.42em', filter: 'blur(0px)', duration: 2.2, ease: 'cine' }, 0.2)
          .to(s.u, { u_open: 0.18, duration: 2, ease: 'power2.out' }, 0.2)
          .call(() => setPhase('choose'), null, 0.9)
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
      tl.kill()
      renderer.dispose()
      s.material.dispose()
    }
  }, [])

  const enter = (withSound) => {
    if (phase !== 'choose') return
    setPhase('opening')
    if (withSound) sound.enable()
    const s = sh.current
    const el = root.current
    const m = { r: 0 }
    const setMask = () => {
      const g = `radial-gradient(circle at 50% 50%, transparent ${m.r}vmax, black ${m.r + 6}vmax)`
      el.style.webkitMaskImage = g
      el.style.maskImage = g
    }
    sound.swell(2.6, 0.32)
    gsap.timeline({
      onComplete: () => {
        setPhase('gone')
        window.__lenis?.start()
      },
    })
      .to('.ld-ui', { opacity: 0, y: -10, duration: 0.6, stagger: 0.05, ease: 'power2.in' }, 0)
      .to(s.u, { u_open: 1, duration: 1.6, ease: 'expo.in' }, 0)
      .to(state, { warp: 0.5, duration: 1.0, ease: 'power2.in' }, 0.4)
      .to(m, { r: 120, duration: 1.7, ease: 'expo.in', onUpdate: setMask }, 0.9)
      .call(() => { window.__introDone = true; window.dispatchEvent(new Event('noumena:intro')) }, null, 1.5)
      .to(state, { warp: 0, duration: 1.6, ease: 'power3.out' }, 1.8)
  }

  if (phase === 'gone') return null
  return (
    <div ref={root} className="loader" data-phase={phase}>
      <canvas ref={canvas} className="ld-canvas" />
      <div className="ld-ui ld-top">
        <span className="ld-idx">00</span>
        <span>NOUMENA · INITIALISING THE ORIGIN</span>
      </div>
      <div ref={word} className="ld-word" style={{ opacity: 0 }}>NOUMENA</div>
      <div className="ld-ui ld-count">
        <div className="ld-track"><div ref={bar} className="ld-bar" /></div>
        <div className="ld-num"><span ref={counter}>000</span><span ref={caption} className="ld-cap"> / 100 — CALCULATING THE ORIGIN</span></div>
      </div>
      <div className="ld-ui ld-choose" data-show={phase === 'choose'}>
        <button className="ld-btn" data-cursor="link" onClick={() => enter(true)} onMouseEnter={() => sound.tick()}>
          <span className="ld-dot" /> ENTER WITH SOUND
        </button>
        <button className="ld-btn ld-btn-quiet" data-cursor="link" onClick={() => enter(false)}>
          ENTER IN SILENCE
        </button>
      </div>
    </div>
  )
}
