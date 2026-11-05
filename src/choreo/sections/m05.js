// M05 — The Cosmic Footer (mobile): RETURN TO ORIGIN flies home with the warp.
import { autoChoreo } from '../auto.js'
import { asButton, flyToOrigin } from './s11-fly.js'

export default function m05(ctx) {
  const off = autoChoreo(ctx)
  const ret = ctx.q('Return')
  const offBtn = ret ? asButton(ret, 'Return to origin', () => flyToOrigin({ duration: 3.2 })) : () => {}
  return () => { off?.(); offBtn() }
}
