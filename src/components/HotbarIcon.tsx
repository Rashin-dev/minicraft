// Renders a block icon from the texture atlas
import { useEffect, useRef } from 'react';
import { BLOCKS, TILES, TILE_SIZE } from '@/game/game';
import { TILES as ATLAS_TILES } from '@/game/atlas';

export function BlockIcon({ blockId, atlas, size = 40 }: { blockId: number; atlas: HTMLCanvasElement | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !atlas) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    const def = BLOCKS[blockId];
    if (!def) return;
    void TILES;
    const tileIdx = ATLAS_TILES[def.side] ?? 0;
    const sx = (tileIdx % 8) * TILE_SIZE, sy = Math.floor(tileIdx / 8) * TILE_SIZE;
    ctx.imageSmoothingEnabled = false;
    // simple 3-face isometric-ish: draw top skewed + side
    const s = size / 16;
    // side
    ctx.drawImage(atlas, sx, sy, 16, 16, 0, size * 0.22, size, size * 0.78);
    // top
    const topIdx = ATLAS_TILES[def.top] ?? tileIdx;
    const tx = (topIdx % 8) * TILE_SIZE, ty = Math.floor(topIdx / 8) * TILE_SIZE;
    ctx.save();
    ctx.transform(1, -0.28, 0, 0.55, 0, size * 0.12);
    ctx.drawImage(atlas, tx, ty, 16, 16, 0, 0, size, size * 0.45);
    ctx.restore();
    void s;
  }, [blockId, atlas, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}
