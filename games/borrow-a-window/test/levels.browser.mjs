import { chromium } from 'playwright';
const OUT = process.env.OUT || 'shots';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto((process.env.URL || 'http://localhost:4173/')); await p.waitForFunction(() => window.__win && window.__win.project('lamp')); await p.waitForTimeout(800);
  const tap = async (id) => { const [x, y] = await p.evaluate((id) => window.__win.project(id), id); if (opts.hasTouch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); await p.waitForTimeout(150); };
  for (let lv = 1; lv <= 4; lv++) {
    const spots = await p.evaluate((lv) => window.__win.L.levelOf(lv).spots, lv);
    if (lv === 4) { // 白天點路燈 → 被擋
      await p.evaluate(() => window.__win.reset()); await p.waitForTimeout(300); await tap('lamp');
      console.log(name, 'L4 lamp by day:', await p.locator('[data-testid=note]').textContent().catch(() => null), 'found', await p.evaluate(() => window.__win.model.found.size));
      await p.screenshot({ path: `${OUT}/${name}-level4-wait-night.png` });
      await p.waitForFunction(() => window.__win.L.lampLit(window.__win.L.loopTime(performance.now(), window.__win.model.start)), null, { timeout: 30000, polling: 50 });
    }
    for (const id of spots) await tap(id);
    const st = await p.evaluate(() => ({ lv: window.__win.level(), found: [...window.__win.model.found] }));
    const clear = await p.locator('[data-testid=clear]').textContent().catch(() => null);
    console.log(name, JSON.stringify(st), clear);
    await p.screenshot({ path: `${OUT}/${name}-level${lv}-clear.png` });
    if (lv < 4) { await p.locator('[data-testid=next]').click(); await p.waitForTimeout(400); }
  }
  await ctx.close();
}
console.log('errors', errs); await b.close();
