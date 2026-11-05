import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Global live state shared by WebGL, DOM choreography, cursor, gauge and sound.
// ---------------------------------------------------------------------------
export const state = {
  time: 0,
  dt: 0.016,
  w: window.innerWidth,
  h: window.innerHeight,
  mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2, sx: window.innerWidth / 2, sy: window.innerHeight / 2, nx: 0, ny: 0, snx: 0, sny: 0, down: false },
  scroll: 0,
  velocity: 0, // px per frame, smoothed (Lenis)
  svel: 0,
  progress: 0, // whole page 0..1
  flash: 0, // portal / transitions whiteout 0..1
  flashColor: new THREE.Vector3(1.0, 0.92, 0.78),
  warp: 0, // extra warp streak amount (menu jumps)
  fade: 0, // global black fade 0..1 (loader)
  quality: 1,
}

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D t_scene;
uniform vec2 u_res;
uniform float u_time;
uniform float u_vel;
uniform float u_warp;
uniform float u_flash;
uniform vec3 u_flashCol;
uniform float u_fade;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 c = uv - 0.5;
  float speed = clamp(abs(u_vel) * 0.012 + u_warp, 0.0, 1.5);
  float ca = 0.0007 + speed * 0.010;
  float blur = speed * 0.045;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float s = 1.0 - blur * float(i) / 7.0;
    vec2 cc = c * s;
    col.r += texture2D(t_scene, 0.5 + cc * (1.0 + ca)).r;
    col.g += texture2D(t_scene, 0.5 + cc).g;
    col.b += texture2D(t_scene, 0.5 + cc * (1.0 - ca)).b;
  }
  col /= 8.0;
  // filmic grain, finer than a pixel
  float g = hash12(gl_FragCoord.xy + fract(u_time * 7.0) * 311.0) - 0.5;
  col += g * 0.028;
  // gentle optical vignette that grows with speed
  float v = 1.0 - (0.18 + speed * 0.5) * pow(length(c * vec2(1.0, 0.85)) * 1.35, 2.4);
  col *= clamp(v, 0.0, 1.0);
  col = mix(col, u_flashCol, clamp(u_flash, 0.0, 1.0));
  col *= 1.0 - u_fade;
  gl_FragColor = vec4(col, 1.0);
}
`
const POST_VERT = /* glsl */ `
attribute vec3 position;
void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// --- cosmic dust: instanced quads drifting in depth, reacting to scroll speed & cursor gravity
const DUST_VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec4 a_p; // xy in 0..1, z depth 0..1, w seed
uniform vec2 u_view;      // css px
uniform float u_scroll;   // css px
uniform float u_vel;
uniform float u_time;
uniform vec2 u_mouse;     // css px
uniform float u_dpr;
varying vec2 v_uv;
varying float v_a;
varying float v_d;
void main(){
  float d = a_p.z;
  float par = mix(0.08, 1.35, d * d);
  vec2 p = a_p.xy * u_view;
  p.y = mod(p.y - u_scroll * par * 0.35 + a_p.w * 40.0 + u_time * (4.0 + 10.0 * d), u_view.y + 80.0) - 40.0;
  p.x += sin(u_time * 0.07 + a_p.w * 9.0) * 14.0 * d;
  // mouse gravity: particles within 160px drift toward cursor (max ~8px)
  vec2 toM = u_mouse - p;
  float dist = length(toM);
  p += normalize(toM + 1e-4) * 8.0 * d * smoothstep(160.0, 0.0, dist);
  float size = mix(0.6, 2.4, d * d);
  float stretch = 1.0 + min(abs(u_vel) * (0.5 + 2.5 * d), 60.0);
  vec2 q = position.xy;
  vec2 off = vec2(q.x * size, q.y * size * stretch);
  vec2 sp = p + off;
  vec2 ndc = vec2(sp.x / u_view.x * 2.0 - 1.0, 1.0 - sp.y / u_view.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_uv = q;
  v_d = d;
  v_a = mix(0.10, 0.55, d) * (0.6 + 0.4 * sin(u_time * (0.6 + a_p.w) + a_p.w * 30.0)) / sqrt(stretch);
}
`
const DUST_FRAG = /* glsl */ `
precision highp float;
varying vec2 v_uv;
varying float v_a;
varying float v_d;
void main(){
  float r = length(v_uv);
  float a = smoothstep(1.0, 0.0, r) * v_a;
  vec3 c = mix(vec3(0.68, 0.72, 0.80), vec3(0.80, 0.92, 1.0), v_d);
  gl_FragColor = vec4(c * a, a);
}
`

class Engine {
  views = new Set()
  frameCallbacks = new Set()
  started = false

  init(backCanvas, frontCanvas) {
    if (this.started) return
    this.started = true
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.6)
    this.back = new THREE.WebGLRenderer({ canvas: backCanvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
    this.back.autoClear = false
    this.back.setPixelRatio(1)
    this.front = new THREE.WebGLRenderer({ canvas: frontCanvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
    this.front.autoClear = false
    this.front.setPixelRatio(1)
    this.rt = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // post
    this.postU = {
      t_scene: { value: this.rt.texture }, u_res: { value: new THREE.Vector2() }, u_time: { value: 0 },
      u_vel: { value: 0 }, u_warp: { value: 0 }, u_flash: { value: 0 }, u_flashCol: { value: state.flashColor }, u_fade: { value: 0 },
    }
    const tri = new THREE.BufferGeometry()
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    const post = new THREE.Mesh(tri, new THREE.RawShaderMaterial({ vertexShader: POST_VERT, fragmentShader: POST_FRAG, uniforms: this.postU, depthTest: false, depthWrite: false }))
    post.frustumCulled = false
    this.postScene = new THREE.Scene()
    this.postScene.add(post)

    // dust
    const N = 1500
    const quad = new THREE.InstancedBufferGeometry()
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    quad.setIndex([0, 1, 2, 0, 2, 3])
    const ap = new Float32Array(N * 4)
    for (let i = 0; i < N; i++) {
      ap[i * 4] = Math.random(); ap[i * 4 + 1] = Math.random(); ap[i * 4 + 2] = Math.pow(Math.random(), 1.8); ap[i * 4 + 3] = Math.random()
    }
    quad.setAttribute('a_p', new THREE.InstancedBufferAttribute(ap, 4))
    quad.instanceCount = N
    this.dustU = { u_view: { value: new THREE.Vector2() }, u_scroll: { value: 0 }, u_vel: { value: 0 }, u_time: { value: 0 }, u_mouse: { value: new THREE.Vector2() }, u_dpr: { value: 1 } }
    const dust = new THREE.Mesh(quad, new THREE.RawShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: this.dustU, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    }))
    dust.frustumCulled = false
    this.dustScene = new THREE.Scene()
    this.dustScene.add(dust)
    this.dustOpacity = 1

    this.resize()
    window.addEventListener('resize', () => this.resize())
    this.frameTimes = []
  }

  resize() {
    state.w = window.innerWidth
    state.h = window.innerHeight
    const pr = this.dpr * state.quality
    this.pr = pr
    this.back.setSize(state.w, state.h, false)
    this.back.domElement.width = Math.round(state.w * pr)
    this.back.domElement.height = Math.round(state.h * pr)
    this.back.setViewport(0, 0, state.w * pr, state.h * pr)
    this.rt.setSize(Math.round(state.w * pr), Math.round(state.h * pr))
    this.front.setSize(state.w, state.h, false)
    this.front.setPixelRatio(pr)
    this.front.setSize(state.w, state.h, false)
  }

  add(view) {
    view.zoom ??= 1
    view.shiftX ??= 0
    view.shiftY ??= 0
    view.layer ??= 'back'
    view.enabled ??= true
    this.views.add(view)
    return () => this.views.delete(view)
  }

  onFrame(fn) {
    this.frameCallbacks.add(fn)
    return () => this.frameCallbacks.delete(fn)
  }

  _bind(view, rect, pr, H) {
    // H = drawing-buffer height in device px
    const z = view.zoom
    const w = rect.width * z
    const h = rect.height * z
    const left = rect.left - (w - rect.width) / 2 + view.shiftX
    const top = rect.top - (h - rect.height) / 2 + view.shiftY
    const vx = left * pr
    const vy = H - (top + h) * pr
    const vw = w * pr
    const vh = h * pr
    const sh = view.shader
    const U = sh.material.uniforms
    U.ds_origin.value.set(vx, vy)
    for (const n of sh.roles.res) U[n].value.set(vw, vh)
    for (const n of sh.roles.time) U[n].value = state.time
    for (const n of sh.roles.mouse) U[n].value.set(state.mouse.sx * pr - vx, H - state.mouse.sy * pr - vy)
    for (const k in sh.u) if (k in U) U[k].value = sh.u[k]
    // scissor = visible part of the element itself (css px)
    const sx0 = Math.max(0, rect.left), sy0 = Math.max(0, rect.top)
    const sx1 = Math.min(state.w, rect.right), sy1 = Math.min(state.h, rect.bottom)
    return { vx, vy, vw, vh, sx: sx0 * pr, sy: H - sy1 * pr, sw: Math.max(0, (sx1 - sx0) * pr), sh: Math.max(0, (sy1 - sy0) * pr) }
  }

  render(dt) {
    state.time += dt
    state.dt = dt
    const m = state.mouse
    const k = 1 - Math.pow(0.0008, dt)
    m.sx += (m.x - m.sx) * k
    m.sy += (m.y - m.sy) * k
    m.nx = (m.x / state.w) * 2 - 1
    m.ny = (m.y / state.h) * 2 - 1
    m.snx += (m.nx - m.snx) * k * 0.6
    m.sny += (m.ny - m.sny) * k * 0.6
    state.svel += (state.velocity - state.svel) * Math.min(1, dt * 8)
    for (const fn of this.frameCallbacks) fn(state, dt)

    const pr = this.pr
    const W = this.rt.width, H = this.rt.height
    const back = this.back
    back.setRenderTarget(this.rt)
    back.setClearColor(0x030409, 1)
    this.rt.scissorTest = false
    back.clear(true, true, false)
    const margin = 2
    const fronts = []
    for (const v of this.views) {
      if (!v.enabled) continue
      const rect = v.el.getBoundingClientRect()
      if (rect.bottom < -margin || rect.top > state.h + margin || rect.width === 0) continue
      if (v.layer === 'front') { fronts.push([v, rect]); continue }
      v.onFrame?.(v, state, dt, rect)
      const b = this._bind(v, rect, pr, H)
      if (b.sw <= 0 || b.sh <= 0) continue
      this.rt.viewport.set(b.vx, b.vy, b.vw, b.vh)
      this.rt.scissor.set(b.sx, b.sy, b.sw, b.sh)
      this.rt.scissorTest = true
      back.setRenderTarget(this.rt)
      back.render(v.shader.scene, this.cam)
      if (v.scene3d && v.camera3d) {
        // 3D overlay uses the element rect itself (no shader zoom)
        const vx = rect.left * pr, vy = H - rect.bottom * pr
        this.rt.viewport.set(vx, vy, rect.width * pr, rect.height * pr)
        back.setRenderTarget(this.rt)
        back.clearDepth()
        back.render(v.scene3d, v.camera3d)
      }
    }
    // dust over everything in the back layer
    this.rt.viewport.set(0, 0, W, H)
    this.rt.scissorTest = false
    back.setRenderTarget(this.rt)
    this.dustU.u_view.value.set(state.w, state.h)
    this.dustU.u_scroll.value = state.scroll
    this.dustU.u_vel.value = state.svel
    this.dustU.u_time.value = state.time
    this.dustU.u_mouse.value.set(state.mouse.sx, state.mouse.sy)
    if (this.dustOpacity > 0.01) back.render(this.dustScene, this.cam)

    // post to screen
    back.setRenderTarget(null)
    back.setViewport(0, 0, W, H)
    back.setScissorTest(false)
    this.postU.u_res.value.set(W, H)
    this.postU.u_time.value = state.time
    this.postU.u_vel.value = state.svel
    this.postU.u_warp.value = state.warp
    this.postU.u_flash.value = state.flash
    this.postU.u_fade.value = state.fade
    back.render(this.postScene, this.cam)

    // front layer (overlays above DOM)
    const front = this.front
    front.setScissorTest(false)
    front.setClearColor(0x000000, 0)
    front.clear(true, true, false)
    for (const [v, rect] of fronts) {
      v.onFrame?.(v, state, dt, rect)
      const FH = state.h * pr
      const b = this._bind(v, rect, pr, FH)
      if (b.sw <= 0 || b.sh <= 0) continue
      front.setViewport(b.vx / pr, b.vy / pr, b.vw / pr, b.vh / pr)
      front.setScissor(b.sx / pr, b.sy / pr, b.sw / pr, b.sh / pr)
      front.setScissorTest(true)
      front.render(v.shader.scene, this.cam)
    }
    front.setScissorTest(false)

    this._adapt(dt)
  }

  _adapt(dt) {
    // adaptive resolution: keep the experience fluid on any GPU
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 40) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    let q = state.quality
    if (avg > 1 / 42) q = Math.max(0.45, q * 0.86)
    else if (avg < 1 / 58 && q < 1) q = Math.min(1, q * 1.08)
    if (Math.abs(q - state.quality) > 0.01) { state.quality = q; this.resize() }
  }
}

export const engine = new Engine()
