import { createState, reset, tryPlace, rotate, evaluate, polyOf, preview, occupiedCells, cellLabel, colName, ENDINGS, CHAPTERS, chapter, rulesOf, CELL, SPEC_CHAPTER } from './game.js';
import { art, ready, source, drawable, HAS_PNG } from './art.js';
import { stars, soClose, starRule, nextCombo, comboBonus, unlockItems, daily, today, load, save } from './meta.js';
import { ITEMS } from './game.js';

const M = 26; // 座標標籤邊界
const qs = new URLSearchParams(location.search);
const SAVE = load(localStorage);
SAVE.unlocked = Math.max(SAVE.unlocked, +(localStorage.getItem('witch-suitcase.unlocked') || 1)); // 舊版進度
let unlocked = Math.max(1, Math.min(CHAPTERS.length, SAVE.unlocked));
const persist = () => { SAVE.unlocked = unlocked; save(localStorage, SAVE); };
let run = { t0: performance.now(), combo: 0, maxCombo: 0, bonus: 0, result: null, daily: null, hints: 0 };
let pop = null, hintGhost = null; // 放好時的彈跳、提示影子
// 手機直式：桌面改到箱子下方，畫面放大很多
const LAYOUT = () => qs.get('layout') || (innerWidth < 700 && innerHeight > innerWidth ? 'portrait' : 'landscape');
if (HAS_PNG.has('cursor-open')) document.body.classList.add('hand-art');
let juice = []; // 粒子
let shake = null, floatTxt = null;
// 音效（WebAudio 合成，不用音檔）
let ac = null;
function beep(freq, dur = 0.08, type = 'triangle', vol = 0.15) {
  try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur); } catch {}
}
const sfx = { snap: (c) => { beep(520 + 80 * Math.min(c, 8)); setTimeout(() => beep(780 + 80 * Math.min(c, 8), 0.06), 50); }, bad: () => beep(140, 0.15, 'sawtooth', 0.1), boom: () => { for (let k = 0; k < 6; k++) setTimeout(() => beep(80 + Math.random() * 60, 0.2, 'square', 0.12), k * 40); }, win: () => [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => beep(f, 0.15), k * 110)) };
function place(fn) {
  const r = fn(); if (!r) return r;
  run.combo = nextCombo(run.combo, r); run.maxCombo = Math.max(run.maxCombo, run.combo);
  if (r.ok) {
    sfx.snap(run.combo);
    const it = state.items.find((i) => i.id === state.selected) || state.items[0];
    pop = { id: it.id, t0: performance.now() };
    if (r.inBox) for (let k = 0; k < 8 + run.combo * 4; k++) juice.push({ x: it.x, y: it.y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.8) * 260, t0: performance.now(), c: ['#f6d55c', '#ff8a3d', '#fff'][k % 3] });
    if (run.combo >= 2) { run.bonus += comboBonus(run.combo); floatTxt = { text: `連擊 ×${run.combo}！+${comboBonus(run.combo)}`, x: it.x, y: it.y - it.h / 2, t0: performance.now() }; shake = { t0: performance.now(), amp: 3 + run.combo }; }
    animate();
  } else sfx.bad();
  if (state.ending === 'smooth' && !run.result) finish();
  if (state.exploded) { run.combo = 0; sfx.boom(); }
  return r;
}
function finish() {
  const secs = (performance.now() - run.t0) / 1000, n = state.items.length;
  const st = stars(state.moves, secs, n, run.hints), close = run.hints ? null : soClose(state.moves, secs, n);
  if (!run.daily && state.chapter === 1) SAVE.tutorial = true;
  const key = run.daily ? `daily:${run.daily.date}` : String(state.chapter);
  const best = run.daily ? SAVE.daily[run.daily.date] || 0 : SAVE.best[key] || 0;
  const pts = st * 100 + run.bonus;
  if (run.daily) SAVE.daily[run.daily.date] = Math.max(best, st); else SAVE.best[key] = Math.max(best, st);
  const before = SAVE.collection.length; SAVE.collection = unlockItems(SAVE.collection, state.chapter);
  SAVE.score += pts; persist();
  run.result = { stars: st, secs, moves: state.moves, close, newItems: SAVE.collection.length - before, pts, best: Math.max(best, st) };
  sfx.win(); for (let k = 0; k < 60; k++) juice.push({ x: state.box.w / 2, y: state.box.h / 2, vx: (Math.random() - 0.5) * 700, vy: (Math.random() - 0.9) * 500, t0: performance.now(), c: ['#f6d55c', '#e07aa0', '#7fb3d5', '#fff'][k % 4] });
  animate();
}
let animating = false;
function animate() { if (animating) return; animating = true; const loop = (now) => { juice = juice.filter((p) => now - p.t0 < 900); if (shake && now - shake.t0 > 300) shake = null; if (pop && now - pop.t0 > 260) pop = null; if (hintGhost && now - hintGhost.t0 > 2500) hintGhost = null; if (floatTxt && now - floatTxt.t0 > 1100) floatTxt = null; draw(now); if (juice.length || shake || floatTxt || pop || hintGhost) requestAnimationFrame(loop); else { animating = false; draw(); } }; requestAnimationFrame(loop); }
const PREVIEW = qs.has('preview');
const startCh = PREVIEW ? SPEC_CHAPTER : Math.min(+(qs.get('chapter') || qs.get('level') || unlocked), unlocked);
const state = evaluate(createState(startCh, { layout: LAYOUT() }));
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let drag = null; // { id, dx, dy, x, y, pid }
let boomFx = null; // { t0, parts }

