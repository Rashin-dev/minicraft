// Terrain generation — pure functions shared by main thread + worker
import { B } from './blocks';
import { fbm2, fbm3, hash2, hash3, mulberry32, ridged2 } from './noise';

export const CHUNK = 16;
export const WORLD_H = 80;
export const SEA = 26;

export type BiomeId = 'ocean' | 'beach' | 'plains' | 'forest' | 'birch' | 'desert' | 'snowy' | 'mountain' | 'cherry';

export interface Biome { id: BiomeId; grassTint?: number; }

export function biomeParams(x: number, z: number, seed: number): { temp: number; moist: number; mount: number } {
  const temp = fbm2(x * 0.0016 + 3000, z * 0.0016 + 3000, seed + 21, 3);
  const moist = fbm2(x * 0.0021 - 3000, z * 0.0021 - 3000, seed + 55, 3);
  const mount = fbm2(x * 0.0035 + 700, z * 0.0035 + 700, seed + 13, 3);
  return { temp, moist, mount };
}

export function heightAt(x: number, z: number, seed: number): number {
  const { mount } = biomeParams(x, z, seed);
  const cont = fbm2(x * 0.0035, z * 0.0035, seed, 4);
  const hills = fbm2(x * 0.016, z * 0.016, seed + 7, 3);
  let h = 20 + cont * 18 + hills * 7;
  if (mount > 0.52) {
    const ridge = ridged2(x * 0.011, z * 0.011, seed + 91, 4);
    h += (mount - 0.52) * 130 * (0.55 + ridge * 0.75);
  }
  return Math.max(4, Math.min(WORLD_H - 6, Math.floor(h)));
}

export function biomeAt(x: number, z: number, seed: number, h: number): BiomeId {
  const { temp, moist, mount } = biomeParams(x, z, seed);
  if (h < SEA - 3) return 'ocean';
  if (h <= SEA + 1) return 'beach';
  if (mount > 0.62 && h > 44) return 'mountain';
  if (temp < 0.38) return 'snowy';
  if (temp > 0.64 && moist < 0.42) return 'desert';
  if (temp > 0.52 && temp < 0.62 && moist > 0.46 && moist < 0.56 && fbm2(x * 0.004 + 8000, z * 0.004 + 8000, seed + 777, 2) > 0.6) return 'cherry';
  if (moist > 0.58) return temp > 0.55 ? 'birch' : 'forest';
  if (moist > 0.47) return 'forest';
  return 'plains';
}

function isCave(x: number, y: number, z: number, seed: number, h: number): boolean {
  if (y < 3 || y > h - 1) return false;
  // worm tunnels: intersection of two ridged 3D noises near zero
  const n1 = fbm3(x * 0.028, y * 0.056, z * 0.028, seed + 401, 2);
  const n2 = fbm3(x * 0.028 + 90, y * 0.056, z * 0.028 + 90, seed + 402, 2);
  const t1 = Math.abs(n1 - 0.5), t2 = Math.abs(n2 - 0.5);
  const thresh = y < 12 ? 0.052 : 0.042;
  if (t1 < thresh && t2 < thresh) return true;
  // cheese caverns deep down
  if (y < 26 && fbm3(x * 0.017, y * 0.034, z * 0.017, seed + 403, 3) > 0.76) return true;
  return false;
}

export function generateNetherChunk(seed: number, cx: number, cz: number): Uint8Array {
  const data = new Uint8Array(CHUNK * WORLD_H * CHUNK);
  const set = (lx: number, y: number, lz: number, id: number) => {
    if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK && y >= 0 && y < WORLD_H) data[(y * CHUNK + lz) * CHUNK + lx] = id;
  };
  const CEIL = 46;
  for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
    const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
    const h = Math.max(12, Math.min(34, 21 + Math.floor((fbm2(x * 0.025, z * 0.025, seed + 911, 3) - 0.5) * 16)));
    for (let y = 0; y <= h; y++) {
      if (y <= 1) { set(lx, y, lz, B.BEDROCK); continue; }
      const n = fbm3(x * 0.05, y * 0.09, z * 0.05, seed + 913, 2);
      if (n > 0.62 && y > 2 && y < h - 2) { set(lx, y, lz, 0); continue; }
      let id: number = B.NETHERRACK;
      if (n < 0.34) id = B.SOUL_SAND;
      if (y === h && hash3(x, y, z, seed + 917) > 0.8) id = B.SOUL_SAND;
      set(lx, y, lz, id);
    }
    for (let y = h + 1; y <= 10; y++) set(lx, y, lz, B.LAVA);
    for (let y = CEIL; y < WORLD_H; y++) {
      if (y < CEIL + 4) set(lx, y, lz, B.NETHERRACK);
      else if (y === CEIL + 4) set(lx, y, lz, B.BEDROCK);
    }
    if (hash3(x, CEIL - 1, z, seed + 922) > 0.965) set(lx, CEIL - 1, lz, B.GLOWSTONE);
    if (hash3(x, CEIL - 2, z, seed + 923) > 0.99) set(lx, CEIL - 2, lz, B.GLOWSTONE);
  }
  return data;
}

