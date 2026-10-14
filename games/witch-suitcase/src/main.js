import { createState, reset, tryPlace, rotate, evaluate, polyOf, RULES, ENDINGS, SUITCASE, TABLE } from './game.js';

const state = evaluate(createState());
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let drag = null; // { id, dx, dy, x, y }

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
}
function hit(x, y) {
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i], a = (-it.angle * Math.PI) / 180;
    const lx = (x - it.x) * Math.cos(a) - (y - it.y) * Math.sin(a);
    const ly = (x - it.x) * Math.sin(a) + (y - it.y) * Math.cos(a);
    if (Math.abs(lx) <= it.w / 2 && Math.abs(ly) <= it.h / 2) return it;
  }
  return null;
}
cv.addEventListener('pointerdown', (e) => {
  const [x, y] = toWorld(e), it = hit(x, y);
  state.selected = it ? it.id : null;
  if (it) {
    drag = { id: it.id, dx: x - it.x, dy: y - it.y, x: it.x, y: it.y, pid: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch {}
  }
  draw();
});
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  const [x, y] = toWorld(e); drag.x = x - drag.dx; drag.y = y - drag.dy; draw();
});
function endDrag(e, cancel) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag; drag = null;
  if (!cancel) { const it = state.items.find((i) => i.id === d.id); tryPlace(state, d.id, d.x, d.y, it.angle); }
  else state.message = '拖曳取消。';
  render();
}
cv.addEventListener('pointerup', (e) => endDrag(e, false));
cv.addEventListener('pointercancel', (e) => endDrag(e, true));
const rot = (dir) => { if (!state.selected) { state.message = '先點選一件物品再旋轉。'; return render(); } rotate(state, state.selected, dir); render(); };
document.getElementById('rotL').onclick = () => rot(-1);
document.getElementById('rotR').onclick = () => rot(1);
document.getElementById('reset').onclick = () => { drag = null; reset(state); evaluate(state); render(); };
addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') rot(e.shiftKey ? -1 : 1); if (e.key === 'Escape' && drag) { drag = null; state.message = '拖曳取消。'; render(); } });

function drawPoly(p, fill, stroke, lw = 2) {
  ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
}
function draw() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#e8d9bf'; ctx.fillRect(SUITCASE.x, SUITCASE.y, SUITCASE.w, SUITCASE.h);
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4; ctx.strokeRect(SUITCASE.x + 2, SUITCASE.y + 2, SUITCASE.w - 4, SUITCASE.h - 4);
  ctx.fillStyle = '#ddd'; ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
  ctx.fillStyle = '#666'; ctx.font = '14px sans-serif'; ctx.fillText('行李箱 600×400', 8, 392); ctx.fillText('桌面（暫放區）', TABLE.x + 8, 392);
  for (const it of state.items) {
    const ghost = drag && drag.id === it.id;
    const p = polyOf(ghost ? { ...it, x: drag.x, y: drag.y } : it);
    const sel = state.selected === it.id;
    drawPoly(p, it.color + (ghost ? '99' : 'dd'), sel ? '#ff6a00' : '#222', sel ? 4 : 2);
    const cx = ghost ? drag.x : it.x, cy = ghost ? drag.y : it.y;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(it.name, cx, cy + 5); ctx.textAlign = 'left';
  }
  if (state.ending) {
    ctx.fillStyle = state.ending === 'chaos' ? 'rgba(176,0,32,.18)' : 'rgba(10,125,44,.15)';
    ctx.fillRect(SUITCASE.x, SUITCASE.y, SUITCASE.w, SUITCASE.h);
  }
}
function render() {
  document.getElementById('msg').textContent = state.message;
  document.getElementById('rules').innerHTML = RULES.map((r) =>
    `<div class="rule ${state.rules[r.id] ? 'on' : ''}" data-rule="${r.id}">${state.rules[r.id] ? '● 觸發' : '○ 未觸發'}｜<b>${r.name}</b>：${r.desc}</div>`).join('');
  const el = document.getElementById('ending');
  el.className = state.ending || '';
  el.textContent = state.ending ? `🎉 結局：${ENDINGS[state.ending].name}` : '尚未達成';
  document.getElementById('endingList').innerHTML = Object.values(ENDINGS).map((e) => `<div>・${e.name}：${e.desc}</div>`).join('');
  draw();
}
window.__game = { state, render, tryPlace: (...a) => { const r = tryPlace(state, ...a); render(); return r; }, rotate: (...a) => { const r = rotate(state, ...a); render(); return r; }, reset: () => document.getElementById('reset').click(), get dragging() { return drag; } };
render();
