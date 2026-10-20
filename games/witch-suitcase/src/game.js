import { corners, aabb, overlaps, outside, intersectsRect, gap } from './geometry.js';

export const ROT_STEP = 45, GRID = 5, CELL = 20, WALL_SNAP = 15, NEAR = 20, TABLE_W = 400, GAP_W = 40, WORLD_H = 400;

// 物品清單（名稱／性格皆為候選）。w×h＝碰撞矩形＝美術圖要填滿的長寬比。
const I = (id, name, mood, w, h, color) => ({ id, name, mood, w, h, color });
export const ITEMS = [
  // 特別篇：魔女自己（規格基準六件）
  I('broom', '掃帚', '愛逞強', 300, 40, '#b08850'), I('cat', '黑貓抱枕', '怕寂寞', 100, 100, '#444455'),
  I('potion', '魔藥瓶', '易碎神經質', 60, 100, '#5aa06a'), I('book', '咒語書', '愛整齊', 140, 100, '#8a4b6b'),
  I('crystal', '水晶球', '會安撫人', 90, 90, '#7fb3d5'), I('cloak', '月亮斗篷', '懶洋洋', 200, 120, '#3d4f8a'),
  // 第 1 章：姐姐
  I('hairdryer', '吹風機', '愛出風頭', 160, 80, '#e58fa8'), I('makeup', '化妝包', '愛漂亮', 120, 80, '#f2b6c6'),
  I('heels', '高跟鞋', '高傲', 120, 60, '#c0392b'), I('novel', '戀愛小說', '愛做夢', 100, 140, '#f5c38b'),
  // 第 2 章：媽媽
  I('ricecooker', '大同電鍋', '可靠', 120, 120, '#d9534f'), I('pickles', '醃菜罐', '重口味', 80, 100, '#9bbf5a'),
  I('thermos', '保溫瓶', '熱心', 40, 140, '#5b8fd9'), I('slippers', '藍白拖', '隨性', 140, 60, '#4a78c2'),
  I('ginseng', '人蔘禮盒', '愛面子', 160, 80, '#b8322f'),
  // 第 3 章：隔壁老王
  I('mahjong', '麻將盒', '愛摸兩圈', 160, 100, '#2f7d4f'), I('birdcage', '鳥籠', '愛唱歌', 120, 140, '#c9a24a'),
  I('teapot', '老人茶壺', '慢吞吞', 80, 80, '#8a5a3a'), I('firecracker', '鞭炮', '火爆', 160, 40, '#e03a2f'),
  I('lighter', '打火機', '愛搧風點火', 40, 60, '#f0a830'), I('radio', '收音機', '大嗓門', 120, 80, '#6b6b6b'),
  // 第 4 章：男朋友
  I('guitar', '吉他', '愛現', 300, 100, '#c4823d'), I('gamepad', '遊戲手把', '坐不住', 80, 60, '#4d4d6b'),
  I('ramen', '泡麵箱', '宅', 140, 100, '#e8c35a'), I('roses', '玫瑰花束', '浪漫', 140, 60, '#d63a5a'),
  I('ringbox', '戒指盒', '緊張兮兮', 40, 40, '#7a2a4a'), I('sneakers', '球鞋', '臭臭的', 120, 60, '#f2f2f2'),
  I('energy', '能量飲料', '過動', 40, 80, '#36c26b'),
  // 第 5 章：表妹男友的朋友的小狗
  I('dogbed', '狗窩', '愛賴床', 160, 120, '#c98f5a'), I('bone', '大骨頭', '被寵壞', 120, 40, '#f3e6c8'),
  I('tennisball', '網球', '停不下來', 40, 40, '#d6e84a'), I('leash', '牽繩', '想出門', 140, 40, '#e05a3a'),
  I('duck', '洗澡小鴨', '愛尖叫', 60, 60, '#f6d55c'), I('cone', '伊莉莎白頭套', '很丟臉', 100, 100, '#dfe8ef'),
  I('treats', '零食罐', '誘惑', 60, 80, '#b5651d'), I('sweater', '小毛衣', '怕冷', 100, 80, '#e07aa0'),
];
const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// 規則：good＝過關必要、bad＝擋住過關、boom＝立刻爆炸、整關重來
const near = (a, b) => ({ type: 'near', a, b });
const tilted = (a) => ({ type: 'tilted', a });
const R = (id, kind, name, desc, cond) => ({ id, kind, name, desc, cond });
export const RULES_DB = {
  fragile: R('fragile', 'boom', '易碎', '魔藥瓶碰到掃帚（間距<20）→ 💥 行李箱暴走', near('potion', 'broom')),
  calm: R('calm', 'good', '安撫', '黑貓抱枕挨著水晶球（間距<20）才肯安靜', near('cat', 'crystal')),
  messy: R('messy', 'bad', '整齊', '咒語書不是 0°／180° 會書頁亂翻', tilted('book')),
  heelsHot: R('heelsHot', 'bad', '鞋跟怕熱', '高跟鞋挨著吹風機會被吹歪', near('heels', 'hairdryer')),
  warm: R('warm', 'good', '一家人', '保溫瓶要挨著電鍋', near('thermos', 'ricecooker')),
  smelly: R('smelly', 'bad', '禮盒怕味道', '醃菜罐挨著人蔘禮盒會染味', near('pickles', 'ginseng')),
  tea: R('tea', 'good', '泡茶摸兩圈', '茶壺要挨著麻將盒', near('teapot', 'mahjong')),
  noisy: R('noisy', 'bad', '鳥怕吵', '鳥籠挨著收音機，鳥會罷唱', near('birdcage', 'radio')),
  fire: R('fire', 'boom', '火上加油', '打火機碰到鞭炮 → 💥 炸開', near('lighter', 'firecracker')),
  romance: R('romance', 'good', '求婚準備', '戒指盒要挨著玫瑰花束', near('ringbox', 'roses')),
  stinky: R('stinky', 'bad', '花怕臭', '球鞋挨著玫瑰，花會枯', near('sneakers', 'roses')),
  shaken: R('shaken', 'boom', '別搖我', '能量飲料不是直立（0°／180°）→ 💥 噴發', tilted('energy')),
  fetch: R('fetch', 'good', '撿球', '網球要挨著狗窩', near('tennisball', 'dogbed')),
  shame: R('shame', 'bad', '看得到吃不到', '頭套挨著零食罐，小狗會崩潰', near('cone', 'treats')),
  squeak: R('squeak', 'boom', '尖叫連鎖', '小鴨碰到牽繩 → 💥 尖叫暴衝', near('duck', 'leash')),
};

