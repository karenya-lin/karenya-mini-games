import { corners, aabb, overlaps, outside, intersectsRect, gap } from './geometry.js';

export const SUITCASE = { x: 0, y: 0, w: 600, h: 400 };
export const TABLE = { x: 640, y: 0, w: 360, h: 400 };
export const WORLD = { w: 1000, h: 400 };
export const ROT_STEP = 45, GRID = 5, WALL_SNAP = 15, NEAR = 20;

// 候選物品（名稱／性格皆為候選，待確認）
export const ITEMS = [
  { id: 'broom', name: '掃帚', mood: '愛逞強', w: 300, h: 40, color: '#b08850', home: [820, 30] },
  { id: 'cat', name: '黑貓抱枕', mood: '怕寂寞', w: 100, h: 100, color: '#444455', home: [700, 110] },
  { id: 'potion', name: '魔藥瓶', mood: '易碎神經質', w: 60, h: 100, color: '#5aa06a', home: [800, 110] },
  { id: 'book', name: '咒語書', mood: '愛整齊', w: 140, h: 100, color: '#8a4b6b', home: [910, 110] },
  { id: 'crystal', name: '水晶球', mood: '會安撫人', w: 90, h: 90, color: '#7fb3d5', home: [700, 300] },
  { id: 'cloak', name: '月亮斗篷', mood: '懶洋洋', w: 200, h: 120, color: '#3d4f8a', home: [870, 300] },
];

export const RULES = [
  { id: 'fragile', name: '① 易碎', desc: '魔藥瓶在箱內且離掃帚不到 20：魔藥瓶會被壓碎（危險）。' },
  { id: 'calm', name: '② 安撫', desc: '黑貓抱枕在箱內且離水晶球不到 20：黑貓安靜下來。' },
  { id: 'messy', name: '③ 整齊', desc: '咒語書在箱內且不是 0°／180°：書頁亂翻。' },
];
export const ENDINGS = {
  smooth: { name: '順利出發', desc: '六件都在箱內、② 成立、① ③ 都不成立。' },
  chaos: { name: '行李箱暴走', desc: '六件都在箱內且 ① 成立（優先於順利出發）。' },
};

export function createState() {
  return {
    items: ITEMS.map((d) => ({ ...d, x: d.home[0], y: d.home[1], angle: 0 })),
    message: '把六件物品拖進左邊的行李箱。',
    rules: { fragile: false, calm: false, messy: false },
    ending: null,
    selected: null,
  };
}
export function reset(state) {
  const s = createState();
  Object.assign(state, s);
  return state;
}

export const polyOf = (it) => corners(it);
export const inSuitcase = (it) => outside(polyOf(it), SUITCASE).length === 0;

/** 驗證單件物品位置；回傳 null（合法）或原因 */
export function validate(state, it) {
  const p = polyOf(it);
  const outBox = outside(p, SUITCASE), outTable = outside(p, TABLE);
  if (outBox.length && outTable.length) {
    if (intersectsRect(p, SUITCASE)) {
      return outBox.length && !intersectsRect(p, TABLE)
        ? `${it.name}超出行李箱${outBox.join('、')}邊`
        : `${it.name}跨在行李箱和桌面之間`;
    }
    return `${it.name}超出桌面${outTable.join('、')}邊`;
  }
  for (const o of state.items) {
    if (o.id === it.id) continue;
    if (overlaps(p, polyOf(o))) return `${it.name}和${o.name}重疊`;
  }
  return null;
}

export function snap(it) {
  it.x = Math.round(it.x / GRID) * GRID;
  it.y = Math.round(it.y / GRID) * GRID;
  const b = aabb(polyOf(it));
  const cx = it.x - SUITCASE.x, inside = cx > -WALL_SNAP && it.x < SUITCASE.x + SUITCASE.w + WALL_SNAP;
  if (!inside) return it;
  const dl = b.minX - SUITCASE.x, dr = SUITCASE.x + SUITCASE.w - b.maxX;
  const dt = b.minY - SUITCASE.y, db = SUITCASE.y + SUITCASE.h - b.maxY;
  if (Math.abs(dl) <= WALL_SNAP && dl !== 0) it.x -= dl; else if (Math.abs(dr) <= WALL_SNAP && dr !== 0) it.x += dr;
  if (Math.abs(dt) <= WALL_SNAP && dt !== 0) it.y -= dt; else if (Math.abs(db) <= WALL_SNAP && db !== 0) it.y += db;
  it.x = Math.round(it.x * 1000) / 1000; it.y = Math.round(it.y * 1000) / 1000;
  return it;
}

/** 嘗試把物品放到 (x,y,angle)；吸附後驗證；非法則退回上一個合法位置 */
export function tryPlace(state, id, x, y, angle, { doSnap = true } = {}) {
  const it = state.items.find((i) => i.id === id);
  const prev = { x: it.x, y: it.y, angle: it.angle };
  it.x = x; it.y = y; it.angle = ((angle % 360) + 360) % 360;
  if (doSnap) snap(it);
  const why = validate(state, it);
  if (why) {
    Object.assign(it, prev);
    state.message = `✗ 不能放：${why}，已退回上一個位置。`;
    evaluate(state);
    return { ok: false, reason: why };
  }
  state.message = `✓ ${it.name}（${it.mood}）放好了。`;
  evaluate(state);
  return { ok: true };
}
export function rotate(state, id, dir = 1) {
  const it = state.items.find((i) => i.id === id);
  return tryPlace(state, id, it.x, it.y, it.angle + dir * ROT_STEP);
}

export function evaluate(state) {
  const g = (id) => state.items.find((i) => i.id === id);
  const near = (a, b) => inSuitcase(a) && inSuitcase(b) && gap(polyOf(a), polyOf(b)) < NEAR;
  const book = g('book');
  state.rules = {
    fragile: near(g('potion'), g('broom')),
    calm: near(g('cat'), g('crystal')),
    messy: inSuitcase(book) && book.angle % 180 !== 0,
  };
  const all = state.items.every(inSuitcase);
  state.ending = null;
  if (all && state.rules.fragile) state.ending = 'chaos';
  else if (all && state.rules.calm && !state.rules.messy) state.ending = 'smooth';
  return state;
}

export const CONFIG_SMOOTH = { broom: [150, 20, 0], cloak: [500, 60, 0], book: [70, 100, 0], potion: [570, 350, 0], cat: [250, 300, 0], crystal: [355, 300, 0] };
export const CONFIG_CHAOS = { ...CONFIG_SMOOTH, potion: [330, 70, 0] };
