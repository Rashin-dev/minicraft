// localStorage persistence — save format v2
import type { Slot } from './items';

export interface WorldSave {
  v: 2 | 3;
  name: string;
  seed: number;
  mode: 'creative' | 'survival';
  diffs: Record<string, number>;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  spawn: { x: number; y: number; z: number };
  inventory: ([number, number] | null)[] | null;
  armor: ([number, number] | null)[] | null;
  health: number;
  hunger: number;
  timeOfDay: number;
  dayCount: number;
  weather: 'clear' | 'rain' | 'snow' | 'thunder';
  waypoints: { name: string; x: number; y: number; z: number; color: string }[];
  aiSettings: { enabled: boolean; endpoint: string; apiKey: string; model: string } | null;
  chests: Record<string, ([number, number] | null)[]> | null;
  furnaces: Record<string, { input: [number, number] | null; fuel: [number, number] | null; output: [number, number] | null; progress: number; burn: number }> | null;
  crops: Record<string, number> | null;
  savedAt: number;
}

const PREFIX = 'minicraft_world_';

export function listSaves(): WorldSave[] {
  const out: WorldSave[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      try {
        const raw = JSON.parse(localStorage.getItem(k)!) as WorldSave & { v?: number };
        if (!raw.v) {
          // migrate v1
          raw.v = 2;
          raw.mode = 'creative';
          raw.spawn = { x: raw.player.x, y: raw.player.y, z: raw.player.z };
          raw.health = 20; raw.hunger = 20;
          raw.inventory = null;
          raw.dayCount = 0;
          raw.weather = 'clear';
          raw.aiSettings = null;
        }
        out.push(raw);
      } catch { /* skip */ }
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function saveWorld(save: WorldSave) {
  try {
    localStorage.setItem(PREFIX + save.name, JSON.stringify(save));
  } catch { /* storage full */ }
}

export function loadWorld(name: string): WorldSave | null {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? (JSON.parse(raw) as WorldSave) : null;
  } catch { return null; }
}

export function deleteWorld(name: string) { localStorage.removeItem(PREFIX + name); }
export type { Slot };
