// Chunk mesher — typed arrays, smooth per-vertex RGB light + AO, wind flags (pure, worker-safe)
import { B, blockDef, isOpaque } from './blocks';
import { CHUNK, WORLD_H } from './terrain';
import { LPAD, LIGHT_STRIDE } from './lighting';

export type GetBlock = (x: number, y: number, z: number) => number;

export interface MeshData {
  position: Float32Array; uv: Float32Array;
  light: Uint8Array; ao: Uint8Array; wind: Uint8Array;
  index: Uint32Array;
}
export interface WaterData { position: Float32Array; light: Uint8Array; index: Uint32Array; }
export interface ChunkMeshResult { opaque: MeshData | null; trans: MeshData | null; water: WaterData | null; }

interface Buf {
  pos: number[]; uv: number[]; light: number[]; ao: number[]; wind: number[]; idx: number[];
}
const newBuf = (): Buf => ({ pos: [], uv: [], light: [], ao: [], wind: [], idx: [] });

interface WBuf { pos: number[]; light: number[]; idx: number[]; }
const newWBuf = (): WBuf => ({ pos: [], light: [], idx: [] });

const FACES: { dir: [number, number, number]; corners: [number, number, number][]; kind: 'top' | 'bottom' | 'side'; shade: number }[] = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], kind: 'side', shade: 0.78 },
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], kind: 'side', shade: 0.78 },
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], kind: 'bottom', shade: 0.55 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], kind: 'top', shade: 1.0 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], kind: 'side', shade: 0.68 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], kind: 'side', shade: 0.68 },
];

