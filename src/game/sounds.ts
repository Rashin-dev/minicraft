// Procedural WebAudio: SFX, rain loop, ambient generative music (no assets)
let ctx: AudioContext | null = null;
let enabled = true;
let musicEnabled = true;
let musicTimer: number | null = null;
let rainSrc: AudioBufferSourceNode | null = null;
let rainGain: GainNode | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSoundEnabled(v: boolean) { enabled = v; if (!v) { sounds.rainLoop(false, 0); setMusic(false); } else if (musicEnabled) setMusic(true); }
export function setMusicEnabled(v: boolean) { musicEnabled = v; setMusic(v); }

function noiseBurst(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass', decay = true) {
  if (!enabled) return;
  try {
    const a = ac();
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (decay ? (1 - i / len) : 1);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  } catch { /* ignore */ }
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 0, delay = 0) {
  if (!enabled) return;
  try {
    const a = ac();
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch { /* ignore */ }
}

export const sounds = {
  breakBlock() { noiseBurst(0.15, 900, 0.22); },
  placeBlock() { noiseBurst(0.08, 1400, 0.18); tone(220, 0.06, 0.07, 'triangle'); },
  step() { noiseBurst(0.05, 700, 0.05); },
  hurt() { tone(180, 0.2, 0.15, 'sawtooth', -80); },
  splash() { noiseBurst(0.3, 1100, 0.18); },
  explode() { noiseBurst(0.9, 250, 0.5); tone(60, 0.7, 0.32, 'sine', -40); },
  fuse() { noiseBurst(0.5, 3000, 0.08, 'highpass'); },
  pop() { tone(500, 0.08, 0.1, 'square', 300); },
  pickup() { tone(520, 0.09, 0.09, 'square', 420); tone(780, 0.1, 0.07, 'square', 200, 0.06); },
  craft() { noiseBurst(0.06, 1800, 0.1); tone(340, 0.08, 0.08, 'triangle', 120); },
  eat() { noiseBurst(0.07, 800, 0.12); noiseBurst(0.07, 700, 0.1); tone(180, 0.1, 0.05, 'triangle', -60); },
  click() { tone(800, 0.04, 0.07, 'square'); },
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 0.08, 'triangle', 0, i * 0.09)); },
  sleep() { [392, 494, 587].forEach((f, i) => tone(f, 0.5, 0.05, 'sine', 0, i * 0.25)); },
  thunder() { noiseBurst(1.6, 160, 0.5, 'lowpass'); tone(50, 1.2, 0.3, 'sine', -25, 0.1); },
  arrow() { noiseBurst(0.2, 2400, 0.1, 'highpass'); },
  zombie() { tone(110, 0.5, 0.1, 'sawtooth', 25); tone(105, 0.5, 0.08, 'sawtooth', 18, 0.12); },
  skeleton() { for (let i = 0; i < 4; i++) noiseBurst(0.05, 1800 + Math.random() * 800, 0.06, 'bandpass'); },
  creeperHiss() { noiseBurst(1.1, 4200, 0.22, 'highpass', false); },
  pig() { tone(300, 0.15, 0.08, 'sawtooth', 120); },
  sheep() { tone(420, 0.2, 0.07, 'triangle', -100); },
  cow() { tone(160, 0.3, 0.1, 'sawtooth', -40); },
  chicken() { tone(600, 0.08, 0.08, 'square', -250); },
  rainLoop(on: boolean, gain: number) {
    try {
      if (on) {
        const a = ac();
        if (!rainSrc) {
          const len = a.sampleRate * 2;
          const buf = a.createBuffer(1, len, a.sampleRate);
          const d = buf.getChannelData(0);
          let last = 0;
          for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
          rainSrc = a.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
          const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
          rainGain = a.createGain(); rainGain.gain.value = 0;
          rainSrc.connect(f); f.connect(rainGain); rainGain.connect(a.destination);
          rainSrc.start();
        }
        rainGain?.gain.setTargetAtTime(gain, ac().currentTime, 0.8);
      } else if (rainGain) {
        rainGain.gain.setTargetAtTime(0, ac().currentTime, 0.8);
      }
    } catch { /* ignore */ }
  },
};

// ---- generative ambient music: soft pentatonic pad notes ----
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.26];
function musicTick() {
  if (!musicEnabled || !enabled) return;
  try {
    const a = ac();
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const f = SCALE[Math.floor(Math.random() * SCALE.length)];
      const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const o2 = a.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2.001;
      const g = a.createGain();
      const t0 = a.currentTime + i * 0.4;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.028, t0 + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6);
      const g2 = a.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + 6.2); o2.start(t0); o2.stop(t0 + 6.2);
    }
  } catch { /* ignore */ }
  musicTimer = window.setTimeout(musicTick, 9000 + Math.random() * 9000);
}

export function setMusic(on: boolean) {
  if (musicTimer !== null) { clearTimeout(musicTimer); musicTimer = null; }
  if (on && musicEnabled && enabled) musicTick();
}
