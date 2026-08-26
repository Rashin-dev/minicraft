// Unified input: keyboard/mouse + touch write into the same InputState
export interface InputState {
  forward: number;
  strafe: number;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
  lookDX: number;
  lookDY: number;
  breakHeld: boolean;
  placeQueued: boolean;
  breakQueued: boolean;
}

export const input: InputState = {
  forward: 0, strafe: 0, jump: false, sneak: false, sprint: false,
  lookDX: 0, lookDY: 0, breakHeld: false, placeQueued: false, breakQueued: false,
};

export class Controls {
  keys = new Set<string>();
  isTouch = false;
  private canvas: HTMLElement;
  onPause: () => void = () => {};
  onHotbar: (i: number) => void = () => {};
  onHotbarScroll: (dir: number) => void = () => {};
  onInventory: () => void = () => {};
  onChat: (prefill: string) => void = () => {};
  onFlyToggle: () => void = () => {};
  onDebug: () => void = () => {};
  enabled = false;
  uiOpen = false; // chat/inventory open — suppress game keys

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    this.isTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || this.uiOpen) return;
      if (e.code === 'Escape') { this.onPause(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) this.onHotbar(n - 1);
      }
      if (e.code === 'KeyE') { this.onInventory(); e.preventDefault(); }
      if (e.code === 'KeyT' || e.code === 'Slash') { this.onChat(e.code === 'Slash' ? '/' : ''); e.preventDefault(); }
      if (e.code === 'KeyF') this.onFlyToggle();
      if (e.code === 'F3') { this.onDebug(); e.preventDefault(); }
      this.syncKeys();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.syncKeys(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.syncKeys(); });

    canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.onHotbarScroll(e.deltaY > 0 ? 1 : -1);
      e.preventDefault();
    }, { passive: false });

    // Mouse: pointer lock on desktop
    canvas.addEventListener('click', () => {
      if (!this.enabled || this.isTouch) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      input.lookDX += e.movementX; input.lookDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      if (e.button === 0) input.breakHeld = true;
      if (e.button === 2) input.placeQueued = true;
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) input.breakHeld = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch look: drag on the canvas (HUD joystick is a separate element)
    let lookId = -1, lastX = 0, lastY = 0;
    let tapStart = 0, tapX = 0, tapY = 0, holdTimer: number | null = null;
    canvas.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of Array.from(e.changedTouches)) {
        if (lookId === -1) {
          lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
          tapStart = performance.now(); tapX = t.clientX; tapY = t.clientY;
          holdTimer = window.setTimeout(() => { input.breakHeld = true; }, 230);
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookId) {
          input.lookDX += (t.clientX - lastX) * 2.2;
          input.lookDY += (t.clientY - lastY) * 2.2;
          lastX = t.clientX; lastY = t.clientY;
          if (Math.hypot(t.clientX - tapX, t.clientY - tapY) > 24 && holdTimer) {
            clearTimeout(holdTimer); holdTimer = null;
          }
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookId) {
          lookId = -1;
          if (holdTimer) {
            clearTimeout(holdTimer); holdTimer = null;
            if (performance.now() - tapStart < 230) input.placeQueued = true;
          }
          input.breakHeld = false;
        }
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  private syncKeys() {
    const k = this.keys;
    if (!this.isTouch || k.size > 0) {
      input.forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      input.strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    }
    if (k.has('Space')) input.jump = true; else if (!this.isTouch) input.jump = false;
    if (!this.isTouch) input.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    if (!this.isTouch) input.sneak = k.has('ControlLeft') || k.has('KeyC');
  }
}
