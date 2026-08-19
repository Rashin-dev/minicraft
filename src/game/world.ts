// World: chunked voxel storage, terrain generation, lighting, meshing with vertex AO
import * as THREE from 'three';
import { B, blockDef, isOpaque } from './blocks';
import { fbm2, hash3, mulberry32 } from './noise';
import { TILES } from './atlas';

export const CHUNK = 16;
export const WORLD_H = 64;
export const SEA = 20;

export class World {
  seed: number;
  chunks = new Map<string, Uint8Array>();       // "cx,cz" -> blocks
  dirtyChunks = new Set<string>();
  diffs = new Map<string, number>();            // "x,y,z" -> id (for saving)
  private heightCache = new Map<string, number>();

  constructor(seed: number) { this.seed = seed; }

  static key(cx: number, cz: number) { return cx + ',' + cz; }

  getChunk(cx: number, cz: number): Uint8Array {
    const k = World.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) { c = this.generate(cx, cz); this.chunks.set(k, c); }
    return c;
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_H) return 0;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(World.key(cx, cz));
    if (!c) return 0;
    return c[(y * CHUNK + (z - cz * CHUNK)) * CHUNK + (x - cx * CHUNK)];
  }

  setBlock(x: number, y: number, z: number, id: number, record = true) {
    if (y < 0 || y >= WORLD_H) return;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.getChunk(cx, cz);
    c[(y * CHUNK + (z - cz * CHUNK)) * CHUNK + (x - cx * CHUNK)] = id;
    this.heightCache.delete(x + ',' + z);
    if (record) this.diffs.set(x + ',' + y + ',' + z, id);
    this.dirtyChunks.add(World.key(cx, cz));
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    if (lx === 0) this.dirtyChunks.add(World.key(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirtyChunks.add(World.key(cx + 1, cz));
    if (lz === 0) this.dirtyChunks.add(World.key(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirtyChunks.add(World.key(cx, cz + 1));
  }

  topY(x: number, z: number): number {
    const k = x + ',' + z;
    const cached = this.heightCache.get(k);
    if (cached !== undefined) return cached;
    for (let y = WORLD_H - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== 0 && !blockDef(id)?.cross && !blockDef(id)?.torchLike) { this.heightCache.set(k, y); return y; }
    }
    return 0;
  }

  // ---- Terrain generation ----
  private heightAt(x: number, z: number): number {
    const n1 = fbm2(x * 0.008, z * 0.008, this.seed, 4);          // continents
    const n2 = fbm2(x * 0.03, z * 0.03, this.seed + 7, 3);        // hills
    const m = fbm2(x * 0.004 + 500, z * 0.004 + 500, this.seed + 13, 3); // mountains mask
    let h = 18 + n1 * 12 + n2 * 6;
    if (m > 0.55) h += (m - 0.55) * 90;                            // mountain ridges
    return Math.min(WORLD_H - 10, Math.floor(h));
  }

  private generate(cx: number, cz: number): Uint8Array {
    const data = new Uint8Array(CHUNK * WORLD_H * CHUNK);
    const rng = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ this.seed);
    const set = (lx: number, y: number, lz: number, id: number) => {
      data[(y * CHUNK + lz) * CHUNK + lx] = id;
    };
    for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
      const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
      const h = this.heightAt(x, z);
      const beach = h <= SEA + 1;
      const snowy = h > 42;
      const desert = fbm2(x * 0.006 + 900, z * 0.006 + 900, this.seed + 31, 2) > 0.62 && !snowy;
      for (let y = 0; y <= h; y++) {
        let id: number = B.STONE;
        if (y === 0) id = B.BEDROCK;
        else if (y < h - 3) {
          id = B.STONE;
          const ore = hash3(x, y, z, this.seed + 77);
          if (y < 14 && ore > 0.996) id = B.DIAMOND_ORE;
          else if (y < 24 && ore > 0.988) id = B.GOLD_ORE;
          else if (y < 32 && ore > 0.975) id = B.IRON_ORE;
          else if (ore > 0.96) id = B.COAL_ORE;
          else if (hash3(x, y, z, this.seed + 99) > 0.97) id = hash3(x, y, z, 5) > 0.5 ? B.MOSS : B.COBBLE;
        }
        else if (y < h) id = desert || beach ? B.SAND : B.DIRT;
        else id = snowy ? B.SNOW : (desert || beach ? B.SAND : B.GRASS);
        set(lx, y, lz, id);
      }
      // water
      for (let y = h + 1; y <= SEA; y++) set(lx, y, lz, B.WATER);
      if (h + 1 <= SEA && snowy) set(lx, SEA, lz, B.ICE);
      // decorations on surface
      const surface = Math.max(h, 0);
      const above = this.getBlockSafeGen(x, surface + 1, z, h);
      if (surface > SEA && above === 0) {
        const r = rng();
        const topId = data[(surface * CHUNK + lz) * CHUNK + lx];
        if (topId === B.GRASS) {
          if (r < 0.012) this.tryTree(data, lx, surface + 1, lz, rng);
          else if (r < 0.03) set(lx, surface + 1, lz, B.FLOWER_RED);
          else if (r < 0.05) set(lx, surface + 1, lz, B.FLOWER_YELLOW);
          else if (r < 0.16) set(lx, surface + 1, lz, B.TALLGRASS);
        } else if (topId === B.SAND && desert && r < 0.015) {
          const ch = 2 + Math.floor(rng() * 2);
          for (let i = 1; i <= ch && surface + i < WORLD_H; i++) set(lx, surface + i, lz, B.CACTUS);
        }
      }
    }
    return data;
  }

  private getBlockSafeGen(_x: number, _y: number, _z: number, _h: number): number { return 0; }

  private tryTree(data: Uint8Array, lx: number, y: number, lz: number, rng: ReturnType<typeof mulberry32>) {
    const h = 4 + Math.floor(rng() * 2);
    if (lx < 2 || lx > CHUNK - 3 || lz < 2 || lz > CHUNK - 3 || y + h + 2 >= WORLD_H) return;
    const set = (x: number, yy: number, z: number, id: number) => {
      if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK && yy >= 0 && yy < WORLD_H) {
        const i = (yy * CHUNK + z) * CHUNK + x;
        if (data[i] === 0 || data[i] === B.TALLGRASS || data[i] === B.FLOWER_RED || data[i] === B.FLOWER_YELLOW) data[i] = id;
      }
    };
    for (let i = 0; i < h; i++) set(lx, y + i, lz, B.LOG);
    for (let dy = h - 2; dy <= h + 1; dy++) {
      const r = dy >= h ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.5) continue;
        set(lx + dx, y + dy, lz + dz, B.LEAVES);
      }
    }
  }
}

