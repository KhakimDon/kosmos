// Generative cosmic soundscape (no audio files): a breathing drone, a velocity-driven
// solar wind, a bell for every section crossed, and micro ticks for interface hovers.
import { state } from './engine.js'

class Sound {
  ctx = null
  on = false
  listeners = new Set()

  _build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    this.master = master

    // reverb: synthetic impulse response (long, dark tail)
    const len = ctx.sampleRate * 5
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    const verb = ctx.createConvolver()
    verb.buffer = ir
    const verbGain = ctx.createGain()
    verbGain.gain.value = 0.55
    verb.connect(verbGain).connect(master)
    this.verb = verb

    // drone
    const droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 320
    droneFilter.Q.value = 0.7
    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.18
    droneFilter.connect(droneGain)
    droneGain.connect(master)
    droneGain.connect(verb)
    this.droneFilter = droneFilter
    const notes = [55, 82.41, 110, 164.81]
    this.oscs = notes.map((f, i) => {
      const o = ctx.createOscillator()
      o.type = i === 0 ? 'sine' : 'sawtooth'
      o.frequency.value = f
      o.detune.value = (i - 1.5) * 4
      const g = ctx.createGain()
      g.gain.value = i === 0 ? 0.9 : 0.12 / i
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.03 + i * 0.017
      const lfoG = ctx.createGain()
      lfoG.gain.value = 0.06 / (i + 1)
      lfo.connect(lfoG).connect(g.gain)
      lfo.start()
      o.connect(g).connect(droneFilter)
      o.start()
      return o
    })

    // solar wind (noise) driven by scroll speed
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = nb
    noise.loop = true
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 900
    nf.Q.value = 0.8
    const ng = ctx.createGain()
    ng.gain.value = 0.0
    noise.connect(nf).connect(ng)
    ng.connect(master)
    ng.connect(verb)
    noise.start()
    this.windFilter = nf
    this.windGain = ng

    this._raf = () => {
      if (!this.ctx) return
      const v = Math.min(Math.abs(state.svel) / 40, 1)
      const t = ctx.currentTime
      this.windGain.gain.setTargetAtTime(0.012 + v * 0.11 + state.warp * 0.1, t, 0.12)
      this.windFilter.frequency.setTargetAtTime(600 + v * 2600, t, 0.2)
      this.droneFilter.frequency.setTargetAtTime(240 + state.progress * 520 + v * 300, t, 0.4)
      requestAnimationFrame(this._raf)
    }
    requestAnimationFrame(this._raf)
  }

  enable() {
    if (!this.ctx) this._build()
    this.ctx.resume()
    this.on = true
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 1.5)
    this.listeners.forEach((f) => f(true))
  }

  disable() {
    this.on = false
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
    this.listeners.forEach((f) => f(false))
  }

  toggle() {
    this.on ? this.disable() : this.enable()
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // pentatonic bell for section index
  bell(i = 0, gain = 0.18) {
    if (!this.on || !this.ctx) return
    const ctx = this.ctx
    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29]
    const f = 220 * Math.pow(2, scale[i % scale.length] / 12)
    const t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.value = 0
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(gain, t + 0.02)
    out.gain.exponentialRampToValueAtTime(0.0001, t + 6)
    out.connect(this.verb)
    out.connect(this.master)
    ;[1, 2.76, 5.4, 8.93].forEach((m, k) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * m
      const g = ctx.createGain()
      g.gain.value = [0.6, 0.22, 0.1, 0.05][k]
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 6.2)
    })
  }

  tick() {
    if (!this.on || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(2400, t)
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.05)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.025, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 0.1)
  }

  // deep swell for warps / portal
  swell(dur = 3, gain = 0.3) {
    if (!this.on || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(40, t)
    o.frequency.exponentialRampToValueAtTime(160, t + dur)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(120, t)
    f.frequency.exponentialRampToValueAtTime(2400, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.8)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.3)
    o.connect(f).connect(g)
    g.connect(this.master)
    g.connect(this.verb)
    o.start(t)
    o.stop(t + dur * 1.35)
  }
}

export const sound = new Sound()
window.__sound = sound
