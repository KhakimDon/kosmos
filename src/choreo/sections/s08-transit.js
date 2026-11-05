// PL. VIII-c — transit light curve. A small orrery schematic (limb-darkened star, inclined
// orbit, planet) runs in sync with a marker that travels the model fit: when the planet
// crosses the disc, the marker falls into the dip and the star itself dims.
import { gsap } from '../auto.js'
import { parsePts, sampler, svgEl, overlay, monoLabel, q, decode, clamp } from './s08-util.js'

const PX0 = 64, PX1 = 496, BASE = 104, BOTTOM = 200 // plot geometry (design px)
const XC = 288.6 // mid-transit
const SX = 122, SY = 166, SR = 16 // star schematic
const RP = 3.2
const A = 42, B = 8, TILT = -0.12 // orbit

export function buildTransit(plate) {
  const fitV = q(plate, 'Model fit')
  const fitPath = fitV.querySelector('path')
  const pts = parsePts(fitPath.getAttribute('d'))
  const yAt = sampler(pts)
  const obs = [...plate.querySelectorAll('[data-name^="Obs "]')]
  gsap.set(obs, { opacity: 0, scale: 0 })

  const svg = overlay(plate, 520, 350)
  const defs = svgEl('defs', {}, svg)
  const sg = svgEl('radialGradient', { id: 's08-star', cx: '50%', cy: '50%', r: '50%' }, defs)
  svgEl('stop', { offset: '0', 'stop-color': '#F4F6FB', 'stop-opacity': 0.8 }, sg)
  svgEl('stop', { offset: '0.6', 'stop-color': '#C9D0DE', 'stop-opacity': 0.55 }, sg)
  svgEl('stop', { offset: '0.92', 'stop-color': '#AEB6C8', 'stop-opacity': 0.3 }, sg)
  svgEl('stop', { offset: '1', 'stop-color': '#AEB6C8', 'stop-opacity': 0.0 }, sg)
  const hg = svgEl('radialGradient', { id: 's08-halo', cx: '50%', cy: '50%', r: '50%' }, defs)
  svgEl('stop', { offset: '0', 'stop-color': '#9FB4E0', 'stop-opacity': 0.12 }, hg)
  svgEl('stop', { offset: '1', 'stop-color': '#9FB4E0', 'stop-opacity': 0 }, hg)

  const sys = svgEl('g', { opacity: 0 }, svg)
  const rot = `rotate(${(TILT * 180) / Math.PI} ${SX} ${SY})`
  const ns = { fill: 'none', 'vector-effect': 'non-scaling-stroke' }
  // back half of the orbit (behind the star), star, front half, planet
  svgEl('path', { ...ns, d: `M${SX - A} ${SY} A${A} ${B} 0 0 1 ${SX + A} ${SY}`, stroke: '#AEB6C8', 'stroke-width': 0.5, opacity: 0.28, 'stroke-dasharray': '1.5 3', transform: rot }, sys)
  const halo = svgEl('circle', { cx: SX, cy: SY, r: SR * 2.4, fill: 'url(#s08-halo)' }, sys)
  const planetBack = svgEl('circle', { r: RP * 0.85, fill: '#AEB6C8', opacity: 0.5 }, sys)
  const star = svgEl('circle', { cx: SX, cy: SY, r: SR, fill: 'url(#s08-star)' }, sys)
  svgEl('path', { ...ns, d: `M${SX - A} ${SY} A${A} ${B} 0 0 0 ${SX + A} ${SY}`, stroke: '#AEB6C8', 'stroke-width': 0.6, opacity: 0.5, transform: rot }, sys)
  const planet = svgEl('circle', { r: RP, fill: '#070B1C', stroke: '#C9D0DE', 'stroke-width': 0.7, 'vector-effect': 'non-scaling-stroke' }, sys)
  const sysCap = monoLabel(plate, { x: SX, y: SY + SR + 14, size: 9, ls: 1.6, color: 'rgba(238,241,247,0.30)' })
  sysCap.style.transform = 'translateX(-50%)'
  sysCap.textContent = 'b 0.21 · i 88.7°'
  sysCap.style.opacity = 0

  // marker travelling the fit
  const mk = svgEl('g', { opacity: 0 }, svg)
  const mLine = svgEl('line', { y1: 84, y2: 252, stroke: '#7FD8FF', 'stroke-width': 0.5, opacity: 0.35, 'vector-effect': 'non-scaling-stroke' }, mk)
  const mRing = svgEl('circle', { r: 5, fill: 'none', stroke: '#7FD8FF', 'stroke-width': 0.75, opacity: 0.7, 'vector-effect': 'non-scaling-stroke' }, mk)
  const mDot = svgEl('circle', { r: 2, fill: '#BFEAFF' }, mk)
  // the traced part of the fit, brighter
  const trace = svgEl('path', { ...ns, stroke: '#EEF1F7', 'stroke-width': 1, opacity: 0.85, 'stroke-linejoin': 'round' }, svg)
  const fx = []
  for (let x = PX0; x <= PX1; x += 1.5) fx.push(x)

  const S = { on: false, t: 0, sys: 0, mk: 0 }
  const FRONT = 5.6, BACK = 2.6
  const uC = (XC - PX0) / (PX1 - PX0)
  // half-angle such that the disc crossing lines up with ingress→egress in the plot
  const K = Math.asin(clamp((SR + RP) / A, 0, 1)) / (((362.1 - 215.2) / 2 / (PX1 - PX0)) * Math.PI)

  function enter(tl, at = 0) {
    tl.to(obs, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out', stagger: { each: 0.012, from: 'start' } }, at + 0.3)
    tl.to(S, { sys: 1, duration: 1.6, ease: 'power2.out' }, at + 1.2)
    tl.add(decode(sysCap, { duration: 1.0 }) || gsap.timeline(), at + 1.6)
    tl.call(() => { S.on = true; S.t = 0 }, null, at + 2.0)
  }

  function frame(t, dt) {
    sys.setAttribute('opacity', S.sys.toFixed(3))
    if (!S.on) { mk.setAttribute('opacity', 0); trace.setAttribute('d', ''); placePlanet(-Math.PI / 2 * 1.1, 1); return }
    S.t = (S.t + dt) % (FRONT + BACK)
    let theta, u = -1
    if (S.t < FRONT) {
      u = S.t / FRONT
      theta = Math.PI * (u - uC) * K
    } else {
      const v = (S.t - FRONT) / BACK
      // the far side of the orbit, quicker (schematic)
      const th0 = Math.PI * (1 - uC) * K, th1 = Math.PI * (-uC) * K + Math.PI * 2
      theta = th0 + (th1 - th0) * v
    }
    const F = placePlanet(theta, u)
    // marker on the curve (only during the front pass = the plotted phase window)
    if (u >= 0) {
      const x = PX0 + u * (PX1 - PX0)
      const y = yAt(x)
      const xs = x.toFixed(1), ys = y.toFixed(1)
      mLine.setAttribute('x1', xs); mLine.setAttribute('x2', xs)
      mRing.setAttribute('cx', xs); mRing.setAttribute('cy', ys)
      mDot.setAttribute('cx', xs); mDot.setAttribute('cy', ys)
      const fade = clamp(u * 14, 0, 1) * clamp((1 - u) * 14, 0, 1)
      S.mk += (fade - S.mk) * 0.3
      let d = ''
      for (let i = 0; i < fx.length && fx[i] <= x; i++) d += (i ? 'L' : 'M') + fx[i].toFixed(1) + ' ' + yAt(fx[i]).toFixed(1)
      trace.setAttribute('d', d)
      trace.setAttribute('opacity', (0.85 * fade).toFixed(3))
    } else {
      S.mk += (0 - S.mk) * 0.2
      trace.setAttribute('opacity', 0)
    }
    mk.setAttribute('opacity', S.mk.toFixed(3))
    void F
  }

  // planet at orbital angle theta (0 = mid-transit, front). Returns the relative flux 0..1 dimming.
  function placePlanet(theta, u) {
    const lx = A * Math.sin(theta), ly = B * Math.cos(theta)
    const c = Math.cos(TILT), s = Math.sin(TILT)
    const px = SX + lx * c - ly * s, py = SY + lx * s + ly * c
    const front = Math.cos(theta) > 0
    const onDisc = Math.hypot(px - SX, py - SY) < SR + RP
    planet.setAttribute('cx', px.toFixed(2)); planet.setAttribute('cy', py.toFixed(2))
    planetBack.setAttribute('cx', px.toFixed(2)); planetBack.setAttribute('cy', py.toFixed(2))
    planet.setAttribute('opacity', front ? 1 : 0)
    planetBack.setAttribute('opacity', !front && !onDisc ? 0.5 : 0)
    // the star dims with the light curve (exaggerated so the eye can read it)
    let dim = 0
    if (u >= 0) dim = clamp((yAt(PX0 + u * (PX1 - PX0)) - BASE) / (BOTTOM - BASE), 0, 1)
    star.setAttribute('opacity', (1 - dim * 0.28).toFixed(3))
    halo.setAttribute('opacity', (1 - dim * 0.5).toFixed(3))
    return dim
  }

  return {
    enter, frame,
    cleanup() { svg.remove(); sysCap.remove() },
  }
}