const C = (n, client, title, box, items, rules, configs) => ({ n, client, title, box, items, rules, configs });
export const CHAPTERS = [
  C(1, '姐姐', '姐姐的週末約會', { w: 480, h: 320 }, ['hairdryer', 'makeup', 'heels', 'novel'], ['heelsHot'], {
    smooth: { hairdryer: [80, 40, 0], makeup: [400, 40, 0], heels: [420, 290, 0], novel: [240, 250, 0] } }),
  C(2, '媽媽', '媽媽回娘家', { w: 520, h: 340 }, ['ricecooker', 'pickles', 'thermos', 'slippers', 'ginseng'], ['warm', 'smelly'], {
    smooth: { ricecooker: [60, 60, 0], thermos: [140, 70, 0], ginseng: [440, 40, 0], pickles: [40, 290, 0], slippers: [450, 310, 0] } }),
  C(3, '隔壁老王', '老王的進香團', { w: 560, h: 360 }, ['mahjong', 'birdcage', 'teapot', 'firecracker', 'lighter', 'radio'], ['tea', 'noisy', 'fire'], {
    smooth: { mahjong: [80, 50, 0], teapot: [200, 40, 0], birdcage: [500, 70, 0], radio: [60, 320, 0], firecracker: [480, 340, 0], lighter: [280, 330, 0] },
    boom: { mahjong: [80, 50, 0], teapot: [200, 40, 0], birdcage: [500, 70, 0], radio: [60, 320, 0], firecracker: [480, 340, 0], lighter: [380, 320, 0] } }),
  C(4, '男朋友', '男朋友的求婚旅行', { w: 560, h: 360 }, ['guitar', 'gamepad', 'ramen', 'roses', 'ringbox', 'sneakers', 'energy'], ['romance', 'stinky', 'shaken'], {
    smooth: { guitar: [150, 50, 0], roses: [370, 30, 0], ringbox: [460, 20, 0], ramen: [70, 310, 0], sneakers: [500, 330, 0], gamepad: [220, 330, 0], energy: [540, 180, 0] },
    boom: { guitar: [150, 50, 0], energy: [300, 200, 90] } }),
  C(5, '表妹男友的朋友的小狗', '小狗的第一次住宿', { w: 520, h: 340 }, ['dogbed', 'bone', 'tennisball', 'leash', 'duck', 'cone', 'treats', 'sweater'], ['fetch', 'shame', 'squeak'], {
    smooth: { dogbed: [80, 60, 0], tennisball: [180, 20, 0], bone: [440, 20, 0], leash: [450, 320, 0], duck: [30, 310, 0], cone: [300, 290, 0], treats: [490, 180, 0], sweater: [300, 90, 0] },
    boom: { duck: [30, 310, 0], leash: [130, 320, 0] } }),
  C(6, '魔女自己', '特別篇：輪到自己出發', { w: 600, h: 400 }, ['broom', 'cloak', 'book', 'potion', 'cat', 'crystal'], ['fragile', 'calm', 'messy'], {
    smooth: { broom: [150, 20, 0], cloak: [500, 60, 0], book: [70, 100, 0], potion: [570, 350, 0], cat: [250, 300, 0], crystal: [355, 300, 0] },
    boom: { broom: [150, 20, 0], cloak: [500, 60, 0], book: [70, 100, 0], cat: [250, 300, 0], crystal: [355, 300, 0], potion: [330, 70, 0] } }),
];
export const SPEC_CHAPTER = 6;
export const chapter = (n) => CHAPTERS.find((c) => c.n === n) || CHAPTERS[0];
export const ENDINGS = {
  smooth: { name: '順利出發', desc: '全部物品在箱內、必要（good）規則都成立、沒有壞（bad）規則。' },
  boom: { name: '行李箱暴走', desc: '任何爆炸（boom）規則一成立就爆炸，整關重來。' },
};

