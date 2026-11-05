// Renders a resolved MEDEO (.dsai) node tree as DOM/SVG, 1 design px = 1 css px
// inside a scaled stage. Shader fills are handed to the WebGL engine via `onShader`.
import { createElement } from 'react'

const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' }
const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' }

const px = (v) => (typeof v === 'number' ? `${v}px` : v)

function hexToCss(c) {
  if (typeof c !== 'string') return c
  if (!c.startsWith('#')) return c
  let h = c.slice(1)
  if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('')
  if (h.length === 8) {
    const a = parseInt(h.slice(6, 8), 16) / 255
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a.toFixed(3)})`
  }
  return '#' + h
}

function stopsCss(stops) {
  return stops.map(([c, p]) => `${hexToCss(c)} ${(p * 100).toFixed(2)}%`).join(', ')
}

function paintCss(f) {
  if (!f) return null
  if (typeof f === 'string') return { color: hexToCss(f) }
  if (f.visible === false) return null
  switch (f.type) {
    case 'solid': return { color: hexToCss(f.color), opacity: f.opacity }
    case 'linear': return { image: `linear-gradient(${f.angle ?? 180}deg, ${stopsCss(f.stops)})`, opacity: f.opacity }
    case 'radial': {
      const c = f.center || [0.5, 0.5]
      const r = f.radius || [0.5, 0.5]
      return { image: `radial-gradient(${r[0] * 200}% ${r[1] * 200}% at ${c[0] * 100}% ${c[1] * 100}%, ${stopsCss(f.stops)})`, opacity: f.opacity }
    }
    case 'conic': return { image: `conic-gradient(from ${f.angle ?? 0}deg, ${stopsCss(f.stops)})` }
    case 'shader': return { shader: f }
    default: return null
  }
}

function backgroundStyle(fill, st, onShader, node) {
  const fills = Array.isArray(fill) ? fill : fill ? [fill] : []
  const images = []
  let color
  for (const f of fills) {
    const p = paintCss(f)
    if (!p) continue
    if (p.shader) { onShader?.(node, p.shader); continue }
    if (p.image) images.unshift(p.image)
    else if (p.color) {
      if (images.length || color) images.unshift(`linear-gradient(${p.color}, ${p.color})`)
      else color = p.color
    }
  }
  if (color) st.backgroundColor = color
  if (images.length) st.backgroundImage = images.join(', ')
}

function strokeStyle(stroke, st) {
  if (!stroke) return
  const color = hexToCss(typeof stroke.paint === 'string' ? stroke.paint : stroke.paint?.color || '#fff')
  const w = stroke.width ?? 1
  const style = stroke.dash ? 'dashed' : 'solid'
  if (Array.isArray(w)) {
    st.borderTop = `${w[0]}px ${style} ${color}`
    st.borderRight = `${w[1]}px ${style} ${color}`
    st.borderBottom = `${w[2]}px ${style} ${color}`
    st.borderLeft = `${w[3]}px ${style} ${color}`
  } else st.border = `${w}px ${style} ${color}`
}

function fontStyle(n, st) {
  if (n.fontFamily) st.fontFamily = `'${n.fontFamily}'`
  if (n.fontSize) st.fontSize = n.fontSize
  if (n.fontWeight) st.fontWeight = n.fontWeight
  if (n.italic) st.fontStyle = 'italic'
  if (n.letterSpacing != null) st.letterSpacing = px(n.letterSpacing)
  if (n.lineHeight != null) st.lineHeight = n.lineHeight
  if (n.numbers === 'tabular') st.fontVariantNumeric = 'tabular-nums'
  if (n.decoration === 'underline') st.textDecoration = 'underline'
}

function sizeStyle(n, st, parent) {
  const dir = parent?.layout === 'row' ? 'row' : parent?.layout === 'column' ? 'column' : null
  for (const [k, main] of [['width', 'row'], ['height', 'column']]) {
    const v = n[k]
    if (v == null || v === 'hug') continue
    if (v === 'fill') {
      if (dir === main) { st.flex = '1 1 0'; st[k === 'width' ? 'minWidth' : 'minHeight'] = 0 }
      else if (dir) st.alignSelf = 'stretch'
      else st[k] = '100%'
    } else st[k] = v
  }
  for (const k of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']) if (n[k] != null) st[k] = n[k]
}

function positionStyle(n, st, parent) {
  const absolute = !parent || parent.layout == null || parent.layout === 'none' || n.position === 'absolute'
  if (parent && absolute) {
    st.position = 'absolute'
    st.left = n.x || 0
    st.top = n.y || 0
  } else st.position = 'relative'
  const tf = []
  if (n.rotation) tf.push(`rotate(${n.rotation}deg)`)
  if (n.flipX) tf.push('scaleX(-1)')
  if (n.flipY) tf.push('scaleY(-1)')
  if (tf.length) {
    st.transform = tf.join(' ')
    const o = n.transformOrigin || [0.5, 0.5]
    st.transformOrigin = `${o[0] * 100}% ${o[1] * 100}%`
  }
  if (n.opacity != null) st.opacity = n.opacity
  if (n.blend) st.mixBlendMode = n.blend
  if (n.visible === false) st.display = 'none'
  if (n.blur) st.filter = `blur(${n.blur}px)`
}

function radiusStyle(n, st) {
  if (n.radius == null) return
  st.borderRadius = Array.isArray(n.radius) ? n.radius.map(px).join(' ') : n.radius
}

function shadowStyle(n, st) {
  if (!n.shadow) return
  const list = Array.isArray(n.shadow) ? n.shadow : [n.shadow]
  st.boxShadow = list.map((s) => `${s.inset ? 'inset ' : ''}${s.x || 0}px ${s.y || 0}px ${s.blur || 0}px ${s.spread || 0}px ${hexToCss(s.color || '#00000040')}`).join(', ')
}

function withBreaks(str, key) {
  const parts = String(str).split('\n')
  const out = []
  parts.forEach((p, i) => {
    if (i) out.push(createElement('br', { key: `${key}-br${i}` }))
    if (p) out.push(p)
  })
  return out
}

function textContent(n) {
  if (!Array.isArray(n.text)) return withBreaks(n.text, 't')
  const out = []
  n.text.forEach((s, i) => {
    const st = {}
    fontStyle(s, st)
    if (s.fill) st.color = hexToCss(typeof s.fill === 'string' ? s.fill : s.fill.color)
    // split rich spans on newlines so <br> sits between spans (SplitText-friendly)
    const parts = String(s.text).split('\n')
    parts.forEach((p, j) => {
      if (j) out.push(createElement('br', { key: `${i}-br${j}` }))
      if (p) out.push(createElement('span', { key: `${i}-${j}`, style: st, 'data-span': i }, p))
    })
  })
  return out
}

function attrs(n, extra) {
  return { 'data-id': n.id, 'data-name': n.name, ...extra }
}

export function Node({ node: n, parent, onShader, root }) {
  const st = {}
  if (n.type === 'text') {
    positionStyle(n, st, parent)
    fontStyle(n, st)
    if (n.lineHeight == null) st.lineHeight = 1.21
    const fill = typeof n.fill === 'string' ? n.fill : n.fill?.color
    st.color = hexToCss(fill || '#000000')
    if (n.width != null && n.width !== 'hug') {
      sizeStyle(n, st, parent)
      st.whiteSpace = 'normal'
    } else st.whiteSpace = 'nowrap'
    if (n.height != null && typeof n.height === 'number') st.height = n.height
    if (n.textAlign) st.textAlign = n.textAlign
    if (n.maxLines) { st.display = '-webkit-box'; st.WebkitLineClamp = n.maxLines; st.WebkitBoxOrient = 'vertical'; st.overflow = 'hidden' }
    return createElement('div', { className: 'ds-text', style: st, ...attrs(n) }, textContent(n))
  }
  if (n.type === 'vector') {
    positionStyle(n, st, parent)
    st.width = n.width
    st.height = n.height
    st.overflow = 'visible'
    const vb = n.viewBox || [0, 0, n.width, n.height]
    const s = n.stroke
    const pathProps = {
      d: n.path,
      fill: n.fill ? hexToCss(typeof n.fill === 'string' ? n.fill : n.fill.color) : 'none',
      fillRule: n.fillRule,
    }
    if (s) {
      pathProps.stroke = hexToCss(typeof s.paint === 'string' ? s.paint : s.paint?.color)
      pathProps.strokeWidth = typeof s.width === 'number' ? s.width : 1
      if (s.cap) pathProps.strokeLinecap = s.cap
      if (s.join) pathProps.strokeLinejoin = s.join
      if (s.dash) pathProps.strokeDasharray = s.dash.join(' ')
      pathProps.vectorEffect = 'non-scaling-stroke'
    }
    return createElement('svg', { className: 'ds-vector', style: st, viewBox: vb.join(' '), preserveAspectRatio: 'none', ...attrs(n) },
      createElement('path', pathProps))
  }
  if (n.type === 'ellipse') {
    positionStyle(n, st, parent)
    st.width = n.width
    st.height = n.height
    st.borderRadius = '50%'
    st.boxSizing = 'border-box'
    backgroundStyle(n.fill, st)
    strokeStyle(n.stroke, st)
    shadowStyle(n, st)
    return createElement('div', { className: 'ds-ellipse', style: st, ...attrs(n) })
  }
  if (n.type === 'icon') {
    positionStyle(n, st, parent)
    st.width = n.width || 24
    st.height = n.height || 24
    return createElement('div', { className: 'ds-icon', style: st, ...attrs(n) })
  }
  // frame / instance
  if (!root) positionStyle(n, st, parent)
  else { st.position = 'relative' }
  sizeStyle(n, st, parent)
  if (n.layout === 'row' || n.layout === 'column') {
    st.display = 'flex'
    st.flexDirection = n.layout
    if (n.gap) st.gap = n.gap
    if (n.justify) st.justifyContent = JUSTIFY[n.justify]
    st.alignItems = n.align ? ALIGN[n.align] : 'flex-start'
  }
  if (n.padding != null) st.padding = Array.isArray(n.padding) ? n.padding.map(px).join(' ') : n.padding
  st.boxSizing = 'border-box'
  if (n.clip) st.overflow = 'hidden'
  radiusStyle(n, st)
  backgroundStyle(n.fill, st, onShader, n)
  strokeStyle(n.stroke, st)
  shadowStyle(n, st)
  return createElement('div', { className: 'ds-frame', style: st, ...attrs(n) },
    (n.children || []).map((c) => createElement(Node, { key: c.id, node: c, parent: n, onShader })))
}
