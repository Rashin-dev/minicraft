// Procedural WebAudio sounds (no assets needed)
let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSoundEnabled(v: boolean) { enabled = v; }

function noiseBurst(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass') {
  if (!enabled) return;
  try {
    const a = ac();
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  } catch { /* ignore */ }
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 0) {
  if (!enabled) return;
  try {
    const a = ac();
    const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  } catch { /* ignore */ }
}

export const sounds = {
  breakBlock() { noiseBurst(0.15, 900, 0.25); },
  placeBlock() { noiseBurst(0.08, 1400, 0.2); tone(220, 0.06, 0.08, 'triangle'); },
  step() { noiseBurst(0.05, 700, 0.06); },
  hurt() { tone(180, 0.2, 0.15, 'sawtooth', -80); },
  splash() { noiseBurst(0.3, 1100, 0.2); },
  explode() { noiseBurst(0.9, 250, 0.5); tone(60, 0.7, 0.35, 'sine', -40); },
  fuse() { noiseBurst(0.5, 3000, 0.08, 'highpass'); },
  pop() { tone(500, 0.08, 0.12, 'square', 300); },
  click() { tone(800, 0.04, 0.08, 'square'); },
  pig() { tone(300, 0.15, 0.08, 'sawtooth', 120); },
  sheep() { tone(420, 0.2, 0.07, 'triangle', -100); },
  cow() { tone(160, 0.3, 0.1, 'sawtooth', -40); },
  chicken() { tone(600, 0.08, 0.08, 'square', -250); },
};