export function meshChunk(
  get: GetBlock,
  light: Uint8Array,
  uvFor: (tileIdx: number) => [number, number, number, number],
  T: Record<string, number>,
): ChunkMeshResult {
  const op = newBuf(), tr = newBuf(), wa = newWBuf();
  const lidx = (x: number, y: number, z: number) => ((y * LPAD + z) * LPAD + x) * LIGHT_STRIDE;
  // local coords: x,z in -1..CHUNK ; light array offset +1
  const lightAt = (x: number, y: number, z: number, ch: number): number => {
    if (y < 0) return 0; if (y >= WORLD_H) return ch === 0 ? 15 : 0;
    return light[lidx(x + 1, y, z + 1) + ch];
  };
  const opaqueAt = (x: number, y: number, z: number): boolean => {
    if (y < 0) return true; if (y >= WORLD_H) return false;
    return isOpaque(get(x, y, z));
  };

  const pushFace = (
    buf: Buf, x: number, y: number, z: number,
    min: [number, number, number], max: [number, number, number],
    face: typeof FACES[number], tileName: string, def: ReturnType<typeof blockDef>,
    forceAll: boolean,
  ) => {
    const [dx, dy, dz] = face.dir;
    if (!forceAll) {
      const nid = get(x + dx, y + dy, z + dz);
      if (nid !== 0) {
        const nd = blockDef(nid);
        if (nd?.opaque) return;
        if (nid === B.WATER && def?.liquid && dy === 1) return;
      }
    }
    // internal face culling for sub-boxes
    if (forceAll) {
      if (dx === -1 && min[0] > 0) return; if (dx === 1 && max[0] < 1) return;
      if (dy === -1 && min[1] > 0) return; if (dy === 1 && max[1] < 1) return;
      if (dz === -1 && min[2] > 0) return; if (dz === 1 && max[2] < 1) return;
    }
    const [u0, v0, u1, v1] = uvFor(T[tileName]);
    const base = buf.pos.length / 3;

    // emissive?
    const emit = def?.light && def.lightColor ? def.light : 0;
    const er = emit ? def!.lightColor![0] * emit / 15 : 0;
    const eg = emit ? def!.lightColor![1] * emit / 15 : 0;
    const eb = emit ? def!.lightColor![2] * emit / 15 : 0;

    // face cell for light/AO
    const fx = x + dx, fy = y + dy, fz = z + dz;

    // per-vertex data
    const aos: number[] = [];
    for (let ci = 0; ci < 4; ci++) {
      const c = face.corners[ci];
      const pxx = x + min[0] + c[0] * (max[0] - min[0]);
      const pyy = y + min[1] + c[1] * (max[1] - min[1]);
      const pzz = z + min[2] + c[2] * (max[2] - min[2]);
      buf.pos.push(pxx, pyy, pzz);
      // uv from corner along face axes
      let tu: number, tv: number;
      if (face.kind === 'top') { tu = c[0]; tv = c[2]; }
      else if (face.kind === 'bottom') { tu = c[0]; tv = c[2]; }
      else if (dx !== 0) { tu = c[2]; tv = c[1]; }
      else { tu = c[0]; tv = c[1]; }
      buf.uv.push(u0 + (u1 - u0) * tu, v0 + (v1 - v0) * tv);

      // AO + smooth light (average of 4 cells around vertex on face plane)
      let s1 = 0, s2 = 0, corn = 0;
      let skySum = 0, rSum = 0, gSum = 0, bSum = 0, cnt = 0;
      const t1: [number, number, number] = face.kind === 'top' || face.kind === 'bottom'
        ? [1, 0, 0] : dx !== 0 ? [0, 1, 0] : [1, 0, 0];
      const t2: [number, number, number] = face.kind === 'top' || face.kind === 'bottom'
        ? [0, 0, 1] : dx !== 0 ? [0, 0, 1] : [0, 1, 0];
      const sign1 = (face.kind === 'side' && dx === 0 ? c[0] : face.kind === 'side' && dx !== 0 ? c[1] : c[0]) === 1 ? 1 : -1;
      const sign2 = (face.kind === 'side' && dx === 0 ? c[1] : c[2]) === 1 ? 1 : -1;
      for (let m = 0; m < 4; m++) {
        const ox = fx + (m === 1 || m === 3 ? t1[0] * sign1 : 0) + (m === 2 || m === 3 ? t2[0] * sign2 : 0);
        const oy = fy + (m === 1 || m === 3 ? t1[1] * sign1 : 0) + (m === 2 || m === 3 ? t2[1] * sign2 : 0);
        const oz = fz + (m === 1 || m === 3 ? t1[2] * sign1 : 0) + (m === 2 || m === 3 ? t2[2] * sign2 : 0);
        const occ = opaqueAt(ox, oy, oz);
        if (m === 1) s1 = occ ? 1 : 0;
        if (m === 2) s2 = occ ? 1 : 0;
        if (m === 3) corn = occ ? 1 : 0;
        if (!occ) {
          skySum += lightAt(ox, oy, oz, 0);
          rSum += lightAt(ox, oy, oz, 1);
          gSum += lightAt(ox, oy, oz, 2);
          bSum += lightAt(ox, oy, oz, 3);
          cnt++;
        }
      }
      if (cnt === 0) { skySum = lightAt(fx, fy, fz, 0) * 4; rSum = lightAt(fx, fy, fz, 1) * 4; gSum = lightAt(fx, fy, fz, 2) * 4; bSum = lightAt(fx, fy, fz, 3) * 4; cnt = 4; }
      const aoV = (s1 && s2) ? 0.42 : 1 - (s1 + s2 + corn) * 0.17;
      const aoB = Math.max(0, Math.min(255, Math.round(aoV * face.shade * 255)));
      aos.push(aoB);
      buf.ao.push(aoB);
      const sky = Math.round(skySum / cnt);
      const r = Math.min(255, Math.max(Math.round(rSum / cnt), Math.round(er * 255)));
      const g = Math.min(255, Math.max(Math.round(gSum / cnt), Math.round(eg * 255)));
      const b = Math.min(255, Math.max(Math.round(bSum / cnt), Math.round(eb * 255)));
      buf.light.push(sky, r, g, b);
      const windFlag = def && (def.cross || tileName.includes('leaves')) ? 1 : 0;
      buf.wind.push(windFlag);
    }
    // flip quad diagonal to fix AO anisotropy
    if (aos[0] + aos[3] > aos[1] + aos[2]) {
      buf.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
    } else {
      buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  };

  const addCross = (x: number, y: number, z: number, id: number) => {
    const def = blockDef(id)!;
    const [u0, v0, u1, v1] = uvFor(T[def.side]);
    const sky = lightAt(x, y, z, 0), r = lightAt(x, y, z, 1), g = lightAt(x, y, z, 2), b2 = lightAt(x, y, z, 3);
    const off = 0.15, ext = 0.85;
    for (const rot of [0, 1]) {
      const base = op.pos.length / 3;
      const pts: [number, number, number][] = rot === 0
        ? [[off, 0, off], [ext, 0, ext], [off, 1, off], [ext, 1, ext]]
        : [[off, 0, ext], [ext, 0, off], [off, 1, ext], [ext, 1, off]];
      const uvs: [number, number][] = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
      for (let ci = 0; ci < 4; ci++) {
        op.pos.push(x + pts[ci][0], y + pts[ci][1], z + pts[ci][2]);
        op.uv.push(uvs[ci][0], uvs[ci][1]);
        op.light.push(sky, r, g, b2);
        op.ao.push(255);
        op.wind.push(1);
      }
      op.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      op.idx.push(base + 2, base + 1, base, base + 3, base + 1, base + 2);
    }
  };

  const addLadder = (x: number, y: number, z: number, dir: string) => {
    const [u0, v0, u1, v1] = uvFor(T['ladder']);
    const sky = lightAt(x, y, z, 0), r = lightAt(x, y, z, 1), g = lightAt(x, y, z, 2), b2 = lightAt(x, y, z, 3);
    let pts: [number, number, number][];
    if (dir === 'ladder_N') pts = [[0, 0, 0.06], [1, 0, 0.06], [0, 1, 0.06], [1, 1, 0.06]];
    else if (dir === 'ladder_S') pts = [[0, 0, 0.94], [1, 0, 0.94], [0, 1, 0.94], [1, 1, 0.94]];
    else if (dir === 'ladder_E') pts = [[0.94, 0, 0], [0.94, 0, 1], [0.94, 1, 0], [0.94, 1, 1]];
    else pts = [[0.06, 0, 0], [0.06, 0, 1], [0.06, 1, 0], [0.06, 1, 1]];
    let uvs: [number, number][];
    if (dir.endsWith('_N') || dir.endsWith('_S')) uvs = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
    else uvs = [[u1, v0], [u1, v1], [u0, v0], [u0, v1]];
    const base = tr.pos.length / 3;
    for (let ci = 0; ci < 4; ci++) {
      tr.pos.push(x + pts[ci][0], y + pts[ci][1], z + pts[ci][2]);
      tr.uv.push(uvs[ci][0], uvs[ci][1]);
      tr.light.push(sky, r, g, b2); tr.ao.push(255); tr.wind.push(0);
    }
    tr.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };

  const isConnectable = (nid: number): boolean => nid === B.FENCE || (blockDef(nid)?.solid ?? false);

  const shapes = (lx: number, y: number, lz: number, def: ReturnType<typeof blockDef>): { min: [number, number, number]; max: [number, number, number] }[] => {
    const box = (a: number[], b: number[]): { min: [number, number, number]; max: [number, number, number] } => ({ min: [a[0], a[1], a[2]] as [number, number, number], max: [b[0], b[1], b[2]] as [number, number, number] });
    const sh = def?.shape;
    if (!sh) return [box([0,0,0],[1,1,1])];
    if (sh === 'stairs_N') return [box([0,0,0],[1,0.5,1]), box([0,0.5,0],[1,1,0.5])];
    if (sh === 'stairs_S') return [box([0,0,0],[1,0.5,1]), box([0,0.5,0.5],[1,1,1])];
    if (sh === 'stairs_E') return [box([0,0,0],[1,0.5,1]), box([0.5,0.5,0],[1,1,1])];
    if (sh === 'stairs_W') return [box([0,0,0],[1,0.5,1]), box([0,0.5,0],[0.5,1,1])];
    if (sh === 'fence') {
      const boxes = [box([6 / 16, 0, 6 / 16], [10 / 16, 1, 10 / 16])];
      if (isConnectable(get(lx + 1, y, lz))) boxes.push(box([10 / 16, 0, 7 / 16], [1, 1, 9 / 16]));
      if (isConnectable(get(lx - 1, y, lz))) boxes.push(box([0, 0, 7 / 16], [6 / 16, 1, 9 / 16]));
      if (isConnectable(get(lx, y, lz + 1))) boxes.push(box([7 / 16, 0, 10 / 16], [9 / 16, 1, 1]));
      if (isConnectable(get(lx, y, lz - 1))) boxes.push(box([7 / 16, 0, 0], [9 / 16, 1, 6 / 16]));
      return boxes;
    }
    const doorGeom = (f: string) => f === 'N' ? [box([0, 0, 0], [1, 1, 3 / 16])]
      : f === 'S' ? [box([0, 0, 13 / 16], [1, 1, 1])]
        : f === 'E' ? [box([13 / 16, 0, 0], [1, 1, 1])]
          : [box([0, 0, 0], [3 / 16, 1, 1])];
    if (sh === 'door_N' || sh === 'door_open_N') return doorGeom('N');
    if (sh === 'door_S' || sh === 'door_open_S') return doorGeom('S');
    if (sh === 'door_E' || sh === 'door_open_E') return doorGeom('E');
    if (sh === 'door_W' || sh === 'door_open_W') return doorGeom('W');
    if (sh === 'door_U') {
      const b = get(lx, y - 1, lz);
      const f = b === B.DOOR_L_N ? 'N' : b === B.DOOR_L_E ? 'E' : b === B.DOOR_L_S ? 'S' : b === B.DOOR_L_W ? 'W' : 'N';
      return doorGeom(f);
    }
    if (sh === 'door_open_U') {
      const b = get(lx, y - 1, lz);
      const f = b === B.DOOR_OPEN_L_N ? 'N' : b === B.DOOR_OPEN_L_E ? 'E' : b === B.DOOR_OPEN_L_S ? 'S' : b === B.DOOR_OPEN_L_W ? 'W' : 'N';
      return doorGeom(f);
    }
    if (sh === 'trapdoor') return [box([0,0,0],[1,3/16,1])];
    if (sh === 'trapdoor_open') return [box([0,0,0],[1,1,3/16])];
    if (sh === 'chest') return [box([1/16,0,1/16],[15/16,14/16,15/16])];
    return [box([0,0,0],[1,1,1])];
  };

  for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
    for (let y = 0; y < WORLD_H; y++) {
      const id = get(lx, y, lz);
      if (id === 0) continue;
      const def = blockDef(id);
      if (!def) continue;
      if (def.cross) { addCross(lx, y, lz, id); continue; }
      if (def.shape === 'crop') { addCross(lx, y, lz, id); continue; }
      if (def.shape?.startsWith('ladder')) { addLadder(lx, y, lz, def.shape); continue; }
      if (def.liquid) {
        // water buffer (lava handled as emissive opaque below)
        if (id === B.WATER) {
          const above = get(lx, y + 1, lz);
          const topH = above === B.WATER ? 1 : 14 / 16;
          const sky = lightAt(lx, y + 1, lz, 0), r = lightAt(lx, y + 1, lz, 1), g = lightAt(lx, y + 1, lz, 2), b2 = lightAt(lx, y + 1, lz, 3);
          // top face
          if (above !== B.WATER) {
            const base = wa.pos.length / 3;
            wa.pos.push(lx, y + topH, lz + 1, lx + 1, y + topH, lz + 1, lx, y + topH, lz, lx + 1, y + topH, lz);
            for (let ci = 0; ci < 4; ci++) wa.light.push(sky, r, g, b2);
            wa.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
          // side faces against non-water non-opaque
          for (const face of FACES) {
            if (face.kind === 'top') continue;
            const [dx, , dz] = face.dir;
            const nid = get(lx + dx, y, lz + dz);
            if (nid === B.WATER || isOpaque(nid)) continue;
            const base = wa.pos.length / 3;
            const ys = y, ye = y + topH;
            const c = face.corners;
            for (let ci = 0; ci < 4; ci++) {
              wa.pos.push(lx + c[ci][0], c[ci][1] ? ye : ys, lz + c[ci][2]);
              wa.light.push(sky, r, g, b2);
            }
            wa.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
          continue;
        }
        // lava: emissive opaque-ish cube with lowered top
        const emit = def.light ?? 0;
        const er = def.lightColor![0] * emit / 15, eg = def.lightColor![1] * emit / 15, eb = def.lightColor![2] * emit / 15;
        const above = get(lx, y + 1, lz);
        const max: [number, number, number] = above === B.LAVA ? [1, 1, 1] : [1, 14 / 16, 1];
        for (const face of FACES) {
          const nid = get(lx + face.dir[0], y + face.dir[1], lz + face.dir[2]);
          if (nid === B.LAVA || isOpaque(nid)) continue;
          if (face.kind === 'top' && above === B.LAVA) continue;
          const [u0, v0, u1, v1] = uvFor(T[def.side]);
          const base = op.pos.length / 3;
          for (let ci = 0; ci < 4; ci++) {
            const c = face.corners[ci];
            op.pos.push(lx + c[0] * max[0], y + c[1] * max[1], lz + c[2] * max[2]);
            let tu: number, tv: number;
            if (face.kind !== 'side') { tu = c[0]; tv = c[2]; }
            else if (face.dir[0] !== 0) { tu = c[2]; tv = c[1] * max[1]; }
            else { tu = c[0]; tv = c[1] * max[1]; }
            op.uv.push(u0 + (u1 - u0) * tu, v0 + (v1 - v0) * tv);
            op.light.push(0, Math.round(er * 255), Math.round(eg * 255), Math.round(eb * 255));
            op.ao.push(Math.round(face.shade * 255));
            op.wind.push(0);
          }
          op.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
        continue;
      }
      if (def.torchLike) {
        const min: [number, number, number] = id === B.LANTERN ? [4 / 16, 0, 4 / 16] : id === B.AMETHYST ? [3 / 16, 0, 3 / 16] : [6 / 16, 0, 6 / 16];
        const max: [number, number, number] = id === B.LANTERN ? [12 / 16, 12 / 16, 12 / 16] : id === B.AMETHYST ? [13 / 16, 12 / 16, 13 / 16] : [10 / 16, 10 / 16, 10 / 16];
        for (const face of FACES) {
          pushFace(op, lx, y, lz, min, max, face, face.kind === 'top' ? def.top : def.side, def, true);
        }
        continue;
      }
      let min: [number, number, number] = [0, 0, 0], max: [number, number, number] = [1, 1, 1];
      if (def.slab === 'bottom') max = [1, 0.5, 1];
      else if (def.slab === 'x0') max = [0.5, 1, 1];
      else if (def.slab === 'x1') min = [0.5, 0, 0];
      else if (def.slab === 'z0') max = [1, 1, 0.5];
      else if (def.slab === 'z1') min = [0, 0, 0.5];
      const buf = def.transparent ? tr : op;
      if (def.slab) {
        for (const face of FACES) {
          let tileName = def.side;
          if (face.kind === 'top') tileName = def.top;
          else if (face.kind === 'bottom') tileName = def.bottom ?? def.side;
          else if (face.dir[2] === -1) tileName = def.front ?? def.side;
          else if (face.dir[2] === 1) tileName = def.xm ?? def.side;
          pushFace(buf, lx, y, lz, min, max, face, tileName, def, false);
        }
      } else {
        const boxes = shapes(lx, y, lz, def);
        for (const box of boxes) {
          const sub = box.min.some((v) => v > 0) || box.max.some((v) => v < 1);
          for (const face of FACES) {
            let tileName = def.side;
            if (face.kind === 'top') tileName = def.top;
            else if (face.kind === 'bottom') tileName = def.bottom ?? def.side;
            else if (face.dir[2] === -1) tileName = def.front ?? def.side;
            else if (face.dir[2] === 1) tileName = def.xm ?? def.side;
            pushFace(buf, lx, y, lz, box.min, box.max, face, tileName, def, sub);
          }
        }
      }
    }
  }

  const toMesh = (b: Buf): MeshData | null => {
    if (b.pos.length === 0) return null;
    return {
      position: new Float32Array(b.pos),
      uv: new Float32Array(b.uv),
      light: new Uint8Array(b.light),
      ao: new Uint8Array(b.ao),
      wind: new Uint8Array(b.wind),
      index: new Uint32Array(b.idx),
    };
  };

  let water: WaterData | null = null;
  if (wa.pos.length > 0) {
    water = { position: new Float32Array(wa.pos), light: new Uint8Array(wa.light), index: new Uint32Array(wa.idx) };
  }
  return { opaque: toMesh(op), trans: toMesh(tr), water };
}
