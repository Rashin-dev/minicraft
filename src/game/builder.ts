// AI Architect: build plans, offline natural-language builder, structure generators
import { B } from './blocks';

export interface BuildOp {
  op: 'set' | 'fill' | 'sphere' | 'cylinder' | 'wall' | 'clear' | 'replace' | 'tree';
  block?: number;
  from?: [number, number, number]; // block ids for 'replace'
  to?: number;
  x?: number; y?: number; z?: number;
  x2?: number; y2?: number; z2?: number;
  r?: number;
  h?: number;
  hollow?: boolean;
  kind?: 'oak' | 'birch' | 'spruce' | 'cherry';
}
export interface BuildPlan { name: string; ops: BuildOp[]; }

const S = B.SANDSTONE, SB = B.STONE_BRICKS, CO = B.COBBLE, ST = B.STONE, WO = B.WOOL_WHITE,
  WR = B.WOOL_RED, PL = B.PLANKS, LO = B.LOG,
  GL = B.GLASS, LA = B.LANTERN, TO = B.TORCH, MO = B.MOSS_BLOCK, SS = B.SNOW_BLOCK,
  CL = B.CHERRY_LOG, CV = B.CHERRY_LEAVES, OBB = B.OBSIDIAN,
  DB = B.DIAMOND_BLOCK, GB = B.GOLD_BLOCK;
void SS;

// ---------------- structure generators (all centered at x,z, ground y) ----------------
function palace(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const half = Math.floor(size / 2);
  const wallH = Math.max(8, Math.floor(size * 0.45));
  const floorY = cy;
  // platform
  ops.push({ op: 'fill', block: S, from: [cx - half - 3, floorY - 1, cz - half - 3], x2: cx + half + 3, y2: floorY - 1, z2: cz + half + 3 });
  // clear interior
  ops.push({ op: 'clear', from: [cx - half + 1, floorY, cz - half + 1], x2: cx + half - 1, y2: floorY + wallH + 4, z2: cz + half - 1 });
  // walls
  ops.push({ op: 'wall', block: S, from: [cx - half, floorY, cz - half], x2: cx + half, y2: floorY + wallH, z2: cz + half });
  // corner towers
  for (const [tx, tz] of [[-half, -half], [half, -half], [-half, half], [half, half]] as const) {
    const th = wallH + 5;
    ops.push({ op: 'cylinder', block: S, x: cx + tx, y: floorY, z: cz + tz, r: 2.4, h: th });
    ops.push({ op: 'cylinder', block: SB, x: cx + tx, y: floorY + th, z: cz + tz, r: 2.9, h: 1 });
    ops.push({ op: 'set', block: LA, x: cx + tx, y: floorY + th + 1, z: cz + tz });
  }
  // battlements
  for (let i = -half; i <= half; i += 2) {
    ops.push({ op: 'set', block: SB, x: cx + i, y: floorY + wallH + 1, z: cz - half });
    ops.push({ op: 'set', block: SB, x: cx + i, y: floorY + wallH + 1, z: cz + half });
    ops.push({ op: 'set', block: SB, x: cx - half, y: floorY + wallH + 1, z: cz + i });
    ops.push({ op: 'set', block: SB, x: cx + half, y: floorY + wallH + 1, z: cz + i });
  }
  // gate (front = -z)
  ops.push({ op: 'clear', from: [cx - 1, floorY, cz - half], x2: cx + 1, y2: floorY + 3, z2: cz - half });
  ops.push({ op: 'set', block: GB, x: cx - 1, y: floorY + 4, z: cz - half });
  ops.push({ op: 'set', block: GB, x: cx + 1, y: floorY + 4, z: cz - half });
  // windows
  for (let i = -half + 2; i <= half - 2; i += 3) {
    ops.push({ op: 'set', block: GL, x: cx + i, y: floorY + 4, z: cz - half });
    ops.push({ op: 'set', block: GL, x: cx + i, y: floorY + 4, z: cz + half });
    ops.push({ op: 'set', block: GL, x: cx - half, y: floorY + 4, z: cz + i });
    ops.push({ op: 'set', block: GL, x: cx + half, y: floorY + 4, z: cz + i });
  }
  // throne + carpet
  ops.push({ op: 'fill', block: WR, from: [cx - 1, floorY, cz + 2], x2: cx + 1, y2: floorY, z2: cz + half - 2 });
  ops.push({ op: 'set', block: GB, x: cx, y: floorY + 1, z: cz + half - 2 });
  ops.push({ op: 'wall', block: OBB, from: [cx - 1, floorY + 1, cz + half - 1], x2: cx + 1, y2: floorY + 3, z2: cz + half - 1 });
  // pillars inside
  for (const px of [-half + 3, half - 3]) for (const pz of [-half + 3, half - 3]) {
    ops.push({ op: 'fill', block: LO, from: [cx + px, floorY, cz + pz], x2: cx + px, y2: floorY + wallH - 1, z2: cz + pz });
    ops.push({ op: 'set', block: LA, x: cx + px, y: floorY + wallH - 1, z: cz + pz });
  }
  // garden pond in front
  ops.push({ op: 'cylinder', block: B.WATER, x: cx, y: floorY - 1, z: cz - half - 6, r: 3, h: 1 });
  ops.push({ op: 'cylinder', block: MO, x: cx, y: floorY - 1, z: cz - half - 6, r: 4.2, h: 1, hollow: true });
  ops.push({ op: 'tree', kind: 'cherry', x: cx - half - 5, y: floorY, z: cz - half - 2 });
  ops.push({ op: 'tree', kind: 'cherry', x: cx + half + 5, y: floorY, z: cz - half - 2 });
  return ops;
}