export function generateChunk(seed: number, cx: number, cz: number): Uint8Array {
  const data = new Uint8Array(CHUNK * WORLD_H * CHUNK);
  const set = (lx: number, y: number, lz: number, id: number) => {
    if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK && y >= 0 && y < WORLD_H) {
      data[(y * CHUNK + lz) * CHUNK + lx] = id;
    }
  };
  const get = (lx: number, y: number, lz: number): number => {
    if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= WORLD_H) return -1;
    return data[(y * CHUNK + lz) * CHUNK + lx];
  };

  const heights: number[] = [];
  for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
    const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
    const h = heightAt(x, z, seed);
    heights[lz * CHUNK + lx] = h;
    const biome = biomeAt(x, z, seed, h);
    const beach = biome === 'beach' || biome === 'ocean';
    const snowy = biome === 'snowy' || (biome === 'mountain' && h > 56);

    for (let y = 0; y <= h; y++) {
      let id: number = B.STONE;
      if (y <= 1) { set(lx, y, lz, B.BEDROCK); continue; }
      if (isCave(x, y, z, seed, h)) {
        set(lx, y, lz, y <= 8 ? B.LAVA : B.AIR);
        continue;
      }
      if (y < h - 3) {
        if (y < 6) {
          id = hash3(x, y, z, seed + 88) > 0.5 ? B.DEEPSLATE : B.COBBLED_DEEPSLATE;
          if (y === 5 && hash3(x, y, z, seed + 89) > 0.92) id = B.DEEPSLATE_BRICKS;
        } else {
          id = B.STONE;
          const ore = hash3(x, y, z, seed + 77);
          if (y < 14 && ore > 0.9965) id = B.DIAMOND_ORE;
          else if (y < 24 && ore > 0.989) id = B.GOLD_ORE;
          else if (y < 34 && ore > 0.976) id = B.IRON_ORE;
          else if (ore > 0.962) id = B.COAL_ORE;
          else if (hash3(x, y, z, seed + 99) > 0.975) id = hash3(x, y, z, 5) > 0.5 ? B.MOSS : B.COBBLE;
          else if (biome === 'desert' && y > h - 8) id = B.SANDSTONE;
        }
      } else if (y < h) {
        id = (desertish(biome) || beach) ? B.SAND : B.DIRT;
      } else {
        id = snowy ? B.SNOW : desertish(biome) || beach ? B.SAND : B.GRASS;
        if (biome === 'mountain' && h > 48) id = h > 56 ? B.SNOW : (h > 52 ? B.STONE : B.GRASS);
      }
      set(lx, y, lz, id);
    }
    // water & ice
    for (let y = h + 1; y <= SEA; y++) set(lx, y, lz, B.WATER);
    if (h + 1 <= SEA && snowy) set(lx, SEA, lz, B.ICE);
  }

  // amethyst clusters on cave floors
  for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
    const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
    for (let y = 4; y < 20; y++) {
      if (get(lx, y, lz) !== B.AIR) continue;
      const below = get(lx, y - 1, lz);
      if ((below === B.STONE || below === B.MOSS) && hash3(x, y, z, seed + 601) > 0.982) {
        set(lx, y, lz, B.AMETHYST);
      }
    }
  }

  // decorations + trees (scan with margin so trees cross chunk borders seamlessly)
  const rng = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ seed);
  void rng;
  for (let lz = -3; lz < CHUNK + 3; lz++) for (let lx = -3; lx < CHUNK + 3; lx++) {
    const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
    const inChunk = lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK;
    const h = inChunk ? heights[lz * CHUNK + lx] : heightAt(x, z, seed);
    if (h <= SEA) continue;
    const biome = biomeAt(x, z, seed, h);
    const r = hash2(x, z, seed + 313);
    const topId = inChunk ? get(lx, h, lz) : -1;
    if (inChunk && topId !== B.GRASS && topId !== B.SNOW && topId !== B.SAND) continue;
    if (!inChunk && isCave(x, h, z, seed, h)) continue;

    const surfaceY = h + 1;
    if (biome === 'desert') {
      if (r < 0.006) {
        const ch = 2 + Math.floor(hash2(x, z, seed + 5) * 3);
        for (let i = 0; i < ch; i++) set(lx, surfaceY + i, lz, B.CACTUS);
      } else if (r < 0.014) set(lx, surfaceY, lz, B.DEAD_BUSH);
      continue;
    }
    if (biome === 'snowy' || biome === 'mountain') {
      if (r < 0.012 && h < 62) spruce(set, lx, surfaceY, lz, x, z, seed);
      continue;
    }
    if (biome === 'cherry') {
      if (r < 0.022) cherryTree(set, lx, surfaceY, lz, x, z, seed);
      else if (r < 0.05) set(lx, surfaceY, lz, B.FLOWER_PINK);
      else if (r < 0.12) set(lx, surfaceY, lz, B.TALLGRASS);
      continue;
    }
    if (biome === 'birch') {
      if (r < 0.02) birchTree(set, lx, surfaceY, lz, x, z, seed);
      else if (r < 0.045) set(lx, surfaceY, lz, B.FLOWER_YELLOW);
      else if (r < 0.16) set(lx, surfaceY, lz, B.TALLGRASS);
      continue;
    }
    if (biome === 'forest') {
      if (r < 0.03) oakTree(set, lx, surfaceY, lz, x, z, seed);
      else if (r < 0.05) set(lx, surfaceY, lz, B.FLOWER_RED);
      else if (r < 0.18) set(lx, surfaceY, lz, B.TALLGRASS);
      continue;
    }
    // plains
    if (r < 0.004) oakTree(set, lx, surfaceY, lz, x, z, seed);
    else if (r < 0.014) set(lx, surfaceY, lz, hash2(x, z, seed + 9) > 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW);
    else if (r < 0.09) set(lx, surfaceY, lz, B.TALLGRASS);
  }

  // ----- villages -----
  const VREGION = 14;
  const rcx = Math.floor(cx / VREGION), rcz = Math.floor(cz / VREGION);
  if (hash2(rcx, rcz, seed + 717) < 0.16) {
    const ccxp = rcx * VREGION * CHUNK + 8, cczp = rcz * VREGION * CHUNK + 8;
    const houseOffsets = [[0, 0], [-9, -9], [9, -9], [-9, 9], [9, 9]];
    for (const [ox, oz] of houseOffsets) {
      const hx = ccxp + ox, hz = cczp + oz;
      const surfaceY = heightAt(hx, hz, seed) + 1;
      if (surfaceY <= SEA) continue;
      for (let lz = -6; lz < CHUNK + 6; lz++) for (let lx = -6; lx < CHUNK + 6; lx++) {
        const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
        const inChunk = lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK;
        if (!inChunk) continue;
        const dxw = x - hx, dzw = z - hz;
        if (Math.abs(dxw) > 2 || Math.abs(dzw) > 2) continue;
        // floor
        set(lx, surfaceY, lz, B.PLANKS);
        const edge = Math.abs(dxw) === 2 || Math.abs(dzw) === 2;
        if (edge) {
          set(lx, surfaceY + 1, lz, B.PLANKS);
          set(lx, surfaceY + 2, lz, B.PLANKS);
          if (Math.abs(dxw) === 2 && Math.abs(dzw) === 2) set(lx, surfaceY + 3, lz, B.COBBLE);
        }
        if (dxw === 0 && dzw === 2) { // south door
          set(lx, surfaceY + 1, lz, B.DOOR_L_S);
          set(lx, surfaceY + 2, lz, B.DOOR_U);
        }
        if (dxw === 0 && dzw === 0) { set(lx, surfaceY + 3, lz, B.LANTERN); set(lx, surfaceY + 1, lz, B.CHEST); }
        if (Math.abs(dxw) <= 2 && Math.abs(dzw) <= 2 && !edge && !(dxw === 0 && dzw === 2)) set(lx, surfaceY + 4, lz, B.PLANKS); // roof
      }
    }
    // a little farm
    for (let lz = -6; lz < CHUNK + 6; lz++) for (let lx = -6; lx < CHUNK + 6; lx++) {
      const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
      const inChunk = lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK;
      if (!inChunk) continue;
      const dxw = x - (ccxp + 3), dzw = z - (cczp + 3);
      if (dxw >= 0 && dxw < 4 && dzw >= 0 && dzw < 4) {
        const sy = heightAt(x, z, seed) + 1;
        set(lx, sy, lz, B.FARMLAND);
        set(lx, sy + 1, lz, dxw === 0 && dzw === 0 ? B.WHEAT_MATURE : B.WHEAT_YOUNG);
      }
    }
  }

  return data;
}