/** 桌面暫放區：依序排架（shelf packing），保證初始互不重疊 */
function homes(ids, table) {
  const out = {}; let x = table.x + 10, y = table.y + 10, rowH = 0;
  for (const id of ids) {
    const it = byId[id];
    if (x + it.w > table.x + table.w - 5) { x = table.x + 10; y += rowH + 10; rowH = 0; }
    out[id] = [x + it.w / 2, y + it.h / 2]; x += it.w + 10; rowH = Math.max(rowH, it.h);
  }
  out.bottom = y + rowH + 10;
  return out;
}

/** layout：'landscape'＝桌面在箱子右邊（預設）；'portrait'＝手機直式，桌面在箱子下方 */
export function createState(n = SPEC_CHAPTER, { blocks = [], layout = 'landscape' } = {}) {
  const ch = chapter(n);
  const box = { x: 0, y: 0, ...ch.box };
  const sorted = [...ch.items].sort((a, b) => byId[b].h - byId[a].h);
  let table = { x: box.w + GAP_W, y: 0, w: TABLE_W, h: WORLD_H };
  if (layout === 'portrait') { table = { x: 0, y: box.h + GAP_W, w: box.w, h: 0 }; table.h = homes(sorted, table).bottom - table.y; }
  const home = homes(sorted, table);
  return {
    chapter: ch.n, box, table, layout, world: layout === 'portrait' ? { w: box.w, h: table.y + table.h } : { w: table.x + table.w, h: WORLD_H },
    items: ch.items.map((id) => ({ ...byId[id], x: home[id][0], y: home[id][1], angle: 0 })),
    message: `第 ${ch.n} 章：幫${ch.client}打包（${ch.items.length} 件）。`,
    rules: Object.fromEntries(ch.rules.map((r) => [r, false])),
    ending: null, exploded: false, selected: null,
    blocks: blocks.map((b) => ({ ...b })), // 每日挑戰的障礙格（污漬），物品不能壓上去
    moves: 0,
  };
}
export function reset(state, n = state.chapter, opts = { blocks: n === state.chapter ? state.blocks : [], layout: state.layout }) { Object.keys(state).forEach((k) => delete state[k]); return Object.assign(state, createState(n, opts)); }
export const rulesOf = (state) => chapter(state.chapter).rules.map((id) => RULES_DB[id]);

export const polyOf = (it) => corners(it);
export const inBox = (state, it) => outside(polyOf(it), state.box).length === 0;

export function validate(state, it) {
  const p = polyOf(it), box = state.box, table = state.table;
  const outBox = outside(p, box), outTable = outside(p, table);
  if (outBox.length && outTable.length) {
    if (intersectsRect(p, box)) return !intersectsRect(p, table) ? `${it.name}超出行李箱${outBox.join('、')}邊` : `${it.name}跨在行李箱和桌面之間`;
    return `${it.name}超出桌面${outTable.join('、')}邊`;
  }
  for (const o of state.items) if (o.id !== it.id && overlaps(p, polyOf(o))) return `${it.name}和${o.name}重疊`;
  for (const b of state.blocks || []) if (overlaps(p, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]])) return `${it.name}壓到污漬`;
  return null;
}

