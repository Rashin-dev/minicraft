// MiniCraft core engine — world streaming, player, sky, weather, mobs, AI architect
import * as THREE from 'three';
import { World, CHUNK, WORLD_H, SEA } from './world';
import { Controls, input } from './controls';
import { B, IT, blockDef, itemDef, isSolid, itemName, HOTBAR_DEFAULT } from './blocks';
import { buildAtlas, TILES, TILE_SIZE, ATLAS_COLS, ATLAS_ROWS } from './atlas';
import { makeChunkMaterials } from './chunkMaterial';
import { SkySystem } from './sky';
import { PostFX } from './postfx';
import { WeatherSystem } from './weather';
import type { WeatherKind } from './weather';
import { Mob } from './mobs';
import type { MobKind } from './mobs';
import { Particles } from './effects';
import { sounds, setMusic } from './sounds';
import { saveWorld } from './save';
import type { WorldSave } from './save';
import { mulberry32 } from './noise';
import { Inventory, RECIPES, itemIcon } from './items';
import { parseBuild, planToBlocks } from './builder';
import type { BuildOp } from './builder';
import { sanitizePlan, requestPlanFromAI } from './aiBridge';
import type { AISettings, MCPHandlers } from './aiBridge';
import { MCPBridge } from './aiBridge';
import { collide, isInLiquid, headInLiquid } from './physics';

export interface Waypoint { name: string; x: number; y: number; z: number; color: string; }

export interface GameEvents {
  onToast: (msg: string) => void;
  onTarget: (name: string | null, progress: number) => void;
  onStats: (fps: number, x: number, y: number, z: number, biome: string) => void;
  onPause: () => void;
  onTimeChange: (t: number, day: number) => void;
  onChat: (msg: string, kind: 'system' | 'player' | 'ai') => void;
  onChatOpen: (prefill: string) => void;
  onHealth: (hp: number, hunger: number, air: number) => void;
  onDeath: () => void;
  onModeChange: (mode: 'creative' | 'survival') => void;
  onInventory: () => void;
  onSleep: () => void;
  onLoading: (progress: number) => void;
  onBuildProgress: (name: string, done: number, total: number) => void;
}

interface ChunkMeshes { opaque: THREE.Mesh | null; trans: THREE.Mesh | null; water: THREE.Mesh | null; }
interface TNTFuse { x: number; y: number; z: number; t: number; mesh: THREE.Mesh; }
interface Arrow { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; }

const DAY_LEN = 600;
const UW_COLOR = new THREE.Color(0x0a2a4a);
const WHITE = new THREE.Color(1, 1, 1);

export class Game {
  world: World;
  worldName: string;
  mode: 'creative' | 'survival' = 'creative';
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: Controls;
  events: GameEvents;
  waypoints: Waypoint[] = [];
  inventory = new Inventory();
  health = 20;
  hunger = 20;
  air = 10;
  spawnPoint = { x: 8.5, y: 40, z: 8.5 };
  aiSettings: AISettings = { enabled: false, endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: '', model: 'gpt-4o-mini' };
  ready = false;
  debugVerbose = false;

  // player
  pos = new THREE.Vector3(8, 40, 8);
  vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  onGround = false;
  flying = false;
  dead = false;
  private wasJump = false;

  // chunks (worker)
  private worker: Worker;
  private chunkMeshes = new Map<string, ChunkMeshes>();
  private pending = new Set<string>();
  private editQueue: [number, number, number, number][] = [];
  private editTimer = 0;
  renderDistance = 5;
  private quality: 'auto' | 'high' | 'medium' | 'low' = 'auto';
  private autoLevel = 0;
  private mats: ReturnType<typeof makeChunkMaterials>;
  private atlasCanvas: HTMLCanvasElement;
  private basePR: number;
  private renderScale = 1;

  // systems
  private sky: SkySystem;
  private post: PostFX;
  private weather!: WeatherSystem;
  private sunLight = new THREE.DirectionalLight(0xffffff, 1);
  private hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  timeOfDay = 0.3;
  dayCount = 0;
  nightLight = 1;

  // interaction
  private highlight: THREE.LineSegments;
  private breakTarget: string | null = null;
  private breakProgress = 0;
  private torchLights: THREE.PointLight[] = [];

  hotbar: number[] = [...HOTBAR_DEFAULT];
  selectedSlot = 0;

  private mobs: Mob[] = [];
  private arrows: Arrow[] = [];
  private particles: Particles;
  private tnts: TNTFuse[] = [];
  private clock = new THREE.Clock();
  private elapsed = 0;
  private disposed = false;
  private fpsEMA = 60;
  private statTimer = 0;
  private saveTimer = 20;
  private mobTimer = 8;
  private hostileTimer = 5;
  paused = false;
  minimapCanvas: HTMLCanvasElement | null = null;
  private minimapTimer = 0;
  onHotbarChange: () => void = () => {};
  private mcp: MCPBridge;
  private buildGen: Generator<[number, number, number, number]> | null = null;
  private buildName = '';
  private buildTotal = 0;
  private buildDone = 0;
  private buildBuffer: [number, number, number, number][] = [];
  private heldGroup: THREE.Group;
  private heldMesh: THREE.Mesh | null = null;
  private heldItemId = -1;
  private swingT = 1;
  private bobT = 0;
  private damageFlash = 0;
  private sleepFade = 0;
  private sleeping = false;
  private hungerTimer = 14;
  private regenTimer = 0;
  private starveTimer = 4;
  private airTimer = 0;
  private eatCd = 0;
  private lavaTimer = 0;
  private lastJumpTap = 0;
  private stepTimer = 0;
  private resTimer = 2;
  private mobHitCooldown = 0;
  private biomeName = 'plains';
  public underwater = false;
  private wasInWater = false;
  private iconCache = new Map<number, HTMLCanvasElement>();