function castle(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const half = Math.floor(size / 2);
  const wallH = Math.max(7, Math.floor(size * 0.4));
  ops.push({ op: 'fill', block: SB, from: [cx - half - 2, cy - 1, cz - half - 2], x2: cx + half + 2, y2: cy - 1, z2: cz + half + 2 });
  ops.push({ op: 'wall', block: SB, from: [cx - half, cy, cz - half], x2: cx + half, y2: cy + wallH, z2: cz + half });
  for (let i = -half; i <= half; i += 2) {
    ops.push({ op: 'set', block: CO, x: cx + i, y: cy + wallH + 1, z: cz - half });
    ops.push({ op: 'set', block: CO, x: cx + i, y: cy + wallH + 1, z: cz + half });
    ops.push({ op: 'set', block: CO, x: cx - half, y: cy + wallH + 1, z: cz + i });
    ops.push({ op: 'set', block: CO, x: cx + half, y: cy + wallH + 1, z: cz + i });
  }
  // keep tower in middle
  const th = wallH + 6;
  ops.push({ op: 'cylinder', block: SB, x: cx, y: cy, z: cz, r: 3.2, h: th });
  ops.push({ op: 'cylinder', block: CO, x: cx, y: cy + th, z: cz, r: 3.8, h: 1 });
  ops.push({ op: 'set', block: WR, x: cx, y: cy + th + 1, z: cz });
  ops.push({ op: 'set', block: LA, x: cx, y: cy + th, z: cz });
  // gate
  ops.push({ op: 'clear', from: [cx - 1, cy, cz - half], x2: cx + 1, y2: cy + 3, z2: cz - half });
  // corner turrets
  for (const [tx, tz] of [[-half, -half], [half, -half], [-half, half], [half, half]] as const) {
    ops.push({ op: 'cylinder', block: SB, x: cx + tx, y: cy, z: cz + tz, r: 2, h: th + 3 });
    ops.push({ op: 'set', block: LA, x: cx + tx, y: cy + th + 3, z: cz + tz });
  }
  return ops;
}

