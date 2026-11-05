// S11 — the legendary ending: dive through the portal, whiteout, a quiet message
// from beyond, and the flight back to the origin.
import { gsap, SplitText, state } from '../auto.js'
import { flyToOrigin, reducedMotion } from './s11-fly.js'

const CSS = `
.s11-beyond{position:fixed;inset:0;z-index:60;display:grid;place-items:center;pointer-events:none;visibility:hidden}
.s11-beyond.is-on{pointer-events:auto;visibility:visible}
.s11-beyond .bv-veil{position:absolute;inset:0;opacity:0;pointer-events:none;
  background:radial-gradient(ellipse 60% 55% at 50% 50%, rgba(10,4,9,.38) 0%, rgba(6,3,8,.58) 55%, rgba(3,4,9,.9) 100%)}
.s11-beyond .bv-black{position:absolute;inset:0;background:#030409;opacity:0;pointer-events:none}
.s11-beyond .bv-inner{position:relative;text-align:center;padding:0 24px;max-width:1100px}
.s11-beyond .bv-k{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.22em;color:rgba(238,241,247,.5);text-transform:uppercase;margin-bottom:34px}
.s11-beyond .bv-t{font-family:'Sora',sans-serif;font-weight:200;color:#F4EFE8;margin:0;
  font-size:clamp(30px,4vw,60px);line-height:1.08;letter-spacing:-.03em;text-wrap:balance;
  text-shadow:0 0 40px rgba(232,194,122,.18)}
.s11-beyond .bv-t em{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;letter-spacing:-.01em;color:#F3D9AE}
.s11-beyond .bv-sub{font-family:'Inter',sans-serif;font-size:14px;color:rgba(238,241,247,.55);margin-top:22px;letter-spacing:.01em}
.s11-beyond .bv-ret{all:unset;cursor:pointer;margin-top:56px;display:inline-block;position:relative;padding:14px 10px;
  font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.26em;color:#EEF1F7}
.s11-beyond .bv-ret::after{content:'';position:absolute;left:10px;right:10px;bottom:6px;height:1px;background:rgba(238,241,247,.22);
  transform-origin:50% 50%;transition:transform .9s cubic-bezier(.16,.9,.12,1),background .6s}
.s11-beyond .bv-ret:hover::after,.s11-beyond .bv-ret:focus-visible::after{transform:scaleX(1.25);background:rgba(232,194,122,.85)}
.s11-beyond .bv-ret .ar{display:inline-block;transition:transform .7s cubic-bezier(.16,.9,.12,1)}
.s11-beyond .bv-ret:hover .ar,.s11-beyond .bv-ret:focus-visible .ar{transform:translateY(-4px)}
.s11-beyond .bv-ret:focus-visible{outline:1px solid rgba(232,194,122,.6);outline-offset:4px}
.s11-beyond .sc{display:inline-block}
`

