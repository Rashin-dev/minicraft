// Lightweight particle system (block breaking, explosions, splashes)
import * as THREE from 'three';

interface Particle {
  pos: THREE.Vector3; vel: THREE.Vector3; life: number; color: THREE.Color; gravity: number;
}

export class Particles {
  points: THREE.Points;
  private particles: Particle[] = [];
  private geo: THREE.BufferGeometry;
  private max: number;
  private posAttr: THREE.Float32BufferAttribute;
  private colAttr: THREE.Float32BufferAttribute;

  constructor(scene: THREE.Scene, max = 500) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3);
    this.colAttr = new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
    const mat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(center: THREE.Vector3, color: number, count: number, speed = 3, life = 0.7, gravity = 12) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const p: Particle = {
        pos: center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)),
        gravity,
        vel: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.9 + 1, (Math.random() - 0.5) * speed),
        life: life * (0.6 + Math.random() * 0.6),
        color: c.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.12),
      };
      p.gravity = gravity;
      this.particles.push(p);
    }
  }

  update(dt: number) {
    let n = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      this.posAttr.setXYZ(n, p.pos.x, p.pos.y, p.pos.z);
      this.colAttr.setXYZ(n, p.color.r, p.color.g, p.color.b);
      n++;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.geo.setDrawRange(0, n);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}
