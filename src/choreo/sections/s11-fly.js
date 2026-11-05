// Shared "return to origin" flight: a 4 s scroll to the very top with a warp
// that swells in the middle of the flight and settles on arrival.
import { gsap, state } from '../auto.js'

let flying = false

export function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function flyToOrigin({ duration = 4, onDone } = {}) {
  const lenis = window.__lenis
  if (flying) return
  flying = true
  const done = () => { flying = false; onDone?.() }
  if (!lenis) { window.scrollTo({ top: 0, behavior: 'smooth' }); done(); return }
  lenis.start()
  if (reducedMotion()) {
    lenis.scrollTo(0, { immediate: true, force: true })
    done()
    return
  }
  gsap.killTweensOf(state, 'warp')
  const w = { v: 0 }
  gsap.timeline()
    .to(w, { v: 1, duration: duration * 0.35, ease: 'power2.in', onUpdate: () => { state.warp = Math.max(state.warp, w.v * 0.9) } })
    .to(w, { v: 0, duration: duration * 0.65, ease: 'power2.out', onUpdate: () => { state.warp = w.v * 0.9 } })
  lenis.scrollTo(0, {
    duration,
    force: true,
    lock: true,
    // slow lift-off, fast cruise, long cinematic settle
    easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    onComplete: () => { state.warp = 0; done() },
  })
}

/** Make a design text node behave like a real button (mouse + keyboard). */
export function asButton(el, label, onActivate) {
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-label', label)
  el.setAttribute('data-cursor', 'link')
  el.style.cursor = 'pointer'
  el.style.pointerEvents = 'auto'
  const click = (e) => { e.preventDefault(); onActivate(e) }
  const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(e) } }
  el.addEventListener('click', click)
  el.addEventListener('keydown', key)
  return () => { el.removeEventListener('click', click); el.removeEventListener('keydown', key) }
}
