// Converts the MEDEO design (site.dsai) into resolved JSON for the React renderer
// and copies the shaders that the design uses into src/shaders.
import fs from 'node:fs'
import path from 'node:path'

const DSAI = process.argv[2] || '/Users/khakim/Documents/site.dsai'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const docDir = path.dirname(DSAI)
const doc = JSON.parse(fs.readFileSync(DSAI, 'utf8'))
const tokens = doc.tokens || {}
const styles = doc.styles || {}

const tok = (v) => {
  if (typeof v === 'string' && v.startsWith('$$')) return v.slice(1)
  if (typeof v === 'string' && v.startsWith('$')) {
    const t = tokens[v.slice(1)]
    if (!t) { console.warn('missing token', v); return v }
    return tok(t.value)
  }
  return v
}
const deep = (v) => {
  if (Array.isArray(v)) return v.map(deep)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))
  return tok(v)
}

const shadersUsed = new Set()
function resolve(node) {
  let n = { ...node }
  if (n.style) {
    const list = Array.isArray(n.style) ? n.style : [n.style]
    const merged = {}
    for (const s of list) Object.assign(merged, styles[s] || {})
    n = { ...merged, ...n }
    delete n.style
  }
  if (n.fontStyle === 'italic') { n.italic = true }
  delete n.fontStyle
  n = deep(n)
  const fills = Array.isArray(n.fill) ? n.fill : n.fill ? [n.fill] : []
  for (const f of fills) if (f && f.type === 'shader') {
    const base = path.basename(f.src)
    shadersUsed.add(path.join(docDir, f.src))
    f.src = base.replace(/\.glsl$/, '')
  }
  if (Array.isArray(n.text)) n.text = n.text.map((s) => deep(s))
  if (n.children) n.children = n.children.map(resolve)
  return n
}

const page = doc.pages[0]
const out = {}
for (const f of page.children) {
  if (f.type !== 'frame') continue
  out[f.name] = resolve(f)
}
fs.mkdirSync(path.join(ROOT, 'src/design'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'src/design/design.json'), JSON.stringify(out))
fs.mkdirSync(path.join(ROOT, 'src/shaders'), { recursive: true })
for (const s of shadersUsed) fs.copyFileSync(s, path.join(ROOT, 'src/shaders', path.basename(s)))
console.log('frames:', Object.keys(out).length, 'shaders:', [...shadersUsed].map((s) => path.basename(s)).join(', '))
