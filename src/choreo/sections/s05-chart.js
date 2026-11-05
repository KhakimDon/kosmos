// S05 helpers: geometry of the celestial plate (path parsing, ellipse fits, dome rotation).

/** "M x y L x y ... M ..." → [[ [x,y], ... ], ...] */
export function subpaths(d) {
  return d.split('M').map((s) => s.trim()).filter(Boolean).map((s) => {
    const n = s.replace(/[Lh]/g, ' ').trim().split(/[\s,]+/).map(Number)
    const pts = []
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]])
    return pts
  })
}

/** PCA ellipse fit of a sampled closed curve → { cx, cy, a, b, th } (th in radians, y-down space) */
export function fitEllipse(pts) {
  let cx = 0, cy = 0
  for (const [x, y] of pts) { cx += x; cy += y }
  cx /= pts.length; cy /= pts.length
  let sxx = 0, sxy = 0, syy = 0
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const c = Math.cos(th), s = Math.sin(th)
  let a = 0, b = 0
  for (const [x, y] of pts) {
    const dx = x - cx, dy = y - cy
    a = Math.max(a, Math.abs(dx * c + dy * s))
    b = Math.max(b, Math.abs(-dx * s + dy * c))
  }
  return { cx, cy, a, b, th }
}

export function ellipsePoint(e, phi, out = [0, 0]) {
  const u = e.a * Math.cos(phi), v = e.b * Math.sin(phi)
  const c = Math.cos(e.th), s = Math.sin(e.th)
  out[0] = e.cx + u * c - v * s
  out[1] = e.cy + u * s + v * c
  return out
}

/** param angle + normalised radius of a point relative to an ellipse */
export function ellipseParam(e, x, y) {
  const c = Math.cos(e.th), s = Math.sin(e.th)
  const dx = x - e.cx, dy = y - e.cy
  const u = (dx * c + dy * s) / e.a, v = (-dx * s + dy * c) / e.b
  return { phi: Math.atan2(v, u), r: Math.hypot(u, v) }
}

/** Replace a multi-subpath <path> with one <path> per subpath (same paint). */
export function splitPath(svg) {
  const all = svg.querySelectorAll('path')
  if (all.length > 1) return [...all] // already split (re-mount)
  const src = all[0]
  const parts = src.getAttribute('d').split(/(?=M)/).map((s) => s.trim()).filter(Boolean)
  const out = parts.map((d) => {
    const p = src.cloneNode(false)
    p.setAttribute('d', d)
    svg.appendChild(p)
    return p
  })
  src.remove()
  return out
}

/** rotation of a point (design px, y down) around the pole by `deg` (clockwise on screen) */
export function rot(pole, deg, x, y, out = [0, 0]) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r), s = Math.sin(r)
  const dx = x - pole.x, dy = y - pole.y
  out[0] = pole.x + dx * c - dy * s
  out[1] = pole.y + dx * s + dy * c
  return out
}

export function reticleD(x, y, h, arm, ang = 0) {
  // four corner brackets around (x,y), half-size h, rotated by ang (rad)
  const c = Math.cos(ang), s = Math.sin(ang)
  const P = (px, py) => `${(x + px * c - py * s).toFixed(2)} ${(y + px * s + py * c).toFixed(2)}`
  let d = ''
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    d += `M${P(sx * h, sy * h + -sy * arm)} L${P(sx * h, sy * h)} L${P(sx * h + -sx * arm, sy * h)} `
  }
  return d
}

/** leader polyline from a star to a caption anchored at big {x,y,side} */
export function leaderD(star, big, off) {
  const yl = big.y + 8
  const dir = big.side === 'l' ? -1 : 1
  const vy = yl < star.y ? -1 : 1
  const sx = star.x + dir * off, sy = star.y + vy * off
  const dy = Math.abs(sy - yl)
  const mx = sx + dir * dy
  const ex = big.side === 'l' ? big.x + 332 : big.x - 12
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} L${mx.toFixed(1)} ${yl.toFixed(1)} L${ex.toFixed(1)} ${yl.toFixed(1)}`
}
