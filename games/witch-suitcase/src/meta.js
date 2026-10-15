// 上癮機制（純邏輯）：星等、連擊、圖鑑、每日挑戰、存檔
import { CHAPTERS, chapter, createState, polyOf, CELL } from './game.js';
import { overlaps } from './geometry.js';

/** 星等：步數（成功放置＋旋轉）與時間。標準步數＝本章物品數。 */
export function starRule(nItems) { return { m3: nItems + 1, t3: nItems * 12, m2: nItems * 2, t2: nItems * 30 }; }
export function stars(moves, secs, nItems) {
  const r = starRule(nItems);
  if (moves <= r.m3 && secs <= r.t3) return 3;
  if (moves <= r.m2 && secs <= r.t2) return 2;
  return 1;
}
/** 差一點三星：只差 ≤2 步或 ≤10 秒 */
export function soClose(moves, secs, nItems) {
  const r = starRule(nItems);
  if (stars(moves, secs, nItems) === 3) return null;
  const dm = Math.max(0, moves - r.m3), dt = Math.max(0, Math.ceil(secs - r.t3));
  if ((dm <= 2 && dt <= 10)) return { moves: dm, secs: dt };
  return null;
}

/** 連擊：連續把物品放進箱子（沒有非法嘗試）就累加 */
export function nextCombo(combo, result) { return result.ok && result.inBox ? combo + 1 : result.ok ? combo : 0; }
export const comboBonus = (combo) => (combo >= 2 ? combo * 10 : 0);

/** 圖鑑：過關後解鎖該章所有物品 */
export function unlockItems(collection, chapterN) { const set = new Set(collection); for (const id of chapter(chapterN).items) set.add(id); return [...set]; }

/** 每日挑戰：以日期為種子，固定章節＋兩塊污漬（避開該章的標準解，所以一定可解） */
export function seedOf(dateStr) { let h = 2166136261; for (const ch of dateStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function daily(dateStr) {
  const r = rng(seedOf(dateStr));
  const ch = CHAPTERS[Math.floor(r() * CHAPTERS.length)];
  const sol = Object.entries(ch.configs.smooth).map(([id, [x, y, angle]]) => polyOf({ ...createState(ch.n).items.find((i) => i.id === id), x, y, angle }));
  const blocks = [];
  for (let tries = 0; blocks.length < 2 && tries < 500; tries++) {
    const w = CELL * 2, h = CELL * 2;
    const x = Math.floor(r() * (ch.box.w / CELL - 1)) * CELL, y = Math.floor(r() * (ch.box.h / CELL - 1)) * CELL;
    const poly = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    if (sol.some((p) => overlaps(p, poly)) || blocks.some((b) => b.x === x && b.y === y)) continue;
    blocks.push({ x, y, w, h });
  }
  return { date: dateStr, chapter: ch.n, blocks };
}
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 存檔（localStorage），壞檔就重來 */
export const SAVE_KEY = 'witch-suitcase.save.v1';
export function load(storage) {
  try { const s = JSON.parse(storage.getItem(SAVE_KEY) || '{}'); return { unlocked: s.unlocked || 1, best: s.best || {}, collection: s.collection || [], daily: s.daily || {}, score: s.score || 0 }; }
  catch { return { unlocked: 1, best: {}, collection: [], daily: {}, score: 0 }; }
}
export function save(storage, data) { storage.setItem(SAVE_KEY, JSON.stringify(data)); }
