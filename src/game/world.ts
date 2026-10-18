// Main-thread World: block storage fed by the worker, edits, raycasts, physics queries
import { B, blockDef, isSolid } from './blocks';
import { CHUNK, WORLD_H, SEA, heightAt, biomeAt, generateChunk, generateNetherChunk } from './terrain';

export { CHUNK, WORLD_H, SEA };
export type { BiomeId } from './terrain';

export class World {
  seed: number;
  dim: 'overworld' | 'nether';
  chunks = new Map<string, Uint8Array>();
  diffs = new Map<string, number>();
  dirtyChunks = new Set<string>();
  private heightCache = new Map<string, number>();

  constructor(seed: number, dim: 'overworld' | 'nether' = 'overworld') { this.seed = seed; this.dim = dim; }

  static key(cx: number, cz: number) { return cx + ',' + cz; }

  // worker delivers generated chunk data
  ingest(cx: number, cz: number, blocks: Uint8Array) {
    this.chunks.set(World.key(cx, cz), blocks);
    // apply recorded edits (in case edit raced ahead of generation)
    const baseX = cx * CHUNK, baseZ = cz * CHUNK;
    for (const [k, v] of this.diffs) {
      const [x, y, z] = k.split(',').map(Number);
      if (x >= baseX && x < baseX + CHUNK && z >= baseZ && z < baseZ + CHUNK) {
        blocks[(y * CHUNK + (z - baseZ)) * CHUNK + (x - baseX)] = v;
      }
    }
  }

  hasChunk(cx: number, cz: number): boolean { return this.chunks.has(World.key(cx, cz)); }

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
    const c = this.getOrGen(cx, cz);
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

  private getOrGen(cx: number, cz: number): Uint8Array {
    const k = World.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) { c = this.dim === 'nether' ? generateNetherChunk(this.seed, cx, cz) : generateChunk(this.seed, cx, cz); this.chunks.set(k, c); }
    return c;
  }

  // synchronous fallback height (pure noise, cheap) — used before worker data arrives
  surfaceYAt(x: number, z: number): number {
    const k = Math.floor(x) + ',' + Math.floor(z);
    const cached = this.heightCache.get(k);
    if (cached !== undefined) return cached;
    if (this.hasChunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK))) {
      for (let y = WORLD_H - 1; y >= 0; y--) {
        const id = this.getBlock(Math.floor(x), y, Math.floor(z));
        if (id !== 0 && !blockDef(id)?.cross && !blockDef(id)?.torchLike) {
          this.heightCache.set(k, y);
          return y;
        }
      }
      return 0;
    }
    if (this.dim === 'nether') return 20;
    return heightAt(Math.floor(x), Math.floor(z), this.seed);
  }

  biomeAt2(x: number, z: number) {
    return biomeAt(Math.floor(x), Math.floor(z), this.seed, this.surfaceYAt(x, z));
  }

  groundYBelow(x: number, z: number, from = WORLD_H - 4): number {
    for (let y = from; y >= 1; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== 0 && id !== B.WATER && id !== B.LAVA && !blockDef(id)?.cross && !blockDef(id)?.torchLike) return y;
    }
    return 4;
  }

  isSolidAt(x: number, y: number, z: number): boolean { return isSolid(this.getBlock(x, y, z)); }
}
