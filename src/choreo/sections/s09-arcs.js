// S09 helper: split the MEDEO reach-arc vectors into per-segment paths that draw
// outward from the origin as deep time passes.
const SVGNS = 'http://www.w3.org/2000/svg'

export function parsePts(d) {
  // absolute M/L polylines only (MEDEO export)
  const subs = []
  for (const chunk of d.split('M').map((c) => c.trim()).filter(Boolean)) {
    const nums = chunk.replace(/L/g, ' ').trim().split(/[\s,]+/).map(Number)
    const pts = []
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
    if (pts.length > 1) subs.push(pts)
  }
  return subs
}

/** svgs: svg.ds-vector elements; tAt(x,y) -> arrival log-time. Returns { update(T), restore() } */
export function buildArcs(svgs, tAt) {
  const segs = []
  const originals = []
  for (const svg of svgs) {
    const base = svg.querySelector('path')
    if (!base) continue
    const d0 = base.getAttribute('d')
    originals.push({ svg, base, d0 })
    for (let pts of parsePts(d0)) {
      let t0 = tAt(...pts[0]), t1 = tAt(...pts[pts.length - 1])
      if (t1 < t0) { pts = pts.slice().reverse(); [t0, t1] = [t1, t0] }
      const p = document.createElementNS(SVGNS, 'path')
      for (const a of ['stroke', 'stroke-width', 'stroke-linecap', 'fill']) {
        const v = base.getAttribute(a); if (v != null) p.setAttribute(a, v)
      }
      p.setAttribute('d', 'M' + pts.map((q) => q[0] + ' ' + q[1]).join(' L'))
      p.setAttribute('data-s09', '')
      svg.appendChild(p)
      const len = p.getTotalLength() + 1
      p.style.strokeDasharray = `${len} ${len}`
      p.style.strokeDashoffset = `${len}`
      segs.push({ p, len, t0, t1: Math.max(t1, t0 + 0.05), last: -1 })
    }
    base.style.display = 'none'
  }
  return {
    update(T) {
      for (const s of segs) {
        const k = Math.max(0, Math.min(1, (T - s.t0) / (s.t1 - s.t0)))
        if (Math.abs(k - s.last) < 0.0005) continue
        s.last = k
        s.p.style.strokeDashoffset = `${s.len * (1 - k)}`
      }
    },
    restore() {
      segs.forEach((s) => s.p.remove())
      originals.forEach((o) => { o.base.style.display = '' })
    },
  }
}
