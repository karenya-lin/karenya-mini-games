import { useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as L from './logic';

export interface Picker { pick(cx: number, cy: number): L.HotspotId | null; project(id: L.HotspotId): [number, number] | null }

const skyDay = new THREE.Color('#9cc9e8'), skyDusk = new THREE.Color('#e9a77c');

function Hotspot({ id, children, ringR, refs }: { id: L.HotspotId; children: React.ReactNode; ringR: number; refs: MutableRefObject<Record<string, THREE.Object3D>> }) {
  const h = L.HOTSPOTS.find((x) => x.id === id)!;
  return (
    <group position={h.pos} userData={{ hotspot: id }} ref={(o) => { if (o) refs.current[id] = o; }}>
      {children}
      <mesh name={`ring-${id}`} userData={{ hotspot: id }}>
        <ringGeometry args={[ringR * 0.85, ringR, 32]} />
        <meshBasicMaterial color="#ffd84a" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Scene({ model, pickerRef }: { model: L.Model; pickerRef: MutableRefObject<Picker | null> }) {
  const { camera, scene, gl, raycaster } = useThree();
  const refs = useRef<Record<string, THREE.Object3D>>({});
  const sun = useRef<THREE.Mesh>(null!), blades = useRef<THREE.Group>(null!), cloud = useRef<THREE.Group>(null!);
  const lampMat = useRef<THREE.MeshStandardMaterial>(null!), leaf = useRef<THREE.Group>(null!);
  const bg = useRef(new THREE.Color());
  scene.background = bg.current;

  pickerRef.current = {
    pick(cx, cy) {
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(scene.children, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o) { if (o.userData?.hotspot) return o.userData.hotspot; o = o.parent; }
      return null;
    },
    project(id) {
      const o = refs.current[id]; if (!o) return null;
      const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    },
  };

  useFrame(() => {
    const now = performance.now();
    const t = L.loopTime(now, model.start), s = L.sceneAt(t);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = L.fovFor(cam.aspect);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const p = L.cameraPose(model.view);
    camera.position.set(p.x, p.y, 4); camera.rotation.set(p.pitchRad, p.yawRad, 0, 'YXZ');
    sun.current.position.set(s.sunX, s.sunY, -45);
    blades.current.rotation.z = s.windmill;
    cloud.current.position.x = s.cloudX;
    lampMat.current.emissiveIntensity = 0.2 + 1.8 * s.lamp;
    leaf.current.rotation.z = s.leaf;
    bg.current.copy(skyDusk).lerp(skyDay, s.sky);
    const act = L.activeAt(model, now);
    for (const h of L.HOTSPOTS) {
      const o = refs.current[h.id]; if (!o) continue;
      const k = act?.id === h.id ? 1 - (act.until - now) / 2000 : 0;
      o.scale.setScalar(act?.id === h.id ? 1 + 0.35 * Math.sin(Math.PI * k) : 1);
      const ring = o.getObjectByName(`ring-${h.id}`) as THREE.Mesh;
      ring.scale.setScalar(1 + 0.15 * Math.sin((2 * Math.PI * t) / 1.5));
      (ring.material as THREE.MeshBasicMaterial).color.set(model.found.has(h.id) ? '#7dff9a' : '#ffd84a');
    }
  });

  const wallMat = <meshStandardMaterial color="#5b4636" />;
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      {/* 室內牆與唯一窗框：開口 3×2 */}
      <mesh position={[0, 7, 0.1]}><boxGeometry args={[40, 12, 0.2]} />{wallMat}</mesh>
      <mesh position={[0, -7, 0.1]}><boxGeometry args={[40, 12, 0.2]} />{wallMat}</mesh>
      <mesh position={[-11.5, 0, 0.1]}><boxGeometry args={[20, 2, 0.2]} />{wallMat}</mesh>
      <mesh position={[11.5, 0, 0.1]}><boxGeometry args={[20, 2, 0.2]} />{wallMat}</mesh>
      {[[0, 1.03, 3.2, 0.08], [0, -1.03, 3.2, 0.08], [-1.53, 0, 0.08, 2.1], [1.53, 0, 0.08, 2.1], [0, 0, 0.05, 2]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.25]}><boxGeometry args={[w, h, 0.1]} /><meshStandardMaterial color="#efe6d2" /></mesh>
      ))}
      {/* 近景：窗台與盆栽 */}
      <mesh position={[0, -1.05, -0.6]}><boxGeometry args={[3.4, 0.1, 1.2]} /><meshStandardMaterial color="#cbbfa8" /></mesh>
      <Hotspot id="plant" ringR={0.32} refs={refs}>
        <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.16, 0.12, 0.3, 16]} /><meshStandardMaterial color="#b4613a" /></mesh>
        <group ref={leaf} position={[0, 0.15, 0]}>
          <mesh position={[0, 0.2, 0]}><coneGeometry args={[0.18, 0.45, 8]} /><meshStandardMaterial color="#3f8f4a" /></mesh>
        </group>
      </Hotspot>
      {/* 中景：地面、房子、路燈 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, -12]}><planeGeometry args={[60, 16]} /><meshStandardMaterial color="#7a9a5a" /></mesh>
      {[[-3.5, '#d9c7a1'], [-0.5, '#c98f7a'], [5, '#a8b8c8']].map(([x, c], i) => (
        <group key={i} position={[x as number, -1.5, -10]}>
          <mesh><boxGeometry args={[2.2, 2, 2]} /><meshStandardMaterial color={c as string} /></mesh>
          <mesh position={[0, 1.4, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[1.7, 0.9, 4]} /><meshStandardMaterial color="#7a3b2e" /></mesh>
        </group>
      ))}
      <mesh position={[2.6, -1.05, -8]}><cylinderGeometry args={[0.05, 0.05, 2.9, 8]} /><meshStandardMaterial color="#333" /></mesh>
      <Hotspot id="lamp" ringR={0.5} refs={refs}>
        <mesh><sphereGeometry args={[0.25, 16, 16]} /><meshStandardMaterial ref={lampMat} color="#fff3b0" emissive="#ffcc33" /></mesh>
      </Hotspot>
      {/* 中遠：雲 */}
      <group ref={cloud} position={[0, 4.5, -20]}>
        {[-1, 0, 1].map((k) => <mesh key={k} position={[k * 1.2, k === 0 ? 0.4 : 0, 0]}><sphereGeometry args={[1, 12, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>)}
      </group>
      {/* 遠景：山、風車、太陽 */}
      {[[-8, 6, '#5d7f95'], [1, 9, '#4f6f86'], [11, 7, '#6a8aa0']].map(([x, h, c], i) => (
        <mesh key={i} position={[x as number, (h as number) / 2 - 2.5, -32]}><coneGeometry args={[8, h as number, 4]} /><meshStandardMaterial color={c as string} /></mesh>
      ))}
      <mesh position={[-7, 0.2, -30]}><cylinderGeometry args={[0.15, 0.3, 4, 8]} /><meshStandardMaterial color="#eee" /></mesh>
      <Hotspot id="windmill" ringR={2.4} refs={refs}>
        <group ref={blades}>
          {[0, 1, 2, 3].map((k) => <mesh key={k} rotation={[0, 0, (k * Math.PI) / 2]} position={[0, 0, 0.2]}><boxGeometry args={[0.25, 3.6, 0.05]} /><meshStandardMaterial color="#fafafa" /></mesh>)}
        </group>
      </Hotspot>
      <mesh ref={sun}><sphereGeometry args={[1.5, 16, 16]} /><meshBasicMaterial color="#fff1a8" /></mesh>
    </>
  );
}
