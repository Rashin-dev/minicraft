// Colored voxel lighting — sky channel + RGB block channels, flood-fill BFS (pure, worker-safe)
import { blockDef, isOpaque } from './blocks';
import { B } from './blocks';
import { CHUNK, WORLD_H } from './terrain';

export const LPAD = CHUNK + 2; // padded region per axis (xz)
export const LIGHT_STRIDE = 4; // sky, r, g, b

export type GetBlock = (x: number, y: number, z: number) => number;

// returns Uint8Array(LPAD*LPAD*WORLD_H*4), local coords 0..LPAD-1 map to world cx*CHUNK-1..
export function computeLight(get: GetBlock): Uint8Array {
  const N = LPAD * LPAD * WORLD_H;
  const light = new Uint8Array(N * LIGHT_STRIDE);
  const idx = (x: number, y: number, z: number) => (y * LPAD + z) * LPAD + x;

  // --- sky light: straight down, then BFS ---
  const queue: number[] = [];
  for (let z = 0; z < LPAD; z++) for (let x = 0; x < LPAD; x++) {
    let lv = 15;
    for (let y = WORLD_H - 1; y >= 0; y--) {
      const id = get(x - 1, y, z - 1);
      if (id !== 0 && isOpaque(id)) { lv = 0; }
      else if (id === B.WATER) { lv = Math.max(0, lv - 2); }
      if (lv <= 0) { continue; }
      const i = idx(x, y, z) * LIGHT_STRIDE;
      light[i] = lv;
      if (lv > 1) queue.push(x, y, z);
    }
  }
  bfs(light, queue, get, idx, true);

  // --- block light RGB: seed emitters, single BFS carrying rgb ---
  const q2: number[] = [];
  for (let z = 0; z < LPAD; z++) for (let x = 0; x < LPAD; x++) for (let y = 0; y < WORLD_H; y++) {
    const d = blockDef(get(x - 1, y, z - 1));
    if (d?.light && d.lightColor) {
      const i = idx(x, y, z) * LIGHT_STRIDE;
      const v = d.light;
      light[i + 1] = Math.max(light[i + 1], Math.round(v * d.lightColor[0]));
      light[i + 2] = Math.max(light[i + 2], Math.round(v * d.lightColor[1]));
      light[i + 3] = Math.max(light[i + 3], Math.round(v * d.lightColor[2]));
      q2.push(x, y, z);
    }
  }
  bfsRGB(light, q2, get, idx);

  return light;
}

function opaqueAt(get: GetBlock, x: number, y: number, z: number): boolean {
  const id = get(x - 1, y, z - 1);
  return id !== 0 && isOpaque(id);
}

function liquidAt(get: GetBlock, x: number, y: number, z: number): boolean {
  const id = get(x - 1, y, z - 1);
  return id === B.WATER;
}

function bfs(light: Uint8Array, queue: number[], get: GetBlock, idx: (x: number, y: number, z: number) => number, isSky: boolean) {
  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++], z = queue[qi++];
    const v = light[idx(x, y, z) * LIGHT_STRIDE];
    if (v <= 1) continue;
    for (let n = 0; n < 6; n++) {
      const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0);
      const ny = y + (n === 2 ? 1 : n === 3 ? -1 : 0);
      const nz = z + (n === 4 ? 1 : n === 5 ? -1 : 0);
      if (nx < 0 || nx >= LPAD || nz < 0 || nz >= LPAD || ny < 0 || ny >= WORLD_H) continue;
      if (opaqueAt(get, nx, ny, nz)) continue;
      let nv: number;
      if (isSky && n === 3 && v === 15 && !liquidAt(get, nx, ny, nz)) nv = 15; // sun goes straight down
      else nv = v - (liquidAt(get, nx, ny, nz) ? 2 : 1);
      if (nv <= 0) continue;
      const ni = idx(nx, ny, nz) * LIGHT_STRIDE;
      if (light[ni] >= nv) continue;
      light[ni] = nv;
      queue.push(nx, ny, nz);
    }
  }
}

function bfsRGB(light: Uint8Array, queue: number[], get: GetBlock, idx: (x: number, y: number, z: number) => number) {
  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++], z = queue[qi++];
    const base = idx(x, y, z) * LIGHT_STRIDE;
    const r = light[base + 1], g = light[base + 2], b = light[base + 3];
    if (r <= 1 && g <= 1 && b <= 1) continue;
    for (let n = 0; n < 6; n++) {
      const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0);
      const ny = y + (n === 2 ? 1 : n === 3 ? -1 : 0);
      const nz = z + (n === 4 ? 1 : n === 5 ? -1 : 0);
      if (nx < 0 || nx >= LPAD || nz < 0 || nz >= LPAD || ny < 0 || ny >= WORLD_H) continue;
      if (opaqueAt(get, nx, ny, nz)) continue;
      const dec = liquidAt(get, nx, ny, nz) ? 2 : 1;
      const nr = Math.max(0, r - dec), ng = Math.max(0, g - dec), nb = Math.max(0, b - dec);
      if (nr <= 0 && ng <= 0 && nb <= 0) continue;
      const ni = idx(nx, ny, nz) * LIGHT_STRIDE;
      let changed = false;
      if (light[ni + 1] < nr) { light[ni + 1] = nr; changed = true; }
      if (light[ni + 2] < ng) { light[ni + 2] = ng; changed = true; }
      if (light[ni + 3] < nb) { light[ni + 3] = nb; changed = true; }
      if (changed) queue.push(nx, ny, nz);
    }
  }
}