function sizeCanvas() { cv.width = state.world.w + M; cv.height = state.world.h + M; cv.style.maxWidth = `${cv.width}px`; }
function goChapter(n, opts) { drag = null; boomFx = null; const d = opts?.daily ?? (n === state.chapter ? run.daily : null); reset(state, n, { blocks: d ? d.blocks : [], layout: LAYOUT() }); evaluate(state); run = { t0: performance.now(), combo: 0, maxCombo: 0, bonus: 0, result: null, daily: d, hints: 0 }; pop = null; hintGhost = null; sizeCanvas(); render(); ready(state.items.map((i) => i.id).concat('suitcase', 'bg')).then(render); }

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * cv.width - M, ((e.clientY - r.top) / r.height) * cv.height - M];
}
function toScreen(x, y) { const r = cv.getBoundingClientRect(); return [r.left + ((x + M) / cv.width) * r.width, r.top + ((y + M) / cv.height) * r.height]; }
function hit(x, y) {
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i], a = (-it.angle * Math.PI) / 180;
    const lx = (x - it.x) * Math.cos(a) - (y - it.y) * Math.sin(a), ly = (x - it.x) * Math.sin(a) + (y - it.y) * Math.cos(a);
    if (Math.abs(lx) <= it.w / 2 && Math.abs(ly) <= it.h / 2) return it;
  }
  return null;
}
cv.addEventListener('pointerdown', (e) => {
  if (state.exploded || run.result) return; // 爆炸中或已過關：等重來／下一關
  const [x, y] = toWorld(e), it = hit(x, y);
  const wasSel = !!it && state.selected === it.id;
  state.selected = it ? it.id : null;
  if (it) { drag = { id: it.id, dx: x - it.x, dy: y - it.y, x: it.x, y: it.y, x0: it.x, y0: it.y, wasSel, pid: e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch {} }
  render();
});
// 游標：一般／滑到物品＝張開的手，拖曳中＝握拳（圖檔缺時 CSS 自動退回 grab／grabbing）
function setCursor() {
  cv.classList.toggle('grabbing', !!drag);
  cv.classList.toggle('over-item', !drag && hoverItem);
}
let hoverItem = false;
cv.addEventListener('pointermove', (e) => { if (!drag) { const [x, y] = toWorld(e); const h = !!hit(x, y) && !state.exploded; if (h !== hoverItem) { hoverItem = h; setCursor(); } } });
cv.addEventListener('pointerleave', () => { hoverItem = false; setCursor(); });
cv.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.pid) return; const [x, y] = toWorld(e); drag.x = x - drag.dx; drag.y = y - drag.dy; render(); });
function endDrag(e, cancel) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag; drag = null;
  const tap = Math.hypot(d.x - d.x0, d.y - d.y0) < 4;
  if (!cancel && tap) { if (d.wasSel) place(() => rotate(state, d.id, 1)); } // 點一下＝選取；再點一下＝旋轉（手機好用）
  else if (!cancel) { const it = state.items.find((i) => i.id === d.id); place(() => tryPlace(state, d.id, d.x, d.y, it.angle)); } else state.message = '拖曳取消。';
  render();
}
cv.addEventListener('pointerup', (e) => endDrag(e, false));
cv.addEventListener('pointercancel', (e) => endDrag(e, true));
const rot = (dir) => { if (run.result || state.exploded) return; if (!state.selected) { state.message = '先點選一件物品再旋轉。'; return render(); } place(() => rotate(state, state.selected, dir)); render(); };
document.getElementById('rotL').onclick = () => rot(-1);
document.getElementById('rotR').onclick = () => rot(1);
document.getElementById('reset').onclick = () => goChapter(state.chapter);
/** 提示：秀出一件還沒放對的物品的標準位置（本次最多 2 星） */
function hint() {
  if (run.result || state.exploded) return;
  const sol = chapter(state.chapter).configs.smooth;
  const id = Object.keys(sol).find((k) => { const it = state.items.find((i) => i.id === k), [x, y, a] = sol[k]; return Math.abs(it.x - x) > 1 || Math.abs(it.y - y) > 1 || it.angle !== a; });
  if (!id) return;
  const [x, y, angle] = sol[id]; run.hints++; hintGhost = { id, x, y, angle, t0: performance.now() }; state.selected = id;
  state.message = `💡 試試把「${state.items.find((i) => i.id === id).name}」放到發光的位置（用了提示，本次最多 2 星）`; render(); animate();
}
document.getElementById('hint').onclick = hint;
addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') rot(e.shiftKey ? -1 : 1); if (e.key === 'Escape' && drag) { drag = null; state.message = '拖曳取消。'; render(); } });

