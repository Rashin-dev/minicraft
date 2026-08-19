// Simple passive mobs: pig, sheep, cow, chicken — box-model bodies, wander AI
import * as THREE from 'three';
import { World } from './world';
import { collide } from './physics';
import { sounds } from './sounds';

export type MobKind = 'pig' | 'sheep' | 'cow' | 'chicken';

const MOB_STYLE: Record<MobKind, { body: number; head: number; leg: number; scale: number; sound: () => void }> = {
  pig: { body: 0xefa3ab, head: 0xf2b4ba, leg: 0xd98f97, scale: 1, sound: sounds.pig },
  sheep: { body: 0xe8e8e8, head: 0xd8c8b8, leg: 0xb8a898, scale: 1.05, sound: sounds.sheep },
  cow: { body: 0x6b4a35, head: 0x8a6a50, leg: 0x4e3626, scale: 1.15, sound: sounds.cow },
  chicken: { body: 0xf5f5f0, head: 0xf5f5f0, leg: 0xe8a030, scale: 0.6, sound: sounds.chicken },
};

export class Mob {
  kind: MobKind;
  group = new THREE.Group();
  vel = new THREE.Vector3();
  yaw = 0;
  onGround = false;
  hp = 3;
  private wanderTimer = 0;
  private targetYaw = 0;
  private moving = false;
  private soundTimer = 5 + Math.random() * 15;
  private legPhase = 0;
  private legs: THREE.Mesh[] = [];
  dead = false;

  constructor(kind: MobKind, x: number, y: number, z: number) {
    this.kind = kind;
    const s = MOB_STYLE[kind];
    const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const box = (w: number, h: number, d: number, m: THREE.Material, ox: number, oy: number, oz: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * s.scale, h * s.scale, d * s.scale), m);
      mesh.position.set(ox * s.scale, oy * s.scale, oz * s.scale);
      return mesh;
    };
    // body
    this.group.add(box(0.62, 0.5, 0.9, mat(s.body), 0, 0.62, 0));
    // head
    const headY = this.kind === 'chicken' ? 0.95 : 0.85;
    this.group.add(box(0.42, 0.42, 0.42, mat(s.head), 0, headY, -0.55));
    if (this.kind === 'chicken') {
      const beak = box(0.14, 0.1, 0.16, mat(0xe8a030), 0, headY - 0.05, -0.82);
      this.group.add(beak);
    }
    // legs
    for (const [lx, lz] of [[-0.18, -0.3], [0.18, -0.3], [-0.18, 0.3], [0.18, 0.3]] as const) {
      const leg = box(0.16, 0.4, 0.16, mat(s.leg), lx, 0.2, lz);
      this.legs.push(leg); this.group.add(leg);
    }
    this.group.position.set(x, y, z);
  }

  update(dt: number, world: World) {
    if (this.dead) return;
    this.wanderTimer -= dt;
    this.soundTimer -= dt;
    if (this.soundTimer < 0) { this.soundTimer = 8 + Math.random() * 20; if (Math.random() < 0.5) MOB_STYLE[this.kind].sound(); }
    if (this.wanderTimer < 0) {
      this.wanderTimer = 2 + Math.random() * 4;
      this.moving = Math.random() < 0.7;
      this.targetYaw = Math.random() * Math.PI * 2;
    }
    // smooth turn
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 4);

    const speed = this.moving ? 1.1 : 0;
    this.vel.x = Math.sin(this.yaw) * -speed;
    this.vel.z = Math.cos(this.yaw) * -speed;
    this.vel.y -= 18 * dt;
    if (this.vel.y < -30) this.vel.y = -30;

    const w = 0.3, h = 1.0;
    const p = this.group.position;
    const box = { minX: p.x - w, minY: p.y, minZ: p.z - w, maxX: p.x + w, maxY: p.y + h, maxZ: p.z + w };
    const res = collide(world, box, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    this.onGround = res.onGround;
    // walk into wall -> hop
    if (this.moving && (Math.abs(res.dx) < Math.abs(this.vel.x * dt) * 0.5 || Math.abs(res.dz) < Math.abs(this.vel.z * dt) * 0.5)) {
      if (this.onGround) this.vel.y = 6;
      else { this.targetYaw += Math.PI / 2; }
    }
    p.set(box.minX + w, box.minY, box.minZ + w);
    if (this.onGround) this.vel.y = 0;
    this.group.rotation.y = this.yaw;

    // leg swing
    if (this.moving && this.onGround) {
      this.legPhase += dt * 8;
      this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.legPhase + (i % 2) * Math.PI) * 0.5; });
    } else this.legs.forEach((l) => { l.rotation.x *= 0.8; });

    if (p.y < -5) this.dead = true; // fell out of world
  }

  hit(dir: THREE.Vector3): boolean {
    this.hp--;
    this.vel.addScaledVector(dir, 5);
    this.vel.y = 4;
    MOB_STYLE[this.kind].sound();
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }
}
