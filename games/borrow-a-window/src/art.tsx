import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { AVAILABLE } from './artManifest';

// 美術載入：優先讀 public/art/<key>.png（建置後在 dist/art/），缺檔時回傳 null，場景改用幾何暫用圖。
export const ART_KEYS = ['sky', 'far', 'mid', 'plant', 'lamp', 'windmill', 'roofcat'] as const;
export type ArtKey = (typeof ART_KEYS)[number];
export const artSource: Partial<Record<ArtKey, 'png' | 'fallback'>> = {};
const loader = new THREE.TextureLoader();

export function useArt(key: ArtKey): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    if (!AVAILABLE.includes(key)) { artSource[key] = 'fallback'; return; }
    loader.load(`art/${key}.png`,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; artSource[key] = 'png'; if (alive) setTex(t); },
      undefined,
      () => { artSource[key] = 'fallback'; });
    return () => { alive = false; };
  }, [key]);
  return tex;
}

/** 有圖就畫一張透明平面（寬 w，高依圖比例或 h） */
export function ArtPlane({ tex, w, h }: { tex: THREE.Texture; w: number; h?: number }) {
  const img = tex.image as { width: number; height: number };
  const hh = h ?? (w * img.height) / img.width;
  return (
    <mesh>
      <planeGeometry args={[w, hh]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.05} toneMapped={false} />
    </mesh>
  );
}
