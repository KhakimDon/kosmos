// PL. VIII-b — absorption spectrum. The spectrum is exposed by a slit scan, then lives:
// the strip scintillates, and the cursor X acts as a radial velocity — every absorption
// line is Doppler-shifted by λ·z (larger at the red end), in the shader, the flux profile,
// the line labels (their λ values update) and a z / v readout.
import { gsap } from '../auto.js'
import { makeShader } from '../../engine/shader.js'
import { parsePts, sampler, monoLabel, q, decode, fmt } from './s08-util.js'

const L0 = 3800, L1 = 7000, PX0 = 24, PW = 712
const xToLam = (x) => L0 + ((x - PX0) / PW) * (L1 - L0)
const lamToX = (l) => PX0 + ((l - L0) / (L1 - L0)) * PW
const C = 299792

export function buildSpectrum(plate, stripView) {
  const prof = q(plate, 'Flux profile')
  const ppath = prof.querySelector('path')
  const pts = parsePts(ppath.getAttribute('d'))
  const yAt = sampler(pts)
  const gx = pts.map((p) => p[0])
  const leaders = q(plate, 'Line leaders').querySelector('path')
  const lines = [
    { name: 'LANGUAGE', lam: 4638, lx: 210.5 },
    { name: 'VISION', lam: 5570, lx: 417.7 },
    { name: 'CAUSALITY', lam: 6171, lx: 551.6 },
  ].map((l) => ({ ...l, cap: q(plate, `${l.name} line`), val: q(plate, `${l.name} λ`), shown: false }))
  lines.forEach((l) => gsap.set([l.cap, l.val], { opacity: 0 }))

  // live shader on the strip
  let orig = null, live = null
  if (stripView) {
    orig = stripView.shader
    live = makeShader('tech-spectrum-live', {})
    stripView.shader = live
    live.u.u_reveal = 0
  }

  const readout = monoLabel(plate, { x: 24, y: 292, size: 10, color: 'rgba(238,241,247,0.30)' })
  readout.style.opacity = 0
  const roText = (z) => `REDSHIFT  z ${fmt(z, 5)}   ·   RADIAL VELOCITY ${fmt(z * C, 0)} KM/S`
  readout.textContent = roText(0)
  let roLast = ''

  const S = { r: 0, z: 0, zLast: 1, on: false, ro: 0 }
  prof.style.clipPath = 'inset(-20px 100% -20px -20px)'

  function expose(tl, at = 0) {
    tl.call(() => { S.on = true }, null, at)
    tl.to(S, { r: 1, duration: 2.8, ease: 'power2.inOut' }, at)
    tl.to(S, { ro: 1, duration: 1.2 }, at + 2.4)
    tl.add(decode(readout, { duration: 1.0 }) || gsap.timeline(), at + 2.4)
  }

  function frame(t, dt, mouse) {
    // redshift from the cursor: right = receding (red), left = approaching (blue)
    const zt = mouse.snx * 0.005 + 0.0006 * Math.sin(t * 0.37)
    S.z += (zt - S.z) * (1 - Math.pow(0.02, dt))
    const z = S.z
    if (live) { live.u.u_z = z; live.u.u_reveal = S.r }
    prof.style.clipPath = `inset(-20px ${(760 - (PX0 + PW * S.r) + (S.r > 0.999 ? -20 : 0)).toFixed(1)}px -20px -20px)`

    if (Math.abs(z - S.zLast) > 2e-6) {
      S.zLast = z
      const out = []
      for (let i = 0; i < gx.length; i++) {
        const x = gx[i]
        const xr = lamToX(xToLam(x) / (1 + z))
        out.push(`${x.toFixed(1)} ${yAt(xr).toFixed(2)}`)
      }
      ppath.setAttribute('d', 'M' + out.join('L'))
      let ld = ''
      for (const l of lines) {
        const dx = lamToX(l.lam * (1 + z)) - lamToX(l.lam)
        l.cap.style.translate = `${dx.toFixed(2)}px 0`
        l.val.style.translate = `${dx.toFixed(2)}px 0`
        if (l.live) l.val.textContent = `λ${Math.round(l.lam * (1 + z))}`
        ld += `M${(l.lx + dx).toFixed(2)} 76 L${(l.lx + dx).toFixed(2)} 94 `
      }
      leaders.setAttribute('d', ld)
    }
    if (S.ro > 0.99) {
      const s = roText(z)
      if (s !== roLast) { readout.textContent = s; roLast = s }
    }
    readout.style.opacity = S.ro.toFixed(3)
    // labels decode as the scan passes them
    for (const l of lines) {
      if (!l.shown && S.on && PX0 + PW * S.r >= l.lx - 4) {
        l.shown = true
        decode(l.cap, { duration: 0.8, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' })
        decode(l.val, { duration: 1.0, delay: 0.15 })?.eventCallback('onComplete', () => { l.live = true; S.zLast = 1 })
      }
    }
  }

  return {
    expose, frame,
    cleanup() {
      if (stripView && orig) { stripView.shader = orig; live.material.dispose() }
      readout.remove()
      prof.style.clipPath = ''
    },
  }
}
