// MiniCraft core engine
import * as THREE from 'three';
import { World, CHUNK, WORLD_H, SEA, buildChunkGeometry } from './world';
import { B, BLOCKS, blockDef, isSolid, HOTBAR_DEFAULT } from './blocks';
import { buildAtlas, TILES, TILE_SIZE } from './atlas';
import { collide, isInLiquid, headInLiquid } from './physics';
import { input, Controls } from './controls';
import { Mob } from './mobs';
import type { MobKind } from './mobs';
import { Particles } from './effects';
import { sounds } from './sounds';
import { saveWorld } from './save';
import type { WorldSave } from './save';
import { mulberry32 } from './noise';

export interface Waypoint { name: string; x: number; y: number; z: number; color: string; }

export interface GameEvents {
  onToast: (msg: string) => void;
  onTarget: (name: string | null, progress: number) => void;
  onStats: (fps: number, x: number, y: number, z: number) => void;
  onPause: () => void;
  onTimeChange: (t: number) => void;
}

interface ChunkMeshes { opaque: THREE.Mesh | null; transparent: THREE.Mesh | null; }
interface TNTFuse { x: number; y: number; z: number; t: number; mesh: THREE.Mesh; }

const DAY_LEN = 480; // seconds per full day

export class Game {
  world: World;
  worldName: string;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: Controls;
  events: GameEvents;
  waypoints: Waypoint[] = [];

  // player
  pos = new THREE.Vector3(8, 40, 8);
  vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  onGround = false;
  flying = false;
  private wasJump = false;

  // chunks
  private chunkMeshes = new Map<string, ChunkMeshes>();
  renderDistance = 5;
  private quality: 'auto' | 'high' | 'medium' | 'low' = 'auto';
  private autoLevel = 0; // 0 high, 1 medium, 2 low
  private matOpaque: THREE.MeshLambertMaterial;
  private matTrans: THREE.MeshLambertMaterial;
  private uvFor: (t: number) => [number, number, number, number];
  private atlasCanvas: HTMLCanvasElement;

  // sky
  private sunLight = new THREE.DirectionalLight(0xffffff, 1);
  private hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  private sunMesh: THREE.Mesh; private moonMesh: THREE.Mesh;
  private stars: THREE.Points;
  private clouds: THREE.Group;
  timeOfDay = 0.3;
  nightLight = 1;

  // interaction
  private highlight: THREE.LineSegments;
  private breakTarget: string | null = null;
  private breakProgress = 0;
  private torchLights: THREE.PointLight[] = [];

  hotbar: number[] = [...HOTBAR_DEFAULT];
  selectedSlot = 0;

  private mobs: Mob[] = [];
  private particles: Particles;
  private tnts: TNTFuse[] = [];
  private clock = new THREE.Clock();
  private disposed = false;
  private fpsEMA = 60;
  private statTimer = 0;
  private saveTimer = 0;
  private mobTimer = 0;
  private cloudMat: THREE.MeshLambertMaterial;
  paused = false;
  minimapCanvas: HTMLCanvasElement | null = null;
  private minimapTimer = 0;
  onHotbarChange: () => void = () => {};

