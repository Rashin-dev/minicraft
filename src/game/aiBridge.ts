// AI bridge: (A) any OpenAI-compatible chat API as remote architect, (B) MCP-style JSON-RPC over WebSocket
import type { BuildOp } from './builder';

export interface AISettings {
  enabled: boolean;
  endpoint: string; // e.g. https://api.openai.com/v1/chat/completions
  apiKey: string;
  model: string;
}

export const DEFAULT_AI: AISettings = {
  enabled: false,
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
};

export const PLAN_SYSTEM_PROMPT = `You are the build planner for MiniCraft, a voxel sandbox.
Reply with ONLY a JSON object: {"name": string, "ops": BuildOp[]}
Coordinates are relative to the build anchor (ground level y=0). Keep builds under 12000 total blocks.
BuildOp is one of:
{"op":"set","x":0,"y":0,"z":0,"block":"grass"}
{"op":"fill","from":[x,y,z],"x2":x,"y2":y,"z2":z,"block":"stone"}
{"op":"clear","from":[x,y,z],"x2":x,"y2":y,"z2":z}
{"op":"sphere","x":0,"y":0,"z":0,"r":4,"block":"glass","hollow":false}
{"op":"cylinder","x":0,"y":0,"z":0,"r":3,"h":5,"block":"stone","hollow":false}
{"op":"wall","from":[x,y,z],"x2":x,"y2":height,"z2":z,"block":"stone_bricks"}
{"op":"tree","x":0,"z":0,"kind":"oak|birch|spruce|cherry"}
Block names: air grass dirt stone cobble moss sand sandstone gravel log leaves planks birch_log birch_leaves spruce_log spruce_leaves cherry_log cherry_leaves glass brick water bedrock coal_ore iron_ore gold_ore diamond_ore torch flower_red flower_yellow flower_pink tallgrass cactus dead_bush snow tnt wool_red wool_blue wool_yellow wool_green wool_white wool_black crafting glowstone obsidian bookshelf ice moss slab amethyst lantern snow_block moss_block stone_bricks diamond_block gold_block iron_block lava bed.
Good taste matters: vary materials, add lighting (torch/lantern/glowstone), symmetry, and landscaping.`;

const NAME_TO_ID: Record<string, number> = {
  air: 0, grass: 1, dirt: 2, stone: 3, cobble: 4, cobblestone: 4, sand: 5, gravel: 6,
  log: 7, oak_log: 7, leaves: 8, oak_leaves: 8, planks: 9, oak_planks: 9, glass: 10,
  brick: 11, bricks: 11, water: 12, bedrock: 13, coal_ore: 14, iron_ore: 15, gold_ore: 16,
  diamond_ore: 17, torch: 18, flower_red: 19, poppy: 19, flower_yellow: 20, dandelion: 20,
  tallgrass: 21, tall_grass: 21, cactus: 22, snow: 23, tnt: 24, wool_red: 25, wool_blue: 26,
  wool_yellow: 27, wool_green: 28, crafting: 29, glowstone: 30, obsidian: 31, bookshelf: 32,
  ice: 33, moss: 34, slab: 35, amethyst: 46, lantern: 47, sandstone: 48, snow_block: 49,
  moss_block: 50, wool_white: 51, wool_black: 52, stone_bricks: 53, diamond_block: 54,
  gold_block: 55, iron_block: 56, lava: 57, bed: 58, flower_pink: 59, dead_bush: 60,
  cherry_log: 40, cherry_leaves: 41, birch_log: 42, birch_leaves: 43, spruce_log: 44, spruce_leaves: 45,
};

function resolveBlock(b: unknown): number {
  if (typeof b === 'number') return b;
  if (typeof b === 'string') {
    const key = b.trim().toLowerCase().replace(/\s+/g, '_');
    if (NAME_TO_ID[key] !== undefined) return NAME_TO_ID[key];
    for (const k of Object.keys(NAME_TO_ID)) if (k.includes(key)) return NAME_TO_ID[k];
  }
  return 3;
}