function house(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const half = Math.max(3, Math.floor(size / 2));
  const wallH = 4;
  ops.push({ op: 'fill', block: PL, from: [cx - half, cy - 1, cz - half], x2: cx + half, y2: cy - 1, z2: cz + half });
  ops.push({ op: 'clear', from: [cx - half + 1, cy, cz - half + 1], x2: cx + half - 1, y2: cy + wallH + 3, z2: cz + half - 1 });
  ops.push({ op: 'wall', block: PL, from: [cx - half, cy, cz - half], x2: cx + half, y2: cy + wallH, z2: cz + half });
  // log corners
  for (const [px, pz] of [[-half, -half], [half, -half], [-half, half], [half, half]] as const) {
    ops.push({ op: 'fill', block: LO, from: [cx + px, cy, cz + pz], x2: cx + px, y2: cy + wallH, z2: cz + pz });
  }
  // door + windows
  ops.push({ op: 'clear', from: [cx, cy, cz - half], x2: cx, y2: cy + 1, z2: cz - half });
  ops.push({ op: 'set', block: TO, x: cx - 1, y: cy, z: cz - half + 1 });
  for (const wx of [-half + 2, half - 2]) {
    ops.push({ op: 'set', block: GL, x: cx + wx, y: cy + 2, z: cz - half });
    ops.push({ op: 'set', block: GL, x: cx + wx, y: cy + 2, z: cz + half });
  }
  // pitched slab roof
  for (let i = 0; i <= half; i++) {
    ops.push({ op: 'fill', block: B.SLAB, from: [cx - half + i, cy + wallH + i, cz - half - 1], x2: cx + half - i, y2: cy + wallH + i, z2: cz - half - 1 });
    ops.push({ op: 'fill', block: B.SLAB, from: [cx - half + i, cy + wallH + i, cz + half + 1], x2: cx + half - i, y2: cy + wallH + i, z2: cz + half + 1 });
    ops.push({ op: 'fill', block: LO, from: [cx - half + i, cy + wallH + i, cz - half], x2: cx + half - i, y2: cy + wallH + i, z2: cz + half });
  }
  ops.push({ op: 'set', block: LA, x: cx, y: cy + wallH - 1, z: cz });
  return ops;
}

