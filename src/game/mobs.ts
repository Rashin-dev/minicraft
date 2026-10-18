// Mobs: passive animals + hostile monsters (zombie, skeleton, creeper)
import * as THREE from 'three';
import type { World } from './world';
import { collide } from './physics';
import { B, IT } from './blocks';
import { sounds } from './sounds';
import { isOpaque } from './blocks';

export type MobKind = 'pig' | 'sheep' | 'cow' | 'chicken' | 'zombie' | 'skeleton' | 'creeper' | 'villager' | 'spider' | 'enderman';
export const HOSTILE: MobKind[] = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman'];

export interface MobCallbacks {
  damagePlayer: (amount: number, sourcePos: THREE.Vector3) => void;
  shootArrow: (from: THREE.Vector3, dir: THREE.Vector3) => void;
  onDeath: (kind: MobKind, pos: THREE.Vector3) => void;
  burst: (pos: THREE.Vector3, color: number, count: number) => void;
  explode: (pos: THREE.Vector3, radius: number) => void;
  dayFactor: () => number;
}

const STYLE: Record<MobKind, { body: number; head: number; leg: number; scale: number; hp: number; sound: () => void }> = {
  pig: { body: 0xefa3ab, head: 0xf2b4ba, leg: 0xd98f97, scale: 1, hp: 6, sound: sounds.pig },
  sheep: { body: 0xe8e8e8, head: 0xd8c8b8, leg: 0xb8a898, scale: 1.05, hp: 6, sound: sounds.sheep },
  cow: { body: 0x6b4a35, head: 0x8a6a50, leg: 0x4e3626, scale: 1.15, hp: 8, sound: sounds.cow },
  chicken: { body: 0xf5f5f0, head: 0xf5f5f0, leg: 0xe8a030, scale: 0.6, hp: 3, sound: sounds.chicken },
  zombie: { body: 0x3e8948, head: 0x4a9a54, leg: 0x2d5a8a, scale: 0.95, hp: 12, sound: sounds.zombie },
  skeleton: { body: 0xc8c8c8, head: 0xdedede, leg: 0xbcbcbc, scale: 0.95, hp: 10, sound: sounds.skeleton },
  creeper: { body: 0x4fae4f, head: 0x55b957, leg: 0x3d8c3d, scale: 1.0, hp: 10, sound: () => {} },
  villager: { body: 0x6b4a8a, head: 0xd8b89a, leg: 0x3a2a4a, scale: 1.0, hp: 14, sound: () => {} },
  spider: { body: 0x3a3230, head: 0x4a403c, leg: 0x2a2422, scale: 1.0, hp: 10, sound: () => {} },
  enderman: { body: 0x14141a, head: 0x1a1a22, leg: 0x0c0c10, scale: 1.15, hp: 20, sound: () => {} },
};

export class Mob {
  kind: MobKind;
  group = new THREE.Group();
  vel = new THREE.Vector3();
  yaw = 0;
  onGround = false;
  hp: number;
  dead = false;
  hostile: boolean;
  private wanderTimer = 0;
  private targetYaw = 0;
  private moving = false;
  private soundTimer = 4 + Math.random() * 14;
  private legPhase = 0;
  private legs: THREE.Mesh[] = [];
  private mats: THREE.MeshLambertMaterial[] = [];
  private attackCd = 0;
  private shootCd = 2;
  private fuse = -1; // creeper
  private burnTimer = 0;
  private flashTimer = 0;
  baby = false;
  loveTimer = 0;
  private growTimer = 0;
  trades: { inId: number; inCount: number; outId: number; outCount: number; done: number }[] = [];
  tamed = false;

