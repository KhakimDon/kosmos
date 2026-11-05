// Shared helpers for the S08 observatory plates.
import { gsap } from '../auto.js'

export const NS = 'http://www.w3.org/2000/svg'
export const SCI = '0123456789·×−+ΛΣΩ∆λτ'

export function parsePts(d) {
  return [...String(d).matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]])
}

export function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(e)
  return e
}

/** An absolutely positioned SVG overlay matching a plate's design coordinate system. */
export function overlay(plate, w, h, z = 1) {
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, preserveAspectRatio: 'none' })
  Object.assign(svg.style, { position: 'absolute', left: '0px', top: '0px', overflow: 'visible', pointerEvents: 'none', zIndex: z })
  plate.appendChild(svg)
  return svg
}

/** Mono readout label (absolutely positioned, design px). */
export function monoLabel(plate, { x, y, size = 10, color = 'rgba(238,241,247,0.30)', align = 'left', ls = 1.8 } = {}) {
  const d = document.createElement('div')
  Object.assign(d.style, {
    position: 'absolute', left: `${x}px`, top: `${y}px`, fontFamily: "'JetBrains Mono', monospace", fontSize: `${size}px`,
    letterSpacing: `${ls}px`, color, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none',
    lineHeight: 1.2, zIndex: 2,
  })
  if (align === 'right') d.style.transform = 'translateX(-100%)'
  plate.appendChild(d)
  return d
}

export const q = (root, name) => root.querySelector(`[data-name="${name}"]`)
export const qa = (root, name) => [...root.querySelectorAll(`[data-name="${name}"]`)]

/** Scramble-decode a mono label into its own text. */
export function decode(el, { duration = 1.0, chars = SCI, delay = 0 } = {}) {
  if (!el) return null
  const text = el.dataset.text ?? el.textContent
  el.dataset.text = text
  return gsap.timeline({ delay })
    .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
    .to(el, { duration, scrambleText: { text, chars, revealDelay: 0.2, speed: 0.7 }, ease: 'none' }, 0)
}

export const fmt = (v, d = 2) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d)
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** Linear interpolation of y on a sorted [x,y] list (binary search). */
export function sampler(pts) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return (x) => {
    if (x <= xs[0]) return ys[0]
    const n = xs.length - 1
    if (x >= xs[n]) return ys[n]
    let lo = 0, hi = n
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m }
    const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1)
    return ys[lo] + (ys[hi] - ys[lo]) * t
  }
}
