// AABB vs voxel collision
import { World, WORLD_H } from './world';
import { BLOCKS, isSolid } from './blocks';

export interface AABB { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number; }

// Collision boxes for slab variants; default full cube
function blockBoxes(id: number, x: number, y: number, z: number): AABB[] {
  const def = BLOCKS[id];
  if (!def || !def.solid) return [];
  switch (def.slab) {
    case 'bottom': return [{ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 0.5, maxZ: z + 1 }];
    case 'x0': return [{ minX: x, minY: y, minZ: z, maxX: x + 0.5, maxY: y + 1, maxZ: z + 1 }];
    case 'x1': return [{ minX: x + 0.5, minY: y, minZ: z, maxX: x + 1, maxY: y + 1, maxZ: z + 1 }];
    case 'z0': return [{ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 1, maxZ: z + 0.5 }];
    case 'z1': return [{ minX: x, minY: y, minZ: z + 0.5, maxX: x + 1, maxY: y + 1, maxZ: z + 1 }];
    default: return [{ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 1, maxZ: z + 1 }];
  }
}

export function collide(
  world: World, box: AABB, dx: number, dy: number, dz: number
): { dx: number; dy: number; dz: number; onGround: boolean; hitHead: boolean } {
  let onGround = false, hitHead = false;

  const moveAxis = (axis: 'x' | 'y' | 'z', delta: number): number => {
    if (delta === 0) return 0;
    let d = delta;
    const minX = Math.floor(Math.min(box.minX, box.minX + (axis === 'x' ? d : 0)));
    const maxX = Math.floor(Math.max(box.maxX, box.maxX + (axis === 'x' ? d : 0)) - 1e-7);
    const minY = Math.floor(Math.min(box.minY, box.minY + (axis === 'y' ? d : 0)));
    const maxY = Math.floor(Math.max(box.maxY, box.maxY + (axis === 'y' ? d : 0)) - 1e-7);
    const minZ = Math.floor(Math.min(box.minZ, box.minZ + (axis === 'z' ? d : 0)));
    const maxZ = Math.floor(Math.max(box.maxZ, box.maxZ + (axis === 'z' ? d : 0)) - 1e-7);
    for (let y = Math.max(0, minY); y <= Math.min(WORLD_H - 1, maxY); y++)
      for (let z = minZ; z <= maxZ; z++)
        for (let x = minX; x <= maxX; x++) {
          const id = world.getBlock(x, y, z);
          if (!isSolid(id)) continue;
          for (const bb of blockBoxes(id, x, y, z)) {
            const nMinX = axis === 'x' ? box.minX + d : box.minX;
            const nMaxX = axis === 'x' ? box.maxX + d : box.maxX;
            const nMinY = axis === 'y' ? box.minY + d : box.minY;
            const nMaxY = axis === 'y' ? box.maxY + d : box.maxY;
            const nMinZ = axis === 'z' ? box.minZ + d : box.minZ;
            const nMaxZ = axis === 'z' ? box.maxZ + d : box.maxZ;
            if (nMaxX > bb.minX && nMinX < bb.maxX && nMaxY > bb.minY && nMinY < bb.maxY && nMaxZ > bb.minZ && nMinZ < bb.maxZ) {
              if (axis === 'x') d = d > 0 ? Math.min(d, bb.minX - box.maxX - 1e-4) : Math.max(d, bb.maxX - box.minX + 1e-4);
              else if (axis === 'y') {
                if (d > 0) { d = Math.min(d, bb.minY - box.maxY - 1e-4); hitHead = true; }
                else { d = Math.max(d, bb.maxY - box.minY + 1e-4); onGround = true; }
              }
              else d = d > 0 ? Math.min(d, bb.minZ - box.maxZ - 1e-4) : Math.max(d, bb.maxZ - box.minZ + 1e-4);
            }
          }
        }
    if (axis === 'x') { box.minX += d; box.maxX += d; }
    else if (axis === 'y') { box.minY += d; box.maxY += d; }
    else { box.minZ += d; box.maxZ += d; }
    return d;
  };

  const rx = moveAxis('x', dx);
  const rz = moveAxis('z', dz);
  const ry = moveAxis('y', dy);
  return { dx: rx, dy: ry, dz: rz, onGround, hitHead };
}

export function isInLiquid(world: World, box: AABB): boolean {
  const y0 = Math.floor(box.minY), y1 = Math.floor(box.minY + (box.maxY - box.minY) * 0.6);
  for (let y = y0; y <= y1; y++)
    for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ - 1e-7); z++)
      for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX - 1e-7); x++) {
        if (BLOCKS[world.getBlock(x, y, z)]?.liquid) return true;
      }
  return false;
}

export function headInLiquid(world: World, x: number, y: number, z: number): boolean {
  return !!BLOCKS[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))]?.liquid;
}
