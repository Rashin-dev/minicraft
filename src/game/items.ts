// Inventory, crafting, procedural item icons
import { B, IT, BLOCKS, ITEMS, itemDef, blockDef, itemName } from './blocks';
import { TILE_SIZE, ATLAS_COLS, TILES } from './atlas';

export type Slot = { id: number; count: number } | null;

export const STACK_MAX = 64;

export class Inventory {
  slots: (Slot)[] = new Array(36).fill(null); // 0-8 hotbar, 9-35 backpack
  selected = 0;
  version = 0; // bump to re-render UI

  onChange: () => void = () => {};

  private touch() { this.version++; this.onChange(); }

  held(): Slot { return this.slots[this.selected]; }

  add(id: number, count = 1): boolean {
    // stack into existing
    for (let i = 0; i < 36; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < STACK_MAX) {
        const take = Math.min(count, STACK_MAX - s.count);
        s.count += take; count -= take;
        if (count <= 0) { this.touch(); return true; }
      }
    }
    for (let i = 0; i < 36; i++) {
      if (!this.slots[i]) {
        const take = Math.min(count, STACK_MAX);
        this.slots[i] = { id, count: take };
        count -= take;
        if (count <= 0) { this.touch(); return true; }
      }
    }
    this.touch();
    return count <= 0;
  }

  consumeHeld(count = 1): boolean {
    const s = this.slots[this.selected];
    if (!s || s.count < count) return false;
    s.count -= count;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.touch();
    return true;
  }

  count(id: number): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  remove(id: number, count: number): boolean {
    if (this.count(id) < count) return false;
    for (let i = 35; i >= 0 && count > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(count, s.count);
        s.count -= take; count -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this.touch();
    return true;
  }

  serialize(): ([number, number] | null)[] { return this.slots.map((s) => (s ? [s.id, s.count] : null)); }
  load(data: ([number, number] | null)[] | null | undefined) {
    if (!data || data.length !== 36) return;
    this.slots = data.map((d) => (d ? { id: d[0], count: d[1] } : null));
    this.touch();
  }
}

// ---------------- Crafting ----------------
export interface Recipe {
  out: number; outCount: number;
  needs: [number, number][]; // [id, count]
}

export const RECIPES: Recipe[] = [
  { out: B.PLANKS, outCount: 4, needs: [[B.LOG, 1]] },
  { out: B.PLANKS, outCount: 4, needs: [[B.BIRCH_LOG, 1]] },
  { out: B.PLANKS, outCount: 4, needs: [[B.SPRUCE_LOG, 1]] },
  { out: B.PLANKS, outCount: 4, needs: [[B.CHERRY_LOG, 1]] },
  { out: IT.STICK, outCount: 4, needs: [[B.PLANKS, 2]] },
  { out: B.CRAFTING, outCount: 1, needs: [[B.PLANKS, 4]] },
  { out: B.TORCH, outCount: 4, needs: [[IT.COAL, 1], [IT.STICK, 1]] },
  { out: B.LANTERN, outCount: 1, needs: [[IT.IRON_CHUNK, 4], [B.TORCH, 1]] },
  { out: B.GLASS, outCount: 4, needs: [[B.SAND, 4], [IT.COAL, 1]] },
  { out: B.BRICK, outCount: 2, needs: [[B.DIRT, 2], [IT.COAL, 1]] },
  { out: B.SANDSTONE, outCount: 1, needs: [[B.SAND, 4]] },
  { out: B.STONE_BRICKS, outCount: 4, needs: [[B.STONE, 4]] },
  { out: B.TNT, outCount: 1, needs: [[IT.GUNPOWDER, 4], [B.SAND, 4]] },
  { out: B.BED, outCount: 1, needs: [[B.WOOL_RED, 3], [B.PLANKS, 3]] },
  { out: B.DIAMOND_BLOCK, outCount: 1, needs: [[IT.DIAMOND, 9]] },
  { out: B.GOLD_BLOCK, outCount: 1, needs: [[IT.GOLD_CHUNK, 9]] },
  { out: B.IRON_BLOCK, outCount: 1, needs: [[IT.IRON_CHUNK, 9]] },
  { out: B.BOOKSHELF, outCount: 1, needs: [[B.PLANKS, 6]] },
  // tools: [material x3, stick x2] pickaxe / [x3 x2] axe / [x1 x2] shovel / [x2 x1] sword
];
const TOOL_MATS: [number, number][] = [[B.PLANKS, 0], [B.COBBLE, 1], [IT.IRON_CHUNK, 2], [IT.DIAMOND, 3]];
const TOOL_IDS: number[][] = [
  [IT.WOOD_PICKAXE, IT.STONE_PICKAXE, IT.IRON_PICKAXE, IT.DIAMOND_PICKAXE],
  [IT.WOOD_AXE, IT.STONE_AXE, IT.IRON_AXE, IT.DIAMOND_AXE],
  [IT.WOOD_SHOVEL, IT.STONE_SHOVEL, IT.IRON_SHOVEL, IT.DIAMOND_SHOVEL],
  [IT.WOOD_SWORD, IT.STONE_SWORD, IT.IRON_SWORD, IT.DIAMOND_SWORD],
];
for (let t = 0; t < 4; t++) {
  for (let m = 0; m < 4; m++) {
    const [mat] = TOOL_MATS[m];
    const id = TOOL_IDS[t][m];
    const needs: [number, number][] = t === 0 ? [[mat, 3], [IT.STICK, 2]]
      : t === 1 ? [[mat, 3], [IT.STICK, 2]]
        : t === 2 ? [[mat, 1], [IT.STICK, 2]]
          : [[mat, 2], [IT.STICK, 1]];
    RECIPES.push({ out: id, outCount: 1, needs });
  }
}

