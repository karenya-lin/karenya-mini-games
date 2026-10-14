import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5181/index.html', OUT = process.env.OUT || 'shots';
const SMOOTH = { broom: [150, 20], cloak: [500, 60], book: [70, 100], potion: [570, 350], cat: [250, 300], crystal: [355, 300] };
const log = (...a) => console.log(...a);
const b = await chromium.launch();
const errors = [];
async function run(name, ctxOpts, touch) {
  const ctx = await b.newContext(ctxOpts), p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(name + ': ' + m.text()));
  await p.goto(URL); await p.waitForFunction(() => window.__game);
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const toScreen = async (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById('c').getBoundingClientRect(); return [r.left + x * r.width / 1000, r.top + y * r.height / 400]; }, [x, y]);
  const item = (id) => p.evaluate((id) => { const i = window.__game.state.items.find((i) => i.id === id); return [i.x, i.y, i.angle]; }, id);
  async function drag(id, tx, ty) {
    const [x, y] = await item(id); const [sx, sy] = await toScreen(x, y), [ex, ey] = await toScreen(tx, ty);
    if (touch) {
      const tp = (type, X, Y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: X, y: Y }] });
      await tp('touchStart', sx, sy); for (let k = 1; k <= 8; k++) await tp('touchMove', sx + (ex - sx) * k / 8, sy + (ey - sy) * k / 8); await tp('touchEnd');
    } else { await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(ex, ey, { steps: 8 }); await p.mouse.up(); }
    return p.evaluate(() => window.__game.state.message);
  }
  const fresh = await p.evaluate(() => JSON.stringify(window.__game.state.items));
  const tap = async (sel) => touch ? p.tap(sel) : p.click(sel);
  // 1) 全部用拖曳達成結局一
  for (const id of Object.keys(SMOOTH)) log(name, 'drag', id, '→', await drag(id, ...SMOOTH[id]));
  log(name, 'ending1', await p.evaluate(() => window.__game.state.ending));
  await p.screenshot({ path: `${OUT}/${name}-ending-smooth.png`, fullPage: true });
  // 2) 拖藥瓶到掃帚旁 → 結局二
  log(name, 'potion→', await drag('potion', 330, 70)); log(name, 'ending2', await p.evaluate(() => window.__game.state.ending));
  await p.screenshot({ path: `${OUT}/${name}-ending-chaos.png`, fullPage: true });
  // 3) 非法：拖藥瓶疊到黑貓
  log(name, 'illegal overlap →', await drag('potion', 250, 300), await item('potion'));
  await p.screenshot({ path: `${OUT}/${name}-illegal-overlap.png`, fullPage: true });
  // 4) 旋轉：選掃帚按旋轉 → 越界退回
  const [bx, by] = await toScreen(...SMOOTH.broom);
  if (touch) await p.touchscreen.tap(bx, by); else await p.mouse.click(bx, by);
  await tap('#rotR'); log(name, 'rotate broom at wall →', await p.evaluate(() => window.__game.state.message), await item('broom'));
  await p.screenshot({ path: `${OUT}/${name}-illegal-rotate.png`, fullPage: true });
  // 書旋轉 → ③ 觸發
  await drag('potion', 570, 350); log(name, 'book→free', await drag('book', 300, 150)); const [kx, ky] = await toScreen(300, 150); if (touch) await p.touchscreen.tap(kx, ky); else await p.mouse.click(kx, ky);
  await tap('#rotR'); log(name, 'rotate book →', await p.evaluate(() => [window.__game.state.message, window.__game.state.rules]));
  await p.screenshot({ path: `${OUT}/${name}-rule3-messy.png`, fullPage: true });
  // 5) 三輪 reset（結局後、拖曳中）
  for (let r = 0; r < 3; r++) {
    if (!touch) { const [sx, sy] = await toScreen(...(await item('cat'))); await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx - 200, sy, { steps: 3 }); }
    await p.evaluate(() => window.__game.reset()); if (!touch) await p.mouse.up();
    const same = await p.evaluate((f) => JSON.stringify(window.__game.state.items) === f && !window.__game.dragging && window.__game.state.ending === null, fresh);
    const st = await p.evaluate(() => window.__game.state.items[0].x);
    log(name, `reset#${r + 1} clean=`, same);
    for (const id of Object.keys(SMOOTH)) await drag(id, ...SMOOTH[id]);
    log(name, `after reset#${r + 1} replay ending=`, await p.evaluate(() => window.__game.state.ending));
  }
  await p.evaluate(() => window.__game.reset()); await p.screenshot({ path: `${OUT}/${name}-after-reset.png`, fullPage: true });
  await ctx.close();
}
await run('desktop', { viewport: { width: 1280, height: 800 } }, false);
await run('mobile', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, true);
log('errors', errors);
await b.close();
