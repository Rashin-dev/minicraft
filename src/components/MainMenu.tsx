import { useState } from 'react';
import { listSaves, deleteWorld } from '@/game/save';
import type { WorldSave } from '@/game/save';

interface Props {
  onPlay: (name: string, seed: number, saved: WorldSave | null) => void;
}

export function MainMenu({ onPlay }: Props) {
  const [saves, setSaves] = useState<WorldSave[]>(() => listSaves());
  const [name, setName] = useState('');

  const create = () => {
    const n = name.trim() || `World ${saves.length + 1}`;
    if (saves.some((s) => s.name === n)) { alert('A world with this name already exists'); return; }
    onPlay(n, Math.floor(Math.random() * 1e9), null);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-sky-400 via-sky-500 to-emerald-700">
      {/* pixel grass strip */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-10 opacity-80"
        style={{ background: 'repeating-linear-gradient(90deg,#4e8a2e 0 16px,#5da83c 16px 32px)', boxShadow: '0 -6px 0 #6b4a2f' }} />

      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center px-4 py-10">
        <h1 className="text-center text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]"
          style={{ fontFamily: 'monospace' }}>
          MINI<span className="text-lime-300">CRAFT</span>
        </h1>
        <p className="mt-2 text-center text-sm font-medium text-white/85">
          A blocky sandbox that runs buttery smooth on any phone — even 4GB RAM.
        </p>

        <div className="mt-8 w-full rounded-2xl bg-black/30 p-5 backdrop-blur-sm">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/70">New world</h2>
          <div className="flex gap-2">
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="World name…" maxLength={20}
              className="min-w-0 flex-1 rounded-lg border-2 border-white/20 bg-white/10 px-3 py-3 text-white placeholder-white/50 outline-none focus:border-lime-300"
            />
            <button onClick={create}
              className="rounded-lg bg-lime-500 px-5 py-3 font-black text-emerald-950 shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5 active:shadow-none">
              CREATE
            </button>
          </div>
        </div>

        {saves.length > 0 && (
          <div className="mt-4 w-full rounded-2xl bg-black/30 p-5 backdrop-blur-sm">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/70">Your worlds</h2>
            {saves.map((s) => (
              <div key={s.name} className="mb-2 flex items-center gap-2">
                <button onClick={() => onPlay(s.name, s.seed, s)}
                  className="flex-1 rounded-lg bg-white/10 px-4 py-3 text-left font-bold text-white hover:bg-white/20">
                  {s.name}
                  <span className="ml-2 text-xs font-normal text-white/50">
                    {new Date(s.savedAt).toLocaleDateString()}
                  </span>
                </button>
                <button onClick={() => { if (confirm(`Delete "${s.name}"?`)) { deleteWorld(s.name); setSaves(listSaves()); } }}
                  className="rounded-lg bg-red-600/70 px-3 py-3 text-white">🗑</button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 w-full rounded-2xl bg-black/20 p-4 text-xs leading-5 text-white/75">
          <div className="mb-1 font-bold text-white/90">⛏ Everything you love — plus what vanilla doesn't have:</div>
          <div>✦ Vertical slabs ✦ Built-in minimap ✦ Waypoints + teleport ✦ Colored torch glow</div>
          <div>✦ Auto graphics scaling (zero lag) ✦ TNT chain reactions ✦ Double-tap jump to fly</div>
          <div className="mt-2 text-white/50">
            📱 Left joystick to move · drag screen to look · hold to break · tap to place<br />
            🖥 WASD + mouse · hold LMB break · RMB place · 1-9 hotbar · double Space = fly
          </div>
        </div>
      </div>
    </div>
  );
}