  constructor(kind: MobKind, x: number, y: number, z: number, baby = false) {
    this.kind = kind;
    this.hostile = HOSTILE.includes(kind);
    this.baby = baby;
    const s = STYLE[kind];
    this.hp = s.hp * (baby ? 0.5 : 1);
    if (baby) this.growTimer = 45;
    const mat = (c: number) => { const m = new THREE.MeshLambertMaterial({ color: c }); this.mats.push(m); return m; };
    const box = (w: number, h: number, d: number, m: THREE.Material, ox: number, oy: number, oz: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * s.scale, h * s.scale, d * s.scale), m);
      mesh.position.set(ox * s.scale, oy * s.scale, oz * s.scale);
      return mesh;
    };
    if (kind === 'zombie' || kind === 'skeleton') {
      const thin = kind === 'skeleton' ? 0.6 : 1;
      this.group.add(box(0.5, 0.72, 0.28, mat(s.body), 0, 1.06, 0)); // torso
      this.group.add(box(0.46, 0.46, 0.46, mat(s.head), 0, 1.66, 0)); // head
      // eyes
      const eye = mat(kind === 'zombie' ? 0x1a1a2e : 0x101014);
      this.group.add(box(0.09, 0.09, 0.02, eye, -0.11, 1.7, -0.235));
      this.group.add(box(0.09, 0.09, 0.02, eye, 0.11, 1.7, -0.235));
      // arms
      this.group.add(box(0.2 * thin, 0.66, 0.2 * thin, mat(s.body), -0.36, 1.12, -0.12));
      this.group.add(box(0.2 * thin, 0.66, 0.2 * thin, mat(s.body), 0.36, 1.12, -0.12));
      for (const [lx, lz] of [[-0.13, 0], [0.13, 0]] as const) {
        const leg = box(0.2 * thin, 0.72, 0.2 * thin, mat(s.leg), lx, 0.36, lz);
        this.legs.push(leg); this.group.add(leg);
      }
    } else if (kind === 'villager') {
      this.group.add(box(0.5, 0.66, 0.32, mat(s.body), 0, 0.83, 0)); // robe
      this.group.add(box(0.46, 0.46, 0.42, mat(s.head), 0, 1.32, 0)); // head
      this.group.add(box(0.1, 0.14, 0.1, mat(0xb98e6a), 0, 1.3, -0.22)); // nose
      for (const [lx, lz] of [[-0.12, 0], [0.12, 0]] as const) {
        const leg = box(0.18, 0.5, 0.18, mat(s.leg), lx, 0.25, lz);
        this.legs.push(leg); this.group.add(leg);
      }
      // villager trades (emerald <-> goods)
      const r = (n: number) => Math.floor(Math.abs(Math.sin((x * 12.9898 + z * 78.233 + kind.length) * 43758.5453)) * n);
      this.trades = [
        { inId: IT.WHEAT, inCount: 18 + r(6), outId: IT.EMERALD, outCount: 1, done: 0 },
        { inId: IT.EMERALD, inCount: 2 + r(2), outId: IT.APPLE, outCount: 5, done: 0 },
        { inId: IT.EMERALD, inCount: 4 + r(4), outId: IT.BREAD, outCount: 6, done: 0 },
      ];
    } else if (kind === 'creeper') {
      this.group.add(box(0.5, 0.9, 0.32, mat(s.body), 0, 0.85, 0));
      this.group.add(box(0.48, 0.48, 0.48, mat(s.head), 0, 1.52, 0));
      const eye = mat(0x0c0c14);
      this.group.add(box(0.1, 0.1, 0.02, eye, -0.11, 1.56, -0.245));
      this.group.add(box(0.1, 0.1, 0.02, eye, 0.11, 1.56, -0.245));
      const mouth = mat(0x101018);
      this.group.add(box(0.16, 0.2, 0.02, mouth, 0, 1.42, -0.245));
      for (const [lx, lz] of [[-0.14, -0.2], [0.14, -0.2], [-0.14, 0.2], [0.14, 0.2]] as const) {
        const leg = box(0.22, 0.4, 0.22, mat(s.leg), lx, 0.2, lz);
        this.legs.push(leg); this.group.add(leg);
      }
    } else {
      // quadruped
      this.group.add(box(0.62, 0.5, 0.9, mat(s.body), 0, 0.62, 0));
      const headY = this.kind === 'chicken' ? 0.95 : 0.85;
      this.group.add(box(0.42, 0.42, 0.42, mat(s.head), 0, headY, -0.55));
      if (this.kind === 'chicken') this.group.add(box(0.14, 0.1, 0.16, mat(0xe8a030), 0, headY - 0.05, -0.82));
      for (const [lx, lz] of [[-0.18, -0.3], [0.18, -0.3], [-0.18, 0.3], [0.18, 0.3]] as const) {
        const leg = box(0.16, 0.4, 0.16, mat(s.leg), lx, 0.2, lz);
        this.legs.push(leg); this.group.add(leg);
      }
    }
    this.group.position.set(x, y, z);
    if (baby) this.group.scale.setScalar(0.55);
  }

  private flash() { this.flashTimer = 0.18; for (const m of this.mats) m.emissive.setHex(0xaa2222); }

  hit(dir: THREE.Vector3, damage: number, burst: MobCallbacks['burst']): boolean {
    this.hp -= damage;
    this.vel.addScaledVector(dir, 5);
    this.vel.y = 4;
    this.flash();
    STYLE[this.kind].sound();
    burst(this.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xdd3333, 6);
    if (this.hp <= 0) {
      this.dead = true;
      burst(this.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xffffff, 14);
      return true;
    }
    return false;
  }

  // returns true when this mob should be removed (death/despawn)
  update(dt: number, world: World, playerPos: THREE.Vector3, cb: MobCallbacks): boolean {
    if (this.dead) return true;
    const p = this.group.position;
    const distToPlayer = p.distanceTo(playerPos);
    this.soundTimer -= dt;
    this.attackCd -= dt;
    if (this.loveTimer > 0) this.loveTimer -= dt;
    if (this.baby) {
      this.growTimer -= dt;
      if (this.growTimer <= 0) { this.baby = false; this.group.scale.setScalar(1); this.hp = STYLE[this.kind].hp; }
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) for (const m of this.mats) m.emissive.setHex(0);
    }

    // daylight burn for undead
    if ((this.kind === 'zombie' || this.kind === 'skeleton') && cb.dayFactor() > 0.65) {
      this.burnTimer += dt;
      if (this.burnTimer > 1.2) {
        this.burnTimer = 0;
        this.hp -= 3;
        cb.burst(p.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff7722, 5);
        if (this.hp <= 0) { this.dead = true; return true; }
      }
    }

    let speed = 0;
    if (this.hostile) {
      const chase = distToPlayer < 20;
      if (this.kind === 'creeper') {
        if (this.fuse >= 0) {
          this.fuse -= dt;
          const f = Math.sin(this.fuse * 30) > 0 ? 1 : 0;
          for (const m of this.mats) m.emissive.setHex(f ? 0xffffff : 0x000000);
          const s = 1 + (1.2 - this.fuse) * 0.25;
          this.group.scale.setScalar(s);
          if (this.fuse <= 0) {
            cb.explode(p.clone(), 3.2);
            this.dead = true;
            return true;
          }
          if (distToPlayer > 5) { this.fuse = -1; this.group.scale.setScalar(1); for (const m of this.mats) m.emissive.setHex(0); }
        } else if (chase && distToPlayer < 2.6) {
          this.fuse = 1.2;
          sounds.creeperHiss();
        } else if (chase) {
          this.targetYaw = Math.atan2(playerPos.x - p.x, playerPos.z - p.z) + Math.PI;
          speed = 1.7;
          this.moving = true;
        }
      } else if (this.kind === 'skeleton') {
        if (chase && distToPlayer < 16) {
          this.targetYaw = Math.atan2(playerPos.x - p.x, playerPos.z - p.z) + Math.PI;
          speed = distToPlayer > 9 ? 1.6 : distToPlayer < 6 ? -1.2 : 0;
          this.moving = Math.abs(speed) > 0.1;
          this.shootCd -= dt;
          if (this.shootCd <= 0 && distToPlayer < 14) {
            this.shootCd = 2.2;
            const from = p.clone().add(new THREE.Vector3(0, 1.5, 0));
            const dir = playerPos.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(from).normalize();
            cb.shootArrow(from, dir);
            sounds.arrow();
          }
        }
      } else { // zombie
        if (chase && distToPlayer < 18) {
          this.targetYaw = Math.atan2(playerPos.x - p.x, playerPos.z - p.z) + Math.PI;
          speed = 2.0;
          this.moving = true;
          if (distToPlayer < 1.6 && this.attackCd <= 0) {
            this.attackCd = 1.0;
            cb.damagePlayer(3, p.clone());
          }
        }
      }
      if (this.soundTimer < 0) {
        this.soundTimer = 5 + Math.random() * 10;
        if (distToPlayer < 18) STYLE[this.kind].sound();
      }
    }

    // tamed followers (saddle)
    if (this.tamed && this.kind === 'pig') {
      if (distToPlayer > 3) {
        this.targetYaw = Math.atan2(playerPos.x - p.x, playerPos.z - p.z) + Math.PI;
        speed = Math.min(2.6, 1.4 + distToPlayer * 0.15);
        this.moving = true;
      } else this.moving = false;
    }
    // wander (passive always; hostile when idle)
    if (!this.tamed && (!this.hostile || (!this.moving && this.fuse < 0))) {
      this.wanderTimer -= dt;
      this.soundTimer -= 0;
      if (this.wanderTimer < 0) {
        this.wanderTimer = 2 + Math.random() * 4;
        this.moving = Math.random() < 0.65;
        this.targetYaw = Math.random() * Math.PI * 2;
      }
      if (this.moving && speed === 0) speed = 1.1;
      if (this.soundTimer < 0) { this.soundTimer = 8 + Math.random() * 18; if (Math.random() < 0.5 && distToPlayer < 20) STYLE[this.kind].sound(); }
    }

    // smooth turn
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 4);

    this.vel.x = Math.sin(this.yaw) * -speed;
    this.vel.z = Math.cos(this.yaw) * -speed;
    this.vel.y -= 18 * dt;
    if (this.vel.y < -30) this.vel.y = -30;

    const w = 0.3, h = this.hostile ? 1.9 : 1.0;
    const box2 = { minX: p.x - w, minY: p.y, minZ: p.z - w, maxX: p.x + w, maxY: p.y + h, maxZ: p.z + w };
    const res = collide(world, box2, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    this.onGround = res.onGround;
    if (this.moving && (Math.abs(res.dx) < Math.abs(this.vel.x * dt) * 0.5 || Math.abs(res.dz) < Math.abs(this.vel.z * dt) * 0.5)) {
      if (this.onGround) this.vel.y = 6.5;
      else this.targetYaw += Math.PI / 2 + Math.random();
    }
    // jump out of water
    if (world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === B.WATER) this.vel.y = 4;
    p.set(box2.minX + w, box2.minY, box2.minZ + w);
    if (this.onGround) this.vel.y = 0;
    this.group.rotation.y = this.yaw;

    if (this.moving && this.onGround) {
      this.legPhase += dt * 8;
      this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.legPhase + (i % 2) * Math.PI) * 0.55; });
    } else this.legs.forEach((l) => { l.rotation.x *= 0.8; });

    if (p.y < -5) return true;
    return false;
  }

  skyExposed(world: World): boolean {
    const p = this.group.position;
    for (let y = Math.ceil(p.y + 2); y < 80; y++) {
      if (isOpaque(world.getBlock(Math.floor(p.x), y, Math.floor(p.z)))) return false;
    }
    return true;
  }
}
