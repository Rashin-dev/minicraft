// Weather: rain, snow, thunder + lightning, fog coupling
import * as THREE from 'three';
import { sounds } from './sounds';

export type WeatherKind = 'clear' | 'rain' | 'snow' | 'thunder';

export class WeatherSystem {
  kind: WeatherKind = 'clear';
  overcast = 0; // 0..1 smooth
  flash = 0;
  private target: WeatherKind = 'clear';
  private timer = 90 + Math.random() * 180;
  private lightningTimer = 8;
  private points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private posAttr: THREE.Float32BufferAttribute;
  private count: number;
  private isSnowy = false;

  constructor(scene: THREE.Scene) {
    this.count = 900;
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.Float32BufferAttribute(new Float32Array(this.count * 3), 3);
    this.geo.setAttribute('position', this.posAttr);
    const mat = new THREE.PointsMaterial({
      color: 0x9fb8d8, size: 0.14, transparent: true, opacity: 0,
      sizeAttenuation: true, depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.scatter();
  }

  setSnowy(v: boolean) { this.isSnowy = v; }
  force(kind: WeatherKind) { this.target = kind; this.timer = 150 + Math.random() * 120; }

  private scatter() {
    for (let i = 0; i < this.count; i++) {
      this.posAttr.setXYZ(i, (Math.random() - 0.5) * 36, Math.random() * 22, (Math.random() - 0.5) * 36);
    }
    this.posAttr.needsUpdate = true;
  }

  update(dt: number, camPos: THREE.Vector3): number {
    this.timer -= dt;
    if (this.timer <= 0) {
      const r = Math.random();
      this.target = r < 0.55 ? 'clear' : this.isSnowy ? 'snow' : r < 0.85 ? 'rain' : 'thunder';
      this.timer = 100 + Math.random() * 160;
    }
    this.kind = this.target;
    const targetOvercast = this.target === 'clear' ? 0 : this.target === 'thunder' ? 1 : 0.75;
    this.overcast += (targetOvercast - this.overcast) * Math.min(1, dt * 0.25);
    const active = this.overcast > 0.25 && this.target !== 'clear';
    const snowing = this.target === 'snow';

    this.points.visible = active;
    const mat = this.points.material as THREE.PointsMaterial;
    mat.opacity = Math.min(0.65, Math.max(0, (this.overcast - 0.2) * 1.1));
    mat.color.setHex(snowing ? 0xe8f0fa : 0x9fb8d8);
    mat.size = snowing ? 0.18 : 0.12;

    if (active) {
      const speed = snowing ? 2.4 : 21;
      const drift = snowing ? 1.4 : 0.2;
      for (let i = 0; i < this.count; i++) {
        let x = this.posAttr.getX(i), y = this.posAttr.getY(i), z = this.posAttr.getZ(i);
        y -= speed * dt * (0.8 + (i % 5) * 0.1);
        x += Math.sin(i * 1.7 + y * 0.1 + performance.now() * 0.001) * drift * dt;
        if (y < -2) { y = 20 + Math.random() * 4; x = (Math.random() - 0.5) * 36; z = (Math.random() - 0.5) * 36; }
        this.posAttr.setXYZ(i, x, y, z);
      }
      this.posAttr.needsUpdate = true;
      this.points.position.copy(camPos);
      sounds.rainLoop(true, snowing ? 0.04 : 0.11);
    } else {
      sounds.rainLoop(false, 0);
    }

    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.target === 'thunder' && this.overcast > 0.7) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 6 + Math.random() * 14;
        this.flash = 0.8;
        sounds.thunder();
      }
    }
    return this.flash;
  }

  get fogMultiplier(): number { return 1 + this.overcast * 1.15; }
}