export function villageCenterChunk(cx: number, cz: number, seed: number): { cx: number; cz: number } | null {
  const VREGION = 14;
  const rcx = Math.floor(cx / VREGION), rcz = Math.floor(cz / VREGION);
  return hash2(rcx, rcz, seed + 717) < 0.16 ? { cx: rcx, cz: rcz } : null;
}

function desertish(biome: BiomeId): boolean { return biome === 'desert'; }

type Setter = (lx: number, y: number, lz: number, id: number) => void;

function oakTree(set: Setter, lx: number, y: number, lz: number, x: number, z: number, seed: number) {
  const h = 4 + Math.floor(hash2(x, z, seed + 11) * 3);
  const leaf = B.LEAVES, log = B.LOG;
  for (let i = 0; i < h; i++) set(lx, y + i, lz, log);
  for (let dy = h - 3; dy <= h; dy++) {
    const r = dy >= h - 1 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx === 0 && dz === 0 && dy < h) continue;
      if (Math.abs(dx) === r && Math.abs(dz) === r && hash3(x + dx, dy, z + dz, seed) > 0.5) continue;
      set(lx + dx, y + dy, lz + dz, leaf);
    }
  }
  set(lx, y + h + 1, lz, leaf);
}

function birchTree(set: Setter, lx: number, y: number, lz: number, x: number, z: number, seed: number) {
  const h = 5 + Math.floor(hash2(x, z, seed + 12) * 3);
  for (let i = 0; i < h; i++) set(lx, y + i, lz, B.BIRCH_LOG);
  for (let dy = h - 3; dy <= h; dy++) {
    const r = dy >= h - 1 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx === 0 && dz === 0 && dy < h) continue;
      if (Math.abs(dx) === r && Math.abs(dz) === r && hash3(x + dx, dy, z + dz, seed) > 0.4) continue;
      set(lx + dx, y + dy, lz + dz, B.BIRCH_LEAVES);
    }
  }
  set(lx, y + h + 1, lz, B.BIRCH_LEAVES);
}

