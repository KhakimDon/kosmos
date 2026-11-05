import { useLayoutEffect, useMemo, useRef } from 'react'
import { Node } from '../design/Node.jsx'
import { engine } from '../engine/engine.js'
import { makeShader } from '../engine/shader.js'

const FRONT_LAYERS = new Set(['Dust lane (foreground)'])

/**
 * One cinematic section: the MEDEO frame rendered as DOM on a 1440-wide stage
 * (scaled by --s), with its shader fills registered in the WebGL engine.
 * `choreo(ctx)` wires the section's animations and returns a cleanup.
 */
export function Section({ id, frame, designWidth = 1440, choreo, index }) {
  const ref = useRef(null)
  const shaders = useMemo(() => [], [frame])
  const onShader = (node, fill) => {
    if (!shaders.find((s) => s.node.id === node.id)) shaders.push({ node, fill })
  }

  useLayoutEffect(() => {
    const el = ref.current
    const views = []
    const disposers = []
    for (const { node, fill } of shaders) {
      const target = el.querySelector(`[data-id="${node.id}"]`)
      if (!target) continue
      const front = FRONT_LAYERS.has(node.name)
      const shader = makeShader(fill.src, fill.uniforms || {}, { transparent: front })
      const view = { el: target, shader, layer: front ? 'front' : 'back', name: node.name, root: node.id === frame.id }
      views.push(view)
      disposers.push(engine.add(view))
    }
    const ctx = {
      el,
      stage: el.querySelector('.stage'),
      frame,
      index,
      views,
      view: views.find((v) => v.root) || views[0],
      u: (views.find((v) => v.root) || views[0])?.shader.u,
      q: (name) => el.querySelector(`[data-name="${name}"]`),
      qa: (name) => [...el.querySelectorAll(`[data-name="${name}"]`)],
    }
    const cleanup = choreo?.(ctx)
    return () => {
      cleanup?.()
      disposers.forEach((d) => d())
      views.forEach((v) => v.shader.material.dispose())
    }
  }, [frame])

  const h = frame.height
  return (
    <section
      ref={ref}
      id={id}
      className="sec"
      data-index={index}
      style={{ height: `calc(${h}px * var(--s))`, '--dw': designWidth }}
    >
      <div className="stage" style={{ width: designWidth, height: h }}>
        <Node node={frame} root onShader={onShader} />
      </div>
    </section>
  )
}
