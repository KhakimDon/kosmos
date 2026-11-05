// S04 — The Intelligence Core: a live 3D armillary of thought (see s04-armillary.js).
import * as THREE from 'three'
import { autoChoreo, gsap } from '../auto.js'
import { engine } from '../../engine/engine.js'
import { Armillary, DIST } from './s04-armillary.js'

const CX = 772, CY = 628 // design centre of the instrument
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export default function s04(ctx) {
  const { el } = ctx
  const arm = new Armillary()

  // ---- DOM: hide the static armillary drawing, keep (and re-attach) the labels
  const armFrame = ctx.q('Armillary')
  const hidden = [...armFrame.querySelectorAll('.ds-vector, .ds-ellipse')].filter((n) => n.dataset.name !== 'Centre reticle')
  hidden.forEach((n) => { n.style.visibility = 'hidden'; n.setAttribute('data-noauto', '') })
  const reticle = ctx.q('Centre reticle')
  reticle.setAttribute('data-noauto', '')
  reticle.style.opacity = 0
  const dialLabels = [['Dial 0', 0], ['Dial 90', 90], ['Dial 270', 270]].map(([name, a]) => {
    const n = ctx.q(name)
    const x0 = parseFloat(n.style.left) + 18, y0 = parseFloat(n.style.top) + 6
    return { n, a, x0, y0 }
  })
  const leaders = [1, 2, 3].map((i) => {
    const anchor = ctx.q(`Anchor ${i}`)
    const lead = ctx.q(`Leader ${i}`)
    const path = lead.querySelector('path')
    const d = path.getAttribute('d')
    const nums = d.match(/-?\d+\.?\d*/g).map(Number)
    anchor.setAttribute('data-noauto', '')
    lead.setAttribute('data-noauto', '')
    anchor.style.opacity = 0
    lead.style.opacity = 0
    return {
      anchor, lead, path,
      ax: nums[0], ay: nums[1], ly: nums[3], // design anchor + label row
      x0: parseFloat(anchor.style.left) + 4, y0: parseFloat(anchor.style.top) + 4,
      node: null, vis: 0, want: 1, cooldown: 0,
    }
  })

  // ---- the 3D view
  const view = ctx.view
  view.scene3d = arm.scene
  view.overflow3d = true
  ctx.el.dataset.cursor = "drag"
  ctx.el.dataset.cursorLabel = "DRAG TO ROTATE THE CORE"
  view.camera3d = arm.camera

  const show = { centre: 0, leaders: 0, signals: 0 }
  const mouse = { x: -9999, y: -9999 }
  const drag = { on: false, x: 0, y: 0, vx: 0, vy: 0 }
  let beatPrev = 0
  let ready = false
  const P = { dt: 0, unfold: 0, flat: 0, hoverX: 0, hoverY: 0, svel: 0, beat: 0, beatOnset: false, centre: 0, signals: 0 }
  const tmp = { x: 0, y: 0 }
  const tmpV = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const dq = new THREE.Quaternion()

  ctx.onFrame = (v, st, dt, rect, p) => {
    dt = Math.min(dt, 1 / 20)
    const s = rect.width / 1440
    // camera dolly follows the shader push-in so glow and instrument stay locked together
    arm.camera.aspect = rect.width / rect.height
    arm.camera.position.z = DIST / (v.zoom || 1)
    arm.camera.updateProjectionMatrix()
    const zs = s * (v.zoom || 1)
    const flat = smooth(0.58, 0.93, p)
    arm.root.position.set(CX - 720 + v.shiftX / zs, 650 - CY - v.shiftY / zs + flat * flat * 520, 0)

    // gyroscope: drag spin with inertia
    if (!drag.on) { drag.vx *= Math.exp(-dt * 1.4); drag.vy *= Math.exp(-dt * 1.4) }
    const w = Math.hypot(drag.vx, drag.vy)
    if (w > 1e-5) {
      axis.set(drag.vy, drag.vx, 0).normalize()
      dq.setFromAxisAngle(axis, w * dt)
      arm.qDragT.premultiply(dq)
    }

    // heartbeat (lub-dub)
    const ph = st.time % 1.7
    const beat = Math.exp(-(((ph - 0.05) / 0.07) ** 2)) + 0.55 * Math.exp(-(((ph - 0.3) / 0.08) ** 2))
    P.beatOnset = ph < beatPrev
    beatPrev = ph
    P.dt = dt
    P.beat = beat * show.centre
    P.unfold = smooth(0.3, 0.62, p)
    P.flat = flat
    P.hoverX = st.mouse.snx
    P.hoverY = st.mouse.sny
    P.svel = st.svel
    P.centre = show.centre
    P.signals = show.signals
    ctx.u.u_amt = 0.5 + 0.06 * P.beat

    // pointer → section px for node glow
    arm.ptU.u_dpr.value = engine.pr || 1
    arm.ptU.u_view.value.set(rect.width, rect.height)
    arm.ptU.u_mouse.value.set(mouse.x - rect.left, mouse.y - rect.top)
    arm.ptU.u_hover.value = 1 - flat

    if (!ready) {
      ready = true
      // in the assembled pose: the single gold node sits where the design puts it,
      // and each leader starts on the node nearest its design anchor
      arm.atRest(P, () => {
        arm.setGold(nearest(1049, 513, (n) => n.a < 6 && n.f > 0.1))
        const used = new Set()
        for (const L of leaders) {
          L.node = nearest(L.ax, L.ay, (n) => !n.gold && !used.has(n) && n.f > 0.2)
          used.add(L.node)
        }
      })
    }
    arm.update(P)
    arm.root.updateMatrixWorld()
    arm.camera.updateMatrixWorld()

    // ---- re-attach DOM labels to the moving instrument (design px)
    arm.toDesign(tmpV.set(0, 0, 0), tmp)
    reticle.style.transform = `translate(${(tmp.x - CX).toFixed(2)}px, ${(tmp.y - CY).toFixed(2)}px)`
    reticle.style.opacity = 0.6 * show.centre * (1 - flat)
    for (const L of dialLabels) {
      arm.toDesign(arm.dialPoint(L.a, 548, tmpV), tmp)
      L.n.style.transform = `translate(${(tmp.x - L.x0).toFixed(2)}px, ${(tmp.y - L.y0).toFixed(2)}px)`
    }
    updateLeaders(dt, flat)
  }

  function nearest(x, y, ok) {
    let best = null, bd = 1e9
    for (const n of arm.nodes) {
      if (!ok(n)) continue
      arm.toDesign(n.pos, tmp)
      const d = Math.hypot(tmp.x - x, tmp.y - y)
      if (d < bd) { bd = d; best = n }
    }
    return best
  }

  function updateLeaders(dt, flat) {
    const used = new Set(leaders.map((l) => l.node))
    for (const L of leaders) {
      L.cooldown -= dt
      const n = L.node
      // a node that turned away (or drifted far from its label) hands the leader to a fresh one
      if (n) {
        arm.toDesign(n.pos, tmp)
        const far = Math.hypot(tmp.x - L.ax, tmp.y - L.ay) > 300
        if ((n.f < 0.05 || far || n.vis < 0.5) && L.cooldown <= 0) L.want = 0
      }
      if (!n || (L.want === 0 && L.vis < 0.02)) {
        let best = null, bd = 1e9
        for (const c of arm.nodes) {
          if (used.has(c) || c.gold || c.f < 0.3 || c.vis < 0.9) continue
          arm.toDesign(c.pos, tmp)
          const d = Math.hypot(tmp.x - L.ax, tmp.y - L.ay) - c.f * 60
          if (d < bd) { bd = d; best = c }
        }
        if (best) { used.delete(L.node); L.node = best; used.add(best); L.want = 1; L.cooldown = 2.5 }
      }
      L.vis += (L.want - L.vis) * (1 - Math.exp(-dt * (L.want ? 3 : 7)))
      const o = L.vis * show.leaders * (1 - flat)
      L.lead.style.opacity = (0.55 * o).toFixed(3)
      L.anchor.style.opacity = (0.9 * o).toFixed(3)
      if (L.node && o > 0.001) {
        arm.toDesign(L.node.pos, tmp)
        L.anchor.style.transform = `translate(${(tmp.x - L.x0).toFixed(2)}px, ${(tmp.y - L.y0).toFixed(2)}px)`
        // leader leaves the ring of the anchor (4px), elbows at x=1260 on the label row
        const dx = 1260 - tmp.x, dy = L.ly - tmp.y
        const k = 4 / Math.max(1, Math.hypot(dx, dy))
        L.path.setAttribute('d', `M${(tmp.x + dx * k).toFixed(1)} ${(tmp.y + dy * k).toFixed(1)} L1260 ${L.ly} L1290 ${L.ly}`)
      }
    }
  }

  // ---- cursor: drag = gyroscopic spin with inertia
  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.on = true; drag.x = e.clientX; drag.y = e.clientY
    el.style.userSelect = 'none'
  }
  const onMove = (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY
    if (!drag.on) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    drag.x = e.clientX; drag.y = e.clientY
    const k = 0.0045 * 60
    drag.vx = drag.vx * 0.6 + dx * k * 0.4
    drag.vy = drag.vy * 0.6 + dy * k * 0.4
  }
  const onUp = () => {
    if (!drag.on) return
    drag.on = false
    el.style.userSelect = ''
  }
  const onLeave = () => { mouse.x = -9999; mouse.y = -9999 }
  el.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerup', onUp)
  el.addEventListener('pointerleave', onLeave)

  const cleanupAuto = autoChoreo(ctx, { zoomFrom: 0.95, zoomTo: 1.09 })

  // ---- assembly: every great circle draws itself, settling into its own tilt
  const enter = ctx.enter
  enter.to(arm, { dialDraw: 1, duration: 3.2, ease: 'power2.inOut' }, 0)
  enter.to(show, { centre: 1, duration: 1.4, ease: 'power2.out' }, 0.1)
  const order = [...arm.rings].sort((a, b) => b.s - a.s || a.i - b.i) // inner shell first
  order.forEach((r, k) => {
    const at = 0.25 + k * 0.13 + (2 - r.s) * 0.05
    enter.to(r, { draw: 1, duration: 2.1 + r.s * 0.35, ease: 'power2.inOut' }, at)
    enter.to(r, { settle: 1, duration: 3.2, ease: 'cine' }, at)
  })
  enter.to(show, { leaders: 1, duration: 1.2, ease: 'power1.out' }, 2.9)
  enter.to(show, { signals: 1, duration: 0.1 }, 3.0)

  return () => {
    cleanupAuto()
    el.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointerleave', onLeave)
    ctx.onFrame = null
    view.scene3d = null
    view.camera3d = null
    arm.dispose()
  }
}