function spruce(set: Setter, lx: number, y: number, lz: number, x: number, z: number, seed: number) {
  const h = 6 + Math.floor(hash2(x, z, seed + 13) * 4);
  for (let i = 0; i < h; i++) set(lx, y + i, lz, B.SPRUCE_LOG);
  let r = 1;
  for (let dy = h; dy >= 2; dy--) {
    const rr = ((h - dy) % 3 === 0) ? Math.min(3, r + 1) : r;
    for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > rr + 1) continue;
      if (dx === 0 && dz === 0 && dy < h) continue;
      set(lx + dx, y + dy - 1, lz + dz, B.SPRUCE_LEAVES);
    }
    if ((h - dy) % 3 === 0) r = Math.min(3, r + 1);
  }
  set(lx, y + h, lz, B.SPRUCE_LEAVES);
  set(lx, y + h + 1, lz, B.SPRUCE_LEAVES);
}

function cherryTree(set: Setter, lx: number, y: number, lz: number, x: number, z: number, seed: number) {
  const h = 4 + Math.floor(hash2(x, z, seed + 14) * 3);
  // trunk with a lean
  const lean = hash2(x, z, seed + 15) > 0.5 ? 1 : -1;
  for (let i = 0; i < h; i++) {
    set(lx + (i > h - 3 ? lean : 0), y + i, lz, B.CHERRY_LOG);
  }
  const tx = lx + lean, ty = y + h;
  // two wide flat pink canopies
  for (let dy = 0; dy <= 1; dy++) {
    const r = dy === 0 ? 3 : 2;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const d = Math.abs(dx) + Math.abs(dz);
      if (d > r + 1) continue;
      if (d >= r && hash3(x + dx, ty + dy, z + dz, seed + 16) > 0.4) continue;
      set(tx + dx, ty + dy, lz + dz, B.CHERRY_LEAVES);
    }
  }
  // hanging underside
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.abs(dx) + Math.abs(dz) <= 2 && hash3(x + dx, ty, z + dz, seed + 17) > 0.6) {
      set(tx + dx, ty - 1, lz + dz, B.CHERRY_LEAVES);
    }
  }
}
