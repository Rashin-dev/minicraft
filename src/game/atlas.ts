// Procedurally generated 16x16 texture atlas (pixel-art, worker-safe: no DOM at import)
export const TILE_SIZE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 9;

import { mulberry32 } from './noise';

export interface TileDef { name: string; draw: (ctx: CanvasRenderingContext2D, ox: number, oy: number) => void; }

const rnd = mulberry32(1337);

function px(ctx: CanvasRenderingContext2D, ox: number, oy: number, x: number, y: number, c: string) {
  ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1);
}

function shade(base: [number, number, number], amt: number): string {
  const r = Math.max(0, Math.min(255, Math.round(base[0] + amt)));
  const g = Math.max(0, Math.min(255, Math.round(base[1] + amt)));
  const b = Math.max(0, Math.min(255, Math.round(base[2] + amt)));
  return `rgb(${r},${g},${b})`;
}

function noiseFill(ctx: CanvasRenderingContext2D, ox: number, oy: number, base: [number, number, number], variance: number) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    px(ctx, ox, oy, x, y, shade(base, Math.floor((rnd() - 0.5) * variance)));
  }
}

function speckle(ctx: CanvasRenderingContext2D, ox: number, oy: number, base: [number, number, number], variance: number, spots: [number, number, number][], count: number) {
  noiseFill(ctx, ox, oy, base, variance);
  for (let i = 0; i < count; i++) {
    const c = spots[Math.floor(rnd() * spots.length)];
    px(ctx, ox, oy, Math.floor(rnd() * 16), Math.floor(rnd() * 16), shade(c, Math.floor((rnd() - 0.5) * 30)));
  }
}

function oreOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, hi: string, n: number) {
  tileDefs[TILES['stone']].draw(ctx, x, y);
  for (let i = 0; i < n; i++) {
    const ox2 = 1 + Math.floor(rnd() * 12), oy2 = 1 + Math.floor(rnd() * 12);
    ctx.fillStyle = color; ctx.fillRect(x + ox2, y + oy2, 2 + Math.floor(rnd() * 2), 2);
    ctx.fillStyle = hi; ctx.fillRect(x + ox2, y + oy2, 1, 1);
  }
}

export const TILES: Record<string, number> = {};
const tileDefs: TileDef[] = [];

function tile(name: string, draw: TileDef['draw']) {
  TILES[name] = tileDefs.length;
  tileDefs.push({ name, draw });
}

