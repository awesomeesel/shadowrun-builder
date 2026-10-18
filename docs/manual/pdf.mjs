import { chromium } from 'playwright-core'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
await p.goto(`file://${process.cwd()}/manual.html`)
await p.waitForLoadState('networkidle')
await p.evaluate(() => document.fonts.ready)
// Report any page whose content runs into the footer.
const overflow = await p.evaluate(() =>
  [...document.querySelectorAll('.page')].map((page, i) => {
    const footer = page.querySelector('.footer').getBoundingClientRect().top
    const bottom = Math.max(...[...page.children].filter((c) => !c.classList.contains('footer')).map((c) => c.getBoundingClientRect().bottom))
    return `page ${i + 1}: ${Math.round(footer - bottom)}px spare`
  }),
)
console.log(overflow.join('\n'))
await p.pdf({ path: 'manual.pdf', preferCSSPageSize: true, printBackground: true })
for (let i = 0; i < 6; i++) {
  await p.setViewportSize({ width: 794, height: 1123 })
}
await b.close()