// ---------- Lighting ----------
// Per-chunk light arrays computed at mesh time: sky light (vertical flood) + torch BFS.
export function computeLight(world: World, cx: number, cz: number): Uint8Array {
  const S = CHUNK + 2;
  const light = new Uint8Array(S * WORLD_H * S);
  const idx = (x: number, y: number, z: number) => (y * S + z) * S + x;
  const get = (x: number, y: number, z: number) =>
    world.getBlock(cx * CHUNK + x - 1, y, cz * CHUNK + z - 1);

  // sunlight straight down
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    let blocked = false;
    for (let y = WORLD_H - 1; y >= 0; y--) {
      const id = get(x, y, z);
      if (id === 0 || !isOpaque(id)) {
        if (!blocked) light[idx(x, y, z)] = 15;
      } else blocked = true;
    }
  }
  // BFS spread (sky + emissive)
  const queue: number[] = [];
  const push = (x: number, y: number, z: number, v: number) => {
    if (x < 0 || x >= S || z < 0 || z >= S || y < 0 || y >= WORLD_H) return;
    const i = idx(x, y, z);
    if (light[i] >= v) return;
    const id = get(x, y, z);
    if (id !== 0 && isOpaque(id)) return;
    light[i] = v; queue.push(x, y, z);
  };
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) for (let y = 0; y < WORLD_H; y++) {
    const id = get(x, y, z);
    const d = blockDef(id);
    if (d?.light) { light[idx(x, y, z)] = Math.max(light[idx(x, y, z)], d.light); queue.push(x, y, z); }
  }
  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++], z = queue[qi++];
    const v = light[idx(x, y, z)];
    if (v <= 1) continue;
    push(x + 1, y, z, v - 1); push(x - 1, y, z, v - 1);
    push(x, y + 1, z, v - 1); push(x, y - 1, z, v - 1);
    push(x, y, z + 1, v - 1); push(x, y, z - 1, v - 1);
  }
  return light;
}