  constructor(container: HTMLElement, name: string, seed: number, events: GameEvents, saved?: WorldSave | null, mode: 'creative' | 'survival' = 'creative') {
    this.worldName = name;
    this.events = events;
    this.mode = saved?.mode ?? mode;
    this.world = new World(seed);
    this.inventory.onChange = () => this.onHotbarChange();
    let savedWeather: WeatherKind | null = null;

    if (saved) {
      for (const [k, v] of Object.entries(saved.diffs)) {
        const [x, y, z] = k.split(',').map(Number);
        this.world.setBlock(x, y, z, v, true);
      }
      this.timeOfDay = saved.timeOfDay;
      this.dayCount = saved.dayCount ?? 0;
      this.waypoints = saved.waypoints ?? [];
      this.pos.set(saved.player.x, saved.player.y, saved.player.z);
      this.yaw = saved.player.yaw; this.pitch = saved.player.pitch;
      this.spawnPoint = saved.spawn ? { ...saved.spawn } : { x: this.pos.x, y: this.pos.y, z: this.pos.z };
      this.health = saved.health ?? 20;
      this.hunger = saved.hunger ?? 20;
      if (saved.inventory) this.inventory.load(saved.inventory);
      if (saved.aiSettings) this.aiSettings = { ...this.aiSettings, ...saved.aiSettings };
      savedWeather = saved.weather ?? 'clear';
    } else {
      const ty = this.surfaceYAt(8, 8);
      this.pos.set(8.5, ty + 2, 8.5);
      this.spawnPoint = { x: 8.5, y: ty + 2, z: 8.5 };
    }
    if (savedWeather) this.weather.force(savedWeather);
    if (this.mode === 'survival' && !saved?.inventory) {
      this.hotbar = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      this.inventory.add(IT.WOOD_PICKAXE, 1);
      this.inventory.add(IT.WOOD_AXE, 1);
      this.inventory.add(B.TORCH, 5);
      this.inventory.add(B.PLANKS, 16);
    }

    // atlas + materials
    const { texture } = buildAtlas();
    this.atlasCanvas = texture;
    const tex = new THREE.CanvasTexture(texture);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.mats = makeChunkMaterials(tex);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.basePR = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(this.basePR);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(74, container.clientWidth / container.clientHeight, 0.08, 500);

    // lights
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.1));

    // systems
    this.sky = new SkySystem(this.scene, seed);
    this.post = new PostFX(this.renderer, this.scene, this.camera, container.clientWidth, container.clientHeight);
    this.weather = new WeatherSystem(this.scene);

    // highlight box
    const hl = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(hl), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight(0xffbf66, 0, 13, 1.7);
      this.scene.add(pl); this.torchLights.push(pl);
    }

    this.particles = new Particles(this.scene, 700);

    // held item view model
    this.heldGroup = new THREE.Group();
    this.camera.add(this.heldGroup);
    this.scene.add(this.camera);

    // worker
    this.worker = new Worker(new URL('./worldWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => this.onWorkerMessage(e.data);
    this.worker.postMessage({ type: 'init', seed, diffs: [...this.world.diffs.entries()] });

    this.controls = new Controls(this.renderer.domElement);
    this.controls.onPause = () => this.events.onPause();
    this.controls.onHotbar = (i) => this.selectSlot(i);
    this.controls.onHotbarScroll = (dir) => this.selectSlot((this.selectedSlot + dir + 9) % 9);
    this.controls.onInventory = () => this.events.onInventory();
    this.controls.onChat = (prefill) => this.events.onChatOpen(prefill);
    this.controls.onFlyToggle = () => this.toggleFly();
    this.controls.onDebug = () => { this.debugVerbose = !this.debugVerbose; };
    this.controls.enabled = true;

    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    if (this.controls.isTouch && mem <= 4) { this.autoLevel = 1; this.renderDistance = 4; }

    this.mcp = new MCPBridge(this.mcpHandlers());
    this.updateHeldMesh(true);

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.onUnload);

    this.spawnInitialMobs();
    setMusic(true);
    this.loop();
  }

  private onResize = () => {
    const c = this.renderer.domElement.parentElement!;
    this.renderer.setSize(c.clientWidth, c.clientHeight);
    this.camera.aspect = c.clientWidth / c.clientHeight;
    this.camera.updateProjectionMatrix();
    this.applyRenderScale();
  };
  private onVisibility = () => { if (document.hidden) this.save(); };
  private onUnload = () => this.save();

  surfaceYAt(x: number, z: number): number { return this.world.surfaceYAt(x, z); }

  selectHotbar(i: number) { this.selectSlot(i); }

  private selectSlot(i: number) {
    this.selectedSlot = i;
    this.updateHeldMesh(true);
    this.onHotbarChange();
    sounds.click();
  }

  // ---------- worker protocol ----------
  private onWorkerMessage(msg: {
    type: string; cx: number; cz: number; blocks: Uint8Array;
    opaque: MeshPayload | null; trans: MeshPayload | null; water: WaterPayload | null;
  }) {
    if (msg.type !== 'chunk') return;
    const { cx, cz, blocks } = msg;
    this.world.ingest(cx, cz, blocks);
    const key = World.key(cx, cz);
    this.pending.delete(key);
    const old = this.chunkMeshes.get(key);
    if (old) this.disposeChunkMeshes(old);

    const meshes: ChunkMeshes = { opaque: null, trans: null, water: null };
    const makeMesh = (data: MeshPayload | WaterPayload | null, mat: THREE.Material, renderOrder: number): THREE.Mesh | null => {
      if (!data) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
      if ('uv' in data && data.uv) g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
      g.setAttribute('aLight', new THREE.BufferAttribute(data.light, 4, true));
      if ('ao' in data && data.ao) g.setAttribute('aAO', new THREE.BufferAttribute(data.ao, 1, true));
      if ('wind' in data && data.wind) g.setAttribute('aWind', new THREE.BufferAttribute(data.wind, 1, true));
      g.setIndex(new THREE.BufferAttribute(data.index, 1));
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx * CHUNK, 0, cz * CHUNK);
      m.renderOrder = renderOrder;
      this.scene.add(m);
      return m;
    };
    meshes.opaque = makeMesh(msg.opaque, this.mats.opaque, 0);
    meshes.trans = makeMesh(msg.trans, this.mats.trans, 2);
    meshes.water = makeMesh(msg.water, this.mats.water, 3);
    this.chunkMeshes.set(key, meshes);
  }

  private requestChunk(cx: number, cz: number) {
    const key = World.key(cx, cz);
    if (this.chunkMeshes.has(key) || this.pending.has(key)) return;
    this.pending.add(key);
    this.worker.postMessage({ type: 'mesh', cx, cz });
  }

  private flushEdits() {
    if (this.editQueue.length === 0) return;
    this.worker.postMessage({ type: 'edits', edits: this.editQueue });
    this.editQueue = [];
  }

  private disposeChunkMeshes(m: ChunkMeshes) {
    for (const mesh of [m.opaque, m.trans, m.water]) {
      if (mesh) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    }
  }

  private ensureChunks() {
    const pcx = Math.floor(this.pos.x / CHUNK), pcz = Math.floor(this.pos.z / CHUNK);
    let requested = 0;
    outer:
    for (let r = 0; r <= this.renderDistance; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const key = World.key(pcx + dx, pcz + dz);
        if (!this.chunkMeshes.has(key) && !this.pending.has(key)) {
          this.requestChunk(pcx + dx, pcz + dz);
          if (++requested >= 2) break outer;
        }
      }
    }
    for (const [key, meshes] of this.chunkMeshes) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > this.renderDistance + 1) {
        this.disposeChunkMeshes(meshes);
        this.chunkMeshes.delete(key);
      }
    }
    this.editTimer -= 1 / 60;
    if (this.editTimer <= 0) { this.editTimer = 0.05; this.flushEdits(); }
  }

  private loadingProgress(): number {
    const pcx = Math.floor(this.pos.x / CHUNK), pcz = Math.floor(this.pos.z / CHUNK);
    const need = Math.min(this.renderDistance, 3);
    let total = 0, have = 0;
    for (let dz = -need; dz <= need; dz++) for (let dx = -need; dx <= need; dx++) {
      total++;
      if (this.chunkMeshes.has(World.key(pcx + dx, pcz + dz))) have++;
    }
    return have / total;
  }

  // ---------- raycast ----------
  private raycast(maxDist = 6.5): { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number } | null {
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
    for (let i = 0; i < 160; i++) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) return null;
      const id = this.world.getBlock(x, y, z);
      if (id !== 0 && id !== B.WATER) return { x, y, z, nx, ny, nz, id };
    }
    return null;
  }

  private heldItem(): number {
    if (this.mode === 'creative') return this.hotbar[this.selectedSlot] ?? 0;
    return this.inventory.slots[this.selectedSlot]?.id ?? 0;
  }

  private toolFor(def: ReturnType<typeof blockDef>): number {
    const it = itemDef(this.heldItem())?.tool;
    if (!it || !def?.tool) return 1;
    return it.type === def.tool ? it.speed : 1;
  }

  private attackDamage(): number {
    return itemDef(this.heldItem())?.tool?.damage ?? 2;
  }

  // ---------- interaction ----------
  private tryBreak(dt: number) {
    const hit = this.raycast();
    if (!hit) { this.breakTarget = null; this.breakProgress = 0; this.highlight.visible = false; this.events.onTarget(null, 0); return; }
    this.highlight.visible = true;
    this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    const def = blockDef(hit.id)!;
    if (hit.id === B.TNT) { this.igniteTNT(hit.x, hit.y, hit.z); this.setBlockNet(hit.x, hit.y, hit.z, 0); this.breakTarget = null; this.swing(); return; }

    const key = hit.x + ',' + hit.y + ',' + hit.z;
    if (this.breakTarget !== key) { this.breakTarget = key; this.breakProgress = 0; }
    const baseTime = def.breakTime ?? 0.5;
    if (baseTime === Infinity) { this.events.onTarget(def.name + ' (unbreakable)', 0); return; }
    const bt = this.mode === 'creative' ? Math.min(0.12, baseTime) : Math.max(0.08, baseTime / this.toolFor(def));
    this.breakProgress += dt;
    this.events.onTarget(def.name, this.breakProgress / bt);
    this.swing();
    if (this.breakProgress >= bt) {
      this.setBlockNet(hit.x, hit.y, hit.z, 0);
      const above = this.world.getBlock(hit.x, hit.y + 1, hit.z);
      if (above && blockDef(above)?.cross) this.setBlockNet(hit.x, hit.y + 1, hit.z, 0);
      sounds.breakBlock();
      this.particles.burst(new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), this.blockColor(hit.id), 14);
      if (this.mode === 'survival') {
        let drop = def.drop === undefined ? hit.id : def.drop;
        if (hit.id === B.LEAVES && Math.random() < 0.08) drop = IT.APPLE;
        if (drop) {
          this.inventory.add(drop, 1);
          sounds.pickup();
        }
      }
      this.breakTarget = null; this.breakProgress = 0;
    }
  }

  placeBlock() {
    const hit = this.raycast();
    if (hit) {
      if (hit.id === B.BED) { this.trySleep(hit.x, hit.y, hit.z); return; }
      if (hit.id === B.CRAFTING) { this.events.onInventory(); return; }
    }
    const held = this.heldItem();
    const food = itemDef(held)?.food;
    if (food && this.mode === 'survival' && this.hunger < 20 && this.eatCd <= 0) {
      this.hunger = Math.min(20, this.hunger + food);
      this.health = Math.min(20, this.health + 1);
      this.eatCd = 0.8;
      this.inventory.consumeHeld(1);
      sounds.eat();
      this.swing();
      return;
    }
    if (!hit) return;
    const id = this.mode === 'creative' ? this.hotbar[this.selectedSlot] : this.inventory.slots[this.selectedSlot]?.id ?? 0;
    if (!id || id >= 100) return;
    const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    let placeId = id;
    if (id === B.VSLAB_X0) {
      const facing = ((Math.round(this.yaw / (Math.PI / 2)) % 4) + 4) % 4;
      placeId = [B.VSLAB_Z0, B.VSLAB_X1, B.VSLAB_Z1, B.VSLAB_X0][facing];
    }
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
    const def = blockDef(placeId)!;
    if ((def.cross || def.torchLike) && !isSolid(this.world.getBlock(px, py - 1, pz))) return;
    this.setBlockNet(px, py, pz, placeId);
    if (this.mode === 'survival') this.inventory.consumeHeld(1);
    sounds.placeBlock();
    this.swing();
  }

  private setBlockNet(x: number, y: number, z: number, id: number) {
    this.world.setBlock(x, y, z, id);
    this.editQueue.push([x, y, z, id]);
  }

  private trySleep(bx: number, by: number, bz: number) {
    if (this.sky.dayFactor > 0.35) { this.events.onToast('You can only sleep at night'); return; }
    this.spawnPoint = { x: bx + 0.5, y: by + 1, z: bz + 0.5 };
    this.sleeping = true;
    sounds.sleep();
    this.events.onSleep();
    window.setTimeout(() => {
      this.timeOfDay = 0.27;
      this.dayCount++;
      this.sleeping = false;
      this.events.onToast('Rise and shine — spawn point set!');
    }, 1800);
  }

  toggleFly() {
    if (this.mode !== 'creative') { this.events.onToast('Flying is creative-only'); return; }
    this.flying = !this.flying;
    this.events.onToast(this.flying ? 'Flying enabled' : 'Flying disabled');
  }

  private igniteTNT(x: number, y: number, z: number) {
    sounds.fuse();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(mesh);
    this.tnts.push({ x, y, z, t: 2.2, mesh });
    this.events.onToast('TNT ignited! Run!');
  }

  explode(x: number, y: number, z: number, radius = 4) {
    sounds.explode();
    const R = Math.ceil(radius);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy + dz * dz > radius * radius + Math.random() * 3) continue;
      const bx = x + dx, by = y + dy, bz = z + dz;
      const id = this.world.getBlock(bx, by, bz);
      if (id === 0 || id === B.BEDROCK || id === B.OBSIDIAN) continue;
      if (id === B.TNT) { this.setBlockNet(bx, by, bz, 0); this.igniteTNT(bx, by, bz); continue; }
      this.setBlockNet(bx, by, bz, 0);
    }
    this.particles.burst(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0xff8830, 60, 9, 1.1, 6);
    this.particles.burst(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0x555555, 40, 6, 1.4, 3);
    const d = this.pos.clone().sub(new THREE.Vector3(x, y, z));
    const dist = d.length();
    if (dist < radius * 2) {
      this.vel.addScaledVector(d.normalize(), (radius * 2 - dist) * 1.8);
      if (this.mode === 'survival') this.damage((radius * 2 - dist) * 1.5);
    }
  }

  private blockColor(id: number): number {
    const map: Record<number, number> = {
      [B.GRASS]: 0x5da83c, [B.DIRT]: 0x866043, [B.STONE]: 0x808080, [B.SAND]: 0xdbcda0,
      [B.LOG]: 0x6a5232, [B.LEAVES]: 0x347628, [B.PLANKS]: 0xa88852, [B.WATER]: 0x346ccb,
      [B.SNOW]: 0xeef4fa, [B.TNT]: 0xc43220, [B.GLASS]: 0xc8e6f5, [B.BRICK]: 0x984c3c,
      [B.CHERRY_LEAVES]: 0xee9ec6, [B.AMETHYST]: 0xa878f0, [B.LAVA]: 0xe86e18,
    };
    return map[id] ?? 0x999999;
  }

  // ---------- player ----------
  private updatePlayer(dt: number) {
    if (this.dead) return;
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
    const inLava = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z)) === B.LAVA;

    const sprinting = input.sprint && len > 0.1 && (this.mode === 'creative' || this.hunger > 3);
    const speed = this.flying ? 11 : sprinting ? 6.4 : input.sneak ? 1.6 : 4.3;
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
      if (this.vel.y < -42) this.vel.y = -42;
      if (input.jump && this.onGround) { this.vel.y = 8.4; if (this.mode === 'survival') this.hunger = Math.max(0, this.hunger - 0.05); }
    }

    if (input.jump && !this.wasJump && !this.onGround && !inWater && this.doubleTapCheck() && this.mode === 'creative') {
      this.flying = !this.flying;
      this.events.onToast(this.flying ? 'Flying enabled' : 'Flying disabled');
    }
    this.wasJump = input.jump;

    const preVelY = this.vel.y;
    const res = collide(this.world, box, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    if (res.hitHead) this.vel.y = Math.min(this.vel.y, 0);
    if (res.onGround) {
      if (preVelY < -16 && this.mode === 'survival' && !inWater) this.damage(Math.floor((-preVelY - 16) * 0.8));
      else if (preVelY < -18) sounds.hurt();
      this.vel.y = 0;
      if (this.flying) this.flying = false;
    }
    this.onGround = res.onGround;
    this.pos.set(box.minX + w, box.minY, box.minZ + w);

    if (this.onGround && len > 0.2) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = sprinting ? 0.28 : 0.4; sounds.step(); }
      this.bobT += dt * (sprinting ? 11 : 8);
    }

    if (this.pos.y < -10) this.respawn();

    if (this.mode === 'survival') {
      if (inLava) { this.lavaTimer -= dt; if (this.lavaTimer <= 0) { this.lavaTimer = 0.4; this.damage(3); } }
      this.hungerTimer -= dt * (sprinting ? 2.2 : 1);
      if (this.hungerTimer <= 0) { this.hungerTimer = 14; this.hunger = Math.max(0, this.hunger - 1); }
      if (this.hunger >= 16 && this.health < 20) {
        this.regenTimer -= dt;
        if (this.regenTimer <= 0) { this.regenTimer = 2.5; this.health = Math.min(20, this.health + 1); this.hunger = Math.max(0, this.hunger - 0.5); }
      }
      if (this.hunger <= 0) {
        this.starveTimer -= dt;
        if (this.starveTimer <= 0) { this.starveTimer = 4; if (this.health > 2) this.damage(1); }
      }
      const headWater = headInLiquid(this.world, this.pos.x, this.pos.y + eye, this.pos.z);
      if (headWater) {
        this.airTimer -= dt;
        if (this.airTimer <= 0) { this.airTimer = 1.2; this.air = Math.max(0, this.air - 1); if (this.air === 0) this.damage(2); }
      } else { this.air = 10; this.airTimer = 0; }
      this.eatCd -= dt;
    }

    const eyeY = this.pos.y + (input.sneak ? eye - 0.15 : eye);
    this.camera.position.set(this.pos.x, eyeY, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    const targetFov = 74 + (sprinting ? 6 : 0) + (this.flying ? 4 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    const headWater = headInLiquid(this.world, this.pos.x, eyeY, this.pos.z);
    if (headWater && !this.wasInWater) sounds.splash();
    this.wasInWater = headWater;
    this.underwater = headWater;
    const tint = document.getElementById('water-tint');
    if (tint) tint.style.opacity = headWater ? '1' : '0';

    if (input.breakHeld && !this.paused) this.tryBreak(dt);
    else {
      this.breakTarget = null; this.breakProgress = 0; this.highlight.visible = false;
      const hit = this.raycast();
      this.events.onTarget(hit ? blockDef(hit.id)?.name ?? null : null, 0);
    }
    if (input.placeQueued && !this.paused) { this.placeBlock(); input.placeQueued = false; }
  }

  private doubleTapCheck(): boolean {
    const now = performance.now();
    if (now - this.lastJumpTap < 300) { this.lastJumpTap = 0; return true; }
    this.lastJumpTap = now;
    return false;
  }

  damage(amount: number) {
    if (this.dead || this.mode === 'creative') return;
    this.health = Math.max(0, this.health - amount);
    this.damageFlash = 1;
    sounds.hurt();
    if (this.health <= 0) this.die();
  }

  private die() {
    this.dead = true;
    this.events.onDeath();
  }

  respawn() {
    this.dead = false;
    this.health = 20; this.hunger = 20; this.air = 10;
    this.pos.set(this.spawnPoint.x, this.spawnPoint.y + 1, this.spawnPoint.z);
    this.vel.set(0, 0, 0);
    const ty = this.surfaceYAt(this.pos.x, this.pos.z);
    if (this.pos.y < ty) this.pos.y = ty + 2;
    this.events.onToast('Respawned');
  }

  private swing() { if (this.swingT >= 0.6) this.swingT = 0; }

  // ---------- held item view model ----------
  private uvFor(tileIdx: number): [number, number, number, number] {
    const col = tileIdx % ATLAS_COLS, row = Math.floor(tileIdx / ATLAS_COLS);
    const w = ATLAS_COLS * TILE_SIZE, h = ATLAS_ROWS * TILE_SIZE;
    const e = 0.02;
    return [(col * TILE_SIZE + e) / w, 1 - ((row + 1) * TILE_SIZE - e) / h, ((col + 1) * TILE_SIZE - e) / w, 1 - (row * TILE_SIZE + e) / h];
  }

  private updateHeldMesh(force = false) {
    const held = this.heldItem();
    if (!force && held === this.heldItemId) return;
    this.heldItemId = held;
    if (this.heldMesh) { this.heldGroup.remove(this.heldMesh); this.heldMesh.geometry.dispose(); this.heldMesh = null; }
    if (!held) return;
    if (held < 100) {
      const def = blockDef(held);
      if (!def) return;
      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      const quad = (v: number[][], tile: string) => {
        const base = positions.length / 3;
        const [u0, v0, u1, v1] = this.uvFor(TILES[tile] ?? 0);
        uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        for (const p of v) positions.push(p[0] - 0.5, p[1] - 0.5, p[2] - 0.5);
        indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      };
      const s = def.side, t = def.top;
      quad([[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], s);
      quad([[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], s);
      quad([[0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]], t);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      const mat = new THREE.MeshLambertMaterial({ map: (this.mats.opaque as THREE.ShaderMaterial).uniforms.uMap.value as THREE.Texture, alphaTest: 0.5 });
      this.heldMesh = new THREE.Mesh(g, mat);
      this.heldMesh.scale.setScalar(0.32);
    } else {
      const cv = this.itemIconCanvas(held);
      if (!cv) return;
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.heldMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.44),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }),
      );
      this.heldMesh.rotation.z = -0.4;
    }
    if (this.heldMesh) {
      this.heldMesh.position.set(0.42, -0.42, -0.7);
      this.heldGroup.add(this.heldMesh);
    }
  }

  private itemIconCanvas(id: number): HTMLCanvasElement | null {
    const cached = this.iconCache.get(id);
    if (cached) return cached;
    const cv = itemIcon(id, this.atlasCanvas);
    if (cv) this.iconCache.set(id, cv);
    return cv;
  }

  // ---------- sky / time ----------
  private updateSky(dt: number) {
    this.timeOfDay += dt / DAY_LEN;
    while (this.timeOfDay >= 1) { this.timeOfDay -= 1; this.dayCount++; }
    this.sky.update(this.timeOfDay, this.camera.position, this.weather.overcast, this.elapsed, this.auroraStrength(), (this.dayCount % 8) / 8);

    const day = this.sky.dayFactor;
    this.nightLight = 0.15 + day * 0.85;
    this.sunLight.intensity = 0.22 + day * 1.05;
    this.sunLight.color.setHSL(0.09, this.sky.duskFactor * 0.6, 0.55 + day * 0.4);
    const sunDir = this.sky.sunDir;
    this.sunLight.position.copy(this.camera.position).addScaledVector(sunDir, 120);
    this.sunLight.target.position.copy(this.camera.position);
    this.sunLight.target.updateMatrixWorld();
    this.hemi.intensity = 0.18 + day * 0.7;

    const fogMul = this.weather.fogMultiplier;
    const fogDensity = (1.15 / (this.renderDistance * CHUNK)) * fogMul * (this.underwater ? 5 : 1);
    this.mats.shared.uTime.value = this.elapsed;
    this.mats.shared.uDay.value = Math.max(0.06, day);
    (this.mats.shared.uFogColor.value as THREE.Color).copy(this.underwater ? UW_COLOR : this.sky.fogColor);
    this.mats.shared.uFogDensity.value = fogDensity;
    const wu = this.mats.water.uniforms;
    (wu.uSkyColor.value as THREE.Color).copy(this.sky.fogColor).lerp(WHITE, day * 0.25);
    (wu.uSunDir.value as THREE.Vector3).copy(sunDir);
    wu.uDay.value = Math.max(0.06, day);
    wu.uUnderwater.value = this.underwater ? 1 : 0;
    (wu.uFogColor.value as THREE.Color).copy(this.mats.shared.uFogColor.value as THREE.Color);
    wu.uFogDensity.value = fogDensity;

    // dynamic torch lights
    let li = 0;
    const px = Math.floor(this.pos.x), py = Math.floor(this.pos.y), pz = Math.floor(this.pos.z);
    outer:
    for (let dy = -5; dy <= 6; dy++) for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
      const id = this.world.getBlock(px + dx, py + dy, pz + dz);
      const def = blockDef(id);
      if (def?.light && def.lightColor) {
        const pl = this.torchLights[li++];
        pl.position.set(px + dx + 0.5, py + dy + 0.7, pz + dz + 0.5);
        pl.color.setRGB(def.lightColor[0], def.lightColor[1], def.lightColor[2]);
        pl.intensity = def.light * 0.55;
        if (li >= this.torchLights.length) break outer;
      }
    }
    for (; li < this.torchLights.length; li++) this.torchLights[li].intensity = 0;
  }

  private auroraStrength(): number {
    const night = 1 - this.sky.dayFactor;
    return (this.biomeName === 'snowy' || this.biomeName === 'mountain') ? night : night * 0.45;
  }

  // ---------- mobs ----------
  private spawnInitialMobs() {
    const kinds: MobKind[] = ['pig', 'sheep', 'cow', 'chicken'];
    const rng = mulberry32(this.world.seed + 999);
    for (let i = 0; i < 8; i++) {
      const x = this.pos.x + (rng() - 0.5) * 50, z = this.pos.z + (rng() - 0.5) * 50;
      const y = this.surfaceYAt(x, z);
      const top = this.world.getBlock(Math.floor(x), y, Math.floor(z));
      if ((top === B.GRASS || top === B.SNOW) && y > SEA) {
        const mob = new Mob(kinds[Math.floor(rng() * 4)], x, y + 1, z);
        this.mobs.push(mob); this.scene.add(mob.group);
      }
    }
  }

  private mobCallbacks() {
    return {
      damagePlayer: (amount: number, sourcePos: THREE.Vector3) => {
        this.damage(amount);
        const kb = this.pos.clone().sub(sourcePos).normalize().multiplyScalar(6);
        kb.y = 3; this.vel.add(kb);
      },
      shootArrow: (from: THREE.Vector3, dir: THREE.Vector3) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), new THREE.MeshBasicMaterial({ color: 0x8a6a3e }));
        mesh.position.copy(from);
        mesh.lookAt(from.clone().add(dir));
        this.scene.add(mesh);
        this.arrows.push({ mesh, vel: dir.clone().multiplyScalar(18), life: 4 });
      },
      onDeath: (kind: MobKind) => {
        const drops: Partial<Record<MobKind, number>> = {
          pig: IT.PORKCHOP, cow: IT.BEEF, sheep: B.WOOL_WHITE,
          zombie: Math.random() < 0.25 ? IT.IRON_CHUNK : 0,
          skeleton: IT.STICK, creeper: IT.GUNPOWDER,
        };
        const drop = drops[kind] ?? 0;
        if (drop && this.mode === 'survival') { this.inventory.add(drop, 1); sounds.pickup(); }
      },
      burst: (pos: THREE.Vector3, color: number, count: number) => this.particles.burst(pos, color, count),
      explode: (pos: THREE.Vector3, radius: number) => this.explode(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), radius),
      dayFactor: () => this.sky.dayFactor,
    };
  }

  private updateMobs(dt: number) {
    const cb = this.mobCallbacks();
    const cullDist = this.renderDistance * CHUNK * 1.3;
    for (const m of this.mobs) {
      if (m.group.position.distanceTo(this.pos) < cullDist) {
        if (m.update(dt, this.world, this.pos, cb)) {
          if (m.dead) cb.onDeath(m.kind);
          this.scene.remove(m.group);
        }
      }
    }
    this.mobs = this.mobs.filter((m) => !m.dead);

    this.mobTimer -= dt;
    if (this.mobTimer < 0 && this.mobs.filter((m) => !m.hostile).length < 8) {
      this.mobTimer = 8;
      const kinds: MobKind[] = ['pig', 'sheep', 'cow', 'chicken'];
      const ang = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 16;
      const x = this.pos.x + Math.cos(ang) * dist, z = this.pos.z + Math.sin(ang) * dist;
      const y = this.surfaceYAt(x, z);
      const top = this.world.getBlock(Math.floor(x), y, Math.floor(z));
      if (top === B.GRASS && y > SEA && this.sky.dayFactor > 0.4) {
        const mob = new Mob(kinds[Math.floor(Math.random() * 4)], x, y + 1, z);
        this.mobs.push(mob); this.scene.add(mob.group);
      }
    }
    this.hostileTimer -= dt;
    if (this.hostileTimer < 0 && this.mode === 'survival' && this.mobs.filter((m) => m.hostile).length < 6) {
      this.hostileTimer = 5;
      if (this.sky.dayFactor < 0.25) {
        const kinds: MobKind[] = ['zombie', 'zombie', 'skeleton', 'creeper'];
        const ang = Math.random() * Math.PI * 2;
        const dist = 16 + Math.random() * 12;
        const x = this.pos.x + Math.cos(ang) * dist, z = this.pos.z + Math.sin(ang) * dist;
        const y = this.surfaceYAt(x, z);
        if (y > SEA - 2) {
          const mob = new Mob(kinds[Math.floor(Math.random() * kinds.length)], x, y + 1, z);
          this.mobs.push(mob); this.scene.add(mob.group);
        }
      }
    }

    if (input.breakHeld && !this.dead) {
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      for (const m of this.mobs) {
        const to = m.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(this.camera.position);
        const d = to.length();
        if (d < 3.6 && to.normalize().dot(dir) > 0.88) {
          if (performance.now() - this.mobHitCooldown > 420) {
            this.mobHitCooldown = performance.now();
            this.swing();
            if (m.hit(dir, this.attackDamage(), cb.burst)) { sounds.pop(); cb.onDeath(m.kind); }
          }
          break;
        }
      }
    }
  }

  private updateArrows(dt: number) {
    for (const a of this.arrows) {
      a.life -= dt;
      a.vel.y -= 6 * dt;
      a.mesh.position.addScaledVector(a.vel, dt);
      a.mesh.lookAt(a.mesh.position.clone().add(a.vel));
      const p = a.mesh.position;
      if (this.world.isSolidAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) a.life = 0;
      if (p.distanceTo(this.camera.position) < 1.2) { this.damage(3); a.life = 0; }
    }
    this.arrows = this.arrows.filter((a) => {
      if (a.life <= 0) { this.scene.remove(a.mesh); a.mesh.geometry.dispose(); return false; }
      return true;
    });
  }

  private updateTNT(dt: number) {
    for (const t of this.tnts) {
      t.t -= dt;
      const m = t.mesh.material as THREE.MeshBasicMaterial;
      m.color.setHex(Math.floor(t.t * 8) % 2 === 0 ? 0xffffff : 0xff3020);
      if (t.t <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        this.explode(t.x, t.y, t.z);
      }
    }
    this.tnts = this.tnts.filter((t) => t.t > 0);
  }

  // ---------- AI Architect ----------
  private mcpHandlers(): MCPHandlers {
    return {
      getState: () => ({
        pos: [Math.round(this.pos.x), Math.round(this.pos.y), Math.round(this.pos.z)],
        time: this.timeOfDay, weather: this.weather.kind, fps: Math.round(this.fpsEMA), seed: this.world.seed,
      }),
      setBlock: (x, y, z, block) => {
        const id = typeof block === 'string' ? (nameToId(block) ?? B.STONE) : block;
        this.setBlockNet(x, y, z, id);
      },
      build: (plan) => {
        const p = sanitizePlan(plan);
        if (p) this.executePlan(p.ops, p.name);
      },
      chat: (text) => this.execCommand(text),
      teleport: (x, y, z) => this.teleport(x, y, z),
      setTime: (t) => { this.timeOfDay = typeof t === 'number' ? t : t === 'day' ? 0.3 : 0.8; },
      onLog: (msg) => this.events.onChat(msg, 'ai'),
    };
  }

  connectMCP(url: string) { this.mcp.connect(url); }
  disconnectMCP() { this.mcp.disconnect(); }
  get mcpConnected(): boolean { return this.mcp.connected; }

  private buildAnchor(): { x: number; y: number; z: number } {
    const dirX = -Math.sin(this.yaw), dirZ = -Math.cos(this.yaw);
    const x = Math.round(this.pos.x + dirX * 8);
    const z = Math.round(this.pos.z + dirZ * 8);
    const y = this.surfaceYAt(x, z) + 1;
    return { x, y, z };
  }

  executePlan(ops: BuildOp[], name: string) {
    const anchor = this.buildAnchor();
    const ctx = {
      setBlock: (x: number, y: number, z: number, id: number) => this.setBlockNet(x, y, z, id),
      surfaceY: (x: number, z: number) => this.surfaceYAt(x, z),
      getBlock: (x: number, y: number, z: number) => this.world.getBlock(x, y, z),
    };
    const blocks: [number, number, number, number][] = [];
    for (const b of planToBlocks(ops, anchor, ctx)) blocks.push(b);
    if (blocks.length === 0) { this.events.onToast('Nothing to build'); return; }
    blocks.sort((a, b2) => a[1] - b2[1]);
    const source = blocks;
    this.buildGen = (function* () { yield* source; })();
    this.buildName = name;
    this.buildTotal = blocks.length;
    this.buildDone = 0;
    this.buildBuffer = [];
    this.events.onChat(`🏗 Building ${name} — ${blocks.length} blocks…`, 'ai');
  }

  buildFromText(text: string): boolean {
    const parsed = parseBuild(text);
    if (parsed) {
      this.executePlan(parsed.plan.ops, parsed.plan.name);
      this.events.onChat(`🤖 ${parsed.description}`, 'ai');
      return true;
    }
    return false;
  }

  async buildFromAI(text: string) {
    if (!this.aiSettings.enabled || !this.aiSettings.apiKey) {
      this.events.onToast('Connect an AI in the pause menu first');
      return;
    }
    this.events.onChat(`🤖 Asking ${this.aiSettings.model} to plan: "${text}"…`, 'ai');
    try {
      const plan = await requestPlanFromAI(this.aiSettings, text);
      this.executePlan(plan.ops, plan.name);
    } catch (e) {
      this.events.onChat(`⚠ AI error: ${e}`, 'ai');
    }
  }

  private updateBuild() {
    if (!this.buildGen) return;
    const perFrame = 160;
    let placed = 0;
    while (placed < perFrame) {
      if (this.buildBuffer.length === 0) {
        const n = this.buildGen.next();
        if (n.done) {
          this.buildGen = null;
          sounds.levelUp();
          this.events.onChat(`✅ ${this.buildName} complete!`, 'ai');
          this.events.onBuildProgress(this.buildName, this.buildTotal, this.buildTotal);
          return;
        }
        this.buildBuffer.push(n.value);
      }
      const [x, y, z, id] = this.buildBuffer.pop()!;
      if (this.world.getBlock(x, y, z) !== id) {
        this.setBlockNet(x, y, z, id);
        if (id !== 0 && placed % 60 === 0) {
          this.particles.burst(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0xffffff, 2, 1.5, 0.4, 2);
        }
      }
      this.buildDone++;
      placed++;
    }
    this.events.onBuildProgress(this.buildName, this.buildDone, this.buildTotal);
  }

  // ---------- chat commands ----------
  execCommand(raw: string): boolean {
    const text = raw.trim();
    if (!text) return false;
    if (!text.startsWith('/')) {
      if (!this.buildFromText(text)) void this.buildFromAI(text);
      return true;
    }
    const parts = text.slice(1).split(/\s+/);
    const cmd = parts[0], args = parts.slice(1);
    switch (cmd) {
      case 'help':
        this.events.onChat('/time day|night · /weather clear|rain|snow|thunder · /tp x y z · /gamemode creative|survival · /give <name> · /build <what> · /seed · /heal', 'system');
        break;
      case 'time':
        this.timeOfDay = args[0] === 'day' ? 0.3 : args[0] === 'night' ? 0.8 : args[0] === 'sunset' ? 0.72 : args[0] === 'sunrise' ? 0.22 : parseFloat(args[0] ?? '0.3') || 0.3;
        this.events.onToast('Time set');
        break;
      case 'weather':
        this.weather.force((args[0] as WeatherKind) ?? 'clear');
        this.events.onToast(`Weather: ${args[0] ?? 'clear'}`);
        break;
      case 'tp': {
        const [x, y, z] = args.map(Number);
        if ([x, y, z].every((n) => Number.isFinite(n))) { this.teleport(x, y, z); this.events.onChat(`Teleported to ${x} ${y} ${z}`, 'system'); }
        break;
      }
      case 'gamemode':
        if (args[0] === 'creative' || args[0] === 'survival') this.setMode(args[0]);
        break;
      case 'give': {
        const id = nameToId(args.join(' '));
        if (id) {
          if (this.mode === 'creative') {
            const slot = this.hotbar.findIndex((hb) => !hb);
            this.hotbar[slot >= 0 ? slot : this.selectedSlot] = id;
            this.onHotbarChange();
          } else this.inventory.add(id, 1);
          this.events.onChat(`Given ${itemName(id)}`, 'system');
        } else this.events.onChat(`Unknown item: ${args.join(' ')}`, 'system');
        break;
      }
      case 'build':
        if (!this.buildFromText(args.join(' '))) this.events.onChat('Try: palace, castle, house, tower, dome, pyramid, garden, maze, fountain, bridge, forest, statue', 'system');
        break;
      case 'seed':
        this.events.onChat(`Seed: ${this.world.seed}`, 'system');
        break;
      case 'heal':
        this.health = 20; this.hunger = 20; this.air = 10;
        this.events.onToast('Healed');
        break;
      default:
        this.events.onChat(`Unknown command: /${cmd} — try /help`, 'system');
    }
    return true;
  }

  setMode(mode: 'creative' | 'survival') {
    this.mode = mode;
    if (mode === 'survival') this.flying = false;
    this.heldItemId = -1;
    this.updateHeldMesh(true);
    this.events.onModeChange(mode);
    this.events.onToast(`Game mode: ${mode}`);
    this.onHotbarChange();
  }

  teleport(x: number, y: number, z: number) {
    this.pos.set(x + 0.5, y + 1.5, z + 0.5);
    this.vel.set(0, 0, 0);
  }

  addWaypoint(name: string, color: string) {
    this.waypoints.push({ name, x: Math.floor(this.pos.x), y: Math.floor(this.pos.y), z: Math.floor(this.pos.z), color });
    this.save();
  }
  removeWaypoint(i: number) { this.waypoints.splice(i, 1); this.save(); }

  getAtlasCanvas() { return this.atlasCanvas; }
  get recipes() { return RECIPES; }

  // ---------- minimap ----------
  private drawMinimap() {
    const cv = this.minimapCanvas;
    if (!cv) return;
    const ctx2 = cv.getContext('2d');
    if (!ctx2) return;
    const size = cv.width, R = 40;
    const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
    const scale = size / (R * 2);
    const colorCache: Record<number, string> = {
      [B.GRASS]: '#5da83c', [B.WATER]: '#3a6fd0', [B.SAND]: '#dbcda0', [B.STONE]: '#808080',
      [B.SNOW]: '#eef4fa', [B.LOG]: '#6a5232', [B.LEAVES]: '#2f7024', [B.DIRT]: '#866043',
      [B.GRAVEL]: '#887e7e', [B.ICE]: '#a5cdf0', [B.CACTUS]: '#3e8a34',
      [B.CHERRY_LEAVES]: '#ee9ec6', [B.CHERRY_LOG]: '#4a2630', [B.SANDSTONE]: '#d8c89e',
      [B.LAVA]: '#e86e18', [B.STONE_BRICKS]: '#7a7a7a',
    };
    ctx2.fillStyle = '#0a0f1a'; ctx2.fillRect(0, 0, size, size);
    for (let dz = -R; dz < R; dz++) for (let dx = -R; dx < R; dx++) {
      const wx = px + dx, wz = pz + dz;
      if (!this.world.hasChunk(Math.floor(wx / CHUNK), Math.floor(wz / CHUNK))) continue;
      const y = this.surfaceYAt(wx, wz);
      const id = this.world.getBlock(wx, y, wz);
      const c = colorCache[id] ?? (id === 0 ? '#0a0f1a' : '#7a6a55');
      const shade = Math.max(0.55, Math.min(1, 0.7 + y / 180));
      ctx2.fillStyle = c;
      ctx2.globalAlpha = shade;
      ctx2.fillRect((dx + R) * scale, (dz + R) * scale, Math.ceil(scale), Math.ceil(scale));
    }
    ctx2.globalAlpha = 1;
    for (const w of this.waypoints) {
      const dx = (w.x - px + R) * scale, dz = (w.z - pz + R) * scale;
      if (dx < 4 || dx > size - 4 || dz < 4 || dz > size - 4) continue;
      ctx2.fillStyle = w.color;
      ctx2.beginPath(); ctx2.arc(dx, dz, 4, 0, Math.PI * 2); ctx2.fill();
      ctx2.strokeStyle = '#fff'; ctx2.stroke();
    }
    ctx2.save();
    ctx2.translate(size / 2, size / 2);
    ctx2.rotate(-this.yaw);
    ctx2.fillStyle = '#ff4040';
    ctx2.beginPath(); ctx2.moveTo(0, -7); ctx2.lineTo(5, 6); ctx2.lineTo(-5, 6); ctx2.closePath(); ctx2.fill();
    ctx2.strokeStyle = '#fff'; ctx2.stroke();
    ctx2.restore();
  }

  // ---------- save ----------
  save() {
    saveWorld({
      v: 2,
      name: this.worldName,
      seed: this.world.seed,
      mode: this.mode,
      diffs: Object.fromEntries(this.world.diffs),
      player: { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: this.pitch },
      spawn: { ...this.spawnPoint },
      inventory: this.mode === 'survival' ? this.inventory.serialize() : null,
      health: this.health,
      hunger: this.hunger,
      timeOfDay: this.timeOfDay,
      dayCount: this.dayCount,
      weather: this.weather.kind,
      waypoints: this.waypoints,
      aiSettings: { ...this.aiSettings },
      savedAt: Date.now(),
    });
  }

  // ---------- quality ----------
  setQuality(q: 'auto' | 'high' | 'medium' | 'low') {
    this.quality = q;
    if (q === 'high') { this.renderDistance = 6; this.autoLevel = 0; }
    else if (q === 'medium') { this.renderDistance = 4; this.autoLevel = 1; }
    else if (q === 'low') { this.renderDistance = 3; this.autoLevel = 2; }
    else { this.autoLevel = ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4 ? 1 : 0; this.renderDistance = this.autoLevel === 1 ? 4 : 5; }
    this.basePR = this.autoLevel === 0 ? Math.min(window.devicePixelRatio, 2) : this.autoLevel === 1 ? Math.min(window.devicePixelRatio, 1.5) : 1;
    this.sky.setCloudsVisible(this.autoLevel < 2);
    this.post.applyQuality(this.autoLevel);
    this.refreshAllChunks();
  }

  private refreshAllChunks() {
    for (const [key, meshes] of this.chunkMeshes) {
      this.disposeChunkMeshes(meshes);
      this.chunkMeshes.delete(key);
    }
  }

  // ---------- main loop ----------
  private loop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    let dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.paused) dt = 0;
    this.elapsed += dt;

    if (dt > 0) {
      this.updatePlayer(dt);
      this.updateSky(dt);
      this.weather.update(dt, this.camera.position);
      this.updateMobs(dt);
      this.updateArrows(dt);
      this.updateTNT(dt);
      this.updateBuild();
      this.particles.update(dt);
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
      this.sleepFade = this.sleeping ? Math.min(1, this.sleepFade + dt * 1.5) : Math.max(0, this.sleepFade - dt * 2);

      this.swingT = Math.min(1, this.swingT + dt * 3.2);
      if (this.heldMesh) {
        const swing = Math.sin(this.swingT * Math.PI);
        this.heldMesh.position.set(0.42 - swing * 0.12, -0.42 - swing * 0.18 + Math.sin(this.bobT) * 0.012, -0.7 + swing * 0.1);
        this.heldMesh.rotation.set(-swing * 1.1, 0.15 + swing * 0.4, 0);
      }
    }
    this.ensureChunks();

    const instFps = 1 / Math.max(1e-4, dt || 1e-4);
    if (dt > 0) this.fpsEMA = this.fpsEMA * 0.95 + instFps * 0.05;
    this.resTimer -= dt;
    if (this.resTimer <= 0 && this.quality === 'auto') {
      this.resTimer = 2;
      if (this.fpsEMA < 40 && this.renderScale > 0.55) { this.renderScale = Math.max(0.55, this.renderScale - 0.1); this.applyRenderScale(); }
      else if (this.fpsEMA > 56 && this.renderScale < 1) { this.renderScale = Math.min(1, this.renderScale + 0.05); this.applyRenderScale(); }
      if (this.fpsEMA < 32 && this.autoLevel < 2) {
        this.autoLevel++;
        this.renderDistance = Math.max(3, this.renderDistance - 1);
        this.sky.setCloudsVisible(this.autoLevel < 2);
        this.post.applyQuality(this.autoLevel);
        this.refreshAllChunks();
        this.events.onToast('Auto quality lowered to keep things smooth');
      }
    }

    // postfx uniforms
    this.post.grade.uniforms.uTime.value = this.elapsed;
    this.post.grade.uniforms.uDamage.value = this.damageFlash;
    this.post.grade.uniforms.uUnderwater.value = this.underwater ? 1 : 0;
    this.post.grade.uniforms.uFlash.value = this.weather.flash;
    this.post.grade.uniforms.uFade.value = this.sleepFade;
    this.post.grade.uniforms.uWarmth.value = this.sky.duskFactor * 0.8;
    const sunWorld = this.camera.position.clone().addScaledVector(this.sky.sunDir, 300);
    const sunNdc = sunWorld.project(this.camera);
    const onScreen = sunNdc.z < 1 && Math.abs(sunNdc.x) < 1.3 && Math.abs(sunNdc.y) < 1.3;
    const sunVisible = this.sky.sunDir.y > -0.05 && this.weather.overcast < 0.8;
    this.post.setSunScreen(
      (sunNdc.x + 1) / 2, (sunNdc.y + 1) / 2,
      onScreen && sunVisible ? 0.25 + this.sky.duskFactor * 0.9 : 0,
      this.sky.duskFactor,
    );

    this.statTimer -= dt;
    if (this.statTimer <= 0) {
      this.statTimer = 0.5;
      this.biomeName = this.world.biomeAt2(this.pos.x, this.pos.z);
      this.events.onStats(Math.round(this.fpsEMA), Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z), this.biomeName);
      this.events.onHealth(this.health, this.hunger, this.air);
    }
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 25; this.save(); }
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) { this.minimapTimer = 0.7; this.drawMinimap(); this.events.onTimeChange(this.timeOfDay, this.sky.dayFactor); }

    this.post.render(dt);

    if (!this.ready) {
      const p = this.loadingProgress();
      this.events.onLoading(p);
      if (p >= 1) this.ready = true;
    }
  };

  private applyRenderScale() {
    const c = this.renderer.domElement.parentElement;
    if (!c) return;
    this.renderer.setPixelRatio(this.basePR * this.renderScale);
    this.post.composer.setPixelRatio(this.basePR * this.renderScale);
    this.post.setSize(c.clientWidth, c.clientHeight);
  }

  dispose() {
    this.disposed = true;
    this.save();
    this.mcp.disconnect();
    this.worker.terminate();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.onUnload);
    for (const [, m] of this.chunkMeshes) this.disposeChunkMeshes(m);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