  constructor(container: HTMLElement, name: string, seed: number, events: GameEvents, saved?: WorldSave | null) {
    this.worldName = name;
    this.events = events;
    this.world = new World(seed);
    if (saved) {
      for (const [k, v] of Object.entries(saved.diffs)) {
        const [x, y, z] = k.split(',').map(Number);
        this.world.setBlock(x, y, z, v, true);
      }
      this.world.diffs = new Map(Object.entries(saved.diffs));
      this.timeOfDay = saved.timeOfDay;
      this.waypoints = saved.waypoints ?? [];
      this.pos.set(saved.player.x, saved.player.y, saved.player.z);
      this.yaw = saved.player.yaw; this.pitch = saved.player.pitch;
    } else {
      // spawn at world origin surface
      const ty = this.surfaceYAt(8, 8);
      this.pos.set(8.5, ty + 2, 8.5);
    }

    const { texture, uvFor } = buildAtlas();
    this.atlasCanvas = texture;
    this.uvFor = uvFor;
    const tex = new THREE.CanvasTexture(texture);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;

    this.matOpaque = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.4 });
    this.matTrans = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.1, 400);

    // lights
    this.scene.add(this.sunLight); this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    // sun & moon billboards
    const sunTex = this.makeDiscTexture('#ffd94d', '#ffeeaa');
    const moonTex = this.makeDiscTexture('#e8ecf5', '#ffffff');
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    this.scene.add(this.sunMesh); this.scene.add(this.moonMesh);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    const srng = mulberry32(42);
    for (let i = 0; i < 350; i++) {
      const a = srng() * Math.PI * 2, b = srng() * Math.PI - Math.PI / 2;
      sp.push(Math.cos(a) * Math.cos(b) * 300, Math.sin(b) * 300, Math.sin(a) * Math.cos(b) * 300);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    this.scene.add(this.stars);

    // clouds
    this.clouds = new THREE.Group();
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    const crng = mulberry32(seed + 5);
    for (let i = 0; i < 24; i++) {
      const w = 8 + crng() * 20, d = 6 + crng() * 14;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), this.cloudMat);
      m.position.set((crng() - 0.5) * 400, 62 + crng() * 6, (crng() - 0.5) * 400);
      this.clouds.add(m);
    }
    this.scene.add(this.clouds);

    // highlight box
    const hl = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(hl), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    // torch point lights pool
    for (let i = 0; i < 5; i++) {
      const pl = new THREE.PointLight(0xffbf66, 0, 13, 1.6);
      this.scene.add(pl); this.torchLights.push(pl);
    }

    this.particles = new Particles(this.scene);
    this.controls = new Controls(this.renderer.domElement);
    this.controls.onPause = () => this.events.onPause();
    this.controls.onHotbar = (i) => { this.selectedSlot = i; this.onHotbarChange(); };
    this.controls.enabled = true;

    // detect low-end device
    const mem = (navigator as any).deviceMemory ?? 8;
    if (this.controls.isTouch && mem <= 4) { this.autoLevel = 1; this.renderDistance = 4; }

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.onUnload);

    this.spawnInitialMobs();
    this.loop();
  }

  private onResize = () => {
    const c = this.renderer.domElement.parentElement!;
    this.renderer.setSize(c.clientWidth, c.clientHeight);
    this.camera.aspect = c.clientWidth / c.clientHeight;
    this.camera.updateProjectionMatrix();
  };
  private onVisibility = () => { if (document.hidden) this.save(); };
  private onUnload = () => this.save();

  surfaceYAt(x: number, z: number): number {
    // generate chunk first so topY works
    this.world.getChunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
    return this.world.topY(Math.floor(x), Math.floor(z));
  }

  private makeDiscTexture(c1: string, c2: string): THREE.CanvasTexture {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, c2); grad.addColorStop(0.7, c1); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  // ---------- chunk management ----------
  private ensureChunks() {
    const pcx = Math.floor(this.pos.x / CHUNK), pcz = Math.floor(this.pos.z / CHUNK);
    let built = 0;
    for (let r = 0; r <= this.renderDistance && built < 2; r++) {
      for (let dz = -r; dz <= r && built < 2; dz++) for (let dx = -r; dx <= r && built < 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const key = World.key(cx, cz);
        if (!this.chunkMeshes.has(key)) {
          this.world.getChunk(cx, cz);
          this.rebuildChunk(cx, cz);
          built++;
        }
      }
    }
    // drop far chunks
    for (const [key, meshes] of this.chunkMeshes) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > this.renderDistance + 1) {
        meshes.opaque && this.disposeMesh(meshes.opaque);
        meshes.transparent && this.disposeMesh(meshes.transparent);
        this.chunkMeshes.delete(key);
      }
    }
    // rebuild dirty (budgeted)
    let rebuilt = 0;
    for (const key of this.world.dirtyChunks) {
      const [cx, cz] = key.split(',').map(Number);
      this.rebuildChunk(cx, cz);
      this.world.dirtyChunks.delete(key);
      if (++rebuilt >= 3) break;
    }
  }

  private disposeMesh(m: THREE.Mesh) {
    this.scene.remove(m); m.geometry.dispose();
  }

  private rebuildChunk(cx: number, cz: number) {
    const key = World.key(cx, cz);
    const old = this.chunkMeshes.get(key);
    old?.opaque && this.disposeMesh(old.opaque);
    old?.transparent && this.disposeMesh(old.transparent);
    const { opaque, transparent } = buildChunkGeometry(this.world, cx, cz, this.uvFor, this.nightLight, this.autoLevel < 2);
    const meshes: ChunkMeshes = { opaque: null, transparent: null };
    if (opaque) {
      const m = new THREE.Mesh(opaque, this.matOpaque);
      m.position.set(cx * CHUNK, 0, cz * CHUNK);
      this.scene.add(m); meshes.opaque = m;
    }
    if (transparent) {
      const m = new THREE.Mesh(transparent, this.matTrans);
      m.position.set(cx * CHUNK, 0, cz * CHUNK);
      m.renderOrder = 1;
      this.scene.add(m); meshes.transparent = m;
    }
    this.chunkMeshes.set(key, meshes);
  }

  // ---------- raycast ----------
  private raycast(maxDist = 7): { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number } | null {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const o = this.camera.position;
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = dir.x !== 0 ? ((stepX > 0 ? x + 1 - o.x : o.x - x) * tDeltaX) : Infinity;
    let tMaxY = dir.y !== 0 ? ((stepY > 0 ? y + 1 - o.y : o.y - y) * tDeltaY) : Infinity;
    let tMaxZ = dir.z !== 0 ? ((stepZ > 0 ? z + 1 - o.z : o.z - z) * tDeltaZ) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 128; i++) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) return null;
      const id = this.world.getBlock(x, y, z);
      if (id !== 0 && id !== B.WATER) return { x, y, z, nx, ny, nz, id };
    }
    return null;
  }

  // ---------- interaction ----------
  private tryBreak(dt: number) {
    const hit = this.raycast();
    if (!hit) { this.breakTarget = null; this.breakProgress = 0; this.highlight.visible = false; this.events.onTarget(null, 0); return; }
    this.highlight.visible = true;
    this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    const def = blockDef(hit.id)!;
    this.events.onTarget(def.name, this.breakProgress / (def.breakTime ?? 0.5));

    if (hit.id === B.TNT) { this.igniteTNT(hit.x, hit.y, hit.z); this.world.setBlock(hit.x, hit.y, hit.z, 0); this.breakTarget = null; return; }

    const key = hit.x + ',' + hit.y + ',' + hit.z;
    if (this.breakTarget !== key) { this.breakTarget = key; this.breakProgress = 0; }
    const bt = def.breakTime ?? 0.5;
    if (bt === Infinity) { this.events.onTarget(def.name + ' (unbreakable)', 0); return; }
    this.breakProgress += dt;
    const wobble = 1 + Math.sin(this.breakProgress * 40) * 0.02 * (this.breakProgress / bt);
    this.highlight.scale.setScalar(wobble);
    if (this.breakProgress >= bt) {
      this.world.setBlock(hit.x, hit.y, hit.z, 0);
      sounds.breakBlock();
      this.particles.burst(new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), this.blockColor(hit.id), 14);
      this.breakTarget = null; this.breakProgress = 0;
    }
  }

  placeBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const id = this.hotbar[this.selectedSlot];
    if (!id) return;
    let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    let placeId = id;
    // vertical slab orientation from player facing
    if (id === B.VSLAB_X0) {
      const facing = ((Math.round(this.yaw / (Math.PI / 2)) % 4) + 4) % 4;
      placeId = [B.VSLAB_Z0, B.VSLAB_X1, B.VSLAB_Z1, B.VSLAB_X0][facing];
    }
    // don't place inside player
    if (isSolid(placeId)) {
      const pw = 0.3, ph = 1.8;
      const overlap = px + 1 > this.pos.x - pw && px < this.pos.x + pw &&
        pz + 1 > this.pos.z - pw && pz < this.pos.z + pw &&
        py + 1 > this.pos.y && py < this.pos.y + ph;
      const def = blockDef(placeId)!;
      if (overlap && !def.slab && !def.cross && !def.torchLike) return;
    }
    if (py < 0 || py >= WORLD_H) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== 0 && existing !== B.WATER && !blockDef(existing)?.cross) return;
    // torches/plants need ground
    const def = blockDef(placeId)!;
    if ((def.cross || def.torchLike) && !isSolid(this.world.getBlock(px, py - 1, pz))) return;
    this.world.setBlock(px, py, pz, placeId);
    sounds.placeBlock();
  }

  private igniteTNT(x: number, y: number, z: number) {
    sounds.fuse();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(mesh);
    this.tnts.push({ x, y, z, t: 2.2, mesh });
    this.events.onToast('TNT ignited! Run!');
  }

  private explode(x: number, y: number, z: number) {
    sounds.explode();
    const R = 4;
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy + dz * dz > R * R + Math.random() * 3) continue;
      const bx = x + dx, by = y + dy, bz = z + dz;
      const id = this.world.getBlock(bx, by, bz);
      if (id === 0 || id === B.BEDROCK || id === B.OBSIDIAN) continue;
      if (id === B.TNT) { this.world.setBlock(bx, by, bz, 0); this.igniteTNT(bx, by, bz); continue; }
      this.world.setBlock(bx, by, bz, 0);
    }
    this.particles.burst(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0xff8830, 60, 9, 1.1, 6);
    this.particles.burst(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0x555555, 40, 6, 1.4, 3);
    // knockback player
    const d = this.pos.clone().sub(new THREE.Vector3(x, y, z));
    const dist = d.length();
    if (dist < 8) this.vel.addScaledVector(d.normalize(), (8 - dist) * 2.2);
  }

  private blockColor(id: number): number {
    const map: Record<number, number> = {
      [B.GRASS]: 0x5da83c, [B.DIRT]: 0x866043, [B.STONE]: 0x808080, [B.SAND]: 0xdbcda0,
      [B.LOG]: 0x6a5232, [B.LEAVES]: 0x347628, [B.PLANKS]: 0xa88852, [B.WATER]: 0x346ccb,
      [B.SNOW]: 0xeeF4fa, [B.TNT]: 0xc43220, [B.GLASS]: 0xc8e6f5, [B.BRICK]: 0x984c3c,
    };
    return map[id] ?? 0x999999;
  }

  // ---------- player ----------
  private updatePlayer(dt: number) {
    // look
    const sens = 0.0026;
    this.yaw -= input.lookDX * sens;
    this.pitch -= input.lookDY * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    input.lookDX = 0; input.lookDY = 0;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let fx = (-sin * input.forward + cos * input.strafe);
    let fz = (-cos * input.forward - sin * input.strafe);
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }

    const w = 0.3, h = 1.8, eye = 1.62;
    const box = { minX: this.pos.x - w, minY: this.pos.y, minZ: this.pos.z - w, maxX: this.pos.x + w, maxY: this.pos.y + h, maxZ: this.pos.z + w };
    const inWater = isInLiquid(this.world, box);

    const speed = this.flying ? 11 : input.sprint ? 6.5 : input.sneak ? 1.6 : 4.3;
    const accel = this.onGround || this.flying ? 14 : 4;
    this.vel.x += (fx * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (fz * speed - this.vel.z) * Math.min(1, accel * dt);

    if (this.flying) {
      this.vel.y += ((input.jump ? 8 : 0) + (input.sneak ? -8 : 0) - this.vel.y) * Math.min(1, 10 * dt);
    } else if (inWater) {
      this.vel.y -= 10 * dt;
      if (input.jump) this.vel.y = Math.min(this.vel.y + 30 * dt, 3.5);
      this.vel.y = Math.max(this.vel.y, -3);
    } else {
      this.vel.y -= 24 * dt;
      if (this.vel.y < -38) this.vel.y = -38;
      if (input.jump && this.onGround) { this.vel.y = 8.4; sounds.step(); }
    }

    // double-tap jump to fly (mobile-friendly)
    if (input.jump && !this.wasJump && !this.onGround && !inWater && this.doubleTapCheck()) {
      this.flying = !this.flying;
      this.events.onToast(this.flying ? 'Flying enabled' : 'Flying disabled');
    }
    this.wasJump = input.jump;

    const res = collide(this.world, box, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    if (res.hitHead) this.vel.y = Math.min(this.vel.y, 0);
    if (res.onGround) {
      if (this.vel.y < -18) sounds.hurt();
      this.vel.y = 0;
      if (this.flying) this.flying = false;
    }
    this.onGround = res.onGround;
    this.pos.set(box.minX + w, box.minY, box.minZ + w);

    // footstep sounds
    if (this.onGround && len > 0.2) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = input.sprint ? 0.28 : 0.4; sounds.step(); }
    }

    // fell out of world -> respawn
    if (this.pos.y < -10) {
      const ty = this.surfaceYAt(this.pos.x, this.pos.z);
      this.pos.y = ty + 2; this.vel.set(0, 0, 0);
      this.events.onToast('Respawned');
    }

    // camera
    const eyeY = this.pos.y + (input.sneak ? eye - 0.15 : eye);
    this.camera.position.set(this.pos.x, eyeY, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // underwater tint
    const headWater = headInLiquid(this.world, this.pos.x, eyeY, this.pos.z);
    if (headWater && !this.wasInWater) sounds.splash();
    this.wasInWater = headWater;
    this.underwater = headWater;
    const tint = document.getElementById('water-tint');
    if (tint) tint.style.opacity = headWater ? '1' : '0';

    // place / break
    if (input.breakHeld && !this.paused) this.tryBreak(dt);
    else { this.breakTarget = null; this.breakProgress = 0; this.highlight.visible = false; if (!input.breakHeld) this.events.onTarget(this.raycast() ? blockDef(this.raycast()!.id)!.name : null, 0); }
    if (input.placeQueued && !this.paused) { this.placeBlock(); input.placeQueued = false; }
    if (input.breakQueued) { input.breakQueued = false; }
  }

  private lastJumpTap = 0;
  private stepTimer = 0;
  public underwater = false;
  private wasInWater = false;
  private doubleTapCheck(): boolean {
    const now = performance.now();
    if (now - this.lastJumpTap < 300) { this.lastJumpTap = 0; return true; }
    this.lastJumpTap = now;
    return false;
  }

  // ---------- day/night ----------
  private updateSky(dt: number) {
    this.timeOfDay = (this.timeOfDay + dt / DAY_LEN) % 1;
    const ang = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(ang), sunX = Math.cos(ang);
    const day = Math.max(0, Math.min(1, sunY * 2.5 + 0.15)); // 0 night, 1 day
    this.nightLight = 0.15 + day * 0.85;

    const skyDay = new THREE.Color(0x87ceeb), skyNight = new THREE.Color(0x060814);
    const skyDusk = new THREE.Color(0xe8895a);
    const dusk = Math.max(0, 1 - Math.abs(sunY) * 4) * (sunY > -0.15 ? 1 : 0);
    const sky = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, dusk * 0.55);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky.clone(), this.renderDistance * CHUNK * 0.55, this.renderDistance * CHUNK * 0.95);

    this.sunLight.intensity = 0.25 + day * 0.85;
    this.sunLight.color.setHSL(0.1, dusk * 0.7, 0.5 + day * 0.4);
    this.hemi.intensity = 0.25 + day * 0.75;

    const r = 260;
    this.sunMesh.position.set(this.camera.position.x + sunX * r, this.camera.position.y + sunY * r, this.camera.position.z);
    this.sunMesh.lookAt(this.camera.position);
    this.moonMesh.position.set(this.camera.position.x - sunX * r, this.camera.position.y - sunY * r, this.camera.position.z);
    this.moonMesh.lookAt(this.camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - day * 2.2);
    this.cloudMat.opacity = 0.15 + day * 0.45;

    // clouds drift
    this.clouds.position.x += dt * 1.2;
    if (this.clouds.position.x > 220) this.clouds.position.x = -220;
    this.clouds.position.z = this.camera.position.z - 200 + 200; // keep near player z
    this.clouds.position.z = this.camera.position.z;

    // torch lights: find nearest lit blocks
    let li = 0;
    const px = Math.floor(this.pos.x), py = Math.floor(this.pos.y), pz = Math.floor(this.pos.z);
    outer:
    for (let dy = -6; dy <= 6; dy++) for (let dz = -10; dz <= 10; dz++) for (let dx = -10; dx <= 10; dx++) {
      const id = this.world.getBlock(px + dx, py + dy, pz + dz);
      const def = blockDef(id);
      if (def?.light) {
        const pl = this.torchLights[li++];
        pl.position.set(px + dx + 0.5, py + dy + 0.7, pz + dz + 0.5);
        pl.color.setRGB(def.lightColor![0], def.lightColor![1], def.lightColor![2]);
        pl.intensity = def.light * 0.55;
        if (li >= this.torchLights.length) break outer;
      }
    }
    for (; li < this.torchLights.length; li++) this.torchLights[li].intensity = 0;
  }

  // ---------- mobs ----------
  private spawnInitialMobs() {
    const kinds: MobKind[] = ['pig', 'sheep', 'cow', 'chicken'];
    const rng = mulberry32(this.world.seed + 999);
    for (let i = 0; i < 8; i++) {
      const x = this.pos.x + (rng() - 0.5) * 50, z = this.pos.z + (rng() - 0.5) * 50;
      const y = this.surfaceYAt(x, z);
      const top = this.world.getBlock(Math.floor(x), y, Math.floor(z));
      if (top === B.GRASS && y > SEA) {
        const mob = new Mob(kinds[Math.floor(rng() * 4)], x, y + 1, z);
        this.mobs.push(mob); this.scene.add(mob.group);
      }
    }
  }

  private updateMobs(dt: number) {
    this.mobTimer -= dt;
    for (const m of this.mobs) {
      if (m.group.position.distanceTo(this.pos) < this.renderDistance * CHUNK * 1.2) m.update(dt, this.world);
      if (m.dead) {
        this.particles.burst(m.group.position.clone().add(new THREE.Vector3(0, 0.7, 0)), 0xffffff, 16, 3, 0.6);
        sounds.pop();
        this.scene.remove(m.group);
      }
    }
    this.mobs = this.mobs.filter((m) => !m.dead);
    // respawn cap
    if (this.mobTimer < 0 && this.mobs.length < 10) {
      this.mobTimer = 6;
      const kinds: MobKind[] = ['pig', 'sheep', 'cow', 'chicken'];
      const ang = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 16;
      const x = this.pos.x + Math.cos(ang) * dist, z = this.pos.z + Math.sin(ang) * dist;
      const y = this.surfaceYAt(x, z);
      if (this.world.getBlock(Math.floor(x), y, Math.floor(z)) === B.GRASS && y > SEA) {
        const mob = new Mob(kinds[Math.floor(Math.random() * 4)], x, y + 1, z);
        this.mobs.push(mob); this.scene.add(mob.group);
      }
    }
    // punch mobs: if breaking and raycast misses block but hits mob — simple distance check
    if (input.breakHeld) {
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      for (const m of this.mobs) {
        const to = m.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)).sub(this.camera.position);
        const d = to.length();
        if (d < 3.5 && to.normalize().dot(dir) > 0.9) {
          if (!this.mobHitCooldown || performance.now() - this.mobHitCooldown > 400) {
            this.mobHitCooldown = performance.now();
            if (m.hit(dir)) this.events.onToast('Mob defeated!');
          }
          break;
        }
      }
    }
  }

  private mobHitCooldown = 0;

  // ---------- TNT ----------
  private updateTNT(dt: number) {
    for (const t of this.tnts) {
      t.t -= dt;
      const m = t.mesh.material as THREE.MeshBasicMaterial;
      m.color.setHex(Math.floor(t.t * 8) % 2 === 0 ? 0xffffff : 0xff3020);
      if (t.t <= 0) {
        this.scene.remove(t.mesh);
        this.explode(t.x, t.y, t.z);
      }
    }
    this.tnts = this.tnts.filter((t) => t.t > 0);
  }

  // ---------- minimap ----------
  private drawMinimap() {
    const cv = this.minimapCanvas;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const size = cv.width, R = 40;
    const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
    const scale = size / (R * 2);
    const colorCache: Record<number, string> = {
      [B.GRASS]: '#5da83c', [B.WATER]: '#3a6fd0', [B.SAND]: '#dbcda0', [B.STONE]: '#808080',
      [B.SNOW]: '#eef4fa', [B.LOG]: '#6a5232', [B.LEAVES]: '#2f7024', [B.DIRT]: '#866043',
      [B.GRAVEL]: '#887e7e', [B.ICE]: '#a5cdf0', [B.CACTUS]: '#3e8a34',
    };
    ctx.fillStyle = '#0a0f1a'; ctx.fillRect(0, 0, size, size);
    for (let dz = -R; dz < R; dz++) for (let dx = -R; dx < R; dx++) {
      const wx = px + dx, wz = pz + dz;
      const y = this.surfaceYAt(wx, wz);
      const id = this.world.getBlock(wx, y, wz);
      const c = colorCache[id] ?? (id === 0 ? '#0a0f1a' : '#7a6a55');
      const shade = Math.max(0.55, Math.min(1, 0.7 + y / 160));
      ctx.fillStyle = c;
      ctx.globalAlpha = shade;
      ctx.fillRect((dx + R) * scale, (dz + R) * scale, Math.ceil(scale), Math.ceil(scale));
    }
    ctx.globalAlpha = 1;
    // waypoints
    for (const w of this.waypoints) {
      const dx = (w.x - px + R) * scale, dz = (w.z - pz + R) * scale;
      if (dx < 4 || dx > size - 4 || dz < 4 || dz > size - 4) continue;
      ctx.fillStyle = w.color;
      ctx.beginPath(); ctx.arc(dx, dz, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    // player arrow
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-this.yaw);
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }

  // ---------- save ----------
  save() {
    saveWorld({
      name: this.worldName,
      seed: this.world.seed,
      diffs: Object.fromEntries(this.world.diffs),
      player: { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: this.pitch },
      timeOfDay: this.timeOfDay,
      waypoints: this.waypoints,
      savedAt: Date.now(),
    });
  }

  // ---------- public API ----------
  setQuality(q: 'auto' | 'high' | 'medium' | 'low') {
    this.quality = q;
    if (q === 'high') { this.renderDistance = 6; this.autoLevel = 0; }
    else if (q === 'medium') { this.renderDistance = 4; this.autoLevel = 1; }
    else if (q === 'low') { this.renderDistance = 3; this.autoLevel = 2; }
    else { this.autoLevel = (navigator as any).deviceMemory <= 4 ? 1 : 0; this.renderDistance = this.autoLevel === 1 ? 4 : 5; }
    this.clouds.visible = this.autoLevel < 2;
    this.refreshAllChunks();
  }

  private refreshAllChunks() {
    for (const [key] of this.chunkMeshes) {
      const [cx, cz] = key.split(',').map(Number);
      this.world.dirtyChunks.add(key);
      void cx; void cz;
    }
  }

  teleport(x: number, y: number, z: number) {
    this.pos.set(x, y + 1.5, z); this.vel.set(0, 0, 0);
  }

  addWaypoint(name: string, color: string) {
    this.waypoints.push({ name, x: Math.floor(this.pos.x), y: Math.floor(this.pos.y), z: Math.floor(this.pos.z), color });
    this.save();
  }
  removeWaypoint(i: number) { this.waypoints.splice(i, 1); this.save(); }

  getAtlasCanvas() { return this.atlasCanvas; }

  // ---------- main loop ----------
  private loop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    let dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.paused) dt = 0;

    if (dt > 0) {
      this.updatePlayer(dt);
      this.updateSky(dt);
      this.updateMobs(dt);
      this.updateTNT(dt);
      this.particles.update(dt);
    }
    this.ensureChunks();

    // fps tracking + auto quality
    const instFps = 1 / Math.max(1e-4, dt || 1e-4);
    this.fpsEMA = this.fpsEMA * 0.95 + instFps * 0.05;
    if (this.quality === 'auto') {
      if (this.fpsEMA < 32 && this.autoLevel < 2) {
        this.autoLevel++;
        this.renderDistance = Math.max(3, this.renderDistance - 1);
        this.clouds.visible = this.autoLevel < 2;
        this.events.onToast('Auto quality lowered to keep things smooth');
        this.refreshAllChunks();
      } else if (this.fpsEMA > 55 && this.autoLevel > ((navigator as any).deviceMemory <= 4 ? 1 : 0)) {
        this.autoLevel--;
        this.renderDistance = Math.min(6, this.renderDistance + 1);
        this.clouds.visible = this.autoLevel < 2;
        this.refreshAllChunks();
      }
    }

    this.statTimer -= dt;
    if (this.statTimer <= 0) {
      this.statTimer = 0.5;
      this.events.onStats(Math.round(this.fpsEMA), Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z));
    }
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 25; this.save(); }
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) { this.minimapTimer = 0.7; this.drawMinimap(); this.events.onTimeChange(this.timeOfDay); }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.save();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.onUnload);
    for (const [, m] of this.chunkMeshes) {
      m.opaque && this.disposeMesh(m.opaque);
      m.transparent && this.disposeMesh(m.transparent);
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { TILES, TILE_SIZE, B, BLOCKS };