export function sanitizePlan(raw: unknown): { name: string; ops: BuildOp[] } | null {
  try {
    const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { name?: string; ops?: unknown[] };
    if (!obj || !Array.isArray(obj.ops)) return null;
    const ops: BuildOp[] = [];
    let budget = 12000;
    for (const o of obj.ops) {
      if (budget <= 0) break;
      const op = o as Record<string, unknown>;
      const cl = (v: unknown, lim: number, d = 0) => Math.max(-lim, Math.min(lim, typeof v === 'number' ? Math.round(v) : d));
      switch (op.op) {
        case 'set':
          ops.push({ op: 'set', x: cl(op.x, 64), y: cl(op.y, 40), z: cl(op.z, 64), block: resolveBlock(op.block) });
          budget--; break;
        case 'fill': case 'clear': {
          const f = op.from as number[] | undefined;
          const from: [number, number, number] = [cl(f?.[0], 64), cl(f?.[1], 40), cl(f?.[2], 64)];
          const x2 = cl(op.x2, 64), y2 = cl(op.y2, 40), z2 = cl(op.z2, 64);
          const vol = (Math.abs(x2 - from[0]) + 1) * (Math.abs(y2 - from[1]) + 1) * (Math.abs(z2 - from[2]) + 1);
          budget -= Math.min(vol, budget);
          ops.push(op.op === 'fill'
            ? { op: 'fill', from, x2, y2, z2, block: resolveBlock(op.block) }
            : { op: 'clear', from, x2, y2, z2 });
          break;
        }
        case 'sphere':
          budget -= 40;
          ops.push({ op: 'sphere', x: cl(op.x, 64), y: cl(op.y, 40), z: cl(op.z, 64), r: cl(op.r, 24, 4), block: resolveBlock(op.block), hollow: !!op.hollow });
          break;
        case 'cylinder':
          budget -= 30;
          ops.push({ op: 'cylinder', x: cl(op.x, 64), y: cl(op.y, 40), z: cl(op.z, 64), r: cl(op.r, 24, 3), h: cl(op.h, 40, 3), block: resolveBlock(op.block), hollow: !!op.hollow });
          break;
        case 'wall': {
          const f = op.from as number[] | undefined;
          const from: [number, number, number] = [cl(f?.[0], 64), cl(f?.[1], 40), cl(f?.[2], 64)];
          budget -= 60;
          ops.push({ op: 'wall', from, x2: cl(op.x2, 64), y2: cl(op.y2, 40, 4), z2: cl(op.z2, 64), block: resolveBlock(op.block) });
          break;
        }
        case 'tree':
          ops.push({ op: 'tree', x: cl(op.x, 64), z: cl(op.z, 64), y: cl(op.y, 40), kind: (['oak', 'birch', 'spruce', 'cherry'] as const).includes(op.kind as 'oak') ? op.kind as 'oak' : 'oak' });
          break;
        default: break;
      }
    }
    return { name: typeof obj.name === 'string' ? obj.name : 'AI Build', ops };
  } catch {
    return null;
  }
}

// Call any OpenAI-compatible chat completions endpoint
export async function requestPlanFromAI(settings: AISettings, userPrompt: string): Promise<{ name: string; ops: BuildOp[] }> {
  const res = await fetch(settings.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status} ${res.statusText}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const plan = sanitizePlan(jsonMatch ? jsonMatch[0] : content);
  if (!plan) throw new Error('AI returned an invalid build plan');
  return plan;
}

// ---------------- MCP-style JSON-RPC bridge over WebSocket ----------------
// The game connects OUT to your bridge server; the server can drive the game.
// Protocol docs: see AI_MCP.md
export interface MCPHandlers {
  getState(): { pos: [number, number, number]; time: number; weather: string; fps: number; seed: number };
  setBlock(x: number, y: number, z: number, block: number | string): void;
  build(plan: unknown): void;
  chat(text: string): void;
  teleport(x: number, y: number, z: number): void;
  setTime(t: number | string): void;
  onLog: (msg: string) => void;
}

export class MCPBridge {
  private ws: WebSocket | null = null;
  private url = '';
  private reconnectTimer: number | null = null;
  connected = false;
  private handlers: MCPHandlers;

  constructor(handlers: MCPHandlers) { this.handlers = handlers; }

  connect(url: string) {
    this.disconnect();
    this.url = url;
    this.spawn();
  }

  private spawn() {
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.handlers.onLog(`MCP connect failed: ${e}`);
      return;
    }
    this.ws.onopen = () => {
      this.connected = true;
      this.handlers.onLog('MCP bridge connected');
      this.notify('game/ready', this.handlers.getState());
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.handlers.onLog('MCP bridge disconnected — retrying in 3s');
      this.reconnectTimer = window.setTimeout(() => this.spawn(), 3000);
    };
    this.ws.onerror = () => { /* onclose follows */ };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { id?: number | string; method?: string; params?: Record<string, unknown>; result?: unknown };
        if (msg.method) {
          this.handle(msg.method, msg.params ?? {}, msg.id);
        } else if (msg.result !== undefined) {
          this.handlers.onLog(`MCP: ${JSON.stringify(msg.result).slice(0, 120)}`);
        }
      } catch { /* ignore malformed */ }
    };
  }

  private send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private handle(method: string, params: Record<string, unknown>, id?: number | string) {
    try {
      let result: unknown = 'ok';
      switch (method) {
        case 'getState': result = this.handlers.getState(); break;
        case 'setBlock': this.handlers.setBlock(Number(params.x), Number(params.y), Number(params.z), (params.block ?? params.id) as number | string); break;
        case 'build': this.handlers.build(params.plan ?? params); break;
        case 'chat': case 'command': this.handlers.chat(String(params.text ?? params.command ?? '')); break;
        case 'teleport': this.handlers.teleport(Number(params.x), Number(params.y), Number(params.z)); break;
        case 'setTime': this.handlers.setTime((params.time ?? params.t ?? 0.3) as number | string); break;
        default: result = { error: `unknown method ${method}` };
      }
      if (id !== undefined) this.send({ jsonrpc: '2.0', id, result });
    } catch (e) {
      if (id !== undefined) this.send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e) } });
    }
  }

  notify(method: string, params: unknown) { this.send({ jsonrpc: '2.0', method, params }); }

  disconnect() {
    if (this.reconnectTimer !== null) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    this.connected = false;
  }
}
