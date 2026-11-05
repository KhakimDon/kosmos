import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { state } from '../engine/engine.js'
import { sound } from '../engine/sound.js'

/**
 * Instrument cursor: a 6px ring that lags with inertia; over links it opens with a
 * crosshair, over celestial objects it becomes a reticle with a mono readout.
 * Elements opt in with data-cursor="link" | "object" and data-cursor-label="…".
 */
export function Cursor() {
  const ring = useRef(null)
  const dot = useRef(null)
  const label = useRef(null)
  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches) return
    document.documentElement.classList.add('has-cursor')
    const pos = { x: state.mouse.x, y: state.mouse.y }
    let mode = 'default'
    let last = null
    const setMode = (m, text) => {
      if (m === mode && text === label.current.dataset.text) return
      mode = m
      ring.current.dataset.mode = m
      if (text !== label.current.dataset.text) {
        label.current.dataset.text = text || ''
        gsap.killTweensOf(label.current)
        if (text) gsap.to(label.current, { duration: 0.6, scrambleText: { text, chars: '01░▒<>/—·', speed: 0.8 } })
        else label.current.textContent = ''
      }
      if (m !== 'default') sound.tick()
    }
    const resolve = (target) => {
      const t = target?.closest?.('[data-cursor], a, button') || null
      if (t === last) return
      last = t
      if (!t) return setMode('default', '')
      setMode(t.dataset.cursor || 'link', t.dataset.cursorLabel || '')
    }
    const over = (e) => {
      const t = e.target.closest?.('[data-cursor], a, button')
      if (t === last) return
      last = t
      if (!t) return setMode('default', '')
      const m = t.dataset.cursor || 'link'
      setMode(m, t.dataset.cursorLabel || '')
    }
    // content scrolls under a resting pointer: re-hit-test so the mode/label never goes stale
    let lastScroll = state.scroll, frame = 0, flip = false
    const tick = () => {
      if (++frame % 6 === 0 && Math.abs(state.scroll - lastScroll) > 2) {
        lastScroll = state.scroll
        resolve(document.elementFromPoint(state.mouse.x, state.mouse.y))
      }
      const f = state.mouse.x > window.innerWidth - 260
      if (f !== flip) { flip = f; label.current.classList.toggle('flip', f) }
      const k = 1 - Math.pow(0.0001, state.dt)
      pos.x += (state.mouse.x - pos.x) * k
      pos.y += (state.mouse.y - pos.y) * k
      ring.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      dot.current.style.transform = `translate3d(${state.mouse.x}px, ${state.mouse.y}px, 0)`
      const v = Math.min(Math.abs(state.svel) * 0.012, 0.6)
      ring.current.style.setProperty('--stretch', String(1 + v))
    }
    gsap.ticker.add(tick)
    window.addEventListener('pointerover', over)
    const down = () => ring.current.classList.add('down')
    const up = () => ring.current.classList.remove('down')
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    const leave = () => { ring.current.style.opacity = 0; dot.current.style.opacity = 0 }
    const enter = () => { ring.current.style.opacity = 1; dot.current.style.opacity = 1 }
    document.addEventListener('pointerleave', leave)
    document.addEventListener('pointerenter', enter)
    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('pointerover', over)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.removeEventListener('pointerleave', leave)
      document.removeEventListener('pointerenter', enter)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [])
  return (
    <>
      <div ref={ring} className="cur-ring" data-mode="default">
        <span className="cur-circle" />
        <span className="cur-cross cur-h" />
        <span className="cur-cross cur-v" />
        <span className="cur-tick t1" /><span className="cur-tick t2" /><span className="cur-tick t3" /><span className="cur-tick t4" />
        <span ref={label} className="cur-label" />
      </div>
      <div ref={dot} className="cur-dot" />
    </>
  )
}
