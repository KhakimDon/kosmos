// PL. VIII-a — the chirp. The design waveform is decomposed into an analytic signal
// (phase from its zero crossings, amplitude from its half-cycle peaks) so it can be
// re-synthesised every frame: drawn in by an acquisition pen, then kept alive with a
// slow phase sway over faint detector noise. A scan cursor reads h, f and t − tc.
import { gsap } from '../auto.js'
import { parsePts, svgEl, overlay, monoLabel, q, decode, fmt, clamp } from './s08-util.js'

const Y0 = 300 // zero line
const UNIT = 150 // px per 1.0 h
const X0 = 96, X1 = 1240
const TX = (x) => -0.30 + ((x - X0) / 158.9) * 0.05 // t − tc [s]

function analyse(pts) {
  const xs = pts.map((p) => p[0])
  const h = pts.map((p) => Y0 - p[1])
  // half-cycle boundaries
  const b = [xs[0]]
  let last = Math.sign(h[0]) || 1
  let lastI = 0
  for (let i = 1; i < h.length; i++) {
    const s = Math.sign(h[i])
    if (!s) continue
    if (s !== last) {
      const a = h[lastI], c = h[i]
      const x = xs[lastI] + (xs[i] - xs[lastI]) * (a / (a - c))
      if (x - b[b.length - 1] > 0.6) b.push(x)
      last = s
    }
    lastI = i
  }
  b.push(xs[xs.length - 1] + 0.01)
  // per half-cycle peak amplitude, centred
  const segA = []
  const segM = []
  let j = 0
  let peak = 0
  for (let i = 0; i < xs.length; i++) {
    while (j < b.length - 2 && xs[i] >= b[j + 1]) { segA.push(peak); segM.push((b[j] + b[j + 1]) / 2); peak = 0; j++ }
    peak = Math.max(peak, Math.abs(h[i]))
  }
  segA.push(peak); segM.push((b[j] + b[j + 1]) / 2)
  return { b, segA, segM, xs, h }
}