function pathPoly(p) { ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
function drawItem(it, x, y, angle, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate((angle * Math.PI) / 180);
  if (pop && pop.id === it.id) { const k = Math.sin(Math.min(1, (performance.now() - pop.t0) / 260) * Math.PI); ctx.scale(1 + 0.12 * k, 1 - 0.08 * k); }
  ctx.shadowColor = 'rgba(40,20,10,.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  if (drawable(it.id)) ctx.drawImage(art(it.id), -it.w / 2, -it.h / 2, it.w, it.h);
  else { // 美術缺檔：圓角色塊＋名稱
    const r = Math.min(12, it.w / 4, it.h / 4); ctx.beginPath(); ctx.roundRect(-it.w / 2, -it.h / 2, it.w, it.h, r);
    ctx.fillStyle = it.color; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#2b1d16'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2b1d16'; ctx.lineWidth = 3; ctx.font = `bold ${Math.max(11, Math.min(16, it.h / 3))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(it.name, 0, 0); ctx.fillText(it.name, 0, 0);
  }
  ctx.restore();
}
const BADGE = { good: '💖', bad: '💢', boom: '💥' };
function draw(now = performance.now()) {
  const B = state.box, T = state.table;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#2a2340'; ctx.fillRect(0, 0, cv.width, cv.height);
  let sx = 0, sy = 0;
  if (shake) { const k = 1 - (now - shake.t0) / 300; sx += (Math.random() - 0.5) * shake.amp * 2 * k; sy += (Math.random() - 0.5) * shake.amp * 2 * k; }
  if (boomFx) { const k = Math.max(0, 1 - (now - boomFx.t0) / 600); sx = (Math.random() - 0.5) * 16 * k; sy = (Math.random() - 0.5) * 16 * k; }
  ctx.translate(M + sx, M + sy);
  // 座標標籤
  ctx.fillStyle = '#d9c8f0'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let cx = 0; cx * CELL < B.w; cx++) ctx.fillText(colName(cx), cx * CELL + CELL / 2, -12);
  for (let cy = 0; cy * CELL < B.h; cy++) ctx.fillText(String(cy + 1), -13, cy * CELL + CELL / 2);
  if (state.layout === 'portrait') ctx.drawImage(art('bg'), T.x, T.y - 20, T.w, T.h + 20); else ctx.drawImage(art('bg'), T.x - 40, 0, T.w + 40, T.h);
  ctx.drawImage(art('suitcase'), B.x, B.y, B.w, B.h);
  // 格線＋佔用格
  const occ = occupiedCells(state);
  ctx.fillStyle = 'rgba(224,138,82,.28)';
  for (const k of occ) { const [cx, cy] = k.split(',').map(Number); ctx.fillRect(cx * CELL, cy * CELL, CELL, CELL); }
  for (const b of state.blocks) { ctx.fillStyle = 'rgba(70,40,90,.55)'; ctx.beginPath(); ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, 10); ctx.fill(); ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🫧', b.x + b.w / 2, b.y + b.h / 2); }
  ctx.strokeStyle = 'rgba(94,50,24,.35)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= B.w; x += CELL) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, B.h); }
  for (let y = 0; y <= B.h; y += CELL) { ctx.moveTo(0, y + 0.5); ctx.lineTo(B.w, y + 0.5); }
  ctx.stroke();
  ctx.fillStyle = '#f6e6a8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`桌面（暫放區）`, T.x + 6, T.y + T.h - 10);
  if (hintGhost) { const it = state.items.find((i) => i.id === hintGhost.id), k = 0.5 + 0.5 * Math.sin(performance.now() / 150); pathPoly(polyOf({ ...it, x: hintGhost.x, y: hintGhost.y, angle: hintGhost.angle })); ctx.fillStyle = `rgba(120,230,255,${0.2 + 0.25 * k})`; ctx.fill(); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#5fd3f3'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
  // 影子預覽
  let pv = null;
  if (drag) {
    const it = state.items.find((i) => i.id === drag.id);
    pv = preview(state, it.id, drag.x, drag.y, it.angle);
    pathPoly(pv.poly); ctx.fillStyle = pv.ok ? 'rgba(80,200,120,.35)' : 'rgba(230,60,60,.35)'; ctx.fill();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = pv.ok ? '#2f9e5a' : '#d0312d'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
  }
  for (const it of state.items) {
    const dragging = drag && drag.id === it.id;
    drawItem(it, dragging ? drag.x : it.x, dragging ? drag.y : it.y, it.angle, dragging ? 0.75 : 1);
    if (state.selected === it.id && !dragging) { pathPoly(polyOf(it)); ctx.setLineDash([8, 5]); ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
  }
  if (pv) {
    const [x, y] = [pv.x, pv.y - 14 - state.items.find((i) => i.id === drag.id).h / 2];
    const label = pv.ok ? `✓ 可以放（${cellLabel(Math.floor((pv.x) / CELL), Math.floor((pv.y) / CELL))}）` : `✗ ${pv.reason}`;
    ctx.font = 'bold 14px sans-serif'; const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = pv.ok ? '#2f9e5a' : '#d0312d'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 24, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(label, x, y);
  }
  // 規則徽章
  ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
  for (const r of rulesOf(state)) if (state.rules[r.id]) { const it = state.items.find((i) => i.id === r.cond.a); if (it) ctx.fillText(BADGE[r.kind], it.x + it.w / 2 - 6, it.y - it.h / 2 + 12); }
  if (state.ending === 'smooth') {
    ctx.fillStyle = 'rgba(255,214,120,.25)'; ctx.fillRect(B.x, B.y, B.w, B.h);
    ctx.font = 'bold 40px sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#fff8ec'; ctx.strokeText('✨ 順利出發！', B.w / 2, B.h / 2); ctx.fillStyle = '#8a5a12'; ctx.fillText('✨ 順利出發！', B.w / 2, B.h / 2);
  }
  for (const p of juice) { const t = (now - p.t0) / 1000; ctx.globalAlpha = Math.max(0, 1 - t / 0.9); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x + p.vx * t, p.y + p.vy * t + 400 * t * t, 4, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  if (floatTxt) { const t = (now - floatTxt.t0) / 1100; ctx.globalAlpha = 1 - t; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = '#2a2340'; ctx.strokeText(floatTxt.text, floatTxt.x, floatTxt.y - 30 * t); ctx.fillStyle = '#f6d55c'; ctx.fillText(floatTxt.text, floatTxt.x, floatTxt.y - 30 * t); ctx.globalAlpha = 1; }
  if (boomFx) { // 爆炸動畫：閃光＋碎片＋字
    const t = (now - boomFx.t0) / 1000;
    ctx.fillStyle = `rgba(255,${Math.round(200 - 150 * Math.min(1, t * 2))},80,${Math.max(0, 0.6 - t * 0.5)})`; ctx.fillRect(B.x, B.y, B.w, B.h);
    for (const p of boomFx.parts) { const x = p.x + p.vx * t, y = p.y + p.vy * t + 300 * t * t; ctx.fillStyle = p.c; ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s); }
    ctx.font = `bold ${40 + 20 * Math.min(1, t * 3)}px sans-serif`; ctx.lineWidth = 8; ctx.strokeStyle = '#fff8ec';
    ctx.strokeText('💥 爆炸啦！', B.w / 2, B.h / 2); ctx.fillStyle = '#a3122f'; ctx.fillText('💥 爆炸啦！', B.w / 2, B.h / 2);
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('整關重來中……', B.w / 2, B.h / 2 + 40);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function startBoom() {
  const B = state.box, parts = [];
  for (const it of state.items) for (let k = 0; k < 10; k++) parts.push({ x: it.x, y: it.y, vx: (Math.random() - 0.5) * 600, vy: -Math.random() * 400, s: 4 + Math.random() * 8, c: it.color });
  boomFx = { t0: performance.now(), parts };
  const loop = (now) => { if (!boomFx) return; draw(now); if (now - boomFx.t0 < 1800) requestAnimationFrame(loop); else goChapter(state.chapter); };
  requestAnimationFrame(loop);
}
function openBook() {
  const dlg = document.getElementById('book');
  dlg.querySelector('.grid').innerHTML = ITEMS.map((it) => SAVE.collection.includes(it.id)
    ? `<div class="entry"><div class="sw" style="background:${it.color};aspect-ratio:${it.w}/${it.h}"></div><b>${it.name}</b><small>${it.mood}・${it.w / CELL}×${it.h / CELL} 格</small></div>`
    : `<div class="entry locked"><div class="sw"></div><b>？？？</b><small>過關後收錄</small></div>`).join('');
  dlg.querySelector('.count').textContent = `${SAVE.collection.length}/${ITEMS.length}`;
  dlg.showModal();
}
setInterval(() => { if (!run.result && !state.exploded) document.getElementById('hud') && render(); }, 1000);
function render() {
  setCursor();
  if (state.ending === 'smooth' && !run.daily && state.chapter < CHAPTERS.length && unlocked <= state.chapter) { unlocked = state.chapter + 1; persist(); }
  const ch = chapter(state.chapter);
  document.getElementById('levels').innerHTML = CHAPTERS.map((c) =>
    `<button data-level="${c.n}" class="${c.n === state.chapter ? 'cur' : ''}" ${c.n > unlocked ? 'disabled' : ''} title="${c.title}">${c.n > unlocked ? '🔒' : ''}${c.n <= 5 ? `第 ${c.n} 章` : '特別篇'}・${c.client} ${'★'.repeat(SAVE.best[c.n] || 0)}</button>`).join('')
    + `<button id="dailyBtn" class="daily">📅 每日挑戰 ${SAVE.daily[today()] ? '★'.repeat(SAVE.daily[today()]) : ''}</button><button id="bookBtn">📖 圖鑑 ${SAVE.collection.length}/${ITEMS.length}</button>`
    + `<span class="lvinfo">「${ch.title}」${ch.items.length} 件・箱子 ${ch.box.w}×${ch.box.h}（${ch.box.w / CELL}×${ch.box.h / CELL} 格）・${ch.rules.length} 條規則</span>`
    + (state.ending === 'smooth' && !run.daily && state.chapter < CHAPTERS.length ? `<button id="next" class="next">下一位客人 →</button>` : '');
  const secs = Math.floor((performance.now() - run.t0) / 1000), rule = starRule(state.items.length);
  document.getElementById('hud').innerHTML = `${run.daily ? `📅 每日挑戰 ${run.daily.date}・` : ''}步數 <b>${state.moves}</b>／三星 ≤${rule.m3}・時間 <b>${secs}</b>s／三星 ≤${rule.t3}s・連擊 <b>×${run.combo}</b>・總分 <b>${SAVE.score}</b>`;
  const R = run.result, res = document.getElementById('result');
  res.hidden = !R;
  if (R) res.innerHTML = `<div class="stars">${'★'.repeat(R.stars)}${'☆'.repeat(3 - R.stars)}</div><div>${R.moves} 步・${R.secs.toFixed(1)} 秒・最高連擊 ×${run.maxCombo}・+${R.pts} 分</div>`
    + (R.close ? `<div class="close">差一點就三星！只差 ${R.close.moves ? `${R.close.moves} 步` : ''}${R.close.moves && R.close.secs ? '、' : ''}${R.close.secs ? `${R.close.secs} 秒` : ''}</div>` : '')
    + (R.newItems ? `<div>📖 圖鑑新收錄 ${R.newItems} 件！</div>` : '')
    + `<button id="retry">${R.stars < 3 ? '再挑戰三星' : '再玩一次'}</button>`;
  const rt = document.getElementById('retry'); if (rt) rt.onclick = () => goChapter(state.chapter);
  document.getElementById('dailyBtn').onclick = () => { const d = daily(today(), unlocked); goChapter(d.chapter, { daily: d }); };
  document.getElementById('bookBtn').onclick = openBook;
  document.querySelectorAll('#levels [data-level]').forEach((b) => (b.onclick = () => goChapter(+b.dataset.level)));
  const nx = document.getElementById('next'); if (nx) nx.onclick = () => goChapter(state.chapter + 1);
  document.getElementById('msg').textContent = state.message;
  // 新手教學（第 1 章第一次玩）
  const coach = document.getElementById('coach'), showCoach = !SAVE.tutorial && state.chapter === 1 && !run.daily && !run.result && !PREVIEW;
  coach.hidden = !showCoach;
  if (showCoach) {
    coach.innerHTML = (state.moves === 0 ? `① 把${state.layout === 'portrait' ? '下面' : '右邊'}桌上的東西拖進行李箱。拖的時候綠色＝可以放，紅色＝不行。`
      : state.moves < 3 ? '② 小心規則：💢 高跟鞋挨著吹風機會被吹歪！點一下選取、再點一下可以旋轉。'
      : '③ 全部放進箱子、規則都 OK 就過關。卡住可以按 💡 提示。') + '<button id="coachSkip">知道了</button>';
    document.getElementById('coachSkip').onclick = () => { SAVE.tutorial = true; persist(); render(); };
  }
  const kindTxt = { good: '必要', bad: '不可以', boom: '會爆炸' };
  document.getElementById('rules').innerHTML = rulesOf(state).map((r, i) =>
    `<div class="rule ${state.rules[r.id] ? 'on' : ''} ${r.kind}" data-rule="${r.id}">${state.rules[r.id] ? '● 成立' : '○ 未成立'}｜${BADGE[r.kind]}<b>${'①②③④'[i]} ${r.name}</b>（${kindTxt[r.kind]}）：${r.desc}</div>`).join('');
  const el = document.getElementById('ending');
  el.className = state.ending === 'boom' ? 'chaos' : state.ending || '';
  el.textContent = state.ending ? `🎉 結局：${ENDINGS[state.ending].name}` : '尚未達成';
  document.getElementById('endingList').innerHTML = Object.values(ENDINGS).map((e) => `<div>・${e.name}：${e.desc}</div>`).join('');
  if (state.exploded && !boomFx) startBoom();
  draw();
}
window.__game = {
  artSource: source, state, render, toScreen, goChapter, goLevel: goChapter,
  tryPlace: (...a) => { const r = tryPlace(state, ...a); render(); return r; }, rotate: (...a) => { const r = rotate(state, ...a); render(); return r; },
  reset: () => document.getElementById('reset').click(), get dragging() { return drag; }, get unlocked() { return unlocked; }, get exploding() { return !!boomFx; },
  unlockAll: () => { unlocked = CHAPTERS.length; persist(); render(); }, get run() { return run; }, save: SAVE, daily: () => daily(today(), unlocked), hint, get hintGhost() { return hintGhost; },
};
sizeCanvas();
ready(state.items.map((i) => i.id).concat('suitcase', 'bg')).then(render);
render();

// 預覽模式（?preview）：自動示範，給入口頁縮圖用
if (PREVIEW) {
  document.body.classList.add('preview');
  const cfg = chapter(SPEC_CHAPTER).configs, order = Object.keys(cfg.smooth);
  let step = 0;
  setInterval(() => {
    if (boomFx) return;
    if (step < order.length) { const id = order[step]; state.selected = id; tryPlace(state, id, ...cfg.smooth[id]); }
    else if (step === order.length + 3) { state.selected = 'potion'; tryPlace(state, 'potion', ...cfg.boom.potion); step = -1; }
    step++; render();
  }, 700);
}