export function createEnding(ctx, P) {
  // P: live params object shared with s11.js ({ hover, dive, open, rim, ending, ... })
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const ov = document.createElement('div')
  ov.className = 's11-beyond'
  ov.setAttribute('role', 'dialog')
  ov.setAttribute('aria-modal', 'true')
  ov.setAttribute('aria-labelledby', 's11-bv-t')
  ov.setAttribute('aria-hidden', 'true')
  ov.innerHTML = `
    <div class="bv-veil"></div>
    <div class="bv-inner">
      <div class="bv-k">NMA-∞ · coordinates undefined</div>
      <h2 class="bv-t" id="s11-bv-t">You are now <em>beyond</em> the known universe.</h2>
      <div class="bv-sub">Whatever is out here has not been named yet.</div>
      <button class="bv-ret" type="button" data-cursor="link">RETURN TO ORIGIN <span class="ar">↑</span></button>
    </div>
    <div class="bv-black"></div>`
  document.body.appendChild(ov)
  const veil = ov.querySelector('.bv-veil')
  const black = ov.querySelector('.bv-black')
  const kick = ov.querySelector('.bv-k')
  const title = ov.querySelector('.bv-t')
  const sub = ov.querySelector('.bv-sub')
  const ret = ov.querySelector('.bv-ret')
  let split = null
  let tl = null
  let lastFocus = null

  const fadeTargets = () => [ctx.q('Headline'), ctx.q('CTA'), ctx.q('CTA underline'), ctx.q('Secondary'), ctx.q('Depth gauge')].filter(Boolean)

  function enter() {
    if (P.ending) return
    P.ending = true
    document.documentElement.classList.add('is-beyond')
    lastFocus = document.activeElement
    const lenis = window.__lenis
    const s = window.innerWidth / 1440
    // tilt the camera up: bring the ring to the centre of the screen
    const target = ctx.el.offsetTop + 450 * s - window.innerHeight / 2
    lenis?.scrollTo(target, { duration: 1.5, force: true, lock: true, easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: () => lenis.stop() })
    state.flashColor.set(1.0, 0.9, 0.76)

    const reduced = reducedMotion()
    tl?.kill()
    tl = gsap.timeline()
    // the CTA is pressed, the page's type exhales out of the frame
    tl.to(ctx.q('CTA'), { scale: 0.94, duration: 0.18, ease: 'power2.out' }, 0)
    tl.to(fadeTargets(), { opacity: 0, filter: 'blur(10px)', y: -18, duration: 0.9, ease: 'power2.in', stagger: 0.04 }, 0.1)
    // the portal inhales hard
    tl.to(P, { hover: 1, duration: 0.6, ease: 'power2.out' }, 0)
    tl.to(P, { open: 1.9, rim: 2.4, duration: 1.6, ease: 'power2.inOut' }, 0.2)
    // the dive
    tl.to(P, { dive: 1, duration: reduced ? 0.6 : 2.5, ease: 'power2.in' }, 0.9)
    tl.to(P, { rim: 3, duration: 0.8, ease: 'power2.in' }, 2.4)
    if (!reduced) tl.to(state, { warp: 1.1, duration: 1.6, ease: 'power3.in' }, 1.8)
    tl.to(P, { streak: 1, duration: 2.3, ease: 'power2.in' }, 1.0)
    tl.to(P, { streak: 0, duration: 1.2, ease: 'power2.out' }, 3.55)
    // emerge: drift back a little so the far universe's structure fills the frame
    tl.to(P, { dive: 0.84, duration: 4, ease: 'sine.out' }, 3.55)
    // whiteout
    tl.to(state, { flash: 1, duration: 0.55, ease: 'power2.in' }, 3.0)
    tl.add(() => {
      ov.classList.add('is-on')
      ov.setAttribute('aria-hidden', 'false')
    }, 3.5)
    tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 2.2, ease: 'power1.inOut' }, 3.5)
    tl.to(state, { warp: 0, duration: 0.9, ease: 'power2.out' }, 3.55)
    tl.to(state, { flash: 0, duration: 2.4, ease: 'power2.out' }, 3.55)
    tl.to(P, { open: 1.5, rim: 1.4, duration: 3, ease: 'sine.inOut' }, 3.55)
    // the message
    split?.revert()
    split = SplitText.create(title, { type: 'words,chars', charsClass: 'sc' })
    tl.fromTo(kick, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'none' }, 4.0)
    tl.fromTo(split.chars, { opacity: 0, filter: 'blur(12px)', y: 14 }, {
      opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.6, ease: 'cine', stagger: { each: 0.022, from: 'center' },
    }, 4.0)
    tl.fromTo(sub, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.4, ease: 'cine' }, 5.0)
    tl.fromTo(ret, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.4, ease: 'cine', onComplete: () => ret.focus({ preventScroll: true }) }, 5.3)
    // prime the hidden state immediately
    gsap.set([kick, sub, ret], { opacity: 0 })
    gsap.set(split.chars, { opacity: 0 })
    gsap.set(black, { opacity: 0 })
    gsap.set(veil, { opacity: 0 })
  }

  function leave() {
    if (!P.ending || P.leaving) return
    P.leaving = true
    tl?.kill()
    tl = gsap.timeline()
    tl.to([kick, title, sub, ret], { opacity: 0, filter: 'blur(8px)', duration: 0.6, ease: 'power2.in', stagger: 0.05 }, 0)
    tl.to(black, { opacity: 1, duration: 0.7, ease: 'power2.inOut' }, 0.1)
    tl.add(() => {
      // reset the portal under the black and give the page its type back
      state.flash = 0
      gsap.killTweensOf(P)
      Object.assign(P, { dive: 0, streak: 0, open: 1, rim: 1, hover: 0 })
      gsap.set(fadeTargets(), { clearProps: 'opacity,filter,transform' })
      gsap.set(ctx.q('CTA'), { scale: 1 })
      flyToOrigin({
        duration: 4,
        onDone: () => { P.ending = false; document.documentElement.classList.remove('is-beyond'); P.leaving = false },
      })
    }, 0.85)
    tl.to(black, { opacity: 0, duration: 1.4, ease: 'power2.out' }, 0.95)
    tl.to(veil, { opacity: 0, duration: 1.0, ease: 'power2.out' }, 0.95)
    tl.add(() => {
      ov.classList.remove('is-on')
      ov.setAttribute('aria-hidden', 'true')
      gsap.set([kick, title, sub, ret], { clearProps: 'opacity,filter,transform' })
      if (lastFocus && document.contains(lastFocus) && lastFocus !== ctx.q('CTA')) lastFocus.focus?.({ preventScroll: true })
    }, 2.4)
  }

  const onRet = (e) => { e.preventDefault(); leave() }
  const onKey = (e) => { if (e.key === 'Escape' && P.ending) leave() }
  ret.addEventListener('click', onRet)
  window.addEventListener('keydown', onKey)

  // test hook (scrub the sequence deterministically)
  window.__s11end = { get tl() { return tl }, P }
  return {
    enter,
    leave,
    destroy() {
      tl?.kill()
      split?.revert()
      ret.removeEventListener('click', onRet)
      window.removeEventListener('keydown', onKey)
      ov.remove()
      style.remove()
      if (P.ending) { state.flash = 0; state.warp = 0; window.__lenis?.start() }
    },
  }
}
