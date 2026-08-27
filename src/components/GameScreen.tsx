import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '@/game/game';
import { input } from '@/game/controls';
import { itemName, itemDef } from '@/game/blocks';
import { CREATIVE_BLOCKS, CREATIVE_ITEMS } from '@/game/blocks';
import { BlockIcon } from './HotbarIcon';
import { Joystick } from './Joystick';
import { sounds, setSoundEnabled, setMusicEnabled } from '@/game/sounds';
import type { WorldSave } from '@/game/save';

interface Props {
  worldName: string;
  seed: number;
  mode: 'creative' | 'survival';
  saved: WorldSave | null;
  onExit: () => void;
}

const WP_COLORS = ['#ff4040', '#40a0ff', '#ffd040', '#40d060', '#c060ff'];

interface ChatLine { text: string; kind: 'system' | 'player' | 'ai'; id: number }
interface InvPick { from: number; id: number }

export function GameScreen({ worldName, seed, mode, saved, onExit }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [target, setTarget] = useState<{ name: string | null; progress: number }>({ name: null, progress: 0 });
  const [stats, setStats] = useState({ fps: 60, x: 0, y: 0, z: 0, biome: 'plains' });
  const [hotbar, setHotbar] = useState<number[]>([]);
  const [slot, setSlot] = useState(0);
  const [showInv, setShowInv] = useState(false);
  const [invTab, setInvTab] = useState<'blocks' | 'items' | 'craft' | 'inventory'>('blocks');
  const [atlas, setAtlas] = useState<HTMLCanvasElement | null>(null);
  const [quality, setQuality] = useState<'auto' | 'high' | 'medium' | 'low'>('auto');
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [flying, setFlying] = useState(false);
  const [time, setTime] = useState(0.3);
  const [dayFactor, setDayFactor] = useState(1);
  const [wpVersion, setWpVersion] = useState(0);
  const [newWpName, setNewWpName] = useState('');
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [air, setAir] = useState(10);
  const [dead, setDead] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState('');
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [gameMode, setGameMode] = useState<'creative' | 'survival'>(mode);
  const [buildProgress, setBuildProgress] = useState<{ name: string; pct: number } | null>(null);
  const [invVersion, setInvVersion] = useState(0);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiEnabled, setAiEnabled] = useState(saved?.aiSettings?.enabled ?? false);
  const [aiEndpoint, setAiEndpoint] = useState(saved?.aiSettings?.endpoint ?? 'https://api.openai.com/v1/chat/completions');
  const [aiKey, setAiKey] = useState(saved?.aiSettings?.apiKey ?? '');
  const [aiModel, setAiModel] = useState(saved?.aiSettings?.model ?? 'gpt-4o-mini');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpConnected, setMcpConnected] = useState(false);
  const [aiTab, setAiTab] = useState<'presets' | 'connect'>('presets');
  const [invPick, setInvPick] = useState<InvPick | null>(null);
  const [container, setContainer] = useState<{ type: 'chest' | 'furnace'; key: string } | null>(null);
  const [cursor, setCursor] = useState<{ id: number; count: number } | null>(null);
  const [bowCharge, setBowCharge] = useState(0);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [canTrade, setCanTrade] = useState(false);
  const [sneaking, setSneaking] = useState(false);
  const isTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
  const chatIdRef = useRef(0);

  const addChat = useCallback((text: string, kind: ChatLine['kind']) => {
    setChatLines((lines) => [...lines.slice(-6), { text, kind, id: chatIdRef.current++ }]);
    window.setTimeout(() => setChatLines((lines) => lines.filter((l) => l.text !== text || l.kind !== kind)), 9000);
  }, []);

  useEffect(() => {
    const game = new Game(mountRef.current!, worldName, seed, {
      onToast: (m) => { setToast(m); window.setTimeout(() => setToast(null), 2400); },
      onTarget: (name, progress) => setTarget((t) => (t.name === name && Math.abs(t.progress - progress) < 0.05 ? t : { name, progress })),
      onStats: (fps, x, y, z, biome) => setStats({ fps, x, y, z, biome }),
      onPause: () => setPaused(true),
      onTimeChange: (t, d) => { setTime(t); setDayFactor(d); },
      onChat: (msg, kind) => addChat(msg, kind),
      onChatOpen: (prefill) => { setChatPrefill(prefill); setChatOpen(true); window.setTimeout(() => chatInputRef.current?.focus(), 30); },
      onHealth: (hp, hu, air2) => { setHealth(hp); setHunger(hu); setAir(air2); },
      onBow: (c) => setBowCharge(c),
      onContainer: (c) => setContainer(c),
      onDeath: () => setDead(true),
      onModeChange: (m) => setGameMode(m),
      onInventory: () => setShowInv((v) => !v),
      onSleep: () => setSleeping(true),
      onLoading: (p) => { setLoading(p); if (p >= 1) setReady(true); },
      onBuildProgress: (name, done, total) => setBuildProgress({ name, pct: total ? done / total : 1 }),
    }, saved, mode);
    gameRef.current = game;
    game.minimapCanvas = minimapRef.current;
    game.onHotbarChange = () => {
      setHotbar(game.mode === 'creative' ? [...game.hotbar] : game.inventory.slots.map((s) => s?.id ?? 0));
      setSlot(game.selectedSlot);
      setInvVersion((v) => v + 1);
      setFlying(game.flying);
    };
    setHotbar(game.mode === 'creative' ? [...game.hotbar] : game.inventory.slots.map((s) => s?.id ?? 0));
    setAtlas(game.getAtlasCanvas());
    window.setTimeout(() => setSleeping(false), 2000);

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
    if (g) { g.paused = paused || chatOpen || showInv || dead; g.controls.enabled = !paused && !chatOpen && !showInv && !dead; g.controls.uiOpen = chatOpen || showInv; }
    if (!paused) { input.breakHeld = false; input.placeQueued = false; }
  }, [paused, chatOpen, showInv, dead]);

  useEffect(() => { setSoundEnabled(sound); }, [sound]);
  useEffect(() => { setMusicEnabled(music); }, [music]);

  useEffect(() => {
    if (sleeping) { const t = window.setTimeout(() => setSleeping(false), 2200); return () => window.clearTimeout(t); }
  }, [sleeping]);

  const resume = useCallback(() => setPaused(false), []);

  // poller for villager trading proximity
  useEffect(() => {
    if (gameMode !== 'survival' || !ready || tradeOpen) return;
    const t = window.setInterval(() => setCanTrade(!!gameRef.current?.nearestVillager()), 600);
    return () => window.clearInterval(t);
  }, [gameMode, ready, tradeOpen]);

  const closeContainer = () => { gameRef.current?.closeContainer(); setContainer(null); setCursor(null); };
  const chestClick = (slot: number) => {
    const g = gameRef.current; if (!g || !container) return;
    const arr = g.openChestSlots(); if (!arr) return;
    const cur = arr[slot];
    if (cursor) { arr[slot] = { id: cursor.id, count: cursor.count }; setCursor(cur ? { id: cur.id, count: cur.count } : null); }
    else if (cur) { setCursor({ id: cur.id, count: cur.count }); arr[slot] = null; }
    g.inventory.onChange();
  };
  const furnaceClick = (which: 'input' | 'fuel' | 'output') => {
    const g = gameRef.current; if (!g || !container) return;
    const st = g.openFurnaceState(); if (!st) return;
    if (which === 'output') { if (st.output) { g.inventory.add(st.output.id, st.output.count); st.output = null; g.inventory.onChange(); } return; }
    const cur = st[which];
    if (cursor) { st[which] = { id: cursor.id, count: cursor.count }; setCursor(cur ? { id: cur.id, count: cur.count } : null); }
    else if (cur) { setCursor({ id: cur.id, count: cur.count }); st[which] = null; }
    g.inventory.onChange();
  };
  const armorClick = (aSlot: number) => {
    const g = gameRef.current; if (!g) return;
    const inv = g.inventory; const worn = inv.armor[aSlot];
    if (cursor) { const d = itemDef(cursor.id); if (d && d.armor && d.armor.slot === aSlot) { inv.armor[aSlot] = { id: cursor.id, count: 1 }; setCursor(worn ? { id: worn.id, count: 1 } : null); inv.onChange(); } return; }
    if (worn) { if (inv.add(worn.id, 1)) { inv.armor[aSlot] = null; inv.onChange(); } }
  };
  const backpackClick = (i: number) => {
    const g = gameRef.current; if (!g) return;
    const inv = g.inventory; const s = inv.slots[i];
    if (cursor) { const prev = inv.slots[i]; inv.slots[i] = { id: cursor.id, count: cursor.count }; setCursor(prev ? { id: prev.id, count: prev.count } : null); inv.onChange(); return; }
    if (!s) return;
    const d = itemDef(s.id);
    if (d && d.armor) { inv.armor[d.armor.slot] = { id: s.id, count: 1 }; inv.slots[i] = null; inv.onChange(); return; }
    setInvPick({ from: i, id: s.id });
  };

  const sendChat = useCallback(() => {
    const text = chatInputRef.current?.value.trim();
    if (text && gameRef.current) {
      if (!text.startsWith('/')) addChat(`You: ${text}`, 'player');
      gameRef.current.execCommand(text);
    }
    setChatOpen(false);
    if (chatInputRef.current) chatInputRef.current.value = '';
  }, [addChat]);

  const clockStr = (t: number) => {
    const hour = Math.floor(((t + 0.25) % 1) * 24);
    return `${String(hour).padStart(2, '0')}:00`;
  };
  const game = gameRef.current;
  const survival = gameMode === 'survival';

  const Heart = ({ fill }: { fill: number }) => (
    <span className="relative inline-block h-[14px] w-[14px]">
      <svg viewBox="0 0 16 16" className="absolute inset-0 h-full w-full">
        <path d="M8 14 L2 8 Q0 6 0 4 Q0 1 3 1 Q6 1 8 4 Q10 1 13 1 Q16 1 16 4 Q16 6 14 8 Z" fill="#3a0c0c" />
        {fill > 0 && (
          <clipPath id={`hc${fill}`}><rect x="0" y="0" width={fill >= 1 ? 16 : 8} height="16" /></clipPath>
        )}
        {fill > 0 && (
          <path d="M8 14 L2 8 Q0 6 0 4 Q0 1 3 1 Q6 1 8 4 Q10 1 13 1 Q16 1 16 4 Q16 6 14 8 Z" fill="#e8302a" clipPath={`url(#hc${fill})`} />
        )}
      </svg>
    </span>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none" style={{ touchAction: 'none' }}>
      <div ref={mountRef} className="absolute inset-0" />

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

      {target.name && (
        <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-black/50 px-3 py-1 text-sm text-white">
          {target.name}
        </div>
      )}

      {bowCharge > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[62%] -translate-x-1/2">
          <div className="h-1.5 w-28 overflow-hidden rounded bg-black/50">
            <div className="h-full bg-amber-400" style={{ width: `${bowCharge * 100}%` }} />
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-amber-200 shadow-lg">
          {toast}
        </div>
      )}

      {buildProgress && buildProgress.pct < 1 && (
        <div className="pointer-events-none absolute left-1/2 top-24 w-64 -translate-x-1/2 rounded-lg bg-black/60 p-2 text-center text-xs text-fuchsia-200">
          🏗 {buildProgress.name} — {Math.round(buildProgress.pct * 100)}%
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/20">
            <div className="h-full bg-fuchsia-400 transition-all" style={{ width: `${buildProgress.pct * 100}%` }} />
          </div>
        </div>
      )}

      {/* stats */}
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-2 py-1 font-mono text-[11px] leading-4 text-green-300">
        <div>{stats.fps} FPS · {gameMode}{flying ? ' · ✈' : ''}</div>
        <div>XYZ {stats.x} {stats.y} {stats.z}</div>
        <div>{clockStr(time)} · {stats.biome} {dayFactor > 0.5 ? '☀' : dayFactor > 0.15 ? '🌅' : '🌙'}</div>
        {game?.debugVerbose && <div className="text-white/50">seed {seed}</div>}
      </div>

      {/* minimap + menu */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
        <div className="flex gap-1">
          <button className="pointer-events-auto rounded-lg bg-black/50 px-2.5 py-2 text-white" title="Chat"
            onClick={() => { setChatOpen(true); window.setTimeout(() => chatInputRef.current?.focus(), 30); }}>💬</button>
          <button className="pointer-events-auto rounded-lg bg-black/50 px-2.5 py-2 text-white" title="Inventory"
            onClick={() => setShowInv(true)}>▦</button>
          <button className="pointer-events-auto rounded-lg bg-black/50 px-3 py-2 text-white"
            onClick={() => setPaused(true)}>☰</button>
        </div>
        <canvas ref={minimapRef} width={120} height={120}
          className="pointer-events-none rounded-xl border-2 border-white/30 shadow-lg" style={{ width: 110, height: 110 }} />
        <div className="pointer-events-none rounded bg-black/30 px-1 text-center text-[10px] text-white/70">N↑</div>
      </div>

      {/* chat log */}
      <div className="pointer-events-none absolute bottom-28 left-2 max-w-[70vw] space-y-0.5 sm:bottom-24">
        {chatLines.map((l) => (
          <div key={l.id} className={`w-fit rounded bg-black/45 px-2 py-0.5 text-xs ${
            l.kind === 'ai' ? 'text-fuchsia-200' : l.kind === 'player' ? 'text-white' : 'text-emerald-200'}`}>
            {l.text}
          </div>
        ))}
      </div>

      {/* chat input */}
      {chatOpen && (
        <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-4">
          <input
            ref={chatInputRef}
            defaultValue={chatPrefill}
            placeholder="Message or /command — try: build a big palace"
            className="w-full max-w-xl rounded-lg border border-white/30 bg-black/75 px-3 py-2 text-sm text-white outline-none"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') sendChat();
              if (e.key === 'Escape') setChatOpen(false);
            }}
          />
        </div>
      )}

      {/* health / hunger / air */}
      {survival && !dead && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 flex w-full max-w-md -translate-x-1/2 justify-between px-6 sm:bottom-14">
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => <Heart key={i} fill={Math.max(0, Math.min(1, health / 2 - i))} />)}
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`inline-block h-[14px] w-[14px] rounded-sm border ${hunger / 2 - i >= 1 ? 'border-amber-900 bg-amber-600' : hunger / 2 - i > 0 ? 'border-amber-900 bg-amber-800' : 'border-stone-700 bg-stone-900'}`} />
            ))}
          </div>
        </div>
      )}
      {survival && air < 10 && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-1">
          {Array.from({ length: air }, (_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-sky-300" />)}
        </div>
      )}

      {/* hotbar */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-end gap-1">
        {hotbar.map((id, i) => {
          const count = survival ? game?.inventory.slots[i]?.count ?? 0 : 0;
          return (
            <button
              key={`${i}-${invVersion}`}
              className={`pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-md border-2 transition-all ${slot === i ? 'scale-110 border-white bg-white/25' : 'border-white/20 bg-black/40'}`}
              onClick={() => { if (gameRef.current) { gameRef.current.selectHotbar(i); setSlot(i); sounds.click(); } }}
            >
              <BlockIcon blockId={id} atlas={atlas} size={34} />
              {survival && count > 1 && (
                <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-white" style={{ textShadow: '1px 1px 0 #000' }}>{count}</span>
              )}
            </button>
          );
        })}
        <button
          className="pointer-events-auto ml-1 flex h-12 w-12 items-center justify-center rounded-md border-2 border-dashed border-white/40 bg-black/40 text-xl text-white"
          onClick={() => setShowInv(true)}
        >+</button>
      </div>

      {/* touch controls */}
      {isTouch && !paused && !chatOpen && !showInv && (
        <>
          <div className="absolute bottom-24 left-4"><Joystick /></div>
          <div className="absolute bottom-24 right-4 flex flex-col items-end gap-3">
            <button
              className={`pointer-events-auto h-12 w-12 rounded-full border-2 text-lg ${flying ? 'border-sky-300 bg-sky-400/40' : 'border-white/30 bg-black/40'} text-white`}
              onTouchStart={(e) => { e.stopPropagation(); if (gameRef.current) { gameRef.current.toggleFly(); setFlying(gameRef.current.flying); } }}
            >🕊</button>
            <button
              className={`pointer-events-auto h-12 w-12 rounded-full border-2 text-lg ${sneaking ? 'border-white bg-white/30' : 'border-white/30 bg-black/40'} text-white`}
              onTouchStart={(e) => { e.stopPropagation(); }}
              onClick={(e) => { e.stopPropagation(); input.sneak = !sneaking; setSneaking(!sneaking); }}
            >🤫</button>
            <button
              className="pointer-events-auto h-12 w-12 rounded-full border-2 border-white/30 bg-black/40 text-lg text-white"
              onClick={(e) => { e.stopPropagation(); input.togglePerspective = true; }}
            >👁</button>
            <button
              className="pointer-events-auto h-12 w-12 rounded-full border-2 border-white/30 bg-black/40 text-lg text-white"
              onClick={(e) => { e.stopPropagation(); input.dropItem = true; }}
            >⬇</button>
            <button
              className="pointer-events-auto h-16 w-16 rounded-full border-2 border-white/40 bg-black/40 text-2xl text-white active:bg-white/30"
              onTouchStart={(e) => { e.stopPropagation(); input.jump = true; }}
              onTouchEnd={(e) => { e.stopPropagation(); input.jump = false; }}
            >⬆</button>
            <button
              className="pointer-events-auto h-14 w-14 rounded-full border-2 border-white/30 bg-black/40 text-xl text-white active:bg-white/30"
              onTouchStart={(e) => { e.stopPropagation(); input.placeQueued = true; }}
            >🧱</button>
            <button
              className="pointer-events-auto h-14 w-14 rounded-full border-2 border-amber-400/60 bg-black/40 text-xl text-white active:bg-amber-400/30"
              onTouchStart={(e) => { e.stopPropagation(); input.placeHeld = true; }}
              onTouchEnd={(e) => { e.stopPropagation(); input.placeHeld = false; }}
            >🏹</button>
          </div>
          {canTrade && (
            <button className="pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border-2 border-emerald-300 bg-emerald-900/60 px-4 py-2 text-sm text-white"
              onClick={() => setTradeOpen(true)}>🧑‍🌾 Trade</button>
          )}
        </>
      )}

      {/* loading */}
      {!ready && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-sky-800 to-emerald-900">
          <div className="text-4xl font-black tracking-widest text-white" style={{ fontFamily: 'monospace' }}>MINI<span className="text-lime-300">CRAFT</span></div>
          <div className="mt-6 h-3 w-64 overflow-hidden rounded-full bg-black/40">
            <div className="h-full bg-gradient-to-r from-lime-400 to-emerald-300 transition-all" style={{ width: `${Math.round(loading * 100)}%` }} />
          </div>
          <div className="mt-2 text-xs text-white/70">Shaping mountains, carving caves, planting cherry groves…</div>
        </div>
      )}

      {/* sleep fade */}
      {sleeping && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/90">
          <div className="animate-pulse text-lg text-white/80">Sweet dreams… 💤</div>
        </div>
      )}

      {/* death screen */}
      {dead && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-red-950/80">
          <div className="text-5xl font-black text-red-300">You died!</div>
          <button className="mt-6 rounded-lg bg-green-600 px-8 py-3 font-bold text-white"
            onClick={() => { gameRef.current?.respawn(); setDead(false); }}>Respawn</button>
          <button className="mt-2 text-sm text-white/60 underline" onClick={onExit}>Save & quit</button>
        </div>
      )}

      {/* inventory */}
      {showInv && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowInv(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-zinc-900/95 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex gap-1">
              {(!survival ? (['blocks', 'items'] as const) : (['inventory', 'craft'] as const)).map((t) => (
                <button key={t} className={`flex-1 rounded-lg py-2 text-sm capitalize ${invTab === t ? 'bg-green-600 text-white' : 'bg-white/10 text-white/70'}`}
                  onClick={() => setInvTab(t)}>{t}</button>
              ))}
              {!survival && <button className={`flex-1 rounded-lg py-2 text-sm capitalize ${invTab === 'craft' ? 'bg-green-600 text-white' : 'bg-white/10 text-white/70'}`} onClick={() => setInvTab('craft')}>craft</button>}
            </div>

            {(!survival && (invTab === 'blocks' || invTab === 'items')) && (
              <>
                <h3 className="mb-2 text-center text-sm text-white/70">Tap to put in slot {slot + 1}</h3>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {(invTab === 'blocks' ? CREATIVE_BLOCKS : CREATIVE_ITEMS).map((id) => (
                    <button key={id}
                      className="flex flex-col items-center gap-1 rounded-lg bg-white/5 p-2 hover:bg-white/15"
                      onClick={() => {
                        if (gameRef.current) {
                          gameRef.current.hotbar[slot] = id;
                          gameRef.current.onHotbarChange();
                        }
                        sounds.click();
                      }}>
                      <BlockIcon blockId={id} atlas={atlas} size={36} />
                      <span className="text-center text-[9px] leading-3 text-white/80">{itemName(id)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {survival && invTab === 'inventory' && (
              <>
                <h3 className="mb-2 text-center text-sm text-white/70">Inventory — tap to move</h3>
                {/* armor */}
                <div className="mb-2 flex justify-center gap-2">
                  {[3, 2, 1, 0].map((a) => {
                    const worn = game?.inventory.armor[a] ?? null;
                    const labels = ['Boots', 'Legs', 'Chest', 'Helm'];
                    return (
                      <button key={a} title={labels[a]}
                        className={`flex h-10 w-10 items-center justify-center rounded border ${worn ? 'border-amber-300 bg-white/10' : 'border-white/10 bg-black/30'}`}
                        onClick={() => { armorClick(a); sounds.click(); }}>
                        {worn && <BlockIcon blockId={worn.id} atlas={atlas} size={26} />}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-9 gap-1" key={invVersion}>
                  {game?.inventory.slots.slice(9).map((s, i) => (
                    <button key={i} className={`flex h-10 w-10 items-center justify-center rounded border ${s ? 'border-white/30 bg-white/10' : 'border-white/10 bg-black/30'}`}
                      onClick={() => { backpackClick(i + 9); sounds.click(); }}>
                      {s && <BlockIcon blockId={s.id} atlas={atlas} size={30} />}
                    </button>
                  ))}
                </div>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="mb-1 text-xs text-white/50">Hotbar</div>
                  <div className="grid grid-cols-9 gap-1" key={`hb-${invVersion}`}>
                    {game?.inventory.slots.slice(0, 9).map((s, i) => (
                      <button key={i} className={`flex h-10 w-10 items-center justify-center rounded border ${invPick && i === slot ? 'border-amber-300' : 'border-white/20'} bg-black/40`}
                        onClick={() => {
                          const g = gameRef.current;
                          if (!g) return;
                          if (invPick) {
                            const tmp = g.inventory.slots[i];
                            g.inventory.slots[i] = g.inventory.slots[invPick.from];
                            g.inventory.slots[invPick.from] = tmp;
                            setInvPick(null);
                            g.inventory.onChange();
                          } else { g.selectedSlot = i; setSlot(i); }
                          sounds.click();
                        }}>
                        {s && <BlockIcon blockId={s.id} atlas={atlas} size={30} />}
                      </button>
                    ))}
                  </div>
                  {invPick && <div className="mt-2 text-center text-xs text-amber-200">Selected {itemName(invPick.id)} — tap a hotbar slot to swap</div>}
                </div>
              </>
            )}

            {survival && invTab === 'craft' && (
              <div className="space-y-1.5" key={`craft-${invVersion}`}>
                {game?.recipes.map((r, i) => {
                  const can = r.needs.every(([id, n]) => (game?.inventory.count(id) ?? 0) >= n);
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                      <BlockIcon blockId={r.out} atlas={atlas} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs text-white">{r.outCount > 1 ? `${r.outCount}× ` : ''}{itemName(r.out)}</div>
                        <div className="truncate text-[10px] text-white/50">
                          {r.needs.map(([id, n]) => `${n}× ${itemName(id)}`).join(' + ')}
                        </div>
                      </div>
                      <button disabled={!can}
                        className={`rounded px-3 py-1 text-xs font-bold ${can ? 'bg-green-600 text-white' : 'bg-white/10 text-white/30'}`}
                        onClick={() => {
                          const g = gameRef.current;
                          if (!g) return;
                          for (const [id, n] of r.needs) g.inventory.remove(id, n);
                          g.inventory.add(r.out, r.outCount);
                          sounds.craft();
                        }}>Craft</button>
                    </div>
                  );
                })}
              </div>
            )}

            <button className="mt-3 w-full rounded-lg bg-white/10 py-2 text-sm text-white" onClick={() => setShowInv(false)}>Close</button>
          </div>
        </div>
      )}

      {/* chest / furnace */}
      {container && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={closeContainer}>
          <div className="rounded-2xl bg-zinc-900/95 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-white">{container.type === 'chest' ? 'Chest' : 'Furnace'}</div>
            </div>
            {container.type === 'chest' ? (
              <div className="grid grid-cols-9 gap-1">
                {(game?.openChestSlots() ?? []).map((s, i) => (
                  <button key={i} className={`relative flex h-10 w-10 items-center justify-center rounded border ${s ? 'border-white/30 bg-white/10' : 'border-white/10 bg-black/30'}`}
                    onClick={() => chestClick(i)}>
                    {s && <BlockIcon blockId={s.id} atlas={atlas} size={30} />}
                    {s && s.count > 1 && <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-white" style={{ textShadow: '1px 1px 0 #000' }}>{s.count}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <button className={`flex h-12 w-12 items-center justify-center rounded border ${game?.openFurnaceState()?.input ? 'border-white/30 bg-white/10' : 'border-white/10 bg-black/30'}`} onClick={() => furnaceClick('input')}>
                      {game?.openFurnaceState()?.input && <BlockIcon blockId={game.openFurnaceState()!.input!.id} atlas={atlas} size={34} />}
                    </button>
                    <span className="text-[10px] text-white/50">In</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-2 overflow-hidden rounded bg-black/40">
                      <div className="w-full bg-orange-400" style={{ height: `${Math.min(1, (game?.openFurnaceState()?.progress ?? 0) / 10) * 100}%` }} />
                    </div>
                    <span className="mt-1 text-lg">→</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button className={`flex h-12 w-12 items-center justify-center rounded border ${game?.openFurnaceState()?.output ? 'border-white/30 bg-white/10' : 'border-white/10 bg-black/30'}`} onClick={() => furnaceClick('output')}>
                      {game?.openFurnaceState()?.output && <BlockIcon blockId={game.openFurnaceState()!.output!.id} atlas={atlas} size={34} />}
                    </button>
                    <span className="text-[10px] text-white/50">Out</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={`flex h-12 w-12 items-center justify-center rounded border ${game?.openFurnaceState()?.fuel ? 'border-white/30 bg-white/10' : 'border-white/10 bg-black/30'}`} onClick={() => furnaceClick('fuel')}>
                    {game?.openFurnaceState()?.fuel && <BlockIcon blockId={game.openFurnaceState()!.fuel!.id} atlas={atlas} size={34} />}
                  </button>
                  <span className="text-[10px] text-white/50">Fuel</span>
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-white/60">Held: {cursor ? `${cursor.count}× ${itemName(cursor.id)}` : '—'}</div>
              <button className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white" onClick={closeContainer}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* villager trade */}
      {tradeOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setTradeOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-zinc-900/95 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-bold text-white">🧑‍🌾 Villager Trades</div>
            {game?.nearestVillager()?.trades.map((t, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                <BlockIcon blockId={t.inId} atlas={atlas} size={28} />
                <span className="text-xs text-white">{t.inCount}×</span>
                <span className="text-white/40">→</span>
                <BlockIcon blockId={t.outId} atlas={atlas} size={28} />
                <span className="text-xs text-white">{t.outCount}×</span>
                <span className="ml-auto text-[10px] text-white/40">{t.done}/12</span>
                <button className="rounded bg-green-600 px-2 py-1 text-xs font-bold text-white"
                  onClick={() => { gameRef.current?.buyTrade(i); sounds.pop(); }}>Trade</button>
              </div>
            ))}
            <button className="mt-2 w-full rounded-lg bg-white/10 py-2 text-sm text-white" onClick={() => setTradeOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* pause menu */}
      {paused && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-zinc-900 p-6 shadow-2xl">
            <h2 className="mb-1 text-center text-2xl font-black tracking-wide text-white">MiniCraft</h2>
            <p className="mb-4 text-center text-sm text-white/50">{worldName} — paused</p>

            <button className="mb-2 w-full rounded-lg bg-green-600 py-3 font-bold text-white" onClick={resume}>▶ Resume</button>

            <div className="mb-3 flex gap-2">
              <button className={`flex-1 rounded-lg py-2 text-sm ${gameMode === 'creative' ? 'bg-sky-600 text-white' : 'bg-white/10 text-white/60'}`}
                onClick={() => gameRef.current?.setMode('creative')}>🎨 Creative</button>
              <button className={`flex-1 rounded-lg py-2 text-sm ${gameMode === 'survival' ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/60'}`}
                onClick={() => gameRef.current?.setMode('survival')}>⚔ Survival</button>
            </div>

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
              <div className="mt-1 text-[10px] text-white/40">Auto: godrays, bloom, resolution & render distance adapt to your device — zero lag on any phone.</div>
            </div>

            <div className="mb-3 flex gap-2">
              <button className={`flex-1 rounded-lg p-2 text-sm ${sound ? 'bg-green-600 text-white' : 'bg-white/10 text-white/60'}`}
                onClick={() => setSound(!sound)}>🔊 Sound {sound ? 'on' : 'off'}</button>
              <button className={`flex-1 rounded-lg p-2 text-sm ${music ? 'bg-green-600 text-white' : 'bg-white/10 text-white/60'}`}
                onClick={() => setMusic(!music)}>🎵 Music {music ? 'on' : 'off'}</button>
            </div>

            {/* AI Architect */}
            <div className="mb-3 rounded-lg bg-gradient-to-br from-fuchsia-950/60 to-zinc-900 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-fuchsia-300">✨ AI Architect</span>
                <button className="text-[10px] text-white/40 underline" onClick={() => setAiTab(aiTab === 'presets' ? 'connect' : 'presets')}>
                  {aiTab === 'presets' ? 'connect AI →' : '← presets'}
                </button>
              </div>
              {aiTab === 'presets' ? (
                <>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {['build a big palace', 'build a castle', 'build a small house', 'build a glass dome', 'build a cherry garden', 'build a maze', 'grow a spruce forest', 'build a statue'].map((p) => (
                      <button key={p} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-fuchsia-600/60"
                        onClick={() => { gameRef.current?.execCommand(p); resume(); }}>{p.replace('build a ', '').replace('grow a ', '🌱 ')}</button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe it: huge glass castle by the water…"
                      className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1.5 text-sm text-white outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && aiPrompt.trim()) {
                          gameRef.current?.execCommand(aiPrompt.trim());
                          setAiPrompt(''); resume();
                        }
                      }} />
                    <button className="rounded bg-fuchsia-600 px-3 text-sm font-bold text-white"
                      onClick={() => { if (aiPrompt.trim()) { gameRef.current?.execCommand(aiPrompt.trim()); setAiPrompt(''); resume(); } }}>Build</button>
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between text-white/80">
                    Use remote AI (any OpenAI-compatible API)
                    <input type="checkbox" checked={aiEnabled} onChange={(e) => {
                      setAiEnabled(e.target.checked);
                      if (gameRef.current) { gameRef.current.aiSettings.enabled = e.target.checked; gameRef.current.save(); }
                    }} className="accent-fuchsia-500" />
                  </label>
                  <input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} placeholder="https://…/v1/chat/completions"
                    onBlur={() => { if (gameRef.current) { gameRef.current.aiSettings.endpoint = aiEndpoint; gameRef.current.save(); } }}
                    className="w-full rounded bg-black/40 px-2 py-1.5 text-white outline-none" />
                  <div className="flex gap-1">
                    <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="model"
                      onBlur={() => { if (gameRef.current) { gameRef.current.aiSettings.model = aiModel; gameRef.current.save(); } }}
                      className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1.5 text-white outline-none" />
                    <input value={aiKey} type="password" onChange={(e) => setAiKey(e.target.value)} placeholder="API key"
                      onBlur={() => { if (gameRef.current) { gameRef.current.aiSettings.apiKey = aiKey; gameRef.current.save(); } }}
                      className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1.5 text-white outline-none" />
                  </div>
                  <div className="border-t border-white/10 pt-2">
                    <div className="mb-1 font-bold text-white/70">MCP bridge (WebSocket JSON-RPC)</div>
                    <div className="flex gap-1">
                      <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="ws://localhost:8787"
                        className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1.5 text-white outline-none" />
                      <button className={`rounded px-3 py-1.5 font-bold ${mcpConnected ? 'bg-red-700 text-white' : 'bg-sky-600 text-white'}`}
                        onClick={() => {
                          const g = gameRef.current;
                          if (!g) return;
                          if (mcpConnected) { g.disconnectMCP(); setMcpConnected(false); }
                          else { g.connectMCP(mcpUrl); setMcpConnected(true); }
                        }}>{mcpConnected ? 'Stop' : 'Connect'}</button>
                    </div>
                    <div className="mt-1 text-[10px] text-white/40">{mcpConnected ? '✓ Bridge connected — your AI can now build in this world (see AI_MCP.md)' : 'Let an external AI agent drive this world. Protocol: AI_MCP.md'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* waypoints */}
            <div className="mb-3 rounded-lg bg-white/5 p-3">
              <div className="mb-2 text-xs font-bold uppercase text-white/50">Waypoints</div>
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
                <div className="text-[11px] text-white/30">Mark your base, mines, builds… then teleport back instantly.</div>
              )}
            </div>

            <div className="mb-3 rounded-lg bg-white/5 p-3 text-[11px] leading-4 text-white/50">
              <b className="text-white/80">Controls</b> — WASD move · double-Space fly · E inventory · T chat · F3 debug · 1-9/wheel hotbar<br />
              Mobile: joystick · drag to look · hold to mine · tap to place · double-tap ⬆ to fly
            </div>

            <button className="w-full rounded-lg bg-red-700 py-3 font-bold text-white"
              onClick={() => { gameRef.current?.save(); onExit(); }}>Save & Quit</button>
          </div>
        </div>
      )}
    </div>
  );
}
