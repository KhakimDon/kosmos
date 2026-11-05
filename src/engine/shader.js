import * as THREE from 'three'

const sources = import.meta.glob('../shaders/*.glsl', { query: '?raw', import: 'default', eager: true })

export function getSource(name) {
  const s = sources[`../shaders/${name}.glsl`]
  if (!s) throw new Error(`shader not found: ${name}`)
  return s
}

export function hexToVec3(h) {
  h = String(h).replace('#', '')
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
  return new THREE.Vector3(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

// Parses `/** @tag ... */ uniform type name;` blocks (MEDEO shader convention).
export function parseUniforms(src) {
  const re = /(\/\*\*([\s\S]*?)\*\/\s*)?uniform\s+(\w+)\s+(\w+)\s*;/g
  const list = []
  let m
  while ((m = re.exec(src))) {
    const doc = m[2] || ''
    const tags = {}
    for (const t of doc.matchAll(/@(\w+)([^@]*)/g)) tags[t[1]] = t[2].replace(/\*\/?/g, '').trim()
    list.push({ type: m[3], name: m[4], tags })
  }
  return list
}

function toValue(type, v) {
  if (type === 'vec3' || type === 'vec4') {
    if (typeof v === 'string' && v.startsWith('#')) return hexToVec3(v)
    if (Array.isArray(v)) return new THREE.Vector3(...v)
    return new THREE.Vector3()
  }
  if (type === 'vec2') return Array.isArray(v) ? new THREE.Vector2(...v) : new THREE.Vector2()
  if (type === 'float' || type === 'int') {
    const n = typeof v === 'number' ? v : parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  if (type === 'bool') return !!v
  return v
}

const VERT = /* glsl */ `
attribute vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const geo = new THREE.BufferGeometry()
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))

/**
 * Builds a fullscreen-triangle mesh for a MEDEO shader. Returns
 * { mesh, material, roles: {res, time, mouse}, u } where `u` is a plain object of
 * the numeric/color uniforms that animations (GSAP) can tween; the engine syncs it each frame.
 */
export function makeShader(name, overrides = {}, { transparent = false } = {}) {
  let src = getSource(name)
  const info = parseUniforms(src)
  src = src
    .replace(/\bgl_FragCoord\b/g, 'ds_FragCoord')
    .replace(/void\s+main\s*\(\s*(void)?\s*\)/, 'void ds_main()')
  src =
    'precision highp float;\nuniform vec2 ds_origin;\nuniform float ds_top;\nuniform float ds_feather;\nvec4 ds_FragCoord;\n' +
    src +
    '\nvoid main(){ ds_FragCoord = vec4(gl_FragCoord.xy - ds_origin, gl_FragCoord.zw); ds_main();' +
    ' if (ds_feather > 0.0) { float a = clamp((ds_top + ds_feather - gl_FragCoord.y) / (2.0 * ds_feather), 0.0, 1.0); a = a * a * (3.0 - 2.0 * a); gl_FragColor *= a; } }\n'

  const uniforms = { ds_origin: { value: new THREE.Vector2() }, ds_top: { value: 0 }, ds_feather: { value: 0 } }
  const roles = { res: [], time: [], mouse: [] }
  const u = {}
  for (const it of info) {
    if ('resolution' in it.tags) { roles.res.push(it.name); uniforms[it.name] = { value: new THREE.Vector2(1, 1) }; continue }
    if ('time' in it.tags) { roles.time.push(it.name); uniforms[it.name] = { value: 0 }; continue }
    if ('mouse' in it.tags) { roles.mouse.push(it.name); uniforms[it.name] = { value: new THREE.Vector2() }; continue }
    const def = it.name in overrides ? overrides[it.name] : it.tags.default
    const val = toValue(it.type, def)
    uniforms[it.name] = { value: val }
    if (typeof val === 'number') u[it.name] = val
  }
  const material = new THREE.RawShaderMaterial({
    vertexShader: VERT,
    fragmentShader: src,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent,
    // premultiplied "over": opaque shaders behave as before; feathered edges cross-fade
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  })
  if (transparent) material.premultipliedAlpha = true
  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  return { name, mesh, scene, material, roles, u }
}

/** Replace a view's shader with another file, carrying over current uniform values. */
export function swapShader(view, name, overrides = {}) {
  const old = view.shader
  const next = makeShader(name, { ...overrides }, { transparent: old.material.transparent })
  for (const k in old.u) if (k in next.u && !(k in overrides)) next.u[k] = old.u[k]
  const OU = old.material.uniforms, NU = next.material.uniforms
  for (const k in OU) {
    if (k in overrides || !(k in NU)) continue
    const v = OU[k].value
    if (v && v.isVector3 && NU[k].value?.isVector3) NU[k].value.copy(v)
  }
  view.shader = next
  ;(view._disposeLater ||= []).push(old)
  old.material.dispose()
  return next
}
