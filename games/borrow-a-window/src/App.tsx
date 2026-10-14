import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as L from './logic';
import { Scene, type Picker } from './Scene';

const model = L.createModel(performance.now());
declare global { interface Window { __win: any } }

export default function App() {
  const pickerRef = useRef<Picker | null>(null);
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 100); return () => clearInterval(t); }, []);
  useEffect(() => {
    window.__win = {
      model, L,
      project: (id: L.HotspotId) => pickerRef.current?.project(id),
      pick: (x: number, y: number) => pickerRef.current?.pick(x, y),
      reset: () => doReset(),
    };
  }, []);
  const wrap = useRef<HTMLDivElement>(null);
  const doReset = () => { L.reset(model, performance.now()); force((n) => n + 1); };
  const onDown = (e: React.PointerEvent) => {
    L.pointerDown(model, e.pointerId, e.clientX, e.clientY);
    try { wrap.current?.setPointerCapture(e.pointerId); } catch { /* 合成事件可能無法 capture */ }
  };
  const onMove = (e: React.PointerEvent) => L.pointerMove(model, e.pointerId, e.clientX, e.clientY);
  const onUp = (e: React.PointerEvent) => {
    if (L.pointerUp(model, e.pointerId) === 'tap') {
      const id = pickerRef.current?.pick(e.clientX, e.clientY);
      if (id) L.activate(model, id, performance.now());
    }
    force((n) => n + 1);
  };
  const now = performance.now();
  const act = L.activeAt(model, now);
  const t = L.loopTime(now, model.start);
  const hs = act ? L.HOTSPOTS.find((h) => h.id === act.id)! : null;
  return (
    <div style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui, "Noto Sans CJK TC", sans-serif', background: '#222' }}>
      <div ref={wrap} data-testid="stage" style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => L.pointerCancel(model)}>
        <Canvas camera={{ position: [0, 0, 4], fov: 50, near: 0.1, far: 200 }} dpr={[1, 2]}>
          <Scene model={model} pickerRef={pickerRef} />
        </Canvas>
      </div>
      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', color: '#fff', pointerEvents: 'none' }}>
        <b style={{ fontSize: 18 }}>借一扇窗 <small>灰盒</small></b>
        <span data-testid="found" style={{ background: '#0008', padding: '4px 8px', borderRadius: 6 }}>已發現 {model.found.size}/3</span>
        <span data-testid="timer" style={{ background: '#0008', padding: '4px 8px', borderRadius: 6 }}>循環 {t.toFixed(1)}s／30s・第 {L.loopIndex(now, model.start) + 1} 輪</span>
        <button data-testid="reset" onClick={doReset} style={{ pointerEvents: 'auto', fontSize: 16, minHeight: 44, padding: '6px 14px', borderRadius: 8 }}>重來 reset</button>
      </div>
      <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, color: '#fff', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {hs && <div data-testid="feedback" style={{ background: '#e8a33dee', color: '#111', padding: '8px 12px', borderRadius: 8, fontWeight: 'bold' }}>✦ {hs.layer}・{hs.name}：{hs.text}</div>}
        <div style={{ background: '#0008', padding: '6px 10px', borderRadius: 8, fontSize: 14 }}>
          按住拖曳轉動視線（左右 ±{L.YAW_MAX}°、上下 ±{L.PITCH_MAX}°）。點一下閃著黃色光圈的東西：近、中、遠各藏一個。
          {' '}找到：{L.HOTSPOTS.map((h) => (model.found.has(h.id) ? `✓${h.name}` : `？${h.layer}`)).join('　')}
        </div>
      </div>
    </div>
  );
}
