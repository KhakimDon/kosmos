// Usage: node tools/shot.mjs <outPrefix> [scrollY,...] [--w=1440 --h=900 --wait=2500]
import puppeteer from 'puppeteer-core'
const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')))
const pos = args.filter(a => !a.startsWith('--'))
const out = pos[0] || '/tmp/claude-501/shot'
const ys = (pos[1] || '0').split(',').map(Number)
const W = +(opt.w || 1440), H = +(opt.h || 900)
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
const logs = []
page.on('console', m => logs.push(m.type() + ': ' + m.text()))
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message))
await page.goto(opt.url || 'http://127.0.0.1:5199/' + (opt.q ? '?' + opt.q : ''), { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, +(opt.wait || 2500)))
let i = 0
for (const y of ys) {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y) }, y)
  await new Promise(r => setTimeout(r, +(opt.settle || 2200)))
  await page.screenshot({ path: `${out}-${i++}.png` })
}
if (opt.eval) console.log('EVAL', JSON.stringify(await page.evaluate(opt.eval)))
console.log(logs.filter(l => !/Download the React DevTools/.test(l)).slice(0, 40).join('\n'))
await browser.close()