// ---------------- item icons ----------------
const iconCache = new Map<number, HTMLCanvasElement>();

export function itemIcon(id: number, atlas: HTMLCanvasElement | null): HTMLCanvasElement | null {
  const cached = iconCache.get(id);
  if (cached) return cached;
  if (id < 100) {
    if (!atlas) return null;
    const def = BLOCKS[id];
    if (!def) return null;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 48;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const tileIdx = TILES[def.side] ?? 0;
    const sx = (tileIdx % ATLAS_COLS) * TILE_SIZE, sy = Math.floor(tileIdx / ATLAS_COLS) * TILE_SIZE;
    ctx.drawImage(atlas, sx, sy, 16, 16, 4, 4, 40, 40);
    iconCache.set(id, cv);
    return cv;
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = 48;
  drawItemIcon(cv.getContext('2d')!, id);
  iconCache.set(id, cv);
  return cv;
}

function drawItemIcon(g: CanvasRenderingContext2D, id: number) {
  const def = ITEMS[id];
  g.imageSmoothingEnabled = false;
  const P = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x * 3, y * 3, w * 3, h * 3); };
  const tool = def?.tool;
  if (tool) {
    const headCol = ['#a88852', '#8a8a8a', '#d8d8d8', '#6ee6e0'][tool.tier - 1];
    const hiCol = ['#c8a86e', '#b0b0b0', '#f0f0f0', '#b8f5f0'][tool.tier - 1];
    // handle
    P(3, 8, 2, 6, '#8a6a3e');
    P(4, 7, 2, 2, '#8a6a3e');
    if (tool.type === 'pickaxe') {
      P(2, 3, 10, 2, headCol); P(1, 4, 2, 2, headCol); P(11, 4, 2, 2, headCol);
      P(3, 3, 3, 1, hiCol);
    } else if (tool.type === 'axe') {
      P(6, 2, 5, 4, headCol); P(5, 3, 2, 3, headCol); P(7, 2, 2, 1, hiCol);
    } else if (tool.type === 'shovel') {
      P(6, 2, 4, 4, headCol); P(7, 2, 2, 1, hiCol);
    } else {
      // sword
      P(6, 2, 3, 9, headCol); P(7, 2, 1, 8, hiCol);
      P(4, 9, 8, 2, '#6a4a28'); P(5, 11, 4, 2, '#8a6a3e');
      return;
    }
    return;
  }
  switch (id) {
    case IT.STICK: P(7, 3, 2, 11, '#8a6a3e'); P(8, 2, 1, 2, '#a8854e'); break;
    case IT.COAL: P(5, 5, 6, 6, '#2a2a2e'); P(6, 6, 2, 2, '#4a4a52'); break;
    case IT.IRON_CHUNK: P(5, 5, 6, 6, '#d8d8d8'); P(6, 6, 3, 2, '#f0f0f0'); break;
    case IT.GOLD_CHUNK: P(5, 5, 6, 6, '#f0c840'); P(6, 6, 3, 2, '#ffe890'); break;
    case IT.DIAMOND: {
      g.fillStyle = '#5ee6e0';
      g.beginPath();
      g.moveTo(24, 8); g.lineTo(38, 22); g.lineTo(24, 40); g.lineTo(10, 22); g.closePath(); g.fill();
      g.fillStyle = '#b8f5f0'; g.fillRect(18, 14, 6, 6);
      break;
    }
    case IT.APPLE: P(5, 7, 7, 7, '#d0382e'); P(6, 8, 2, 2, '#f07868'); P(8, 4, 1, 3, '#6a4a28'); P(9, 3, 3, 2, '#4a8a2e'); break;
    case IT.PORKCHOP: P(5, 6, 7, 7, '#e8908a'); P(6, 7, 4, 3, '#f4b8b2'); P(4, 12, 2, 2, '#f4e8d8'); break;
    case IT.BEEF: P(5, 6, 7, 7, '#8a4a32'); P(6, 7, 4, 3, '#b06a48'); break;
    case IT.GUNPOWDER: P(5, 6, 6, 6, '#5a5a62'); P(7, 4, 2, 2, '#6a6a72'); P(9, 10, 2, 2, '#4a4a52'); break;
    default: P(6, 6, 4, 4, '#cccccc');
  }
}

export { itemName, itemDef, blockDef };
