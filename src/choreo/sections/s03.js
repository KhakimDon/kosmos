// S03 — The Digital Civilization.
// The planet rises into frame as the section arrives, its ring tilting open; the globe turns slowly
// so the circuit-city lights flow across the night side; districts boot up one by one on entry;
// data packets race around the ring segment by segment; the cursor nudges light and ring.
// The three mono statistics count up with tabular figures.
import { autoChoreo, gsap, ScrollTrigger } from '../auto.js'
import { makeShader } from '../../engine/shader.js'

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('')
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x) }
const FIG = ' ' // figure space: same advance as a digit

function swapShader(view, name, extra = {}) {
  const old = view.shader
  const ov = { ...old.u }
  for (const [k, uu] of Object.entries(old.material.uniforms)) {
    if (uu.value && uu.value.isVector3) ov[k] = [uu.value.x, uu.value.y, uu.value.z]
  }
  Object.assign(ov, extra)
  const sh = makeShader(name, ov, { transparent: !!old.material.transparent })
  view.shader = sh
  old.material.dispose()
  return sh
}

// "4.1 × 10⁹ MINDS ONLINE" etc. → spans with a live number
function buildStat(el, spec) {
  el.textContent = ''
  el.style.fontVariantNumeric = 'tabular-nums'
  const parts = spec.parts.map((p) => {
    const s = document.createElement('span')
    s.textContent = p.text
    if (p.num) s.style.color = 'rgba(238,241,247,0.95)'
    el.appendChild(s)
    return s
  })
  return parts
}

export default function s03(ctx) {
  const { el, view } = ctx
  const kills = []
  const U = swapShader(view, 'civ-planet-live', { u_boot: 0 }).u
  const base = { cy: U.u_cy, e: U.u_ringE, roll: U.u_roll, city: U.u_city }

  const caption = ctx.q('Caption')
  caption?.setAttribute('data-noauto', '')

  // ---------- per-frame shader drive (autoChoreo camera calls ctx.onFrame) ----------
  let t = 0
  let ps = 0
  ctx.onFrame = (v, st, dt, rect, p) => {
    t += dt
    ps += (p - ps) * Math.min(1, dt * 4)
    // rise: from below the frame to its design seat as the section covers the screen
    const rise = smooth((ps + 0.1) / 0.42) // already cresting when the section label arrives — no dead frame at the seam
    U.u_cy = base.cy - 0.22 * (1 - rise) + 0.035 * smooth((ps - 0.46) / 0.54)
    // ring opens: edge-on → design tilt → a little more as we pass
    const open = smooth((ps - 0.05) / 0.5)
    U.u_ringE = -0.045 + (base.e + 0.045) * open - 0.05 * smooth((ps - 0.55) / 0.45) - st.mouse.sny * 0.025
    U.u_roll = base.roll + st.mouse.snx * 0.05 + (ps - 0.5) * 0.06
    U.u_zoom = v.zoom
    U.u_shy = v.shiftY / rect.height
    U.u_lx = st.mouse.snx * 0.16
    U.u_ly = -st.mouse.sny * 0.12
    // spin + packets; scroll speed lends a little momentum
    const sv = Math.min(Math.abs(st.svel), 60)
    U.u_rot += dt * (0.022 + sv * 0.0012)
    U.u_pkt -= dt * (0.32 + sv * 0.01)
  }
  const auto = autoChoreo(ctx, { zoomFrom: 1.02, zoomTo: 1.12 })

  // ---------- city boot on entry ----------
  const bootTw = gsap.to(U, { u_boot: 1, duration: 4.2, ease: 'power1.inOut', paused: true })
  kills.push(ScrollTrigger.create({ trigger: el, start: 'top 55%', onEnter: () => bootTw.play() }))

  // ---------- statistics ----------
  const specs = [
    {
      el: ctx.q('Stat minds'),
      parts: [{ text: '0.0', num: true }, { text: '\u00a0×\u00a010' }, { text: sup(0), num: true }, { text: '\u00a0' }, { text: 'MINDS ONLINE' }],
      run: (s, k) => {
        s[0].textContent = (4.1 * k).toFixed(1)
        s[2].textContent = sup(Math.round(9 * Math.min(1, k * 1.15)))
      },
      words: [4],
    },
    {
      el: ctx.q('Stat latency'),
      parts: [{ text: '480.0', num: true }, { text: '\u00a0' }, { text: 'MS PLANETARY LATENCY' }],
      run: (s, k) => {
        const v = 0.3 + (480 - 0.3) * Math.pow(1 - k, 3)
        s[0].textContent = v.toFixed(1).padStart(5, FIG)
      },
      words: [2],
    },
    {
      el: ctx.q('Stat ring'),
      parts: [{ text: 'ORBITAL RING:' }, { text: '\u00a0' }, { text: '0', num: true }, { text: '\u00a0' }, { text: 'KM' }],
      run: (s, k) => {
        const v = Math.round((212000 * k) / 100) * 100
        s[2].textContent = v.toLocaleString('en-US').padStart(7, FIG)
      },
      words: [0, 4],
    },
  ].filter((s) => s.el)
  const statTl = gsap.timeline({ paused: true })
  const rule = ctx.q('Caption rule')
  if (rule) gsap.killTweensOf(rule)
  if (rule) statTl.fromTo(rule, { scaleX: 0, transformOrigin: '100% 50%' }, { scaleX: 1, duration: 1.4, ease: 'cine' }, 0)
  specs.forEach((sp, i) => {
    sp.spans = buildStat(sp.el, sp)
    sp.run(sp.spans, 0)
    gsap.set(sp.el, { opacity: 0 })
    const at = 0.25 + i * 0.28
    statTl.to(sp.el, { opacity: 1, duration: 0.4 }, at)
    sp.words.forEach((wi) => {
      const w = sp.spans[wi]
      statTl.fromTo(w, { textContent: '' }, { duration: 0.9, scrambleText: { text: w.textContent, chars: '01<>/—·×', speed: 0.7, revealDelay: 0.15 }, ease: 'none' }, at)
    })
    const o = { k: 0 }
    statTl.to(o, { k: 1, duration: 2.6, ease: 'expo.out', onUpdate: () => sp.run(sp.spans, o.k) }, at + 0.1)
  })
  // the final tick lands: a brief brighten of the figures
  statTl.add(() => specs.forEach((sp) => sp.spans.filter((s, i) => sp.parts[i].num).forEach((s) => {
    gsap.fromTo(s, { textShadow: '0 0 10px rgba(127,216,255,0.9)' }, { textShadow: '0 0 0px rgba(127,216,255,0)', duration: 1.2, ease: 'power2.out' })
  })), '>-1.4')
  kills.push(ScrollTrigger.create({ trigger: caption || el, start: 'top 92%', onEnter: () => statTl.play() }))

  return () => {
    ctx.onFrame = null
    kills.forEach((k) => k.kill())
    bootTw.kill(); statTl.kill()
    auto?.()
  }
}
