// The journey's metadata: one entry per section (distance from the Origin in light-years).
export const JOURNEY = [
  { idx: '00', name: 'PROLOGUE', ly: 0, dist: '—' },
  { idx: '01', name: 'THE ORIGIN', ly: 1, dist: '0 LY' },
  { idx: '02', name: 'ENTER THE UNKNOWN', ly: 4.2e3, dist: '4.2 × 10³ LY' },
  { idx: '03', name: 'THE DIGITAL CIVILIZATION', ly: 1.1e4, dist: '1.1 × 10⁴ LY' },
  { idx: '04', name: 'THE INTELLIGENCE CORE', ly: 3.6e4, dist: '3.6 × 10⁴ LY' },
  { idx: '05', name: 'THE CONSTELLATION', ly: 8.0e4, dist: '8.0 × 10⁴ LY' },
  { idx: '06', name: 'THE INFINITE SYSTEM', ly: 2.4e5, dist: '2.4 × 10⁵ LY' },
  { idx: '07', name: 'BEYOND HUMAN IMAGINATION', ly: 5e5, dist: '∞ / UNDEFINED', undefinedDist: true },
  { idx: '08', name: 'THE TECHNOLOGY', ly: 9.1e5, dist: '9.1 × 10⁵ LY' },
  { idx: '09', name: 'THE EXPANSION', ly: 2.5e6, dist: '2.5 × 10⁶ LY' },
  { idx: '10', name: 'THE FUTURE', ly: 1.3e8, dist: '1.3 × 10⁸ LY' },
  { idx: '11', name: 'THE FINAL PORTAL', ly: 4.6e10, dist: '4.6 × 10¹⁰ LY' },
  { idx: '12', name: 'THE EDGE', ly: 9.3e10, dist: 'THE EDGE' },
]

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
export function sci(ly) {
  if (ly < 1) return '0 LY'
  if (ly < 1000) return `${Math.round(ly)} LY`
  const e = Math.floor(Math.log10(ly))
  const m = ly / Math.pow(10, e)
  return `${m.toFixed(1)} × 10${String(e).split('').map((c) => SUP[c]).join('')} LY`
}

/** Continuous distance for a fractional section position (log interpolation). */
export function lyAt(pos) {
  const i = Math.max(0, Math.min(JOURNEY.length - 1, Math.floor(pos)))
  const j = Math.min(JOURNEY.length - 1, i + 1)
  const f = Math.max(0, Math.min(1, pos - i))
  const a = Math.log10(Math.max(JOURNEY[i].ly, 1))
  const b = Math.log10(Math.max(JOURNEY[j].ly, 1))
  return Math.pow(10, a + (b - a) * f) * (JOURNEY[i].ly === 0 && f === 0 ? 0 : 1)
}