function tower(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const h = Math.max(12, size * 3);
  const r = Math.max(2, size / 2);
  ops.push({ op: 'cylinder', block: SB, x: cx, y: cy, z: cz, r, h });
  ops.push({ op: 'cylinder', block: CO, x: cx, y: cy + h, z: cz, r: r + 0.6, h: 1 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ops.push({ op: 'set', block: CO, x: Math.round(cx + Math.cos(a) * (r + 0.6)), y: cy + h + 1, z: Math.round(cz + Math.sin(a) * (r + 0.6)) });
  }
  ops.push({ op: 'set', block: LA, x: cx, y: cy + h, z: cz });
  ops.push({ op: 'set', block: WR, x: cx, y: cy + h + 1, z: cz });
  return ops;
}

function dome(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  ops.push({ op: 'sphere', block: GL, x: cx, y: cy, z: cz, r: Math.max(4, size / 1.6), hollow: true });
  ops.push({ op: 'cylinder', block: WO, x: cx, y: cy - 1, z: cz, r: Math.max(4, size / 1.6) + 1, h: 1 });
  ops.push({ op: 'set', block: LA, x: cx, y: cy + 1, z: cz });
  return ops;
}

function pyramid(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const base = Math.max(5, size);
  for (let i = 0; i < Math.floor(base / 2); i++) {
    ops.push({ op: 'fill', block: S, from: [cx - base / 2 + i, cy + i, cz - base / 2 + i], x2: cx + base / 2 - i, y2: cy + i, z2: cz + base / 2 - i });
  }
  ops.push({ op: 'set', block: GB, x: cx, y: cy + Math.floor(base / 2), z: cz });
  return ops;
}

function bridge(cx: number, cy: number, cz: number, dirX: number, dirZ: number, len: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const L = Math.max(6, len);
  for (let i = 0; i < L; i++) {
    const x = Math.round(cx + dirX * i), z = Math.round(cz + dirZ * i);
    const arc = Math.round(Math.sin((i / (L - 1)) * Math.PI) * 2);
    ops.push({ op: 'fill', block: PL, from: [x - 1, cy + arc, z - 1], x2: x + 1, y2: cy + arc, z2: z + 1 });
    if (i % 3 === 0) {
      ops.push({ op: 'set', block: LO, x: x - 1, y: cy + arc + 1, z: z - 1 });
      ops.push({ op: 'set', block: LO, x: x + 1, y: cy + arc + 1, z: z + 1 });
    }
  }
  return ops;
}

function garden(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const r = Math.max(5, Math.floor(size / 2));
  ops.push({ op: 'cylinder', block: B.GRASS, x: cx, y: cy - 1, z: cz, r, h: 1 });
  ops.push({ op: 'cylinder', block: B.WATER, x: cx, y: cy - 1, z: cz, r: r * 0.35, h: 1 });
  ops.push({ op: 'cylinder', block: CO, x: cx, y: cy - 1, z: cz, r: r * 0.42, h: 1, hollow: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(a) * r * 0.75), pz = Math.round(cz + Math.sin(a) * r * 0.75);
    ops.push({ op: 'set', block: i % 2 ? B.FLOWER_RED : B.FLOWER_PINK, x: px, y: cy, z: pz });
  }
  for (const a of [0.5, 2.2, 4.0, 5.6]) {
    const px = Math.round(cx + Math.cos(a) * r * 0.95), pz = Math.round(cz + Math.sin(a) * r * 0.95);
    ops.push({ op: 'fill', block: LO, from: [px, cy, pz], x2: px, y2: cy + 2, z2: pz });
    ops.push({ op: 'set', block: LA, x: px, y: cy + 3, z: pz });
  }
  ops.push({ op: 'tree', kind: 'cherry', x: cx + r - 2, y: cy, z: cz });
  ops.push({ op: 'tree', kind: 'oak', x: cx - r + 2, y: cy, z: cz });
  return ops;
}

function maze(cx: number, cy: number, cz: number, size: number): BuildOp[] {
  const ops: BuildOp[] = [];
  const n = Math.max(9, Math.floor(size / 2) * 2 + 1);
  const grid: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(true));
  // recursive backtracker
  const stack: [number, number][] = [[1, 1]];
  grid[1][1] = false;
  while (stack.length) {
    const [x, z] = stack[stack.length - 1];
    const dirs: [number, number][] = [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => Math.random() - 0.5) as [number, number][];
    let moved = false;
    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      if (nx > 0 && nx < n - 1 && nz > 0 && nz < n - 1 && grid[nz][nx]) {
        grid[nz][nx] = false; grid[z + dz / 2][x + dx / 2] = false;
        stack.push([nx, nz]); moved = true; break;
      }
    }
    if (!moved) stack.pop();
  }
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    if (grid[z][x]) ops.push({ op: 'fill', block: CV, from: [cx - Math.floor(n / 2) + x, cy, cz - Math.floor(n / 2) + z], x2: cx - Math.floor(n / 2) + x, y2: cy + 2, z2: cz - Math.floor(n / 2) + z });
  }
  ops.push({ op: 'set', block: GB, x: cx + n - Math.floor(n / 2) - 2, y: cy, z: cz + n - Math.floor(n / 2) - 2 });
  return ops;
}

function fountain(cx: number, cy: number, cz: number): BuildOp[] {
  const ops: BuildOp[] = [];
  ops.push({ op: 'cylinder', block: ST, x: cx, y: cy - 1, z: cz, r: 3.4, h: 1 });
  ops.push({ op: 'cylinder', block: B.WATER, x: cx, y: cy - 1, z: cz, r: 2.6, h: 1 });
  ops.push({ op: 'cylinder', block: SB, x: cx, y: cy, z: cz, r: 3.4, h: 1, hollow: true });
  ops.push({ op: 'fill', block: SB, from: [cx, cy, cz], x2: cx, y2: cy + 2, z2: cz });
  ops.push({ op: 'set', block: B.WATER, x: cx, y: cy + 3, z: cz });
  ops.push({ op: 'set', block: LA, x: cx + 3, y: cy, z: cz });
  ops.push({ op: 'set', block: LA, x: cx - 3, y: cy, z: cz });
  ops.push({ op: 'set', block: LA, x: cx, y: cy, z: cz + 3 });
  ops.push({ op: 'set', block: LA, x: cx, y: cy, z: cz - 3 });
  return ops;
}

