// localStorage persistence (browser-local saves)
export interface WorldSave {
  name: string;
  seed: number;
  diffs: Record<string, number>;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  timeOfDay: number; // 0..1
  waypoints: { name: string; x: number; y: number; z: number; color: string }[];
  savedAt: number;
}

const PREFIX = 'minicraft_world_';

export function listSaves(): WorldSave[] {
  const out: WorldSave[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      try { out.push(JSON.parse(localStorage.getItem(k)!)); } catch { /* skip */ }
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
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function deleteWorld(name: string) { localStorage.removeItem(PREFIX + name); }
