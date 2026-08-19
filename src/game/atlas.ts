// Procedurally generated 16x16 texture atlas (Minecraft-style pixel art)
import { mulberry32 } from './noise';

export const TILE_SIZE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;

export interface TileDef { name: string; draw: (ctx: CanvasRenderingContext2D, ox: number, oy: number) => void; }

const rnd = mulberry32(1337);

function px(ctx: CanvasRenderingContext2D, ox: number, oy: number, x: number, y: number, c: string) {
  ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1);
}

function shade(base: [number, number, number], amt: number): string {
  const r = Math.max(0, Math.min(255, base[0] + amt));
  const g = Math.max(0, Math.min(255, base[1] + amt));
  const b = Math.max(0, Math.min(255, base[2] + amt));
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

export const TILES: Record<string, number> = {};
const tileDefs: TileDef[] = [];

function tile(name: string, draw: TileDef['draw']) {
  TILES[name] = tileDefs.length;
  tileDefs.push({ name, draw });
}

// ---- Tile painters ----
tile('grass_top', (c, x, y) => {
  noiseFill(c, x, y, [96, 168, 60], 40);
  for (let i = 0; i < 18; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), shade([70, 138, 42], 20));
});
tile('grass_side', (c, x, y) => {
  noiseFill(c, x, y, [134, 96, 67], 34);
  for (let i = 0; i < 16; i++) {
    const depth = 2 + Math.floor(rnd() * 3);
    for (let j = 0; j < depth; j++) px(c, x, y, i, j, shade([96, 168, 60], Math.floor((rnd() - 0.5) * 36)));
  }
});
tile('dirt', (c, x, y) => speckle(c, x, y, [134, 96, 67], 34, [[105, 72, 48], [158, 120, 84]], 22));
tile('stone', (c, x, y) => speckle(c, x, y, [128, 128, 128], 26, [[105, 105, 105], [150, 150, 150]], 20));
tile('cobble', (c, x, y) => {
  noiseFill(c, x, y, [120, 120, 120], 30);
  c.fillStyle = 'rgb(80,80,80)';
  for (let i = 0; i < 16; i += 4) { c.fillRect(x, y + i, 16, 1); c.fillRect(x + ((i / 4) % 2 ? 4 : 8), y, 1, 16); }
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
  for (const r of [2, 5]) { c.strokeRect(x + r, y + r, 16 - r * 2, 16 - r * 2); }
});
tile('leaves', (c, x, y) => {
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    if (rnd() < 0.12) { px(c, x, y, i, j, 'rgba(0,0,0,0)'); c.clearRect(x + i, y + j, 1, 1); }
    else px(c, x, y, i, j, shade([52, 118, 40], Math.floor((rnd() - 0.5) * 46)));
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
  c.fillStyle = 'rgba(200,230,245,0.25)'; c.fillRect(x, y, 16, 16);
  c.fillStyle = 'rgb(220,240,250)'; c.fillRect(x, y, 16, 1); c.fillRect(x, y + 15, 16, 1); c.fillRect(x, y, 1, 16); c.fillRect(x + 15, y, 1, 16);
  px(c, x, y, 3, 3, 'rgb(235,248,255)'); px(c, x, y, 4, 3, 'rgb(235,248,255)'); px(c, x, y, 3, 4, 'rgb(235,248,255)');
});
tile('brick', (c, x, y) => {
  noiseFill(c, x, y, [152, 76, 60], 22);
  c.fillStyle = 'rgb(188, 172, 160)';
  for (let j = 0; j < 16; j += 4) c.fillRect(x, y + j, 16, 1);
  for (let j = 0; j < 16; j += 4) for (let i = ((j / 4) % 2 ? 0 : 8); i < 16; i += 8) c.fillRect(x + i, y + j, 1, 4);
});
tile('water', (c, x, y) => {
  noiseFill(c, x, y, [52, 108, 203], 22);
  for (let i = 0; i < 8; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 'rgb(90,150,225)');
});
tile('bedrock', (c, x, y) => speckle(c, x, y, [60, 60, 64], 60, [[30, 30, 34], [100, 100, 105]], 26));
tile('coal_ore', (c, x, y) => {
  tileDefs[TILES['stone']].draw(c, x, y);
  for (let i = 0; i < 6; i++) { const pxX = Math.floor(rnd() * 13), pxY = Math.floor(rnd() * 13); c.fillStyle = 'rgb(30,30,30)'; c.fillRect(x + pxX, y + pxY, 2 + Math.floor(rnd() * 2), 2 + Math.floor(rnd() * 2)); }
});
tile('iron_ore', (c, x, y) => {
  tileDefs[TILES['stone']].draw(c, x, y);
  for (let i = 0; i < 5; i++) { const pxX = Math.floor(rnd() * 13), pxY = Math.floor(rnd() * 13); c.fillStyle = 'rgb(216, 170, 130)'; c.fillRect(x + pxX, y + pxY, 2, 2); }
});
tile('gold_ore', (c, x, y) => {
  tileDefs[TILES['stone']].draw(c, x, y);
  for (let i = 0; i < 5; i++) { const pxX = Math.floor(rnd() * 13), pxY = Math.floor(rnd() * 13); c.fillStyle = 'rgb(250, 220, 80)'; c.fillRect(x + pxX, y + pxY, 2, 2); }
});
tile('diamond_ore', (c, x, y) => {
  tileDefs[TILES['stone']].draw(c, x, y);
  for (let i = 0; i < 4; i++) { const pxX = Math.floor(rnd() * 13), pxY = Math.floor(rnd() * 13); c.fillStyle = 'rgb(120, 230, 225)'; c.fillRect(x + pxX, y + pxY, 2, 2); }
});
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
tile('grass_plant', (c, x, y) => {
  c.clearRect(x, y, 16, 16);
  c.fillStyle = 'rgb(80,150,52)';
  for (const bx of [3, 6, 9, 12]) { const h = 4 + Math.floor(rnd() * 6); c.fillRect(x + bx, y + 15 - h, 1 + Math.floor(rnd() * 2), h + 1); }
});
tile('cactus', (c, x, y) => {
  noiseFill(c, x, y, [62, 138, 52], 26);
  c.fillStyle = 'rgb(35,90,30)';
  for (let i = 2; i < 16; i += 5) c.fillRect(x + i, y, 1, 16);
  c.fillStyle = 'rgb(150,210,140)';
  for (let i = 0; i < 16; i += 3) px(c, x, y, i, Math.floor(rnd() * 16), 'rgb(150,210,140)');
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
tile('crafting', (c, x, y) => {
  tileDefs[TILES['planks']].draw(c, x, y);
  c.fillStyle = 'rgb(90,66,38)'; c.fillRect(x + 2, y + 2, 12, 1); c.fillRect(x + 2, y + 13, 12, 1);
  c.fillRect(x + 2, y + 2, 1, 12); c.fillRect(x + 13, y + 2, 1, 12);
  c.fillStyle = 'rgb(210,180,130)'; c.fillRect(x + 5, y + 5, 2, 2); c.fillRect(x + 9, y + 5, 2, 2); c.fillRect(x + 5, y + 9, 2, 2); c.fillRect(x + 9, y + 9, 2, 2);
});
tile('glowstone', (c, x, y) => speckle(c, x, y, [240, 200, 120], 40, [[255, 235, 170], [210, 165, 90]], 24));
tile('obsidian', (c, x, y) => speckle(c, x, y, [22, 18, 34], 20, [[45, 32, 66], [12, 10, 20]], 20));
tile('bookshelf', (c, x, y) => {
  tileDefs[TILES['planks']].draw(c, x, y);
  c.fillStyle = 'rgb(90,66,38)'; c.fillRect(x, y + 7, 16, 2);
  const cols = ['rgb(170,50,40)', 'rgb(50,80,170)', 'rgb(60,140,60)', 'rgb(200,170,60)', 'rgb(150,80,160)'];
  for (const row of [1, 10]) for (let i = 1; i < 15; i += 2) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(x + i, y + row, 1, 5); }
});
tile('ice', (c, x, y) => {
  noiseFill(c, x, y, [165, 205, 240], 18);
  c.strokeStyle = 'rgb(200,230,250)'; c.beginPath(); c.moveTo(x + 3, y + 13); c.lineTo(x + 9, y + 4); c.moveTo(x + 8, y + 14); c.lineTo(x + 13, y + 7); c.stroke();
});
tile('moss_stone', (c, x, y) => {
  tileDefs[TILES['cobble']].draw(c, x, y);
  for (let i = 0; i < 16; i++) px(c, x, y, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 'rgb(90,130,60)');
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
    const e = 0.02; // uv inset to prevent bleeding
    const u0 = (col * TILE_SIZE + e) / w, v0 = 1 - ((row + 1) * TILE_SIZE - e) / h;
    const u1 = ((col + 1) * TILE_SIZE - e) / w, v1 = 1 - (row * TILE_SIZE + e) / h;
    return [u0, v0, u1, v1];
  };
  return { texture: canvas, uvFor };
}
