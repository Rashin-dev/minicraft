// Virtual joystick for touch movement
import { useRef, useState } from 'react';
import { input } from '@/game/controls';

export function Joystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number>(-1);

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current!.getBoundingClientRect();
    const cx = base.left + base.width / 2, cy = base.top + base.height / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const max = base.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    setKnob({ x: dx, y: dy });
    input.strafe = dx / max;
    input.forward = -dy / max;
    input.sprint = len > max * 0.92;
  };

  return (
    <div
      ref={baseRef}
      className={`pointer-events-auto relative h-32 w-32 rounded-full border-2 ${active ? 'border-white/60 bg-white/15' : 'border-white/30 bg-white/10'} backdrop-blur-sm select-none`}
      onTouchStart={(e) => {
        const t = e.changedTouches[0];
        touchId.current = t.identifier;
        setActive(true);
        update(t.clientX, t.clientY);
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier === touchId.current) update(t.clientX, t.clientY);
        }
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier === touchId.current) {
            touchId.current = -1;
            setKnob({ x: 0, y: 0 });
            setActive(false);
            input.forward = 0; input.strafe = 0; input.sprint = false;
          }
        }
      }}
    >
      <div
        className="absolute h-14 w-14 rounded-full bg-white/50 border border-white/70 shadow-lg"
        style={{ left: `calc(50% - 28px + ${knob.x}px)`, top: `calc(50% - 28px + ${knob.y}px)` }}
      />
    </div>
  );
}
