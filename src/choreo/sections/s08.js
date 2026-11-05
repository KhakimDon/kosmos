// S08 — The Technology. Three observatory plates that are live instruments:
// VIII-a chirp (acquisition pen, living waveform, scan cursor with h / f / t − tc),
// VIII-b absorption spectrum (slit-scan exposure, scintillation, cursor = Doppler shift),
// VIII-c transit (orrery schematic in sync with a marker falling into the dip).
// Each plate develops on its own when it reaches the viewport.
import { autoChoreo, gsap, ScrollTrigger, state } from '../auto.js'
import { q, decode } from './s08-util.js'
import { buildChirp } from './s08-chirp.js'
import { buildSpectrum } from './s08-spectrum.js'
import { buildTransit } from './s08-transit.js'

const ROMAN = 'IVXLΛ·-.0123456789'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ·—/'

export default function s08(ctx) {
  const { el } = ctx
  const plates = {
    a: ctx.q('PL. VIII-a — Chirp'),
    b: ctx.q('PL. VIII-b — Spectrum'),
    c: ctx.q('PL. VIII-c — Transit'),
  }
  Object.values(plates).forEach((p) => p?.setAttribute('data-noauto', ''))

  const stripView = ctx.views.find((v) => v.name === 'Spectral strip')
  if (stripView) stripView.enabled = false

  const chirp = plates.a ? buildChirp(plates.a) : null
  const spec = plates.b ? buildSpectrum(plates.b, stripView) : null
  const transit = plates.c ? buildTransit(plates.c) : null

  const autoClean = autoChoreo(ctx, { zoomFrom: 1.02, zoomTo: 1.08, mouse: 0.6 })

  // ---- per-plate development
  const handled = new Set([
    'Plate number', 'Plate title', 'Plate meta',
    'Perception caption', 'Perception value', 'Inference caption', 'Inference value',
    'Merger caption', 'Merger value', 'Ringdown caption', 'Ringdown value',
    'LANGUAGE line', 'LANGUAGE λ', 'VISION line', 'VISION λ', 'CAUSALITY line', 'CAUSALITY λ',
  ])
  const triggers = []
  const tls = []
  const develop = (plate, specific) => {
    if (!plate) return
    const tl = gsap.timeline({ paused: true })
    tl.fromTo(plate, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'cine' }, 0)
    const rule = q(plate, 'Header rule')
    if (rule) tl.fromTo(rule, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.6, ease: 'cine' }, 0.25)
    tl.add(decode(q(plate, 'Plate number'), { duration: 1.5, chars: ROMAN }), 0.15)
    tl.add(decode(q(plate, 'Plate title'), { duration: 1.3, chars: UPPER }), 0.35)
    tl.add(decode(q(plate, 'Plate meta'), { duration: 1.1, chars: UPPER }), 0.5)
    // instrument line work
    const strokes = [...plate.querySelectorAll('.ds-vector')].filter((v) => /^(Zero line|Envelope|Axes|λ axis|Model fit)$/.test(v.dataset.name))
    strokes.forEach((v, i) => tl.fromTo(v.querySelector('path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: v.dataset.name === 'Envelope' ? 3.2 : 1.8, ease: 'power2.inOut' }, 0.4 + i * 0.12))
    // scale labels and captions
    const texts = [...plate.querySelectorAll('.ds-text')].filter((t) => !handled.has(t.dataset.name))
    texts.forEach((t, i) => tl.add(decode(t, { duration: 0.6 + Math.min(t.textContent.length, 60) * 0.012 }), 0.7 + Math.min(i * 0.035, 0.9)))
    texts.forEach((t) => gsap.set(t, { opacity: 0 }))
    tl.progress(0.0001).pause()
    specific(tl)
    tls.push(tl)
    triggers.push(ScrollTrigger.create({ trigger: plate, start: 'top 78%', once: true, onEnter: () => tl.play() }))
  }
  // plate frames start hidden
  Object.values(plates).forEach((p) => p && gsap.set(p, { clipPath: 'inset(0% 0% 100% 0%)' }))

  develop(plates.a, (tl) => chirp?.acquire(tl, 1.1))
  develop(plates.b, (tl) => {
    tl.call(() => { if (stripView) stripView.enabled = true }, null, 0.6)
    spec?.expose(tl, 0.8)
  })
  develop(plates.c, (tl) => transit?.enter(tl, 0.7))

  ctx.onFrame = (v, s, dt) => {
    const t = s.time
    chirp?.frame(t, dt)
    spec?.frame(t, dt, s.mouse)
    transit?.frame(t, dt)
  }

  return () => {
    ctx.onFrame = null
    autoClean?.()
    triggers.forEach((t) => t.kill())
    tls.forEach((t) => t.kill())
    chirp?.cleanup(); spec?.cleanup(); transit?.cleanup()
    if (stripView) stripView.enabled = true
    void state
  }
}
