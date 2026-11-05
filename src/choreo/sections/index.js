// Per-section choreography registry. Each module exports default (ctx) => cleanup.
// Sections without a module fall back to autoChoreo.
import { autoChoreo } from '../auto.js'

const mods = import.meta.glob('./s*.js', { eager: true })

export function choreoFor(key) {
  const m = mods[`./${key}.js`]
  return m?.default || ((ctx) => autoChoreo(ctx))
}