// ---- Tile painters ----
tile('grass_top', (c, x, y) => {
  noiseFill(c, x, y, [100, 172, 62], 42);
  for (let i = 0; i < 20; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), shade([74, 142, 44], 20));
});
tile('grass_side', (c, x, y) => {
  noiseFill(c, x, y, [134, 96, 67], 34);
  for (let i = 0; i < 16; i++) {
    const depth = 2 + Math.floor(rnd() * 3);
    for (let j = 0; j < depth; j++) px(c, x, y, i, j, shade([100, 172, 62], Math.floor((rnd() - 0.5) * 36)));
  }
});
tile('dirt', (c, x, y) => speckle(c, x, y, [134, 96, 67], 34, [[105, 72, 48], [158, 120, 84]], 22));
tile('stone', (c, x, y) => speckle(c, x, y, [128, 128, 128], 26, [[105, 105, 105], [150, 150, 150]], 20));
tile('cobble', (c, x, y) => {
  noiseFill(c, x, y, [120, 120, 120], 30);
  c.fillStyle = 'rgb(80,80,80)';
  for (let i = 0; i < 16; i += 4) { c.fillRect(x, y + i, 16, 1); c.fillRect(x + ((i / 4) % 2 ? 4 : 8), y, 1, 16); }
  for (let i = 0; i < 10; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 'rgb(150,150,150)');
});
tile('sand', (c, x, y) => speckle(c, x, y, [219, 205, 160], 24, [[200, 185, 138], [235, 225, 185]], 18));
tile('gravel', (c, x, y) => speckle(c, x, y, [136, 126, 126], 44, [[100, 92, 92], [170, 162, 160], [110, 100, 96]], 30));
tile('log_side', (c, x, y) => {
  for (let i = 0; i < 16; i++) {
    const b: [number, number, number] = [102 + Math.floor(rnd() * 24), 80 + Math.floor(rnd() * 18), 50];
    for (let j = 0; j < 16; j++) px(c, x, y, i, j, shade(b, Math.floor((rnd() - 0.5) * 22)));
  }
  c.fillStyle = 'rgb(72,56,34)';
  for (let i = 1; i < 16; i += 4) c.fillRect(x + i, y, 1, 16);
});
tile('log_top', (c, x, y) => {
  noiseFill(c, x, y, [178, 144, 88], 14);
  c.strokeStyle = 'rgb(120,94,54)';
  for (const r of [2, 5]) c.strokeRect(x + r + 0.5, y + r + 0.5, 15 - r * 2, 15 - r * 2);
});
tile('leaves', (c, x, y) => {
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    if (rnd() < 0.14) c.clearRect(x + i, y + j, 1, 1);
    else px(c, x, y, i, j, shade([52, 118, 40], Math.floor((rnd() - 0.5) * 50)));
  }
});
tile('planks', (c, x, y) => {
  noiseFill(c, x, y, [168, 136, 82], 20);
  c.fillStyle = 'rgb(120,94,54)';
  for (let i = 3; i < 16; i += 4) c.fillRect(x, y + i, 16, 1);
  c.fillRect(x + 8, y, 1, 3); c.fillRect(x + 4, y + 4, 1, 3); c.fillRect(x + 12, y + 8, 1, 3); c.fillRect(x + 6, y + 12, 1, 4);
});
tile('glass', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x, y, 16, 16);
  c.fillStyle = 'rgb(210,235,248)'; c.fillRect(x, y, 16, 1); c.fillRect(x, y + 15, 16, 1); c.fillRect(x, y, 1, 16); c.fillRect(x + 15, y, 1, 16);
  px(c, x, y, 3, 3, 'rgb(235,248,255)'); px(c, x, y, 4, 3, 'rgb(235,248,255)'); px(c, x, y, 3, 4, 'rgb(235,248,255)');
  px(c, x, y, 11, 10, 'rgba(235,248,255,0.7)'); px(c, x, y, 12, 11, 'rgba(235,248,255,0.7)');
});
tile('brick', (c, x, y) => {
  noiseFill(c, x, y, [152, 76, 60], 22);
  c.fillStyle = 'rgb(188,172,160)';
  for (let j = 0; j < 16; j += 4) c.fillRect(x, y + j, 16, 1);
  for (let j = 0; j < 16; j += 4) for (let i = ((j / 4) % 2 ? 0 : 8); i < 16; i += 8) c.fillRect(x + i, y + j, 1, 4);
});
tile('water', (c, x, y) => {
  noiseFill(c, x, y, [48, 104, 200], 22);
  for (let i = 0; i < 10; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 'rgb(96,156,228)');
});
tile('lava', (c, x, y) => {
  noiseFill(c, x, y, [232, 110, 24], 40);
  for (let i = 0; i < 14; i++) { const bx = Math.floor(rnd() * 14), by = Math.floor(rnd() * 14); c.fillStyle = 'rgb(255,220,90)'; c.fillRect(x + bx, y + by, 2, 2); }
  for (let i = 0; i < 8; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 'rgb(120,30,10)');
});
tile('bedrock', (c, x, y) => speckle(c, x, y, [60, 60, 64], 60, [[30, 30, 34], [100, 100, 105]], 26));
tile('coal_ore', (c, x, y) => oreOverlay(c, x, y, 'rgb(35,35,38)', 'rgb(70,70,74)', 5));
tile('iron_ore', (c, x, y) => oreOverlay(c, x, y, 'rgb(216,170,130)', 'rgb(240,205,175)', 5));
tile('gold_ore', (c, x, y) => oreOverlay(c, x, y, 'rgb(250,220,80)', 'rgb(255,245,160)', 5));
tile('diamond_ore', (c, x, y) => oreOverlay(c, x, y, 'rgb(110,230,225)', 'rgb(200,255,250)', 4));
tile('torch', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(120,88,50)'; c.fillRect(x + 7, y + 6, 2, 10);
  c.fillStyle = 'rgb(255,210,90)'; c.fillRect(x + 6, y + 2, 4, 4);
  c.fillStyle = 'rgb(255,240,170)'; c.fillRect(x + 7, y + 3, 2, 2);
});
tile('flower_red', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(60,130,48)'; c.fillRect(x + 7, y + 8, 2, 8);
  c.fillStyle = 'rgb(210,50,45)';
  c.fillRect(x + 5, y + 3, 6, 5); c.fillRect(x + 6, y + 2, 4, 7);
  c.fillStyle = 'rgb(255,180,60)'; c.fillRect(x + 7, y + 4, 2, 2);
});
tile('flower_yellow', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(60,130,48)'; c.fillRect(x + 7, y + 9, 2, 7);
  c.fillStyle = 'rgb(240,215,60)'; c.fillRect(x + 5, y + 3, 6, 6);
  c.fillStyle = 'rgb(200,150,30)'; c.fillRect(x + 7, y + 5, 2, 2);
});
tile('flower_pink', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(70,140,58)'; c.fillRect(x + 7, y + 9, 2, 7);
  c.fillStyle = 'rgb(240,170,205)';
  c.fillRect(x + 4, y + 3, 8, 5); c.fillRect(x + 6, y + 2, 4, 7);
  c.fillStyle = 'rgb(255,220,235)'; c.fillRect(x + 6, y + 4, 4, 2);
  c.fillStyle = 'rgb(230,120,170)'; c.fillRect(x + 7, y + 5, 2, 1);
});
tile('grass_plant', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(84,152,54)';
  for (const bx of [2, 5, 8, 11, 13]) { const h = 4 + Math.floor(rnd() * 7); c.fillRect(x + bx, y + 15 - h, 1 + Math.floor(rnd() * 2), h + 1); }
});
tile('dead_bush', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(130,96,48)';
  c.fillRect(x + 7, y + 8, 2, 8);
  c.fillRect(x + 4, y + 6, 3, 1); c.fillRect(x + 10, y + 5, 3, 1); c.fillRect(x + 5, y + 4, 1, 3); c.fillRect(x + 11, y + 3, 1, 3);
});
tile('cactus', (c, x, y) => {
  noiseFill(c, x, y, [62, 138, 52], 26);
  c.fillStyle = 'rgb(35,90,30)';
  for (let i = 2; i < 16; i += 5) c.fillRect(x + i, y, 1, 16);
  c.fillStyle = 'rgb(150,210,140)';
  for (let i = 0; i < 16; i += 3) px(c, x, y, i, Math.floor(rnd() * 16), 'rgb(150,210,140)');
});
tile('cactus_top', (c, x, y) => {
  noiseFill(c, x, y, [80, 156, 66], 22);
  c.strokeStyle = 'rgb(45,105,38)'; c.strokeRect(x + 1.5, y + 1.5, 13, 13);
});
tile('snow', (c, x, y) => speckle(c, x, y, [238, 244, 250], 14, [[215, 225, 238]], 12));
tile('snow_side', (c, x, y) => {
  noiseFill(c, x, y, [134, 96, 67], 30);
  for (let i = 0; i < 16; i++) { const d = 3 + Math.floor(rnd() * 2); for (let j = 0; j < d; j++) px(c, x, y, i, j, shade([238, 244, 250], Math.floor((rnd() - 0.5) * 14))); }
});
tile('tnt', (c, x, y) => {
  noiseFill(c, x, y, [196, 50, 32], 24);
  c.fillStyle = 'rgb(240,225,200)'; c.fillRect(x, y + 6, 16, 4);
  c.fillStyle = 'rgb(30,25,20)'; c.font = 'bold 4px monospace'; c.fillText('TNT', x + 4, y + 9.5);
});
tile('tnt_top', (c, x, y) => {
  noiseFill(c, x, y, [196, 50, 32], 24);
  c.fillStyle = 'rgb(40,32,26)'; c.fillRect(x + 6, y + 6, 4, 4);
});
tile('wool_red', (c, x, y) => speckle(c, x, y, [190, 52, 48], 22, [[170, 40, 38], [210, 70, 62]], 16));
tile('wool_blue', (c, x, y) => speckle(c, x, y, [52, 80, 190], 22, [[40, 62, 165], [70, 100, 210]], 16));
tile('wool_yellow', (c, x, y) => speckle(c, x, y, [220, 190, 60], 20, [[200, 170, 45], [238, 212, 82]], 16));
tile('wool_green', (c, x, y) => speckle(c, x, y, [80, 160, 62], 22, [[62, 138, 48], [100, 182, 80]], 16));
tile('wool_white', (c, x, y) => speckle(c, x, y, [232, 232, 232], 14, [[210, 210, 210], [248, 248, 248]], 16));
tile('wool_black', (c, x, y) => speckle(c, x, y, [34, 34, 38], 14, [[22, 22, 26], [52, 52, 58]], 16));
tile('crafting', (c, x, y) => {
  tileDefs[TILES['planks']].draw(c, x, y);
  c.fillStyle = 'rgb(90,66,38)'; c.fillRect(x + 2, y + 2, 12, 1); c.fillRect(x + 2, y + 13, 12, 1);
  c.fillRect(x + 2, y + 2, 1, 12); c.fillRect(x + 13, y + 2, 1, 12);
  c.fillStyle = 'rgb(210,180,130)'; c.fillRect(x + 5, y + 5, 2, 2); c.fillRect(x + 9, y + 5, 2, 2); c.fillRect(x + 5, y + 9, 2, 2); c.fillRect(x + 9, y + 9, 2, 2);
});
tile('crafting_top', (c, x, y) => {
  tileDefs[TILES['planks']].draw(c, x, y);
  c.fillStyle = 'rgb(90,66,38)'; c.fillRect(x + 1, y + 1, 14, 14);
  c.fillStyle = 'rgb(168,136,82)'; c.fillRect(x + 2, y + 2, 12, 12);
  c.fillStyle = 'rgb(120,94,54)'; c.fillRect(x + 2, y + 7, 12, 1); c.fillRect(x + 7, y + 2, 1, 12);
});
tile('glowstone', (c, x, y) => speckle(c, x, y, [244, 208, 128], 40, [[255, 240, 180], [214, 170, 92]], 26));
tile('obsidian', (c, x, y) => speckle(c, x, y, [22, 18, 34], 20, [[45, 32, 66], [12, 10, 20]], 20));
tile('bookshelf', (c, x, y) => {
  tileDefs[TILES['planks']].draw(c, x, y);
  c.fillStyle = 'rgb(90,66,38)'; c.fillRect(x, y + 7, 16, 2);
  const cols = ['rgb(170,50,40)', 'rgb(50,80,170)', 'rgb(60,140,60)', 'rgb(200,170,60)', 'rgb(150,80,160)'];
  for (const row of [1, 10]) for (let i = 1; i < 15; i += 2) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(x + i, y + row, 1, 5); }
});
tile('ice', (c, x, y) => {
  noiseFill(c, x, y, [165, 205, 240], 18);
  c.strokeStyle = 'rgba(220,240,252,0.85)'; c.beginPath();
  c.moveTo(x + 3, y + 13); c.lineTo(x + 9, y + 4); c.moveTo(x + 8, y + 14); c.lineTo(x + 13, y + 7); c.stroke();
});
tile('moss_stone', (c, x, y) => {
  tileDefs[TILES['cobble']].draw(c, x, y);
  for (let i = 0; i < 18; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 'rgb(90,130,60)');
});
tile('moss_block', (c, x, y) => speckle(c, x, y, [88, 140, 58], 30, [[70, 118, 46], [108, 162, 72]], 24));
tile('cherry_log', (c, x, y) => {
  for (let i = 0; i < 16; i++) {
    const b: [number, number, number] = [58 + Math.floor(rnd() * 16), 38 + Math.floor(rnd() * 10), 44 + Math.floor(rnd() * 12)];
    for (let j = 0; j < 16; j++) px(c, x, y, i, j, shade(b, Math.floor((rnd() - 0.5) * 18)));
  }
  c.fillStyle = 'rgb(40,26,32)';
  for (let i = 2; i < 16; i += 5) c.fillRect(x + i, y, 1, 16);
});
tile('cherry_log_top', (c, x, y) => {
  noiseFill(c, x, y, [228, 180, 170], 16);
  c.strokeStyle = 'rgb(180,120,120)';
  for (const r of [2, 5]) c.strokeRect(x + r + 0.5, y + r + 0.5, 15 - r * 2, 15 - r * 2);
});
tile('cherry_leaves', (c, x, y) => {
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    if (rnd() < 0.13) c.clearRect(x + i, y + j, 1, 1);
    else px(c, x, y, i, j, shade([238, 158, 198], Math.floor((rnd() - 0.5) * 46)));
  }
});
tile('birch_log', (c, x, y) => {
  noiseFill(c, x, y, [222, 220, 212], 14);
  c.fillStyle = 'rgb(60,60,56)';
  for (let k = 0; k < 5; k++) { const bx = Math.floor(rnd() * 12), by = Math.floor(rnd() * 14); c.fillRect(x + bx, y + by, 2 + Math.floor(rnd() * 3), 1); }
});
tile('birch_log_top', (c, x, y) => {
  noiseFill(c, x, y, [200, 182, 140], 14);
  c.strokeStyle = 'rgb(150,130,90)';
  for (const r of [2, 5]) c.strokeRect(x + r + 0.5, y + r + 0.5, 15 - r * 2, 15 - r * 2);
});
tile('birch_leaves', (c, x, y) => {
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    if (rnd() < 0.14) c.clearRect(x + i, y + j, 1, 1);
    else px(c, x, y, i, j, shade([108, 152, 72], Math.floor((rnd() - 0.5) * 44)));
  }
});
tile('spruce_log', (c, x, y) => {
  for (let i = 0; i < 16; i++) {
    const b: [number, number, number] = [74 + Math.floor(rnd() * 18), 52 + Math.floor(rnd() * 12), 32];
    for (let j = 0; j < 16; j++) px(c, x, y, i, j, shade(b, Math.floor((rnd() - 0.5) * 20)));
  }
  c.fillStyle = 'rgb(48,34,20)';
  for (let i = 1; i < 16; i += 4) c.fillRect(x + i, y, 1, 16);
});
tile('spruce_log_top', (c, x, y) => {
  noiseFill(c, x, y, [150, 116, 70], 14);
  c.strokeStyle = 'rgb(100,76,44)';
  for (const r of [2, 5]) c.strokeRect(x + r + 0.5, y + r + 0.5, 15 - r * 2, 15 - r * 2);
});
tile('spruce_leaves', (c, x, y) => {
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    if (rnd() < 0.12) c.clearRect(x + i, y + j, 1, 1);
    else px(c, x, y, i, j, shade([42, 92, 62], Math.floor((rnd() - 0.5) * 40)));
  }
});
tile('amethyst', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  for (const [cx2, w, h, col] of [[4, 3, 9, 'rgb(150,100,230)'], [8, 4, 13, 'rgb(178,130,245)'], [12, 3, 7, 'rgb(125,80,205)']] as const) {
    c.fillStyle = col;
    for (let j = 0; j < h; j++) {
      const ww = Math.max(1, Math.round(w * (1 - j / h)));
      c.fillRect(x + cx2 - Math.floor(ww / 2), y + 15 - j, ww, 1);
    }
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(x + cx2, y + 15 - h + 1, 1, Math.max(1, h - 3));
  }
});
tile('lantern', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(60,60,66)'; c.fillRect(x + 7, y + 1, 2, 2);
  c.fillStyle = 'rgb(90,90,98)'; c.fillRect(x + 4, y + 3, 8, 9);
  c.fillStyle = 'rgb(255,200,90)'; c.fillRect(x + 5, y + 4, 6, 7);
  c.fillStyle = 'rgb(255,240,180)'; c.fillRect(x + 6, y + 5, 4, 5);
  c.fillStyle = 'rgb(60,60,66)'; c.fillRect(x + 4, y + 12, 8, 2);
});
tile('sandstone_top', (c, x, y) => speckle(c, x, y, [222, 208, 162], 16, [[205, 190, 145]], 12));
tile('sandstone', (c, x, y) => {
  noiseFill(c, x, y, [218, 202, 155], 18);
  c.fillStyle = 'rgba(180,160,115,0.8)'; c.fillRect(x, y + 4, 16, 1); c.fillRect(x, y + 11, 16, 1);
  c.fillStyle = 'rgba(240,228,185,0.8)'; c.fillRect(x, y + 5, 16, 1); c.fillRect(x, y + 12, 16, 1);
});
tile('stone_bricks', (c, x, y) => {
  noiseFill(c, x, y, [122, 122, 122], 18);
  c.fillStyle = 'rgb(78,78,78)';
  c.fillRect(x, y + 7, 16, 1); c.fillRect(x, y + 15, 16, 1);
  c.fillRect(x + 7, y, 1, 8); c.fillRect(x + 3, y + 8, 1, 8); c.fillRect(x + 11, y + 8, 1, 8);
});
tile('diamond_block', (c, x, y) => {
  speckle(c, x, y, [130, 220, 214], 16, [[100, 190, 185], [170, 245, 240]], 10);
  c.strokeStyle = 'rgb(80,160,158)'; c.strokeRect(x + 0.5, y + 0.5, 15, 15);
});
tile('gold_block', (c, x, y) => {
  speckle(c, x, y, [246, 208, 70], 16, [[220, 180, 50], [255, 235, 130]], 10);
  c.strokeStyle = 'rgb(200,160,40)'; c.strokeRect(x + 0.5, y + 0.5, 15, 15);
});
tile('iron_block', (c, x, y) => {
  speckle(c, x, y, [216, 216, 216], 14, [[190, 190, 192], [238, 238, 240]], 10);
  c.strokeStyle = 'rgb(160,160,165)'; c.strokeRect(x + 0.5, y + 0.5, 15, 15);
});
tile('bed_top', (c, x, y) => {
  noiseFill(c, x, y, [178, 44, 44], 16);
  c.fillStyle = 'rgb(240,240,240)'; c.fillRect(x, y, 16, 5);
  c.fillStyle = 'rgb(150,30,30)'; c.fillRect(x, y + 5, 16, 1);
});
tile('bed_side', (c, x, y) => {
  noiseFill(c, x, y, [168, 136, 82], 16);
  c.fillStyle = 'rgb(178,44,44)'; c.fillRect(x, y, 16, 6);
  c.fillStyle = 'rgb(240,240,240)'; c.fillRect(x, y, 16, 2);
});

export function buildAtlas(): { texture: HTMLCanvasElement; uvFor: (tileIdx: number) => [number, number, number, number] } {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_SIZE; canvas.height = ATLAS_ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  tileDefs.forEach((t, i) => {
    const ox = (i % ATLAS_COLS) * TILE_SIZE, oy = Math.floor(i / ATLAS_COLS) * TILE_SIZE;
    t.draw(ctx, ox, oy);
  });
  const uvFor = (idx: number): [number, number, number, number] => {
    const col = idx % ATLAS_COLS, row = Math.floor(idx / ATLAS_COLS);
    const w = canvas.width, h = canvas.height;
    const e = 0.02;
    const u0 = (col * TILE_SIZE + e) / w, v0 = 1 - ((row + 1) * TILE_SIZE - e) / h;
    const u1 = ((col + 1) * TILE_SIZE - e) / w, v1 = 1 - (row * TILE_SIZE + e) / h;
    return [u0, v0, u1, v1];
  };
  return { texture: canvas, uvFor };
}
