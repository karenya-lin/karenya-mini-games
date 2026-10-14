import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5181/index.html', OUT = process.env.OUT || 'shots';
const b = await chromium.launch(); const errs = [];
for (const [name, opts, touch] of [['desktop', { viewport: { width: 1366, height: 860 } }, false], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true]]) {
  const ctx = await b.newContext(opts), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(name + ' ' + e.message)); p.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push(name + ' ' + m.text()));
  await p.goto(URL); await p.waitForFunction(() => window.__game); await p.waitForTimeout(400);
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const pos = (id) => p.evaluate((id) => { const i = window.__game.state.items.find((i) => i.id === id); return [i.x, i.y]; }, id);
  const scr = (x, y) => p.evaluate(([x, y]) => window.__game.toScreen(x, y), [x, y]);
  async function drag(id, tx, ty, shot) {
    const [sx, sy] = await scr(...(await pos(id))), [ex, ey] = await scr(tx, ty);
    if (touch) { await tp('touchStart', sx, sy); for (let k = 1; k <= 8; k++) await tp('touchMove', sx + (ex - sx) * k / 8, sy + (ey - sy) * k / 8); if (shot) await p.screenshot({ path: shot }); await tp('touchEnd'); }
    else { await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(ex, ey, { steps: 8 }); if (shot) await p.screenshot({ path: shot }); await p.mouse.up(); }
  }
  console.log(name, 'start chapter', await p.evaluate(() => window.__game.state.chapter), 'locked', await p.locator('#levels button:disabled').count());
  const chs = await p.evaluate(async () => (await import('./src/game.js')).CHAPTERS.map((c) => ({ n: c.n, configs: c.configs })));
  for (const c of chs) {
    await p.screenshot({ path: `${OUT}/${name}-ch${c.n}-start.png`, fullPage: true });
    const ids = Object.keys(c.configs.smooth);
    for (const [k, id] of ids.entries()) await drag(id, ...c.configs.smooth[id].slice(0, 2), k === 1 ? `${OUT}/${name}-ch${c.n}-ghost-ok.png` : null);
    const st = await p.evaluate(() => ({ ch: window.__game.state.chapter, ending: window.__game.state.ending, rules: window.__game.state.rules }));
    console.log(name, JSON.stringify(st)); await p.screenshot({ path: `${OUT}/${name}-ch${c.n}-clear.png`, fullPage: true });
    if (c.n < chs.length) await p.locator('#next').click(); await p.waitForTimeout(200);
  }
  // 特別篇：非法影子、爆炸動畫與強制重來
  const spec = chs.at(-1);
  await p.locator('#retry').click(); await p.waitForTimeout(200);
  for (const id of ['broom', 'cloak', 'book', 'cat', 'crystal']) await drag(id, ...spec.configs.smooth[id].slice(0, 2));
  const [cx, cy] = await pos('cat'); await drag('potion', cx, cy, `${OUT}/${name}-ghost-conflict.png`);
  console.log(name, 'conflict drop →', await p.evaluate(() => window.__game.state.message));
  await drag('potion', ...spec.configs.boom.potion.slice(0, 2)); await p.waitForTimeout(350);
  console.log(name, 'boom', await p.evaluate(() => ({ ending: window.__game.state.ending, exploding: window.__game.exploding })));
  await p.screenshot({ path: `${OUT}/${name}-explosion.png`, fullPage: true });
  await p.waitForFunction(() => !window.__game.exploding, null, { timeout: 5000 });
  console.log(name, 'after explosion auto-restart', await p.evaluate(() => ({ ending: window.__game.state.ending, exploded: window.__game.state.exploded, inBox: window.__game.state.items.filter((i) => i.x < window.__game.state.box.w).length })));
  // 三輪 reset（含拖曳中）
  for (let r = 0; r < 3; r++) {
    if (!touch) { const [sx, sy] = await scr(...(await pos('cat'))); await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx - 100, sy, { steps: 3 }); }
    await p.evaluate(() => window.__game.reset()); if (!touch) await p.mouse.up();
    console.log(name, `reset#${r + 1}`, await p.evaluate(() => ({ drag: !!window.__game.dragging, ending: window.__game.state.ending, packed: window.__game.state.items.filter((i) => i.x < window.__game.state.box.w).length })));
  }
  await ctx.close();
}
console.log('errors', errs); await b.close();