// ---------- Meshing ----------
interface MeshBuffers {
  positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[];
}

const FACES = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], name: 'side' },
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], name: 'side' },
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], name: 'bottom' },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], name: 'top' },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], name: 'side' },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], name: 'side' },
] as const;

export function buildChunkGeometry(
  world: World, cx: number, cz: number, uvFor: (t: number) => [number, number, number, number],
  nightLight: number, aoEnabled: boolean
): { opaque: THREE.BufferGeometry | null; transparent: THREE.BufferGeometry | null } {
  const light = computeLight(world, cx, cz);
  const S = CHUNK + 2;
  const lidx = (x: number, y: number, z: number) => (y * S + z) * S + x;
  const get = (x: number, y: number, z: number) =>
    world.getBlock(cx * CHUNK + x - 1, y, cz * CHUNK + z - 1);

  const op: MeshBuffers = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const tr: MeshBuffers = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

  const occludes = (id: number) => id !== 0 && isOpaque(id);

  const aoValue = (side1: boolean, side2: boolean, corner: boolean) => {
    if (side1 && side2) return 0.45;
    return 1 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0)) * 0.16;
  };

  const addBox = (
    x: number, y: number, z: number, id: number,
    min: number[], max: number[], buf: MeshBuffers, forceAll: boolean
  ) => {
    const def = blockDef(id)!;
    for (const face of FACES) {
      const [dx, dy, dz] = face.dir;
      // neighbor in world coords for culling full cubes
      if (!forceAll) {
        const nid = get(x + 1 + dx, y + dy, z + 1 + dz);
        if (nid !== 0) {
          const ndef = blockDef(nid)!;
          if (ndef.opaque) continue;
          if (nid === id && def.liquid) continue;
          if (def.liquid && nid === B.WATER && dy === 1) continue;
        }
      }
      // skip faces internal to the sub-box
      if (forceAll) {
        if (dx === -1 && min[0] > 0) continue; if (dx === 1 && max[0] < 1) continue;
        if (dy === -1 && min[1] > 0) continue; if (dy === 1 && max[1] < 1) continue;
        if (dz === -1 && min[2] > 0) continue; if (dz === 1 && max[2] < 1) continue;
      }
      const tileName = face.name === 'top' ? def.top : face.name === 'bottom' ? (def.bottom ?? def.side) : def.side;
      const [u0, v0, u1, v1] = uvFor(TILES[tileName]);
      const base = buf.positions.length / 3;
      const faceLight = light[lidx(x + 1 + dx, Math.min(WORLD_H - 1, Math.max(0, y + dy)), z + 1 + dz)];
      const lv = Math.max(faceLight / 15, nightLight * 0.25);
      const shadeMul = face.name === 'top' ? 1 : face.name === 'bottom' ? 0.6 : (dx !== 0 ? 0.82 : 0.72);
      for (let ci = 0; ci < 4; ci++) {
        const corner = face.corners[ci];
        const px = x + min[0] + corner[0] * (max[0] - min[0]);
        const py = y + min[1] + corner[1] * (max[1] - min[1]);
        const pz = z + min[2] + corner[2] * (max[2] - min[2]);
        buf.positions.push(px, py, pz);
        buf.normals.push(dx, dy, dz);
        let uu: number, vv: number;
        if (dx !== 0) { uu = corner[2] ? u1 : u0; vv = corner[1] ? v1 : v0; }
        else if (dy !== 0) { uu = corner[0] ? u1 : u0; vv = corner[2] ? v0 : v1; }
        else { uu = corner[0] ? u1 : u0; vv = corner[1] ? v1 : v0; }
        buf.uvs.push(uu, vv);
        let ao = 1;
        if (aoEnabled && !def.liquid) {
          // sample 3 neighbor blocks around this corner on the face plane
          const bx = x + 1 + dx, by = y + dy, bz = z + 1 + dz;
          const t1: number[] = [], t2: number[] = [];
          if (dx !== 0) { t1.push(0, 1, 0); t2.push(0, 0, 1); }
          else if (dy !== 0) { t1.push(1, 0, 0); t2.push(0, 0, 1); }
          else { t1.push(1, 0, 0); t2.push(0, 1, 0); }
          const s1 = corner[['x', 'y', 'z'].findIndex((_, i) => t1[i] === 1)] === 1 ? 1 : -1;
          const s2 = corner[['x', 'y', 'z'].findIndex((_, i) => t2[i] === 1)] === 1 ? 1 : -1;
          const side1 = occludes(get(bx + t1[0] * s1, by + t1[1] * s1, bz + t1[2] * s1));
          const side2 = occludes(get(bx + t2[0] * s2, by + t2[1] * s2, bz + t2[2] * s2));
          const corn = occludes(get(bx + t1[0] * s1 + t2[0] * s2, by + t1[1] * s1 + t2[1] * s2, bz + t1[2] * s1 + t2[2] * s2));
          ao = aoValue(side1, side2, corn);
        }
        const b = lv * shadeMul * ao;
        buf.colors.push(b, b, b);
      }
      buf.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  };

  const addCross = (x: number, y: number, z: number, id: number) => {
    const def = blockDef(id)!;
    const [u0, v0, u1, v1] = uvFor(TILES[def.side]);
    const lv = Math.max(light[lidx(x + 1, y, z + 1)] / 15, nightLight * 0.25);
    for (const rot of [0, 1]) {
      const base = op.positions.length / 3;
      const off = 0.15, ext = 0.85;
      const pts = rot === 0
        ? [[off, 0, off], [ext, 0, ext], [off, 1, off], [ext, 1, ext]]
        : [[off, 0, ext], [ext, 0, off], [off, 1, ext], [ext, 1, off]];
      for (let ci = 0; ci < 4; ci++) {
        op.positions.push(x + pts[ci][0], y + pts[ci][1], z + pts[ci][2]);
        op.normals.push(0, 1, 0);
        op.uvs.push(ci % 2 === 0 ? u0 : u1, ci < 2 ? v0 : v1);
        op.colors.push(lv, lv, lv);
      }
      op.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      op.indices.push(base + 2, base + 1, base, base + 3, base + 1, base + 2);
    }
  };

  const addTorch = (x: number, y: number, z: number, id: number) => {
    addBox(x, y, z, id, [6 / 16, 0, 6 / 16], [10 / 16, 10 / 16, 10 / 16], op, true);
  };

  for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
    for (let y = 0; y < WORLD_H; y++) {
      const id = get(lx + 1, y, lz + 1);
      if (id === 0) continue;
      const def = blockDef(id);
      if (!def) continue;
      if (def.cross) { addCross(lx, y, lz, id); continue; }
      if (def.torchLike) { addTorch(lx, y, lz, id); continue; }
      let min = [0, 0, 0], max = [1, 1, 1];
      if (def.slab === 'bottom') max = [1, 0.5, 1];
      else if (def.slab === 'x0') max = [0.5, 1, 1];
      else if (def.slab === 'x1') min = [0.5, 0, 0];
      else if (def.slab === 'z0') max = [1, 1, 0.5];
      else if (def.slab === 'z1') min = [0, 0, 0.5];
      const isTrans = !!def.transparent;
      if (def.liquid) {
        // water surface slightly lower
        const aboveId = get(lx + 1, y + 1, lz + 1);
        if (aboveId !== B.WATER) max = [1, 14 / 16, 1];
      }
      addBox(lx, y, lz, id, min, max, isTrans ? tr : op, false);
    }
  }

  const toGeo = (b: MeshBuffers): THREE.BufferGeometry | null => {
    if (b.positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
    g.setIndex(b.indices);
    return g;
  };
  return { opaque: toGeo(op), transparent: toGeo(tr) };
}