function bigTree(cx: number, cy: number, cz: number, kind: 'oak' | 'birch' | 'spruce' | 'cherry'): BuildOp[] {
  const ops: BuildOp[] = [];
  const log = kind === 'birch' ? B.BIRCH_LOG : kind === 'spruce' ? B.SPRUCE_LOG : kind === 'cherry' ? CL : LO;
  const leaf = kind === 'birch' ? B.BIRCH_LEAVES : kind === 'spruce' ? B.SPRUCE_LEAVES : kind === 'cherry' ? CV : B.LEAVES;
  const h = kind === 'spruce' ? 10 : 7;
  ops.push({ op: 'fill', block: log, from: [cx, cy, cz], x2: cx, y2: cy + h, z2: cz });
  if (kind === 'spruce') {
    for (let i = 0; i < 5; i++) {
      const r = 4 - i;
      ops.push({ op: 'cylinder', block: leaf, x: cx, y: cy + h - 1 - i * 2, z: cz, r, h: 1 });
    }
    ops.push({ op: 'set', block: leaf, x: cx, y: cy + h + 1, z: cz });
  } else {
    const r = kind === 'cherry' ? 4 : 3;
    ops.push({ op: 'sphere', block: leaf, x: cx, y: cy + h + 1, z: cz, r, hollow: false });
    if (kind === 'cherry') ops.push({ op: 'cylinder', block: leaf, x: cx, y: cy + h - 1, z: cz, r: r + 1, h: 1 });
  }
  return ops;
}

// ---------------- offline natural language parser ----------------
const SIZE_WORDS: [string, number][] = [['tiny', 6], ['small', 9], ['medium', 14], ['big', 18], ['large', 18], ['huge', 24], ['giant', 26], ['massive', 28]];
const MAT_WORDS: [RegExp, number][] = [
  [/glass|crystal|ice/i, GL], [/stone ?brick/i, SB], [/sand ?stone|sandstone|desert/i, S],
  [/wood|oak|plank/i, PL], [/cobble/i, CO], [/stone/i, ST], [/snow|ice/i, SS], [/cherry|pink|sakura/i, CV],
];

export function parseBuild(text: string): { plan: BuildPlan; description: string } | null {
  const t = text.toLowerCase();
  const size = SIZE_WORDS.find(([w]) => t.includes(w))?.[1] ?? 14;
  const mat = MAT_WORDS.find(([re]) => re.test(t))?.[1];

  // position words handled by caller (uses player look)
  const gen = (ops: BuildOp[], name: string, description: string) => ({ plan: { name, ops }, description });

  if (/palace/.test(t)) return gen(palace(0, 0, 0, size), 'Palace', `a grand ${size}-block sandstone palace with towers, throne room & cherry garden`);
  if (/castle/.test(t)) return gen(castle(0, 0, 0, size), 'Castle', `a fortified stone-brick castle with battlements and a central keep`);
  if (/house|home|cottage|hut|cabin/.test(t)) return gen(house(0, 0, 0, size), 'House', `a cozy cottage with pitched roof and lantern light`);
  if (/tower|lighthouse/.test(t)) return gen(tower(0, 0, 0, size), 'Tower', `a tall watchtower with a beacon on top`);
  if (/dome|observatory|planetarium/.test(t)) return gen(dome(0, 0, 0, size), 'Dome', `a glass observation dome`);
  if (/pyramid|sphinx|temple/.test(t)) return gen(pyramid(0, 0, 0, size), 'Pyramid', `a desert pyramid with a golden capstone`);
  if (/bridge/.test(t)) return gen(bridge(0, 0, 0, 1, 0, size), 'Bridge', `an arched wooden bridge`);
  if (/garden|park|flower ?field/.test(t)) return gen(garden(0, 0, 0, size), 'Garden', `a landscaped garden with pond, lanterns & blossoms`);
  if (/maze|hedge|labyrinth/.test(t)) return gen(maze(0, 0, 0, size), 'Maze', `a cherry-hedge labyrinth with a golden prize`);
  if (/fountain/.test(t)) return gen(fountain(0, 0, 0), 'Fountain', `a stone fountain with lanterns`);
  if (/(tree|forest|grove|wood)/.test(t)) {
    const kind = /cherry|pink|sakura/.test(t) ? 'cherry' : /birch/.test(t) ? 'birch' : /spruce|pine/.test(t) ? 'spruce' : 'oak';
    const count = /forest|grove|many|lots/.test(t) ? 7 : 1;
    const ops: BuildOp[] = [];
    for (let i = 0; i < count; i++) {
      ops.push({ op: 'tree', kind, x: 0 + Math.round(Math.cos(i * 2.4) * (i * 2.2)), y: 0, z: Math.round(Math.sin(i * 2.4) * (i * 2.2)) });
    }
    return gen(ops, 'Trees', `${count} ${kind} tree${count > 1 ? 's' : ''}`);
  }
  if (/clear|flatten|remove|demolish|erase/.test(t)) {
    return gen([{ op: 'clear', from: [0, 0, 0], x2: size, y2: 12, z2: size }], 'Clear', `the area flattened`);
  }
  if (/platform|foundation|base|pad/.test(t)) {
    const b = mat ?? PL;
    return gen([{ op: 'cylinder', block: b, x: 0, y: -1, z: 0, r: size / 2, h: 1 }], 'Platform', `a platform platform`);
  }
  if (/statue|monument|obelisk/.test(t)) {
    return gen([
      { op: 'fill', block: ST, from: [0, -1, 0], x2: 2, y2: -1, z2: 2 },
      { op: 'fill', block: SB, from: [1, 0, 1], x2: 1, y2: 8, z2: 1 },
      { op: 'set', block: DB, x: 1, y: 9, z: 1 },
      { op: 'set', block: LA, x: 0, y: 0, z: 1 }, { op: 'set', block: LA, x: 2, y: 0, z: 1 },
    ], 'Statue', `an obelisk monument crowned with diamond`);
  }
  return null;
}

