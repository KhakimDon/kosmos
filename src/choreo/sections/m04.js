// M04 — The Final Portal (mobile). Same ending as desktop S11: tap ENTER, the portal
// swells until it swallows the screen, whiteout, the message from beyond, flight home.
import { autoChoreo, gsap } from '../auto.js'
import { createEnding } from './s11-ending.js'
import { asButton } from './s11-fly.js'

export default function m04(ctx) {
  const { view } = ctx
  const u = ctx.u || {}
  const R0 = u.u_R ?? 150
  const L0 = u.u_lens ?? 0
  const P = { hover: 0, hoverT: 0, dive: 0, streak: 0, open: 1, rim: 1, ending: false, leaving: false, focusY: 360 }
  const off = autoChoreo(ctx, { zoomFrom: 1.02, zoomTo: 1.1, shift: 0.02, mouse: 0 })
  const ending = createEnding(ctx, P)
  const cta = ctx.q('CTA')
  const offBtn = cta ? asButton(cta, 'Enter the Noumenon', () => ending.enter()) : () => {}
  if (cta) {
    cta.style.position = cta.style.position || 'absolute'
    const st = document.createElement('style')
    st.textContent = '#m04 [data-name="CTA"]::before{content:"";position:absolute;inset:-18px 40px}'
    document.head.appendChild(st)
    ctx._st = st
  }
  // portal response: open + dive grow the ring until the void fills the phone
  const prevFrame = view?.onFrame
  if (view) {
    view.onFrame = (v, st, dt, rect) => {
      prevFrame?.(v, st, dt, rect)
      const grow = (P.open - 1) * 0.35 + P.dive * P.dive * 9
      u.u_R = R0 * (1 + grow)
      if ('u_lens' in u) u.u_lens = L0 + P.dive * 0.6
      if (P.dive > 0) v.zoom = (v.zoom || 1) * (1 + P.dive * 0.4)
    }
  }
  return () => {
    off?.()
    offBtn()
    ending.destroy()
    ctx._st?.remove()
    gsap.killTweensOf(P)
  }
}
