// Renders a block or item icon from the atlas / procedural item art
import { useEffect, useRef } from 'react';
import { BLOCKS, blockDef } from '@/game/blocks';
import { TILES, TILE_SIZE, ATLAS_COLS } from '@/game/atlas';
import { itemIcon } from '@/game/items';

export function BlockIcon({ blockId, atlas, size = 40 }: { blockId: number; atlas: HTMLCanvasElement | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    if (!blockId) return;
    ctx.imageSmoothingEnabled = false;
    if (blockId < 100) {
      const def = BLOCKS[blockId];
      if (!def || !atlas) return;
      const tileIdx = TILES[def.side] ?? 0;
      const sx = (tileIdx % ATLAS_COLS) * TILE_SIZE, sy = Math.floor(tileIdx / ATLAS_COLS) * TILE_SIZE;
      ctx.drawImage(atlas, sx, sy, 16, 16, size * 0.06, size * 0.06, size * 0.88, size * 0.88);
    } else {
      const icon = itemIcon(blockId, atlas);
      if (icon) ctx.drawImage(icon, 0, 0, icon.width, icon.height, 0, 0, size, size);
    }
  }, [blockId, atlas, size]);
  const name = blockId ? blockDef(blockId)?.name ?? '' : '';
  void name;
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}
