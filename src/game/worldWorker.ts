// World worker: terrain generation + lighting + meshing off the main thread
import { B } from './blocks';
import { CHUNK, WORLD_H, generateChunk } from './terrain';
import { computeLight, LPAD } from './lighting';
import { meshChunk } from './mesher';
import { TILES, ATLAS_COLS, ATLAS_ROWS, TILE_SIZE } from './atlas';

export interface WorkerInit { type: 'init'; seed: number; diffs: [string, number][]; }
export interface WorkerMeshReq { type: 'mesh'; cx: number; cz: number; }
export interface WorkerEditsReq { type: 'edits'; edits: [number, number, number, number][]; }

const chunks = new Map<string, Uint8Array>();
let seed = 0;
const diffs = new Map<string, number>();

function key(cx: number, cz: number) { return cx + ',' + cz; }

function getChunk(cx: number, cz: number): Uint8Array {
  const k = key(cx, cz);
  let c = chunks.get(k);
  if (!c) { c = generateChunk(seed, cx, cz); chunks.set(k, c); }
  return c;
}

function getBlock(x: number, y: number, z: number): number {
  if (y < 0) return B.BEDROCK;
  if (y >= WORLD_H) return 0;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const c = chunks.get(key(cx, cz));
  if (!c) return 0;
  return c[(y * CHUNK + (z - cz * CHUNK)) * CHUNK + (x - cx * CHUNK)];
}

function setBlock(x: number, y: number, z: number, id: number) {
  if (y < 0 || y >= WORLD_H) return;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const c = getChunk(cx, cz);
  c[(y * CHUNK + (z - cz * CHUNK)) * CHUNK + (x - cx * CHUNK)] = id;
}

const uvFor = (tileIdx: number): [number, number, number, number] => {
  const col = tileIdx % ATLAS_COLS, row = Math.floor(tileIdx / ATLAS_COLS);
  const w = ATLAS_COLS * TILE_SIZE, h = ATLAS_ROWS * TILE_SIZE;
  const e = 0.02;
  return [
    (col * TILE_SIZE + e) / w,
    1 - ((row + 1) * TILE_SIZE - e) / h,
    ((col + 1) * TILE_SIZE - e) / w,
    1 - (row * TILE_SIZE + e) / h,
  ];
};

function meshAndPost(cx: number, cz: number) {
  // ensure 3x3 neighborhood generated for correct light + culling
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) getChunk(cx + dx, cz + dz);
  const light = computeLight((wx: number, wy: number, wz: number) => getBlock(cx * CHUNK + wx, wy, wz));
  const get = (x: number, y: number, z: number): number => getBlock(cx * CHUNK + x, y, cz * CHUNK + z);
  const result = meshChunk(get, light, uvFor, TILES);
  const blocks = getChunk(cx, cz).slice();
  const transfer: ArrayBuffer[] = [blocks.buffer as ArrayBuffer];
  const pack = (m: ReturnType<typeof meshChunk>['opaque']) => {
    if (!m) return null;
    transfer.push(m.position.buffer as ArrayBuffer, m.uv.buffer as ArrayBuffer, m.light.buffer as ArrayBuffer, m.ao.buffer as ArrayBuffer, m.wind.buffer as ArrayBuffer, m.index.buffer as ArrayBuffer);
    return m;
  };
  const opaque = pack(result.opaque);
  const trans = pack(result.trans);
  let water = null as ReturnType<typeof meshChunk>['water'];
  if (result.water) {
    transfer.push(result.water.position.buffer as ArrayBuffer, result.water.light.buffer as ArrayBuffer, result.water.index.buffer as ArrayBuffer);
    water = result.water;
  }
  const msg = { type: 'chunk', cx, cz, blocks, opaque, trans, water, pad: LPAD };
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.onmessage = (e: MessageEvent<WorkerInit | WorkerMeshReq | WorkerEditsReq>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    seed = msg.seed;
    diffs.clear();
    for (const [k, v] of msg.diffs) diffs.set(k, v);
  } else if (msg.type === 'mesh') {
    meshAndPost(msg.cx, msg.cz);
  } else if (msg.type === 'edits') {
    const remesh = new Set<string>();
    for (const [x, y, z, id] of msg.edits) {
      setBlock(x, y, z, id);
      diffs.set(x + ',' + y + ',' + z, id);
      const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
      remesh.add(key(cx, cz));
      const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
      if (lx === 0) remesh.add(key(cx - 1, cz));
      if (lx === CHUNK - 1) remesh.add(key(cx + 1, cz));
      if (lz === 0) remesh.add(key(cx, cz - 1));
      if (lz === CHUNK - 1) remesh.add(key(cx, cz + 1));
    }
    for (const k of remesh) {
      const [cx, cz] = k.split(',').map(Number);
      if (chunks.has(k)) meshAndPost(cx, cz);
    }
  }
};