export function buildChirp(plate) {
  const early = q(plate, 'Waveform — early')
  const late = q(plate, 'Waveform — late')
  const pts = parsePts(early.querySelector('path').getAttribute('d'))
    .concat(parsePts(late.querySelector('path').getAttribute('d')).slice(1))
  const { b, segA, segM } = analyse(pts)
  const SPLIT = 731.7

  // render grid (denser where the chirp is fast)
  const gx = []
  for (let x = X0; x < 700; x += 0.9) gx.push(x)
  for (let x = 700; x <= X1; x += 0.45) gx.push(x)
  const N = gx.length
  const PH = new Float32Array(N), AM = new Float32Array(N), FQ = new Float32Array(N)
  const evalAt = (x) => {
    let k = 0
    let lo = 0, hi = b.length - 1
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m] <= x) lo = m; else hi = m }
    k = lo
    const w = b[k + 1] - b[k]
    const ph = Math.PI * (k + clamp((x - b[k]) / w, 0, 1))
    // amplitude: interpolate between half-cycle centres
    let a
    if (x <= segM[0]) a = segA[0]
    else if (x >= segM[segM.length - 1]) a = segA[segA.length - 1]
    else {
      let i = k
      if (x < segM[i]) i--
      i = clamp(i, 0, segM.length - 2)
      const t = (x - segM[i]) / (segM[i + 1] - segM[i])
      a = segA[i] + (segA[i + 1] - segA[i]) * t
    }
    const halfT = (w / 158.9) * 0.05
    return [ph, a, 1 / (2 * halfT)]
  }
  for (let i = 0; i < N; i++) { const r = evalAt(gx[i]); PH[i] = r[0]; AM[i] = r[1]; FQ[i] = r[2] }

  // hide the static design traces, draw our own
  early.style.visibility = 'hidden'
  late.style.visibility = 'hidden'
  const svg = overlay(plate, 1312, 560)
  const defs = svgEl('defs', {}, svg)
  const grad = svgEl('linearGradient', { id: 's08-cur', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 120, x2: 0, y2: 490 }, defs)
  svgEl('stop', { offset: '0', 'stop-color': '#7FD8FF', 'stop-opacity': 0 }, grad)
  svgEl('stop', { offset: '0.18', 'stop-color': '#7FD8FF', 'stop-opacity': 0.55 }, grad)
  svgEl('stop', { offset: '0.82', 'stop-color': '#7FD8FF', 'stop-opacity': 0.55 }, grad)
  svgEl('stop', { offset: '1', 'stop-color': '#7FD8FF', 'stop-opacity': 0.05 }, grad)
  const glow = svgEl('radialGradient', { id: 's08-pen' }, defs)
  svgEl('stop', { offset: '0', 'stop-color': '#BFEAFF', 'stop-opacity': 0.9 }, glow)
  svgEl('stop', { offset: '1', 'stop-color': '#7FD8FF', 'stop-opacity': 0 }, glow)

  const ns = { fill: 'none', 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }
  const pData = svgEl('path', { ...ns, stroke: '#AEB6C8', 'stroke-width': 0.6, opacity: 0.16 }, svg)
  const pEarly = svgEl('path', { ...ns, stroke: '#AEB6C8', 'stroke-width': 1, opacity: 0.75 }, svg)
  const pLate = svgEl('path', { ...ns, stroke: '#EEF1F7', 'stroke-width': 1.1 }, svg)
  const cur = svgEl('g', { opacity: 0 }, svg)
  const cLine = svgEl('line', { x1: 0, x2: 0, y1: 120, y2: 490, stroke: 'url(#s08-cur)', 'stroke-width': 0.75, 'vector-effect': 'non-scaling-stroke' }, cur)
  const cTick = svgEl('line', { x1: 0, x2: 0, y1: 486, y2: 498, stroke: '#7FD8FF', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, cur)
  const cRing = svgEl('circle', { r: 6, fill: 'none', stroke: '#7FD8FF', 'stroke-width': 0.75, opacity: 0.6, 'vector-effect': 'non-scaling-stroke' }, cur)
  const cDot = svgEl('circle', { r: 2.2, fill: '#BFEAFF' }, cur)
  const pen = svgEl('g', { opacity: 0 }, svg)
  const penGlow = svgEl('circle', { r: 14, fill: 'url(#s08-pen)', opacity: 0.55 }, pen)
  const penDot = svgEl('circle', { r: 2.2, fill: '#EEF1F7' }, pen)

  const rTop = monoLabel(plate, { x: 0, y: 124, color: 'rgba(191,234,255,0.85)' })
  rTop.style.opacity = 0
  const rv = []
  for (const [k, sep] of [['t − tc ', '   '], ['h ', '   '], ['f ', '']]) {
    const lab = document.createElement('span'); lab.textContent = k; lab.style.opacity = 0.45; rTop.appendChild(lab)
    const v = document.createElement('span'); rTop.appendChild(v); rv.push(v)
    if (sep) rTop.appendChild(document.createTextNode(sep))
  }

  // annotations
  const mk = (key, leader) => {
    const point = q(plate, `${key} point`), ring = q(plate, `${key} ring`)
    const cy = parseFloat(point.style.top) + parseFloat(point.style.height) / 2
    const cx = parseFloat(point.style.left) + parseFloat(point.style.width) / 2
    let gi = 0
    while (gi < N - 1 && gx[gi] < cx) gi++
    return { key, x: cx, cy, gi, point, ring, cap: q(plate, `${key} caption`), val: q(plate, `${key} value`), leader, lp: 0, hp: 0, shown: false,
      setP: gsap.quickSetter(point, 'y', 'px'), setR: gsap.quickSetter(ring, 'y', 'px') }
  }
  const annos = [
    mk('Perception', { from: 253.8, to: 98 }),
    mk('Inference', { from: 245.0, to: 98 }),
    mk('Merger', { from: 144.8, to: 98, h: 1191.4 }),
    mk('Ringdown', { from: 373.3, to: 444 }),
  ]
  const leaders = q(plate, 'Leaders').querySelector('path')
  annos.forEach((a) => {
    gsap.set([a.point, a.ring], { opacity: 0, scale: 0 })
    gsap.set([a.cap, a.val], { opacity: 0 })
  })

  const S = { rev: X0, revOn: false, sway: 0, cx: X0, cOp: 0, mode: 'off', autoT: 0, hoverX: null, prevCx: X0, done: false, dataOp: 0 }

  function revealAnno(a) {
    if (a.shown) return
    a.shown = true
    gsap.to(a.point, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(2.2)' })
    gsap.fromTo(a.ring, { opacity: 0, scale: 3 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'cine' })
    gsap.to(a, { lp: 1, duration: 0.9, ease: 'power2.inOut' })
    if (a.leader.h) gsap.to(a, { hp: 1, duration: 0.7, ease: 'power2.out', delay: 0.75 })
    decode(a.cap, { duration: 0.9, delay: a.leader.h ? 0.6 : 0.45, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ=·' })
    decode(a.val, { duration: 1.1, delay: a.leader.h ? 0.8 : 0.65 })
  }
  function ping(a) {
    gsap.fromTo(a.ring, { scale: 2.6, opacity: 0.25 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'cine', overwrite: 'auto' })
    gsap.fromTo(a.val, { color: '#BFEAFF' }, { color: 'rgba(238,241,247,0.302)', duration: 1.8, ease: 'power2.out', overwrite: 'auto' })
  }

  /** Acquisition: the pen draws the signal, annotations appear as it passes. */
  function acquire(tl, at = 0) {
    tl.call(() => { S.revOn = true; S.mode = 'off' }, null, at)
    tl.to(pen, { attr: { opacity: 1 }, duration: 0.3 }, at)
    tl.to(S, { rev: X1, duration: 4.6, ease: 'sine.inOut' }, at)
    tl.to(S, { dataOp: 1, duration: 2.5, ease: 'power1.in' }, at + 0.5)
    tl.to(pen, { attr: { opacity: 0 }, duration: 0.5 }, at + 4.4)
    tl.call(() => { S.done = true; S.mode = 'auto'; S.autoT = -0.6 }, null, at + 4.7)
    tl.to(S, { sway: 1, duration: 3, ease: 'sine.inOut' }, at + 3.5)
  }

  const onMove = (e) => {
    const r = plate.getBoundingClientRect()
    S.hoverX = ((e.clientX - r.left) / r.width) * 1312
  }
  const onLeave = () => { S.hoverX = null; S.autoT = Math.max(0, (S.cx - X0) / (X1 - X0)) * 9 }
  plate.addEventListener('pointermove', onMove)
  plate.addEventListener('pointerleave', onLeave)

  const bufE = [], bufL = [], bufD = []
  function frame(t, dt) {
    const sway = S.sway
    const rev = S.revOn ? S.rev : X0 - 1
    bufE.length = 0; bufL.length = 0; bufD.length = 0
    let lastY = Y0
    let lastX = X0
    const live = (i, x) => {
      const d = 0.34 * sway * Math.sin(t * 0.85 - x * 0.0042)
      const a = AM[i] * (1 + 0.04 * sway * Math.sin(t * 1.3 - x * 0.011))
      return a * Math.sin(PH[i] + d)
    }
    for (let i = 0; i < N; i++) {
      const x = gx[i]
      if (x > rev) break
      const y = Y0 - live(i, x)
      const s = `${x.toFixed(1)} ${y.toFixed(1)}`
      if (x <= 731.7) bufE.push(s)
      if (x >= 731.2) bufL.push(s)
      lastY = y; lastX = x
      if ((i & 3) === 0) {
        const n = 5.5 * (0.5 * Math.sin(x * 0.21 + t * 3.1) + 0.35 * Math.sin(x * 0.137 - t * 2.3) + 0.4 * Math.sin(x * 0.071 + t * 1.7) + 0.22 * Math.sin(x * 0.53 - t * 4.7))
        bufD.push(`${x.toFixed(1)} ${(y + n).toFixed(1)}`)
      }
    }
    pEarly.setAttribute('d', bufE.length > 1 ? 'M' + bufE.join('L') : '')
    pLate.setAttribute('d', bufL.length > 1 ? 'M' + bufL.join('L') : '')
    pData.setAttribute('d', bufD.length > 1 ? 'M' + bufD.join('L') : '')
    pData.setAttribute('opacity', (0.16 * S.dataOp).toFixed(3))
    if (S.revOn && !S.done) {
      penGlow.setAttribute('cx', lastX); penGlow.setAttribute('cy', lastY)
      penDot.setAttribute('cx', lastX); penDot.setAttribute('cy', lastY)
    }

    // annotations ride the live curve
    let ld = ''
    for (const a of annos) {
      if (!a.shown && S.revOn && rev >= a.x) revealAnno(a)
      const yl = Y0 - live(a.gi, a.x)
      const dy = yl - a.cy
      a.setP(dy); a.setR(dy)
      if (a.lp > 0.001) {
        const y0 = a.leader.from + dy
        const y1 = y0 + (a.leader.to - y0) * a.lp
        ld += `M${a.x.toFixed(1)} ${y0.toFixed(1)} L${a.x.toFixed(1)} ${y1.toFixed(1)} `
        if (a.leader.h && a.hp > 0.001) ld += `M${a.x.toFixed(1)} ${a.leader.to} L${(a.x + (a.leader.h - a.x) * a.hp).toFixed(1)} ${a.leader.to} `
      }
    }
    leaders.setAttribute('d', ld || 'M0 0')

    // scan cursor
    let target = S.cx, op = 0
    if (S.mode === 'auto' || S.hoverX != null) {
      if (S.hoverX != null && S.done) {
        target = clamp(S.hoverX, X0, X1)
        S.cx += (target - S.cx) * (1 - Math.pow(0.0005, dt))
        op = 1
      } else if (S.mode === 'auto') {
        S.autoT += dt
        const T = 9, hold = 1.6
        const ph = ((S.autoT % (T + hold)) + T + hold) % (T + hold)
        const u = ph / T
        S.cx = X0 + (X1 - X0) * clamp(u, 0, 1)
        op = u > 1 ? 0 : clamp(u * 12, 0, 1) * clamp((1 - u) * 12, 0, 1)
      }
    }
    S.cOp += (op - S.cOp) * (1 - Math.pow(0.002, dt))
    cur.setAttribute('opacity', S.cOp.toFixed(3))
    rTop.style.opacity = S.cOp.toFixed(3)
    if (S.cOp > 0.01) {
      const x = S.cx
      let i = 0
      let lo = 0, hi = N - 1
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (gx[m] <= x) lo = m; else hi = m }
      i = lo
      const hv = live(i, x)
      const y = Y0 - hv
      const xs = x.toFixed(1)
      cLine.setAttribute('x1', xs); cLine.setAttribute('x2', xs)
      cTick.setAttribute('x1', xs); cTick.setAttribute('x2', xs)
      cDot.setAttribute('cx', xs); cDot.setAttribute('cy', y.toFixed(1))
      cRing.setAttribute('cx', xs); cRing.setAttribute('cy', y.toFixed(1))
      const flip = x > 960
      const tx = TX(x)
      const f = x > 1060 ? 251 : FQ[i]
      rv[0].textContent = `${fmt(tx, 3)} s`
      rv[1].textContent = fmt(hv / UNIT, 2)
      rv[2].textContent = `${Math.round(f).toString().padStart(3, '\u2007')} Hz`
      rTop.style.left = `${x + (flip ? -10 : 10)}px`
      rTop.style.transform = flip ? 'translateX(-100%)' : ''
      // annotations ping as the scan passes
      if (S.done) for (const a of annos) if ((S.prevCx - a.x) * (x - a.x) < 0 && Math.abs(S.prevCx - x) < 200) ping(a)
      S.prevCx = x
    }
  }

  return {
    acquire, frame,
    cleanup() {
      plate.removeEventListener('pointermove', onMove)
      plate.removeEventListener('pointerleave', onLeave)
      svg.remove(); rTop.remove()
      early.style.visibility = ''; late.style.visibility = ''
    },
  }
}
