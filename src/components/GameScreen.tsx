import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '@/game/game';
import { input } from '@/game/controls';
import { BLOCKS, B, ALL_PLACEABLE } from '@/game/blocks';
import { BlockIcon } from './HotbarIcon';
import { Joystick } from './Joystick';
import { sounds, setSoundEnabled } from '@/game/sounds';
import type { WorldSave } from '@/game/save';

interface Props {
  worldName: string;
  seed: number;
  saved: WorldSave | null;
  onExit: () => void;
}

const WP_COLORS = ['#ff4040', '#40a0ff', '#ffd040', '#40d060', '#c060ff'];

export function GameScreen({ worldName, seed, saved, onExit }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [target, setTarget] = useState<{ name: string | null; progress: number }>({ name: null, progress: 0 });
  const [stats, setStats] = useState({ fps: 60, x: 0, y: 0, z: 0 });
  const [hotbar, setHotbar] = useState<number[]>([]);
  const [slot, setSlot] = useState(0);
  const [showInv, setShowInv] = useState(false);
  const [atlas, setAtlas] = useState<HTMLCanvasElement | null>(null);
  const [quality, setQuality] = useState<'auto' | 'high' | 'medium' | 'low'>('auto');
  const [sound, setSound] = useState(true);
  const [flying, setFlying] = useState(false);
  const [time, setTime] = useState(0.3);
  const [wpVersion, setWpVersion] = useState(0);
  const [newWpName, setNewWpName] = useState('');
  const isTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0;

  useEffect(() => {
    const game = new Game(mountRef.current!, worldName, seed, {
      onToast: (m) => { setToast(m); window.setTimeout(() => setToast(null), 2200); },
      onTarget: (name, progress) => setTarget((t) => (t.name === name && Math.abs(t.progress - progress) < 0.05 ? t : { name, progress })),
      onStats: (fps, x, y, z) => setStats({ fps, x, y, z }),
      onPause: () => setPaused(true),
      onTimeChange: setTime,
    }, saved);
    gameRef.current = game;
    game.minimapCanvas = minimapRef.current;
    game.onHotbarChange = () => { setHotbar([...game.hotbar]); setSlot(game.selectedSlot); };
    setHotbar([...game.hotbar]);
    setAtlas(game.getAtlasCanvas());

    const onPlChange = () => {
      if (!document.pointerLockElement && !('ontouchstart' in window && navigator.maxTouchPoints > 0)) {
        setPaused((p) => { if (!p) { game.paused = true; game.controls.enabled = false; } return true; });
      }
    };
    document.addEventListener('pointerlockchange', onPlChange);
    return () => {
      document.removeEventListener('pointerlockchange', onPlChange);
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = gameRef.current;
    if (g) { g.paused = paused; g.controls.enabled = !paused; }
    if (!paused) { input.breakHeld = false; input.placeQueued = false; }
  }, [paused]);

  useEffect(() => { setSoundEnabled(sound); }, [sound]);

  const resume = useCallback(() => setPaused(false), []);

  const clockIcon = (t: number) => {
    // t: 0 = midnight-ish alignment from engine (0.3 ~ morning)
    const hour = Math.floor(((t + 0.25) % 1) * 24);
    return `${String(hour).padStart(2, '0')}:00`;
  };

  const game = gameRef.current;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none" style={{ touchAction: 'none' }}>
      <div ref={mountRef} className="absolute inset-0" />

      {/* underwater tint */}
      <div className="pointer-events-none absolute inset-0 bg-blue-600/30 opacity-0 transition-opacity" id="water-tint" />

      {/* crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex items-center justify-center">
          <span className="text-2xl font-light text-white/80" style={{ textShadow: '0 0 3px #000' }}>+</span>
          {target.progress > 0 && (
            <svg className="absolute h-12 w-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#4ade80" strokeWidth="3"
                strokeDasharray={`${Math.min(1, target.progress) * 94.2} 94.2`} strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>

      {/* target block name */}
      {target.name && (
        <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-black/50 px-3 py-1 text-sm text-white">
          {target.name}
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-amber-200 shadow-lg">
          {toast}
        </div>
      )}

      {/* stats */}
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-2 py-1 font-mono text-[11px] leading-4 text-green-300">
        <div>{stats.fps} FPS</div>
        <div>XYZ {stats.x} {stats.y} {stats.z}</div>
        <div>{clockIcon(time)}</div>
      </div>

      {/* minimap + pause */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
        <button
          className="pointer-events-auto rounded-lg bg-black/50 px-3 py-2 text-white"
          onClick={() => setPaused(true)}
        >☰</button>
        <canvas ref={minimapRef} width={120} height={120}
          className="pointer-events-none rounded-xl border-2 border-white/30 shadow-lg" style={{ width: 110, height: 110 }} />
      </div>

      {/* hotbar */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-end gap-1">
        {hotbar.map((id, i) => (
          <button
            key={i}
            className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-md border-2 transition-all ${slot === i ? 'border-white bg-white/25 scale-110' : 'border-white/20 bg-black/40'}`}
            onClick={() => { if (gameRef.current) { gameRef.current.selectedSlot = i; setSlot(i); sounds.click(); } }}
          >
            <BlockIcon blockId={id} atlas={atlas} size={34} />
          </button>
        ))}
        <button
          className="pointer-events-auto ml-1 flex h-12 w-12 items-center justify-center rounded-md border-2 border-dashed border-white/40 bg-black/40 text-xl text-white"
          onClick={() => setShowInv(true)}
        >+</button>
      </div>

      {/* touch controls */}
      {isTouch && !paused && (
        <>
          <div className="absolute bottom-24 left-4"><Joystick /></div>
          <div className="absolute bottom-24 right-4 flex flex-col items-end gap-3">
            <button
              className={`pointer-events-auto h-14 w-14 rounded-full border-2 text-2xl ${flying ? 'border-sky-300 bg-sky-400/40' : 'border-white/30 bg-black/40'} text-white`}
              onTouchStart={(e) => { e.stopPropagation(); if (gameRef.current) { gameRef.current.flying = !gameRef.current.flying; setFlying(gameRef.current.flying); } }}
            >🕊</button>
            <button
              className="pointer-events-auto h-16 w-16 rounded-full border-2 border-white/40 bg-black/40 text-2xl text-white active:bg-white/30"
              onTouchStart={(e) => { e.stopPropagation(); input.jump = true; }}
              onTouchEnd={(e) => { e.stopPropagation(); input.jump = false; }}
            >⬆</button>
            <button
              className="pointer-events-auto h-14 w-14 rounded-full border-2 border-white/30 bg-black/40 text-xl text-white active:bg-white/30"
              onTouchStart={(e) => { e.stopPropagation(); input.placeQueued = true; }}
            >🧱</button>
          </div>
        </>
      )}

      {/* inventory picker */}
      {showInv && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowInv(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-zinc-900/95 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-center text-lg font-bold text-white">Choose block for slot {slot + 1}</h3>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {ALL_PLACEABLE.map((id) => (
                <button key={id}
                  className="flex flex-col items-center gap-1 rounded-lg bg-white/5 p-2 hover:bg-white/15"
                  onClick={() => {
                    if (gameRef.current) {
                      gameRef.current.hotbar[slot] = id;
                      setHotbar([...gameRef.current.hotbar]);
                    }
                    setShowInv(false); sounds.click();
                  }}>
                  <BlockIcon blockId={id} atlas={atlas} size={36} />
                  <span className="text-center text-[10px] leading-3 text-white/80">{BLOCKS[id]?.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* pause menu */}
      {paused && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-zinc-900 p-6 shadow-2xl">
            <h2 className="mb-1 text-center text-2xl font-black tracking-wide text-white">MiniCraft</h2>
            <p className="mb-4 text-center text-sm text-white/50">{worldName} — paused</p>

            <button className="mb-2 w-full rounded-lg bg-green-600 py-3 font-bold text-white" onClick={resume}>▶ Resume</button>

            <div className="mb-3 rounded-lg bg-white/5 p-3">
              <div className="mb-1 text-xs font-bold uppercase text-white/50">Graphics quality</div>
              <div className="flex gap-1">
                {(['auto', 'high', 'medium', 'low'] as const).map((q) => (
                  <button key={q}
                    className={`flex-1 rounded py-1.5 text-sm capitalize ${quality === q ? 'bg-green-600 text-white' : 'bg-white/10 text-white/70'}`}
                    onClick={() => { setQuality(q); gameRef.current?.setQuality(q); }}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-white/40">Auto lowers render distance if FPS drops — keeps zero lag on any phone.</div>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-lg bg-white/5 p-3">
              <span className="text-sm text-white">Sound</span>
              <button className={`rounded px-3 py-1 text-sm ${sound ? 'bg-green-600 text-white' : 'bg-white/10 text-white/60'}`}
                onClick={() => setSound(!sound)}>{sound ? 'On' : 'Off'}</button>
            </div>

            {/* waypoints */}
            <div className="mb-3 rounded-lg bg-white/5 p-3">
              <div className="mb-2 text-xs font-bold uppercase text-white/50">Waypoints (MiniCraft exclusive)</div>
              <div className="mb-2 flex gap-1">
                <input value={newWpName} onChange={(e) => setNewWpName(e.target.value)}
                  placeholder="Waypoint name…" maxLength={16}
                  className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1.5 text-sm text-white outline-none" />
                <button className="rounded bg-amber-600 px-3 text-sm font-bold text-white"
                  onClick={() => {
                    if (!newWpName.trim() || !gameRef.current) return;
                    gameRef.current.addWaypoint(newWpName.trim(), WP_COLORS[(gameRef.current.waypoints.length) % WP_COLORS.length]);
                    setNewWpName(''); setWpVersion((v) => v + 1); sounds.pop();
                  }}>+</button>
              </div>
              {(game?.waypoints ?? []).map((w, i) => (
                <div key={i} className="mb-1 flex items-center gap-2 rounded bg-black/30 px-2 py-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: w.color }} />
                  <span className="flex-1 truncate text-sm text-white">{w.name}</span>
                  <span className="text-[10px] text-white/40">{w.x}, {w.z}</span>
                  <button className="rounded bg-sky-600 px-2 py-0.5 text-xs text-white"
                    onClick={() => { gameRef.current?.teleport(w.x, w.y, w.z); setPaused(false); }}>Go</button>
                  <button className="rounded bg-red-700 px-2 py-0.5 text-xs text-white"
                    onClick={() => { gameRef.current?.removeWaypoint(i); setWpVersion((v) => v + 1); }}>✕</button>
                </div>
              ))}
              {wpVersion >= 0 && (game?.waypoints.length ?? 0) === 0 && (
                <div className="text-[11px] text-white/30">Mark your base, mines, village… then teleport. Vanilla Minecraft doesn't have this!</div>
              )}
            </div>

            <button className="w-full rounded-lg bg-red-700 py-3 font-bold text-white"
              onClick={() => { gameRef.current?.save(); onExit(); }}>Save & Quit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export { B };