export function snap(state, it) {
  const box = state.box;
  it.x = Math.round(it.x / GRID) * GRID; it.y = Math.round(it.y / GRID) * GRID;
  if (!(it.x > box.x - WALL_SNAP && it.x < box.x + box.w + WALL_SNAP && it.y < box.y + box.h + WALL_SNAP)) return it;
  const b = aabb(polyOf(it));
  const dl = b.minX - box.x, dr = box.x + box.w - b.maxX, dt = b.minY - box.y, db = box.y + box.h - b.maxY;
  if (Math.abs(dl) <= WALL_SNAP && dl !== 0) it.x -= dl; else if (Math.abs(dr) <= WALL_SNAP && dr !== 0) it.x += dr;
  if (Math.abs(dt) <= WALL_SNAP && dt !== 0) it.y -= dt; else if (Math.abs(db) <= WALL_SNAP && db !== 0) it.y += db;
  it.x = Math.round(it.x * 1000) / 1000; it.y = Math.round(it.y * 1000) / 1000;
  return it;
}

/** 不改變狀態的放置預覽：吸附後的位置、合法與否、原因（給拖曳中的影子用） */
export function preview(state, id, x, y, angle) {
  const it = state.items.find((i) => i.id === id);
  const g = { ...it, x, y, angle: ((angle % 360) + 360) % 360 };
  snap(state, g);
  const reason = state.exploded ? '爆炸了，請重來' : validate(state, g);
  return { x: g.x, y: g.y, angle: g.angle, ok: !reason, reason, poly: polyOf(g) };
}

export function tryPlace(state, id, x, y, angle, { doSnap = true } = {}) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return { ok: false, reason: '這一章沒有這件物品' };
  if (state.exploded) return { ok: false, reason: '爆炸了，請重來' };
  const prev = { x: it.x, y: it.y, angle: it.angle };
  it.x = x; it.y = y; it.angle = ((angle % 360) + 360) % 360;
  if (doSnap) snap(state, it);
  const why = validate(state, it);
  if (why) { Object.assign(it, prev); state.message = `✗ 不能放：${why}，已退回上一個位置。`; evaluate(state); return { ok: false, reason: why }; }
  state.moves = (state.moves || 0) + 1;
  state.message = `✓ ${it.name}（${it.mood}）放好了。`;
  evaluate(state);
  return { ok: true, inBox: inBox(state, it) };
}
export function rotate(state, id, dir = 1) { const it = state.items.find((i) => i.id === id); return tryPlace(state, id, it.x, it.y, it.angle + dir * ROT_STEP); }

function check(state, cond) {
  const g = (id) => state.items.find((i) => i.id === id);
  if (cond.type === 'near') { const a = g(cond.a), b = g(cond.b); return !!a && !!b && inBox(state, a) && inBox(state, b) && gap(polyOf(a), polyOf(b)) < NEAR; }
  const a = g(cond.a); return !!a && inBox(state, a) && a.angle % 180 !== 0;
}
export function evaluate(state) {
  const rules = rulesOf(state);
  state.rules = Object.fromEntries(rules.map((r) => [r.id, check(state, r.cond)]));
  const boom = rules.find((r) => r.kind === 'boom' && state.rules[r.id]);
  if (boom) { state.ending = 'boom'; state.exploded = true; state.message = `💥 ${boom.name}：${boom.desc}`; return state; }
  const packed = state.items.every((i) => inBox(state, i));
  state.ending = packed && rules.every((r) => (r.kind === 'good' ? state.rules[r.id] : r.kind === 'bad' ? !state.rules[r.id] : true)) ? 'smooth' : null;
  return state;
}

/** 被物品實際形狀佔住的格子（給畫面上的格線用） */
export function occupiedCells(state) {
  const cells = new Set(), box = state.box;
  for (const it of state.items) {
    if (!inBox(state, it)) continue;
    const p = polyOf(it), b = aabb(p);
    for (let cx = Math.floor(b.minX / CELL); cx * CELL < b.maxX; cx++) for (let cy = Math.floor(b.minY / CELL); cy * CELL < b.maxY; cy++) {
      if (cx < 0 || cy < 0 || cx * CELL >= box.w || cy * CELL >= box.h) continue;
      const cell = [[cx * CELL, cy * CELL], [cx * CELL + CELL, cy * CELL], [cx * CELL + CELL, cy * CELL + CELL], [cx * CELL, cy * CELL + CELL]];
      if (overlaps(p, cell)) cells.add(`${cx},${cy}`);
    }
  }
  return cells;
}
export const colName = (cx) => (cx >= 26 ? String.fromCharCode(64 + Math.floor(cx / 26)) : '') + String.fromCharCode(65 + (cx % 26));
export const cellLabel = (cx, cy) => `${colName(cx)}${cy + 1}`;
