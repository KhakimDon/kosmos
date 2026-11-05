# NOUMENA site — engine notes for section authors

Dev server is ALREADY running: http://127.0.0.1:5199 (Vite HMR). Do not start another one.
Project: /Users/khakim/Desktop/noumena-site (React 19 + three 0.187 + gsap 3.15 (all plugins free: SplitText, ScrambleText, DrawSVG, MotionPath, CustomEase) + lenis).

## How a section is built
- The MEDEO design is converted to `src/design/design.json` (do not edit by hand). Each top-level frame `S00…S12` becomes a `<Section>`: a 1440-wide stage scaled by CSS var `--s` (= viewport width / 1440). Every design node renders as a DOM element with `data-name="<MEDEO node name>"` and `data-id`. Text = `.ds-text` div, vector = `svg.ds-vector > path`, ellipse = `.ds-ellipse`, frame = `.ds-frame`.
- Shader fills (GLSL in `src/shaders/*.glsl`) are rendered by ONE fixed WebGL canvas behind the DOM (`engine` in `src/engine/engine.js`), clipped to the element's rect. "Dust lane (foreground)" renders on a front canvas above the DOM.
- Per-section choreography lives in `src/choreo/sections/sNN.js` (e.g. `s04.js`), `export default function (ctx) { ...; return cleanup }`. Without a file, `autoChoreo(ctx)` from `src/choreo/auto.js` is used. ONLY edit your own `sNN.js` files (and new helper files you create with your section prefix, e.g. `src/choreo/sections/s04-armillary.js`). Do NOT edit engine.js, auto.js, Node.jsx, Section.jsx, App.jsx, index.css — if you need an engine change, describe it in your final report. You may add CSS by injecting a `<style>` from your module or with inline styles.

## ctx (passed to your choreo)
- `ctx.el` section element, `ctx.stage` scaled stage, `ctx.frame` design JSON, `ctx.q(name)` / `ctx.qa(name)` query by MEDEO node name.
- `ctx.view` the section's main shader view: `{ el, shader: { u, material, roles }, zoom, shiftX, shiftY, extraZoom, scene3d, camera3d, onFrame }`.
- `ctx.u` = `ctx.view.shader.u`: plain object of the shader's numeric uniforms (names as in the .glsl). Tween them with GSAP (`gsap.to(ctx.u, { u_tilt: 0.2 })`) or set them per frame — the engine copies them to the GPU every frame. Colour uniforms are vec3 in `ctx.view.shader.material.uniforms[name].value` (THREE.Vector3).
- `ctx.views` all shader views of the section (e.g. S02 has the dust veil, S08 the spectrum strip).
- Per-frame hook: set `ctx.onFrame = (view, state, dt, rect, p) => {}` BEFORE/AFTER calling autoChoreo (autoChoreo calls it every frame while the section is visible). `p` = 0..1 progress of the section crossing the viewport (0 = top enters at bottom, 1 = bottom leaves at top).
- `state` (import from `../../engine/engine.js`): `time, dt, w, h, mouse {x,y (px), sx,sy (smoothed px), nx,ny (-1..1), snx,sny (smoothed)}, scroll, velocity, svel (smoothed scroll velocity px/frame), progress, flash (0..1 global light flash in post), flashColor (Vector3), warp (extra speed blur), fade (global black fade)`.

## autoChoreo(ctx, opts) — call it first, then add your own magic
It gives: shader camera push-in (zoom 1.06→1.16 over the section) + scroll parallax + mouse parallax; SplitText char-rise for type ≥36px; blur-rise for body text; ScrambleText decode for mono labels; hairline rules grow; SVG paths draw (DrawSVG); ellipses pop in; all in `ctx.enter` (a paused GSAP timeline, played when section top reaches 70% of viewport).
opts: `{ skip: [names of text nodes to leave alone], noCamera, zoomFrom, zoomTo, shift, mouse (parallax strength), start, manualEnter (don't auto-play ctx.enter), replay }`. Elements inside an element with attribute `data-noauto` are ignored — set it on nodes you animate yourself BEFORE calling autoChoreo.
Exports: `gsap, ScrollTrigger, SplitText, state, revealHeadline(el), scrambleIn(el)` from `../auto.js`.

## 3D (three.js) inside a section
Set `ctx.view.scene3d = new THREE.Scene()` and `ctx.view.camera3d = new THREE.PerspectiveCamera(...)` — the engine renders that scene into the section rect right after the shader (same WebGL context, so it shares post-processing: grain, chromatic aberration, speed blur). Keep the camera aspect = rect.width/rect.height (update in ctx.onFrame). Use additive/transparent materials for light work. Dispose in cleanup.
You can hide DOM vectors that you replace with real 3D (set `style.visibility='hidden'` or remove) but keep the labels.

## Global events
- `window` event `noumena:intro` fires when the loader opens onto the hero (also `window.__introDone = true`). URL `?nointro` skips the loader (use it when testing).
- Smooth scroll: `window.__lenis` (Lenis). Scroll to element: `window.__lenis.scrollTo(el)`.

## Testing / screenshots (headless Chrome with GPU works)
`node tools/shot.mjs /tmp/claude-501/<you>-x <y1,y2,...> --q=nointro --wait=2500 --settle=2500` → PNGs `/tmp/claude-501/<you>-x-0.png`… at 1440×900, scrolled to each y (CSS px). Console errors are printed. Read the PNGs to look at them. Find a section's y with `--eval="document.getElementById('s04').offsetTop"`. Take screenshots mid-animation too (e.g. `--settle=600`) to check motion states. Headless timing is approximate — judge composition, not speed.

## Quality bar
This is meant to be an Awwwards-level, "how did they make this" experience. Motion must be purposeful, cinematic (long eases, `ease: 'cine'` is registered), layered in depth, reacting to scroll AND cursor. No cheap effects, no bouncy UI, no random particles without meaning. Keep 60 fps: no per-frame layout reads besides what you need, avoid heavy DOM filters on large areas, reuse geometries.
