import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as L from './logic';
import { Scene, type Picker } from './Scene';
import { artSource } from './art';

const model = L.createModel(performance.now());
const PREVIEW = new URLSearchParams(location.search).has('preview');
if (PREVIEW) { // 入口頁預覽：自動左右張望、隱藏介面
  setInterval(() => { const k = performance.now() / 1000; model.view = { yaw: 9 * Math.sin(k * 0.5), pitch: 3 * Math.sin(k * 0.3) }; }, 33);
}
declare global { interface Window { __win: any } }

const KEY = 'borrow-a-window.unlocked';
const BEST_KEY = 'borrow-a-window.best';
const loadBest = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); } catch { return {}; } };
let ac: AudioContext | null = null;
const chime = (f: number) => { try { ac ??= new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.5); } catch { /* 無音效 */ } };
const qs = new URLSearchParams(location.search);
export default function App() {
  const [unlocked, setUnlocked] = useState(() => Math.max(1, Math.min(L.LEVELS.length, +(localStorage.getItem(KEY) || 1))));
  const [level, setLevel] = useState(() => (PREVIEW ? 2 : Math.min(+(qs.get('level') || unlocked), unlocked)));
  const [note, setNote] = useState('');
  const [best, setBest] = useState(loadBest);
  const [result, setResult] = useState<{ stars: number; secs: number; close: number | null } | null>(null);
  const t0 = useRef(performance.now());
  const resultRef = useRef(result); resultRef.current = result;
  const levelRef = useRef(level); levelRef.current = level;
  const goLevel = (n: number) => { setLevel(n); levelRef.current = n; setNote(''); setResult(null); t0.current = performance.now(); L.reset(model, performance.now()); };
  const pickerRef = useRef<Picker | null>(null);
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 100); return () => clearInterval(t); }, []);
  useEffect(() => {
    window.__win = {
      model, L, artSource,
      project: (id: L.HotspotId) => pickerRef.current?.project(id),
      pick: (x: number, y: number) => pickerRef.current?.pick(x, y),
      reset: () => doReset(), result: () => resultRef.current, goLevel: (n: number) => goLevel(n), level: () => levelRef.current,
      unlockAll: () => { localStorage.setItem(KEY, String(L.LEVELS.length)); setUnlocked(L.LEVELS.length); },
    };
  }, []);
  const wrap = useRef<HTMLDivElement>(null);
  const doReset = () => { L.reset(model, performance.now()); setNote(''); setResult(null); t0.current = performance.now(); force((n) => n + 1); };
  const onDown = (e: React.PointerEvent) => {
    L.pointerDown(model, e.pointerId, e.clientX, e.clientY);
    try { wrap.current?.setPointerCapture(e.pointerId); } catch { /* 合成事件可能無法 capture */ }
  };
  const onMove = (e: React.PointerEvent) => L.pointerMove(model, e.pointerId, e.clientX, e.clientY);
  const onUp = (e: React.PointerEvent) => {
    if (L.pointerUp(model, e.pointerId) === 'tap') {
      const id = pickerRef.current?.pick(e.clientX, e.clientY);
      if (id) {
        const r = L.tryActivate(model, levelRef.current, id, performance.now());
        setNote(r === 'wait-night' ? '路燈還沒亮……等天色暗一點再點。' : '');
        if (r === 'ok') chime(660 + 110 * model.found.size);
        if (r === 'ok' && L.cleared(model, levelRef.current) && !result) {
          const secs = (performance.now() - t0.current) / 1000, n = L.levelOf(levelRef.current).spots.length;
          const st = L.windowStars(secs, n);
          setResult({ stars: st, secs, close: L.windowSoClose(secs, n) });
          const b = { ...loadBest(), [levelRef.current]: Math.max(loadBest()[levelRef.current] || 0, st) }; localStorage.setItem(BEST_KEY, JSON.stringify(b)); setBest(b);
          [784, 988, 1175].forEach((f, k) => setTimeout(() => chime(f), 150 * k));
        }
        if (r === 'ok' && L.cleared(model, levelRef.current) && levelRef.current >= unlocked && levelRef.current < L.LEVELS.length) {
          const u = levelRef.current + 1; localStorage.setItem(KEY, String(u)); setUnlocked(u);
        }
      }
    }
    force((n) => n + 1);
  };
  const now = performance.now();
  const act = L.activeAt(model, now);
  const t = L.loopTime(now, model.start);
  const hs = act ? L.ALL_SPOTS.find((h) => h.id === act.id)! : null;
  const LV = L.levelOf(level), spots = L.spotsOf(level), done = L.cleared(model, level);
  return (
    <div style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui, "Noto Sans CJK TC", sans-serif', background: '#222' }}>
      <div ref={wrap} data-testid="stage" style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => L.pointerCancel(model)}>
        <Canvas camera={{ position: [0, 0, 4], fov: 50, near: 0.1, far: 200 }} dpr={[1, 2]}>
          <Scene model={model} pickerRef={pickerRef} level={level} />
        </Canvas>
      </div>
      {!PREVIEW && <>
      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', color: '#fff', pointerEvents: 'none' }}>
        <b style={{ fontSize: 18 }}>借一扇窗 <small>灰盒</small></b>
        <span data-testid="found" style={{ background: '#0008', padding: '4px 8px', borderRadius: 6 }}>第 {level} 關「{LV.name}」・已發現 {spots.filter((h) => model.found.has(h.id)).length}/{spots.length}</span>
        <span data-testid="timer" style={{ background: '#0008', padding: '4px 8px', borderRadius: 6 }}>循環 {t.toFixed(1)}s／30s・第 {L.loopIndex(now, model.start) + 1} 輪</span>
        {L.LEVELS.map((l) => (
          <button key={l.n} data-level={l.n} disabled={l.n > unlocked} onClick={() => goLevel(l.n)}
            style={{ pointerEvents: 'auto', minHeight: 40, padding: '4px 10px', borderRadius: 8, background: l.n === level ? '#e08a52' : '#fff8ec', color: l.n === level ? '#fff' : '#333' }}>
            {l.n > unlocked ? '🔒' : ''}{l.n}{best[l.n] ? ' ' + '★'.repeat(best[l.n]) : ''}</button>))}
        {done && level < L.LEVELS.length && <button data-testid="next" onClick={() => goLevel(level + 1)} style={{ pointerEvents: 'auto', minHeight: 44, padding: '6px 14px', borderRadius: 8, background: '#f6d55c', fontWeight: 'bold' }}>過關！下一關 →</button>}
        <button data-testid="reset" onClick={doReset} style={{ pointerEvents: 'auto', fontSize: 16, minHeight: 44, padding: '6px 14px', borderRadius: 8 }}>重來 reset</button>
      </div>
      <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, color: '#fff', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {note && <div data-testid="note" style={{ background: '#334e', padding: '8px 12px', borderRadius: 8 }}>{note}</div>}
        {done && <div data-testid="clear" style={{ background: '#2f7d4fee', padding: '8px 12px', borderRadius: 8, fontWeight: 'bold' }}>✓ 第 {level} 關完成{level === L.LEVELS.length ? '，全部通關！' : ''}
          {result && <span data-testid="stars" style={{ marginLeft: 8, color: '#f6d55c', fontSize: 20 }}>{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)} <small style={{ color: '#fff' }}>{result.secs.toFixed(1)} 秒（三星 ≤{L.starTimes(spots.length).t3} 秒）</small></span>}
          {result?.close && <span style={{ marginLeft: 8 }}>差一點就三星！只差 {result.close} 秒 <button onClick={doReset} style={{ pointerEvents: 'auto' }}>再試一次</button></span>}</div>}
        {hs && <div data-testid="feedback" style={{ background: '#e8a33dee', color: '#111', padding: '8px 12px', borderRadius: 8, fontWeight: 'bold' }}>✦ {hs.layer}・{hs.name}：{hs.text}</div>}
        <div style={{ background: '#0008', padding: '6px 10px', borderRadius: 8, fontSize: 14 }}>
          按住拖曳轉動視線（左右 ±{L.YAW_MAX}°、上下 ±{L.PITCH_MAX}°）。{LV.desc}
          {' '}找到：{spots.map((h) => (model.found.has(h.id) ? `✓${h.name}` : `？${h.layer}`)).join('　')}
        </div>
      </div>
      </>}
    </div>
  );
}