interface MeshPayload { position: Float32Array; uv: Float32Array; light: Uint8Array; ao: Uint8Array; wind: Uint8Array; index: Uint32Array; }
interface WaterPayload { position: Float32Array; light: Uint8Array; index: Uint32Array; }

function nameToId(name: string): number | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, '_');
  const alias: Record<string, number> = {
    air: 0, grass: 1, grass_block: 1, dirt: 2, stone: 3, cobble: 4, cobblestone: 4, sand: 5,
    gravel: 6, log: 7, oak_log: 7, leaves: 8, oak_leaves: 8, planks: 9, oak_planks: 9,
    glass: 10, brick: 11, bricks: 11, water: 12, bedrock: 13, coal_ore: 14, iron_ore: 15,
    gold_ore: 16, diamond_ore: 17, torch: 18, flower_red: 19, poppy: 19, flower_yellow: 20,
    dandelion: 20, tallgrass: 21, tall_grass: 21, cactus: 22, snow: 23, tnt: 24,
    wool_red: 25, wool_blue: 26, wool_yellow: 27, wool_green: 28, crafting: 29,
    crafting_table: 29, glowstone: 30, obsidian: 31, bookshelf: 32, ice: 33, moss: 34,
    slab: 35, cherry_log: 40, cherry_leaves: 41, birch_log: 42, birch_leaves: 43,
    spruce_log: 44, spruce_leaves: 45, amethyst: 46, lantern: 47, sandstone: 48,
    snow_block: 49, moss_block: 50, wool_white: 51, wool_black: 52, stone_bricks: 53,
    diamond_block: 54, gold_block: 55, iron_block: 56, lava: 57, bed: 58, flower_pink: 59,
    dead_bush: 60, stick: 100, coal: 101, iron_chunk: 102, gold_chunk: 103, diamond: 104,
    apple: 105, porkchop: 106, steak: 107, beef: 107, gunpowder: 108,
    wooden_pickaxe: 110, wood_pickaxe: 110, stone_pickaxe: 111, iron_pickaxe: 112, diamond_pickaxe: 113,
    wooden_axe: 114, wood_axe: 114, stone_axe: 115, iron_axe: 116, diamond_axe: 117,
    wooden_shovel: 118, wood_shovel: 118, stone_shovel: 119, iron_shovel: 120, diamond_shovel: 121,
    wooden_sword: 122, wood_sword: 122, stone_sword: 123, iron_sword: 124, diamond_sword: 125,
  };
  if (alias[key] !== undefined) return alias[key];
  if ((B as Record<string, number>)[key] !== undefined) return (B as Record<string, number>)[key];
  if ((IT as Record<string, number>)[key] !== undefined) return (IT as Record<string, number>)[key];
  return null;
}

export { TILES, TILE_SIZE } from './atlas';
export { B, IT, BLOCKS } from './blocks';
