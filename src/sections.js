import design from './design/design.json'

export const SECTIONS = Object.keys(design)
  .filter((k) => /^S\d\d/.test(k))
  .sort()
  .map((k) => ({ key: 's' + k.slice(1, 3), name: k, frame: design[k] }))

export const MOBILE = (design['M — Mobile Journey']?.children || []).map((f, i) => ({ key: 'm' + String(i).padStart(2, '0'), name: f.name, frame: f }))