// ---------------- executor context (implemented by Game) ----------------
export interface BuildContext {
  setBlock(x: number, y: number, z: number, id: number): void;
  surfaceY(x: number, z: number): number;
  getBlock(x: number, y: number, z: number): number;
}

export function* planToBlocks(plan: BuildOp[], anchor: { x: number; y: number; z: number }, ctx: BuildContext): Generator<[number, number, number, number]> {
  for (const o of plan) {
      const ox = anchor.x + (o.x ?? 0), oy = anchor.y + (o.y ?? 0), oz = anchor.z + (o.z ?? 0);
      if (o.op === 'set') { yield [ox, oy, oz, o.block ?? B.STONE]; continue; }
      if (o.op === 'fill') {
        const [x1, y1, z1] = [anchor.x + (o.from?.[0] ?? 0), anchor.y + (o.from?.[1] ?? 0), anchor.z + (o.from?.[2] ?? 0)];
        const [x2, y2, z2] = [anchor.x + (o.x2 ?? 0), anchor.y + (o.y2 ?? 0), anchor.z + (o.z2 ?? 0)];
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
          for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) yield [x, y, z, o.block ?? B.STONE];
        continue;
      }
      if (o.op === 'clear') {
        const [x1, y1, z1] = [anchor.x + (o.from?.[0] ?? 0), anchor.y + (o.from?.[1] ?? 0), anchor.z + (o.from?.[2] ?? 0)];
        const [x2, y2, z2] = [anchor.x + (o.x2 ?? 0), anchor.y + (o.y2 ?? 0), anchor.z + (o.z2 ?? 0)];
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
          for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) yield [x, y, z, 0];
        continue;
      }
      if (o.op === 'sphere') {
        const r = o.r ?? 3;
        for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
          for (let z = -Math.ceil(r); z <= Math.ceil(r); z++)
            for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
              const d = Math.sqrt(x * x + y * y + z * z);
              const inside = o.hollow ? d <= r && d >= r - 1.2 : d <= r - 0.4;
              if (inside) yield [ox + x, oy + y, oz + z, o.block ?? B.STONE];
            }
        continue;
      }
      if (o.op === 'cylinder') {
        const r = o.r ?? 3;
        const h = o.h ?? 1;
        for (let dy = 0; dy < h; dy++)
          for (let z = -Math.ceil(r); z <= Math.ceil(r); z++)
            for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
              const d = Math.sqrt(x * x + z * z);
              const inside = o.hollow ? d <= r && d >= r - 1.3 : d <= r - 0.4;
              if (inside) yield [ox + x, oy + dy, oz + z, o.block ?? B.STONE];
            }
        continue;
      }
      if (o.op === 'wall') {
        const [x1, y1, z1] = [anchor.x + (o.from?.[0] ?? 0), anchor.y + (o.from?.[1] ?? 0), anchor.z + (o.from?.[2] ?? 0)];
        const [x2, , z2] = [anchor.x + (o.x2 ?? 0), 0, anchor.z + (o.z2 ?? 0)];
        const top = anchor.y + (o.y2 ?? y1 + 4);
        for (let y = y1; y <= top; y++) {
          for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            yield [x, y, z1, o.block ?? B.STONE];
            yield [x, y, z2, o.block ?? B.STONE];
          }
          for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
            yield [x1, y, z, o.block ?? B.STONE];
            yield [x2, y, z, o.block ?? B.STONE];
          }
        }
        continue;
      }
      if (o.op === 'tree') {
        const tx = anchor.x + (o.x ?? 0), tz = anchor.z + (o.z ?? 0);
        const ty = ctx.surfaceY(tx, tz) + 1;
        for (const b of bigTree(0, 0, 0, o.kind ?? 'oak')) {
          for (const op2 of [b]) {
            if (op2.op === 'fill') {
              const [x1, y1, z1] = [tx + (op2.from?.[0] ?? 0), ty + (op2.from?.[1] ?? 0), tz + (op2.from?.[2] ?? 0)];
              const [x2, y2, z2] = [tx + (op2.x2 ?? 0), ty + (op2.y2 ?? 0), tz + (op2.z2 ?? 0)];
              for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
                for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
                  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) yield [x, y, z, op2.block ?? B.STONE];
            } else if (op2.op === 'sphere') {
              const r = op2.r ?? 3;
              const sx = tx + (op2.x ?? 0), sy = ty + (op2.y ?? 0), sz = tz + (op2.z ?? 0);
              for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
                for (let z = -Math.ceil(r); z <= Math.ceil(r); z++)
                  for (let x = -Math.ceil(r); x <= Math.ceil(r); x++)
                    if (Math.sqrt(x * x + y * y + z * z) <= r - 0.4) yield [sx + x, sy + y, sz + z, op2.block ?? B.STONE];
            } else if (op2.op === 'cylinder') {
              const r = op2.r ?? 3;
              for (let z = -Math.ceil(r); z <= Math.ceil(r); z++)
                for (let x = -Math.ceil(r); x <= Math.ceil(r); x++)
                  if (Math.sqrt(x * x + z * z) <= (op2.hollow ? r : r - 0.4)) yield [tx + (op2.x ?? 0) + x, ty + (op2.y ?? 0), tz + (op2.z ?? 0) + z, op2.block ?? B.STONE];
            } else if (op2.op === 'set') {
              yield [tx + (op2.x ?? 0), ty + (op2.y ?? 0), tz + (op2.z ?? 0), op2.block ?? B.STONE];
            }
          }
        }
        continue;
      }
  }
}

export const BUILD_PRESETS = [
  { label: '🏰 Palace', text: 'build a big palace' },
  { label: '🏯 Castle', text: 'build a large castle' },
  { label: '🏠 House', text: 'build a small house' },
  { label: '🗼 Tower', text: 'build a tall tower' },
  { label: '🔮 Dome', text: 'build a glass dome' },
  { label: '🔺 Pyramid', text: 'build a huge pyramid' },
  { label: '🌸 Garden', text: 'build a cherry garden' },
  { label: '🌀 Maze', text: 'build a big maze' },
  { label: '⛲ Fountain', text: 'build a fountain' },
  { label: '🌉 Bridge', text: 'build a long bridge' },
  { label: '🌲 Forest', text: 'grow a spruce forest' },
  { label: '🗿 Statue', text: 'build a statue' },
];
